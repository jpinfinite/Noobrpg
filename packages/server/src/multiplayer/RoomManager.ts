import { Room } from './Room.js';
import { PlainsRoom } from './PlainsRoom.js';
import { CharacterService } from '../services/characterService.js';
import { GameSimulation } from '../simulation/GameSimulation.js';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  constructor(
    private characterService: CharacterService,
    private sharedSimulation?: GameSimulation
  ) {
    // Inicializa a sala padrão das planícies
    this.createPlainsRoom();
  }

  private createPlainsRoom(): PlainsRoom {
    const plainsRoom = new PlainsRoom(this.characterService, this.sharedSimulation);
    plainsRoom.start();
    this.rooms.set(plainsRoom.id, plainsRoom);
    return plainsRoom;
  }

  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  public getOrCreateRoom(roomId: string): Room {
    const existing = this.rooms.get(roomId);
    if (existing) return existing;

    if (roomId === 'plains_01') {
      return this.createPlainsRoom();
    }

    // Fallback: se solicitar outra sala não implementada, conecta à sala padrão
    return this.rooms.get('plains_01')!;
  }

  public stopAll(): void {
    for (const room of this.rooms.values()) {
      room.stop();
    }
    this.rooms.clear();
  }
}
