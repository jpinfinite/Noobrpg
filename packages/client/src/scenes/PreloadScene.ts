import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  public preload(): void {
    // Carrega o mapa JSON do Tiled
    this.load.tilemapTiledJSON('map_prototype', './assets/maps/map_prototype.json');
  }

  public create(): void {
    this.createHeroAnimations();
    // Transiciona para o mundo jogável
    this.scene.start('WorldScene');
  }

  /**
   * Registra as animações direcionais do personagem no AnimationManager do Phaser
   */
  private createHeroAnimations(): void {
    // Configuração dos frames do spritesheet de 64x72 (4 colunas x 3 linhas)
    // Linha 0 = Down (frames 0, 1, 2, 3)
    // Linha 1 = Up (frames 4, 5, 6, 7)
    // Linha 2 = Right (frames 8, 9, 10, 11)

    // --- DIREÇÃO: BAIXO (DOWN) ---
    this.anims.create({
      key: 'hero_idle_down',
      frames: [{ key: 'hero_prototype', frame: 0 }],
      frameRate: 1
    });

    this.anims.create({
      key: 'hero_walk_down',
      frames: [
        { key: 'hero_prototype', frame: 1 },
        { key: 'hero_prototype', frame: 0 },
        { key: 'hero_prototype', frame: 3 },
        { key: 'hero_prototype', frame: 0 }
      ],
      frameRate: 8,
      repeat: -1
    });

    // --- DIREÇÃO: CIMA (UP) ---
    this.anims.create({
      key: 'hero_idle_up',
      frames: [{ key: 'hero_prototype', frame: 4 }],
      frameRate: 1
    });

    this.anims.create({
      key: 'hero_walk_up',
      frames: [
        { key: 'hero_prototype', frame: 5 },
        { key: 'hero_prototype', frame: 4 },
        { key: 'hero_prototype', frame: 7 },
        { key: 'hero_prototype', frame: 4 }
      ],
      frameRate: 8,
      repeat: -1
    });

    // --- DIREÇÃO: DIREITA (RIGHT) ---
    this.anims.create({
      key: 'hero_idle_right',
      frames: [{ key: 'hero_prototype', frame: 8 }],
      frameRate: 1
    });

    this.anims.create({
      key: 'hero_walk_right',
      frames: [
        { key: 'hero_prototype', frame: 9 },
        { key: 'hero_prototype', frame: 8 },
        { key: 'hero_prototype', frame: 11 },
        { key: 'hero_prototype', frame: 8 }
      ],
      frameRate: 8,
      repeat: -1
    });
  }
}
