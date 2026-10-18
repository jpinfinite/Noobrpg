import Phaser from 'phaser';
import { MonsterType, GatheringNodeType, MonsterDropEntry, PlayerData, CharacterClass } from '@noobrpg/shared';
import { Player } from '../entities/Player.js';
import { Monster } from '../entities/Monster.js';
import { EnvironmentProp } from '../entities/EnvironmentProp.js';
import { GatheringNode } from '../entities/GatheringNode.js';
import { CraftingStation } from '../entities/CraftingStation.js';
import { GroundItem } from '../entities/GroundItem.js';
import { ApiClient } from '../net/ApiClient.js';

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private monsters: Monster[] = [];
  private monstersGroup!: Phaser.Physics.Arcade.Group;
  private propsGroup!: Phaser.Physics.Arcade.StaticGroup;
  private gatheringNodes: GatheringNode[] = [];
  private groundItems: GroundItem[] = [];
  private craftingStation!: CraftingStation;
  private map!: Phaser.Tilemaps.Tilemap;
  private collisionLayer!: Phaser.Tilemaps.TilemapLayer;
  private initialPlayerData?: PlayerData;
  private autoSaveTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: 'WorldScene' });
  }

  public init(data: { playerData?: PlayerData }): void {
    if (data?.playerData) {
      this.initialPlayerData = data.playerData;
    }
  }

  public create(): void {
    // 1. Tilemap
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

    // 2. Props decorativos
    this.propsGroup = this.physics.add.staticGroup();
    this.spawnEnvironmentProps();

    // 3. Forja de Crafting na praça
    this.craftingStation = new CraftingStation(this, 190, 140);
    this.propsGroup.add(this.craftingStation);

    // 4. Nós de Coleta
    this.spawnGatheringNodes();

    // 5. Jogador carregado com dados autoritativos do servidor
    const spawnX = this.initialPlayerData?.position?.x || 180;
    const spawnY = this.initialPlayerData?.position?.y || 160;
    const charClass = this.initialPlayerData?.characterClass || CharacterClass.WARRIOR;
    this.player = new Player(this, spawnX, spawnY, charClass, this.initialPlayerData);

    // 6. Monstros
    this.monstersGroup = this.physics.add.group();
    this.spawnMonsters();

    // 7. Colisões
    this.physics.add.collider(this.player, this.collisionLayer);
    this.physics.add.collider(this.player, this.propsGroup);
    this.physics.add.collider(this.monstersGroup, this.collisionLayer);
    this.physics.add.collider(this.monstersGroup, this.propsGroup);
    this.physics.add.collider(this.player, this.monstersGroup);

    // 8. Câmera
    const mapWidthPx = this.map.widthInPixels;
    const mapHeightPx = this.map.heightInPixels;

    this.physics.world.setBounds(0, 0, mapWidthPx, mapHeightPx);
    this.cameras.main.setBounds(0, 0, mapWidthPx, mapHeightPx);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    // 9. Handlers de eventos de loot e textos flutuantes
    this.setupEventListeners();

    // 10. UIScene
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

    // Atualiza nós de coleta (madeira, minério, ervas)
    for (const node of this.gatheringNodes) {
      node.updateNode(delta, this.player, this.player.isInteractDown);
    }

    // Atualiza interação com a bigorna
    if (this.craftingStation) {
      this.craftingStation.updateStation(this.player, this.player.isInteractDown);
    }

    // Checa coleta de itens soltos no chão
    for (let i = this.groundItems.length - 1; i >= 0; i--) {
      const item = this.groundItems[i];
      if (item && item.active) {
        item.checkPlayerPickup(this.player);
      } else {
        this.groundItems.splice(i, 1);
      }
    }
  }

  private spawnGatheringNodes(): void {
    // Nós de madeira (árvores colhíveis)
    const treeNode1 = new GatheringNode(this, 90, 80, GatheringNodeType.TREE);
    const treeNode2 = new GatheringNode(this, 300, 210, GatheringNodeType.TREE);
    this.gatheringNodes.push(treeNode1, treeNode2);
    this.propsGroup.add(treeNode1);
    this.propsGroup.add(treeNode2);

    // Nós de minério de ferro
    const oreNode1 = new GatheringNode(this, 140, 60, GatheringNodeType.ORE_VEIN);
    const oreNode2 = new GatheringNode(this, 260, 60, GatheringNodeType.ORE_VEIN);
    this.gatheringNodes.push(oreNode1, oreNode2);
    this.propsGroup.add(oreNode1);
    this.propsGroup.add(oreNode2);

    // Nós de ervas medicinais
    const herbNode1 = new GatheringNode(this, 100, 150, GatheringNodeType.HERB_BUSH);
    const herbNode2 = new GatheringNode(this, 270, 160, GatheringNodeType.HERB_BUSH);
    this.gatheringNodes.push(herbNode1, herbNode2);
  }

  private spawnMonsters(): void {
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

    const goblin = new Monster(this, 280, 70, MonsterType.GOBLIN);
    this.monsters.push(goblin);
    this.monstersGroup.add(goblin);
  }

  private spawnEnvironmentProps(): void {
    const treePositions = [
      { x: 120, y: 110 },
      { x: 260, y: 110 },
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

  private setupEventListeners(): void {
    // Efeito de textos flutuantes
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

    // Spawna drop único no chão
    this.events.on('spawn-ground-item', (data: { x: number; y: number; itemId: string; quantity: number }) => {
      const groundItem = new GroundItem(this, data.x, data.y, data.itemId, data.quantity);
      this.groundItems.push(groundItem);
    });

    // Spawna loot de monstros baseado na tabela de probabilidades
    this.events.on('spawn-monster-loot', (data: { x: number; y: number; lootTable: MonsterDropEntry[] }) => {
      for (const entry of data.lootTable) {
        if (Math.random() <= entry.chance) {
          const qty =
            Math.floor(Math.random() * (entry.maxAmount - entry.minAmount + 1)) + entry.minAmount;
          const offsetX = Math.random() * 16 - 8;
          const offsetY = Math.random() * 16 - 8;
          const groundItem = new GroundItem(this, data.x + offsetX, data.y + offsetY, entry.itemId, qty);
          this.groundItems.push(groundItem);
        }
      }
    });

    // Autosave periódico a cada 20 segundos
    this.autoSaveTimer = this.time.addEvent({
      delay: 20000,
      loop: true,
      callback: () => this.saveProgress()
    });

    // Evento de pedido de salvamento e saída
    this.events.on('request-save-and-exit', async () => {
      await this.saveProgress();
      this.scene.stop('UIScene');
      this.scene.start('CharacterSelectScene');
    });
  }

  public async saveProgress(): Promise<void> {
    if (!this.player || !this.player.playerData) return;
    const charId = this.player.playerData.id;
    if (charId === 'local_player_1') return; // Ignora em sessões puramente locais

    try {
      const payload = {
        position: { x: Math.round(this.player.x), y: Math.round(this.player.y) },
        hp: this.player.playerData.attributes.currentHp,
        mp: this.player.playerData.attributes.currentMp,
        inventory: this.player.playerData.inventory,
        equipped: this.player.playerData.equipped
      };

      await ApiClient.saveCharacter(charId, payload);
      this.events.emit('floating-text', {
        x: this.player.x,
        y: this.player.y - 14,
        text: '💾 PROGRESSO SALVO',
        color: '#34d399'
      });
    } catch (err) {
      console.warn('[AutoSave] Falha ao persistir no servidor:', err);
    }
  }
}

