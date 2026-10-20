import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { SqliteDatabase } from '../src/db/sqlite.js';
import { runMigrations } from '../src/db/migrationRunner.js';
import { NoobCoinRepository } from '../src/repositories/noobcoinRepository.js';
import { NoobCoinRewardService } from '../src/services/noobcoinRewardService.js';
import { CharacterRepository } from '../src/repositories/characterRepository.js';
import { AccountRepository } from '../src/repositories/accountRepository.js';

test('NoobRPG — Missão 29: Livro-Razão (Ledger) do NoobCoin e Sistema de Recompensas', async (t) => {
  const dbPath = path.resolve(process.cwd(), `test_noobcoin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.sqlite`);
  let db = new SqliteDatabase(dbPath);
  await runMigrations(db);

  let accountRepo = new AccountRepository(db);
  let characterRepo = new CharacterRepository(db);
  let noobcoinRepo = new NoobCoinRepository(db);
  let noobcoinService = new NoobCoinRewardService(db, noobcoinRepo);

  // Setup: Cria 2 contas e 2 personagens para testes isolados
  const acc1Id = randomUUID();
  const acc2Id = randomUUID();
  const acc1 = await accountRepo.create({ id: acc1Id, username: 'crypto_player_1', password_hash: 'hashed_pass_1' });
  const acc2 = await accountRepo.create({ id: acc2Id, username: 'crypto_player_2', password_hash: 'hashed_pass_2' });

  const char1Id = randomUUID();
  const char2Id = randomUUID();
  const char1 = await characterRepo.create({
    id: char1Id,
    account_id: acc1.id,
    name: 'CryptoHero',
    character_class: 'warrior',
    level: 5,
    current_xp: 0,
    gold: 100,
    merit_points: 0,
    pos_x: 100,
    pos_y: 100,
    hp: 100,
    mp: 50
  });

  const char2 = await characterRepo.create({
    id: char2Id,
    account_id: acc2.id,
    name: 'BlockchainMage',
    character_class: 'mage',
    level: 5,
    current_xp: 0,
    gold: 100,
    merit_points: 0,
    pos_x: 100,
    pos_y: 100,
    hp: 80,
    mp: 100
  });

  await t.test('1. Converte com precisão unidades decimais para inteiros brutos (6 decimais)', () => {
    assert.equal(NoobCoinRewardService.parseUnits('1'), 1_000_000);
    assert.equal(NoobCoinRewardService.parseUnits('1.5'), 1_500_000);
    assert.equal(NoobCoinRewardService.parseUnits('0.000001'), 1);
    assert.equal(NoobCoinRewardService.parseUnits('100.250000'), 100_250_000);
    assert.equal(NoobCoinRewardService.formatUnits(1_500_000), '1.500000');
    assert.equal(NoobCoinRewardService.formatUnits(1), '0.000001');

    assert.throws(() => NoobCoinRewardService.parseUnits('abc'), /Formato decimal inválido/);
    assert.throws(() => NoobCoinRewardService.parseUnits('1.1234567'), /Número excessivo de casas decimais/);
    assert.throws(() => NoobCoinRewardService.parseUnits('10000000000000'), /Valor excede limite de inteiro seguro em JS/);
  });

  await t.test('2. Criação de recompensa válida com status APPROVED no ledger', async () => {
    const res = await noobcoinService.grantReward({
      characterId: char1.id,
      accountId: acc1.id,
      rewardType: 'SEASON_REWARD',
      sourceEvent: 'season_01_tier_gold',
      amountRaw: 5_000_000, // 5 NOOB
      idempotencyKey: 'tx_season_01_char1_001',
      sourceOperationId: 'op_season_final'
    });

    assert.equal(res.success, true);
    assert.equal(res.isDuplicate, false);
    assert.ok(res.reward);
    assert.equal(res.reward.amount_raw, 5_000_000);
    assert.equal(res.reward.status, 'APPROVED');
    assert.equal(res.reward.idempotency_key, 'tx_season_01_char1_001');
    assert.equal(res.reward.onchain_tx_signature, null); // Sem transação on-chain
  });

  await t.test('3. Idempotência estrita: Repetição com a mesma chave retorna estado anterior sem duplicar', async () => {
    const resDuplicate = await noobcoinService.grantReward({
      characterId: char1.id,
      accountId: acc1.id,
      rewardType: 'SEASON_REWARD',
      sourceEvent: 'season_01_tier_gold',
      amountRaw: 5_000_000,
      idempotencyKey: 'tx_season_01_char1_001'
    });

    assert.equal(resDuplicate.success, true);
    assert.equal(resDuplicate.isDuplicate, true);
    assert.equal(resDuplicate.code, 'DUPLICATE_OPERATION');
    assert.ok(resDuplicate.reward);

    // Confirma no banco que existe apenas 1 registro no ledger
    const list = await noobcoinService.getCharacterHistory(char1.id);
    assert.equal(list.length, 1);
  });

  await t.test('4. Concorrência: Múltiplas requisições simultâneas (Promise.all) protegidas contra race conditions', async () => {
    const concurrentKey = 'tx_concurrent_tournament_char2';
    const promises = Array.from({ length: 5 }).map(() =>
      noobcoinService.grantReward({
        characterId: char2.id,
        accountId: acc2.id,
        rewardType: 'TOURNAMENT_REWARD',
        sourceEvent: 'pvp_weekly_top1',
        amountRaw: 10_000_000, // 10 NOOB
        idempotencyKey: concurrentKey
      })
    );

    const results = await Promise.all(promises);
    const successList = results.filter(r => r.success);
    assert.equal(successList.length, 5);

    // Apenas uma deve ser a criadora original (isDuplicate === false), as demais devem ser duplicatas reconhecidas
    const originals = results.filter(r => r.isDuplicate === false);
    const duplicates = results.filter(r => r.isDuplicate === true);
    assert.equal(originals.length, 1);
    assert.equal(duplicates.length, 4);

    // Verifica no banco de dados
    const historyChar2 = await noobcoinService.getCharacterHistory(char2.id);
    assert.equal(historyChar2.length, 1);
    assert.equal(historyChar2[0].amount_raw, 10_000_000);
  });

  await t.test('5. Rejeição de quantidades inválidas (zero, números negativos e decimais flutuantes)', async () => {
    const resZero = await noobcoinService.grantReward({
      characterId: char1.id,
      accountId: acc1.id,
      rewardType: 'TEST',
      sourceEvent: 'test_zero',
      amountRaw: 0,
      idempotencyKey: 'tx_invalid_zero'
    });
    assert.equal(resZero.success, false);
    assert.equal(resZero.code, 'INVALID_AMOUNT');

    const resNeg = await noobcoinService.grantReward({
      characterId: char1.id,
      accountId: acc1.id,
      rewardType: 'TEST',
      sourceEvent: 'test_negative',
      amountRaw: -1_000_000,
      idempotencyKey: 'tx_invalid_neg'
    });
    assert.equal(resNeg.success, false);
    assert.equal(resNeg.code, 'INVALID_AMOUNT');

    const resFloat = await noobcoinService.grantReward({
      characterId: char1.id,
      accountId: acc1.id,
      rewardType: 'TEST',
      sourceEvent: 'test_float',
      amountRaw: 123.456 as any,
      idempotencyKey: 'tx_invalid_float'
    });
    assert.equal(resFloat.success, false);
    assert.equal(resFloat.code, 'INVALID_AMOUNT');
  });

  await t.test('6. Limites diários: Rejeição ao ultrapassar teto diário de personagem', async () => {
    // Teto padrão configurado: 100 NOOB = 100_000_000 unidades. Char1 já consumiu 5_000_000.
    // Tentativa de conceder 96_000_000 deve estourar o teto (5 + 96 = 101 > 100)
    const resOver = await noobcoinService.grantReward({
      characterId: char1.id,
      accountId: acc1.id,
      rewardType: 'OVERFLOW_TEST',
      sourceEvent: 'event_overflow',
      amountRaw: 96_000_000,
      idempotencyKey: 'tx_overflow_char1'
    });

    assert.equal(resOver.success, false);
    assert.equal(resOver.code, 'DAILY_CHARACTER_LIMIT_EXCEEDED');

    // Confirma que nenhuma recompensa adicional foi gravada
    const list = await noobcoinService.getCharacterHistory(char1.id);
    assert.equal(list.length, 1);
  });

  await t.test('7. Bloqueio imediato quando a distribuição está pausada', async () => {
    await noobcoinService.pauseDistribution();
    assert.equal(await noobcoinService.isDistributionPaused(), true);

    const resPaused = await noobcoinService.grantReward({
      characterId: char2.id,
      accountId: acc2.id,
      rewardType: 'PAUSED_TEST',
      sourceEvent: 'event_paused',
      amountRaw: 1_000_000,
      idempotencyKey: 'tx_while_paused'
    });

    assert.equal(resPaused.success, false);
    assert.equal(resPaused.code, 'DISTRIBUTION_PAUSED');

    // Retoma distribuição
    await noobcoinService.resumeDistribution();
    assert.equal(await noobcoinService.isDistributionPaused(), false);
  });

  await t.test('8. Máquina de estados: Bloqueio de transições arbitrárias e estados on-chain inativos', async () => {
    const listChar1 = await noobcoinService.getCharacterHistory(char1.id);
    const rewardId = listChar1[0].id;

    // Transição permitida: APPROVED -> QUEUED
    const updatedQueued = await noobcoinRepo.updateRewardStatus(rewardId, 'QUEUED');
    assert.equal(updatedQueued.status, 'QUEUED');

    // Tentativa de transição arbitrária ilegal (ex: QUEUED direto para APPROVED) deve falhar
    await assert.rejects(
      async () => {
        await noobcoinRepo.updateRewardStatus(rewardId, 'APPROVED');
      },
      /Transição de estado inválida/
    );

    // Tentativa de avanço para SUBMITTED ou CONFIRMED deve ser recusada na Missão 29 (inativo)
    await assert.rejects(
      async () => {
        await noobcoinRepo.updateRewardStatus(rewardId, 'SUBMITTED');
      },
      /inativa na Missão 29/
    );
  });

  await t.test('9. Isolamento total entre personagens e histórico auditável', async () => {
    const history1 = await noobcoinService.getCharacterHistory(char1.id);
    const history2 = await noobcoinService.getCharacterHistory(char2.id);

    assert.equal(history1.length, 1);
    assert.equal(history2.length, 1);
    assert.notEqual(history1[0].id, history2[0].id);
    assert.equal(history1[0].character_id, char1.id);
    assert.equal(history2[0].character_id, char2.id);
  });

  await t.test('10. Persistência real: Dados preservados após reabrir a conexão com o banco', async () => {
    await db.close();

    // Reabre o banco a partir do arquivo em disco e reconecta os repositórios
    db = new SqliteDatabase(dbPath);
    noobcoinRepo = new NoobCoinRepository(db);
    noobcoinService = new NoobCoinRewardService(db, noobcoinRepo);
    accountRepo = new AccountRepository(db);
    characterRepo = new CharacterRepository(db);
    const char1Rewards = await noobcoinRepo.getRewardsByCharacter(char1.id);

    assert.equal(char1Rewards.length, 1);
    assert.equal(char1Rewards[0].amount_raw, 5_000_000);
    assert.equal(char1Rewards[0].idempotency_key, 'tx_season_01_char1_001');
  });

  await t.test('11. Ausência de dependências ou chamadas Solana ativas nesta fase', () => {
    // Garante que nenhuma chave privada ou credencial real está exposta
    assert.equal(process.env.SOLANA_PRIVATE_KEY, undefined);
    assert.equal(process.env.NOOB_MINT_KEYPAIR, undefined);
  });

  await t.test('12. Precisão numérica, inteiros seguros, rejeição de NaN/Infinity/floats em formatUnits e setDailyLimits (Missão 30O)', async () => {
    // formatUnits deve rejeitar NaN, Infinity, negativos, floats ou inteiros inseguros
    assert.throws(() => NoobCoinRewardService.formatUnits(NaN), /Quantidade bruta inválida ou insegura/);
    assert.throws(() => NoobCoinRewardService.formatUnits(Infinity), /Quantidade bruta inválida ou insegura/);
    assert.throws(() => NoobCoinRewardService.formatUnits(-100), /Quantidade bruta inválida ou insegura/);
    assert.throws(() => NoobCoinRewardService.formatUnits(123.45), /Quantidade bruta inválida ou insegura/);
    assert.throws(() => NoobCoinRewardService.formatUnits(Number.MAX_SAFE_INTEGER + 1000), /Quantidade bruta inválida ou insegura/);

    // formatUnits formata corretamente valores seguros
    assert.equal(NoobCoinRewardService.formatUnits(0), '0.000000');
    assert.equal(NoobCoinRewardService.formatUnits(1_000_000), '1.000000');
    assert.equal(NoobCoinRewardService.formatUnits(1_500_000), '1.500000');

    // setDailyLimits deve rejeitar NaN, Infinity, valores <= 0 e inteiros inseguros
    await assert.rejects(async () => {
      await noobcoinService.setDailyLimits(NaN, 100);
    }, /Limites diários devem ser números inteiros estritamente positivos e seguros/);

    await assert.rejects(async () => {
      await noobcoinService.setDailyLimits(100, Infinity);
    }, /Limites diários devem ser números inteiros estritamente positivos e seguros/);

    await assert.rejects(async () => {
      await noobcoinService.setDailyLimits(-50, 100);
    }, /Limites diários devem ser números inteiros estritamente positivos e seguros/);

    await assert.rejects(async () => {
      await noobcoinService.setDailyLimits(100.5, 200);
    }, /Limites diários devem ser números inteiros estritamente positivos e seguros/);

    await assert.rejects(async () => {
      await noobcoinService.setDailyLimits(Number.MAX_SAFE_INTEGER + 1000, 200);
    }, /Limites diários devem ser números inteiros estritamente positivos e seguros/);
  });

  await t.test('13. Atomicidade em falha e ausência de alterações parciais no banco (Missão 30P)', async () => {
    const rewardsBefore = await noobcoinService.getCharacterHistory(char1.id, 100);
    const countBefore = rewardsBefore.length;

    // Tentativa 1: Quantidade inválida (NaN / float)
    const resInvalid = await noobcoinService.grantReward({
      characterId: char1.id,
      accountId: acc1.id,
      rewardType: 'ATTACK_TEST',
      sourceEvent: 'tamper_nan',
      amountRaw: NaN as any,
      idempotencyKey: 'idemp_fail_nan'
    });
    assert.equal(resInvalid.success, false);
    assert.equal(resInvalid.code, 'INVALID_AMOUNT');

    // Tentativa 2: Quantidade acima do teto diário
    const resOver = await noobcoinService.grantReward({
      characterId: char1.id,
      accountId: acc1.id,
      rewardType: 'ATTACK_TEST',
      sourceEvent: 'tamper_over',
      amountRaw: 500_000_000,
      idempotencyKey: 'idemp_fail_over'
    });
    assert.equal(resOver.success, false);

    // Confirma que nenhuma linha foi gravada no ledger
    const rewardsAfter = await noobcoinService.getCharacterHistory(char1.id, 100);
    assert.equal(rewardsAfter.length, countBefore, 'Nenhum registro parcial inserido no ledger');
  });

  await t.test('14. Concorrência controlada e atomicidade transacional com recarga em disco (Missão 30P)', async () => {
    // Cria uma nova conta e personagem para teste isolado de concorrência
    const accIsoId = randomUUID();
    const accountIso = await accountRepo.create({ id: accIsoId, username: 'iso_user', password_hash: 'iso_hash' });
    const charIsoId = randomUUID();
    const charIso = await characterRepo.create({
      id: charIsoId,
      account_id: accountIso.id,
      name: 'IsoHero',
      character_class: 'warrior',
      level: 5,
      current_xp: 0,
      gold: 100,
      merit_points: 0,
      pos_x: 100,
      pos_y: 100,
      hp: 100,
      mp: 50
    });

    // Dispara 5 concessões simultâneas de 1 NOOB (1_000_000)
    const promises = Array.from({ length: 5 }, (_, i) =>
      noobcoinService.grantReward({
        characterId: charIso.id,
        accountId: accountIso.id,
        rewardType: 'QUEST_REWARD',
        sourceEvent: `quest_${i}`,
        amountRaw: 1_000_000,
        idempotencyKey: `idemp_iso_concur_${i}`
      })
    );

    const results = await Promise.all(promises);
    assert.equal(results.every(r => r.success === true), true);

    const history = await noobcoinService.getCharacterHistory(charIso.id);
    assert.equal(history.length, 5);

    const usage = await noobcoinService.getDailyUsage(charIso.id, accountIso.id);
    assert.equal(usage.characterTotal, 5_000_000);
    assert.equal(usage.accountTotal, 5_000_000);
  });

  // Limpeza
  await db.close();
  try {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  } catch (err) {
    // Ignora se bloqueado
  }
});
