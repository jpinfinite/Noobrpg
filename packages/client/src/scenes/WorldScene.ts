import Phaser from 'phaser';
import { MonsterType, GatheringNodeType, MonsterDropEntry, PlayerData, CharacterClass, WorldSnapshot, S2C_ChatPayload, S2C_CombatEventPayload } from '@noobrpg/shared';
import { Player } from '../entities/Player.js';
import { Monster } from '../entities/Monster.js';
import { RemotePlayer } from '../entities/RemotePlayer.js';
import { EnvironmentProp } from '../entities/EnvironmentProp.js';
import { GatheringNode } from '../entities/GatheringNode.js';
import { CraftingStation } from '../entities/CraftingStation.js';
import { GroundItem } from '../entities/GroundItem.js';
import { ApiClient } from '../net/ApiClient.js';
import { MultiplayerClient } from '../net/MultiplayerClient.js';

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

  // Multiplayer em Tempo Real (Fase 5B)
  private remotePlayers: Map<string, RemotePlayer> = new Map();
  private multiplayerClient?: MultiplayerClient;
  private lastMoveSentTime: number = 0;
  private lastSentX: number = 0;
  private lastSentY: number = 0;
  private chatContainerEl?: HTMLElement;
  private chatInputEl?: HTMLInputElement;
  private chatMessagesEl?: HTMLElement;

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

    // 6. Monstros locais/estáticos
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

    // 10. Conexão Multiplayer em Tempo Real (Fase 5B)
    this.setupMultiplayer();

    // 11. Interface de Chat no DOM
    this.setupChatUI();

    // 12. UIScene
    this.scene.launch('UIScene', { player: this.player });
  }

  public update(time: number, delta: number): void {
    if (this.player) {
      this.player.updatePlayer(time, this.monsters);

      // Transmite intenção de movimento para o servidor autoritativo a cada 50ms
      const curX = Math.round(this.player.x);
      const curY = Math.round(this.player.y);
      if (
        (curX !== this.lastSentX || curY !== this.lastSentY) &&
        time - this.lastMoveSentTime >= 50
      ) {
        this.lastMoveSentTime = time;
        this.lastSentX = curX;
        this.lastSentY = curY;
        this.multiplayerClient?.sendMove(curX, curY, delta);
      }
    }

    // Atualiza interpolação visual de jogadores remotos (LERP suave)
    for (const remote of this.remotePlayers.values()) {
      remote.updateInterpolation(time, delta);
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

  // --- CONFIGURAÇÃO MULTIPLAYER (FASE 5B) ---

  private setupMultiplayer(): void {
    if (!this.initialPlayerData || this.initialPlayerData.id === 'local_player_1') {
      return;
    }

    this.multiplayerClient = new MultiplayerClient({
      onJoined: (payload) => {
        this.addChatMessage('Sistema', `Conectado à sala "${payload.roomId}" como ${payload.name}`, 'system');
      },
      onSnapshot: (snapshot: WorldSnapshot) => {
        this.handleWorldSnapshot(snapshot);
      },
      onPlayerJoined: (payload) => {
        const p = payload.player;
        if (p.id !== this.player.playerData.id && !this.remotePlayers.has(p.id)) {
          const remote = new RemotePlayer(this, p);
          this.remotePlayers.set(p.id, remote);
          this.addChatMessage('Sistema', `${p.name} entrou no mapa.`, 'system');
        }
      },
      onPlayerLeft: (payload) => {
        const remote = this.remotePlayers.get(payload.playerId);
        if (remote) {
          this.addChatMessage('Sistema', `${remote.characterName} saiu do jogo.`, 'system');
          remote.destroy();
          this.remotePlayers.delete(payload.playerId);
        }
      },
      onChat: (payload: S2C_ChatPayload) => {
        const isSelf = payload.senderId === this.player.playerData.id;
        this.addChatMessage(payload.senderName, payload.message, isSelf ? 'self' : 'player');

        // Exibe balão flutuante acima da cabeça do personagem
        if (isSelf) {
          this.events.emit('floating-text', {
            x: this.player.x,
            y: this.player.y - 30,
            text: `💬 "${payload.message}"`,
            color: '#fef08a'
          });
        } else {
          const remote = this.remotePlayers.get(payload.senderId);
          if (remote) {
            remote.showChatBubble(payload.message);
          }
        }
      },
      onCombatEvent: (ev: S2C_CombatEventPayload) => {
        // Exibe efeitos de combate de terceiros
        if (ev.damage && ev.targetId) {
          const targetMob = this.monsters.find(m => m.id === ev.targetId);
          if (targetMob) {
            this.events.emit('floating-text', {
              x: targetMob.x,
              y: targetMob.y - 15,
              text: `-${ev.damage}`,
              color: '#ffffff'
            });
          }
        }
      },
      onError: (err) => {
        this.addChatMessage('Erro', err.message, 'system');
      }
    });

    this.multiplayerClient
      .connect('plains_01', this.initialPlayerData.id)
      .catch((err) => {
        console.warn('[Multiplayer] Conexão WebSocket não disponível, operando em modo offline:', err);
      });
  }

  private handleWorldSnapshot(snapshot: WorldSnapshot): void {
    const presentPlayerIds = new Set<string>();

    for (const p of snapshot.players) {
      if (p.id === this.player.playerData.id) {
        // 1. Reconciliação do jogador local com o estado do servidor
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, p.x, p.y);
        if (dist > 28) {
          // Desvio significativo: reconcilia suavemente para a posição oficial do servidor
          this.player.setPosition(p.x, p.y);
        }

        // Sincroniza atributos vitais
        this.player.playerData.attributes.currentHp = p.hp;
        this.player.playerData.attributes.maxHp = p.maxHp;
        this.player.playerData.attributes.currentMp = p.mp;
        this.player.playerData.attributes.maxMp = p.maxMp;
        this.player.playerData.level = p.level;

        if (p.isDead && !this.player.isDead) {
          this.player.isDead = true;
          this.player.setTint(0x555555);
        }
      } else {
        // 2. Atualização e criação de jogadores remotos
        presentPlayerIds.add(p.id);
        const existingRemote = this.remotePlayers.get(p.id);
        if (existingRemote) {
          existingRemote.updateState(p);
        } else {
          const newRemote = new RemotePlayer(this, p);
          this.remotePlayers.set(p.id, newRemote);
        }
      }
    }

    // 3. Remove jogadores que saíram do mapa/sala
    for (const [id, remote] of this.remotePlayers.entries()) {
      if (!presentPlayerIds.has(id)) {
        remote.destroy();
        this.remotePlayers.delete(id);
      }
    }
  }

  // --- INTERFACE DE CHAT DOM (FASE 5B) ---

  private setupChatUI(): void {
    // Remove container anterior se existir
    const prev = document.getElementById('noobrpg-chat-container');
    if (prev) prev.remove();

    const viewport = document.getElementById('game-viewport') || document.body;

    const chatContainer = document.createElement('div');
    chatContainer.id = 'noobrpg-chat-container';

    const chatMessages = document.createElement('div');
    chatMessages.id = 'noobrpg-chat-messages';

    const chatInput = document.createElement('input');
    chatInput.id = 'noobrpg-chat-input';
    chatInput.type = 'text';
    chatInput.maxLength = 120;
    chatInput.placeholder = 'Pressione Enter para conversar...';

    chatContainer.appendChild(chatMessages);
    chatContainer.appendChild(chatInput);
    viewport.appendChild(chatContainer);

    this.chatContainerEl = chatContainer;
    this.chatInputEl = chatInput;
    this.chatMessagesEl = chatMessages;

    // Foco no chat ao apertar ENTER
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (document.activeElement !== chatInput) {
        chatInput.focus();
      }
    });

    // Envio ao apertar ENTER dentro do campo
    chatInput.addEventListener('keydown', (e) => {
      e.stopPropagation(); // Impede o Phaser de capturar letras ao digitar

      if (e.key === 'Enter') {
        const text = chatInput.value.trim();
        if (text.length > 0) {
          this.multiplayerClient?.sendChat(text);
          chatInput.value = '';
        }
        chatInput.blur();
      } else if (e.key === 'Escape') {
        chatInput.value = '';
        chatInput.blur();
      }
    });

    this.addChatMessage('Guia', 'Bem-vindo ao NoobRPG Multiplayer! Digite Enter para conversar.', 'system');
  }

  private addChatMessage(sender: string, message: string, type: 'player' | 'self' | 'system'): void {
    if (!this.chatMessagesEl) return;

    const line = document.createElement('div');
    line.className = 'chat-line';

    const senderSpan = document.createElement('span');
    senderSpan.className = type === 'system' ? 'chat-system' : type === 'self' ? 'chat-sender self' : 'chat-sender';
    senderSpan.textContent = type === 'system' ? `[${sender}]: ` : `${sender}: `;

    const bodySpan = document.createElement('span');
    bodySpan.className = type === 'system' ? 'chat-system' : 'chat-body';
    bodySpan.textContent = message;

    line.appendChild(senderSpan);
    line.appendChild(bodySpan);
    this.chatMessagesEl.appendChild(line);

    // Auto-scroll para a mensagem mais recente
    this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
  }

  private spawnGatheringNodes(): void {
    const treeNode1 = new GatheringNode(this, 90, 80, GatheringNodeType.TREE);
    const treeNode2 = new GatheringNode(this, 300, 210, GatheringNodeType.TREE);
    this.gatheringNodes.push(treeNode1, treeNode2);
    this.propsGroup.add(treeNode1);
    this.propsGroup.add(treeNode2);

    const oreNode1 = new GatheringNode(this, 140, 60, GatheringNodeType.ORE_VEIN);
    const oreNode2 = new GatheringNode(this, 260, 60, GatheringNodeType.ORE_VEIN);
    this.gatheringNodes.push(oreNode1, oreNode2);
    this.propsGroup.add(oreNode1);
    this.propsGroup.add(oreNode2);

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

    this.events.on('spawn-ground-item', (data: { x: number; y: number; itemId: string; quantity: number }) => {
      const groundItem = new GroundItem(this, data.x, data.y, data.itemId, data.quantity);
      this.groundItems.push(groundItem);
    });

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

    this.autoSaveTimer = this.time.addEvent({
      delay: 20000,
      loop: true,
      callback: () => this.saveProgress()
    });

    this.events.on('request-save-and-exit', async () => {
      await this.saveProgress(true);
      if (this.chatContainerEl) {
        this.chatContainerEl.remove();
      }
      this.multiplayerClient?.disconnect();
      this.scene.stop('UIScene');
      this.scene.start('CharacterSelectScene');
    });
  }

  public async saveProgress(isLeaving: boolean = false): Promise<void> {
    if (!this.player || !this.player.playerData) return;
    const charId = this.player.playerData.id;
    if (charId === 'local_player_1') return;

    try {
      if (isLeaving) {
        this.multiplayerClient?.disconnect();
        try {
          await ApiClient.leaveSimulation(charId);
        } catch {
          await ApiClient.saveCharacter(charId, {
            position: { x: Math.round(this.player.x), y: Math.round(this.player.y) },
            hp: this.player.playerData.attributes.currentHp,
            mp: this.player.playerData.attributes.currentMp,
            inventory: this.player.playerData.inventory,
            equipped: this.player.playerData.equipped
          });
        }
      }

      this.events.emit('floating-text', {
        x: this.player.x,
        y: this.player.y - 14,
        text: '💾 PROGRESSO SINCRONIZADO',
        color: '#34d399'
      });
    } catch (err) {
      console.warn('[AutoSave] Falha ao persistir no servidor:', err);
    }
  }
}
