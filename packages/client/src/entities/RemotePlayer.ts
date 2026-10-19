import Phaser from 'phaser';
import { CharacterClass, Direction, PlayerSnapshotState } from '@noobrpg/shared';

export class RemotePlayer extends Phaser.GameObjects.Container {
  public readonly characterId: string;
  public characterClass: CharacterClass;
  public characterName: string;
  public level: number;

  private sprite: Phaser.GameObjects.Sprite;
  private nameText: Phaser.GameObjects.Text;
  private hpBarBackground: Phaser.GameObjects.Rectangle;
  private hpBarFill: Phaser.GameObjects.Rectangle;
  private chatBubbleContainer: Phaser.GameObjects.Container;
  private chatBubbleBg: Phaser.GameObjects.Rectangle;
  private chatBubbleText: Phaser.GameObjects.Text;
  private chatTimer: Phaser.Time.TimerEvent | null = null;
  private lastDirection: Direction = Direction.DOWN;

  public targetX: number;
  public targetY: number;
  public currentHp: number;
  public maxHp: number;
  public isDead: boolean = false;
  private isAttackingAnim: boolean = false;

  constructor(scene: Phaser.Scene, state: PlayerSnapshotState) {
    super(scene, state.x, state.y);

    this.characterId = state.id;
    this.characterName = state.name;
    this.characterClass = state.characterClass;
    this.level = state.level;
    this.targetX = state.x;
    this.targetY = state.y;
    this.currentHp = state.hp;
    this.maxHp = state.maxHp;
    this.isDead = state.isDead;

    const textureKey = RemotePlayer.getTextureKey(state.characterClass);

    // 1. Sprite do Personagem
    this.sprite = scene.add.sprite(0, 0, textureKey, 0);
    this.sprite.setOrigin(0.5, 1.0);
    this.add(this.sprite);

    // 2. Barra de Vida Flutuante (26px largura, 3px altura)
    this.hpBarBackground = scene.add.rectangle(0, -28, 26, 4, 0x1f2937);
    this.hpBarFill = scene.add.rectangle(-13, -28, 26, 4, 0x22c55e);
    this.hpBarFill.setOrigin(0, 0.5);
    this.add(this.hpBarBackground);
    this.add(this.hpBarFill);

    // 3. Nome do Jogador e Nível
    this.nameText = scene.add.text(0, -35, `${state.name} [Lv.${state.level}]`, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#67e8f9',
      stroke: '#000000',
      strokeThickness: 2
    });
    this.nameText.setOrigin(0.5);
    this.add(this.nameText);

    // 4. Balão de Fala de Chat
    this.chatBubbleContainer = scene.add.container(0, -52);
    this.chatBubbleBg = scene.add.rectangle(0, 0, 100, 18, 0x0f172a, 0.85);
    this.chatBubbleBg.setStrokeStyle(1, 0x38bdf8);
    this.chatBubbleText = scene.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#ffffff',
      wordWrap: { width: 90, useAdvancedWrap: true },
      align: 'center'
    });
    this.chatBubbleText.setOrigin(0.5);

    this.chatBubbleContainer.add(this.chatBubbleBg);
    this.chatBubbleContainer.add(this.chatBubbleText);
    this.chatBubbleContainer.setVisible(false);
    this.add(this.chatBubbleContainer);

    scene.add.existing(this);
    this.setDepth(this.y);
  }

  private static getTextureKey(c: CharacterClass): string {
    switch (c) {
      case CharacterClass.WARRIOR:
        return 'hero_warrior';
      case CharacterClass.RANGER:
        return 'hero_ranger';
      case CharacterClass.MAGE:
        return 'hero_mage';
      case CharacterClass.DRUID:
        return 'hero_druid';
      default:
        return 'hero_warrior';
    }
  }

  public updateState(state: Partial<PlayerSnapshotState>): void {
    if (state.x !== undefined) this.targetX = state.x;
    if (state.y !== undefined) this.targetY = state.y;
    if (state.hp !== undefined) this.currentHp = state.hp;
    if (state.maxHp !== undefined) this.maxHp = state.maxHp;
    if (state.isDead !== undefined) this.isDead = state.isDead;
    if (state.level !== undefined) {
      this.level = state.level;
      this.nameText.setText(`${this.characterName} [Lv.${this.level}]`);
    }
    if (state.name && state.name !== this.characterName) {
      this.characterName = state.name;
      this.nameText.setText(`${this.characterName} [Lv.${this.level}]`);
    }
    if (state.direction !== undefined) {
      this.lastDirection = state.direction;
    }
    if (state.characterClass && this.characterClass !== state.characterClass) {
      this.characterClass = state.characterClass;
      this.sprite.setTexture(RemotePlayer.getTextureKey(state.characterClass));
    }
  }

  public updateInterpolation(_time: number, _delta: number): void {
    // Interpolação Linear (LERP) suave em direção à posição autoritativa confirmada
    const lerpFactor = 0.22;
    const prevX = this.x;
    const prevY = this.y;

    this.x = Phaser.Math.Linear(this.x, this.targetX, lerpFactor);
    this.y = Phaser.Math.Linear(this.y, this.targetY, lerpFactor);

    this.setDepth(this.y);

    // Atualiza barra de HP
    const hpRatio = Math.max(0, Math.min(1, this.currentHp / (this.maxHp || 1)));
    this.hpBarFill.width = Math.round(26 * hpRatio);
    if (hpRatio < 0.25) {
      this.hpBarFill.fillColor = 0xef4444; // Vermelho
    } else if (hpRatio < 0.5) {
      this.hpBarFill.fillColor = 0xf59e0b; // Laranja
    } else {
      this.hpBarFill.fillColor = 0x22c55e; // Verde
    }

    // Controle visual de morte
    if (this.isDead) {
      const animPrefix = RemotePlayer.getTextureKey(this.characterClass);
      if (this.sprite.anims && this.scene.anims.exists(`${animPrefix}_death`)) {
        this.sprite.anims.play(`${animPrefix}_death`, true);
      } else {
        this.sprite.setTint(0x555555);
      }
      return;
    } else {
      this.sprite.clearTint();
    }

    // Se estiver executando animação de ataque, não sobrescreve com walk ou idle
    if (this.isAttackingAnim) return;

    // Animação baseada no deslocamento interpolado com prefixo da classe do jogador remoto
    const dx = this.x - prevX;
    const dy = this.y - prevY;
    const isMoving = Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1;
    const animPrefix = RemotePlayer.getTextureKey(this.characterClass);

    if (isMoving) {
      if (Math.abs(dy) > Math.abs(dx)) {
        if (dy > 0) {
          this.lastDirection = Direction.DOWN;
          this.sprite.setFlipX(false);
          this.sprite.anims.play(`${animPrefix}_walk_down`, true);
        } else {
          this.lastDirection = Direction.UP;
          this.sprite.setFlipX(false);
          this.sprite.anims.play(`${animPrefix}_walk_up`, true);
        }
      } else {
        if (dx > 0) {
          this.lastDirection = Direction.RIGHT;
          this.sprite.setFlipX(false);
          this.sprite.anims.play(`${animPrefix}_walk_right`, true);
        } else {
          this.lastDirection = Direction.LEFT;
          if (this.scene.anims.exists(`${animPrefix}_walk_left`)) {
            this.sprite.setFlipX(false);
            this.sprite.anims.play(`${animPrefix}_walk_left`, true);
          } else {
            this.sprite.setFlipX(true);
            this.sprite.anims.play(`${animPrefix}_walk_right`, true);
          }
        }
      }
    } else {
      switch (this.lastDirection) {
        case Direction.UP:
          this.sprite.setFlipX(false);
          this.sprite.anims.play(`${animPrefix}_idle_up`, true);
          break;
        case Direction.RIGHT:
          this.sprite.setFlipX(false);
          this.sprite.anims.play(`${animPrefix}_idle_right`, true);
          break;
        case Direction.LEFT:
          if (this.scene.anims.exists(`${animPrefix}_idle_left`)) {
            this.sprite.setFlipX(false);
            this.sprite.anims.play(`${animPrefix}_idle_left`, true);
          } else {
            this.sprite.setFlipX(true);
            this.sprite.anims.play(`${animPrefix}_idle_right`, true);
          }
          break;
        case Direction.DOWN:
        default:
          this.sprite.setFlipX(false);
          this.sprite.anims.play(`${animPrefix}_idle_down`, true);
          break;
      }
    }
  }

  /**
   * Executa a animação visual e projéteis/efeitos de ataque do jogador remoto.
   */
  public playAttackVisual(targetX?: number, targetY?: number, isSkill: boolean = false): void {
    if (this.isAttackingAnim) return;
    this.isAttackingAnim = true;

    if (targetX !== undefined && targetY !== undefined) {
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        this.lastDirection = dx > 0 ? Direction.RIGHT : Direction.LEFT;
      } else {
        this.lastDirection = dy > 0 ? Direction.DOWN : Direction.UP;
      }
    }

    const animPrefix = RemotePlayer.getTextureKey(this.characterClass);
    if (this.sprite.anims && this.scene.anims.exists(`${animPrefix}_attack`)) {
      this.sprite.setFlipX(this.lastDirection === Direction.LEFT);
      this.sprite.anims.play(`${animPrefix}_attack`, true);
    } else {
      let actionFrame = 1;
      if (this.lastDirection === Direction.UP) actionFrame = 5;
      else if (this.lastDirection === Direction.RIGHT || this.lastDirection === Direction.LEFT) actionFrame = 9;

      this.sprite.setFlipX(this.lastDirection === Direction.LEFT);
      this.sprite.anims?.stop();
      this.sprite.setFrame(actionFrame);
    }

    let dirOffsetX = 0;
    let dirOffsetY = 0;
    if (this.lastDirection === Direction.DOWN) dirOffsetY = 3;
    else if (this.lastDirection === Direction.UP) dirOffsetY = -3;
    else if (this.lastDirection === Direction.RIGHT) dirOffsetX = 3;
    else if (this.lastDirection === Direction.LEFT) dirOffsetX = -3;

    // FASE 1: Antecipação (Wind-up, 50ms)
    const originalSpriteX = this.sprite.x;
    const originalSpriteY = this.sprite.y;

    this.scene.tweens.add({
      targets: this.sprite,
      x: originalSpriteX - dirOffsetX * 0.5,
      y: originalSpriteY - dirOffsetY * 0.5,
      duration: 50,
      ease: 'Quad.easeOut',
      onComplete: () => {
        // FASE 2: Golpe e Spawn de Efeito (70ms)
        this.spawnRemoteAttackFx(targetX, targetY, isSkill);

        this.scene.tweens.add({
          targets: this.sprite,
          x: originalSpriteX + dirOffsetX * 1.3,
          y: originalSpriteY + dirOffsetY * 1.3,
          duration: 70,
          ease: 'Back.easeOut',
          onComplete: () => {
            // FASE 3: Recuperação (60ms)
            this.scene.tweens.add({
              targets: this.sprite,
              x: originalSpriteX,
              y: originalSpriteY,
              duration: 60,
              ease: 'Sine.easeOut',
              onComplete: () => {
                this.isAttackingAnim = false;
              }
            });
          }
        });
      }
    });
  }

  private spawnRemoteAttackFx(targetX?: number, targetY?: number, isSkill: boolean = false): void {
    const startX = this.x;
    const startY = this.y - 4;
    let offsetX = 0;
    let offsetY = 14;
    if (this.lastDirection === Direction.UP) offsetY = -14;
    else if (this.lastDirection === Direction.RIGHT) { offsetX = 14; offsetY = 0; }
    else if (this.lastDirection === Direction.LEFT) { offsetX = -14; offsetY = 0; }

    if (this.characterClass === CharacterClass.WARRIOR) {
      const fx = this.scene.add.sprite(startX + offsetX, startY + offsetY, 'fx_slash');
      fx.setDepth(this.depth + 5);
      let angle = 0;
      if (this.lastDirection === Direction.DOWN) angle = 90;
      else if (this.lastDirection === Direction.UP) angle = -90;
      else if (this.lastDirection === Direction.LEFT) angle = 180;
      fx.setAngle(angle);

      if (isSkill) {
        fx.setScale(1.4);
        fx.setTint(0xfacc15);
      }
      this.scene.tweens.add({
        targets: fx,
        scaleX: isSkill ? 1.8 : 1.3,
        scaleY: isSkill ? 1.8 : 1.3,
        alpha: 0,
        duration: 130,
        onComplete: () => fx.destroy()
      });
    } else if (this.characterClass === CharacterClass.RANGER) {
      const destX = targetX !== undefined ? targetX : startX + offsetX * 3;
      const destY = targetY !== undefined ? targetY : startY + offsetY * 3;
      const angleRad = Phaser.Math.Angle.Between(startX, startY, destX, destY);

      const arrow = this.scene.add.sprite(startX, startY, 'fx_arrow');
      arrow.setRotation(angleRad);
      arrow.setDepth(this.depth + 5);
      if (isSkill) arrow.setTint(0xfde047);

      const distance = Phaser.Math.Distance.Between(startX, startY, destX, destY);
      const flightDuration = Math.max(80, Math.min(200, (distance / 420) * 1000));

      this.scene.tweens.add({
        targets: arrow,
        x: destX,
        y: destY,
        duration: flightDuration,
        ease: 'Linear',
        onComplete: () => arrow.destroy()
      });
    } else if (this.characterClass === CharacterClass.MAGE) {
      const destX = targetX !== undefined ? targetX : startX + offsetX * 3;
      const destY = targetY !== undefined ? targetY : startY + offsetY * 3;

      const orb = this.scene.add.sprite(startX, startY, 'fx_magic_orb');
      orb.setDepth(this.depth + 5);
      orb.setScale(isSkill ? 1.4 : 1.0);

      const distance = Phaser.Math.Distance.Between(startX, startY, destX, destY);
      const flightDuration = Math.max(90, Math.min(220, (distance / 340) * 1000));

      this.scene.tweens.add({
        targets: orb,
        x: destX,
        y: destY,
        duration: flightDuration,
        ease: 'Quad.easeIn',
        onComplete: () => {
          orb.destroy();
          const burst = this.scene.add.sprite(destX, destY, 'fx_magic_orb');
          burst.setDepth(this.depth + 6);
          burst.setScale(1.1);
          this.scene.tweens.add({
            targets: burst,
            scale: isSkill ? 2.2 : 1.7,
            alpha: 0,
            duration: 140,
            onComplete: () => burst.destroy()
          });
        }
      });
    } else if (this.characterClass === CharacterClass.DRUID) {
      if (isSkill) {
        const aura = this.scene.add.sprite(this.x, this.y - 6, 'fx_heal_aura');
        aura.setDepth(this.depth + 5);
        this.scene.tweens.add({
          targets: aura,
          y: this.y - 22,
          scale: 1.5,
          alpha: 0,
          duration: 380,
          ease: 'Sine.easeOut',
          onComplete: () => aura.destroy()
        });
      } else {
        const destX = targetX !== undefined ? targetX : startX + offsetX * 3;
        const destY = targetY !== undefined ? targetY : startY + offsetY * 3;
        const natureProj = this.scene.add.sprite(startX, startY, 'fx_nature_burst');
        natureProj.setDepth(this.depth + 5);
        const distance = Phaser.Math.Distance.Between(startX, startY, destX, destY);
        const flightDuration = Math.max(90, Math.min(220, (distance / 350) * 1000));
        this.scene.tweens.add({
          targets: natureProj,
          x: destX,
          y: destY,
          rotation: Math.PI * 4,
          duration: flightDuration,
          ease: 'Linear',
          onComplete: () => {
            natureProj.destroy();
            const leaves = this.scene.add.sprite(destX, destY, 'fx_nature_burst');
            leaves.setDepth(this.depth + 6);
            this.scene.tweens.add({
              targets: leaves,
              scale: 1.6,
              alpha: 0,
              duration: 130,
              onComplete: () => leaves.destroy()
            });
          }
        });
      }
    }
  }

  public playHitFeedback(): void {
    if (this.isDead) return;
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (!this.isDead) {
        this.sprite.setTint(0xff5555);
        this.scene.time.delayedCall(80, () => {
          if (!this.isDead) this.sprite.clearTint();
        });
      }
    });
  }

  public showChatBubble(message: string): void {
    if (this.chatTimer) {
      this.chatTimer.remove();
      this.chatTimer = null;
    }

    this.chatBubbleText.setText(message);
    const textBounds = this.chatBubbleText.getBounds();
    const paddingX = 12;
    const paddingY = 8;
    this.chatBubbleBg.setSize(Math.max(60, textBounds.width + paddingX), Math.max(16, textBounds.height + paddingY));

    this.chatBubbleContainer.setAlpha(1);
    this.chatBubbleContainer.setVisible(true);

    this.chatTimer = this.scene.time.delayedCall(4000, () => {
      this.scene.tweens.add({
        targets: this.chatBubbleContainer,
        alpha: 0,
        duration: 400,
        onComplete: () => {
          this.chatBubbleContainer.setVisible(false);
        }
      });
    });
  }
}
