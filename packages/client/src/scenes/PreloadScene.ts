import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  public preload(): void {
    const assetsBaseUrl = ((import.meta as any).env?.VITE_ASSETS_BASE_URL as string) || './assets';
    const cleanBase = assetsBaseUrl.endsWith('/') ? assetsBaseUrl.slice(0, -1) : assetsBaseUrl;
    this.load.tilemapTiledJSON('map_prototype', `${cleanBase}/maps/map_prototype.json`);
  }

  public create(): void {
    this.createHeroAnimations();
    this.createMonsterAnimations();
    this.scene.start('LoginScene');
  }

  private createHeroAnimations(): void {
    const classKeys = ['hero_warrior', 'hero_ranger', 'hero_mage', 'hero_druid'];

    classKeys.forEach(key => {
      // Registra com a chave canônica da classe (ex: hero_warrior, hero_ranger, hero_mage, hero_druid)
      const prefixes = [key];
      // Mantém alias legado 'hero' apontando para warrior para compatibilidade retroativa
      if (key === 'hero_warrior') {
        prefixes.push('hero');
      }

      prefixes.forEach(prefix => {
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
    });
  }

  private createMonsterAnimations(): void {
    // 1. Slime (Frames 0: normal, 1: squash)
    this.anims.create({
      key: 'mob_slime_idle',
      frames: [{ key: 'mob_slime', frame: 0 }],
      frameRate: 1
    });
    this.anims.create({
      key: 'mob_slime_walk',
      frames: [
        { key: 'mob_slime', frame: 0 },
        { key: 'mob_slime', frame: 1 },
        { key: 'mob_slime', frame: 0 }
      ],
      frameRate: 4,
      repeat: -1
    });

    // 2. Goblin (Frames 0: normal, 1: passo e ataque)
    this.anims.create({
      key: 'mob_goblin_idle',
      frames: [{ key: 'mob_goblin', frame: 0 }],
      frameRate: 1
    });
    this.anims.create({
      key: 'mob_goblin_walk',
      frames: [
        { key: 'mob_goblin', frame: 0 },
        { key: 'mob_goblin', frame: 1 }
      ],
      frameRate: 5,
      repeat: -1
    });
    this.anims.create({
      key: 'mob_goblin_attack',
      frames: [{ key: 'mob_goblin', frame: 1 }],
      frameRate: 1
    });
  }
}
