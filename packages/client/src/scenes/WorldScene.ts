import Phaser from 'phaser';
import { MonsterType, GatheringNodeType, MonsterDropEntry, PlayerData, CharacterClass, WorldSnapshot, WorldSnapshotDelta, S2C_ChatPayload, S2C_CombatEventPayload } from '@noobrpg/shared';
import { Player } from '../entities/Player.js';
import { Monster } from '../entities/Monster.js';
import { RemotePlayer } from '../entities/RemotePlayer.js';
import { EnvironmentProp } from '../entities/EnvironmentProp.js';
import { GatheringNode } from '../entities/GatheringNode.js';
import { CraftingStation } from '../entities/CraftingStation.js';
import { AlchemyStation } from '../entities/AlchemyStation.js';
import { GroundItem } from '../entities/GroundItem.js';
import { NPC } from '../entities/NPC.js';
import { ApiClient } from '../net/ApiClient.js';
import { MultiplayerClient } from '../net/MultiplayerClient.js';
import { SoundEffects } from '../audio/SoundEffects.js';

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private monsters: Monster[] = [];
  private monstersGroup!: Phaser.Physics.Arcade.Group;
  private propsGroup!: Phaser.Physics.Arcade.StaticGroup;
  private gatheringNodes: GatheringNode[] = [];
  private groundItems: GroundItem[] = [];
  private craftingStation!: CraftingStation;
  private alchemyStation!: AlchemyStation;
  private npcs: NPC[] = [];
  private map!: Phaser.Tilemaps.Tilemap;
  private groundBaseLayer?: Phaser.Tilemaps.TilemapLayer;
  private groundDecoLayer?: Phaser.Tilemaps.TilemapLayer;
  private collisionLayer!: Phaser.Tilemaps.TilemapLayer;
  private overheadFoliageLayer?: Phaser.Tilemaps.TilemapLayer;
  private environmentTrees: EnvironmentProp[] = [];
  private waterAnimationTimer?: Phaser.Time.TimerEvent;
  private initialPlayerData?: PlayerData;
  private autoSaveTimer?: Phaser.Time.TimerEvent;
  private activeMapKey: string = 'map_prototype';

  // Multiplayer em Tempo Real (Fase 5B e 6)
  private localPlayerId: string = '';
  private lastProcessedSeq: number = 0;
  private remotePlayers: Map<string, RemotePlayer> = new Map();
  private multiplayerClient?: MultiplayerClient;
  private lastMoveSentTime: number = 0;
  private lastSentX: number = 0;
  private lastSentY: number = 0;
  private chatContainerEl?: HTMLElement;
  private chatInputEl?: HTMLInputElement;
  private chatMessagesEl?: HTMLElement;
  private isChatMinimized: boolean = false;
  private unreadChatCount: number = 0;
  private chatBadgeEl?: HTMLElement;
  private chatToggleBtnEl?: HTMLElement;
  private gateHintText?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'WorldScene' });
  }

  public init(data: { playerData?: PlayerData }): void {
    if (data?.playerData) {
      this.initialPlayerData = data.playerData;
      this.localPlayerId = data.playerData.id;
    }
  }

  public create(): void {
    // 0. Inicializa sistema de áudio retrô e transição visual suave
    SoundEffects.getInstance().init();
    this.cameras.main.fadeIn(250, 0, 0, 0);

    // 1. Tilemap (Suporta alternância segura para staging via URL param ?map=starter_village)
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const isDarkArt = typeof window !== 'undefined' && (
      searchParams?.get('art') === 'dark' ||
      searchParams?.get('art') === 'new' ||
      localStorage.getItem('art_theme') === 'dark' ||
      (import.meta as any).env?.VITE_NEW_ART === '1'
    );
    const isStarterVillage = isDarkArt || searchParams?.get('map') === 'starter_village';
    const activeMapKey = isDarkArt ? 'map_starter_village_dark' : (isStarterVillage ? 'map_starter_village' : 'map_prototype');
    this.activeMapKey = activeMapKey;

    this.map = this.make.tilemap({ key: activeMapKey });
    const tilesetKey = isDarkArt ? 'tileset_dark' : 'tileset_prototype';
    const tileset = this.map.addTilesetImage(tilesetKey, tilesetKey) || this.map.addTilesetImage('tileset_prototype', 'tileset_prototype');

    if (!tileset) {
      console.error(`Falha ao carregar tileset ${tilesetKey}`);
      return;
    }

    // Camada de solo base (com fallback transparente para 'Ground')
    this.groundBaseLayer = (this.map.createLayer('Ground_Base', tileset, 0, 0) ||
      this.map.createLayer('Ground', tileset, 0, 0)) as Phaser.Tilemaps.TilemapLayer;
    this.groundBaseLayer?.setDepth(0);

    // Camada de decorações do piso (flores, bordas de trilha, seixos)
    this.groundDecoLayer = this.map.createLayer('Ground_Deco', tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer;
    this.groundDecoLayer?.setDepth(1);

    // Camada física sólida de colisão (compatível tanto com propriedade 'collides' quanto exclusão)
    this.collisionLayer = this.map.createLayer('Collision', tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer;
    this.collisionLayer?.setDepth(2);
    this.collisionLayer.setCollisionByProperty({ collides: true });
    this.collisionLayer.setCollisionByExclusion([-1, 0]);

    // Camada superior de folhagem/copas aéreas (renderizada acima das entidades)
    this.overheadFoliageLayer = this.map.createLayer('Overhead_Foliage', tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer;
    this.overheadFoliageLayer?.setDepth(2000);

    // Animação sutil de cintilação do lago em 3 frames (específica do lago do protótipo)
    if (!isStarterVillage) {
      this.setupWaterAnimation();
    }

    // 2. Props decorativos
    this.propsGroup = this.physics.add.staticGroup();
    this.spawnEnvironmentProps();

    // 3. Forja de Crafting na praça (ajustada para a praça da vila inicial em staging)
    const craftingX = isStarterVillage ? 440 : 190;
    const craftingY = isStarterVillage ? 310 : 140;
    this.craftingStation = new CraftingStation(this, craftingX, craftingY);
    this.propsGroup.add(this.craftingStation);

    // 3.2. Bancada de Alquimia (próxima à taverna para preparo de poções)
    const alchemyX = isStarterVillage ? 530 : 220;
    const alchemyY = isStarterVillage ? 290 : 180;
    this.alchemyStation = new AlchemyStation(this, alchemyX, alchemyY);
    this.propsGroup.add(this.alchemyStation);

    // 3.5. NPCs Interativos (Ferreiro Brann e Ancião Aldor)
    this.spawnNpcs(isStarterVillage);

    // 4. Nós de Coleta
    this.spawnGatheringNodes(isStarterVillage);

    // 5. Jogador carregado com dados autoritativos do servidor
    const defaultSpawnX = isStarterVillage ? 464 : 180;
    const defaultSpawnY = isStarterVillage ? 320 : 160;
    const spawnX = this.initialPlayerData?.position?.x || defaultSpawnX;
    const spawnY = this.initialPlayerData?.position?.y || defaultSpawnY;
    const charClass = this.initialPlayerData?.characterClass || CharacterClass.WARRIOR;
    this.player = new Player(this, spawnX, spawnY, charClass, this.initialPlayerData);
    this.lastSentX = spawnX;
    this.lastSentY = spawnY;

    // 6. Monstros locais/estáticos
    this.monstersGroup = this.physics.add.group();
    this.spawnMonsters(isStarterVillage);

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

    const updateCameraZoom = () => {
      const h = this.scale.height;
      // Proporção ideal para visualização confortável de pixel art (exibe ~240-300px verticais)
      const optimalZoom = Math.max(1.75, Math.min(3.5, h / 280));
      this.cameras.main.setZoom(optimalZoom);
    };
    updateCameraZoom();

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.cameras.main.setSize(gameSize.width, gameSize.height);
      updateCameraZoom();
    });

    // 9. Handlers de eventos de loot e textos flutuantes
    this.setupEventListeners();

    // 10. Conexão Multiplayer em Tempo Real (Fase 5B)
    this.setupMultiplayer();

    // 11. Interface de Chat no DOM
    this.setupChatUI();

    // 12. Indicador Flutuante de Portões de Transição
    this.gateHintText = this.add.text(0, 0, '', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#facc15',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      padding: { x: 5, y: 3 }
    }).setOrigin(0.5, 1).setDepth(1500).setVisible(false);

    // 13. Seletor de Mapa Dev/Staging (permite alternar para a Vila Inicial do Unity)
    this.setupDevMapToggle(isStarterVillage);

    // 13. UIScene
    this.scene.launch('UIScene', { player: this.player });

    // 14. Hook de encerramento da cena (limpeza garantida)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdown());
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
        const clientDt = this.lastMoveSentTime > 0 ? Math.round(time - this.lastMoveSentTime) : 50;
        this.lastMoveSentTime = time;
        this.lastSentX = curX;
        this.lastSentY = curY;
        this.multiplayerClient?.sendMove(curX, curY, clientDt);
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

    // Atualiza interação com a bigorna e bancada de alquimia
    if (this.craftingStation) {
      this.craftingStation.updateStation(this.player, this.player.isInteractDown);
    }
    if (this.alchemyStation) {
      this.alchemyStation.updateStation(this.player, this.player.isInteractDown);
    }

    // Atualiza NPCs interativos (Ferreiro Brann e Ancião Aldor)
    for (const npc of this.npcs) {
      npc.updateNPC(delta, this.player, this.player.isInteractDown);
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

    // Atualiza oclusão da copa das árvores de cenário
    if (this.player) {
      for (const tree of this.environmentTrees) {
        tree.updateCanopyOcclusion(this.player.x, this.player.y);
      }

      // Checagem de saídas / portões bidirecionais
      const isVillage = this.activeMapKey === 'map_starter_village';
      if (isVillage) {
        const distNorth = Phaser.Math.Distance.Between(this.player.x, this.player.y, 456, 30);
        const distSouth = Phaser.Math.Distance.Between(this.player.x, this.player.y, 456, 600);
        const nearNorth = distNorth <= 40;
        const nearSouth = distSouth <= 40;
        if (nearNorth || nearSouth) {
          if (this.gateHintText) {
            this.gateHintText
              .setText(nearNorth ? '[F] Portão Norte (Planícies)' : '[F] Portão Sul (Planícies)')
              .setPosition(this.player.x, this.player.y - 28)
              .setVisible(true);
          }
          if (this.player.isInteractDown) {
            this.events.emit('request-change-map', {
              targetMapKey: 'map_prototype',
              transitionZone: nearNorth ? 'gate_north' : 'gate_south'
            });
          }
        } else if (this.gateHintText && this.gateHintText.visible) {
          this.gateHintText.setVisible(false);
        }
      } else {
        const distPlainsGate = Phaser.Math.Distance.Between(this.player.x, this.player.y, 180, 160);
        if (distPlainsGate <= 40) {
          if (this.gateHintText) {
            this.gateHintText
              .setText('[F] Estrada para a Vila Inicial')
              .setPosition(this.player.x, this.player.y - 28)
              .setVisible(true);
          }
          if (this.player.isInteractDown) {
            this.events.emit('request-change-map', {
              targetMapKey: 'map_starter_village',
              transitionZone: 'gate_plains_to_village'
            });
          }
        } else if (this.gateHintText && this.gateHintText.visible) {
          this.gateHintText.setVisible(false);
        }
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
      onSnapshotDelta: (delta: WorldSnapshotDelta) => {
        this.handleWorldSnapshotDelta(delta);
      },
      onPlayerJoined: (payload) => {
        const p = payload.player;
        if (!p || p.id === this.localPlayerId || (this.player && p.id === this.player.playerData.id)) {
          return;
        }
        const existing = this.remotePlayers.get(p.id);
        if (existing) {
          existing.updateState(p);
        } else {
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
        const isSelf = payload.senderId === this.localPlayerId || (this.player && payload.senderId === this.player.playerData.id);
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
        // 1. Se o atacante for um jogador remoto, dispara a animação de ataque nele
        const remoteAttacker = this.remotePlayers.get(ev.attackerId);
        const targetMob = this.monsters.find(m => m.id === ev.targetId);

        if (remoteAttacker && targetMob) {
          const isSkill = ev.type === 'PLAYER_SKILL';
          remoteAttacker.playAttackVisual(targetMob.x, targetMob.y, isSkill);
        }

        // 2. Se houver dano contra um monstro, dispara o feedback visual e sonoro
        if (ev.damage && targetMob) {
          const attackerX = remoteAttacker ? remoteAttacker.x : this.player.x;
          const attackerY = remoteAttacker ? remoteAttacker.y : this.player.y;
          targetMob.playHitFeedback(attackerX, attackerY);
          if (remoteAttacker) {
            SoundEffects.getInstance().playHit();
          }

          this.events.emit('floating-text', {
            x: targetMob.x,
            y: targetMob.y - 15,
            text: `-${ev.damage}`,
            color: '#ffffff'
          });
        }
      },
      onError: (err) => {
        this.addChatMessage('Aviso', err.message, 'system');
        if (this.player) {
          this.events.emit('floating-text', {
            x: this.player.x,
            y: this.player.y - 25,
            text: `⚠️ ${err.message}`,
            color: '#f87171'
          });
        }
      },
      onQuestUpdate: (payload) => {
        this.events.emit('quest-updated', payload);
      },
      onInventoryUpdate: (payload) => {
        if (this.player && this.player.playerData) {
          this.player.playerData.inventory = payload.inventory;
          this.player.playerData.equipped = payload.equipped;
          this.player.playerData.gold = payload.gold;
          this.player.playerData.currentXp = payload.currentXp;
          this.player.playerData.level = payload.level;

          this.events.emit('player-updated', this.player.playerData);
          this.events.emit('inventory-updated', payload.inventory);

          if (payload.message) {
            this.addChatMessage('Sistema', payload.message, 'system');
            this.events.emit('floating-text', {
              x: this.player.x,
              y: this.player.y - 25,
              text: payload.message,
              color: '#38bdf8'
            });
          }
        }
      },
      onPendingRewardsUpdate: (payload) => {
        if (this.player) {
          this.player.playerData.pendingRewards = payload.pendingRewards;
          this.events.emit('pending-rewards-updated', payload);
          if (payload.message) {
            this.addChatMessage('Sistema', payload.message, 'system');
            this.events.emit('floating-text', {
              x: this.player.x,
              y: this.player.y - 35,
              text: payload.message,
              color: '#f59e0b'
            });
          }
        }
      },
      onAchievementsUpdate: (payload) => {
        this.events.emit('achievements-updated', payload);
      },
      onAchievementUnlocked: (payload) => {
        this.events.emit('achievement-unlocked', payload);
        const achTitle = payload.achievement?.title || 'Nova Conquista';
        this.addChatMessage('Sistema', `🏆 Conquista Desbloqueada: ${achTitle}!`, 'system');
        if (this.player) {
          this.events.emit('floating-text', {
            x: this.player.x,
            y: this.player.y - 30,
            text: `🏆 ${achTitle}!`,
            color: '#facc15'
          });
        }
      },
      onTitleEquipped: (payload) => {
        if (payload.characterId === this.localPlayerId && this.player) {
          this.player.playerData.activeTitle = payload.titleId;
          this.events.emit('player-updated', this.player.playerData);
        }
        const remote = this.remotePlayers.get(payload.characterId);
        if (remote) {
          remote.setTitle(payload.titleId);
        }
      },
      onMapChanged: (payload) => {
        if (this.player) {
          this.player.setPosition(payload.spawnX, payload.spawnY);
          this.addChatMessage('Sistema', payload.message || `Transição para o mapa ${payload.mapKey}`, 'system');
          this.events.emit('floating-text', {
            x: this.player.x,
            y: this.player.y - 30,
            text: `🗺️ Entrando em: ${payload.mapKey}`,
            color: '#a855f7'
          });

          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            if (payload.mapKey === 'map_starter_village' || payload.mapKey === 'starter_village') {
              url.searchParams.set('map', 'starter_village');
            } else {
              url.searchParams.delete('map');
            }
            window.history.replaceState({}, '', url.toString());
          }

          // Polimento visual: transição suave com fade-out e fallback seguro contra tela preta
          this.cameras.main.fadeOut(250, 0, 0, 0);
          let restarted = false;
          const doRestart = () => {
            if (restarted) return;
            restarted = true;
            this.scene.restart({
              playerData: {
                ...this.player.playerData,
                position: { x: payload.spawnX, y: payload.spawnY }
              }
            });
          };

          this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, doRestart);
          this.time.delayedCall(300, doRestart);
        }
      },
      onDisconnect: () => {
        this.addChatMessage('Aviso', 'Conexão com o servidor perdida. Tentando reconectar...', 'system');
        if (this.player) {
          this.events.emit('floating-text', {
            x: this.player.x,
            y: this.player.y - 20,
            text: '⚠️ CONEXÃO PERDIDA',
            color: '#ef4444'
          });
        }
      }
    });

    this.multiplayerClient
      .connect('plains_01', this.initialPlayerData.id)
      .catch((err) => {
        const targetUrl = this.multiplayerClient?.getServerUrl() || 'desconhecido';
        console.warn(`[Multiplayer] Conexão WebSocket não disponível em ${targetUrl}:`, err);
        this.addChatMessage(
          'Sistema',
          `Servidor multiplayer não acessível (${targetUrl}). Operando em modo de simulação local.`,
          'system'
        );
      });
  }

  private handleWorldSnapshot(snapshot: WorldSnapshot): void {
    if (snapshot.seq && snapshot.seq < this.lastProcessedSeq) {
      return; // Mensagem desordenada descartada
    }
    if (snapshot.seq) this.lastProcessedSeq = snapshot.seq;

    const presentPlayerIds = new Set<string>();

    for (const p of snapshot.players) {
      // 1. Identificação inequívoca do jogador local
      if (p.id === this.localPlayerId || (this.player && p.id === this.player.playerData.id)) {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, p.x, p.y);
        if (dist > 48) {
          // Desvio severo (ex: teleporte, respawn ou colisão intransponível): snap direto
          this.player.setPosition(p.x, p.y);
        } else if (dist > 8) {
          // Desvio moderado por latência de rede em trânsito: reconciliação suave (LERP 20%) sem travamentos
          this.player.x += (p.x - this.player.x) * 0.2;
          this.player.y += (p.y - this.player.y) * 0.2;
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
        continue;
      }

      // 2. Atualização e criação de jogadores remotos com índice estável
      presentPlayerIds.add(p.id);
      const existingRemote = this.remotePlayers.get(p.id);
      if (existingRemote) {
        existingRemote.updateState(p);
      } else {
        const newRemote = new RemotePlayer(this, p);
        this.remotePlayers.set(p.id, newRemote);
      }
    }

    // 3. Remove jogadores que saíram do AOI ou da sala
    for (const [id, remote] of this.remotePlayers.entries()) {
      if (!presentPlayerIds.has(id)) {
        remote.destroy();
        this.remotePlayers.delete(id);
      }
    }

    // 4. Sincroniza monstros a partir do snapshot oficial
    if (snapshot.monsters) {
      for (const mState of snapshot.monsters) {
        let mob = this.monsters.find(m => m.id === mState.id);
        if (!mob) {
          mob = new Monster(this, mState.x, mState.y, mState.type || MonsterType.SLIME, mState.id);
          this.monsters.push(mob);
          this.monstersGroup.add(mob);
        }
        mob.updateFromSnapshot(mState);
      }
    }

    // 5. Sincroniza itens no chão (GroundItems) autoritativos
    if (snapshot.groundItems) {
      for (const itemState of snapshot.groundItems) {
        let existing = this.groundItems.find(gi => (gi as any).serverDropId === itemState.id);
        if (!existing) {
          const newItem = new GroundItem(this, itemState.x, itemState.y, itemState.itemId, itemState.quantity);
          (newItem as any).serverDropId = itemState.id;
          this.groundItems.push(newItem);
        }
      }
    }
  }

  private handleWorldSnapshotDelta(delta: WorldSnapshotDelta): void {
    if (delta.seq && delta.seq < this.lastProcessedSeq) {
      return; // Mensagem desordenada descartada
    }
    if (delta.seq) this.lastProcessedSeq = delta.seq;

    // 1. Novos jogadores entrando no AOI
    if (delta.enteredPlayers) {
      for (const p of delta.enteredPlayers) {
        if (p.id === this.localPlayerId || (this.player && p.id === this.player.playerData.id)) {
          continue;
        }
        const existing = this.remotePlayers.get(p.id);
        if (existing) {
          existing.updateState(p);
        } else {
          const newRemote = new RemotePlayer(this, p);
          this.remotePlayers.set(p.id, newRemote);
        }
      }
    }

    // 2. Jogadores saindo do AOI
    if (delta.removedPlayerIds) {
      for (const id of delta.removedPlayerIds) {
        const remote = this.remotePlayers.get(id);
        if (remote) {
          remote.destroy();
          this.remotePlayers.delete(id);
        }
      }
    }

    // 3. Atualizações de estado/movimento dos jogadores conhecidos
    if (delta.players) {
      for (const pDelta of delta.players) {
        if (pDelta.id === this.localPlayerId || (this.player && pDelta.id === this.player.playerData.id)) {
          if (pDelta.x !== undefined && pDelta.y !== undefined) {
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, pDelta.x, pDelta.y);
            if (dist > 48) {
              this.player.setPosition(pDelta.x, pDelta.y);
            } else if (dist > 8) {
              this.player.x += (pDelta.x - this.player.x) * 0.2;
              this.player.y += (pDelta.y - this.player.y) * 0.2;
            }
          }
          if (pDelta.hp !== undefined) this.player.playerData.attributes.currentHp = pDelta.hp;
          if (pDelta.maxHp !== undefined) this.player.playerData.attributes.maxHp = pDelta.maxHp;
          if (pDelta.mp !== undefined) this.player.playerData.attributes.currentMp = pDelta.mp;
          if (pDelta.maxMp !== undefined) this.player.playerData.attributes.maxMp = pDelta.maxMp;
          if (pDelta.level !== undefined) this.player.playerData.level = pDelta.level;
          if (pDelta.isDead !== undefined && pDelta.isDead && !this.player.isDead) {
            this.player.isDead = true;
            this.player.setTint(0x555555);
          }
          continue;
        }

        const remote = this.remotePlayers.get(pDelta.id);
        if (remote) {
          remote.updateState(pDelta);
        }
      }
    }

    // 4. Atualizações de estado/movimento dos monstros
    if (delta.monsters) {
      for (const mDelta of delta.monsters) {
        let mob = this.monsters.find(m => m.id === mDelta.id);
        if (!mob && mDelta.x !== undefined && mDelta.y !== undefined) {
          mob = new Monster(this, mDelta.x, mDelta.y, MonsterType.SLIME, mDelta.id);
          this.monsters.push(mob);
          this.monstersGroup.add(mob);
        }
        if (mob) {
          mob.updateFromSnapshot(mDelta);
        }
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

    // 1. Cabeçalho do Chat com botão de alternância e badge
    const chatHeader = document.createElement('div');
    chatHeader.id = 'noobrpg-chat-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'chat-header-left';

    const chatTitle = document.createElement('span');
    chatTitle.className = 'chat-header-title';
    chatTitle.textContent = '💬 Chat';

    const chatBadge = document.createElement('span');
    chatBadge.id = 'noobrpg-chat-badge';
    chatBadge.className = 'chat-badge';
    chatBadge.style.display = 'none';
    chatBadge.textContent = '0';

    headerLeft.appendChild(chatTitle);
    headerLeft.appendChild(chatBadge);

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'noobrpg-chat-toggle';
    toggleBtn.className = 'chat-toggle-btn';
    toggleBtn.textContent = '−';
    toggleBtn.title = 'Minimizar / Expandir Chat (ou clique no cabeçalho)';

    chatHeader.appendChild(headerLeft);
    chatHeader.appendChild(toggleBtn);
    chatContainer.appendChild(chatHeader);

    // 2. Mensagens e Input
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
    this.chatBadgeEl = chatBadge;
    this.chatToggleBtnEl = toggleBtn;

    const setChatMinimized = (minimized: boolean) => {
      this.isChatMinimized = minimized;
      if (this.isChatMinimized) {
        chatContainer.classList.add('minimized');
        toggleBtn.textContent = '+';
      } else {
        chatContainer.classList.remove('minimized');
        toggleBtn.textContent = '−';
        this.unreadChatCount = 0;
        chatBadge.style.display = 'none';
        chatBadge.textContent = '0';
      }
    };

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setChatMinimized(!this.isChatMinimized);
    });

    chatHeader.addEventListener('click', () => {
      if (this.isChatMinimized) {
        setChatMinimized(false);
        chatInput.focus();
      }
    });

    // Foco no chat ao apertar ENTER (expande se estiver minimizado)
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.isChatMinimized) {
        setChatMinimized(false);
      }
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

    this.addChatMessage('Guia', 'Bem-vindo ao NoobRPG! Pressione Enter para conversar ou [−] para recolher.', 'system');
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

    // Se estiver minimizado e for mensagem de outro jogador ou sistema, incrementa badge de não lidas
    if (this.isChatMinimized && type !== 'self') {
      this.unreadChatCount++;
      if (this.chatBadgeEl) {
        this.chatBadgeEl.style.display = 'inline-block';
        this.chatBadgeEl.textContent = `${this.unreadChatCount}`;
      }
    }
  }

  private spawnGatheringNodes(isStarterVillage: boolean = false): void {
    if (isStarterVillage) {
      // Nós de coleta posicionados nas áreas periféricas livres da Vila Inicial
      const tree1 = new GatheringNode(this, 220, 180, GatheringNodeType.TREE);
      const tree2 = new GatheringNode(this, 700, 180, GatheringNodeType.TREE);
      this.gatheringNodes.push(tree1, tree2);
      this.propsGroup.add(tree1);
      this.propsGroup.add(tree2);

      const ore1 = new GatheringNode(this, 180, 140, GatheringNodeType.ORE_VEIN);
      const ore2 = new GatheringNode(this, 280, 100, GatheringNodeType.ORE_VEIN);
      this.gatheringNodes.push(ore1, ore2);
      this.propsGroup.add(ore1);
      this.propsGroup.add(ore2);

      const herb1 = new GatheringNode(this, 360, 420, GatheringNodeType.HERB_BUSH);
      const herb2 = new GatheringNode(this, 640, 300, GatheringNodeType.HERB_BUSH);
      this.gatheringNodes.push(herb1, herb2);
      return;
    }

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

  private spawnNpcs(isStarterVillage: boolean): void {
    const elderPos = isStarterVillage ? { x: 464, y: 280 } : { x: 180, y: 120 };
    const blacksmithPos = isStarterVillage ? { x: 410, y: 310 } : { x: 160, y: 140 };
    const guardPos = isStarterVillage ? { x: 450, y: 90 } : { x: 210, y: 130 };
    const tavernPos = isStarterVillage ? { x: 510, y: 290 } : { x: 200, y: 180 };

    const elder = new NPC(this, elderPos.x, elderPos.y, {
      id: 'npc_elder',
      name: 'Ancião Aldor',
      role: 'Guia de Aethelgard',
      textureKey: 'npc_elder',
      nameColor: '#fef08a'
    });

    const blacksmith = new NPC(this, blacksmithPos.x, blacksmithPos.y, {
      id: 'npc_blacksmith',
      name: 'Ferreiro Brann',
      role: 'Mestre da Forja',
      textureKey: 'npc_blacksmith',
      nameColor: '#fb923c'
    });

    const guard = new NPC(this, guardPos.x, guardPos.y, {
      id: 'npc_guard',
      name: 'Guarda Alistair',
      role: 'Sentinela do Portão',
      textureKey: 'npc_guard',
      nameColor: '#38bdf8'
    });

    const tavern = new NPC(this, tavernPos.x, tavernPos.y, {
      id: 'npc_tavern',
      name: 'Taverneiro Tobin',
      role: 'Hospedeiro da Taverna',
      textureKey: 'npc_tavern',
      nameColor: '#4ade80'
    });

    this.npcs.push(elder, blacksmith, guard, tavern);
    this.propsGroup.add(elder);
    this.propsGroup.add(blacksmith);
    this.propsGroup.add(guard);
    this.propsGroup.add(tavern);
  }

  private spawnMonsters(isStarterVillage: boolean = false): void {
    if (isStarterVillage) {
      // Monstros da Zona Exterior da Vila Inicial (fora da Safe Zone da praça central)
      const villageMobs = [
        { id: 'mob_village_slime_1', type: MonsterType.SLIME, x: 620, y: 220 },
        { id: 'mob_village_slime_2', type: MonsterType.SLIME, x: 680, y: 240 },
        { id: 'mob_village_slime_3', type: MonsterType.SLIME, x: 320, y: 460 },
        { id: 'mob_village_goblin_1', type: MonsterType.GOBLIN, x: 260, y: 220 },
        { id: 'mob_village_skeleton_1', type: MonsterType.SKELETON, x: 180, y: 520 },
        { id: 'mob_village_skeleton_2', type: MonsterType.SKELETON, x: 260, y: 540 }
      ];

      villageMobs.forEach(m => {
        const mob = new Monster(this, m.x, m.y, m.type, m.id);
        this.monsters.push(mob);
        this.monstersGroup.add(mob);
      });
      return;
    }

    const slimeSpawns = [
      { id: 'mob_slime_1', x: 220, y: 130 },
      { id: 'mob_slime_2', x: 120, y: 190 },
      { id: 'mob_slime_3', x: 260, y: 190 }
    ];

    slimeSpawns.forEach(pos => {
      const slime = new Monster(this, pos.x, pos.y, MonsterType.SLIME, pos.id);
      this.monsters.push(slime);
      this.monstersGroup.add(slime);
    });

    const goblin = new Monster(this, 280, 70, MonsterType.GOBLIN, 'mob_goblin_1');
    this.monsters.push(goblin);
    this.monstersGroup.add(goblin);

    const skeleton1 = new Monster(this, 100, 70, MonsterType.SKELETON, 'mob_skeleton_1');
    const skeleton2 = new Monster(this, 230, 55, MonsterType.SKELETON, 'mob_skeleton_2');
    this.monsters.push(skeleton1, skeleton2);
    this.monstersGroup.add(skeleton1);
    this.monstersGroup.add(skeleton2);
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
      this.environmentTrees.push(tree);
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
        strokeThickness: 3,
        fontStyle: 'bold'
      });
      text.setOrigin(0.5);
      text.setDepth(9999);
      text.setScale(1.2);

      this.tweens.add({
        targets: text,
        y: data.y - 20,
        scale: 1.0,
        alpha: 0,
        duration: 850,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          text.destroy();
        }
      });
    });

    this.events.on('player-attack-action', (data: { targetMonsterId?: string; isSkill: boolean }) => {
      if (data.targetMonsterId && this.multiplayerClient) {
        if (data.isSkill) {
          this.multiplayerClient.sendSkill1(data.targetMonsterId);
        } else {
          this.multiplayerClient.sendAttack(data.targetMonsterId);
        }
      }
    });

    this.events.on('request-craft-recipe', (data: { recipeId: string }) => {
      if (this.multiplayerClient && this.multiplayerClient.isConnected()) {
        this.multiplayerClient.sendCraft(data.recipeId);
      }
    });

    this.events.on('request-pickup-item', (data: { groundItemId: string }) => {
      if (this.multiplayerClient && this.multiplayerClient.isConnected()) {
        this.multiplayerClient.sendPickup(data.groundItemId);
      }
    });

    this.events.on('request-equip-item', (data: { slotIndex: number }) => {
      if (this.multiplayerClient && this.multiplayerClient.isConnected()) {
        this.multiplayerClient.sendEquip(data.slotIndex);
      }
    });

    this.events.on('request-use-item', (data: { slotIndex: number }) => {
      if (this.multiplayerClient && this.multiplayerClient.isConnected()) {
        this.multiplayerClient.sendUseItem(data.slotIndex);
      }
    });

    this.events.on('request-change-map', (data: { targetMapKey: string; transitionZone?: string }) => {
      if (this.multiplayerClient && this.multiplayerClient.isConnected()) {
        this.multiplayerClient.sendChangeMap(data.targetMapKey, data.transitionZone);
      }
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

    this.events.on('request-quest-action', (data: { questId: string; npcId: string; action?: string }) => {
      if (this.multiplayerClient && this.multiplayerClient.isConnected()) {
        this.multiplayerClient.sendQuestAction(data.questId, data.npcId, data.action);
      }
    });

    this.events.on('claim-pending-rewards', () => {
      if (this.multiplayerClient && this.multiplayerClient.isConnected()) {
        this.multiplayerClient.sendClaimPendingRewards();
      }
    });

    this.events.on('request-get-achievements', () => {
      if (this.multiplayerClient && this.multiplayerClient.isConnected()) {
        this.multiplayerClient.sendGetAchievements();
      }
    });

    this.events.on('request-equip-title', (data: { titleId: string | null }) => {
      if (this.multiplayerClient && this.multiplayerClient.isConnected()) {
        this.multiplayerClient.sendEquipTitle(data.titleId);
      }
    });

    this.events.on('request-claim-achievement-reward', (data: { achievementId: string }) => {
      if (this.multiplayerClient && this.multiplayerClient.isConnected()) {
        this.multiplayerClient.sendClaimAchievementReward(data.achievementId);
      }
    });

    this.input.keyboard?.on('keydown-Y', () => {
      this.events.emit('toggle-achievements');
    });

    this.events.on('request-save-and-exit', async () => {
      await this.saveProgress(true);
      if (this.chatContainerEl) {
        this.chatContainerEl.remove();
        this.chatContainerEl = undefined;
      }
      this.multiplayerClient?.disconnect();
      this.scene.stop('UIScene');
      this.scene.start('CharacterSelectScene');
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.chatContainerEl) {
        this.chatContainerEl.remove();
        this.chatContainerEl = undefined;
      }
      if (this.autoSaveTimer) {
        this.autoSaveTimer.destroy();
      }
      if (this.waterAnimationTimer) {
        this.waterAnimationTimer.destroy();
      }
      this.multiplayerClient?.disconnect();
      this.events.removeAllListeners();
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

  public shutdown(): void {
    if (this.autoSaveTimer) {
      this.autoSaveTimer.remove();
      this.autoSaveTimer = undefined;
    }
    if (this.chatContainerEl) {
      this.chatContainerEl.remove();
      this.chatContainerEl = undefined;
    }
    this.multiplayerClient?.disconnect();
    this.multiplayerClient = undefined;

    if (this.waterAnimationTimer) {
      this.waterAnimationTimer.remove();
      this.waterAnimationTimer = undefined;
    }

    // Destrói todas as entidades remotas ativas e esvazia o registro
    for (const [id, remote] of this.remotePlayers.entries()) {
      remote.destroy();
    }
    this.remotePlayers.clear();
    this.environmentTrees = [];

    for (const npc of this.npcs) {
      npc.destroy();
    }
    this.npcs = [];

    const mapToggle = document.getElementById('noobrpg-dev-map-toggle');
    if (mapToggle) mapToggle.remove();
  }

  private setupDevMapToggle(isStarterVillage: boolean): void {
    const prev = document.getElementById('noobrpg-dev-map-toggle');
    if (prev) prev.remove();

    const viewport = document.getElementById('game-viewport') || document.body;
    const btn = document.createElement('button');
    btn.id = 'noobrpg-dev-map-toggle';
    btn.style.position = 'absolute';
    btn.style.top = '10px';
    btn.style.right = '10px';
    btn.style.zIndex = '99999';
    btn.style.background = 'rgba(15, 23, 42, 0.88)';
    btn.style.color = isStarterVillage ? '#38bdf8' : '#e2e8f0';
    btn.style.border = isStarterVillage ? '1px solid #38bdf8' : '1px solid #475569';
    btn.style.borderRadius = '6px';
    btn.style.padding = '6px 12px';
    btn.style.fontSize = '11px';
    btn.style.fontFamily = 'monospace';
    btn.style.cursor = 'pointer';
    btn.style.backdropFilter = 'blur(6px)';
    btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.6)';
    btn.style.transition = 'all 0.2s ease';
    btn.textContent = isStarterVillage
      ? '🗺️ Vila Inicial (Unity Staging) ➔ Voltar ao Protótipo'
      : '🗺️ Testar Vila Inicial (Unity Staging)';

    btn.title = 'Alternar entre o mapa de produção e a Vila Inicial criada com Unity 6';

    btn.onmouseover = () => {
      btn.style.transform = 'scale(1.04)';
      btn.style.borderColor = '#38bdf8';
    };
    btn.onmouseout = () => {
      btn.style.transform = 'scale(1.0)';
      btn.style.borderColor = isStarterVillage ? '#38bdf8' : '#475569';
    };

    btn.onclick = () => {
      const targetMap = isStarterVillage ? 'map_prototype' : 'map_starter_village';
      if (this.multiplayerClient && this.multiplayerClient.isConnected()) {
        this.events.emit('request-change-map', { targetMapKey: targetMap });
      } else {
        const url = new URL(window.location.href);
        if (isStarterVillage) {
          url.searchParams.delete('map');
        } else {
          url.searchParams.set('map', 'starter_village');
        }
        window.location.href = url.toString();
      }
    };

    viewport.appendChild(btn);
  }

  private setupWaterAnimation(): void {
    if (!this.groundBaseLayer) return;
    let waterFrame = 0;
    const shimmerCoords = [
      [{ x: 23, y: 2 }, { x: 21, y: 3 }, { x: 25, y: 3 }, { x: 24, y: 4 }],
      [{ x: 22, y: 2 }, { x: 24, y: 3 }, { x: 20, y: 4 }, { x: 22, y: 5 }],
      [{ x: 24, y: 2 }, { x: 22, y: 3 }, { x: 23, y: 4 }, { x: 25, y: 5 }]
    ];

    this.waterAnimationTimer = this.time.addEvent({
      delay: 600,
      loop: true,
      callback: () => {
        if (!this.groundBaseLayer) return;
        // Restaura água padrão
        for (const frameCoords of shimmerCoords) {
          for (const pos of frameCoords) {
            this.groundBaseLayer.putTileAt(5, pos.x, pos.y);
          }
        }
        // Aplica o frame de cintilação dinâmico
        waterFrame = (waterFrame + 1) % 3;
        for (const pos of shimmerCoords[waterFrame]) {
          this.groundBaseLayer.putTileAt(16, pos.x, pos.y);
        }
      }
    });
  }
}

