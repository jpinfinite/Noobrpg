import Phaser from 'phaser';
import { MonsterType } from '@noobrpg/shared';
import { Player } from '../entities/Player.js';
import { Monster } from '../entities/Monster.js';
import { EnvironmentProp } from '../entities/EnvironmentProp.js';

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private monsters: Monster[] = [];
  private monstersGroup!: Phaser.Physics.Arcade.Group;
  private propsGroup!: Phaser.Physics.Arcade.StaticGroup;
  private map!: Phaser.Tilemaps.Tilemap;
  private collisionLayer!: Phaser.Tilemaps.TilemapLayer;

  constructor() {
    super({ key: 'WorldScene' });
  }

  public create(): void {
    // 1. Criação do Tilemap
    this.map = this.make.tilemap({ key: 'map_prototype' });
    const tileset = this.map.addTilesetImage('tileset_prototype', 'tileset_prototype');

    if (!tileset) {
      console.error('Falha ao carregar tileset tileset_prototype');
      return;
    }

    const groundLayer = this.map.createLayer('Ground', tileset, 0, 0);
    this.collisionLayer = this.map.createLayer('Collision', tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer;

    groundLayer?.setDepth(0);
    this.collisionLayer?.setDepth(1);
    this.collisionLayer.setCollisionByProperty({ collides: true });

    // 2. Props do cenário (Árvores e Pilares)
    this.propsGroup = this.physics.add.staticGroup();
    this.spawnEnvironmentProps();

    // 3. Spawning do Jogador
    this.player = new Player(this, 180, 160);

    // 4. Spawning dos Monstros
    this.monstersGroup = this.physics.add.group();
    this.spawnMonsters();

    // 5. Colisores Físicos
    this.physics.add.collider(this.player, this.collisionLayer);
    this.physics.add.collider(this.player, this.propsGroup);
    this.physics.add.collider(this.monstersGroup, this.collisionLayer);
    this.physics.add.collider(this.monstersGroup, this.propsGroup);
    this.physics.add.collider(this.player, this.monstersGroup);

    // 6. Câmera
    const mapWidthPx = this.map.widthInPixels;
    const mapHeightPx = this.map.heightInPixels;

    this.physics.world.setBounds(0, 0, mapWidthPx, mapHeightPx);
    this.cameras.main.setBounds(0, 0, mapWidthPx, mapHeightPx);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    // 7. Sistema de Texto Flutuante de Dano e Eventos
    this.setupFloatingTextListener();

    // 8. Inicializa UIScene
    this.scene.launch('UIScene', { player: this.player });
  }

  public update(time: number, delta: number): void {
    if (this.player) {
      this.player.updatePlayer(time, this.monsters);
    }

    for (const mob of this.monsters) {
      if (mob.active) {
        mob.updateAI(time, delta, this.player);
      }
    }
  }

  private spawnMonsters(): void {
    // 3 Slimes em diferentes áreas
    const slimeSpawns = [
      { x: 220, y: 130 },
      { x: 120, y: 190 },
      { x: 260, y: 190 }
    ];

    slimeSpawns.forEach(pos => {
      const slime = new Monster(this, pos.x, pos.y, MonsterType.SLIME);
      this.monsters.push(slime);
      this.monstersGroup.add(slime);
    });

    // 1 Goblin na área nordeste
    const goblin = new Monster(this, 280, 70, MonsterType.GOBLIN);
    this.monsters.push(goblin);
    this.monstersGroup.add(goblin);
  }

  private spawnEnvironmentProps(): void {
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

    const pillarPositions = [
      { x: 140, y: 160 },
      { x: 240, y: 160 }
    ];

    pillarPositions.forEach(pos => {
      const pillar = new EnvironmentProp(this, pos.x, pos.y, 'pillar');
      this.propsGroup.add(pillar);
    });
  }

  private setupFloatingTextListener(): void {
    this.events.on('floating-text', (data: { x: number; y: number; text: string; color: string }) => {
      const text = this.add.text(data.x, data.y, data.text, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: data.color,
        stroke: '#000000',
        strokeThickness: 2,
        fontStyle: 'bold'
      });
      text.setOrigin(0.5);
      text.setDepth(9999);

      this.tweens.add({
        targets: text,
        y: data.y - 18,
        alpha: 0,
        duration: 900,
        ease: 'Power1',
        onComplete: () => {
          text.destroy();
        }
      });
    });
  }
}
