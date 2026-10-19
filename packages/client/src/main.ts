import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@noobrpg/shared';
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { LoginScene } from './scenes/LoginScene.js';
import { CharacterSelectScene } from './scenes/CharacterSelectScene.js';
import { WorldScene } from './scenes/WorldScene.js';
import { UIScene } from './scenes/UIScene.js';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'game-viewport',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  backgroundColor: '#0c0a14',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%'
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scene: [BootScene, PreloadScene, LoginScene, CharacterSelectScene, WorldScene, UIScene]
};

// Inicializa a instância do jogo
export const game = new Phaser.Game(config);
(window as any).game = game;
(window as any).Phaser = Phaser;
