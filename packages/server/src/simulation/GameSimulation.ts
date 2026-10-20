import { randomUUID } from 'node:crypto';
import {
  MonsterType,
  GatheringNodeType,
  PlayerData,
  calculateDistance,
  calculateDamage,
  executeCrafting,
  addItemToInventory,
  getItemCount,
  removeItemById,
  ITEM_DEFINITIONS,
  ItemCategory,
  CRAFTING_RECIPES,
  QuestProgress,
  PendingRewardItem
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

export interface QuestActionResult {
  success: boolean;
  quest?: QuestProgress;
  rewardsAwarded?: {
    gold?: number;
    xp?: number;
    items?: { itemId: string; quantity: number }[];
  };
  reason?: string;
  message?: string;
}

export const NPC_SPAWNS: Record<string, { x: number; y: number }[]> = {
  npc_elder: [
    { x: 464, y: 280 }, // starter_village
    { x: 180, y: 120 }  // map_prototype
  ],
  npc_blacksmith: [
    { x: 410, y: 310 }, // starter_village
    { x: 160, y: 140 }  // map_prototype
  ],
  npc_guard: [
    { x: 450, y: 90 },  // starter_village (próximo ao portão Norte)
    { x: 210, y: 130 }  // map_prototype
  ],
  npc_tavern: [
    { x: 510, y: 290 }, // starter_village (praça central / leste)
    { x: 200, y: 180 }  // map_prototype
  ]
};

export const CRAFTING_STATIONS: { x: number; y: number; mapKey?: string }[] = [
  { x: 440, y: 310, mapKey: 'map_starter_village' }, // Forja da Praça da Vila Inicial
  { x: 190, y: 140, mapKey: 'map_prototype' }        // Forja das Planícies Protótipo
];

export const ALCHEMY_STATIONS: { x: number; y: number; mapKey?: string }[] = [
  { x: 530, y: 290, mapKey: 'map_starter_village' }, // Bancada de Alquimia da Taverna (Vila Inicial)
  { x: 220, y: 180, mapKey: 'map_prototype' }        // Bancada de Alquimia da Taverna (Planícies)
];

export const SAFE_ZONES: { mapKey: string; minX: number; maxX: number; minY: number; maxY: number }[] = [
  { mapKey: 'map_starter_village', minX: 380, maxX: 540, minY: 240, maxY: 360 }
];

export function isInsideSafeZone(x: number, y: number, mapKey: string = 'map_prototype'): boolean {
  if (mapKey === 'map_starter_village' || mapKey === 'starter_village') {
    return x >= 380 && x <= 540 && y >= 240 && y <= 360;
  }
  return false;
}

export class GameSimulation {
  public players: Map<string, ServerPlayer> = new Map();
  public monsters: Map<string, ServerMonster> = new Map();
  public gatheringNodes: Map<string, ServerGatheringNode> = new Map();
  public groundItems: Map<string, ServerGroundItem> = new Map();
  public combatEvents: CombatEvent[] = [];

  public onMonsterKilled?: (killerId: string, monsterType: MonsterType) => void;
  public onGatherCompleted?: (playerId: string, itemId: string, quantity: number) => void;
  public onPlayerLeveledUp?: (playerId: string, newLevel: number) => void;

  private intervalTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.initWorldEntities();
  }

  private initWorldEntities(): void {
    // 1. Monstros canônicos do Mapa Protótipo
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

    // Esqueletos Guerreiros nas zonas expandidas
    const skeleton1 = new ServerMonster('mob_skeleton_1', MonsterType.SKELETON, 720, 280);
    const skeleton2 = new ServerMonster('mob_skeleton_2', MonsterType.SKELETON, 840, 340);
    this.monsters.set(skeleton1.id, skeleton1);
    this.monsters.set(skeleton2.id, skeleton2);

    // 1.5. Monstros dedicados da Zona Exterior da Vila Inicial (posições livres fora da Safe Zone)
    const villageMobs = [
      { id: 'mob_village_slime_1', type: MonsterType.SLIME, x: 620, y: 220 },
      { id: 'mob_village_slime_2', type: MonsterType.SLIME, x: 680, y: 240 },
      { id: 'mob_village_slime_3', type: MonsterType.SLIME, x: 320, y: 460 },
      { id: 'mob_village_goblin_1', type: MonsterType.GOBLIN, x: 260, y: 220 },
      { id: 'mob_village_skeleton_1', type: MonsterType.SKELETON, x: 180, y: 520 },
      { id: 'mob_village_skeleton_2', type: MonsterType.SKELETON, x: 260, y: 540 }
    ];
    villageMobs.forEach(vm => {
      this.monsters.set(vm.id, new ServerMonster(vm.id, vm.type, vm.x, vm.y));
    });

    // 2. Nós de Coleta canônicos e expandidos
    const nodes = [
      { id: 'node_tree_1', type: GatheringNodeType.TREE, x: 90, y: 80 },
      { id: 'node_tree_2', type: GatheringNodeType.TREE, x: 300, y: 210 },
      { id: 'node_tree_3', type: GatheringNodeType.TREE, x: 680, y: 220 },
      { id: 'node_ore_1', type: GatheringNodeType.ORE_VEIN, x: 140, y: 60 },
      { id: 'node_ore_2', type: GatheringNodeType.ORE_VEIN, x: 260, y: 60 },
      { id: 'node_ore_3', type: GatheringNodeType.ORE_VEIN, x: 780, y: 320 },
      { id: 'node_herb_1', type: GatheringNodeType.HERB_BUSH, x: 100, y: 150 },
      { id: 'node_herb_2', type: GatheringNodeType.HERB_BUSH, x: 270, y: 160 },
      { id: 'node_herb_3', type: GatheringNodeType.HERB_BUSH, x: 820, y: 400 },
      // Nós de coleta da Vila Inicial
      { id: 'node_village_tree_1', type: GatheringNodeType.TREE, x: 220, y: 180 },
      { id: 'node_village_tree_2', type: GatheringNodeType.TREE, x: 700, y: 180 },
      { id: 'node_village_ore_1', type: GatheringNodeType.ORE_VEIN, x: 180, y: 140 },
      { id: 'node_village_ore_2', type: GatheringNodeType.ORE_VEIN, x: 280, y: 100 },
      { id: 'node_village_herb_1', type: GatheringNodeType.HERB_BUSH, x: 360, y: 420 },
      { id: 'node_village_herb_2', type: GatheringNodeType.HERB_BUSH, x: 640, y: 300 }
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

    // 1. Atualiza IA dos Monstros (jogadores na Safe Zone são protegidos)
    const targetablePlayers = playerList.filter(p => !isInsideSafeZone(p.x, p.y, p.mapKey));
    for (const monster of this.monsters.values()) {
      const result = monster.updateAI(now, deltaMs, targetablePlayers);
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
          if (this.onGatherCompleted) {
            this.onGatherCompleted(gatherResult.playerId, gatherResult.itemId, gatherResult.quantity);
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

  public joinPlayer(playerData: PlayerData, accountId: string, version: number, mapKey: string = 'map_prototype'): ServerPlayer {
    const serverPlayer = new ServerPlayer({
      ...playerData,
      accountId,
      version,
      mapKey
    } as any);
    this.players.set(serverPlayer.id, serverPlayer);
    return serverPlayer;
  }

  public setPlayerMap(playerId: string, mapKey: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.mapKey = mapKey;
    }
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
    clientDt: number = 50
  ): { success: boolean; x: number; y: number; reason?: string } {
    const player = this.players.get(playerId);
    if (!player) return { success: false, x: 0, y: 0, reason: 'PLAYER_NOT_FOUND' };
    return player.validateAndApplyMovement(newX, newY, clientDt);
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

      if (lvlResult.leveledUp && this.onPlayerLeveledUp) {
        this.onPlayerLeveledUp(player.id, lvlResult.newLevel);
      }
      if (this.onMonsterKilled) {
        this.onMonsterKilled(player.id, monster.type);
      }
    }

    this.combatEvents.push({
      type: 'PLAYER_ATTACK',
      attackerId: player.id,
      targetId: monster.id,
      damage,
      timestamp: now
    });

    const questUpdated = (reward && reward.died) ? this.checkHuntingQuests(player, monster) : undefined;

    return {
      success: true,
      damageDealt: damage,
      monsterDied: reward?.died || false,
      monsterType: monster.type,
      xpGained,
      goldGained,
      questUpdated
    };
  }

  public processSkill1(
    playerId: string,
    targetMonsterId: string
  ): { success: boolean; damageDealt?: number; monsterDied?: boolean; xpGained?: number; goldGained?: number; reason?: string; questUpdated?: QuestProgress } {
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

      if (lvlResult.leveledUp && this.onPlayerLeveledUp) {
        this.onPlayerLeveledUp(player.id, lvlResult.newLevel);
      }
      if (this.onMonsterKilled) {
        this.onMonsterKilled(player.id, monster.type);
      }
    }

    this.combatEvents.push({
      type: 'PLAYER_SKILL',
      attackerId: player.id,
      targetId: monster.id,
      damage,
      timestamp: now
    });

    const questUpdated = (reward && reward.died) ? this.checkHuntingQuests(player, monster) : undefined;

    return {
      success: true,
      damageDealt: damage,
      monsterDied: reward?.died || false,
      monsterType: monster.type,
      xpGained,
      goldGained,
      questUpdated
    };
  }

  private checkHuntingQuests(player: ServerPlayer, monster: ServerMonster): QuestProgress | undefined {
    if (monster.type === MonsterType.SLIME) {
      const quest = player.getQuest('quest_plains_threat');
      if (quest && quest.step === 1 && !quest.completed) {
        const currentKills = quest.claimedRewards.filter(r => r.startsWith('slime_kill_')).length;
        if (currentKills < 3) {
          const nextKill = currentKills + 1;
          quest.claimedRewards.push(`slime_kill_${nextKill}`);
          if (nextKill >= 3) {
            quest.step = 2; // 3/3 slimes derrotados! Pronto para entregar ao Guarda.
          }
          player.setQuest('quest_plains_threat', quest);
          return quest;
        }
      }
    }
    return undefined;
  }

  public processGather(playerId: string, nodeId: string): { success: boolean; reason?: string } {
    const player = this.players.get(playerId);
    if (!player) return { success: false, reason: 'PLAYER_NOT_FOUND' };
    if (!player.isAlive()) return { success: false, reason: 'PLAYER_DEAD' };

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
    if (!player.isAlive()) return { success: false, reason: 'PLAYER_DEAD' };

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
    if (!player.isAlive()) return { success: false, reason: 'PLAYER_DEAD' };

    const recipe = CRAFTING_RECIPES.find(r => r.id === recipeId);
    if (!recipe) {
      return { success: false, reason: 'RECIPE_NOT_FOUND' };
    }

    // Valida proximidade da estação adequada (Alquimia para consumíveis, Forja para armas e armaduras)
    const isAlchemy = recipe.category === ItemCategory.CONSUMABLE;
    const stations = isAlchemy ? ALCHEMY_STATIONS : CRAFTING_STATIONS;

    const minDistToStation = Math.min(
      ...stations.map(s => calculateDistance(player.x, player.y, s.x, s.y))
    );
    if (minDistToStation > SIMULATION_CONSTANTS.INTERACT_MAX_DISTANCE + 16) {
      return { success: false, reason: 'TOO_FAR_FROM_CRAFTING_STATION' };
    }

    const res = executeCrafting(player.inventory, recipeId, player.level);
    return res;
  }

  /**
   * Concede itens com proteção contra perda por inventário cheio.
   * Se os itens não couberem no inventário (total ou parcialmente), o excedente é guardado
   * de forma persistente e recuperável em Recompensas Pendentes (player.pendingRewards).
   */
  public deliverItemOrPend(
    player: ServerPlayer,
    itemId: string,
    quantity: number,
    source: string
  ): { deliveredToInventory: number; pendedQuantity: number } {
    const addRes = addItemToInventory(player.inventory, itemId, quantity);
    let pended = 0;
    if (!addRes.success && addRes.remainingQuantity > 0) {
      pended = addRes.remainingQuantity;
      player.addPendingReward(itemId, pended, source);
    }
    return {
      deliveredToInventory: addRes.addedQuantity,
      pendedQuantity: pended
    };
  }

  /**
   * Resgata itens acumulados na caixa de recompensas pendentes para o inventário do jogador.
   * Transfere o que couber e mantém o restante de forma persistente e idempotente.
   */
  public claimPendingRewards(playerId: string): {
    success: boolean;
    reason?: string;
    claimed: { itemId: string; quantity: number }[];
    remaining: PendingRewardItem[];
    message: string;
  } {
    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, reason: 'PLAYER_NOT_FOUND', claimed: [], remaining: [], message: 'Jogador não encontrado.' };
    }
    if (!player.isAlive()) {
      return {
        success: false,
        reason: 'PLAYER_DEAD',
        claimed: [],
        remaining: player.pendingRewards,
        message: 'Personagem derrotado não pode resgatar recompensas pendentes.'
      };
    }

    if (player.pendingRewards.length === 0) {
      return {
        success: false,
        reason: 'NO_PENDING_REWARDS',
        claimed: [],
        remaining: [],
        message: 'Não há recompensas pendentes para resgatar.'
      };
    }

    const claimed: { itemId: string; quantity: number }[] = [];
    const newPending: PendingRewardItem[] = [];

    for (const item of player.pendingRewards) {
      const addRes = addItemToInventory(player.inventory, item.itemId, item.quantity);
      if (addRes.addedQuantity > 0) {
        claimed.push({ itemId: item.itemId, quantity: addRes.addedQuantity });
      }
      if (addRes.remainingQuantity > 0) {
        newPending.push({
          ...item,
          quantity: addRes.remainingQuantity
        });
      }
    }

    player.pendingRewards = newPending;

    const totalClaimedUnits = claimed.reduce((sum, c) => sum + c.quantity, 0);
    const totalRemainingUnits = newPending.reduce((sum, r) => sum + r.quantity, 0);

    let msg = '';
    if (totalClaimedUnits > 0 && totalRemainingUnits === 0) {
      msg = `Todas as recompensas pendentes foram resgatadas com sucesso (${totalClaimedUnits} itens transferidos ao inventário)!`;
    } else if (totalClaimedUnits > 0 && totalRemainingUnits > 0) {
      msg = `${totalClaimedUnits} itens resgatados. ${totalRemainingUnits} ainda permanecem pendentes por falta de espaço no inventário.`;
    } else {
      msg = 'Inventário cheio! Libere espaço para resgatar seus itens pendentes.';
    }

    const success = totalClaimedUnits > 0;
    return {
      success,
      reason: success ? undefined : 'INVENTORY_FULL',
      claimed,
      remaining: newPending,
      message: msg
    };
  }

  public processChangeMap(
    playerId: string,
    targetMapKey: string
  ): { success: boolean; mapKey?: string; spawnX?: number; spawnY?: number; reason?: string } {
    const player = this.players.get(playerId);
    if (!player) return { success: false, reason: 'PLAYER_NOT_FOUND' };
    if (!player.isAlive()) return { success: false, reason: 'PLAYER_DEAD' };

    const validMaps = ['map_starter_village', 'map_prototype', 'starter_village'];
    if (!validMaps.includes(targetMapKey)) {
      return { success: false, reason: 'INVALID_TARGET_MAP' };
    }

    const canonicalTarget = targetMapKey === 'starter_village' ? 'map_starter_village' : targetMapKey;
    const currentCanonical = player.mapKey === 'starter_village' ? 'map_starter_village' : player.mapKey;

    if (currentCanonical === canonicalTarget) {
      return { success: false, reason: 'ALREADY_IN_TARGET_MAP' };
    }

    // Se estiver na Vila Inicial, deve estar próximo a uma das saídas (Portão Norte ou Sul)
    if (currentCanonical === 'map_starter_village') {
      const distNorthGate = calculateDistance(player.x, player.y, 456, 30);
      const distSouthGate = calculateDistance(player.x, player.y, 456, 600);
      const minGateDist = Math.min(distNorthGate, distSouthGate);
      if (minGateDist > 80) {
        return { success: false, reason: 'TOO_FAR_FROM_MAP_EXIT' };
      }
    } else if (currentCanonical === 'map_prototype') {
      // Se estiver nas Planícies, deve estar próximo à conexão de retorno para a vila (180, 160)
      const distPrototypeExit = calculateDistance(player.x, player.y, 180, 160);
      if (distPrototypeExit > 90) {
        return { success: false, reason: 'TOO_FAR_FROM_MAP_EXIT' };
      }
    }

    let spawnX = 464;
    let spawnY = 320;

    if (canonicalTarget === 'map_prototype') {
      // Entrada nas Planícies
      spawnX = 180;
      spawnY = 160;
    } else if (canonicalTarget === 'map_starter_village') {
      // Entrada na Vila Inicial pelo Portão Norte
      spawnX = 456;
      spawnY = 50;
    }

    player.mapKey = canonicalTarget;
    player.x = spawnX;
    player.y = spawnY;

    return {
      success: true,
      mapKey: canonicalTarget,
      spawnX,
      spawnY
    };
  }

  public processUseItem(playerId: string, slotIndex: number): { success: boolean; reason?: string } {
    const player = this.players.get(playerId);
    if (!player) return { success: false, reason: 'PLAYER_NOT_FOUND' };
    if (!player.isAlive()) return { success: false, reason: 'PLAYER_DEAD' };
    return player.useConsumable(slotIndex);
  }

  public processEquip(playerId: string, slotIndex: number): { success: boolean; reason?: string } {
    const player = this.players.get(playerId);
    if (!player) return { success: false, reason: 'PLAYER_NOT_FOUND' };
    if (!player.isAlive()) return { success: false, reason: 'PLAYER_DEAD' };
    return player.equipItem(slotIndex);
  }

  public processQuestAction(
    playerId: string,
    questId: string,
    npcId: string,
    action: string = 'dialogue_next'
  ): QuestActionResult {
    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, reason: 'PLAYER_NOT_FOUND', message: 'Jogador não encontrado na simulação.' };
    }

    if (!player.isAlive()) {
      return { success: false, reason: 'PLAYER_DEAD', message: 'Personagem derrotado não pode interagir.' };
    }

    // 1. Validação física autoritativa da proximidade do NPC
    const spawns = NPC_SPAWNS[npcId];
    if (!spawns) {
      return { success: false, reason: 'INVALID_NPC', message: 'NPC inexistente.' };
    }

    const minDist = Math.min(
      ...spawns.map(pos => calculateDistance(player.x, player.y, pos.x, pos.y))
    );
    if (minDist > SIMULATION_CONSTANTS.INTERACT_MAX_DISTANCE + 24) {
      return {
        success: false,
        reason: 'TOO_FAR_FROM_NPC',
        message: 'Você está muito distante do NPC para interagir.'
      };
    }

    // 2. Máquina de Estados de Missões Autoritativas
    if (questId === 'starter_tutorial') {
      const quest = player.getQuest('starter_tutorial');

      // Máquina de Estados da Missão do Tutorial
      if (quest.step === 0) {
        if (npcId === 'npc_elder') {
          quest.step = 1;
          player.setQuest('starter_tutorial', quest);
          return {
            success: true,
            quest,
            message: 'O Ancião Aldor orientou você a procurar o Ferreiro Brann na Praça.'
          };
        } else {
          return {
            success: false,
            quest,
            reason: 'QUEST_STEP_MISMATCH',
            message: 'Fale primeiro com o Ancião Aldor na entrada da vila.'
          };
        }
      }

      if (quest.step === 1) {
        if (npcId === 'npc_blacksmith') {
          // Idempotência estrita: checa se já recebeu os materiais
          if (quest.claimedRewards.includes('blacksmith_materials')) {
            quest.step = 2;
            player.setQuest('starter_tutorial', quest);
            return {
              success: true,
              quest,
              message: 'Você já recebeu os materiais do Ferreiro Brann.'
            };
          }

          // Concede 4 Madeiras e 4 Minérios de Ferro autoritativamente com proteção contra perda
          const woodRes = this.deliverItemOrPend(player, 'wood_log', 4, 'starter_tutorial');
          const ironRes = this.deliverItemOrPend(player, 'iron_ore', 4, 'starter_tutorial');
          quest.claimedRewards.push('blacksmith_materials');
          quest.step = 2;
          player.setQuest('starter_tutorial', quest);

          const hasPended = woodRes.pendedQuantity > 0 || ironRes.pendedQuantity > 0;
          const msg = hasPended
            ? 'Ferreiro Brann lhe entregou 4 Madeiras e 4 Minérios de Ferro! (Itens excedentes foram guardados em Recompensas Pendentes).'
            : 'Ferreiro Brann lhe entregou 4 Madeiras e 4 Minérios de Ferro!';

          return {
            success: true,
            quest,
            rewardsAwarded: {
              items: [
                { itemId: 'wood_log', quantity: 4 },
                { itemId: 'iron_ore', quantity: 4 }
              ]
            },
            message: msg
          };
        } else if (npcId === 'npc_elder') {
          return {
            success: true,
            quest,
            message: 'O Ferreiro Brann está aguardando você junto à bigorna na Praça Central.'
          };
        }
      }

      if (quest.step === 2) {
        if (npcId === 'npc_elder') {
          // Idempotência estrita: checa se já recebeu a bênção
          if (quest.claimedRewards.includes('elder_blessing')) {
            quest.step = 3;
            quest.completed = true;
            player.setQuest('starter_tutorial', quest);
            return {
              success: true,
              quest,
              message: 'Você já recebeu a bênção do Ancião Aldor.'
            };
          }

          // Concede 50 Gold e 30 XP autoritativamente
          player.addGold(50);
          const xpRes = player.addXp(30);
          if (xpRes.leveledUp) {
            this.combatEvents.push({
              type: 'PLAYER_LEVEL_UP',
              attackerId: player.id,
              targetId: player.id,
              newLevel: xpRes.newLevel,
              timestamp: Date.now()
            });
          }

          quest.claimedRewards.push('elder_blessing');
          quest.step = 3;
          quest.completed = true;
          player.setQuest('starter_tutorial', quest);

          return {
            success: true,
            quest,
            rewardsAwarded: {
              gold: 50,
              xp: 30
            },
            message: 'Tutorial concluído com sucesso! +50 Gold e +30 XP concedidos!'
          };
        } else if (npcId === 'npc_blacksmith') {
          return {
            success: true,
            quest,
            message: 'Volte ao Ancião Aldor para receber sua bênção final!'
          };
        }
      }

      // Se já estiver no step 3 ou completo
      if (quest.step >= 3 || quest.completed) {
        quest.completed = true;
        quest.step = 3;
        player.setQuest('starter_tutorial', quest);
        return {
          success: true,
          quest,
          message: 'Você já concluiu o tutorial da vila!'
        };
      }

      return {
        success: false,
        quest,
        reason: 'INVALID_STATE',
        message: 'Estado inválido de missão.'
      };
    }

    // 3. Missão Secundária de Caça: Ameaças nas Planícies (Guarda do Portão)
    if (questId === 'quest_plains_threat') {
      if (npcId !== 'npc_guard') {
        return { success: false, reason: 'INVALID_NPC', message: 'Fale com o Guarda do Portão para esta missão.' };
      }

      const quest = player.getQuest('quest_plains_threat');

      if (quest.step === 0) {
        quest.step = 1;
        player.setQuest('quest_plains_threat', quest);
        return {
          success: true,
          quest,
          message: 'Missão aceita! Elimine 3 slimes nas planícies fora da vila para proteger a guarnição.'
        };
      }

      if (quest.step === 1) {
        const kills = quest.claimedRewards.filter(r => r.startsWith('slime_kill_')).length;
        if (kills < 3) {
          return {
            success: false,
            quest,
            reason: 'QUEST_OBJECTIVES_INCOMPLETE',
            message: `Você derrotou apenas ${kills}/3 slimes. Continue combatendo nas planícies!`
          };
        }
        // Se já eliminou 3 slimes, avança para step 2
        quest.step = 2;
      }

      if (quest.step === 2) {
        // Idempotência estrita: impede concessão repetida
        if (quest.claimedRewards.includes('guard_reward')) {
          quest.step = 3;
          quest.completed = true;
          player.setQuest('quest_plains_threat', quest);
          return {
            success: true,
            quest,
            message: 'Você já recebeu a recompensa do Guarda do Portão.'
          };
        }

        // Concede 60 Gold, 40 XP e 2 Poções Menores de Vida
        player.addGold(60);
        const xpRes = player.addXp(40);
        if (xpRes.leveledUp) {
          this.combatEvents.push({
            type: 'PLAYER_LEVEL_UP',
            attackerId: player.id,
            targetId: player.id,
            newLevel: xpRes.newLevel,
            timestamp: Date.now()
          });
        }
        const potDeliv = this.deliverItemOrPend(player, 'potion_hp_minor', 2, 'quest_plains_threat');

        quest.claimedRewards.push('guard_reward');
        quest.step = 3;
        quest.completed = true;
        player.setQuest('quest_plains_threat', quest);

        const hasPended = potDeliv.pendedQuantity > 0;
        const msg = hasPended
          ? 'Missão Ameaças nas Planícies concluída com sucesso! +60 Gold, +40 XP e 2 Poções Menores de Vida concedidos (itens guardados em Recompensas Pendentes por falta de espaço no inventário)!'
          : 'Missão Ameaças nas Planícies concluída com sucesso! +60 Gold, +40 XP e 2 Poções Menores de Vida concedidos!';

        return {
          success: true,
          quest,
          rewardsAwarded: {
            gold: 60,
            xp: 40,
            items: [{ itemId: 'potion_hp_minor', quantity: 2 }]
          },
          message: msg
        };
      }

      if (quest.step >= 3 || quest.completed) {
        quest.completed = true;
        quest.step = 3;
        player.setQuest('quest_plains_threat', quest);
        return {
          success: true,
          quest,
          message: 'Você já concluiu a missão Ameaças nas Planícies!'
        };
      }
    }

    // 4. Missão Secundária de Coleta: Suprimentos para a Taverna (Taverneiro Tobin)
    if (questId === 'quest_tavern_supplies') {
      if (npcId !== 'npc_tavern') {
        return { success: false, reason: 'INVALID_NPC', message: 'Fale com o Taverneiro Tobin para esta missão.' };
      }

      const quest = player.getQuest('quest_tavern_supplies');

      if (quest.step === 0) {
        quest.step = 1;
        player.setQuest('quest_tavern_supplies', quest);
        return {
          success: true,
          quest,
          message: 'Missão aceita! Colete 3 Ervas Verdes nos arbustos da vila ou planícies e traga para a taverna.'
        };
      }

      if (quest.step === 1) {
        const herbCount = getItemCount(player.inventory, 'herb_green');
        if (herbCount < 3) {
          return {
            success: false,
            quest,
            reason: 'INSUFFICIENT_ITEMS',
            message: `Você possui apenas ${herbCount}/3 Ervas Verdes. Reúna 3 para completar!`
          };
        }

        // Idempotência estrita: impede entrega repetida
        if (quest.claimedRewards.includes('tavern_supplies_reward')) {
          quest.step = 2;
          quest.completed = true;
          player.setQuest('quest_tavern_supplies', quest);
          return {
            success: true,
            quest,
            message: 'Você já entregou os suprimentos para o Taverneiro Tobin.'
          };
        }

        // Consumo atômico das 3 Ervas Verdes do inventário
        const removed = removeItemById(player.inventory, 'herb_green', 3);
        if (!removed) {
          return {
            success: false,
            quest,
            reason: 'INSUFFICIENT_ITEMS',
            message: 'Falha ao remover as Ervas Verdes do inventário.'
          };
        }

        // Concede 50 Gold, 35 XP e 1 Poção de Vida Reforçada (potion_hp_medium)
        player.addGold(50);
        const xpRes = player.addXp(35);
        if (xpRes.leveledUp) {
          this.combatEvents.push({
            type: 'PLAYER_LEVEL_UP',
            attackerId: player.id,
            targetId: player.id,
            newLevel: xpRes.newLevel,
            timestamp: Date.now()
          });
        }
        const potDeliv = this.deliverItemOrPend(player, 'potion_hp_medium', 1, 'quest_tavern_supplies');

        quest.claimedRewards.push('tavern_supplies_reward');
        quest.step = 2;
        quest.completed = true;
        player.setQuest('quest_tavern_supplies', quest);

        const hasPended = potDeliv.pendedQuantity > 0;
        const msg = hasPended
          ? '3 Ervas Verdes entregues! +50 Gold, +35 XP e 1 Poção de Vida Reforçada concedidos (poção guardada em Recompensas Pendentes por falta de espaço no inventário)!'
          : '3 Ervas Verdes entregues! +50 Gold, +35 XP e 1 Poção de Vida Reforçada concedidos!';

        return {
          success: true,
          quest,
          rewardsAwarded: {
            gold: 50,
            xp: 35,
            items: [{ itemId: 'potion_hp_medium', quantity: 1 }]
          },
          message: msg
        };
      }

      if (quest.step >= 2 || quest.completed) {
        quest.completed = true;
        quest.step = 2;
        player.setQuest('quest_tavern_supplies', quest);
        return {
          success: true,
          quest,
          message: 'Você já concluiu a missão Suprimentos para a Taverna!'
        };
      }
    }

    return {
      success: false,
      reason: 'UNKNOWN_QUEST',
      message: 'Missão não reconhecida pelo servidor.'
    };
  }

  public spawnGroundItem(itemId: string, quantity: number, x: number, y: number): ServerGroundItem {
    const id = randomUUID();
    const offsetX = Math.random() * 12 - 6;
    const offsetY = Math.random() * 12 - 6;
    const groundItem = new ServerGroundItem(id, itemId, quantity, x + offsetX, y + offsetY);
    this.groundItems.set(id, groundItem);
    return groundItem;
  }

  public getSnapshot(filterMapKey: string = 'map_prototype') {
    let monsterList = Array.from(this.monsters.values());
    let nodeList = Array.from(this.gatheringNodes.values());

    if (filterMapKey === 'map_starter_village' || filterMapKey === 'starter_village') {
      monsterList = monsterList.filter(m => m.id.startsWith('mob_village_'));
      nodeList = nodeList.filter(n => n.id.startsWith('node_village_'));
    } else if (filterMapKey !== 'all') {
      // Preserva exatamente os 6 monstros e 9 nós canônicos do mapa de produção/protótipo
      monsterList = monsterList.filter(m => !m.id.startsWith('mob_village_'));
      nodeList = nodeList.filter(n => !n.id.startsWith('node_village_'));
    }

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
      monsters: monsterList.map(m => ({
        id: m.id,
        type: m.type,
        x: Math.round(m.x),
        y: Math.round(m.y),
        hp: m.hp,
        maxHp: m.maxHp,
        state: m.state
      })),
      gatheringNodes: nodeList.map(n => ({
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
