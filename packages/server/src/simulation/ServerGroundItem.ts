import { calculateDistance } from '@noobrpg/shared';
import { SIMULATION_CONSTANTS } from './SimulationConstants.js';

export class ServerGroundItem {
  public id: string;
  public itemId: string;
  public quantity: number;
  public x: number;
  public y: number;
  public createdAt: number;

  constructor(id: string, itemId: string, quantity: number, x: number, y: number) {
    this.id = id;
    this.itemId = itemId;
    this.quantity = quantity;
    this.x = x;
    this.y = y;
    this.createdAt = Date.now();
  }

  public isExpired(now: number = Date.now()): boolean {
    return now - this.createdAt > SIMULATION_CONSTANTS.DROP_LIFETIME_MS;
  }

  public canPickup(playerX: number, playerY: number): boolean {
    const dist = calculateDistance(this.x, this.y, playerX, playerY);
    return dist <= SIMULATION_CONSTANTS.PICKUP_MAX_DISTANCE;
  }
}
