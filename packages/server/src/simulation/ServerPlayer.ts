import {
  CharacterClass,
  Direction,
  PlayerData,
  InventorySlot,
  EquipmentSlot,
  ITEM_DEFINITIONS,
  CLASS_COMBAT_CONFIG,
  calculateTotalPlayerAttributes,
  evaluateLevelProgression,
  addItemToInventory,
  removeItemFromSlot,
  calculateDistance,
  QuestProgress,
  PendingRewardItem
} from '@noobrpg/shared';
import { SIMULATION_CONSTANTS } from './SimulationConstants.js';
import { MapCollisionGrid } from './MapCollisionGrid.js';

export class ServerPlayer {
  public id: string;
  public accountId: string;
  public name: string;
  public characterClass: CharacterClass;
  public level: number;
  public currentXp: number;
  public gold: number;
  public meritPoints: number;
  public x: number;
  public y: number;
  public hp: number;
  public mp: number;
  public inventory: (InventorySlot | null)[];
  public equipped: { weapon: string | null; armor: string | null; accessory: string | null };
  public version: number;
  public mapKey: string = 'map_prototype';
  public quests: Map<string, QuestProgress> = new Map();
  public pendingRewards: PendingRewardItem[] = [];
  public activeTitle: string | null = null;

  public lastMoveTimestamp: number = Date.now();
  public lastAttackTimestamp: number = 0;
  public lastSkill1Timestamp: number = 0;
  public isDead: boolean = false;
  public respawnTimestamp: number = 0;

  constructor(data: PlayerData & { accountId: string; version: number }) {
    this.id = data.id;
    this.accountId = data.accountId;
    this.name = data.name;
    this.characterClass = data.characterClass;
    this.level = data.level;
    this.currentXp = data.currentXp;
    this.gold = data.gold;
    this.meritPoints = data.meritPoints;
    this.x = data.position.x;
    this.y = data.position.y;
    this.hp = data.attributes.currentHp;
    this.mp = data.attributes.currentMp;
    this.inventory = data.inventory.map(s => (s ? { ...s } : null));
    this.equipped = { ...data.equipped };
    this.version = data.version || 1;
    if ((data as any).mapKey) {
      this.mapKey = (data as any).mapKey;
    }
    if (data.quests) {
      for (const [qId, qProgress] of Object.entries(data.quests)) {
        this.quests.set(qId, {
          questId: qProgress.questId,
          step: qProgress.step,
          completed: qProgress.completed,
          claimedRewards: [...(qProgress.claimedRewards || [])]
        });
      }
    }
    if (data.pendingRewards) {
      this.pendingRewards = data.pendingRewards.map(p => ({ ...p }));
    }
    if (data.activeTitle !== undefined) {
      this.activeTitle = data.activeTitle || null;
    }
    this.lastMoveTimestamp = Date.now();
  }

  public addPendingReward(itemId: string, quantity: number, source: string): PendingRewardItem {
    const item: PendingRewardItem = {
      id: `pr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      itemId,
      quantity,
      source,
      createdAt: new Date().toISOString()
    };
    this.pendingRewards.push(item);
    return item;
  }

  public getQuest(questId: string): QuestProgress {
    let q = this.quests.get(questId);
    if (!q) {
      q = {
        questId,
        step: 0,
        completed: false,
        claimedRewards: []
      };
      this.quests.set(questId, q);
    }
    return q;
  }

  public setQuest(questId: string, progress: QuestProgress): void {
    this.quests.set(questId, {
      ...progress,
      claimedRewards: [...(progress.claimedRewards || [])]
    });
  }

  public getAllQuests(): Record<string, QuestProgress> {
    const result: Record<string, QuestProgress> = {};
    for (const [id, q] of this.quests.entries()) {
      result[id] = {
        ...q,
        claimedRewards: [...q.claimedRewards]
      };
    }
    return result;
  }

  public isAlive(): boolean {
    return !this.isDead && this.hp > 0;
  }

  public getAttributes() {
    return calculateTotalPlayerAttributes(this.characterClass, this.level, this.equipped);
  }

  public getSpeed(): number {
    return this.getAttributes().speed;
  }

  public getAttack(): number {
    return this.getAttributes().attack;
  }

  public getDefense(): number {
    return this.getAttributes().defense;
  }

  public getMaxHp(): number {
    return this.getAttributes().maxHp;
  }

  public get currentHp(): number {
    return this.hp;
  }

  public set currentHp(val: number) {
    this.hp = val;
  }

  public getMaxMp(): number {
    return this.getAttributes().maxMp;
  }

  public get currentMp(): number {
    return this.mp;
  }

  public set currentMp(val: number) {
    this.mp = val;
  }

  public getCombatConfig() {
    return CLASS_COMBAT_CONFIG[this.characterClass];
  }

  /**
   * Validação de Movimento com Anti-Speedhack e Detecção de Colisão
   */
  public validateAndApplyMovement(
    newX: number,
    newY: number,
    clientDt: number = 50
  ): { success: boolean; x: number; y: number; reason?: string } {
    if (!this.isAlive()) {
      return { success: false, x: this.x, y: this.y, reason: 'PLAYER_DEAD' };
    }

    const now = Date.now();
    const serverElapsedMs = now - this.lastMoveTimestamp;
    const effectiveDtMs = Math.max(10, Math.min(1000, serverElapsedMs));
    const dtSeconds = effectiveDtMs / 1000;

    const dx = newX - this.x;
    const dy = newY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Se parado ou quase parado
    if (distance < 0.05) {
      this.lastMoveTimestamp = now;
      return { success: true, x: this.x, y: this.y };
    }

    // 1. Colisão no Mapa (Paredes, Lago e Obstáculos consistentes)
    if (!MapCollisionGrid.isWalkable(newX, newY, 5, this.mapKey)) {
      this.lastMoveTimestamp = now;
      return {
        success: false,
        x: this.x,
        y: this.y,
        reason: 'COLLISION_OBSTACLE'
      };
    }

    // 2. Anti-Speedhack com Tolerância Elástica para Rede/Jitter
    const maxSpeed = this.getSpeed();
    const maxAllowedDist = maxSpeed * dtSeconds * SIMULATION_CONSTANTS.SPEED_TOLERANCE_FACTOR + 24;

    if (distance > maxAllowedDist) {
      // Rejeita categoricamente se for salto grotesco / teleporte
      if (distance > maxAllowedDist + 60) {
        this.lastMoveTimestamp = now;
        return {
          success: false,
          x: this.x,
          y: this.y,
          reason: 'SPEEDHACK_EXCEEDED'
        };
      }

      // Clampa o movimento para a distância máxima autorizada nessa direção (previne rubberband catastrófico)
      const ratio = maxAllowedDist / distance;
      const clampedX = Math.round(this.x + dx * ratio);
      const clampedY = Math.round(this.y + dy * ratio);

      if (MapCollisionGrid.isWalkable(clampedX, clampedY, 5, this.mapKey)) {
        this.x = clampedX;
        this.y = clampedY;
        this.lastMoveTimestamp = now;
        return { success: true, x: this.x, y: this.y };
      } else {
        this.lastMoveTimestamp = now;
        return { success: false, x: this.x, y: this.y, reason: 'COLLISION_OBSTACLE' };
      }
    }

    this.x = newX;
    this.y = newY;
    this.lastMoveTimestamp = now;

    return { success: true, x: this.x, y: this.y };
  }

  /**
   * Validação de Ataque Básico
   */
  public canAttack(currentTime: number): { can: boolean; reason?: string } {
    if (!this.isAlive()) return { can: false, reason: 'PLAYER_DEAD' };

    const cooldown = this.getCombatConfig().attackCooldownMs;
    if (currentTime - this.lastAttackTimestamp < cooldown) {
      return { can: false, reason: 'COOLDOWN_ACTIVE' };
    }

    return { can: true };
  }

  public registerAttack(currentTime: number): void {
    this.lastAttackTimestamp = currentTime;
  }

  /**
   * Validação de Habilidade 1
   */
  public canUseSkill1(currentTime: number): { can: boolean; reason?: string } {
    if (!this.isAlive()) return { can: false, reason: 'PLAYER_DEAD' };

    const config = this.getCombatConfig();
    if (currentTime - this.lastSkill1Timestamp < config.skill1CooldownMs) {
      return { can: false, reason: 'COOLDOWN_ACTIVE' };
    }

    if (this.mp < config.skill1CostMp) {
      return { can: false, reason: 'INSUFFICIENT_MP' };
    }

    return { can: true };
  }

  public registerSkill1(currentTime: number): void {
    const config = this.getCombatConfig();
    this.mp = Math.max(0, this.mp - config.skill1CostMp);
    this.lastSkill1Timestamp = currentTime;
  }

  public takeDamage(damage: number): { died: boolean; currentHp: number } {
    if (this.isDead) return { died: false, currentHp: 0 };

    this.hp = Math.max(0, this.hp - Math.floor(damage));
    if (this.hp <= 0) {
      this.isDead = true;
      this.respawnTimestamp = Date.now() + 5000; // 5s para respawn
      return { died: true, currentHp: 0 };
    }

    return { died: false, currentHp: this.hp };
  }

  public respawn(spawnX: number = 180, spawnY: number = 160): void {
    this.isDead = false;
    this.x = spawnX;
    this.y = spawnY;
    this.hp = this.getMaxHp();
    this.mp = this.getMaxMp();
  }

  public addXp(amount: number): { leveledUp: boolean; newLevel: number } {
    this.currentXp += Math.max(0, Math.floor(amount));
    const prog = evaluateLevelProgression(this.level, this.currentXp);
    const leveledUp = prog.didLevelUp;
    if (leveledUp) {
      this.level = prog.newLevel;
      // Cura total ao subir de nível
      this.hp = this.getMaxHp();
      this.mp = this.getMaxMp();
    }
    return { leveledUp, newLevel: this.level };
  }

  public addGold(amount: number): void {
    this.gold = Math.max(0, this.gold + Math.floor(amount));
  }

  public useConsumable(slotIndex: number): { success: boolean; reason?: string } {
    if (!this.isAlive()) return { success: false, reason: 'PLAYER_DEAD' };
    if (slotIndex < 0 || slotIndex >= this.inventory.length) {
      return { success: false, reason: 'INVALID_SLOT' };
    }

    const slot = this.inventory[slotIndex];
    if (!slot) return { success: false, reason: 'SLOT_EMPTY' };

    const def = ITEM_DEFINITIONS[slot.itemId];
    if (!def || !def.consumableEffect) {
      return { success: false, reason: 'NOT_A_CONSUMABLE' };
    }

    // Aplica cura
    if (def.consumableEffect.hpRestore) {
      this.hp = Math.min(this.getMaxHp(), this.hp + def.consumableEffect.hpRestore);
    }
    if (def.consumableEffect.mpRestore) {
      this.mp = Math.min(this.getMaxMp(), this.mp + def.consumableEffect.mpRestore);
    }

    // Remove 1 unidade do slot
    removeItemFromSlot(this.inventory, slotIndex, 1);
    return { success: true };
  }

  public equipItem(slotIndex: number): { success: boolean; reason?: string } {
    if (!this.isAlive()) return { success: false, reason: 'PLAYER_DEAD' };
    if (slotIndex < 0 || slotIndex >= this.inventory.length) {
      return { success: false, reason: 'INVALID_SLOT' };
    }

    const slot = this.inventory[slotIndex];
    if (!slot) return { success: false, reason: 'SLOT_EMPTY' };

    const def = ITEM_DEFINITIONS[slot.itemId];
    if (!def || !def.equipSlot) {
      return { success: false, reason: 'NOT_EQUIPPABLE' };
    }

    if (def.requiredLevel && this.level < def.requiredLevel) {
      return { success: false, reason: 'LEVEL_TOO_LOW' };
    }

    if (def.requiredClass && this.characterClass !== def.requiredClass) {
      return { success: false, reason: 'CLASS_MISMATCH' };
    }

    const targetEquipSlot = def.equipSlot;
    const currentlyEquippedId =
      targetEquipSlot === EquipmentSlot.WEAPON
        ? this.equipped.weapon
        : targetEquipSlot === EquipmentSlot.ARMOR
        ? this.equipped.armor
        : this.equipped.accessory;

    // Remove o item do slot de inventário
    removeItemFromSlot(this.inventory, slotIndex, 1);

    // Se já havia item equipado, coloca de volta no slot
    if (currentlyEquippedId) {
      addItemToInventory(this.inventory, currentlyEquippedId, 1);
    }

    // Equipa o novo
    if (targetEquipSlot === EquipmentSlot.WEAPON) this.equipped.weapon = def.id;
    else if (targetEquipSlot === EquipmentSlot.ARMOR) this.equipped.armor = def.id;
    else if (targetEquipSlot === EquipmentSlot.ACCESSORY) this.equipped.accessory = def.id;

    return { success: true };
  }

  public toPlayerData(): PlayerData {
    return {
      id: this.id,
      name: this.name,
      characterClass: this.characterClass,
      level: this.level,
      currentXp: this.currentXp,
      gold: this.gold,
      meritPoints: this.meritPoints,
      attributes: {
        maxHp: this.getMaxHp(),
        currentHp: this.hp,
        maxMp: this.getMaxMp(),
        currentMp: this.mp,
        attack: this.getAttack(),
        defense: this.getDefense(),
        speed: this.getSpeed()
      },
      position: { x: Math.round(this.x), y: Math.round(this.y) },
      direction: Direction.DOWN,
      inventory: this.inventory.map(s => (s ? { ...s } : null)),
      equipped: { ...this.equipped },
      quests: this.getAllQuests(),
      pendingRewards: this.pendingRewards.map(p => ({ ...p })),
      activeTitle: this.activeTitle
    };
  }
}
