import Phaser from 'phaser';

export type PropType = 'tree' | 'pillar';

export class EnvironmentProp extends Phaser.Physics.Arcade.Sprite {
  public canopySprite?: Phaser.GameObjects.Sprite;
  public propType: PropType;

  constructor(scene: Phaser.Scene, x: number, y: number, type: PropType) {
    const textureKey = type === 'tree' ? 'prop_tree_trunk' : 'prop_pillar';
    super(scene, x, y, textureKey);

    this.propType = type;
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // Corpo estático (Static Body)

    this.initProp(type);
  }

  private initProp(type: PropType): void {
    const body = this.body as Phaser.Physics.Arcade.StaticBody;

    if (type === 'tree') {
      // Âncora na base do tronco (x: centro, y: base dos pés)
      this.setOrigin(0.5, 0.95);
      // Colisão física sólida na região dos pés
      body.setSize(14, 10);
      body.setOffset(9, 36);

      // Copa visual separada sem hitbox de colisão
      this.canopySprite = this.scene.add.sprite(this.x, this.y, 'prop_tree_canopy');
      this.canopySprite.setOrigin(0.5, 0.95);
      this.canopySprite.setDepth(this.y);
    } else {
      // Pilar de pedra
      this.setOrigin(0.5, 0.95);
      body.setSize(12, 10);
      body.setOffset(2, 21);
    }

    // Define a profundidade estática baseada na posição Y da base
    this.setDepth(this.y);
  }

  public updateCanopyOcclusion(playerX: number, playerY: number): void {
    if (!this.canopySprite) return;

    // Se o jogador estiver fisicamente atrás da copa da árvore (Y menor que a base e alinhado)
    const isBehindCanopy =
      Math.abs(playerX - this.x) <= 18 &&
      playerY < this.y - 4 &&
      playerY >= this.y - 42;

    const targetAlpha = isBehindCanopy ? 0.65 : 1.0;
    if (this.canopySprite.alpha !== targetAlpha) {
      this.canopySprite.setAlpha(targetAlpha);
    }
  }

  public override destroy(fromScene?: boolean): void {
    if (this.canopySprite) {
      this.canopySprite.destroy(fromScene);
    }
    super.destroy(fromScene);
  }
}

