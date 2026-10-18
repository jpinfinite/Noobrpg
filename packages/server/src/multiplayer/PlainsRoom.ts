import { WebSocket } from 'ws';
import {
  NetMessageType,
  WorldSnapshot,
  PlayerSnapshotState,
  S2C_JoinedPayload,
  S2C_PlayerJoinedPayload,
  S2C_PlayerLeftPayload,
  S2C_ChatPayload,
  S2C_PongPayload,
  S2C_CombatEventPayload
} from '@noobrpg/shared';
import { Room, RoomClient } from './Room.js';
import { GameSimulation, CombatEvent } from '../simulation/GameSimulation.js';
import { CharacterService } from '../services/characterService.js';
import { SIMULATION_CONSTANTS } from '../simulation/SimulationConstants.js';

export class PlainsRoom extends Room {
  public readonly id: string = 'plains_01';
  public readonly name: string = 'Planícies Iniciais';
  public readonly maxPlayers: number = 50;
  public readonly simulation: GameSimulation;

  private tickTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastProcessedCombatEventIndex: number = 0;

  constructor(private characterService: CharacterService, existingSimulation?: GameSimulation) {
    super();
    this.simulation = existingSimulation || new GameSimulation();
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.tickTimer = setInterval(() => {
      this.tick();
    }, SIMULATION_CONSTANTS.TICK_INTERVAL_MS);
  }

  public stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.isRunning = false;
  }

  /**
   * Ciclo principal da sala executado a 20 Hz
   */
  private tick(): void {
    const prevEventsLength = this.simulation.combatEvents.length;

    // 1. Atualiza a física e a simulação de combate autoritativa
    this.simulation.tick(SIMULATION_CONSTANTS.TICK_INTERVAL_MS);

    // 2. Transmite eventos de combate ocorridos neste tick
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
        this.broadcast(NetMessageType.S2C_COMBAT_EVENT, payload);
      }
    }

    // Se o buffer de eventos foi compactado na GameSimulation, ajusta o índice
    if (this.lastProcessedCombatEventIndex > this.simulation.combatEvents.length) {
      this.lastProcessedCombatEventIndex = this.simulation.combatEvents.length;
    }

    // 3. Se houver jogadores conectados, faz broadcast do Snapshot autoritativo a 20 Hz
    if (this.clients.size > 0) {
      const snapshot = this.simulation.getSnapshot();
      this.broadcast(NetMessageType.S2C_SNAPSHOT, snapshot);
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
      player = this.simulation.joinPlayer(playerData, client.accountId, charRecord?.version || 1);
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

    // 5. Notifica todos os demais jogadores sobre a entrada
    const notifyOtherPayload: S2C_PlayerJoinedPayload = {
      player: playerState
    };
    this.broadcast(NetMessageType.S2C_PLAYER_JOINED, notifyOtherPayload, client.characterId);

    return true;
  }

  public async onLeave(characterId: string): Promise<void> {
    const client = this.clients.get(characterId);
    if (!client) return;

    this.clients.delete(characterId);

    // Salva o personagem autoritativamente no banco de dados
    const player = this.simulation.getPlayer(characterId);
    if (player) {
      try {
        await this.characterService.saveAuthoritativePlayer(characterId, {
          level: player.level,
          currentXp: player.currentXp,
          gold: player.gold,
          hp: player.hp,
          mp: player.mp,
          x: player.x,
          y: player.y,
          version: player.version,
          inventory: player.inventory,
          equipped: player.equipped
        });
      } catch (err) {
        // Falha no salvamento é registrada sem quebrar a remoção
      }
      this.simulation.leavePlayer(characterId);
    }

    // Notifica os demais jogadores na sala
    const leftPayload: S2C_PlayerLeftPayload = {
      playerId: characterId
    };
    this.broadcast(NetMessageType.S2C_PLAYER_LEFT, leftPayload);
  }

  public onMessage(characterId: string, type: NetMessageType, payload: any): void {
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
          this.simulation.processAttack(characterId, payload.targetMonsterId);
        }
        break;
      }

      case NetMessageType.C2S_SKILL1: {
        if (typeof payload?.targetMonsterId === 'string') {
          this.simulation.processSkill1(characterId, payload.targetMonsterId);
        }
        break;
      }

      case NetMessageType.C2S_GATHER: {
        if (typeof payload?.nodeId === 'string') {
          this.simulation.processGather(characterId, payload.nodeId);
        }
        break;
      }

      case NetMessageType.C2S_PICKUP: {
        if (typeof payload?.groundItemId === 'string') {
          this.simulation.processPickup(characterId, payload.groundItemId);
        }
        break;
      }

      case NetMessageType.C2S_CRAFT: {
        if (typeof payload?.recipeId === 'string') {
          this.simulation.processCraft(characterId, payload.recipeId);
        }
        break;
      }

      case NetMessageType.C2S_USE_ITEM: {
        if (typeof payload?.slotIndex === 'number') {
          this.simulation.processUseItem(characterId, payload.slotIndex);
        }
        break;
      }

      case NetMessageType.C2S_EQUIP: {
        if (typeof payload?.slotIndex === 'number') {
          this.simulation.processEquip(characterId, payload.slotIndex);
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

      default:
        // Mensagem desconhecida descartada silenciosamente
        break;
    }
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
