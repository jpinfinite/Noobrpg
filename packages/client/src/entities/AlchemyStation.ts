import Phaser from 'phaser';
import { calculateDistance } from '@noobrpg/shared';
import { Player } from './Player.js';

export class AlchemyStation extends Phaser.Physics.Arcade.Sprite {
  private hintText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'prop_alchemy_bench');

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // Estático

    this.setOrigin(0.5, 0.9);
    this.setDepth(this.y);

    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(18, 12);
    body.setOffset(2, 10);

    this.hintText = scene.add.text(x, y - 26, '[F] Bancada de Alquimia', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#10b981',
      stroke: '#000000',
      strokeThickness: 2
    });
    this.hintText.setOrigin(0.5);
    this.hintText.setVisible(false);
  }

  public updateStation(player: Player, isInteractPressed: boolean): void {
    const dist = calculateDistance(this.x, this.y, player.x, player.y);
    const inRange = dist <= 32;

    this.hintText.setVisible(inRange);

    if (inRange && isInteractPressed) {
      this.scene.events.emit('toggle-crafting');
    }
  }

  public destroy(fromScene?: boolean): void {
    this.hintText.destroy();
    super.destroy(fromScene);
  }
}
