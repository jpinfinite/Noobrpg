import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GameSimulation } from '../src/simulation/GameSimulation.js';
import { CharacterClass, Direction, PlayerData, MonsterType } from '@noobrpg/shared';

describe('NoobRPG Fase 5A — Simulação Autoritativa e Zero Client Trust', () => {
  let sim: GameSimulation;

  const createMockPlayerData = (id: string, charClass: CharacterClass = CharacterClass.WARRIOR): PlayerData => ({
    id,
    name: 'TestHero',
    characterClass: charClass,
    level: 1,
    currentXp: 0,
    gold: 100,
    meritPoints: 0,
    attributes: {
      maxHp: 120,
      currentHp: 120,
      maxMp: 30,
      currentMp: 30,
      attack: 12,
      defense: 8,
      speed: 90
    },
    position: { x: 180, y: 160 },
    direction: Direction.DOWN,
    inventory: [
      { slotIndex: 0, itemId: 'potion_hp_minor', quantity: 2 },
      { slotIndex: 1, itemId: 'wood_log', quantity: 5 },
      { slotIndex: 2, itemId: 'iron_ore', quantity: 4 },
      null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null
    ],
    equipped: { weapon: 'sword_iron', armor: 'armor_leather', accessory: null }
  });

  beforeEach(() => {
    sim = new GameSimulation();
  });

  afterEach(() => {
    sim.stop();
  });

  it('1. Anti-Speedhack: Rejeita deslocamento excessivo incompatível com a velocidade e tempo', () => {
    const pData = createMockPlayerData('player_speedhack');
    const player = sim.joinPlayer(pData, 'acc_1', 1);

    // O jogador está em (180, 160). Sua velocidade é 90 px/s.
    // Tenta saltar para (400, 160) - delta de 220px em 50ms (velocidade exigiria >4000 px/s)
    const moveResult = sim.processMove('player_speedhack', 400, 160, Date.now());

    assert.equal(moveResult.success, false);
    assert.equal(moveResult.reason, 'SPEEDHACK_EXCEEDED');
    assert.equal(player.x, 180); // Posição preservada (rubberband)
    assert.equal(player.y, 160);
  });

  it('2. Colisão Autoritativa: Rejeita movimento para dentro de obstáculos do cenário', () => {
    const pData = createMockPlayerData('player_collision');
    sim.joinPlayer(pData, 'acc_1', 1);

    // Tenta mover para dentro da parede superior (y = 5)
    const wallResult = sim.processMove('player_collision', 180, 5, Date.now() + 50);
    assert.equal(wallResult.success, false);
    assert.equal(wallResult.reason, 'COLLISION_OBSTACLE');

    // Tenta mover para dentro do pilar em (140, 160)
    const pilarResult = sim.processMove('player_collision', 140, 160, Date.now() + 100);
    assert.equal(pilarResult.success, false);
    assert.equal(pilarResult.reason, 'COLLISION_OBSTACLE');
  });

  it('3. Validação de Alcance de Ataque (Anti-Rangehack)', () => {
    const pData = createMockPlayerData('player_range');
    const player = sim.joinPlayer(pData, 'acc_1', 1);

    // Posiciona jogador em (180, 160). Slime 1 está em (220, 130) -> Distância: ~50px.
    // O alcance do Guerreiro é 32px. Ataque direto deve ser rejeitado por alcance.
    const resultOutOfRange = sim.processAttack('player_range', 'mob_slime_1');
    assert.equal(resultOutOfRange.success, false);
    assert.equal(resultOutOfRange.reason, 'OUT_OF_RANGE');

    // Agora move o jogador autoritativamente para perto do monstro (215, 130) -> Distância: 5px.
    player.x = 215;
    player.y = 130;
    player.lastMoveTimestamp = Date.now();

    const resultInRange = sim.processAttack('player_range', 'mob_slime_1');
    assert.equal(resultInRange.success, true);
    assert.ok(resultInRange.damageDealt! > 0);
  });

  it('4. Validação de Cooldown de Combate: Impede múltiplos ataques simultâneos', () => {
    const pData = createMockPlayerData('player_cooldown');
    const player = sim.joinPlayer(pData, 'acc_1', 1);

    player.x = 215;
    player.y = 130;

    // Primeiro ataque com sucesso
    const firstAttack = sim.processAttack('player_cooldown', 'mob_slime_1');
    assert.equal(firstAttack.success, true);

    // Segundo ataque imediato (spam de pacote de ataque no mesmo tick)
    const spamAttack = sim.processAttack('player_cooldown', 'mob_slime_1');
    assert.equal(spamAttack.success, false);
    assert.equal(spamAttack.reason, 'COOLDOWN_ACTIVE');
  });

  it('5. Morte Única e Prevenção de Duplicação de XP/Loot', () => {
    const pData = createMockPlayerData('player_killer');
    const player = sim.joinPlayer(pData, 'acc_1', 1);

    player.x = 215;
    player.y = 130;

    const slime = sim.monsters.get('mob_slime_1')!;
    slime.hp = 5; // Deixa o monstro com pouca vida

    const killAttack = sim.processAttack('player_killer', 'mob_slime_1');
    assert.equal(killAttack.success, true);
    assert.equal(killAttack.monsterDied, true);
    assert.equal(killAttack.xpGained, 25);
    assert.equal(player.currentXp, 25);
    assert.ok(player.gold > 100); // Ganhou Gold do slime

    // Monstro está morto
    assert.ok(slime.isDead());

    // Tentativa de atacar novamente o monstro morto para duplicar XP
    player.lastAttackTimestamp = 0; // Força reset do cooldown para testar a validação do monstro
    const duplicateAttack = sim.processAttack('player_killer', 'mob_slime_1');
    assert.equal(duplicateAttack.success, false);
    assert.equal(duplicateAttack.reason, 'INVALID_OR_DEAD_TARGET');
    assert.equal(player.currentXp, 25); // XP NÃO foi duplicado!
  });

  it('6. Coleta Autoritativa: Bloqueio fora de alcance e respawn no servidor', () => {
    const pData = createMockPlayerData('player_gatherer');
    const player = sim.joinPlayer(pData, 'acc_1', 1);

    // Árvore 1 está em (90, 80). Jogador em (180, 160).
    const outOfRange = sim.processGather('player_gatherer', 'node_tree_1');
    assert.equal(outOfRange.success, false);
    assert.equal(outOfRange.reason, 'NODE_NOT_READY_OR_OUT_OF_RANGE');

    // Aproxima jogador da árvore
    player.x = 95;
    player.y = 80;

    const started = sim.processGather('player_gatherer', 'node_tree_1');
    assert.equal(started.success, true);

    const node = sim.gatheringNodes.get('node_tree_1')!;
    assert.equal(node.state, 'GATHERING');

    // Simula passagem do tempo (1500ms é a duração da árvore)
    sim.tick(1600);

    // Coleta deve ter completado e adicionado madeira no inventário do jogador
    assert.equal(node.state, 'COOLDOWN');
    assert.ok(player.inventory[1]?.quantity! > 5); // Tinha 5 madeiras, agora tem mais

    // Tentativa de coletar nó que está em cooldown
    const whileCooldown = sim.processGather('player_gatherer', 'node_tree_1');
    assert.equal(whileCooldown.success, false);
    assert.equal(whileCooldown.reason, 'NODE_NOT_READY_OR_OUT_OF_RANGE');
  });

  it('7. Pegar Itens no Chão (Pickup): Alcance, inventário e remoção autoritativa', () => {
    const pData = createMockPlayerData('player_pickup');
    const player = sim.joinPlayer(pData, 'acc_1', 1);

    // Spawna drop no chão em (200, 160)
    const drop = sim.spawnGroundItem('slime_gel', 3, 200, 160);
    assert.ok(sim.groundItems.has(drop.id));

    // Jogador em (180, 160) -> Distância 20px (dentro dos 32px de pickup)
    const pickupRes = sim.processPickup('player_pickup', drop.id);
    assert.equal(pickupRes.success, true);
    assert.equal(pickupRes.itemId, 'slime_gel');
    assert.equal(pickupRes.quantity, 3);

    // Item foi removido do chão no servidor
    assert.equal(sim.groundItems.has(drop.id), false);

    // Tentativa de repetir o pickup (replay exploit)
    const repeatPickup = sim.processPickup('player_pickup', drop.id);
    assert.equal(repeatPickup.success, false);
    assert.equal(repeatPickup.reason, 'ITEM_NOT_FOUND');
  });

  it('8. Consumo de Poções e Cura Limitada ao Teto de HP', () => {
    const pData = createMockPlayerData('player_potion');
    const player = sim.joinPlayer(pData, 'acc_1', 1);

    // Simula jogador ferido (50 / 120 HP)
    player.hp = 50;
    const initialPotionCount = player.inventory[0]?.quantity || 0;

    // Bebe Poção de Vida Menor (+35 HP)
    const useRes = sim.processUseItem('player_potion', 0);
    assert.equal(useRes.success, true);
    assert.equal(player.hp, 85); // 50 + 35 = 85
    assert.equal(player.inventory[0]?.quantity, initialPotionCount - 1);

    // Bebe outra poção com vida em 85 (85 + 35 = 120, respeita teto)
    sim.processUseItem('player_potion', 0);
    assert.equal(player.hp, 120); // Limitado ao maxHp
    assert.equal(player.inventory[0], null); // Slot esgotado
  });

  it('9. Crafting Autoritativo: Validação de proximidade da forja e ingredientes', () => {
    const pData = createMockPlayerData('player_crafter');
    const player = sim.joinPlayer(pData, 'acc_1', 1);

    // Bigorna está em (190, 140). Jogador em (180, 160) -> Distância ~22px (dentro do alcance)
    // Recipe recipe_iron_sword requer 4 minérios de ferro e 2 madeiras (ele possui 4 ferros e 5 madeiras)
    // Mas recipe_iron_sword requer nível 2! Jogador nível 1 deve falhar por nível:
    const craftSword = sim.processCraft('player_crafter', 'recipe_iron_sword');
    assert.equal(craftSword.success, false);
    assert.equal(craftSword.reason, 'LEVEL_TOO_LOW');

    // Recipe recipe_pickaxe requer nível 1, 3 minérios de ferro e 2 madeiras
    const craftPickaxe = sim.processCraft('player_crafter', 'recipe_pickaxe');
    assert.equal(craftPickaxe.success, true);
    assert.equal(craftPickaxe.resultItemId, 'pickaxe_copper');

    // Materiais foram consumidos no servidor
    assert.equal(player.inventory[1]?.quantity, 3); // 5 - 2 = 3 madeiras
    assert.equal(player.inventory[2]?.quantity, 1); // 4 - 3 = 1 ferro
  });

  it('10. Snapshot Autoritativo Completo do Mundo a 20 Hz', () => {
    const pData = createMockPlayerData('player_snapshot');
    sim.joinPlayer(pData, 'acc_1', 1);

    const snapshot = sim.getSnapshot();
    assert.ok(snapshot.timestamp > 0);
    assert.equal(snapshot.players.length, 1);
    assert.equal(snapshot.players[0].name, 'TestHero');
    assert.equal(snapshot.monsters.length, 4);
    assert.equal(snapshot.gatheringNodes.length, 6);
  });
});
