import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { SqliteDatabase } from '../src/db/sqlite.js';
import { runMigrations } from '../src/db/migrationRunner.js';
import { CharacterRepository } from '../src/repositories/characterRepository.js';
import { InventoryRepository } from '../src/repositories/inventoryRepository.js';
import { EquipmentRepository } from '../src/repositories/equipmentRepository.js';
import { GoldLedgerRepository } from '../src/repositories/goldLedgerRepository.js';
import { QuestRepository } from '../src/repositories/questRepository.js';
import { CharacterService } from '../src/services/characterService.js';
import { GameSimulation } from '../src/simulation/GameSimulation.js';
import { CharacterClass, getItemCount, NetMessageType } from '@noobrpg/shared';

describe('NoobRPG — Missão 3: Segurança de Quests, Persistência e Recompensas', () => {
  let db: SqliteDatabase;
  let charRepo: CharacterRepository;
  let invRepo: InventoryRepository;
  let eqRepo: EquipmentRepository;
  let goldRepo: GoldLedgerRepository;
  let questRepo: QuestRepository;
  let charService: CharacterService;
  let simulation: GameSimulation;

  const testAccountId = 'acc_quest_tester_01';
  const testAccount2Id = 'acc_quest_tester_02';

  beforeEach(async () => {
    // Cria banco SQLite em memória isolado para cada teste
    db = new SqliteDatabase(':memory:');
    await runMigrations(db);

    charRepo = new CharacterRepository(db);
    invRepo = new InventoryRepository(db);
    eqRepo = new EquipmentRepository(db);
    goldRepo = new GoldLedgerRepository(db);
    questRepo = new QuestRepository(db);

    charService = new CharacterService(db, charRepo, invRepo, eqRepo, goldRepo, questRepo);
    simulation = new GameSimulation();

    // Cria conta no banco para integridade referencial
    await db.execute('INSERT INTO accounts (id, username, password_hash) VALUES (?, ?, ?);', [
      testAccountId,
      'hero_tester',
      'argon_hash_1'
    ]);
    await db.execute('INSERT INTO accounts (id, username, password_hash) VALUES (?, ?, ?);', [
      testAccount2Id,
      'hero_tester_2',
      'argon_hash_2'
    ]);
  });

  it('1. Conclusão sequencial válida com concessão autoritativa de itens, ouro e XP', async () => {
    const playerData = await charService.createCharacter(testAccountId, 'Arthur', CharacterClass.WARRIOR);
    const initialGold = playerData.gold;
    const initialWood = getItemCount(playerData.inventory, 'wood_log');
    const initialIron = getItemCount(playerData.inventory, 'iron_ore');

    // Jogador entra na vila perto do Ancião Aldor (464, 280)
    const player = simulation.joinPlayer(playerData, testAccountId, 1, 'starter_village');
    player.x = 464;
    player.y = 280;

    // Etapa 0 -> 1: Conversa com Ancião Aldor
    const step0Res = simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_elder');
    assert.strictEqual(step0Res.success, true);
    assert.strictEqual(step0Res.quest?.step, 1);
    assert.strictEqual(step0Res.quest?.completed, false);
    assert.strictEqual(step0Res.rewardsAwarded, undefined);

    // Salva progresso da etapa 1
    await charService.saveQuestProgress(player.id, step0Res.quest!);

    // Jogador caminha até o Ferreiro Brann na Praça (410, 310)
    player.x = 410;
    player.y = 310;

    // Etapa 1 -> 2: Conversa com Ferreiro Brann e recebe materiais
    const step1Res = simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_blacksmith');
    assert.strictEqual(step1Res.success, true);
    assert.strictEqual(step1Res.quest?.step, 2);
    assert.strictEqual(step1Res.rewardsAwarded?.items?.length, 2);

    // Valida concessão autoritativa de 4 madeiras e 4 ferros
    const woodAfter = getItemCount(player.inventory, 'wood_log');
    const ironAfter = getItemCount(player.inventory, 'iron_ore');
    assert.strictEqual(woodAfter, initialWood + 4);
    assert.strictEqual(ironAfter, initialIron + 4);

    // Salva progresso e inventário atualizado
    await charService.saveQuestProgress(player.id, step1Res.quest!);
    const saved1 = await charService.saveAuthoritativePlayer(player.id, {
      level: player.level,
      currentXp: player.currentXp,
      gold: player.gold,
      hp: player.hp,
      mp: player.mp,
      x: player.x,
      y: player.y,
      version: player.version,
      inventory: player.inventory,
      equipped: player.equipped,
      quests: player.getAllQuests()
    });
    player.version = (saved1 as any).version || (player.version + 1);

    // Jogador retorna ao Ancião Aldor (464, 280)
    player.x = 464;
    player.y = 280;

    // Etapa 2 -> 3: Conversa final com Aldor e recebe bênção (50 Gold e 30 XP)
    const step2Res = simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_elder');
    assert.strictEqual(step2Res.success, true);
    assert.strictEqual(step2Res.quest?.step, 3);
    assert.strictEqual(step2Res.quest?.completed, true);
    assert.strictEqual(step2Res.rewardsAwarded?.gold, 50);
    assert.strictEqual(step2Res.rewardsAwarded?.xp, 30);

    assert.strictEqual(player.gold, initialGold + 50);
    assert.strictEqual(player.currentXp, 30);

    // Salva no banco de dados
    await charService.saveQuestProgress(player.id, step2Res.quest!);
    await charService.saveAuthoritativePlayer(player.id, {
      level: player.level,
      currentXp: player.currentXp,
      gold: player.gold,
      hp: player.hp,
      mp: player.mp,
      x: player.x,
      y: player.y,
      version: player.version,
      inventory: player.inventory,
      equipped: player.equipped,
      quests: player.getAllQuests(),
      goldSource: 'quest_starter_tutorial'
    });

    // Confere persistência no banco
    const loadedQuests = await charService.getAllQuests(player.id);
    assert.strictEqual(loadedQuests.starter_tutorial?.completed, true);
    assert.strictEqual(loadedQuests.starter_tutorial?.step, 3);
  });

  it('2. Zero Client Trust: Bloqueio de avanço ou conclusão fora de ordem', async () => {
    const playerData = await charService.createCharacter(testAccountId, 'Galahad', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(playerData, testAccountId, 1, 'starter_village');

    // Jogador tenta pular a conversa com Aldor e ir direto ao Ferreiro Brann no step 0
    player.x = 410;
    player.y = 310;
    const resSkipping = simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_blacksmith');

    // Deve ser categoricamente rejeitado
    assert.strictEqual(resSkipping.success, false);
    assert.strictEqual(resSkipping.reason, 'QUEST_STEP_MISMATCH');
    assert.strictEqual(resSkipping.rewardsAwarded, undefined);
    assert.strictEqual(getItemCount(player.inventory, 'iron_ore'), 0);
    assert.strictEqual(player.getQuest('starter_tutorial').step, 0);

    // Jogador avança para step 1 (falando com Aldor)
    player.x = 464;
    player.y = 280;
    simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_elder');

    // Agora no step 1, jogador tenta falar com Aldor de novo sem ter pego materiais com Brann
    const resElderRepeat = simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_elder');
    assert.strictEqual(resElderRepeat.success, true);
    assert.strictEqual(resElderRepeat.quest?.step, 1); // Continua step 1!
    assert.strictEqual(resElderRepeat.rewardsAwarded, undefined); // Nenhuma bênção nem Gold
    assert.strictEqual(player.gold, 100);
  });

  it('3. Prevenção estrita de duplicação por requisições repetidas (Idempotência)', async () => {
    const playerData = await charService.createCharacter(testAccountId, 'Lancelot', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(playerData, testAccountId, 1, 'starter_village');

    // Passo 0 -> 1
    player.x = 464;
    player.y = 280;
    simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_elder');

    // Passo 1 -> 2: Recebe materiais
    player.x = 410;
    player.y = 310;
    const firstBrann = simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_blacksmith');
    assert.strictEqual(firstBrann.rewardsAwarded?.items?.length, 2);
    const woodCount = getItemCount(player.inventory, 'wood_log');
    const ironCount = getItemCount(player.inventory, 'iron_ore');

    // Repete a requisição ao Ferreiro Brann 5 vezes consecutivas
    for (let i = 0; i < 5; i++) {
      const repeatRes = simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_blacksmith');
      assert.strictEqual(repeatRes.success, true);
      assert.strictEqual(repeatRes.rewardsAwarded, undefined, 'Recompensas não podem ser concedidas novamente');
      assert.strictEqual(getItemCount(player.inventory, 'wood_log'), woodCount, 'Madeira não pode duplicar');
      assert.strictEqual(getItemCount(player.inventory, 'iron_ore'), ironCount, 'Ferro não pode duplicar');
    }

    // Passo 2 -> 3: Recebe bênção com Aldor
    player.x = 464;
    player.y = 280;
    const firstAldor = simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_elder');
    assert.strictEqual(firstAldor.rewardsAwarded?.gold, 50);
    assert.strictEqual(firstAldor.rewardsAwarded?.xp, 30);
    const goldAfter = player.gold;
    const xpAfter = player.currentXp;

    // Repete a requisição ao Ancião Aldor 5 vezes consecutivas
    for (let i = 0; i < 5; i++) {
      const repeatElder = simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_elder');
      assert.strictEqual(repeatElder.success, true);
      assert.strictEqual(repeatElder.rewardsAwarded, undefined, 'Gold/XP não podem ser concedidos novamente');
      assert.strictEqual(player.gold, goldAfter, 'Gold deve permanecer idêntico');
      assert.strictEqual(player.currentXp, xpAfter, 'XP deve permanecer idêntico');
    }
  });

  it('4. Proteção contra requisições simultâneas concorrentes (Promise.all)', async () => {
    const playerData = await charService.createCharacter(testAccountId, 'Percival', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(playerData, testAccountId, 1, 'starter_village');

    // Avança para step 1
    player.x = 464;
    player.y = 280;
    simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_elder');

    // 10 requisições simultâneas para o Ferreiro Brann
    player.x = 410;
    player.y = 310;
    const brannPromises = Array.from({ length: 10 }).map(() =>
      Promise.resolve(simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_blacksmith'))
    );
    const brannResults = await Promise.all(brannPromises);

    // Exatamente uma deve conter rewardsAwarded; as outras 9 não
    const rewardsGranted = brannResults.filter(r => r.rewardsAwarded !== undefined);
    assert.strictEqual(rewardsGranted.length, 1, 'Exatamente uma chamada pode conceder itens');
    assert.strictEqual(getItemCount(player.inventory, 'iron_ore'), 4, 'Total de ferro deve ser rigorosamente 4');

    // 10 requisições simultâneas para o Ancião Aldor (Bênção)
    player.x = 464;
    player.y = 280;
    const elderPromises = Array.from({ length: 10 }).map(() =>
      Promise.resolve(simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_elder'))
    );
    const elderResults = await Promise.all(elderPromises);

    const elderRewardsGranted = elderResults.filter(r => r.rewardsAwarded !== undefined);
    assert.strictEqual(elderRewardsGranted.length, 1, 'Exatamente uma chamada pode conceder Gold/XP');
    assert.strictEqual(player.gold, 150, 'Gold total deve ser 100 inicial + 50 da missão');
    assert.strictEqual(player.currentXp, 30, 'XP total deve ser exatamente 30');
  });

  it('5. Integridade do livro-razão de ouro (gold_transactions)', async () => {
    const playerData = await charService.createCharacter(testAccountId, 'Tristao', CharacterClass.MAGE);
    const initialGold = playerData.gold;

    // Concede recompensa via transação autoritativa
    const player = simulation.joinPlayer(playerData, testAccountId, 1, 'starter_village');
    player.x = 464;
    player.y = 280;
    simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_elder');

    player.x = 410;
    player.y = 310;
    simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_blacksmith');

    player.x = 464;
    player.y = 280;
    simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_elder');

    await charService.saveAuthoritativePlayer(player.id, {
      level: player.level,
      currentXp: player.currentXp,
      gold: player.gold,
      hp: player.hp,
      mp: player.mp,
      x: player.x,
      y: player.y,
      version: player.version,
      inventory: player.inventory,
      equipped: player.equipped,
      quests: player.getAllQuests(),
      goldSource: 'quest_starter_tutorial'
    });

    // Inspeciona transações no gold_transactions
    const txs = await goldRepo.getTransactions(player.id);
    assert.ok(txs.length >= 2, 'Deve ter pelo menos starter_funds e quest_starter_tutorial');

    const questTx = txs.find(t => t.source === 'quest_starter_tutorial');
    assert.ok(questTx, 'Transação de quest deve existir no ledger');
    assert.strictEqual(questTx.amount, 50);
    assert.strictEqual(questTx.balance_after, initialGold + 50);
  });

  it('6. Isolamento estrito entre dois jogadores distintos', async () => {
    const p1Data = await charService.createCharacter(testAccountId, 'PlayerOne', CharacterClass.WARRIOR);
    const p2Data = await charService.createCharacter(testAccount2Id, 'PlayerTwo', CharacterClass.MAGE);

    const p1 = simulation.joinPlayer(p1Data, testAccountId, 1, 'starter_village');
    const p2 = simulation.joinPlayer(p2Data, testAccount2Id, 1, 'starter_village');

    // Player 1 completa todas as etapas da missão
    p1.x = 464;
    p1.y = 280;
    simulation.processQuestAction(p1.id, 'starter_tutorial', 'npc_elder');

    p1.x = 410;
    p1.y = 310;
    simulation.processQuestAction(p1.id, 'starter_tutorial', 'npc_blacksmith');

    p1.x = 464;
    p1.y = 280;
    simulation.processQuestAction(p1.id, 'starter_tutorial', 'npc_elder');

    // Player 2 permaneceu no spawn sem interagir
    const q1 = p1.getQuest('starter_tutorial');
    const q2 = p2.getQuest('starter_tutorial');

    assert.strictEqual(q1.step, 3);
    assert.strictEqual(q1.completed, true);
    assert.strictEqual(p1.gold, 150);

    // Player 2 deve permanecer rigorosamente no step 0, sem ouro extra nem itens herdados
    assert.strictEqual(q2.step, 0);
    assert.strictEqual(q2.completed, false);
    assert.strictEqual(p2.gold, 100);
    assert.strictEqual(getItemCount(p2.inventory, 'iron_ore'), 0);
  });

  it('7. Persistência após desconexão, reconexão e reinício do servidor', async () => {
    const playerData = await charService.createCharacter(testAccountId, 'PersistHero', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(playerData, testAccountId, 1, 'starter_village');

    // Conclui tutorial
    player.x = 464;
    player.y = 280;
    simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_elder');
    player.x = 410;
    player.y = 310;
    simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_blacksmith');
    player.x = 464;
    player.y = 280;
    simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_elder');

    // Desconecta e persiste estado autoritativo
    await charService.saveQuestProgress(player.id, player.getQuest('starter_tutorial'));
    await charService.saveAuthoritativePlayer(player.id, {
      level: player.level,
      currentXp: player.currentXp,
      gold: player.gold,
      hp: player.hp,
      mp: player.mp,
      x: player.x,
      y: player.y,
      version: player.version,
      inventory: player.inventory,
      equipped: player.equipped,
      quests: player.getAllQuests(),
      goldSource: 'quest_starter_tutorial'
    });
    simulation.leavePlayer(player.id);

    // Simula reinício completo do servidor (novo serviço e simulação conectados ao mesmo DB)
    const newCharService = new CharacterService(db, charRepo, invRepo, eqRepo, goldRepo, questRepo);
    const newSimulation = new GameSimulation();

    // Jogador reconecta
    const reloadedPlayerData = await newCharService.getCharacter(testAccountId, player.id);
    const reconnectedPlayer = newSimulation.joinPlayer(reloadedPlayerData, testAccountId, 1, 'starter_village');

    // Confere se as missões e recompensas persistiram intactas
    const loadedQuest = reconnectedPlayer.getQuest('starter_tutorial');
    assert.strictEqual(loadedQuest.step, 3);
    assert.strictEqual(loadedQuest.completed, true);
    assert.ok(loadedQuest.claimedRewards.includes('blacksmith_materials'));
    assert.ok(loadedQuest.claimedRewards.includes('elder_blessing'));

    assert.strictEqual(reconnectedPlayer.gold, 150);
    assert.strictEqual(reconnectedPlayer.currentXp, 30);
    assert.strictEqual(getItemCount(reconnectedPlayer.inventory, 'iron_ore'), 4);
  });

  it('8. Anti-Range / Validação Física de Proximidade (Anti-Exploit)', async () => {
    const playerData = await charService.createCharacter(testAccountId, 'CheaterHero', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(playerData, testAccountId, 1, 'starter_village');

    // Posiciona jogador a 800 pixels de distância dos NPCs
    player.x = 900;
    player.y = 900;

    // Tenta acionar Ancião Aldor estando longe
    const resFarElder = simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_elder');
    assert.strictEqual(resFarElder.success, false);
    assert.strictEqual(resFarElder.reason, 'TOO_FAR_FROM_NPC');

    // Tenta acionar Ferreiro Brann estando longe
    const resFarBrann = simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_blacksmith');
    assert.strictEqual(resFarFar(resFarBrann), false);

    function resFarFar(r: any) {
      return r.success;
    }
  });

  it('9. Rejeição de missão não cadastrada (UNKNOWN_QUEST)', async () => {
    const playerData = await charService.createCharacter(testAccountId, 'ExploitAttempt', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(playerData, testAccountId, 1, 'starter_village');
    player.x = 464;
    player.y = 280;

    const resUnknown = simulation.processQuestAction(player.id, 'fake_infinite_money_quest', 'npc_elder');
    assert.strictEqual(resUnknown.success, false);
    assert.strictEqual(resUnknown.reason, 'UNKNOWN_QUEST');
    assert.strictEqual(resUnknown.rewardsAwarded, undefined);
  });
});
