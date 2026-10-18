import { SIMULATION_CONSTANTS } from './SimulationConstants.js';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class MapCollisionGrid {
  private static obstacles: BoundingBox[] = [
    // Borda superior (parede)
    { x: 0, y: 0, width: 480, height: 24 },
    // Borda inferior
    { x: 0, y: 254, width: 480, height: 16 },
    // Borda esquerda
    { x: 0, y: 0, width: 16, height: 270 },
    // Borda direita
    { x: 464, y: 0, width: 16, height: 270 },

    // Props estáticos
    { x: 112, y: 102, width: 16, height: 16 }, // Árvore decorativa 1
    { x: 252, y: 102, width: 16, height: 16 }, // Árvore decorativa 2
    { x: 192, y: 72, width: 16, height: 16 },  // Árvore decorativa 3
    { x: 134, y: 154, width: 12, height: 12 }, // Pilar 1
    { x: 234, y: 154, width: 12, height: 12 }, // Pilar 2
    { x: 184, y: 134, width: 14, height: 14 }, // Bigorna de Forja

    // Nós de madeira e minério sólidos
    { x: 82, y: 72, width: 16, height: 16 },   // Árvore colhível 1
    { x: 292, y: 202, width: 16, height: 16 }, // Árvore colhível 2
    { x: 132, y: 52, width: 16, height: 16 },  // Minério de ferro 1
    { x: 252, y: 52, width: 16, height: 16 }   // Minério de ferro 2
  ];

  public static isWalkable(x: number, y: number, radius: number = 5): boolean {
    // 1. Limites do mapa
    if (
      x < radius ||
      x > SIMULATION_CONSTANTS.MAP_WIDTH - radius ||
      y < radius ||
      y > SIMULATION_CONSTANTS.MAP_HEIGHT - radius
    ) {
      return false;
    }

    // 2. Colisão contra caixas de obstáculos
    for (const obs of this.obstacles) {
      const minX = obs.x - radius;
      const maxX = obs.x + obs.width + radius;
      const minY = obs.y - radius;
      const maxY = obs.y + obs.height + radius;

      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        return false;
      }
    }

    return true;
  }
}
