import Phaser from 'phaser';
import { Player } from '../entities/Player.js';
import { EnvironmentProp } from '../entities/EnvironmentProp.js';

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private propsGroup!: Phaser.Physics.Arcade.StaticGroup;
  private map!: Phaser.Tilemaps.Tilemap;
  private collisionLayer!: Phaser.Tilemaps.TilemapLayer;

  constructor() {
    super({ key: 'WorldScene' });
  }

  public create(): void {
    // 1. Criação do Tilemap ortogonal do Tiled
    this.map = this.make.tilemap({ key: 'map_prototype' });
    const tileset = this.map.addTilesetImage('tileset_prototype', 'tileset_prototype');

    if (!tileset) {
      console.error('Falha ao carregar tileset tileset_prototype');
      return;
    }

    // 2. Camadas do mapa
    const groundLayer = this.map.createLayer('Ground', tileset, 0, 0);
    this.collisionLayer = this.map.createLayer('Collision', tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer;

    // Configuração de profundidade da camada de solo
    groundLayer?.setDepth(0);
    this.collisionLayer?.setDepth(1);

    // Habilita colisões físicas na camada Collision baseada na propriedade 'collides'
    this.collisionLayer.setCollisionByProperty({ collides: true });

    // 3. Grupo de Props e Objetos do Cenário (Árvores e Pilares para Y-sorting)
    this.propsGroup = this.physics.add.staticGroup();
    this.spawnEnvironmentProps();

    // 4. Criação do Jogador (Guerreiro na praça central)
    this.player = new Player(this, 180, 160);

    // 5. Configuração dos Colisores Físicos
    this.physics.add.collider(this.player, this.collisionLayer);
    this.physics.add.collider(this.player, this.propsGroup);

    // 6. Configuração da Câmera (Suave, bounds do mapa)
    const mapWidthPx = this.map.widthInPixels;
    const mapHeightPx = this.map.heightInPixels;

    this.physics.world.setBounds(0, 0, mapWidthPx, mapHeightPx);
    this.cameras.main.setBounds(0, 0, mapWidthPx, mapHeightPx);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    // 7. Inicializa a UI sobreposta em paralelo
    this.scene.launch('UIScene', { player: this.player });
  }

  public update(): void {
    if (this.player) {
      this.player.update();
    }
  }

  /**
   * Instancia árvores e pilares em posições estratégicas para validar o Y-Sorting
   */
  private spawnEnvironmentProps(): void {
    // Árvores distribuídas para testes de transposição frontal e traseira
    const treePositions = [
      { x: 120, y: 110 },
      { x: 260, y: 110 },
      { x: 100, y: 220 },
      { x: 280, y: 220 },
      { x: 200, y: 80 }
    ];

    treePositions.forEach(pos => {
      const tree = new EnvironmentProp(this, pos.x, pos.y, 'tree');
      this.propsGroup.add(tree);
    });

    // Pilares de pedra no caminho pavimentado
    const pillarPositions = [
      { x: 140, y: 160 },
      { x: 240, y: 160 }
    ];

    pillarPositions.forEach(pos => {
      const pillar = new EnvironmentProp(this, pos.x, pos.y, 'pillar');
      this.propsGroup.add(pillar);
    });
  }
}
