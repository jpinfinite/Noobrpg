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

  public targetX: number;
  public targetY: number;
  public currentHp: number;
  public maxHp: number;
  public isDead: boolean = false;

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
    this.sprite.setOrigin(0.5, 0.85);
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

  public updateState(state: PlayerSnapshotState): void {
    this.targetX = state.x;
    this.targetY = state.y;
    this.currentHp = state.hp;
    this.maxHp = state.maxHp;
    this.isDead = state.isDead;
    this.level = state.level;
    this.nameText.setText(`${state.name} [Lv.${state.level}]`);

    if (this.characterClass !== state.characterClass) {
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
      this.sprite.setTint(0x555555);
      return;
    } else {
      this.sprite.clearTint();
    }

    // Animação baseada no deslocamento interpolado
    const dx = this.x - prevX;
    const dy = this.y - prevY;
    const isMoving = Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1;
    const animPrefix = 'hero';

    if (isMoving) {
      if (Math.abs(dy) > Math.abs(dx)) {
        if (dy > 0) {
          this.sprite.setFlipX(false);
          this.sprite.anims.play(`${animPrefix}_walk_down`, true);
        } else {
          this.sprite.setFlipX(false);
          this.sprite.anims.play(`${animPrefix}_walk_up`, true);
        }
      } else {
        if (dx > 0) {
          this.sprite.setFlipX(false);
          this.sprite.anims.play(`${animPrefix}_walk_right`, true);
        } else {
          this.sprite.setFlipX(true);
          this.sprite.anims.play(`${animPrefix}_walk_right`, true);
        }
      }
    } else {
      this.sprite.anims.play(`${animPrefix}_idle_down`, true);
    }
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
