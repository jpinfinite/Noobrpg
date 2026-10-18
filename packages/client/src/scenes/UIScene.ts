import Phaser from 'phaser';
import { Player } from '../entities/Player.js';

interface UISceneData {
  player: Player;
}

export class UIScene extends Phaser.Scene {
  private player!: Player;
  private hpText!: Phaser.GameObjects.Text;
  private mpText!: Phaser.GameObjects.Text;
  private coordsText!: Phaser.GameObjects.Text;
  private fpsText!: Phaser.GameObjects.Text;
  private hpBarGraphics!: Phaser.GameObjects.Graphics;
  private mpBarGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'UIScene' });
  }

  public init(data: UISceneData): void {
    this.player = data.player;
  }

  public create(): void {
    this.createPlayerStatusPanel();
    this.createInfoPanel();
  }

  public update(): void {
    if (!this.player) return;

    this.updateStatusBars();
    this.updateCoordinates();
    this.updateFps();
  }

  private createPlayerStatusPanel(): void {
    // Fundo do painel do jogador (canto superior esquerdo)
    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x0c0a14, 0.85);
    panelBg.lineStyle(1, 0x4338ca, 0.9);
    panelBg.fillRoundedRect(8, 8, 140, 50, 4);
    panelBg.strokeRoundedRect(8, 8, 140, 50, 4);

    // Nome da classe e nível
    this.add.text(14, 12, 'GUERREIRO  Lv.1', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#f59e0b',
      fontStyle: 'bold'
    });

    // Gráficos das barras de HP e MP
    this.hpBarGraphics = this.add.graphics();
    this.mpBarGraphics = this.add.graphics();

    // Textos de HP e MP
    this.hpText = this.add.text(14, 25, 'HP: 120/120', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#ffffff'
    });

    this.mpText = this.add.text(14, 40, 'MP: 30/30', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#ffffff'
    });
  }

  private createInfoPanel(): void {
    // Painel de informações técnicas e coordenadas (canto superior direito)
    const infoBg = this.add.graphics();
    infoBg.fillStyle(0x0c0a14, 0.85);
    infoBg.lineStyle(1, 0x334155, 0.8);
    infoBg.fillRoundedRect(324, 8, 148, 42, 4);
    infoBg.strokeRoundedRect(324, 8, 148, 42, 4);

    this.coordsText = this.add.text(330, 14, 'X: 000 | Y: 000', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#38bdf8'
    });

    this.fpsText = this.add.text(330, 28, 'FPS: 60 | 480x270', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#94a3b8'
    });
  }

  private updateStatusBars(): void {
    const attrs = this.player.playerData.attributes;

    // Atualiza Barra de HP
    this.hpBarGraphics.clear();
    // Fundo da barra
    this.hpBarGraphics.fillStyle(0x331018, 0.9);
    this.hpBarGraphics.fillRect(72, 26, 68, 6);
    // Preenchimento proporcional
    const hpRatio = Math.max(0, Math.min(1, attrs.currentHp / attrs.maxHp));
    this.hpBarGraphics.fillStyle(0xe11d48, 1);
    this.hpBarGraphics.fillRect(72, 26, 68 * hpRatio, 6);

    this.hpText.setText(`HP: ${attrs.currentHp}/${attrs.maxHp}`);

    // Atualiza Barra de MP
    this.mpBarGraphics.clear();
    this.mpBarGraphics.fillStyle(0x0c2540, 0.9);
    this.mpBarGraphics.fillRect(72, 41, 68, 5);
    const mpRatio = Math.max(0, Math.min(1, attrs.currentMp / attrs.maxMp));
    this.mpBarGraphics.fillStyle(0x0284c7, 1);
    this.mpBarGraphics.fillRect(72, 41, 68 * mpRatio, 5);

    this.mpText.setText(`MP: ${attrs.currentMp}/${attrs.maxMp}`);
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
    this.fpsText.setText(`FPS: ${actualFps} | 480x270 (16:9)`);
  }
}
