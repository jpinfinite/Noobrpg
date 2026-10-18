import { Server as HttpServer, IncomingMessage } from 'node:http';
import { WebSocketServer as WSServer, WebSocket, RawData } from 'ws';
import {
  NetMessageType,
  C2S_JoinPayload,
  S2C_ErrorPayload
} from '@noobrpg/shared';
import { AuthService } from '../services/authService.js';
import { CharacterRepository } from '../repositories/characterRepository.js';
import { RoomManager } from './RoomManager.js';
import { Room } from './Room.js';

interface AuthenticatedSocket extends WebSocket {
  accountId: string;
  sessionId: string;
  characterId?: string;
  characterName?: string;
  currentRoomId?: string;
  messageTimestamps: number[];
  lastChatTimestamp: number;
}

export class GameWebSocketServer {
  private wss: WSServer;
  private readonly MAX_PAYLOAD_BYTES = 4096;
  private readonly RATE_LIMIT_WINDOW_MS = 1000;
  private readonly MAX_MESSAGES_PER_WINDOW = 40;
  private readonly CHAT_COOLDOWN_MS = 1000;

  constructor(
    private httpServer: HttpServer,
    private authService: AuthService,
    private characterRepo: CharacterRepository,
    private roomManager: RoomManager
  ) {
    this.wss = new WSServer({ noServer: true });
    this.setupUpgradeHandler();
    this.setupConnectionHandler();
  }


  private parseCookieHeader(cookieHeader?: string): Record<string, string> {
    const list: Record<string, string> = {};
    if (!cookieHeader) return list;
    cookieHeader.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      const key = parts.shift()?.trim();
      if (key) {
        try {
          list[key] = decodeURIComponent(parts.join('='));
        } catch {
          list[key] = parts.join('=');
        }
      }
    });
    return list;
  }

  private setupUpgradeHandler(): void {
    this.httpServer.on('upgrade', async (req: IncomingMessage, socket, head) => {
      // Aceita conexões na rota /ws
      const url = req.url || '';
      if (!url.startsWith('/ws')) {
        return; // Deixa outros possíveis handlers tratarem ou descarta
      }

      try {
        // 1. Extração segura de cookie sem expor segredos
        let sessionToken: string | undefined;

        if (req.headers.cookie) {
          const cookies = this.parseCookieHeader(req.headers.cookie);
          sessionToken = cookies.session_token;
        }

        // Suporte a token em query string exclusivamente como fallback para ferramentas de teste
        if (!sessionToken && url.includes('token=')) {
          const queryParams = new URLSearchParams(url.split('?')[1]);
          sessionToken = queryParams.get('token') || undefined;
        }

        if (!sessionToken) {
          socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
          socket.destroy();
          return;
        }

        // 2. Valida a sessão autoritativamente no banco de dados
        const account = await this.authService.validateSession(sessionToken);
        if (!account) {
          socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
          socket.destroy();
          return;
        }

        // 3. Handshake HTTP completado com sucesso
        this.wss.handleUpgrade(req, socket, head, (ws) => {
          const authWs = ws as AuthenticatedSocket;
          authWs.accountId = account.id;
          authWs.sessionId = sessionToken!;
          authWs.messageTimestamps = [];
          authWs.lastChatTimestamp = 0;
          this.wss.emit('connection', authWs, req);
        });
      } catch (err) {
        socket.write('HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n');
        socket.destroy();
      }
    });
  }

  private setupConnectionHandler(): void {
    this.wss.on('connection', (ws: AuthenticatedSocket) => {
      ws.on('message', async (data: RawData, isBinary: boolean) => {
        if (isBinary) {
          // NoobRPG utiliza protocolo JSON estruturado nesta fase
          return;
        }

        const messageString = data.toString();
        if (messageString.length > this.MAX_PAYLOAD_BYTES) {
          this.sendError(ws, 'PAYLOAD_TOO_LARGE', 'Mensagem excede o limite máximo permitido de 4KB.');
          return;
        }

        // 1. Rate Limiting Geral por Conexão
        const now = Date.now();
        ws.messageTimestamps = ws.messageTimestamps.filter(t => now - t < this.RATE_LIMIT_WINDOW_MS);
        if (ws.messageTimestamps.length >= this.MAX_MESSAGES_PER_WINDOW) {
          if (ws.messageTimestamps.length >= this.MAX_MESSAGES_PER_WINDOW + 20) {
            // Abuso severo de requisições: desconecta cliente
            ws.close(4029, 'Rate limit exceeded');
            return;
          }
          this.sendError(ws, 'RATE_LIMITED', 'Limite de mensagens por segundo excedido.');
          return;
        }
        ws.messageTimestamps.push(now);

        // 2. Parse da Mensagem JSON
        let parsed: { type?: string; payload?: any };
        try {
          parsed = JSON.parse(messageString);
        } catch (e) {
          this.sendError(ws, 'INVALID_JSON', 'Formato JSON inválido.');
          return;
        }

        const { type, payload } = parsed;
        if (!type || typeof type !== 'string') {
          this.sendError(ws, 'INVALID_MESSAGE_TYPE', 'Tipo de mensagem não especificado.');
          return;
        }

        await this.handleMessage(ws, type as NetMessageType, payload);
      });

      ws.on('close', async () => {
        await this.handleDisconnection(ws);
      });

      ws.on('error', async () => {
        await this.handleDisconnection(ws);
      });
    });
  }

  private async handleMessage(ws: AuthenticatedSocket, type: NetMessageType, payload: any): Promise<void> {
    // 1. Tratamento da mensagem de entrada na sala (C2S_JOIN)
    if (type === NetMessageType.C2S_JOIN) {
      await this.handleJoin(ws, payload);
      return;
    }

    // Se ainda não entrou na sala, bloqueia qualquer outro comando
    if (!ws.characterId || !ws.currentRoomId) {
      this.sendError(ws, 'NOT_IN_ROOM', 'Você deve entrar em uma sala antes de emitir ações.');
      return;
    }

    const room = this.roomManager.getRoom(ws.currentRoomId);
    if (!room) {
      this.sendError(ws, 'ROOM_NOT_FOUND', 'A sala solicitada não está ativa.');
      return;
    }

    // 2. Rate Limiting Específico para Chat
    if (type === NetMessageType.C2S_CHAT) {
      const now = Date.now();
      if (now - ws.lastChatTimestamp < this.CHAT_COOLDOWN_MS) {
        this.sendError(ws, 'CHAT_COOLDOWN', 'Aguarde 1 segundo entre mensagens de chat.');
        return;
      }
      ws.lastChatTimestamp = now;
    }

    // 3. Encaminha para a sala autoritativa
    room.onMessage(ws.characterId, type, payload);
  }

  private async handleJoin(ws: AuthenticatedSocket, payload: C2S_JoinPayload): Promise<void> {
    const { roomId, characterId } = payload || {};
    if (!roomId || !characterId || typeof roomId !== 'string' || typeof characterId !== 'string') {
      this.sendError(ws, 'INVALID_JOIN_PAYLOAD', 'Dados de entrada na sala inválidos.');
      return;
    }

    // Validação estrita de autoridade: o personagem pertence a esta conta autenticada?
    const character = await this.characterRepo.findByIdAndAccount(characterId, ws.accountId);
    if (!character) {
      this.sendError(ws, 'UNAUTHORIZED_CHARACTER', 'Você não tem permissão para controlar este personagem.');
      ws.close(4003, 'Unauthorized character');
      return;
    }

    const targetRoomId = roomId === 'plains_01' ? 'plains_01' : 'plains_01';
    const room = this.roomManager.getOrCreateRoom(targetRoomId);

    // Se já estiver em outra sala, sai da anterior
    if (ws.currentRoomId && ws.characterId && ws.currentRoomId !== targetRoomId) {
      const prevRoom = this.roomManager.getRoom(ws.currentRoomId);
      if (prevRoom) {
        await prevRoom.onLeave(ws.characterId);
      }
    }

    ws.characterId = character.id;
    ws.characterName = character.name;
    ws.currentRoomId = targetRoomId;

    const joined = await room.onJoin({
      socket: ws,
      accountId: ws.accountId,
      characterId: character.id,
      characterName: character.name,
      joinedAt: Date.now()
    });

    if (!joined) {
      ws.characterId = undefined;
      ws.currentRoomId = undefined;
    }
  }

  private async handleDisconnection(ws: AuthenticatedSocket): Promise<void> {
    if ((ws as any).isReplaced) {
      return;
    }
    if (ws.characterId && ws.currentRoomId) {
      const room = this.roomManager.getRoom(ws.currentRoomId);
      if (room) {
        await room.onLeave(ws.characterId);
      }
      ws.characterId = undefined;
      ws.currentRoomId = undefined;
    }
  }

  private sendError(ws: WebSocket, code: string, message: string): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: NetMessageType.S2C_ERROR, payload: { code, message } as S2C_ErrorPayload }));
      } catch (e) {
        // Socket com erro
      }
    }
  }

  public close(): void {
    this.wss.close();
  }
}
