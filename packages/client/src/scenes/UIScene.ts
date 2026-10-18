import Phaser from 'phaser';
import { evaluateLevelProgression, CLASS_COMBAT_CONFIG } from '@noobrpg/shared';
import { Player } from '../entities/Player.js';

interface UISceneData {
  player: Player;
}

export class UIScene extends Phaser.Scene {
  private player!: Player;
  private classLevelText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private mpText!: Phaser.GameObjects.Text;
  private xpText!: Phaser.GameObjects.Text;
  private coordsText!: Phaser.GameObjects.Text;
  private fpsText!: Phaser.GameObjects.Text;
  private skillText!: Phaser.GameObjects.Text;

  private hpBarGraphics!: Phaser.GameObjects.Graphics;
  private mpBarGraphics!: Phaser.GameObjects.Graphics;
  private xpBarGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'UIScene' });
  }

  public init(data: UISceneData): void {
    this.player = data.player;
  }

  public create(): void {
    this.createPlayerStatusPanel();
    this.createInfoPanel();
    this.createControlsHintPanel();
  }

  public update(): void {
    if (!this.player) return;

    this.updateStatusBars();
    this.updateCoordinates();
    this.updateFps();
  }

  private createPlayerStatusPanel(): void {
    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x0c0a14, 0.9);
    panelBg.lineStyle(1, 0x4338ca, 0.9);
    panelBg.fillRoundedRect(8, 8, 150, 64, 4);
    panelBg.strokeRoundedRect(8, 8, 150, 64, 4);

    this.classLevelText = this.add.text(14, 12, 'GUERREIRO  Lv.1', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#f59e0b',
      fontStyle: 'bold'
    });

    this.hpBarGraphics = this.add.graphics();
    this.mpBarGraphics = this.add.graphics();
    this.xpBarGraphics = this.add.graphics();

    this.hpText = this.add.text(14, 24, 'HP: 120/120', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#ffffff'
    });

    this.mpText = this.add.text(14, 38, 'MP: 30/30', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#ffffff'
    });

    this.xpText = this.add.text(14, 52, 'XP: 0/500 (0%)', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#facc15'
    });
  }

  private createInfoPanel(): void {
    const infoBg = this.add.graphics();
    infoBg.fillStyle(0x0c0a14, 0.9);
    infoBg.lineStyle(1, 0x334155, 0.8);
    infoBg.fillRoundedRect(310, 8, 162, 54, 4);
    infoBg.strokeRoundedRect(310, 8, 162, 54, 4);

    this.coordsText = this.add.text(316, 13, 'X: 000 | Y: 000', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#38bdf8'
    });

    this.fpsText = this.add.text(316, 26, 'FPS: 60 | 480x270', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#94a3b8'
    });

    this.skillText = this.add.text(316, 40, '[E] Golpe Pesado', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#a78bfa'
    });
  }

  private createControlsHintPanel(): void {
    // Barra de rodapé com atalhos de controle de combate
    const hintBg = this.add.graphics();
    hintBg.fillStyle(0x0c0a14, 0.8);
    hintBg.fillRect(0, 256, 480, 14);

    this.add.text(8, 259, '[ESPAÇO]: Atacar  |  [E]: Habilidade  |  [1-4]: Trocar Classe (Guerreiro/Arqueiro/Mago/Druida)', {
      fontFamily: 'monospace',
      fontSize: '6.5px',
      color: '#cbd5e1'
    });
  }

  private updateStatusBars(): void {
    const data = this.player.playerData;
    const attrs = data.attributes;

    // Classe e Nível
    this.classLevelText.setText(`${data.characterClass}  Lv.${data.level}`);

    // Barra de HP
    this.hpBarGraphics.clear();
    this.hpBarGraphics.fillStyle(0x331018, 0.9);
    this.hpBarGraphics.fillRect(72, 25, 80, 6);
    const hpRatio = Math.max(0, Math.min(1, attrs.currentHp / attrs.maxHp));
    this.hpBarGraphics.fillStyle(0xe11d48, 1);
    this.hpBarGraphics.fillRect(72, 25, 80 * hpRatio, 6);
    this.hpText.setText(`HP: ${attrs.currentHp}/${attrs.maxHp}`);

    // Barra de MP
    this.mpBarGraphics.clear();
    this.mpBarGraphics.fillStyle(0x0c2540, 0.9);
    this.mpBarGraphics.fillRect(72, 39, 80, 5);
    const mpRatio = Math.max(0, Math.min(1, attrs.currentMp / attrs.maxMp));
    this.mpBarGraphics.fillStyle(0x0284c7, 1);
    this.mpBarGraphics.fillRect(72, 39, 80 * mpRatio, 5);
    this.mpText.setText(`MP: ${attrs.currentMp}/${attrs.maxMp}`);

    // Barra de XP
    const progression = evaluateLevelProgression(data.level, data.currentXp);
    const xpRatio = Math.max(0, Math.min(1, progression.xpInCurrentLevel / progression.xpRequiredForNext));
    const xpPercent = Math.round(xpRatio * 100);

    this.xpBarGraphics.clear();
    this.xpBarGraphics.fillStyle(0x281e05, 0.9);
    this.xpBarGraphics.fillRect(72, 53, 80, 4);
    this.xpBarGraphics.fillStyle(0xf59e0b, 1);
    this.xpBarGraphics.fillRect(72, 53, 80 * xpRatio, 4);
    this.xpText.setText(`XP: ${progression.xpInCurrentLevel}/${progression.xpRequiredForNext} (${xpPercent}%)`);

    // Atualiza nome da habilidade da classe
    const combatCfg = CLASS_COMBAT_CONFIG[data.characterClass];
    this.skillText.setText(`[E] ${combatCfg.skill1Name} (${combatCfg.skill1CostMp} MP)`);
  }

  private updateCoordinates(): void {
    const posX = this.player.playerData.position.x;
    const posY = this.player.playerData.position.y;
    const tileX = Math.floor(posX / 16);
    const tileY = Math.floor(posY / 16);

    this.coordsText.setText(`X: ${posX} Y: ${posY} [T: ${tileX},${tileY}]`);
  }

  private updateFps(): void {
    const actualFps = Math.round(this.game.loop.actualFps);
    this.fpsText.setText(`FPS: ${actualFps} | Gold: ${this.player.playerData.gold}`);
  }
}
