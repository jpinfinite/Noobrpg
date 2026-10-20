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
import { GameSimulation, isInsideSafeZone } from '../src/simulation/GameSimulation.js';
import {
  CharacterClass,
  getItemCount,
  addItemToInventory,
  MonsterType,
  EquipmentSlot
} from '@noobrpg/shared';

describe('NoobRPG — Missão 5: Hardening de Gameplay, Concorrência e Transições', () => {
  let db: SqliteDatabase;
  let charRepo: CharacterRepository;
  let invRepo: InventoryRepository;
  let eqRepo: EquipmentRepository;
  let goldRepo: GoldLedgerRepository;
  let questRepo: QuestRepository;
  let charService: CharacterService;
  let simulation: GameSimulation;

  const testAccountId = 'acc_hardening_01';
  const testAccount2Id = 'acc_hardening_02';

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
      'hero_alpha',
      'hash_alpha'
    ]);
    await db.execute('INSERT INTO accounts (id, username, password_hash) VALUES (?, ?, ?);', [
      testAccount2Id,
      'hero_beta',
      'hash_beta'
    ]);
  });

  // =========================================================================
  // 1. HARDENING DE COMBATE E CONCORRÊNCIA
  // =========================================================================

  it('1.1. Combate: Rejeição de ataque a monstro inexistente ou morto', async () => {
    const pData = await charService.createCharacter(testAccountId, 'Galahad', CharacterClass.WARRIOR);
    const p = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    // Ataque a monstro inexistente
    const resNonExistent = simulation.processAttack(p.id, 'mob_fake_ghost_999');
    assert.strictEqual(resNonExistent.success, false);
    assert.strictEqual(resNonExistent.reason, 'INVALID_OR_DEAD_TARGET');

    // Ataque a monstro que acabou de morrer
    const mob = simulation.monsters.get('mob_village_slime_1')!;
    p.x = mob.x - 10;
    p.y = mob.y;
    mob.hp = 1;

    const killRes = simulation.processAttack(p.id, mob.id);
    assert.strictEqual(killRes.success, true);
    assert.strictEqual(killRes.monsterDied, true);
    assert.strictEqual(mob.isDead(), true);

    (p as any).lastAttackTimestamp = Date.now() - 2000;
    const deadRes = simulation.processAttack(p.id, mob.id);
    assert.strictEqual(deadRes.success, false);
    assert.strictEqual(deadRes.reason, 'INVALID_OR_DEAD_TARGET');
  });

  it('1.2. Combate: Rejeição de ataques e habilidades por jogador morto', async () => {
    const pData = await charService.createCharacter(testAccountId, 'FallenHero', CharacterClass.WARRIOR);
    const p = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');
    const mob = simulation.monsters.get('mob_village_slime_1')!;
    p.x = mob.x - 10;
    p.y = mob.y;

    // Simula morte do jogador
    p.takeDamage(9999);
    assert.strictEqual(p.isAlive(), false);

    // Tentativa de ataque básico
    const atkRes = simulation.processAttack(p.id, mob.id);
    assert.strictEqual(atkRes.success, false);
    assert.strictEqual(atkRes.reason, 'PLAYER_DEAD');

    // Tentativa de habilidade 1
    const skillRes = simulation.processSkill1(p.id, mob.id);
    assert.strictEqual(skillRes.success, false);
    assert.strictEqual(skillRes.reason, 'PLAYER_DEAD');
  });

  it('1.3. Combate: Dois jogadores atacando simultaneamente monstro com pouca vida', async () => {
    const p1Data = await charService.createCharacter(testAccountId, 'PlayerA', CharacterClass.WARRIOR);
    const p2Data = await charService.createCharacter(testAccount2Id, 'PlayerB', CharacterClass.RANGER);

    const p1 = simulation.joinPlayer(p1Data, testAccountId, 1, 'map_starter_village');
    const p2 = simulation.joinPlayer(p2Data, testAccount2Id, 1, 'map_starter_village');

    const mob = simulation.monsters.get('mob_village_skeleton_1')!;
    p1.x = mob.x - 10;
    p1.y = mob.y;
    p2.x = mob.x + 10;
    p2.y = mob.y;

    mob.hp = 2; // Vida suficiente para apenas 1 golpe fatal

    const [atk1, atk2] = await Promise.all([
      Promise.resolve(simulation.processAttack(p1.id, mob.id)),
      Promise.resolve(simulation.processAttack(p2.id, mob.id))
    ]);

    const deaths = [atk1.monsterDied, atk2.monsterDied].filter(Boolean);
    assert.strictEqual(deaths.length, 1, 'Exatamente um jogador recebe o registro de monsterDied');
    assert.strictEqual(mob.isDead(), true);

    const totalXpGained = (atk1.xpGained || 0) + (atk2.xpGained || 0);
    assert.strictEqual(totalXpGained, mob.config.xpReward, 'XP concedido uma única vez');
  });

  it('1.4. Combate: Respawn de monstro restaura vida e estado sem duplicar entidade', () => {
    const mob = simulation.monsters.get('mob_village_slime_1')!;
    mob.hp = 1;
    mob.takeDamage(10, 'killer_1');
    assert.strictEqual(mob.isDead(), true);

    const initialMonsterCount = simulation.monsters.size;

    // Força avanço do tempo para ultrapassar o respawnTimeMs
    const futureTime = Date.now() + mob.config.respawnTimeMs + 100;
    mob.updateAI(futureTime, 50, Array.from(simulation.players.values()));

    assert.strictEqual(mob.isDead(), false);
    assert.strictEqual(mob.hp, mob.maxHp);
    assert.strictEqual(simulation.monsters.size, initialMonsterCount, 'Coleção de monstros permanece íntegra');
  });

  // =========================================================================
  // 2. HARDENING DE INVENTÁRIO, DROPS E CRAFTING
  // =========================================================================

  it('2.1. Concorrência no Pickup: Dois jogadores disputando o mesmo drop no chão', async () => {
    const p1Data = await charService.createCharacter(testAccountId, 'LooterA', CharacterClass.WARRIOR);
    const p2Data = await charService.createCharacter(testAccount2Id, 'LooterB', CharacterClass.RANGER);

    const p1 = simulation.joinPlayer(p1Data, testAccountId, 1, 'map_starter_village');
    const p2 = simulation.joinPlayer(p2Data, testAccount2Id, 1, 'map_starter_village');

    // Spawna drop no chão
    const dropId = 'drop_test_diamond';
    (simulation as any).spawnGroundItem('iron_ore', 5, 450, 310);
    const drop = Array.from(simulation.groundItems.values()).find(d => d.itemId === 'iron_ore');
    assert.ok(drop);

    p1.x = drop.x;
    p1.y = drop.y;
    p2.x = drop.x;
    p2.y = drop.y;

    const initialP1Ore = getItemCount(p1.inventory, 'iron_ore');
    const initialP2Ore = getItemCount(p2.inventory, 'iron_ore');

    // Tentativa simultânea de coleta
    const [pick1, pick2] = await Promise.all([
      Promise.resolve(simulation.processPickup(p1.id, drop.id)),
      Promise.resolve(simulation.processPickup(p2.id, drop.id))
    ]);

    const successes = [pick1.success, pick2.success].filter(Boolean);
    assert.strictEqual(successes.length, 1, 'Apenas um jogador pode recolher o drop');
    assert.strictEqual(simulation.groundItems.has(drop.id), false, 'Drop removido da simulação');

    const totalOreAcquired =
      (getItemCount(p1.inventory, 'iron_ore') - initialP1Ore) +
      (getItemCount(p2.inventory, 'iron_ore') - initialP2Ore);
    assert.strictEqual(totalOreAcquired, 5, 'Quantidade total de ferro recebida deve ser exatamente 5');
  });

  it('2.2. Zero Client Trust: Jogador morto não pode recolher drops, forjar nem usar itens', async () => {
    const pData = await charService.createCharacter(testAccountId, 'GhostHero', CharacterClass.WARRIOR);
    const p = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    // Fornece materiais de forja e poção
    p.x = 440;
    p.y = 310;
    addItemToInventory(p.inventory, 'iron_ore', 5);
    addItemToInventory(p.inventory, 'wood_log', 5);
    addItemToInventory(p.inventory, 'potion_hp_minor', 2);

    // Spawna drop adjacente
    (simulation as any).spawnGroundItem('slime_gel', 3, p.x, p.y);
    const drop = Array.from(simulation.groundItems.values()).find(d => d.itemId === 'slime_gel')!;

    // Jogador morre
    p.takeDamage(9999);
    assert.strictEqual(p.isAlive(), false);

    // Tentativa de pickup
    const pickRes = simulation.processPickup(p.id, drop.id);
    assert.strictEqual(pickRes.success, false);
    assert.strictEqual(pickRes.reason, 'PLAYER_DEAD');

    // Tentativa de craft
    const craftRes = simulation.processCraft(p.id, 'recipe_pickaxe');
    assert.strictEqual(craftRes.success, false);
    assert.strictEqual(craftRes.reason, 'PLAYER_DEAD');

    // Tentativa de usar poção
    const potSlot = p.inventory.findIndex(s => s?.itemId === 'potion_hp_minor');
    const useRes = simulation.processUseItem(p.id, potSlot);
    assert.strictEqual(useRes.success, false);
    assert.strictEqual(useRes.reason, 'PLAYER_DEAD');

    // Tentativa de equipar item
    const eqRes = simulation.processEquip(p.id, 0);
    assert.strictEqual(eqRes.success, false);
    assert.strictEqual(eqRes.reason, 'PLAYER_DEAD');
  });

  it('2.3. Crafting Concorrente: Tentativa de forjar duas vezes consumindo os mesmos materiais', async () => {
    const pData = await charService.createCharacter(testAccountId, 'BlacksmithBoy', CharacterClass.WARRIOR);
    const p = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    p.x = 440;
    p.y = 310;
    // Fornece materiais suficientes para APENAS 1 picareta (necessita 3 ferros e 2 madeiras)
    addItemToInventory(p.inventory, 'iron_ore', 3);
    addItemToInventory(p.inventory, 'wood_log', 2);

    // Tentativa concorrente de forjar duas picaretas
    const [craft1, craft2] = await Promise.all([
      Promise.resolve(simulation.processCraft(p.id, 'recipe_pickaxe')),
      Promise.resolve(simulation.processCraft(p.id, 'recipe_pickaxe'))
    ]);

    const successes = [craft1.success, craft2.success].filter(Boolean);
    assert.strictEqual(successes.length, 1, 'Apenas um craft pode ter sucesso');
    assert.strictEqual(getItemCount(p.inventory, 'pickaxe_copper'), 1);
    assert.strictEqual(getItemCount(p.inventory, 'iron_ore'), 0);
  });

  it('2.4. Equipamento: Troca autoritativa de armas com devolução correta ao inventário', async () => {
    const pData = await charService.createCharacter(testAccountId, 'WeaponMaster', CharacterClass.WARRIOR);
    const p = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    // Guerreiro inicia com 'sword_iron' equipada
    assert.strictEqual(p.equipped.weapon, 'sword_iron');
    const attackWithSword = p.getAttack(); // Guerreiro 12 + espada 8 = 20

    // Adiciona pickaxe_copper (+3 atk) no inventário
    addItemToInventory(p.inventory, 'pickaxe_copper', 1);
    const pickSlot = p.inventory.findIndex(s => s?.itemId === 'pickaxe_copper');
    assert.ok(pickSlot >= 0);

    // Equipa picareta
    const eqRes = simulation.processEquip(p.id, pickSlot);
    assert.strictEqual(eqRes.success, true);
    assert.strictEqual(p.equipped.weapon, 'pickaxe_copper');

    // Espada anterior deve estar de volta no inventário
    assert.strictEqual(getItemCount(p.inventory, 'sword_iron'), 1);
    assert.strictEqual(p.getAttack(), 15, 'Ataque atualizado: Guerreiro 12 + picareta 3 = 15');

    // No nível 1, tentar reequipar a espada de ferro falha por exigência de nível (requiredLevel: 2)
    const swordSlot = p.inventory.findIndex(s => s?.itemId === 'sword_iron');
    const eqBlocked = simulation.processEquip(p.id, swordSlot);
    assert.strictEqual(eqBlocked.success, false);
    assert.strictEqual(eqBlocked.reason, 'LEVEL_TOO_LOW', 'Zero Client Trust: nível insuficiente para a espada');

    // Ao atingir o nível 2, o guerreiro reequipa com sucesso
    p.level = 2;
    const eqBack = simulation.processEquip(p.id, swordSlot);
    assert.strictEqual(eqBack.success, true);
    assert.strictEqual(p.equipped.weapon, 'sword_iron');
    assert.strictEqual(getItemCount(p.inventory, 'pickaxe_copper'), 1);
    assert.strictEqual(p.getAttack(), p.getAttributes().attack);
  });

  // =========================================================================
  // 3. HARDENING DE TRANSIÇÕES E MAPAS (FASE D)
  // =========================================================================

  it('3.1. Transições: Bloqueio fora de alcance e rejeição de mapas inválidos', async () => {
    const pData = await charService.createCharacter(testAccountId, 'BorderGuard', CharacterClass.WARRIOR);
    const p = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    // Jogador na praça central (464, 320) - longe dos portões (dist > 80px)
    p.x = 464;
    p.y = 320;
    const resFar = simulation.processChangeMap(p.id, 'map_prototype');
    assert.strictEqual(resFar.success, false);
    assert.strictEqual(resFar.reason, 'TOO_FAR_FROM_MAP_EXIT');

    // Transição para mapa inexistente
    p.x = 456;
    p.y = 30; // No portão norte
    const resInvalidMap = simulation.processChangeMap(p.id, 'map_cyberpunk_city');
    assert.strictEqual(resInvalidMap.success, false);
    assert.strictEqual(resInvalidMap.reason, 'INVALID_TARGET_MAP');

    // Transição para o mesmo mapa atual
    const resSame = simulation.processChangeMap(p.id, 'map_starter_village');
    assert.strictEqual(resSame.success, false);
    assert.strictEqual(resSame.reason, 'ALREADY_IN_TARGET_MAP');
  });

  it('3.2. Transições: Bloqueio de fuga das Planícies se longe do ponto de retorno', async () => {
    const pData = await charService.createCharacter(testAccountId, 'PlainsWanderer', CharacterClass.WARRIOR);
    const p = simulation.joinPlayer(pData, testAccountId, 1, 'map_prototype');

    // Jogador no meio das planícies em (800, 600) - distante da entrada/saída (180, 160)
    p.x = 800;
    p.y = 600;

    const resEscape = simulation.processChangeMap(p.id, 'map_starter_village');
    assert.strictEqual(resEscape.success, false);
    assert.strictEqual(resEscape.reason, 'TOO_FAR_FROM_MAP_EXIT');

    // Jogador caminha de volta até a entrada das Planícies (180, 160)
    p.x = 180;
    p.y = 160;
    const resValidReturn = simulation.processChangeMap(p.id, 'map_starter_village');
    assert.strictEqual(resValidReturn.success, true);
    assert.strictEqual(p.mapKey, 'map_starter_village');
    assert.strictEqual(p.x, 456);
    assert.strictEqual(p.y, 50); // Ponto de entrada do Portão Norte
  });

  // =========================================================================
  // 4. TESTE DE SESSÃO COMPLETA (FASE E)
  // =========================================================================

  it('4.1. Sessão Completa: Criação -> Tutorial -> Forja -> Exploração -> Combate -> Retorno -> Persistência -> Reconexão', async () => {
    // 1. Criação do Personagem
    const pData = await charService.createCharacter(testAccountId, 'ArthurPendragon', CharacterClass.WARRIOR);
    const p = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');
    assert.strictEqual(p.mapKey, 'map_starter_village');

    // 2. Tutorial do Ferreiro na praça
    p.x = 415;
    p.y = 310;
    const quest = p.getQuest('starter_tutorial');
    quest.step = 1;
    p.setQuest('starter_tutorial', quest);

    const qRes = simulation.processQuestAction(p.id, 'starter_tutorial', 'npc_blacksmith');
    assert.strictEqual(qRes.success, true);

    // 3. Forja de Picareta de Cobre na Bigorna
    p.x = 440;
    p.y = 310;
    const craftRes = simulation.processCraft(p.id, 'recipe_pickaxe');
    assert.strictEqual(craftRes.success, true);

    // 4. Equipar a ferramenta forjada
    const slotIdx = p.inventory.findIndex(s => s?.itemId === 'pickaxe_copper');
    simulation.processEquip(p.id, slotIdx);
    assert.strictEqual(p.equipped.weapon, 'pickaxe_copper');

    // 5. Deslocamento até o Portão Norte e transição para as Planícies
    p.x = 456;
    p.y = 30;
    const travelOut = simulation.processChangeMap(p.id, 'map_prototype');
    assert.strictEqual(travelOut.success, true);
    assert.strictEqual(p.mapKey, 'map_prototype');
    assert.strictEqual(p.x, 180);
    assert.strictEqual(p.y, 160);

    // 6. Combate contra monstro nas Planícies
    const mob = simulation.monsters.get('mob_slime_1')!;
    p.x = mob.x - 10;
    p.y = mob.y;
    mob.hp = 5;

    const atkKill = simulation.processAttack(p.id, mob.id);
    assert.strictEqual(atkKill.success, true);
    assert.strictEqual(atkKill.monsterDied, true);
    assert.ok(p.currentXp > 0);

    // 7. Coleta de drop no chão
    const drop = Array.from(simulation.groundItems.values()).find(
      gi => Math.abs(gi.x - mob.x) <= 24 && Math.abs(gi.y - mob.y) <= 24
    );
    if (drop) {
      p.x = drop.x;
      p.y = drop.y;
      const pickRes = simulation.processPickup(p.id, drop.id);
      assert.strictEqual(pickRes.success, true);
    }

    // 8. Retorno ao ponto de conexão (180, 160) e transição de volta para a Vila Inicial
    p.x = 180;
    p.y = 160;
    const travelBack = simulation.processChangeMap(p.id, 'map_starter_village');
    assert.strictEqual(travelBack.success, true);
    assert.strictEqual(p.mapKey, 'map_starter_village');

    // 9. Persistência Relacional Autoritativa
    await charService.saveAuthoritativePlayer(p.id, {
      level: p.level,
      currentXp: p.currentXp,
      gold: p.gold,
      hp: p.hp,
      mp: p.mp,
      x: p.x,
      y: p.y,
      version: p.version,
      inventory: p.inventory,
      equipped: p.equipped,
      quests: p.getAllQuests()
    });

    // 10. Desconexão
    simulation.leavePlayer(p.id);

    // 11. Reconexão e Auditoria dos Dados Persistidos
    const reloaded = await charService.getCharacter(testAccountId, p.id);
    assert.strictEqual(reloaded.id, pData.id);
    assert.strictEqual(reloaded.equipped.weapon, 'pickaxe_copper');
    assert.strictEqual(getItemCount(reloaded.inventory, 'sword_iron'), 1, 'Espada anterior guardada no inventário');
    assert.strictEqual(reloaded.currentXp, p.currentXp);
    assert.strictEqual(reloaded.gold, p.gold);
    assert.strictEqual(reloaded.position.x, 456);
    assert.strictEqual(reloaded.position.y, 50);
  });
});
