import { MonsterType, MonsterAIState, MonsterConfig, MONSTER_DEFINITIONS, calculateDistance, normalizeVector } from '@noobrpg/shared';
import type { ServerPlayer } from './ServerPlayer';

export interface MonsterDeathReward {
  died: boolean;
  killerPlayerId: string;
  xpReward: number;
  gold: number;
  drops: { itemId: string; quantity: number }[];
}

export class ServerMonster {
  public id: string;
  public type: MonsterType;
  public config: MonsterConfig;
  public x: number;
  public y: number;
  public spawnX: number;
  public spawnY: number;
  public hp: number;
  public maxHp: number;
  public state: MonsterAIState = MonsterAIState.IDLE_PATROL;

  private lastAttackTime: number = 0;
  private deathTime: number = 0;
  private patrolAngle: number = 0;

  constructor(id: string, type: MonsterType, x: number, y: number) {
    this.id = id;
    this.type = type;
    this.config = MONSTER_DEFINITIONS[type];
    this.x = x;
    this.y = y;
    this.spawnX = x;
    this.spawnY = y;
    this.hp = this.config.maxHp;
    this.maxHp = this.config.maxHp;
  }

  public isDead(): boolean {
    return this.state === MonsterAIState.DEAD;
  }

  public takeDamage(damage: number, attackerPlayerId: string): MonsterDeathReward | null {
    if (this.isDead()) {
      return null;
    }

    this.hp = Math.max(0, this.hp - Math.floor(damage));

    if (this.hp <= 0) {
      this.state = MonsterAIState.DEAD;
      this.deathTime = Date.now();

      // Rola Gold
      const gold = Math.floor(
        Math.random() * (this.config.goldRewardMax - this.config.goldRewardMin + 1) + this.config.goldRewardMin
      );

      // Rola Drops autoritativos
      const drops: { itemId: string; quantity: number }[] = [];
      for (const entry of this.config.lootTable) {
        if (Math.random() <= entry.chance) {
          const qty = Math.floor(Math.random() * (entry.maxAmount - entry.minAmount + 1)) + entry.minAmount;
          drops.push({ itemId: entry.itemId, quantity: qty });
        }
      }

      return {
        died: true,
        killerPlayerId: attackerPlayerId,
        xpReward: this.config.xpReward,
        gold,
        drops
      };
    }

    return {
      died: false,
      killerPlayerId: attackerPlayerId,
      xpReward: 0,
      gold: 0,
      drops: []
    };
  }

  public updateAI(currentTime: number, deltaMs: number, players: ServerPlayer[]): { playerDamaged?: { playerId: string; damage: number } } | null {
    // 1. Trata Respawn se estiver morto
    if (this.isDead()) {
      if (currentTime - this.deathTime >= this.config.respawnTimeMs) {
        this.hp = this.maxHp;
        this.x = this.spawnX;
        this.y = this.spawnY;
        this.state = MonsterAIState.IDLE_PATROL;
      }
      return null;
    }

    // 2. Busca jogador vivo mais próximo
    let nearestPlayer: ServerPlayer | null = null;
    let minDistance = Infinity;

    for (const player of players) {
      if (player.isAlive()) {
        const dist = calculateDistance(this.x, this.y, player.x, player.y);
        if (dist < minDistance) {
          minDistance = dist;
          nearestPlayer = player;
        }
      }
    }

    const dtSeconds = deltaMs / 1000;
    const speed = this.config.speed;

    // 3. Máquina de estados
    if (nearestPlayer && minDistance <= this.config.detectionRadius) {
      if (minDistance <= this.config.attackRange) {
        // Estado ATTACK
        this.state = MonsterAIState.ATTACK;
        if (currentTime - this.lastAttackTime >= this.config.attackCooldownMs) {
          this.lastAttackTime = currentTime;
          // Causa dano no jogador
          const rawDamage = Math.max(1, this.config.attack - Math.floor(nearestPlayer.getDefense() / 2));
          return { playerDamaged: { playerId: nearestPlayer.id, damage: rawDamage } };
        }
      } else {
        // Estado CHASE
        this.state = MonsterAIState.CHASE;
        const dir = normalizeVector(nearestPlayer.x - this.x, nearestPlayer.y - this.y);
        this.x += dir.x * speed * dtSeconds;
        this.y += dir.y * speed * dtSeconds;
      }
    } else {
      // Retorna para o spawn ou patrulha sutilmente
      const distToSpawn = calculateDistance(this.x, this.y, this.spawnX, this.spawnY);
      if (distToSpawn > 16) {
        this.state = MonsterAIState.RETURN;
        const dir = normalizeVector(this.spawnX - this.x, this.spawnY - this.y);
        this.x += dir.x * speed * dtSeconds;
        this.y += dir.y * speed * dtSeconds;
      } else {
        this.state = MonsterAIState.IDLE_PATROL;
      }
    }

    return null;
  }
}
