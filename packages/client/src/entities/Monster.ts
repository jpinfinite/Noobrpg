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
  public id: string;
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

  constructor(scene: Phaser.Scene, x: number, y: number, type: MonsterType = MonsterType.SLIME, id?: string) {
    const config = MONSTER_DEFINITIONS[type];
    const textureKey = type === MonsterType.SLIME ? 'mob_slime' : 'mob_goblin';

    super(scene, x, y, textureKey, 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.id = id || `mob_${type.toLowerCase()}_${Math.floor(x)}_${Math.floor(y)}`;
    this.monsterConfig = { ...config };
    this.currentHp = config.maxHp;
    this.spawnPoint = { x, y };
    this.patrolTarget = { x, y };

    this.hpBarGraphics = scene.add.graphics();
    this.initPhysics();

    // Inicializa animação de repouso conforme o tipo de monstro
    if (type === MonsterType.SLIME) {
      if (scene.anims?.exists('mob_slime_idle')) {
        this.anims.play('mob_slime_idle');
      }
    } else {
      if (scene.anims?.exists('mob_goblin_idle')) {
        this.anims.play('mob_goblin_idle');
      }
    }
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
      this.playWalkAnimation();
    } else {
      this.setVelocity(0, 0);
      this.playIdleAnimation();
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
      this.playAttackAnimation();
      return;
    }

    // Move-se em direção ao jogador
    const dir = normalizeVector(player.x - this.x, player.y - this.y);
    this.setVelocity(dir.x * this.monsterConfig.speed, dir.y * this.monsterConfig.speed);
    this.setFlipX(dir.x < 0);
    this.playWalkAnimation();
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
    } else {
      this.playAttackAnimation();
    }
  }

  private executeAttackOnPlayer(player: Player): void {
    this.playAttackAnimation();

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
      this.playIdleAnimation();
      return;
    }

    const dir = normalizeVector(this.spawnPoint.x - this.x, this.spawnPoint.y - this.y);
    const returnSpeed = this.monsterConfig.speed * 1.2;
    this.setVelocity(dir.x * returnSpeed, dir.y * returnSpeed);
    this.setFlipX(dir.x < 0);
    this.playWalkAnimation();
  }

  private handleDeadState(delta: number): void {
    this.anims?.stop();
    this.respawnTimer -= delta;
    if (this.respawnTimer <= 0) {
      this.respawn();
    }
  }

  public playHitFeedback(attackerX?: number, attackerY?: number): void {
    if (!this.active || this.aiState === MonsterAIState.DEAD) return;

    // 1. Flash branco puro imediato (white hit flash)
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.active && this.aiState !== MonsterAIState.DEAD) {
        // 2. Transição para tom avermelhado de dano
        this.setTint(0xff5555);
        this.scene.time.delayedCall(80, () => {
          if (this.active && this.aiState !== MonsterAIState.DEAD) {
            this.clearTint();
          }
        });
      }
    });

    // 3. Efeito de faíscas de impacto
    if (this.scene.textures.exists('fx_impact_spark')) {
      const spark = this.scene.add.sprite(this.x, this.y - 4, 'fx_impact_spark');
      spark.setDepth(this.depth + 10);
      spark.setScale(1.1);
      this.scene.tweens.add({
        targets: spark,
        scale: 1.5,
        alpha: 0,
        duration: 130,
        onComplete: () => spark.destroy()
      });
    }

    // 4. Recuo visual curto (knockback estético sem alterar física autoritativa)
    if (attackerX !== undefined && attackerY !== undefined) {
      const dx = this.x - attackerX;
      const dy = this.y - attackerY;
      const len = Math.hypot(dx, dy) || 1;
      const recoilDist = 3.5;
      const offsetX = (dx / len) * recoilDist;
      const offsetY = (dy / len) * recoilDist;

      this.scene.tweens.add({
        targets: this,
        x: this.x + offsetX,
        y: this.y + offsetY,
        duration: 50,
        yoyo: true,
        ease: 'Quad.easeOut'
      });
    }
  }

  /**
   * Processa o dano recebido pelo monstro.
   * Garante que o XP e recompensas sejam concedidos estritamente uma única vez.
   */
  public takeDamage(amount: number, attackerX?: number, attackerY?: number): { isDead: boolean; xpReward: number; goldReward: number } {
    if (this.aiState === MonsterAIState.DEAD) {
      return { isDead: false, xpReward: 0, goldReward: 0 };
    }

    this.currentHp = Math.max(0, this.currentHp - amount);
    this.playHitFeedback(attackerX, attackerY);

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
      this.anims?.stop();

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
    this.clearTint();
    this.playIdleAnimation();
  }

  public playWalkAnimation(): void {
    const key = this.monsterConfig.type === MonsterType.SLIME ? 'mob_slime_walk' : 'mob_goblin_walk';
    if (this.anims && this.scene?.anims?.exists(key)) {
      this.anims.play(key, true);
    }
  }

  public playIdleAnimation(): void {
    const key = this.monsterConfig.type === MonsterType.SLIME ? 'mob_slime_idle' : 'mob_goblin_idle';
    if (this.anims && this.scene?.anims?.exists(key)) {
      this.anims.play(key, true);
    }
  }

  public playAttackAnimation(): void {
    if (this.monsterConfig.type === MonsterType.GOBLIN) {
      if (this.anims && this.scene?.anims?.exists('mob_goblin_attack')) {
        this.anims.play('mob_goblin_attack', true);
      }
    } else {
      this.setFrame(1);
      this.scene.time.delayedCall(200, () => {
        if (this.active && this.aiState !== MonsterAIState.DEAD) {
          this.playIdleAnimation();
        }
      });
    }
  }

  /**
   * Sincroniza estado a partir de snapshots/deltas do servidor multiplayer
   */
  public updateFromSnapshot(state: { x?: number; y?: number; hp?: number; maxHp?: number; isDead?: boolean; aiState?: MonsterAIState; state?: MonsterAIState }): void {
    const prevX = this.x;
    const prevY = this.y;

    if (state.x !== undefined) this.x = state.x;
    if (state.y !== undefined) this.y = state.y;
    if (state.hp !== undefined) this.currentHp = state.hp;
    if (state.maxHp !== undefined) this.monsterConfig.maxHp = state.maxHp;

    const resolvedState = state.aiState !== undefined ? state.aiState : state.state;
    if (resolvedState !== undefined) this.aiState = resolvedState;

    if (state.isDead !== undefined) {
      if (state.isDead) {
        this.aiState = MonsterAIState.DEAD;
        this.anims?.stop();
        this.setTint(0x555555);
        this.setVisible(false);
        this.hpBarGraphics.clear();
        return;
      } else if (!this.visible) {
        this.setVisible(true);
        this.clearTint();
        this.playIdleAnimation();
      }
    }

    if (this.aiState !== MonsterAIState.DEAD && this.visible) {
      const dx = this.x - prevX;
      const dy = this.y - prevY;
      const isMoving = Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1;
      if (isMoving) {
        this.setFlipX(dx < 0);
        this.playWalkAnimation();
      } else {
        this.playIdleAnimation();
      }
      this.renderHpBar();
    }
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
