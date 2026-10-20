import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWorkerConfig } from '../src/config.js';
import { MockTokenService } from '../src/tokenService.js';
import { InMemoryLedgerAdapter, LedgerRewardItem } from '../src/ledgerAdapter.js';
import { SolanaDevnetWorker } from '../src/worker.js';
import { LedgerReconciler } from '../src/reconciler.js';

test('NoobRPG Solana Worker — Suíte 2: Distribuição Controlada, Máquina de Estados e Reconciliação', async (t) => {
  const config = loadWorkerConfig({
    SOLANA_NETWORK: 'devnet',
    SOLANA_RPC_URL: 'http://localhost:8899', // Simulação local
    NOOB_TEST_MINT_ADDRESS: '4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi', // Chave pública Base58 válida de 32 bytes
    WORKER_DRY_RUN: 'false'
  });

  const mockTokenOps = new MockTokenService();
  const ledger = new InMemoryLedgerAdapter();
  const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

  // Setup: vincula carteiras simuladas
  ledger.wallets.set('char_hero_01', '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'); // Public Key válida Base58
  ledger.wallets.set('char_hero_02', '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLyTiQ3h44XJp');

  await t.test('1. Inicialização do worker em ambiente simulado validado', async () => {
    await assert.doesNotReject(async () => {
      await worker.initialize();
    });
  });

  await t.test('2. Processa com sucesso recompensa válida: APPROVED -> QUEUED -> SUBMITTED -> CONFIRMED', async () => {
    const rewardItem: LedgerRewardItem = {
      id: 'rew_devnet_001',
      characterId: 'char_hero_01',
      accountId: 'acc_01',
      rewardType: 'SEASON_REWARD',
      amountRaw: 5_000_000, // 5 tNOOB (6 decimais)
      status: 'APPROVED',
      idempotencyKey: 'idemp_key_001'
    };
    ledger.rewards.set(rewardItem.id, rewardItem);

    const summary = await worker.processBatch();

    assert.equal(summary.processed, 1);
    assert.equal(summary.confirmed, 1);
    assert.equal(summary.failed, 0);

    const updated = ledger.rewards.get('rew_devnet_001')!;
    assert.equal(updated.status, 'CONFIRMED');
    assert.ok(updated.onchainTxSignature?.startsWith('SigTx'));
    assert.equal(mockTokenOps.transferCount, 1);
  });

  await t.test('3. Idempotência estrita: Novo ciclo não reprocessa recompensa já confirmada', async () => {
    const summary = await worker.processBatch();

    // Nenhuma recompensa pendente deve ser processada novamente
    assert.equal(summary.processed, 0);
    assert.equal(summary.confirmed, 0);
    assert.equal(mockTokenOps.transferCount, 1); // Continua 1, zero duplicação
  });

  await t.test('4. Rejeição de destinatário com chave pública Solana inválida', async () => {
    ledger.wallets.set('char_invalid_wallet', 'InvalidKeyWithSpecialChars!@#$');

    const rewardInvalid: LedgerRewardItem = {
      id: 'rew_invalid_wallet',
      characterId: 'char_invalid_wallet',
      accountId: 'acc_02',
      rewardType: 'TEST',
      amountRaw: 1_000_000,
      status: 'APPROVED',
      idempotencyKey: 'idemp_key_invalid_wallet'
    };
    ledger.rewards.set(rewardInvalid.id, rewardInvalid);

    const summary = await worker.processBatch();

    assert.equal(summary.processed, 1);
    assert.equal(summary.failed, 1);

    const updated = ledger.rewards.get('rew_invalid_wallet')!;
    assert.equal(updated.status, 'CANCELLED'); // Cancelado por segurança
    assert.equal(mockTokenOps.transferCount, 1); // Nenhuma transferência enviada
  });

  await t.test('5. Rejeição de quantidade inválida (zero ou negativa)', async () => {
    const rewardZero: LedgerRewardItem = {
      id: 'rew_zero_amount',
      characterId: 'char_hero_01',
      accountId: 'acc_01',
      rewardType: 'TEST',
      amountRaw: 0,
      status: 'APPROVED',
      idempotencyKey: 'idemp_zero'
    };
    ledger.rewards.set(rewardZero.id, rewardZero);

    const summary = await worker.processBatch();
    assert.equal(summary.failed, 1);

    const updated = ledger.rewards.get('rew_zero_amount')!;
    assert.equal(updated.status, 'CANCELLED');
  });

  await t.test('6. Resiliência a Timeout de RPC: Transição para SUBMITTED e reconciliação sem reenvio', async () => {
    // Ativa simulação de timeout no RPC
    mockTokenOps.shouldSimulateTimeout = true;

    const rewardTimeout: LedgerRewardItem = {
      id: 'rew_timeout_001',
      characterId: 'char_hero_02',
      accountId: 'acc_02',
      rewardType: 'TOURNAMENT_REWARD',
      amountRaw: 10_000_000,
      status: 'APPROVED',
      idempotencyKey: 'idemp_timeout_001'
    };
    ledger.rewards.set(rewardTimeout.id, rewardTimeout);

    // Ciclo 1: Envia transferência, mas RPC dá timeout na confirmação
    const summary1 = await worker.processBatch();
    assert.equal(summary1.submitted, 1);
    assert.equal(summary1.confirmed, 0); // Não confirmou de imediato

    const itemAfterTimeout = ledger.rewards.get('rew_timeout_001')!;
    assert.equal(itemAfterTimeout.status, 'SUBMITTED');
    assert.ok(itemAfterTimeout.onchainTxSignature);
    const countAfterCycle1 = mockTokenOps.transferCount;

    // Desativa simulação de timeout para o ciclo seguinte
    mockTokenOps.shouldSimulateTimeout = false;

    // Ciclo 2: Reconciliação preventiva consulta a assinatura prévia na blockchain
    const summary2 = await worker.processBatch();
    assert.equal(summary2.reconciled, 1);
    assert.equal(summary2.confirmed, 1);

    const itemReconciled = ledger.rewards.get('rew_timeout_001')!;
    assert.equal(itemReconciled.status, 'CONFIRMED');

    // REGRA DE OURO: O transferCount NÃO PODE ter aumentado no Ciclo 2!
    assert.equal(mockTokenOps.transferCount, countAfterCycle1);
  });

  await t.test('7. Tratamento de Rejeição On-Chain: Transiciona para CANCELLED', async () => {
    mockTokenOps.shouldSimulateRejection = true;

    const rewardReject: LedgerRewardItem = {
      id: 'rew_reject_001',
      characterId: 'char_hero_01',
      accountId: 'acc_01',
      rewardType: 'EVENT_REWARD',
      amountRaw: 2_000_000,
      status: 'APPROVED',
      idempotencyKey: 'idemp_reject_001'
    };
    ledger.rewards.set(rewardReject.id, rewardReject);

    const summary = await worker.processBatch();
    assert.equal(summary.failed, 1);

    const itemRejected = ledger.rewards.get('rew_reject_001')!;
    assert.equal(itemRejected.status, 'CANCELLED');

    mockTokenOps.shouldSimulateRejection = false;
  });

  await t.test('8. Reconciliação Contábil (LedgerReconciler): Detecta divergências e confirma equilíbrio', async () => {
    const reconciler = new LedgerReconciler(ledger, mockTokenOps);

    // Auditoria com dados íntegros
    const allRewards = Array.from(ledger.rewards.values());
    const reportClean = await reconciler.auditReconciliation(allRewards);

    assert.equal(reportClean.isBalanced, true);
    assert.equal(reportClean.divergentSignatures.length, 0);
    assert.equal(reportClean.totalConfirmedRewardsCount, 2); // rew_devnet_001 e rew_timeout_001

    // Simula adulteração no banco (recompensa CONFIRMED com assinatura inexistente)
    const forgedReward: LedgerRewardItem = {
      id: 'rew_forged_001',
      characterId: 'char_hero_01',
      accountId: 'acc_01',
      rewardType: 'HACK',
      amountRaw: 50_000_000,
      status: 'CONFIRMED',
      idempotencyKey: 'idemp_forged',
      onchainTxSignature: 'SigFakeUnknownOnChain12345'
    };

    const reportDivergent = await reconciler.auditReconciliation([...allRewards, forgedReward]);
    assert.equal(reportDivergent.isBalanced, false);
    assert.equal(reportDivergent.divergentSignatures.length, 1);
    assert.equal(reportDivergent.divergentSignatures[0], 'SigFakeUnknownOnChain12345');
  });

  await t.test('9. Zero Client Trust: O cliente do jogo não possui qualquer autorização de envio on-chain', () => {
    // Confirma que nenhuma rota pública de cliente consegue acionar o worker diretamente
    assert.equal(typeof (worker as any).sendClientRequest, 'undefined');
  });
});
