import Phaser from 'phaser';
import { TextureGenerator } from '../utils/TextureGenerator.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  public create(): void {
    // 1. Gera texturas procedurais pixel art para o protótipo da Fase 1
    TextureGenerator.generateAll(this);

    // 2. Avança para a PreloadScene
    this.scene.start('PreloadScene');
  }
}
