import { randomUUID } from 'node:crypto';
import {
  MonsterType,
  GatheringNodeType,
  PlayerData,
  calculateDistance,
  calculateDamage,
  executeCrafting,
  addItemToInventory,
  ITEM_DEFINITIONS
} from '@noobrpg/shared';
import { SIMULATION_CONSTANTS } from './SimulationConstants.js';
import { ServerPlayer } from './ServerPlayer.js';
import { ServerMonster } from './ServerMonster.js';
import { ServerGatheringNode } from './ServerGatheringNode.js';
import { ServerGroundItem } from './ServerGroundItem.js';

export interface CombatEvent {
  type: 'PLAYER_ATTACK' | 'PLAYER_SKILL' | 'MONSTER_ATTACK' | 'MONSTER_DEATH' | 'PLAYER_LEVEL_UP';
  attackerId: string;
  targetId: string;
  damage?: number;
  xpAwarded?: number;
  goldAwarded?: number;
  newLevel?: number;
  timestamp: number;
}

export class GameSimulation {
  public players: Map<string, ServerPlayer> = new Map();
  public monsters: Map<string, ServerMonster> = new Map();
  public gatheringNodes: Map<string, ServerGatheringNode> = new Map();
  public groundItems: Map<string, ServerGroundItem> = new Map();
  public combatEvents: CombatEvent[] = [];

  private intervalTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.initWorldEntities();
  }

  private initWorldEntities(): void {
    // 1. Monstros canônicos
    const slimeSpawns = [
      { id: 'mob_slime_1', x: 220, y: 130 },
      { id: 'mob_slime_2', x: 120, y: 190 },
      { id: 'mob_slime_3', x: 260, y: 190 }
    ];
    slimeSpawns.forEach(s => {
      this.monsters.set(s.id, new ServerMonster(s.id, MonsterType.SLIME, s.x, s.y));
    });

    const goblin = new ServerMonster('mob_goblin_1', MonsterType.GOBLIN, 280, 70);
    this.monsters.set(goblin.id, goblin);

    // 2. Nós de Coleta canônicos
    const nodes = [
      { id: 'node_tree_1', type: GatheringNodeType.TREE, x: 90, y: 80 },
      { id: 'node_tree_2', type: GatheringNodeType.TREE, x: 300, y: 210 },
      { id: 'node_ore_1', type: GatheringNodeType.ORE_VEIN, x: 140, y: 60 },
      { id: 'node_ore_2', type: GatheringNodeType.ORE_VEIN, x: 260, y: 60 },
      { id: 'node_herb_1', type: GatheringNodeType.HERB_BUSH, x: 100, y: 150 },
      { id: 'node_herb_2', type: GatheringNodeType.HERB_BUSH, x: 270, y: 160 }
    ];
    nodes.forEach(n => {
      this.gatheringNodes.set(n.id, new ServerGatheringNode(n.id, n.type, n.x, n.y));
    });
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.intervalTimer = setInterval(() => {
      this.tick(SIMULATION_CONSTANTS.TICK_INTERVAL_MS);
    }, SIMULATION_CONSTANTS.TICK_INTERVAL_MS);
    if (this.intervalTimer && typeof (this.intervalTimer as any).unref === 'function') {
      (this.intervalTimer as any).unref();
    }
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
  }

  /**
   * Executa um tick de simulação a 20 Hz
   */
  public tick(deltaMs: number = SIMULATION_CONSTANTS.TICK_INTERVAL_MS): void {
    const now = Date.now();
    const playerList = Array.from(this.players.values());

    // 1. Atualiza IA dos Monstros
    for (const monster of this.monsters.values()) {
      const result = monster.updateAI(now, deltaMs, playerList);
      if (result?.playerDamaged) {
        const victim = this.players.get(result.playerDamaged.playerId);
        if (victim && victim.isAlive()) {
          const dmgResult = victim.takeDamage(result.playerDamaged.damage);
          this.combatEvents.push({
            type: 'MONSTER_ATTACK',
            attackerId: monster.id,
            targetId: victim.id,
            damage: result.playerDamaged.damage,
            timestamp: now
          });
        }
      }
    }

    // 2. Atualiza Nós de Coleta
    for (const node of this.gatheringNodes.values()) {
      const gatherResult = node.updateTick(deltaMs, this.players);
      if (gatherResult && gatherResult.completed) {
        const player = this.players.get(gatherResult.playerId);
        if (player && player.isAlive()) {
          const addRes = addItemToInventory(player.inventory, gatherResult.itemId, gatherResult.quantity);
          if (!addRes.success && addRes.remainingQuantity > 0) {
            // Dropa o que não coube no chão ao lado do nó
            this.spawnGroundItem(gatherResult.itemId, addRes.remainingQuantity, node.x, node.y);
          }
        }
      }
    }

    // 3. Atualiza Respawn de Jogadores Mortos
    for (const player of playerList) {
      if (player.isDead && now >= player.respawnTimestamp) {
        player.respawn(180, 160);
      }
    }

    // 4. Limpa Itens Expirados do Chão
    for (const [id, item] of this.groundItems.entries()) {
      if (item.isExpired(now)) {
        this.groundItems.delete(id);
      }
    }

    // Mantém buffer de eventos com tamanho controlado (últimos 50)
    if (this.combatEvents.length > 50) {
      this.combatEvents = this.combatEvents.slice(-50);
    }
  }

  // --- GERENCIAMENTO DE JOGADORES ---

  public joinPlayer(playerData: PlayerData, accountId: string, version: number): ServerPlayer {
    const serverPlayer = new ServerPlayer({
      ...playerData,
      accountId,
      version
    });
    this.players.set(serverPlayer.id, serverPlayer);
    return serverPlayer;
  }

  public leavePlayer(playerId: string): ServerPlayer | null {
    const player = this.players.get(playerId);
    if (player) {
      this.players.delete(playerId);
      return player;
    }
    return null;
  }

  public getPlayer(playerId: string): ServerPlayer | null {
    return this.players.get(playerId) || null;
  }

  // --- COMANDOS AUTORITATIVOS ---

  public processMove(
    playerId: string,
    newX: number,
    newY: number,
    clientTimestamp: number = Date.now()
  ): { success: boolean; x: number; y: number; reason?: string } {
    const player = this.players.get(playerId);
    if (!player) return { success: false, x: 0, y: 0, reason: 'PLAYER_NOT_FOUND' };
    return player.validateAndApplyMovement(newX, newY, clientTimestamp);
  }

  public processAttack(
    playerId: string,
    targetMonsterId: string
  ): { success: boolean; damageDealt?: number; monsterDied?: boolean; xpGained?: number; goldGained?: number; reason?: string } {
    const now = Date.now();
    const player = this.players.get(playerId);
    if (!player) return { success: false, reason: 'PLAYER_NOT_FOUND' };

    const check = player.canAttack(now);
    if (!check.can) return { success: false, reason: check.reason };

    const monster = this.monsters.get(targetMonsterId);
    if (!monster || monster.isDead()) {
      return { success: false, reason: 'INVALID_OR_DEAD_TARGET' };
    }

    // Validação de alcance
    const dist = calculateDistance(player.x, player.y, monster.x, monster.y);
    const range = player.getCombatConfig().attackRange;
    if (dist > range + 12) { // 12px de tolerância para latência
      return { success: false, reason: 'OUT_OF_RANGE' };
    }

    // Calcula dano determinístico
    const damage = calculateDamage(player.getAttack(), monster.config.defense);
    const reward = monster.takeDamage(damage, player.id);

    player.registerAttack(now);

    let xpGained = 0;
    let goldGained = 0;

    if (reward && reward.died) {
      xpGained = reward.xpReward;
      goldGained = reward.gold;

      const lvlResult = player.addXp(xpGained);
      player.addGold(goldGained);

      // Spawna drops autoritativos no chão
      for (const drop of reward.drops) {
        this.spawnGroundItem(drop.itemId, drop.quantity, monster.x, monster.y);
      }

      this.combatEvents.push({
        type: 'MONSTER_DEATH',
        attackerId: player.id,
        targetId: monster.id,
        xpAwarded: xpGained,
        goldAwarded: goldGained,
        newLevel: lvlResult.leveledUp ? lvlResult.newLevel : undefined,
        timestamp: now
      });
    }

    this.combatEvents.push({
      type: 'PLAYER_ATTACK',
      attackerId: player.id,
      targetId: monster.id,
      damage,
      timestamp: now
    });

    return {
      success: true,
      damageDealt: damage,
      monsterDied: reward?.died || false,
      xpGained,
      goldGained
    };
  }

  public processSkill1(
    playerId: string,
    targetMonsterId: string
  ): { success: boolean; damageDealt?: number; monsterDied?: boolean; xpGained?: number; goldGained?: number; reason?: string } {
    const now = Date.now();
    const player = this.players.get(playerId);
    if (!player) return { success: false, reason: 'PLAYER_NOT_FOUND' };

    const check = player.canUseSkill1(now);
    if (!check.can) return { success: false, reason: check.reason };

    const monster = this.monsters.get(targetMonsterId);
    if (!monster || monster.isDead()) {
      return { success: false, reason: 'INVALID_OR_DEAD_TARGET' };
    }

    // Alcance da habilidade (1.2x do alcance básico)
    const dist = calculateDistance(player.x, player.y, monster.x, monster.y);
    const range = player.getCombatConfig().attackRange * 1.2;
    if (dist > range + 14) {
      return { success: false, reason: 'OUT_OF_RANGE' };
    }

    // Habilidade causa 60% a mais de dano
    const baseDamage = calculateDamage(player.getAttack(), monster.config.defense);
    const damage = Math.round(baseDamage * 1.6);
    const reward = monster.takeDamage(damage, player.id);

    player.registerSkill1(now);

    let xpGained = 0;
    let goldGained = 0;

    if (reward && reward.died) {
      xpGained = reward.xpReward;
      goldGained = reward.gold;

      const lvlResult = player.addXp(xpGained);
      player.addGold(goldGained);

      for (const drop of reward.drops) {
        this.spawnGroundItem(drop.itemId, drop.quantity, monster.x, monster.y);
      }

      this.combatEvents.push({
        type: 'MONSTER_DEATH',
        attackerId: player.id,
        targetId: monster.id,
        xpAwarded: xpGained,
        goldAwarded: goldGained,
        newLevel: lvlResult.leveledUp ? lvlResult.newLevel : undefined,
        timestamp: now
      });
    }

    this.combatEvents.push({
      type: 'PLAYER_SKILL',
      attackerId: player.id,
      targetId: monster.id,
      damage,
      timestamp: now
    });

    return {
      success: true,
      damageDealt: damage,
      monsterDied: reward?.died || false,
      xpGained,
      goldGained
    };
  }

  public processGather(playerId: string, nodeId: string): { success: boolean; reason?: string } {
    const player = this.players.get(playerId);
    if (!player) return { success: false, reason: 'PLAYER_NOT_FOUND' };

    const node = this.gatheringNodes.get(nodeId);
    if (!node) return { success: false, reason: 'NODE_NOT_FOUND' };

    if (!node.canInteract(player)) {
      return { success: false, reason: 'NODE_NOT_READY_OR_OUT_OF_RANGE' };
    }

    const started = node.startGather(player);
    return { success: started, reason: started ? undefined : 'CANNOT_START_GATHER' };
  }

  public processPickup(
    playerId: string,
    dropId: string
  ): { success: boolean; itemId?: string; quantity?: number; reason?: string } {
    const player = this.players.get(playerId);
    if (!player) return { success: false, reason: 'PLAYER_NOT_FOUND' };

    const item = this.groundItems.get(dropId);
    if (!item) return { success: false, reason: 'ITEM_NOT_FOUND' };

    if (!item.canPickup(player.x, player.y)) {
      return { success: false, reason: 'OUT_OF_RANGE' };
    }

    const addRes = addItemToInventory(player.inventory, item.itemId, item.quantity);
    if (!addRes.success && addRes.addedQuantity === 0) {
      return { success: false, reason: 'INVENTORY_FULL' };
    }

    if (addRes.remainingQuantity === 0) {
      // Coleta completa: remove item do chão
      this.groundItems.delete(dropId);
      return { success: true, itemId: item.itemId, quantity: item.quantity };
    } else {
      // Coleta parcial: ajusta quantidade restante no chão
      item.quantity = addRes.remainingQuantity;
      return { success: true, itemId: item.itemId, quantity: addRes.addedQuantity };
    }
  }

  public processCraft(
    playerId: string,
    recipeId: string
  ): { success: boolean; resultItemId?: string; reason?: string } {
    const player = this.players.get(playerId);
    if (!player) return { success: false, reason: 'PLAYER_NOT_FOUND' };

    // Valida proximidade da bigorna de crafting em (190, 140)
    const distToForge = calculateDistance(player.x, player.y, 190, 140);
    if (distToForge > SIMULATION_CONSTANTS.INTERACT_MAX_DISTANCE + 8) {
      return { success: false, reason: 'TOO_FAR_FROM_CRAFTING_STATION' };
    }

    const res = executeCrafting(player.inventory, recipeId, player.level);
    return res;
  }

  public processUseItem(playerId: string, slotIndex: number): { success: boolean; reason?: string } {
    const player = this.players.get(playerId);
    if (!player) return { success: false, reason: 'PLAYER_NOT_FOUND' };
    return player.useConsumable(slotIndex);
  }

  public processEquip(playerId: string, slotIndex: number): { success: boolean; reason?: string } {
    const player = this.players.get(playerId);
    if (!player) return { success: false, reason: 'PLAYER_NOT_FOUND' };
    return player.equipItem(slotIndex);
  }

  public spawnGroundItem(itemId: string, quantity: number, x: number, y: number): ServerGroundItem {
    const id = randomUUID();
    const offsetX = Math.random() * 12 - 6;
    const offsetY = Math.random() * 12 - 6;
    const groundItem = new ServerGroundItem(id, itemId, quantity, x + offsetX, y + offsetY);
    this.groundItems.set(id, groundItem);
    return groundItem;
  }

  public getSnapshot() {
    return {
      timestamp: Date.now(),
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        characterClass: p.characterClass,
        level: p.level,
        x: Math.round(p.x),
        y: Math.round(p.y),
        hp: p.hp,
        maxHp: p.getMaxHp(),
        mp: p.mp,
        maxMp: p.getMaxMp(),
        isDead: p.isDead
      })),
      monsters: Array.from(this.monsters.values()).map(m => ({
        id: m.id,
        type: m.type,
        x: Math.round(m.x),
        y: Math.round(m.y),
        hp: m.hp,
        maxHp: m.maxHp,
        state: m.state
      })),
      gatheringNodes: Array.from(this.gatheringNodes.values()).map(n => ({
        id: n.id,
        type: n.type,
        x: n.x,
        y: n.y,
        state: n.state
      })),
      groundItems: Array.from(this.groundItems.values()).map(i => ({
        id: i.id,
        itemId: i.itemId,
        quantity: i.quantity,
        x: Math.round(i.x),
        y: Math.round(i.y)
      }))
    };
  }
}
