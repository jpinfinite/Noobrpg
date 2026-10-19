import Phaser from 'phaser';
import {
  GatheringNodeType,
  GatheringNodeConfig,
  GATHERING_NODE_DEFINITIONS,
  ITEM_DEFINITIONS,
  calculateDistance
} from '@noobrpg/shared';
import { Player } from './Player.js';

export class GatheringNode extends Phaser.Physics.Arcade.Sprite {
  public nodeConfig: GatheringNodeConfig;
  public isAvailable: boolean = true;
  public canopySprite?: Phaser.GameObjects.Sprite;
  private respawnTimer: number = 0;
  private isGathering: boolean = false;
  private currentGatherProgress: number = 0;
  private progressBarGraphics: Phaser.GameObjects.Graphics;
  private hintText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, type: GatheringNodeType) {
    const config = GATHERING_NODE_DEFINITIONS[type];
    const textureKey =
      type === GatheringNodeType.TREE
        ? 'prop_tree_trunk'
        : type === GatheringNodeType.ORE_VEIN
        ? 'node_ore'
        : 'node_herb';

    super(scene, x, y, textureKey);

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // Estático

    this.nodeConfig = config;

    if (type === GatheringNodeType.TREE) {
      this.canopySprite = scene.add.sprite(x, y, 'prop_tree_canopy');
      this.canopySprite.setOrigin(0.5, 0.95);
      this.canopySprite.setDepth(y);
    }

    this.progressBarGraphics = scene.add.graphics();
    this.hintText = scene.add.text(x, y - 24, '[F] Coletar', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#facc15',
      stroke: '#000000',
      strokeThickness: 2
    });
    this.hintText.setOrigin(0.5);
    this.hintText.setVisible(false);

    this.initPhysics(type);
  }

  private initPhysics(type: GatheringNodeType): void {
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    this.setOrigin(0.5, 0.95);
    this.setDepth(this.y);

    if (type === GatheringNodeType.TREE) {
      body.setSize(14, 10);
      body.setOffset(9, 36);
    } else if (type === GatheringNodeType.ORE_VEIN) {
      body.setSize(14, 10);
      body.setOffset(3, 8);
    } else {
      body.setSize(10, 8);
      body.setOffset(3, 6);
    }
  }

  public updateNode(delta: number, player: Player, isInteractPressed: boolean): void {
    if (!this.isAvailable) {
      this.respawnTimer -= delta;
      this.progressBarGraphics.clear();
      this.hintText.setVisible(false);
      if (this.canopySprite) {
        this.canopySprite.setVisible(false);
      }
      if (this.respawnTimer <= 0) {
        this.isAvailable = true;
        this.setAlpha(1.0);
        if (this.canopySprite) {
          this.canopySprite.setVisible(true);
        }
      }
      return;
    }

    // Se o jogador estiver passando atrás da copa da árvore, suaviza o alpha
    if (this.canopySprite) {
      const isBehind =
        Math.abs(player.x - this.x) <= 18 &&
        player.y < this.y - 4 &&
        player.y >= this.y - 42;
      const targetAlpha = isBehind ? 0.65 : 1.0;
      if (this.canopySprite.alpha !== targetAlpha) {
        this.canopySprite.setAlpha(targetAlpha);
      }
    }

    const dist = calculateDistance(this.x, this.y, player.x, player.y);
    const inRange = dist <= 32;

    if (inRange && !this.isGathering) {
      this.hintText.setVisible(true);
      this.hintText.setPosition(this.x, this.y - 24);
    } else if (!inRange) {
      this.hintText.setVisible(false);
    }

    // Processa a coleta com a tecla F pressionada
    if (inRange && isInteractPressed) {
      this.isGathering = true;
      this.hintText.setVisible(false);
      this.currentGatherProgress += delta;

      const progressRatio = Math.min(1, this.currentGatherProgress / this.nodeConfig.gatherDurationMs);
      this.renderProgressBar(progressRatio);

      if (this.currentGatherProgress >= this.nodeConfig.gatherDurationMs) {
        this.completeGathering(player);
      }
    } else {
      // Se soltar a tecla ou sair do alcance, cancela o progresso
      if (this.isGathering) {
        this.isGathering = false;
        this.currentGatherProgress = 0;
        this.progressBarGraphics.clear();
      }
    }
  }

  private completeGathering(player: Player): void {
    this.isGathering = false;
    this.currentGatherProgress = 0;
    this.progressBarGraphics.clear();

    const amount =
      Math.floor(
        Math.random() * (this.nodeConfig.dropAmountMax - this.nodeConfig.dropAmountMin + 1)
      ) + this.nodeConfig.dropAmountMin;

    const result = player.tryCollectItem(this.nodeConfig.droppedItemId, amount);

    if (result.success) {
      this.isAvailable = false;
      this.respawnTimer = this.nodeConfig.respawnTimeMs;
      this.setAlpha(0.35);
      if (this.canopySprite) {
        this.canopySprite.setVisible(false);
      }

      const itemDef = ITEM_DEFINITIONS[this.nodeConfig.droppedItemId];
      const itemName = itemDef ? itemDef.name : this.nodeConfig.droppedItemId;

      this.scene.events.emit('floating-text', {
        x: this.x,
        y: this.y - 20,
        text: `+${amount} ${itemName}`,
        color: '#22c55e'
      });

      // Concede 10 XP por atividade de coleta
      player.gainXp(10);
    } else {
      this.scene.events.emit('floating-text', {
        x: player.x,
        y: player.y - 25,
        text: 'Inventário Cheio!',
        color: '#ef4444'
      });
    }
  }

  private renderProgressBar(ratio: number): void {
    this.progressBarGraphics.clear();
    const width = 24;
    const height = 4;
    const x = this.x - width / 2;
    const y = this.y - 28;

    this.progressBarGraphics.fillStyle(0x0c0a14, 0.85);
    this.progressBarGraphics.fillRect(x, y, width, height);

    this.progressBarGraphics.fillStyle(0x38bdf8, 1);
    this.progressBarGraphics.fillRect(x, y, width * ratio, height);
    this.progressBarGraphics.setDepth(9998);
  }

  public override destroy(fromScene?: boolean): void {
    if (this.canopySprite) {
      this.canopySprite.destroy(fromScene);
    }
    this.progressBarGraphics.destroy();
    this.hintText.destroy();
    super.destroy(fromScene);
  }
}
