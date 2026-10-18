import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  public preload(): void {
    this.load.tilemapTiledJSON('map_prototype', './assets/maps/map_prototype.json');
  }

  public create(): void {
    this.createHeroAnimations();
    this.scene.start('LoginScene');
  }

  private createHeroAnimations(): void {
    const classKeys = ['hero_warrior', 'hero_ranger', 'hero_mage', 'hero_druid'];

    classKeys.forEach(key => {
      // Também cria alias genérico 'hero' se for warrior
      const prefix = key === 'hero_warrior' ? 'hero' : key;

      // Down
      this.anims.create({
        key: `${prefix}_idle_down`,
        frames: [{ key, frame: 0 }],
        frameRate: 1
      });
      this.anims.create({
        key: `${prefix}_walk_down`,
        frames: [
          { key, frame: 1 },
          { key, frame: 0 },
          { key, frame: 3 },
          { key, frame: 0 }
        ],
        frameRate: 8,
        repeat: -1
      });

      // Up
      this.anims.create({
        key: `${prefix}_idle_up`,
        frames: [{ key, frame: 4 }],
        frameRate: 1
      });
      this.anims.create({
        key: `${prefix}_walk_up`,
        frames: [
          { key, frame: 5 },
          { key, frame: 4 },
          { key, frame: 7 },
          { key, frame: 4 }
        ],
        frameRate: 8,
        repeat: -1
      });

      // Right
      this.anims.create({
        key: `${prefix}_idle_right`,
        frames: [{ key, frame: 8 }],
        frameRate: 1
      });
      this.anims.create({
        key: `${prefix}_walk_right`,
        frames: [
          { key, frame: 9 },
          { key, frame: 8 },
          { key, frame: 11 },
          { key, frame: 8 }
        ],
        frameRate: 8,
        repeat: -1
      });
    });
  }
}
