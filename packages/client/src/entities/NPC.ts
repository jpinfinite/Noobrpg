import Phaser from 'phaser';
import { calculateDistance } from '@noobrpg/shared';
import { Player } from './Player.js';

export interface NPCConfig {
  id: string;
  name: string;
  role: string;
  textureKey: string;
  nameColor?: string;
  interactRadius?: number;
}

export class NPC extends Phaser.Physics.Arcade.Sprite {
  public readonly npcId: string;
  public readonly npcName: string;
  public readonly role: string;

  private interactRadius: number;
  private nameText: Phaser.GameObjects.Text;
  private roleText: Phaser.GameObjects.Text;
  private promptContainer: Phaser.GameObjects.Container;
  private promptBg: Phaser.GameObjects.Graphics;
  private promptText: Phaser.GameObjects.Text;
  private animTimer: number = 0;
  private isNear: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number, config: NPCConfig) {
    super(scene, x, y, config.textureKey, 0);

    this.npcId = config.id;
    this.npcName = config.name;
    this.role = config.role;
    this.interactRadius = config.interactRadius ?? 36;

    // Adiciona ao mundo e configura física estática de colisão
    scene.add.existing(this);
    scene.physics.add.existing(this, true);

    this.setOrigin(0.5, 1.0);
    this.setDepth(this.y);

    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(14, 10);
    body.setOffset(1, 14);

    // Rótulo de Nome do NPC
    const nameColor = config.nameColor || '#fef08a';
    this.nameText = scene.add.text(x, y - 28, config.name, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: nameColor,
      stroke: '#000000',
      strokeThickness: 2,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(this.y + 10);

    // Subtítulo de Função
    this.roleText = scene.add.text(x, y - 21, `<${config.role}>`, {
      fontFamily: 'monospace',
      fontSize: '6px',
      color: '#cbd5e1',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(this.y + 10);

    // Balão interativo flutuante [F] Conversar
    this.promptContainer = scene.add.container(x, y - 38);
    this.promptContainer.setDepth(this.y + 20);
    this.promptContainer.setVisible(false);

    this.promptBg = scene.add.graphics();
    this.promptBg.fillStyle(0x0f172a, 0.85);
    this.promptBg.lineStyle(1, 0xf59e0b, 1);
    this.promptBg.fillRoundedRect(-24, -6, 48, 12, 3);
    this.promptBg.strokeRoundedRect(-24, -6, 48, 12, 3);

    this.promptText = scene.add.text(0, 0, '[F] Falar', {
      fontFamily: 'monospace',
      fontSize: '6px',
      color: '#fef08a',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.promptContainer.add([this.promptBg, this.promptText]);

    // Permite clicar diretamente no NPC para interagir
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      this.interact();
    });
  }

  public updateNPC(delta: number, player: Player, isInteractPressed: boolean): void {
    const dist = calculateDistance(this.x, this.y, player.x, player.y);
    const inRange = dist <= this.interactRadius;

    this.isNear = inRange;
    this.promptContainer.setVisible(inRange);

    if (inRange) {
      // Efeito de bobbing suave no balão
      this.animTimer += delta * 0.005;
      const bobY = Math.sin(this.animTimer) * 2;
      this.promptContainer.setY(this.y - 38 + bobY);

      if (isInteractPressed) {
        this.interact();
      }
    }

    // Animação sutil de idle (alternância de frame a cada 600ms)
    const idleFrame = (Math.floor(this.scene.time.now / 600) % 4);
    if (this.frame.name !== `${idleFrame}`) {
      this.setFrame(idleFrame);
    }
  }

  public interact(): void {
    this.scene.events.emit('open-npc-dialog', {
      npcId: this.npcId,
      npcName: this.npcName,
      role: this.role
    });
  }

  public destroy(fromScene?: boolean): void {
    this.nameText.destroy();
    this.roleText.destroy();
    this.promptContainer.destroy();
    super.destroy(fromScene);
  }
}
