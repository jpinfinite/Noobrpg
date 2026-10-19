import Phaser from 'phaser';
import { ITEM_DEFINITIONS, calculateDistance } from '@noobrpg/shared';
import { Player } from './Player.js';
import { SoundEffects } from '../audio/SoundEffects.js';

export class GroundItem extends Phaser.Physics.Arcade.Sprite {
  public itemId: string;
  public quantity: number;
  private isCollected: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number, itemId: string, quantity: number) {
    const itemDef = ITEM_DEFINITIONS[itemId];
    const textureKey = itemDef?.iconKey && scene.textures.exists(itemDef.iconKey) ? itemDef.iconKey : 'item_drop_bag';

    super(scene, x, y, textureKey);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.itemId = itemId;
    this.quantity = quantity;

    this.setOrigin(0.5, 0.8);
    this.setDepth(this.y);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(10, 10);
    body.setCollideWorldBounds(true);

    // Efeito de bobbing/flutuação sutil
    scene.tweens.add({
      targets: this,
      y: y - 3,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  public checkPlayerPickup(player: Player): void {
    if (this.isCollected || !this.active) return;

    const dist = calculateDistance(this.x, this.y, player.x, player.y);
    if (dist <= 24) {
      const result = player.tryCollectItem(this.itemId, this.quantity);
      if (result.success) {
        SoundEffects.getInstance().playItemPickup();
        this.isCollected = true;
        const itemDef = ITEM_DEFINITIONS[this.itemId];
        const name = itemDef ? itemDef.name : this.itemId;

        this.scene.events.emit('floating-text', {
          x: this.x,
          y: this.y - 15,
          text: `+${this.quantity} ${name}`,
          color: '#38bdf8'
        });

        this.destroy();
      } else {
        this.scene.events.emit('floating-text', {
          x: player.x,
          y: player.y - 25,
          text: 'Inventário Cheio!',
          color: '#ef4444'
        });
      }
    }
  }
}
