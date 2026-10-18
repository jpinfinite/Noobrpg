import { WebSocket } from 'ws';
import {
  NetMessageType
} from '@noobrpg/shared';
import { GameSimulation } from '../simulation/GameSimulation.js';

export interface RoomClient {
  socket: WebSocket;
  accountId: string;
  characterId: string;
  characterName: string;
  joinedAt: number;
}

export abstract class Room {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly maxPlayers: number;
  public abstract readonly simulation: GameSimulation;

  protected clients: Map<string, RoomClient> = new Map(); // key: characterId

  public abstract start(): void;
  public abstract stop(): void;

  public getClientCount(): number {
    return this.clients.size;
  }

  public getClient(characterId: string): RoomClient | undefined {
    return this.clients.get(characterId);
  }

  public hasClient(characterId: string): boolean {
    return this.clients.has(characterId);
  }

  public abstract onJoin(client: RoomClient): Promise<boolean>;
  public abstract onLeave(characterId: string): Promise<void>;
  public abstract onMessage(characterId: string, type: NetMessageType, payload: any): void;

  /**
   * Envia uma mensagem para um cliente específico na sala
   */
  public send(characterId: string, type: NetMessageType, payload: any): void {
    const client = this.clients.get(characterId);
    if (client && client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(JSON.stringify({ type, payload }));
      } catch (err) {
        // Falha no envio será tratada no evento 'close' do socket
      }
    }
  }

  /**
   * Faz broadcast de uma mensagem para todos os clientes conectados na sala
   */
  public broadcast(type: NetMessageType, payload: any, exceptCharacterId?: string): void {
    const message = JSON.stringify({ type, payload });
    for (const [charId, client] of this.clients.entries()) {
      if (exceptCharacterId && charId === exceptCharacterId) continue;
      if (client.socket.readyState === WebSocket.OPEN) {
        try {
          client.socket.send(message);
        } catch (err) {
          // Socket com erro
        }
      }
    }
  }
}
