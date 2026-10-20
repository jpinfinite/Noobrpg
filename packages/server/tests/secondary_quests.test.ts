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
import { GameSimulation, NPC_SPAWNS } from '../src/simulation/GameSimulation.js';
import { ServerMonster } from '../src/simulation/ServerMonster.js';
import { CharacterClass, getItemCount, addItemToInventory, MonsterType } from '@noobrpg/shared';

describe('NoobRPG — Missão 6: Missões Secundárias, Novos NPCs e Persistência', () => {
  let db: SqliteDatabase;
  let charRepo: CharacterRepository;
  let invRepo: InventoryRepository;
  let eqRepo: EquipmentRepository;
  let goldRepo: GoldLedgerRepository;
  let questRepo: QuestRepository;
  let charService: CharacterService;
  let simulation: GameSimulation;

  const testAccountId = 'acc_sec_quest_01';
  const testAccount2Id = 'acc_sec_quest_02';

  beforeEach(async () => {
    db = new SqliteDatabase(':memory:');
    await runMigrations(db);

    charRepo = new CharacterRepository(db);
    invRepo = new InventoryRepository(db);
    eqRepo = new EquipmentRepository(db);
    goldRepo = new GoldLedgerRepository(db);
    questRepo = new QuestRepository(db);

    charService = new CharacterService(db, charRepo, invRepo, eqRepo, goldRepo, questRepo);
    simulation = new GameSimulation();

    await db.execute('INSERT INTO accounts (id, username, password_hash) VALUES (?, ?, ?);', [
      testAccountId,
      'sec_hero_1',
      'argon_hash_1'
    ]);
    await db.execute('INSERT INTO accounts (id, username, password_hash) VALUES (?, ?, ?);', [
      testAccount2Id,
      'sec_hero_2',
      'argon_hash_2'
    ]);
  });

  it('1. Missão de Caça: Aceite com Guarda Alistair avança para Step 1', async () => {
    const pData = await charService.createCharacter(testAccountId, 'Galahad', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    // Posiciona o jogador próximo ao Guarda do Portão (450, 90)
    player.x = 450;
    player.y = 95;

    const res = simulation.processQuestAction(player.id, 'quest_plains_threat', 'npc_guard', 'START');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.quest?.step, 1);
    assert.strictEqual(res.quest?.completed, false);
    assert.match(res.message || '', /Missão aceita!/);

    const q = player.getQuest('quest_plains_threat');
    assert.strictEqual(q.step, 1);
  });

  it('2. Missão de Caça Zero Client Trust: Bloqueio de avanço ou recompensa prematura sem 3 mortes', async () => {
    const pData = await charService.createCharacter(testAccountId, 'Bors', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');
    player.x = 450;
    player.y = 95;

    // Aceita a missão
    simulation.processQuestAction(player.id, 'quest_plains_threat', 'npc_guard', 'START');

    // Tenta entregar antes de derrotar qualquer slime
    const resPremature = simulation.processQuestAction(player.id, 'quest_plains_threat', 'npc_guard', 'COMPLETE');
    assert.strictEqual(resPremature.success, false);
    assert.strictEqual(resPremature.reason, 'QUEST_OBJECTIVES_INCOMPLETE');
    assert.match(resPremature.message || '', /derrotou apenas 0\/3 slimes/);

    // Tenta falar com NPC incorreto para forjar a entrega (posiciona perto do Ancião para não falhar por alcance)
    player.x = 464;
    player.y = 280;
    const resWrongNpc = simulation.processQuestAction(player.id, 'quest_plains_threat', 'npc_elder', 'COMPLETE');
    assert.strictEqual(resWrongNpc.success, false);
    assert.strictEqual(resWrongNpc.reason, 'INVALID_NPC');
  });

  it('3. Missão de Caça: Registro autoritativo de 3 mortes de Slimes no combate e avanço para Step 2', async () => {
    const pData = await charService.createCharacter(testAccountId, 'Percival', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');
    player.x = 450;
    player.y = 95;

    // Aceita a missão
    simulation.processQuestAction(player.id, 'quest_plains_threat', 'npc_guard', 'START');

    // Simula monstros Slime no alcance de ataque do jogador
    for (let i = 1; i <= 3; i++) {
      (player as any).lastAttackTimestamp = 0;
      const mob = new ServerMonster(`mob_slime_test_${i}`, MonsterType.SLIME, player.x + 20, player.y);
      mob.hp = 1; // 1 de HP para garantir morte com 1 golpe
      simulation.monsters.set(mob.id, mob);

      const combatRes = simulation.processAttack(player.id, mob.id);
      assert.strictEqual(combatRes.success, true);
      assert.strictEqual(combatRes.monsterDied, true);
      assert.ok(combatRes.questUpdated, 'Deveria retornar questUpdated após morte do monstro alvo');

      const expectedKills = i;
      const claimedKills = combatRes.questUpdated.claimedRewards.filter(r => r.startsWith('slime_kill_')).length;
      assert.strictEqual(claimedKills, expectedKills);

      if (i < 3) {
        assert.strictEqual(combatRes.questUpdated.step, 1);
      } else {
        assert.strictEqual(combatRes.questUpdated.step, 2, 'Ao atingir 3 mortes, deve avançar para Step 2');
      }
    }

    const questState = player.getQuest('quest_plains_threat');
    assert.strictEqual(questState.step, 2);
    assert.strictEqual(questState.completed, false);
  });

  it('4. Missão de Caça: Conclusão e concessão única de +60 Gold, +40 XP e 2 Poções Menores de Vida', async () => {
    const pData = await charService.createCharacter(testAccountId, 'Lancelot', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');
    player.x = 450;
    player.y = 95;

    const initialGold = player.gold;
    const initialXp = player.currentXp;
    const initialPotions = getItemCount(player.inventory, 'potion_hp_minor');

    // Aceita
    simulation.processQuestAction(player.id, 'quest_plains_threat', 'npc_guard', 'START');

    // 3 slimes abatidos
    for (let i = 1; i <= 3; i++) {
      (player as any).lastAttackTimestamp = 0;
      const mob = new ServerMonster(`mob_slime_lancelot_${i}`, MonsterType.SLIME, player.x + 15, player.y);
      mob.hp = 1;
      simulation.monsters.set(mob.id, mob);
      simulation.processAttack(player.id, mob.id);
    }

    // Retorna ao guarda e conclui
    const goldBeforeTurnin = player.gold;
    const xpBeforeTurnin = player.currentXp;
    const turninRes = simulation.processQuestAction(player.id, 'quest_plains_threat', 'npc_guard', 'COMPLETE');

    assert.strictEqual(turninRes.success, true);
    assert.strictEqual(turninRes.quest?.step, 3);
    assert.strictEqual(turninRes.quest?.completed, true);
    assert.deepStrictEqual(turninRes.rewardsAwarded, {
      gold: 60,
      xp: 40,
      items: [{ itemId: 'potion_hp_minor', quantity: 2 }]
    });

    assert.strictEqual(player.gold, goldBeforeTurnin + 60);
    assert.strictEqual(player.currentXp, xpBeforeTurnin + 40);
    assert.strictEqual(getItemCount(player.inventory, 'potion_hp_minor'), initialPotions + 2);
  });

  it('5. Missão de Caça Idempotência: Tentativas repetidas não duplicam recompensas', async () => {
    const pData = await charService.createCharacter(testAccountId, 'Bedivere', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');
    player.x = 450;
    player.y = 95;

    simulation.processQuestAction(player.id, 'quest_plains_threat', 'npc_guard', 'START');

    for (let i = 1; i <= 3; i++) {
      (player as any).lastAttackTimestamp = 0;
      const mob = new ServerMonster(`mob_slime_bedivere_${i}`, MonsterType.SLIME, player.x + 15, player.y);
      mob.hp = 1;
      simulation.monsters.set(mob.id, mob);
      simulation.processAttack(player.id, mob.id);
    }

    // Primeira entrega
    const firstRes = simulation.processQuestAction(player.id, 'quest_plains_threat', 'npc_guard', 'COMPLETE');
    assert.strictEqual(firstRes.success, true);
    const goldAfterFirst = player.gold;
    const xpAfterFirst = player.currentXp;
    const potionsAfterFirst = getItemCount(player.inventory, 'potion_hp_minor');

    // Tentativas repetidas
    for (let r = 0; r < 5; r++) {
      const repeatRes = simulation.processQuestAction(player.id, 'quest_plains_threat', 'npc_guard', 'COMPLETE');
      assert.strictEqual(repeatRes.success, true);
      assert.strictEqual(repeatRes.rewardsAwarded, undefined, 'Não deve conceder recompensas na repetição');
      assert.match(repeatRes.message || '', /já concluiu/);
    }

    assert.strictEqual(player.gold, goldAfterFirst);
    assert.strictEqual(player.currentXp, xpAfterFirst);
    assert.strictEqual(getItemCount(player.inventory, 'potion_hp_minor'), potionsAfterFirst);
  });

  it('6. Missão de Coleta: Aceite com Taverneiro Tobin e avanço para Step 1', async () => {
    const pData = await charService.createCharacter(testAccountId, 'Kay', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');
    player.x = 510;
    player.y = 295;

    const res = simulation.processQuestAction(player.id, 'quest_tavern_supplies', 'npc_tavern', 'START');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.quest?.step, 1);
    assert.strictEqual(res.quest?.completed, false);
    assert.match(res.message || '', /Missão aceita!/);
  });

  it('7. Missão de Coleta Zero Client Trust: Rejeição com ervas insuficientes (nada consumido)', async () => {
    const pData = await charService.createCharacter(testAccountId, 'Tristan', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');
    player.x = 510;
    player.y = 295;

    // Aceita
    simulation.processQuestAction(player.id, 'quest_tavern_supplies', 'npc_tavern', 'START');

    // Adiciona apenas 2 ervas (necessário 3)
    addItemToInventory(player.inventory, 'herb_green', 2);
    assert.strictEqual(getItemCount(player.inventory, 'herb_green'), 2);

    const res = simulation.processQuestAction(player.id, 'quest_tavern_supplies', 'npc_tavern', 'COMPLETE');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.reason, 'INSUFFICIENT_ITEMS');
    assert.match(res.message || '', /possui apenas 2\/3 Ervas Verdes/);

    // Garante que nenhuma erva foi consumida e nenhuma recompensa concedida
    assert.strictEqual(getItemCount(player.inventory, 'herb_green'), 2);
    assert.strictEqual(player.getQuest('quest_tavern_supplies').completed, false);
  });

  it('8. Missão de Coleta: Entrega atômica com consumo de 3 Ervas Verdes e concessão de recompensas', async () => {
    const pData = await charService.createCharacter(testAccountId, 'Gawain', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');
    player.x = 510;
    player.y = 295;

    simulation.processQuestAction(player.id, 'quest_tavern_supplies', 'npc_tavern', 'START');

    // Fornece 4 ervas ao jogador
    addItemToInventory(player.inventory, 'herb_green', 4);
    assert.strictEqual(getItemCount(player.inventory, 'herb_green'), 4);

    const initialGold = player.gold;
    const initialXp = player.currentXp;

    const res = simulation.processQuestAction(player.id, 'quest_tavern_supplies', 'npc_tavern', 'COMPLETE');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.quest?.step, 2);
    assert.strictEqual(res.quest?.completed, true);
    assert.deepStrictEqual(res.rewardsAwarded, {
      gold: 50,
      xp: 35,
      items: [{ itemId: 'potion_hp_medium', quantity: 1 }]
    });

    // 4 ervas iniciais - 3 consumidas = 1 restante
    assert.strictEqual(getItemCount(player.inventory, 'herb_green'), 1);
    assert.strictEqual(player.gold, initialGold + 50);
    assert.strictEqual(player.currentXp, initialXp + 35);
    assert.strictEqual(getItemCount(player.inventory, 'potion_hp_medium'), 1);
  });

  it('9. Missão de Coleta Idempotência: Entrega repetida não consome ervas extras nem duplica prêmios', async () => {
    const pData = await charService.createCharacter(testAccountId, 'Geraint', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');
    player.x = 510;
    player.y = 295;

    simulation.processQuestAction(player.id, 'quest_tavern_supplies', 'npc_tavern', 'START');
    addItemToInventory(player.inventory, 'herb_green', 5);

    // Primeira entrega
    const res1 = simulation.processQuestAction(player.id, 'quest_tavern_supplies', 'npc_tavern', 'COMPLETE');
    assert.strictEqual(res1.success, true);
    assert.strictEqual(getItemCount(player.inventory, 'herb_green'), 2); // 5 - 3 = 2
    const goldAfter = player.gold;
    const potionAfter = getItemCount(player.inventory, 'potion_hp_medium');

    // Segunda entrega (idempotente)
    const res2 = simulation.processQuestAction(player.id, 'quest_tavern_supplies', 'npc_tavern', 'COMPLETE');
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.rewardsAwarded, undefined);
    assert.strictEqual(getItemCount(player.inventory, 'herb_green'), 2, 'Ervas restantes não devem ser consumidas');
    assert.strictEqual(player.gold, goldAfter);
    assert.strictEqual(getItemCount(player.inventory, 'potion_hp_medium'), potionAfter);
  });

  it('10. Concorrência Atômica: Requisições paralelas (Promise.all) protegidas contra duplicação', async () => {
    const pData = await charService.createCharacter(testAccountId, 'Erec', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');
    player.x = 510;
    player.y = 295;

    simulation.processQuestAction(player.id, 'quest_tavern_supplies', 'npc_tavern', 'START');
    addItemToInventory(player.inventory, 'herb_green', 3);

    const initialGold = player.gold;

    // Dispara 10 requisições simultâneas de entrega
    const results = await Promise.all(
      Array.from({ length: 10 }).map(() =>
        Promise.resolve(simulation.processQuestAction(player.id, 'quest_tavern_supplies', 'npc_tavern', 'COMPLETE'))
      )
    );

    const rewardedCount = results.filter(r => r.rewardsAwarded !== undefined).length;
    assert.strictEqual(rewardedCount, 1, 'Exatamente uma chamada concorrente pode conceder a recompensa');
    assert.strictEqual(player.gold, initialGold + 50);
    assert.strictEqual(getItemCount(player.inventory, 'herb_green'), 0);
    assert.strictEqual(getItemCount(player.inventory, 'potion_hp_medium'), 1);
  });

  it('11. Anti-Range: Rejeição física de interação fora do alcance dos novos NPCs', async () => {
    const pData = await charService.createCharacter(testAccountId, 'Lamorak', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    // Jogador distante de ambos os NPCs (ex: no canto x=800, y=800)
    player.x = 800;
    player.y = 800;

    const resFarGuard = simulation.processQuestAction(player.id, 'quest_plains_threat', 'npc_guard', 'START');
    assert.strictEqual(resFarGuard.success, false);
    assert.strictEqual(resFarGuard.reason, 'TOO_FAR_FROM_NPC');

    const resFarTavern = simulation.processQuestAction(player.id, 'quest_tavern_supplies', 'npc_tavern', 'START');
    assert.strictEqual(resFarTavern.success, false);
    assert.strictEqual(resFarTavern.reason, 'TOO_FAR_FROM_NPC');
  });

  it('12. Bloqueio de Morte: Jogador derrotado não pode interagir com Guarda ou Taverneiro', async () => {
    const pData = await charService.createCharacter(testAccountId, 'Palamedes', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');
    player.x = 450;
    player.y = 95;

    // Simula morte do jogador
    player.hp = 0;
    player.isDead = true;

    const resDead = simulation.processQuestAction(player.id, 'quest_plains_threat', 'npc_guard', 'START');
    assert.strictEqual(resDead.success, false);
    assert.strictEqual(resDead.reason, 'PLAYER_DEAD');
  });

  it('13. Isolamento entre Personagens: Progresso e inventário de missões independentes', async () => {
    const p1Data = await charService.createCharacter(testAccountId, 'HeroAlpha', CharacterClass.WARRIOR);
    const p2Data = await charService.createCharacter(testAccount2Id, 'HeroBeta', CharacterClass.MAGE);

    const p1 = simulation.joinPlayer(p1Data, testAccountId, 1, 'map_starter_village');
    const p2 = simulation.joinPlayer(p2Data, testAccount2Id, 1, 'map_starter_village');

    p1.x = 450;
    p1.y = 95;
    p2.x = 450;
    p2.y = 95;

    // P1 aceita e completa a caça
    simulation.processQuestAction(p1.id, 'quest_plains_threat', 'npc_guard', 'START');
    for (let i = 1; i <= 3; i++) {
      (p1 as any).lastAttackTimestamp = 0;
      const mob = new ServerMonster(`mob_slime_iso_${i}`, MonsterType.SLIME, p1.x + 10, p1.y);
      mob.hp = 1;
      simulation.monsters.set(mob.id, mob);
      simulation.processAttack(p1.id, mob.id);
    }
    simulation.processQuestAction(p1.id, 'quest_plains_threat', 'npc_guard', 'COMPLETE');

    // P2 nem sequer iniciou
    const q1 = p1.getQuest('quest_plains_threat');
    const q2 = p2.getQuest('quest_plains_threat');

    assert.strictEqual(q1.completed, true);
    assert.strictEqual(q1.step, 3);
    assert.strictEqual(q2.completed, false);
    assert.strictEqual(q2.step, 0);
  });

  it('14. Persistência Relacional: Salvamento e recuperação completa de múltiplas quests no SQLite', async () => {
    const pData = await charService.createCharacter(testAccountId, 'Constantine', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');
    player.x = 450;
    player.y = 95;

    // 1. Aceita e completa a missão do Guarda
    simulation.processQuestAction(player.id, 'quest_plains_threat', 'npc_guard', 'START');
    for (let i = 1; i <= 3; i++) {
      (player as any).lastAttackTimestamp = 0;
      const mob = new ServerMonster(`mob_slime_pers_${i}`, MonsterType.SLIME, player.x + 10, player.y);
      mob.hp = 1;
      simulation.monsters.set(mob.id, mob);
      simulation.processAttack(player.id, mob.id);
    }
    simulation.processQuestAction(player.id, 'quest_plains_threat', 'npc_guard', 'COMPLETE');

    // 2. Vai até a taverna e completa a coleta
    player.x = 510;
    player.y = 295;
    simulation.processQuestAction(player.id, 'quest_tavern_supplies', 'npc_tavern', 'START');
    addItemToInventory(player.inventory, 'herb_green', 3);
    simulation.processQuestAction(player.id, 'quest_tavern_supplies', 'npc_tavern', 'COMPLETE');

    // 3. Salva autoritativamente todas as quests e estado no banco relacional
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
      quests: player.getAllQuests()
    });

    // 4. Cria novo serviço e simulação (simulando restart do servidor)
    const newService = new CharacterService(db, charRepo, invRepo, eqRepo, goldRepo, questRepo);
    const loadedData = await newService.getCharacter(testAccountId, player.id);

    assert.ok(loadedData.quests, 'Deve carregar as quests persistidas');
    assert.strictEqual(loadedData.quests.quest_plains_threat?.completed, true);
    assert.strictEqual(loadedData.quests.quest_plains_threat?.step, 3);
    assert.ok(loadedData.quests.quest_plains_threat?.claimedRewards.includes('guard_reward'));

    assert.strictEqual(loadedData.quests.quest_tavern_supplies?.completed, true);
    assert.strictEqual(loadedData.quests.quest_tavern_supplies?.step, 2);
    assert.ok(loadedData.quests.quest_tavern_supplies?.claimedRewards.includes('tavern_supplies_reward'));
  });

  it('15. Coexistência e Não-Regressão com o Tutorial da Vila Inicial', async () => {
    const pData = await charService.createCharacter(testAccountId, 'Uther', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    // 1. Inicia Tutorial com Ancião Aldor
    player.x = 464;
    player.y = 280;
    const tut1 = simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_elder');
    assert.strictEqual(tut1.success, true);
    assert.strictEqual(tut1.quest?.step, 1);

    // 2. No meio do tutorial, fala com o Taverneiro Tobin e aceita a missão de ervas
    player.x = 510;
    player.y = 295;
    const tav1 = simulation.processQuestAction(player.id, 'quest_tavern_supplies', 'npc_tavern', 'START');
    assert.strictEqual(tav1.success, true);
    assert.strictEqual(tav1.quest?.step, 1);

    // 3. Continua o tutorial com Ferreiro Brann e pega materiais
    player.x = 410;
    player.y = 310;
    const tut2 = simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_blacksmith');
    assert.strictEqual(tut2.success, true);
    assert.strictEqual(tut2.quest?.step, 2);

    // 4. Conclui tutorial com Ancião Aldor
    player.x = 464;
    player.y = 280;
    const tut3 = simulation.processQuestAction(player.id, 'starter_tutorial', 'npc_elder');
    assert.strictEqual(tut3.success, true);
    assert.strictEqual(tut3.quest?.step, 3);
    assert.strictEqual(tut3.quest?.completed, true);

    // 5. Verifica que a missão da taverna permanece no step 1 sem qualquer interferência
    const tavQuest = player.getQuest('quest_tavern_supplies');
    assert.strictEqual(tavQuest.step, 1);
    assert.strictEqual(tavQuest.completed, false);
  });
});
