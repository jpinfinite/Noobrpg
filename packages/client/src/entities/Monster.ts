import Phaser from 'phaser';
import {
  MonsterType,
  MonsterAIState,
  MonsterConfig,
  MONSTER_DEFINITIONS,
  Vector2D,
  calculateDistance,
  calculateDamage,
  normalizeVector
} from '@noobrpg/shared';
import { Player } from './Player.js';

export class Monster extends Phaser.Physics.Arcade.Sprite {
  public monsterConfig: MonsterConfig;
  public currentHp: number;
  public aiState: MonsterAIState = MonsterAIState.IDLE_PATROL;
  public spawnPoint: Vector2D;

  private isRewardClaimed: boolean = false;
  private lastAttackTime: number = 0;
  private respawnTimer: number = 0;
  private hpBarGraphics: Phaser.GameObjects.Graphics;
  private patrolTarget: Vector2D;
  private patrolTimer: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, type: MonsterType = MonsterType.SLIME) {
    const config = MONSTER_DEFINITIONS[type];
    const textureKey = type === MonsterType.SLIME ? 'mob_slime' : 'mob_goblin';

    super(scene, x, y, textureKey, 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.monsterConfig = { ...config };
    this.currentHp = config.maxHp;
    this.spawnPoint = { x, y };
    this.patrolTarget = { x, y };

    this.hpBarGraphics = scene.add.graphics();
    this.initPhysics();
  }

  private initPhysics(): void {
    this.setOrigin(0.5, 0.85);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);

    if (this.monsterConfig.type === MonsterType.SLIME) {
      body.setSize(12, 10);
      body.setOffset(2, 6);
    } else {
      body.setSize(12, 12);
      body.setOffset(2, 12);
    }
  }

  public updateAI(time: number, delta: number, player: Player): void {
    // Y-Sorting dinâmico com base na coordenada Y
    this.setDepth(this.y);

    if (this.aiState === MonsterAIState.DEAD) {
      this.handleDeadState(delta);
      this.hpBarGraphics.clear();
      return;
    }

    const distToPlayer = calculateDistance(this.x, this.y, player.x, player.y);
    const distToSpawn = calculateDistance(this.x, this.y, this.spawnPoint.x, this.spawnPoint.y);

    // Máquina de Estados da IA
    switch (this.aiState) {
      case MonsterAIState.IDLE_PATROL:
        this.handleIdlePatrolState(time, delta, distToPlayer);
        break;

      case MonsterAIState.CHASE:
        this.handleChaseState(player, distToPlayer, distToSpawn);
        break;

      case MonsterAIState.ATTACK:
        this.handleAttackState(time, player, distToPlayer);
        break;

      case MonsterAIState.RETURN:
        this.handleReturnState(distToSpawn);
        break;
    }

    this.renderHpBar();
  }

  private handleIdlePatrolState(time: number, delta: number, distToPlayer: number): void {
    // Transição para perseguição (CHASE) se o jogador estiver no raio de detecção
    if (distToPlayer <= this.monsterConfig.detectionRadius) {
      this.aiState = MonsterAIState.CHASE;
      return;
    }

    this.patrolTimer -= delta;
    if (this.patrolTimer <= 0) {
      // Sorteia novo ponto de patrulha a até 20px do spawn
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 20;
      this.patrolTarget = {
        x: this.spawnPoint.x + Math.cos(angle) * radius,
        y: this.spawnPoint.y + Math.sin(angle) * radius
      };
      this.patrolTimer = 2500 + Math.random() * 2000;
    }

    const distToTarget = calculateDistance(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y);
    if (distToTarget > 4) {
      const dir = normalizeVector(this.patrolTarget.x - this.x, this.patrolTarget.y - this.y);
      const patrolSpeed = this.monsterConfig.speed * 0.5;
      this.setVelocity(dir.x * patrolSpeed, dir.y * patrolSpeed);
      this.setFlipX(dir.x < 0);
    } else {
      this.setVelocity(0, 0);
    }
  }

  private handleChaseState(player: Player, distToPlayer: number, distToSpawn: number): void {
    // Se o jogador fugir além de 1.6x o raio de detecção ou o monstro for puxado muito longe (leash limit)
    const maxLeashDistance = this.monsterConfig.detectionRadius * 1.8;
    if (distToPlayer > this.monsterConfig.detectionRadius * 1.5 || distToSpawn > maxLeashDistance) {
      this.aiState = MonsterAIState.RETURN;
      return;
    }

    // Se alcançou o raio de ataque
    if (distToPlayer <= this.monsterConfig.attackRange) {
      this.setVelocity(0, 0);
      this.aiState = MonsterAIState.ATTACK;
      return;
    }

    // Move-se em direção ao jogador
    const dir = normalizeVector(player.x - this.x, player.y - this.y);
    this.setVelocity(dir.x * this.monsterConfig.speed, dir.y * this.monsterConfig.speed);
    this.setFlipX(dir.x < 0);
  }

  private handleAttackState(time: number, player: Player, distToPlayer: number): void {
    this.setVelocity(0, 0);

    // Se o jogador se afastar, volta a perseguir
    if (distToPlayer > this.monsterConfig.attackRange + 6) {
      this.aiState = MonsterAIState.CHASE;
      return;
    }

    // Verifica intervalo de ataque (cooldown)
    if (time - this.lastAttackTime >= this.monsterConfig.attackCooldownMs) {
      this.lastAttackTime = time;
      this.executeAttackOnPlayer(player);
    }
  }

  private executeAttackOnPlayer(player: Player): void {
    // Pequena animação/avanço visual de impacto
    this.setFrame(1);
    this.scene.time.delayedCall(200, () => {
      if (this.active) this.setFrame(0);
    });

    // Calcula dano determinístico no jogador
    const damage = calculateDamage(this.monsterConfig.attack, player.playerData.attributes.defense);
    player.takeDamage(damage, this);
  }

  private handleReturnState(distToSpawn: number): void {
    if (distToSpawn <= 6) {
      this.x = this.spawnPoint.x;
      this.y = this.spawnPoint.y;
      this.setVelocity(0, 0);
      // Recupera HP ao retornar com sucesso
      this.currentHp = this.monsterConfig.maxHp;
      this.aiState = MonsterAIState.IDLE_PATROL;
      return;
    }

    const dir = normalizeVector(this.spawnPoint.x - this.x, this.spawnPoint.y - this.y);
    const returnSpeed = this.monsterConfig.speed * 1.2;
    this.setVelocity(dir.x * returnSpeed, dir.y * returnSpeed);
    this.setFlipX(dir.x < 0);
  }

  private handleDeadState(delta: number): void {
    this.respawnTimer -= delta;
    if (this.respawnTimer <= 0) {
      this.respawn();
    }
  }

  /**
   * Processa o dano recebido pelo monstro.
   * Garante que o XP e recompensas sejam concedidos estritamente uma única vez.
   */
  public takeDamage(amount: number): { isDead: boolean; xpReward: number; goldReward: number } {
    if (this.aiState === MonsterAIState.DEAD) {
      return { isDead: false, xpReward: 0, goldReward: 0 };
    }

    this.currentHp = Math.max(0, this.currentHp - amount);

    // Feedback visual (flash branco/vermelho)
    this.setTint(0xff5555);
    this.scene.time.delayedCall(120, () => {
      if (this.active) this.clearTint();
    });

    // Se estiver em patrulha e for atingido, entra em perseguição imediatamente
    if (this.aiState === MonsterAIState.IDLE_PATROL || this.aiState === MonsterAIState.RETURN) {
      this.aiState = MonsterAIState.CHASE;
    }

    if (this.currentHp <= 0 && !this.isRewardClaimed) {
      this.isRewardClaimed = true;
      this.aiState = MonsterAIState.DEAD;
      this.respawnTimer = this.monsterConfig.respawnTimeMs;

      // Desativa física e esconde sprite temporariamente
      this.setVelocity(0, 0);
      (this.body as Phaser.Physics.Arcade.Body).enable = false;
      this.setVisible(false);

      const gold = Math.floor(
        Math.random() * (this.monsterConfig.goldRewardMax - this.monsterConfig.goldRewardMin + 1)
      ) + this.monsterConfig.goldRewardMin;

      return {
        isDead: true,
        xpReward: this.monsterConfig.xpReward,
        goldReward: gold
      };
    }

    return { isDead: false, xpReward: 0, goldReward: 0 };
  }

  /**
   * Reaparece a entidade de forma limpa sem vazamento de memória ou duplicação de instâncias
   */
  private respawn(): void {
    this.x = this.spawnPoint.x;
    this.y = this.spawnPoint.y;
    this.currentHp = this.monsterConfig.maxHp;
    this.isRewardClaimed = false;
    this.aiState = MonsterAIState.IDLE_PATROL;

    this.setVisible(true);
    (this.body as Phaser.Physics.Arcade.Body).enable = true;
    this.setVelocity(0, 0);
    this.setFrame(0);
    this.clearTint();
  }

  private renderHpBar(): void {
    this.hpBarGraphics.clear();
    if (!this.visible || this.currentHp <= 0) return;

    const barWidth = 16;
    const barHeight = 2;
    const barX = this.x - barWidth / 2;
    const barY = this.y - 20;

    // Fundo cinza/escuro da barra
    this.hpBarGraphics.fillStyle(0x1e293b, 0.8);
    this.hpBarGraphics.fillRect(barX, barY, barWidth, barHeight);

    // Vida proporcional (verde para saudável, amarela se baixa)
    const ratio = Math.max(0, this.currentHp / this.monsterConfig.maxHp);
    const color = ratio > 0.4 ? 0x22c55e : 0xeab308;
    this.hpBarGraphics.fillStyle(color, 1);
    this.hpBarGraphics.fillRect(barX, barY, barWidth * ratio, barHeight);
    this.hpBarGraphics.setDepth(this.depth + 1);
  }

  public destroy(fromScene?: boolean): void {
    this.hpBarGraphics.destroy();
    super.destroy(fromScene);
  }
}
