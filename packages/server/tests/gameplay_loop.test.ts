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
import { GameSimulation, isInsideSafeZone, CRAFTING_STATIONS } from '../src/simulation/GameSimulation.js';
import { MapCollisionGrid } from '../src/simulation/MapCollisionGrid.js';
import {
  CharacterClass,
  getItemCount,
  addItemToInventory,
  MonsterType,
  EquipmentSlot
} from '@noobrpg/shared';

describe('NoobRPG — Missão 4: Primeiro Loop Completo de RPG', () => {
  let db: SqliteDatabase;
  let charRepo: CharacterRepository;
  let invRepo: InventoryRepository;
  let eqRepo: EquipmentRepository;
  let goldRepo: GoldLedgerRepository;
  let questRepo: QuestRepository;
  let charService: CharacterService;
  let simulation: GameSimulation;

  const testAccountId = 'acc_loop_tester_01';
  const testAccount2Id = 'acc_loop_tester_02';

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
      'rpg_hero',
      'hash_1'
    ]);
    await db.execute('INSERT INTO accounts (id, username, password_hash) VALUES (?, ?, ?);', [
      testAccount2Id,
      'rpg_hero_2',
      'hash_2'
    ]);
  });

  it('1. Loop Completo: Tutorial -> Recursos -> Forja de Arma na Praça -> Equipar -> Combate Exterior -> Loot e XP', async () => {
    const playerData = await charService.createCharacter(testAccountId, 'SirLancelot', CharacterClass.WARRIOR);
    const p = simulation.joinPlayer(playerData, testAccountId, 1, 'map_starter_village');

    // 1. Posiciona no ponto de spawn oficial da praça da Vila Inicial (464, 320)
    p.x = 464;
    p.y = 320;
    assert.strictEqual(isInsideSafeZone(p.x, p.y, p.mapKey), true);
    const initialAttack = p.getAttack();

    // 2. Tutorial da Forja com o Ferreiro Brann em (410, 310)
    p.x = 415;
    p.y = 310;
    // Força avanço prévio do passo 0 para o passo 1 para reivindicar materiais
    const quest = p.getQuest('starter_tutorial');
    quest.step = 1;
    p.setQuest('starter_tutorial', quest);

    const qRes = simulation.processQuestAction(p.id, 'starter_tutorial', 'npc_blacksmith');
    assert.strictEqual(qRes.success, true);
    assert.ok(getItemCount(p.inventory, 'iron_ore') >= 4);
    assert.ok(getItemCount(p.inventory, 'wood_log') >= 4);

    // 3. Crafting autoritativo na bigorna da praça da Vila Inicial (440, 310)
    p.x = 442;
    p.y = 310;
    const initialIron = getItemCount(p.inventory, 'iron_ore');
    const initialWood = getItemCount(p.inventory, 'wood_log');

    const craftRes = simulation.processCraft(p.id, 'recipe_pickaxe');
    assert.strictEqual(craftRes.success, true);
    assert.strictEqual(craftRes.resultItemId, 'pickaxe_copper');

    // Consumo atômico validado
    assert.strictEqual(getItemCount(p.inventory, 'iron_ore'), initialIron - 3);
    assert.strictEqual(getItemCount(p.inventory, 'wood_log'), initialWood - 2);
    assert.strictEqual(getItemCount(p.inventory, 'pickaxe_copper'), 1);

    // 4. Equipar a ferramenta/arma forjada
    const pickaxeSlotIndex = p.inventory.findIndex(s => s?.itemId === 'pickaxe_copper');
    assert.ok(pickaxeSlotIndex >= 0);

    const equipRes = simulation.processEquip(p.id, pickaxeSlotIndex);
    assert.strictEqual(equipRes.success, true);
    assert.strictEqual(p.equipped.weapon, 'pickaxe_copper');

    // Bônus de ataque concedido e idempotente
    const equippedAttack = p.getAttack();
    assert.strictEqual(equippedAttack, 15, 'Guerreiro base 12 + Picareta de Cobre 3 = 15 de ataque');

    // 5. Deslocamento para a Zona Exterior de Combate da vila (Slime em 620, 220)
    const targetMob = simulation.monsters.get('mob_village_slime_1');
    assert.ok(targetMob, 'Monstro da zona exterior da vila deve existir');
    assert.strictEqual(targetMob.isDead(), false);

    // Jogador caminha até o alcance de ataque do monstro
    p.x = targetMob.x - 14;
    p.y = targetMob.y;
    assert.strictEqual(isInsideSafeZone(p.x, p.y, p.mapKey), false, 'Região de combate fora da Safe Zone');

    // 6. Combate autoritativo contra o monstro
    const mobInitialHp = targetMob.hp;
    const initialPlayerXp = p.currentXp;

    // Primeiro ataque
    const atk1 = simulation.processAttack(p.id, targetMob.id);
    assert.strictEqual(atk1.success, true);
    assert.ok(atk1.damageDealt! >= 10, 'Dano amplificado com arma forjada');
    assert.strictEqual(targetMob.hp, mobInitialHp - atk1.damageDealt!);

    // Avança tempo para respeitar o cooldown de ataque
    (targetMob as any).hp = 5; // Simula vida baixa para testar golpe fatal
    (p as any).lastAttackTimestamp = Date.now() - 2000;

    // Golpe fatal
    const atk2 = simulation.processAttack(p.id, targetMob.id);
    assert.strictEqual(atk2.success, true);
    assert.strictEqual(atk2.monsterDied, true);
    assert.strictEqual(targetMob.isDead(), true);

    // Recompensas de XP concedidas
    assert.ok(p.currentXp > initialPlayerXp);
    assert.ok(atk2.xpGained! > 0);

    // 7. Verificação de drops no chão e coleta (Pickup)
    const drops = Array.from(simulation.groundItems.values()).filter(
      gi => Math.abs(gi.x - targetMob.x) <= 24 && Math.abs(gi.y - targetMob.y) <= 24
    );
    assert.ok(drops.length > 0, 'Monstro derrotado deve spawnar drops no chão');

    const dropToCollect = drops[0];
    p.x = dropToCollect.x;
    p.y = dropToCollect.y;
    const initialLootQty = getItemCount(p.inventory, dropToCollect.itemId);

    const pickRes = simulation.processPickup(p.id, dropToCollect.id);
    assert.strictEqual(pickRes.success, true);
    assert.strictEqual(getItemCount(p.inventory, dropToCollect.itemId), initialLootQty + dropToCollect.quantity);
    assert.strictEqual(simulation.groundItems.has(dropToCollect.id), false, 'Drop recolhido deve sair do chão');
  });

  it('2. Zero Client Trust: Bloqueio de crafting fora de alcance ou sem materiais', () => {
    const pData = {
      id: 'char_craft_exploit',
      name: 'Exploiter',
      characterClass: CharacterClass.WARRIOR,
      level: 1,
      currentXp: 0,
      gold: 0,
      meritPoints: 0,
      attributes: { maxHp: 100, currentHp: 100, maxMp: 50, currentMp: 50, attack: 10, defense: 5, speed: 80 },
      position: { x: 800, y: 500 }, // Longe de qualquer forja
      direction: 'down' as any,
      inventory: [],
      equipped: { weapon: null, armor: null, accessory: null }
    };

    const p = simulation.joinPlayer(pData as any, testAccountId, 1, 'map_starter_village');
    addItemToInventory(p.inventory, 'iron_ore', 10);
    addItemToInventory(p.inventory, 'wood_log', 10);

    // Tentativa longe da forja: deve falhar
    const resFar = simulation.processCraft(p.id, 'recipe_pickaxe');
    assert.strictEqual(resFar.success, false);
    assert.strictEqual(resFar.reason, 'TOO_FAR_FROM_CRAFTING_STATION');

    // Move para a forja da vila (440, 310), mas remove materiais
    p.x = 440;
    p.y = 310;
    p.inventory = []; // Limpa materiais

    const resNoMat = simulation.processCraft(p.id, 'recipe_pickaxe');
    assert.strictEqual(resNoMat.success, false);
    assert.strictEqual(resNoMat.reason, 'MISSING_INGREDIENTS');
  });

  it('3. Validação de Combate: Bloqueio de ataque fora de alcance e em cooldown', () => {
    const pData = {
      id: 'char_combat_val',
      name: 'Combatant',
      characterClass: CharacterClass.WARRIOR,
      level: 1,
      currentXp: 0,
      gold: 0,
      meritPoints: 0,
      attributes: { maxHp: 100, currentHp: 100, maxMp: 50, currentMp: 50, attack: 15, defense: 5, speed: 80 },
      position: { x: 100, y: 100 },
      direction: 'down' as any,
      inventory: [],
      equipped: { weapon: null, armor: null, accessory: null }
    };
    const p = simulation.joinPlayer(pData as any, testAccountId, 1, 'map_starter_village');
    const mob = simulation.monsters.get('mob_village_slime_1')!;

    // Jogador em (100, 100) e mob em (620, 220): Fora de alcance
    const outRangeRes = simulation.processAttack(p.id, mob.id);
    assert.strictEqual(outRangeRes.success, false);
    assert.strictEqual(outRangeRes.reason, 'OUT_OF_RANGE');

    // Move para o alcance do monstro
    p.x = mob.x - 10;
    p.y = mob.y;
    const atk1 = simulation.processAttack(p.id, mob.id);
    assert.strictEqual(atk1.success, true);

    // Tentativa imediata sem esperar cooldown: Bloqueada
    const spamRes = simulation.processAttack(p.id, mob.id);
    assert.strictEqual(spamRes.success, false);
    assert.strictEqual(spamRes.reason, 'COOLDOWN_ACTIVE');
  });

  it('4. Prevenção de Duplicação de XP e Recompensas em Monstro Morto', () => {
    const pData = {
      id: 'char_no_dup',
      name: 'HonestHero',
      characterClass: CharacterClass.WARRIOR,
      level: 1,
      currentXp: 0,
      gold: 0,
      meritPoints: 0,
      attributes: { maxHp: 100, currentHp: 100, maxMp: 50, currentMp: 50, attack: 50, defense: 5, speed: 80 },
      position: { x: 260, y: 220 },
      direction: 'down' as any,
      inventory: [],
      equipped: { weapon: null, armor: null, accessory: null }
    };
    const p = simulation.joinPlayer(pData as any, testAccountId, 1, 'map_starter_village');
    const mob = simulation.monsters.get('mob_village_goblin_1')!;
    p.x = mob.x - 10;
    p.y = mob.y;

    // Garante que o golpe será fatal (dano guerreiro 12 - defesa goblin 8 = 4 > 2)
    mob.hp = 2;
    const atkKill = simulation.processAttack(p.id, mob.id);
    assert.strictEqual(atkKill.success, true);
    assert.strictEqual(atkKill.monsterDied, true);
    assert.strictEqual(mob.isDead(), true);

    const xpAfterKill = p.currentXp;

    // Tentativa de atacar monstro morto novamente
    (p as any).lastAttackTimestamp = Date.now() - 2000;
    const atkDead = simulation.processAttack(p.id, mob.id);
    assert.strictEqual(atkDead.success, false);
    assert.strictEqual(atkDead.reason, 'INVALID_OR_DEAD_TARGET');
    assert.strictEqual(p.currentXp, xpAfterKill, 'XP não pode aumentar contra monstro morto');
  });

  it('5. Safe Zone da Vila Inicial: Jogadores no centro da praça não são atacados por monstros', () => {
    const pData = {
      id: 'char_safe_zone',
      name: 'SafeCitizen',
      characterClass: CharacterClass.WARRIOR,
      level: 1,
      currentXp: 0,
      gold: 0,
      meritPoints: 0,
      attributes: { maxHp: 100, currentHp: 100, maxMp: 50, currentMp: 50, attack: 10, defense: 5, speed: 80 },
      position: { x: 464, y: 320 }, // Centro da praça
      direction: 'down' as any,
      inventory: [],
      equipped: { weapon: null, armor: null, accessory: null }
    };
    const p = simulation.joinPlayer(pData as any, testAccountId, 1, 'map_starter_village');
    assert.strictEqual(isInsideSafeZone(p.x, p.y, p.mapKey), true);

    // Spawna um monstro temporário artificialmente perto da praça
    const nearMob = simulation.monsters.get('mob_village_slime_1')!;
    nearMob.x = 470;
    nearMob.y = 325; // Dentro da Safe Zone ou adjacente

    // Executa tick da simulação
    const initialHp = p.hp;
    simulation.tick(50);

    // Jogador não deve receber dano de monstros dentro da Safe Zone
    assert.strictEqual(p.hp, initialHp, 'Jogador na Safe Zone permanece intocado');
  });

  it('6. Transição Autoritativa de Mapa (Portão da Vila -> Planícies -> Retorno à Vila)', () => {
    const pData = {
      id: 'char_map_traveler',
      name: 'Traveler',
      characterClass: CharacterClass.WARRIOR,
      level: 2,
      currentXp: 150,
      gold: 75,
      meritPoints: 0,
      attributes: { maxHp: 120, currentHp: 120, maxMp: 60, currentMp: 60, attack: 16, defense: 8, speed: 80 },
      position: { x: 456, y: 30 }, // Portão Norte da Vila Inicial
      direction: 'up' as any,
      inventory: [],
      equipped: { weapon: null, armor: null, accessory: null }
    };
    const p = simulation.joinPlayer(pData as any, testAccountId, 1, 'map_starter_village');
    assert.strictEqual(p.mapKey, 'map_starter_village');

    // 1. Transição válida pelo Portão Norte para o mapa exterior
    const travel1 = simulation.processChangeMap(p.id, 'map_prototype');
    assert.strictEqual(travel1.success, true);
    assert.strictEqual(travel1.mapKey, 'map_prototype');
    assert.strictEqual(p.mapKey, 'map_prototype');
    assert.strictEqual(p.x, 180);
    assert.strictEqual(p.y, 160);

    // Preservação de estado autoritativo
    assert.strictEqual(p.level, 2);
    assert.strictEqual(p.currentXp, 150);
    assert.strictEqual(p.gold, 75);

    // 2. Retorno para a Vila Inicial
    const travel2 = simulation.processChangeMap(p.id, 'map_starter_village');
    assert.strictEqual(travel2.success, true);
    assert.strictEqual(travel2.mapKey, 'map_starter_village');
    assert.strictEqual(p.mapKey, 'map_starter_village');
    assert.strictEqual(p.x, 456);
    assert.strictEqual(p.y, 50); // Ponto de entrada no Portão Norte da vila
  });

  it('7. Combate Concorrente: Dois jogadores atacando simultaneamente sem duplicação', async () => {
    const p1Data = await charService.createCharacter(testAccountId, 'PlayerAlpha', CharacterClass.WARRIOR);
    const p2Data = await charService.createCharacter(testAccount2Id, 'PlayerBeta', CharacterClass.RANGER);

    const p1 = simulation.joinPlayer(p1Data, testAccountId, 1, 'map_starter_village');
    const p2 = simulation.joinPlayer(p2Data, testAccount2Id, 1, 'map_starter_village');

    const mob = simulation.monsters.get('mob_village_skeleton_1')!;
    p1.x = mob.x - 12;
    p1.y = mob.y;
    p2.x = mob.x + 12;
    p2.y = mob.y;

    mob.hp = 10; // Vida suficiente para apenas um golpe fatal

    // Dois jogadores atacam concorrentemente
    const [res1, res2] = await Promise.all([
      Promise.resolve(simulation.processAttack(p1.id, mob.id)),
      Promise.resolve(simulation.processAttack(p2.id, mob.id))
    ]);

    // Exatamente um deve registrar monsterDied = true
    const kills = [res1.monsterDied, res2.monsterDied].filter(Boolean);
    assert.strictEqual(kills.length, 1, 'Apenas um jogador pode aplicar o golpe fatal e receber recompensa');
    assert.strictEqual(mob.isDead(), true);
  });

  it('8. Persistência Completa de Inventário, Equipamentos e XP no Banco Relacional', async () => {
    const pData = await charService.createCharacter(testAccountId, 'PersistentHero', CharacterClass.WARRIOR);
    const p = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    // Forja e equipa arma
    p.x = 440;
    p.y = 310;
    addItemToInventory(p.inventory, 'iron_ore', 5);
    addItemToInventory(p.inventory, 'wood_log', 5);

    simulation.processCraft(p.id, 'recipe_pickaxe');
    const slotIdx = p.inventory.findIndex(s => s?.itemId === 'pickaxe_copper');
    simulation.processEquip(p.id, slotIdx);
    p.addXp(120);
    p.addGold(40);

    // Salva estado autoritativo
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

    // Desconecta jogador da simulação
    simulation.leavePlayer(p.id);

    // Recarrega do banco de dados (simulando reconexão ou reinício do servidor)
    const loadedData = await charService.getCharacter(testAccountId, p.id);
    assert.strictEqual(loadedData.currentXp, 120);
    assert.strictEqual(loadedData.gold, pData.gold + 40);
    assert.strictEqual(loadedData.equipped.weapon, 'pickaxe_copper');
    assert.strictEqual(getItemCount(loadedData.inventory, 'iron_ore'), 2); // 5 - 3 = 2
    assert.strictEqual(getItemCount(loadedData.inventory, 'wood_log'), 8); // 5 inicial + 5 add - 2 receita = 8
  });
});
