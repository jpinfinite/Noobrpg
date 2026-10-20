import { WebSocket } from 'ws';
import {
  NetMessageType,
  WorldSnapshot,
  WorldSnapshotDelta,
  PlayerSnapshotState,
  S2C_JoinedPayload,
  S2C_PlayerJoinedPayload,
  S2C_PlayerLeftPayload,
  S2C_ChatPayload,
  S2C_PongPayload,
  S2C_CombatEventPayload,
  S2C_QuestUpdatePayload,
  S2C_PendingRewardsUpdatePayload,
  S2C_MapChangedPayload,
  S2C_InventoryUpdatePayload,
  S2C_AchievementsUpdatePayload,
  S2C_AchievementUnlockedPayload,
  S2C_TitleEquippedPayload,
  MonsterType
} from '@noobrpg/shared';
import { Room, RoomClient } from './Room.js';
import { GameSimulation, CombatEvent } from '../simulation/GameSimulation.js';
import { ServerPlayer } from '../simulation/ServerPlayer.js';
import { CharacterService } from '../services/characterService.js';
import { AchievementService } from '../services/achievementService.js';
import { SIMULATION_CONSTANTS } from '../simulation/SimulationConstants.js';
import { AreaOfInterestManager } from './AreaOfInterestManager.js';

export class PlainsRoom extends Room {
  public readonly id: string = 'plains_01';
  public readonly name: string = 'Planícies Iniciais';
  public readonly maxPlayers: number = 50;
  public readonly simulation: GameSimulation;
  public readonly aoiManager: AreaOfInterestManager = new AreaOfInterestManager();

  private tickTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastProcessedCombatEventIndex: number = 0;
  private saveQueue: Map<string, Promise<void>> = new Map();

  constructor(
    private characterService: CharacterService,
    existingSimulation?: GameSimulation,
    private achievementService?: AchievementService
  ) {
    super();
    this.simulation = existingSimulation || new GameSimulation();
    if (this.achievementService) {
      this.setupAchievementListeners();
    }
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.tickTimer = setInterval(() => {
      this.tick();
    }, SIMULATION_CONSTANTS.TICK_INTERVAL_MS);
    if (this.tickTimer && typeof (this.tickTimer as any).unref === 'function') {
      (this.tickTimer as any).unref();
    }
  }

  public stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.isRunning = false;
  }

  private setupAchievementListeners(): void {
    this.simulation.onMonsterKilled = async (killerId, monsterType) => {
      await this.recordAchievement(killerId, 'ach_first_blood', 1);
      if (monsterType === MonsterType.SLIME) {
        await this.recordAchievement(killerId, 'ach_slime_hunter', 1);
      } else if (monsterType === MonsterType.SKELETON) {
        await this.recordAchievement(killerId, 'ach_skeleton_slayer', 1);
      }
    };

    this.simulation.onGatherCompleted = async (playerId, itemId, quantity) => {
      if (itemId === 'wood') {
        await this.recordAchievement(playerId, 'ach_woodcutter', quantity);
      } else if (itemId === 'iron_ore') {
        await this.recordAchievement(playerId, 'ach_miner', quantity);
      } else if (itemId === 'herb') {
        await this.recordAchievement(playerId, 'ach_herbalist', quantity);
      }
    };

    this.simulation.onPlayerLeveledUp = async (playerId, newLevel) => {
      if (newLevel >= 5) {
        await this.recordAchievement(playerId, 'ach_level_up', 1);
      }
    };
  }

  public async recordAchievement(characterId: string, achievementId: string, amount: number = 1): Promise<void> {
    if (!this.achievementService) return;
    try {
      const res = await this.achievementService.recordProgress(characterId, achievementId, amount);
      if (res && res.unlocked) {
        const unlockPayload: S2C_AchievementUnlockedPayload = {
          achievementId,
          name: res.achievement.name,
          rewardClaimed: false
        };
        this.send(characterId, NetMessageType.S2C_ACHIEVEMENT_UNLOCKED, unlockPayload);
        await this.sendAchievementsUpdate(characterId);
      }
    } catch (err) {
      console.error(`[Achievements] Erro ao registrar progresso de ${achievementId} para ${characterId}:`, err);
    }
  }

  public async sendAchievementsUpdate(characterId: string): Promise<void> {
    if (!this.achievementService) return;
    try {
      const summary = await this.achievementService.getAchievementsSummary(characterId);
      const payload: S2C_AchievementsUpdatePayload = {
        achievements: summary.achievements,
        unlockedCount: summary.unlockedCount,
        totalCount: summary.totalCount,
        unlockedTitles: summary.unlockedTitles,
        activeTitle: summary.activeTitle
      };
      this.send(characterId, NetMessageType.S2C_ACHIEVEMENTS_UPDATE, payload);
    } catch (err) {
      console.error(`[Achievements] Erro ao enviar atualização de conquistas para ${characterId}:`, err);
    }
  }

  /**
   * Ciclo principal da sala executado a 20 Hz com AOI e sincronização por deltas
   */
  private tick(): void {
    const prevEventsLength = this.simulation.combatEvents.length;

    // 1. Atualiza a física e a simulação de combate autoritativa
    this.simulation.tick(SIMULATION_CONSTANTS.TICK_INTERVAL_MS);

    // 2. Transmite eventos de combate ocorridos neste tick filtrados por relevância espacial (AOI)
    if (this.simulation.combatEvents.length > this.lastProcessedCombatEventIndex) {
      const newEvents = this.simulation.combatEvents.slice(this.lastProcessedCombatEventIndex);
      this.lastProcessedCombatEventIndex = this.simulation.combatEvents.length;

      for (const ev of newEvents) {
        const payload: S2C_CombatEventPayload = {
          type: ev.type,
          attackerId: ev.attackerId,
          targetId: ev.targetId,
          damage: ev.damage,
          xpAwarded: ev.xpAwarded,
          goldAwarded: ev.goldAwarded,
          newLevel: ev.newLevel,
          timestamp: ev.timestamp
        };

        for (const [charId, client] of this.clients.entries()) {
          const isParticipant = charId === ev.attackerId || charId === ev.targetId;
          const isAttackerVisible = this.aoiManager.isEntityVisibleToClient(charId, ev.attackerId);
          const isTargetVisible = this.aoiManager.isEntityVisibleToClient(charId, ev.targetId);

          if (isParticipant || isAttackerVisible || isTargetVisible) {
            this.send(charId, NetMessageType.S2C_COMBAT_EVENT, payload);
          }
        }
      }
    }

    // Se o buffer de eventos foi compactado na GameSimulation, ajusta o índice
    if (this.lastProcessedCombatEventIndex > this.simulation.combatEvents.length) {
      this.lastProcessedCombatEventIndex = this.simulation.combatEvents.length;
    }

    // 3. Sincronização eficiente de snapshots e deltas baseados em Área de Interesse (AOI)
    if (this.clients.size > 0) {
      for (const [charId, client] of this.clients.entries()) {
        const packet = this.aoiManager.generatePacketForClient(
          charId,
          this.simulation.players,
          this.simulation.monsters,
          this.simulation.gatheringNodes,
          this.simulation.groundItems
        );

        if (packet) {
          if (packet.type === 'FULL' && packet.snapshot) {
            this.send(charId, NetMessageType.S2C_SNAPSHOT, packet.snapshot);
          } else if (packet.type === 'DELTA' && packet.delta) {
            this.send(charId, NetMessageType.S2C_SNAPSHOT_DELTA, packet.delta);
          }
        }
      }
    }
  }

  public async onJoin(client: RoomClient): Promise<boolean> {
    // 1. Validação de capacidade da sala
    if (this.clients.size >= this.maxPlayers) {
      this.sendError(client.socket, 'ROOM_FULL', 'A sala atingiu a capacidade máxima de jogadores.');
      return false;
    }

    // 2. Tratamento de reconexão / sessão duplicada
    if (this.clients.has(client.characterId)) {
      const existingClient = this.clients.get(client.characterId)!;
      try {
        (existingClient.socket as any).isReplaced = true;
        existingClient.socket.send(
          JSON.stringify({
            type: NetMessageType.S2C_ERROR,
            payload: { code: 'REPLACED_SESSION', message: 'Sua sessão foi substituída por uma nova conexão.' }
          })
        );
        existingClient.socket.close();
      } catch (e) {
        // Ignora erro ao fechar conexão anterior
      }
      this.clients.delete(client.characterId);
    }

    // 3. Carrega o personagem no motor de simulação (se ainda não presente)
    let player = this.simulation.getPlayer(client.characterId);
    if (!player) {
      const playerData = await this.characterService.getCharacter(client.accountId, client.characterId);
      const charRecord = await this.characterService.getCharacterRecord(client.characterId);
      player = this.simulation.joinPlayer(playerData, client.accountId, charRecord?.version || 1, client.mapKey || 'map_prototype');
    } else if (client.mapKey) {
      player.mapKey = client.mapKey;
    }

    // Registra o cliente na sala
    this.clients.set(client.characterId, client);

    const playerState: PlayerSnapshotState = {
      id: player.id,
      name: player.name,
      characterClass: player.characterClass,
      level: player.level,
      x: Math.round(player.x),
      y: Math.round(player.y),
      hp: player.hp,
      maxHp: player.getMaxHp(),
      mp: player.mp,
      maxMp: player.getMaxMp(),
      isDead: player.isDead
    };

    // 4. Envia confirmação de entrada com dados iniciais
    const joinedPayload: S2C_JoinedPayload = {
      roomId: this.id,
      characterId: player.id,
      name: player.name,
      tickRate: SIMULATION_CONSTANTS.TICK_RATE,
      map: 'map_plains_01',
      playerState
    };
    client.socket.send(JSON.stringify({ type: NetMessageType.S2C_JOINED, payload: joinedPayload }));

    // 5. Registra o cliente no gerenciador de Área de Interesse (AOI) e envia Full Snapshot inicial
    this.aoiManager.registerClient(client.characterId);
    const initialPacket = this.aoiManager.generatePacketForClient(
      client.characterId,
      this.simulation.players,
      this.simulation.monsters,
      this.simulation.gatheringNodes,
      this.simulation.groundItems,
      true
    );
    if (initialPacket && initialPacket.snapshot) {
      this.send(client.characterId, NetMessageType.S2C_SNAPSHOT, initialPacket.snapshot);
    }

    // 6. Sincroniza estado de missões do jogador
    const quests = player.getAllQuests();
    for (const q of Object.values(quests)) {
      const questPayload: S2C_QuestUpdatePayload = {
        quest: q,
        message: 'Missão sincronizada.'
      };
      this.send(client.characterId, NetMessageType.S2C_QUEST_UPDATE, questPayload);
    }

    // 6b. Sincroniza recompensas pendentes se houver
    if (player.pendingRewards && player.pendingRewards.length > 0) {
      this.sendPendingRewardsUpdate(client.characterId, 'Você possui recompensas pendentes para resgatar!');
    }

    // 6c. Sincroniza conquistas do jogador
    if (this.achievementService) {
      this.sendAchievementsUpdate(client.characterId);
    }

    // 7. Notifica jogadores próximos sobre a entrada
    const notifyOtherPayload: S2C_PlayerJoinedPayload = {
      player: playerState
    };
    for (const [otherId, otherClient] of this.clients.entries()) {
      if (otherId === client.characterId) continue;
      const otherPlayer = this.simulation.getPlayer(otherId);
      if (otherPlayer && this.aoiManager.isEntityInAOI(player.x, player.y, otherPlayer.x, otherPlayer.y, true)) {
        this.send(otherId, NetMessageType.S2C_PLAYER_JOINED, notifyOtherPayload);
      }
    }

    return true;
  }

  public async onLeave(characterId: string): Promise<void> {
    this.aoiManager.unregisterClient(characterId);

    const client = this.clients.get(characterId);
    if (client) {
      this.clients.delete(characterId);
    }

    // Salva o personagem autoritativamente no banco de dados e remove da simulação
    const player = this.simulation.getPlayer(characterId);
    if (player) {
      try {
        await this.savePlayerAuthoritative(player);
      } catch (err) {
        // Falha no salvamento é registrada sem quebrar a remoção
      } finally {
        this.saveQueue.delete(characterId);
      }
      this.simulation.leavePlayer(characterId);
    }

    // Notifica os demais jogadores na sala
    const leftPayload: S2C_PlayerLeftPayload = {
      playerId: characterId
    };
    this.broadcast(NetMessageType.S2C_PLAYER_LEFT, leftPayload);
  }

  public async onMessage(characterId: string, type: NetMessageType, payload: any): Promise<void> {
    const client = this.clients.get(characterId);
    if (!client) return;

    switch (type) {
      case NetMessageType.C2S_MOVE: {
        if (typeof payload?.targetX === 'number' && typeof payload?.targetY === 'number') {
          const dt = typeof payload.clientDt === 'number' ? payload.clientDt : 50;
          this.simulation.processMove(characterId, payload.targetX, payload.targetY, dt);
        }
        break;
      }

      case NetMessageType.C2S_ATTACK: {
        if (typeof payload?.targetMonsterId === 'string') {
          const res = this.simulation.processAttack(characterId, payload.targetMonsterId);
          if (res.success) {
            if (res.questUpdated) {
              this.characterService.saveQuestProgress(characterId, res.questUpdated).catch(err => {
                console.error(`[Quest] Falha ao persistir quest para ${characterId}:`, err);
              });
              const kills = res.questUpdated.claimedRewards.filter(r => r.startsWith('slime_kill_')).length;
              const questPayload: S2C_QuestUpdatePayload = {
                quest: res.questUpdated,
                message: res.questUpdated.step === 2
                  ? 'Objetivo de caça concluído (3/3 slimes)! Fale com o Guarda do Portão.'
                  : `Slime derrotado! (${kills}/3)`
              };
              this.send(characterId, NetMessageType.S2C_QUEST_UPDATE, questPayload);
            }
          } else {
            this.sendError(client.socket, 'ATTACK_REJECTED', res.reason || 'Ataque inválido.');
          }
        }
        break;
      }

      case NetMessageType.C2S_SKILL1: {
        if (typeof payload?.targetMonsterId === 'string') {
          const res = this.simulation.processSkill1(characterId, payload.targetMonsterId);
          if (res.success) {
            if (res.questUpdated) {
              this.characterService.saveQuestProgress(characterId, res.questUpdated).catch(err => {
                console.error(`[Quest] Falha ao persistir quest para ${characterId}:`, err);
              });
              const kills = res.questUpdated.claimedRewards.filter(r => r.startsWith('slime_kill_')).length;
              const questPayload: S2C_QuestUpdatePayload = {
                quest: res.questUpdated,
                message: res.questUpdated.step === 2
                  ? 'Objetivo de caça concluído (3/3 slimes)! Fale com o Guarda do Portão.'
                  : `Slime derrotado! (${kills}/3)`
              };
              this.send(characterId, NetMessageType.S2C_QUEST_UPDATE, questPayload);
            }
          } else {
            this.sendError(client.socket, 'SKILL_REJECTED', res.reason || 'Habilidade indisponível.');
          }
        }
        break;
      }

      case NetMessageType.C2S_GATHER: {
        if (typeof payload?.nodeId === 'string') {
          const res = this.simulation.processGather(characterId, payload.nodeId);
          if (!res.success) {
            this.sendError(client.socket, 'GATHER_REJECTED', res.reason || 'Coleta indisponível.');
          }
        }
        break;
      }

      case NetMessageType.C2S_PICKUP: {
        if (typeof payload?.groundItemId === 'string') {
          const res = this.simulation.processPickup(characterId, payload.groundItemId);
          if (res.success) {
            const player = this.simulation.getPlayer(characterId);
            if (player) {
              this.savePlayerAuthoritative(player);
              this.sendInventoryUpdate(characterId, `Item recolhido: ${res.itemId} (x${res.quantity})`);
            }
          } else {
            this.sendError(client.socket, 'PICKUP_FAILED', res.reason || 'Falha ao recolher item.');
          }
        }
        break;
      }

      case NetMessageType.C2S_CRAFT: {
        if (typeof payload?.recipeId === 'string') {
          const res = this.simulation.processCraft(characterId, payload.recipeId);
          if (res.success) {
            const player = this.simulation.getPlayer(characterId);
            if (player) {
              this.savePlayerAuthoritative(player);
              this.sendInventoryUpdate(characterId, `Item fabricado com sucesso: ${res.resultItemId}!`);
              if (res.resultItemId && res.resultItemId.startsWith('potion_')) {
                this.recordAchievement(characterId, 'ach_alchemist_initiate', 1);
              } else {
                this.recordAchievement(characterId, 'ach_blacksmith_apprentice', 1);
              }
            }
          } else {
            this.sendError(client.socket, 'CRAFT_FAILED', res.reason || 'Falha na fabricação do item.');
          }
        }
        break;
      }

      case NetMessageType.C2S_USE_ITEM: {
        if (typeof payload?.slotIndex === 'number') {
          const res = this.simulation.processUseItem(characterId, payload.slotIndex);
          if (res.success) {
            const player = this.simulation.getPlayer(characterId);
            if (player) {
              this.savePlayerAuthoritative(player);
              this.sendInventoryUpdate(characterId, 'Consumível utilizado.');
            }
          } else {
            this.sendError(client.socket, 'USE_ITEM_FAILED', res.reason || 'Falha ao usar item.');
          }
        }
        break;
      }

      case NetMessageType.C2S_EQUIP: {
        if (typeof payload?.slotIndex === 'number') {
          const res = this.simulation.processEquip(characterId, payload.slotIndex);
          if (res.success) {
            const player = this.simulation.getPlayer(characterId);
            if (player) {
              this.savePlayerAuthoritative(player);
              this.sendInventoryUpdate(characterId, 'Equipamento atualizado.');
              if (player.equipped.weapon && player.equipped.armor && player.equipped.accessory) {
                this.recordAchievement(characterId, 'ach_fully_equipped', 1);
              }
            }
          } else {
            this.sendError(client.socket, 'EQUIP_FAILED', res.reason || 'Falha ao equipar item.');
          }
        }
        break;
      }

      case NetMessageType.C2S_CHANGE_MAP: {
        if (typeof payload?.targetMapKey === 'string') {
          const res = this.simulation.processChangeMap(characterId, payload.targetMapKey);
          if (res.success && res.mapKey) {
            const player = this.simulation.getPlayer(characterId);
            if (player) {
              this.savePlayerAuthoritative(player);
              this.recordAchievement(characterId, 'ach_explorer', 1);
              const mapChangedPayload: S2C_MapChangedPayload = {
                mapKey: res.mapKey,
                spawnX: res.spawnX || 464,
                spawnY: res.spawnY || 320,
                message: `Transição autoritativa concluída para o mapa ${res.mapKey}.`
              };
              this.send(characterId, NetMessageType.S2C_MAP_CHANGED, mapChangedPayload);

              // Re-sincroniza Área de Interesse (AOI) e snapshot imediato
              const initialPacket = this.aoiManager.generatePacketForClient(
                characterId,
                this.simulation.players,
                this.simulation.monsters,
                this.simulation.gatheringNodes,
                this.simulation.groundItems,
                true
              );
              if (initialPacket?.snapshot) {
                this.send(characterId, NetMessageType.S2C_SNAPSHOT, initialPacket.snapshot);
              }
            }
          } else {
            this.sendError(client.socket, 'CHANGE_MAP_FAILED', res.reason || 'Transição de mapa não autorizada.');
          }
        }
        break;
      }

      case NetMessageType.C2S_CHAT: {
        if (typeof payload?.message === 'string') {
          const rawMessage = payload.message.trim();
          if (rawMessage.length > 0 && rawMessage.length <= 120) {
            const sanitized = this.sanitizeText(rawMessage);
            const chatPayload: S2C_ChatPayload = {
              senderId: characterId,
              senderName: client.characterName,
              message: sanitized,
              timestamp: Date.now()
            };
            this.broadcast(NetMessageType.S2C_CHAT, chatPayload);
          }
        }
        break;
      }

      case NetMessageType.C2S_PING: {
        const clientTimestamp = typeof payload?.clientTimestamp === 'number' ? payload.clientTimestamp : Date.now();
        const pongPayload: S2C_PongPayload = {
          clientTimestamp,
          serverTime: Date.now()
        };
        this.send(characterId, NetMessageType.S2C_PONG, pongPayload);
        break;
      }

      case NetMessageType.C2S_QUEST_ACTION: {
        if (typeof payload?.questId === 'string' && typeof payload?.npcId === 'string') {
          const result = this.simulation.processQuestAction(
            characterId,
            payload.questId,
            payload.npcId,
            payload.action || 'dialogue_next'
          );

          const player = this.simulation.getPlayer(characterId);
          if (player && result.quest) {
            // Persistência assíncrona autoritativa
            this.characterService.saveQuestProgress(characterId, result.quest).catch(err => {
              console.error(`[Quest] Falha ao persistir quest para ${characterId}:`, err);
            });

            if (result.rewardsAwarded) {
              this.savePlayerAuthoritative(player, 'quest_' + payload.questId);
              this.sendInventoryUpdate(characterId, result.message);
              if (payload.questId === 'quest_tutorial_guard' && result.quest?.completed) {
                this.recordAchievement(characterId, 'ach_tutorial_complete', 1);
              }
            }
          }

          if (!result.success && result.reason) {
            this.sendError(client.socket, result.reason, result.message || 'Ação de missão rejeitada.');
          }

          const questPayload: S2C_QuestUpdatePayload = {
            quest: result.quest || player?.getQuest(payload.questId) || {
              questId: payload.questId,
              step: 0,
              completed: false,
              claimedRewards: []
            },
            rewardsAwarded: result.rewardsAwarded,
            message: result.message
          };
          this.send(characterId, NetMessageType.S2C_QUEST_UPDATE, questPayload);

          if (player && player.pendingRewards.length > 0) {
            this.sendPendingRewardsUpdate(characterId, 'Recompensas excedentes guardadas em pendências.');
          }
        }
        break;
      }

      case NetMessageType.C2S_CLAIM_PENDING_REWARDS: {
        const res = this.simulation.claimPendingRewards(characterId);
        const player = this.simulation.getPlayer(characterId);
        if (player) {
          if (res.claimed.length > 0) {
            this.savePlayerAuthoritative(player);
            this.sendInventoryUpdate(characterId, res.message);
          }
          this.sendPendingRewardsUpdate(characterId, res.message, res.claimed);
        }
        break;
      }

      case NetMessageType.C2S_GET_ACHIEVEMENTS: {
        await this.sendAchievementsUpdate(characterId);
        break;
      }

      case NetMessageType.C2S_EQUIP_TITLE: {
        if (this.achievementService) {
          const titleId = typeof payload?.titleId === 'string' ? payload.titleId : null;
          const success = await this.achievementService.equipTitle(characterId, titleId);
          if (success) {
            const player = this.simulation.getPlayer(characterId);
            if (player) {
              player.activeTitle = titleId;
            }
            const titlePayload: S2C_TitleEquippedPayload = {
              characterId,
              titleId
            };
            this.send(characterId, NetMessageType.S2C_TITLE_EQUIPPED, titlePayload);
            this.broadcast(NetMessageType.S2C_TITLE_EQUIPPED, titlePayload);
          } else {
            this.sendError(client.socket, 'EQUIP_TITLE_FAILED', 'Você não possui este título desbloqueado.');
          }
        }
        break;
      }

      case NetMessageType.C2S_CLAIM_ACHIEVEMENT_REWARD: {
        if (this.achievementService && typeof payload?.achievementId === 'string') {
          const res = await this.achievementService.claimReward(characterId, payload.achievementId);
          if (res.success) {
            const player = this.simulation.getPlayer(characterId);
            if (player && res.reward) {
              if (res.reward.gold) {
                player.addGold(res.reward.gold);
              }
              if (res.reward.items && res.reward.items.length > 0) {
                for (const it of res.reward.items) {
                  this.simulation.deliverItemOrPend(player, it.itemId, it.quantity, `ach_${payload.achievementId}`);
                }
              }
              await this.savePlayerAuthoritative(player, `achievement_${payload.achievementId}`);
              this.sendInventoryUpdate(characterId, 'Recompensa de conquista resgatada com sucesso!');
            }
            await this.sendAchievementsUpdate(characterId);
          } else {
            this.sendError(client.socket, 'CLAIM_REWARD_FAILED', res.reason || 'Falha ao resgatar recompensa.');
          }
        }
        break;
      }

      default:
        // Mensagem desconhecida descartada silenciosamente
        break;
    }
  }

  private sendInventoryUpdate(characterId: string, message?: string): void {
    const player = this.simulation.getPlayer(characterId);
    if (!player) return;

    const payload: S2C_InventoryUpdatePayload = {
      inventory: player.inventory,
      equipped: player.equipped,
      gold: player.gold,
      currentXp: player.currentXp,
      level: player.level,
      pendingRewards: player.pendingRewards,
      message
    };
    this.send(characterId, NetMessageType.S2C_INVENTORY_UPDATE, payload);
  }

  private sendPendingRewardsUpdate(
    characterId: string,
    message?: string,
    claimedItems?: Array<{ itemId: string; quantity: number }>
  ): void {
    const player = this.simulation.getPlayer(characterId);
    if (!player) return;

    const payload: S2C_PendingRewardsUpdatePayload = {
      pendingRewards: player.pendingRewards,
      claimedItems,
      message
    };
    this.send(characterId, NetMessageType.S2C_PENDING_REWARDS_UPDATE, payload);
  }

  private savePlayerAuthoritative(player: ServerPlayer, goldSource?: string): Promise<void> {
    const prevQueue = this.saveQueue.get(player.id) || Promise.resolve();
    const currentSave = prevQueue
      .then(async () => {
        const saved = await this.characterService.saveAuthoritativePlayer(player.id, {
          level: player.level,
          currentXp: player.currentXp,
          gold: player.gold,
          hp: player.hp,
          mp: player.mp,
          x: player.x,
          y: player.y,
          version: player.version,
          inventory: player.inventory,
          equipped: player.equipped,
          quests: player.getAllQuests(),
          pendingRewards: player.pendingRewards,
          goldSource
        });
        player.version = (saved as any).version || (player.version + 1);
      })
      .catch(err => {
        console.error(`[PlainsRoom] Erro ao persistir autoritativamente jogador ${player.id}:`, err);
      });

    this.saveQueue.set(player.id, currentSave);
    return currentSave;
  }

  private sendError(socket: WebSocket, code: string, message: string): void {
    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ type: NetMessageType.S2C_ERROR, payload: { code, message } }));
      } catch (e) {
        // Ignora erro
      }
    }
  }

  private sanitizeText(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
