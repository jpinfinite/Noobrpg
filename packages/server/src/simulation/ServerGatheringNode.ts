import {
  GatheringNodeType,
  GatheringNodeConfig,
  GATHERING_NODE_DEFINITIONS,
  calculateDistance
} from '@noobrpg/shared';
import { SIMULATION_CONSTANTS } from './SimulationConstants.js';
import type { ServerPlayer } from './ServerPlayer';

export class ServerGatheringNode {
  public id: string;
  public type: GatheringNodeType;
  public config: GatheringNodeConfig;
  public x: number;
  public y: number;
  public state: 'READY' | 'GATHERING' | 'COOLDOWN' = 'READY';

  public currentGathererId: string | null = null;
  public gatherProgressMs: number = 0;
  public respawnTime: number = 0;

  constructor(id: string, type: GatheringNodeType, x: number, y: number) {
    this.id = id;
    this.type = type;
    this.config = GATHERING_NODE_DEFINITIONS[type];
    this.x = x;
    this.y = y;
  }

  public canInteract(player: ServerPlayer): boolean {
    if (this.state !== 'READY') return false;
    const dist = calculateDistance(this.x, this.y, player.x, player.y);
    return dist <= SIMULATION_CONSTANTS.INTERACT_MAX_DISTANCE;
  }

  public startGather(player: ServerPlayer): boolean {
    if (!this.canInteract(player)) return false;
    this.state = 'GATHERING';
    this.currentGathererId = player.id;
    this.gatherProgressMs = 0;
    return true;
  }

  public cancelGather(): void {
    if (this.state === 'GATHERING') {
      this.state = 'READY';
      this.currentGathererId = null;
      this.gatherProgressMs = 0;
    }
  }

  public updateTick(
    deltaMs: number,
    players: Map<string, ServerPlayer>
  ): { completed: boolean; playerId: string; itemId: string; quantity: number } | null {
    const now = Date.now();

    // 1. Trata Respawn
    if (this.state === 'COOLDOWN') {
      if (now >= this.respawnTime) {
        this.state = 'READY';
        this.currentGathererId = null;
        this.gatherProgressMs = 0;
      }
      return null;
    }

    // 2. Trata Progresso de Coleta
    if (this.state === 'GATHERING' && this.currentGathererId) {
      const gatherer = players.get(this.currentGathererId);
      if (!gatherer || !gatherer.isAlive()) {
        this.cancelGather();
        return null;
      }

      const dist = calculateDistance(this.x, this.y, gatherer.x, gatherer.y);
      if (dist > SIMULATION_CONSTANTS.INTERACT_MAX_DISTANCE + 8) {
        this.cancelGather();
        return null;
      }

      this.gatherProgressMs += deltaMs;

      if (this.gatherProgressMs >= this.config.gatherDurationMs) {
        this.state = 'COOLDOWN';
        this.respawnTime = now + this.config.respawnTimeMs;
        const playerId = this.currentGathererId;
        this.currentGathererId = null;
        this.gatherProgressMs = 0;

        const qty = Math.floor(
          Math.random() * (this.config.dropAmountMax - this.config.dropAmountMin + 1) +
            this.config.dropAmountMin
        );

        return {
          completed: true,
          playerId,
          itemId: this.config.droppedItemId,
          quantity: qty
        };
      }
    }

    return null;
  }
}
