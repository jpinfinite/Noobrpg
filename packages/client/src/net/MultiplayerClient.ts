import {
  NetMessageType,
  WorldSnapshot,
  WorldSnapshotDelta,
  S2C_JoinedPayload,
  S2C_PlayerJoinedPayload,
  S2C_PlayerLeftPayload,
  S2C_ChatPayload,
  S2C_CombatEventPayload,
  S2C_ErrorPayload,
  C2S_JoinPayload,
  C2S_MovePayload,
  C2S_AttackPayload,
  C2S_Skill1Payload,
  C2S_GatherPayload,
  C2S_PickupPayload,
  C2S_CraftPayload,
  C2S_UseItemPayload,
  C2S_EquipPayload,
  C2S_ChatPayload
} from '@noobrpg/shared';

export interface MultiplayerCallbacks {
  onSnapshot?: (snapshot: WorldSnapshot) => void;
  onSnapshotDelta?: (delta: WorldSnapshotDelta) => void;
  onJoined?: (payload: S2C_JoinedPayload) => void;
  onPlayerJoined?: (payload: S2C_PlayerJoinedPayload) => void;
  onPlayerLeft?: (payload: S2C_PlayerLeftPayload) => void;
  onChat?: (payload: S2C_ChatPayload) => void;
  onCombatEvent?: (payload: S2C_CombatEventPayload) => void;
  onError?: (payload: S2C_ErrorPayload) => void;
  onDisconnect?: () => void;
}

export class MultiplayerClient {
  private socket: WebSocket | null = null;
  private currentRoomId: string = 'plains_01';
  private characterId: string | null = null;
  private isIntentionalClose: boolean = false;
  private reconnectTimer: any = null;
  private callbacks: MultiplayerCallbacks = {};
  private serverUrl: string;

  constructor(callbacks: MultiplayerCallbacks = {}, serverWsUrl?: string) {
    this.callbacks = callbacks;
    if (serverWsUrl) {
      this.serverUrl = serverWsUrl;
    } else {
      const customWsUrl = (import.meta as any).env?.VITE_WS_URL as string;
      if (customWsUrl) {
        this.serverUrl = customWsUrl;
      } else if (typeof window !== 'undefined' && window.location.hostname.includes('pages.dev')) {
        this.serverUrl = 'wss://len-bit-election-notebooks.trycloudflare.com/ws';
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname || 'localhost';
        this.serverUrl = `${protocol}//${host}:4000/ws`;
      }
    }
  }

  public getServerUrl(): string {
    return this.serverUrl;
  }

  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  public connect(roomId: string, characterId: string): Promise<S2C_JoinedPayload> {
    this.currentRoomId = roomId;
    this.characterId = characterId;
    this.isIntentionalClose = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    return new Promise((resolve, reject) => {
      let resolved = false;

      try {
        let finalUrl = this.serverUrl;
        const token = localStorage.getItem('noobrpg_session_token');
        if (token && !finalUrl.includes('token=')) {
          const sep = finalUrl.includes('?') ? '&' : '?';
          finalUrl = `${finalUrl}${sep}token=${encodeURIComponent(token)}`;
        }
        this.socket = new WebSocket(finalUrl);
      } catch (err) {
        return reject(err);
      }

      this.socket.onopen = () => {
        // Envia mensagem de handshake de entrada na sala
        const joinPayload: C2S_JoinPayload = {
          roomId: this.currentRoomId,
          characterId: this.characterId!
        };
        this.send(NetMessageType.C2S_JOIN, joinPayload);
      };

      this.socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const { type, payload } = parsed;

          switch (type) {
            case NetMessageType.S2C_JOINED: {
              if (!resolved) {
                resolved = true;
                resolve(payload as S2C_JoinedPayload);
              }
              if (this.callbacks.onJoined) {
                this.callbacks.onJoined(payload as S2C_JoinedPayload);
              }
              break;
            }

            case NetMessageType.S2C_SNAPSHOT: {
              if (this.callbacks.onSnapshot) {
                this.callbacks.onSnapshot(payload as WorldSnapshot);
              }
              break;
            }

            case NetMessageType.S2C_SNAPSHOT_DELTA: {
              if (this.callbacks.onSnapshotDelta) {
                this.callbacks.onSnapshotDelta(payload as WorldSnapshotDelta);
              }
              break;
            }

            case NetMessageType.S2C_PLAYER_JOINED: {
              if (this.callbacks.onPlayerJoined) {
                this.callbacks.onPlayerJoined(payload as S2C_PlayerJoinedPayload);
              }
              break;
            }

            case NetMessageType.S2C_PLAYER_LEFT: {
              if (this.callbacks.onPlayerLeft) {
                this.callbacks.onPlayerLeft(payload as S2C_PlayerLeftPayload);
              }
              break;
            }

            case NetMessageType.S2C_CHAT: {
              if (this.callbacks.onChat) {
                this.callbacks.onChat(payload as S2C_ChatPayload);
              }
              break;
            }

            case NetMessageType.S2C_COMBAT_EVENT: {
              if (this.callbacks.onCombatEvent) {
                this.callbacks.onCombatEvent(payload as S2C_CombatEventPayload);
              }
              break;
            }

            case NetMessageType.S2C_ERROR: {
              if (!resolved) {
                resolved = true;
                reject(new Error(payload?.message || 'Erro ao conectar à sala'));
              }
              if (this.callbacks.onError) {
                this.callbacks.onError(payload as S2C_ErrorPayload);
              }
              break;
            }

            default:
              break;
          }
        } catch (err) {
          console.error('[MultiplayerClient] Erro ao processar mensagem do servidor:', err);
        }
      };

      this.socket.onclose = () => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Conexão WebSocket fechada antes da confirmação de entrada.'));
        }

        if (this.callbacks.onDisconnect) {
          this.callbacks.onDisconnect();
        }

        if (!this.isIntentionalClose && this.characterId) {
          // Tentativa de reconexão automática após 2 segundos
          this.reconnectTimer = setTimeout(() => {
            if (!this.isIntentionalClose && this.characterId) {
              this.connect(this.currentRoomId, this.characterId).catch(() => {});
            }
          }, 2000);
        }
      };

      this.socket.onerror = (err) => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Falha na conexão com o servidor WebSocket.'));
        }
      };
    });
  }

  public disconnect(): void {
    this.isIntentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private send(type: NetMessageType, payload: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify({ type, payload }));
      } catch (err) {
        // Falha no envio
      }
    }
  }

  // --- MÉTODOS DE INTENÇÃO DO CLIENTE ---

  public sendMove(targetX: number, targetY: number, clientDt: number): void {
    const payload: C2S_MovePayload = {
      targetX,
      targetY,
      clientDt
    };
    this.send(NetMessageType.C2S_MOVE, payload);
  }

  public sendAttack(targetMonsterId: string): void {
    const payload: C2S_AttackPayload = { targetMonsterId };
    this.send(NetMessageType.C2S_ATTACK, payload);
  }

  public sendSkill1(targetMonsterId: string): void {
    const payload: C2S_Skill1Payload = { targetMonsterId };
    this.send(NetMessageType.C2S_SKILL1, payload);
  }

  public sendGather(nodeId: string): void {
    const payload: C2S_GatherPayload = { nodeId };
    this.send(NetMessageType.C2S_GATHER, payload);
  }

  public sendPickup(groundItemId: string): void {
    const payload: C2S_PickupPayload = { groundItemId };
    this.send(NetMessageType.C2S_PICKUP, payload);
  }

  public sendCraft(recipeId: string): void {
    const payload: C2S_CraftPayload = { recipeId };
    this.send(NetMessageType.C2S_CRAFT, payload);
  }

  public sendUseItem(slotIndex: number): void {
    const payload: C2S_UseItemPayload = { slotIndex };
    this.send(NetMessageType.C2S_USE_ITEM, payload);
  }

  public sendEquip(slotIndex: number): void {
    const payload: C2S_EquipPayload = { slotIndex };
    this.send(NetMessageType.C2S_EQUIP, payload);
  }

  public sendChat(message: string): void {
    const payload: C2S_ChatPayload = { message };
    this.send(NetMessageType.C2S_CHAT, payload);
  }
}
