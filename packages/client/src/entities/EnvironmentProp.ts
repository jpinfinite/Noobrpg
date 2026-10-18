import Phaser from 'phaser';

export type PropType = 'tree' | 'pillar';

export class EnvironmentProp extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number, type: PropType) {
    const textureKey = type === 'tree' ? 'prop_tree' : 'prop_pillar';
    super(scene, x, y, textureKey);

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // Corpo estático (Static Body)

    this.initProp(type);
  }

  private initProp(type: PropType): void {
    const body = this.body as Phaser.Physics.Arcade.StaticBody;

    if (type === 'tree') {
      // Âncora na base do tronco (x: centro, y: base dos pés)
      this.setOrigin(0.5, 0.95);
      // Colisão sólida apenas no tronco inferior (16x10 px)
      body.setSize(14, 10);
      body.setOffset(9, 36);
    } else {
      // Pilar de pedra
      this.setOrigin(0.5, 0.95);
      body.setSize(12, 10);
      body.setOffset(2, 21);
    }

    // Define a profundidade estática baseada na posição Y da base
    this.setDepth(this.y);
  }
}
