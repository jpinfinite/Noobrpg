import { SIMULATION_CONSTANTS } from './SimulationConstants.js';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class MapCollisionGrid {
  private static obstacles: BoundingBox[] = [
  {
    "x": 0,
    "y": 0,
    "width": 1920,
    "height": 32
  },
  {
    "x": 0,
    "y": 1248,
    "width": 1920,
    "height": 32
  },
  {
    "x": 0,
    "y": 0,
    "width": 32,
    "height": 1280
  },
  {
    "x": 1888,
    "y": 0,
    "width": 32,
    "height": 1280
  },
  {
    "x": 560,
    "y": 32,
    "width": 1200,
    "height": 80
  },
  {
    "x": 800,
    "y": 112,
    "width": 320,
    "height": 48
  },
  {
    "x": 1280,
    "y": 112,
    "width": 448,
    "height": 48
  },
  {
    "x": 1200,
    "y": 288,
    "width": 16,
    "height": 16
  },
  {
    "x": 1088,
    "y": 304,
    "width": 240,
    "height": 16
  },
  {
    "x": 1056,
    "y": 320,
    "width": 304,
    "height": 16
  },
  {
    "x": 1024,
    "y": 336,
    "width": 368,
    "height": 16
  },
  {
    "x": 992,
    "y": 352,
    "width": 432,
    "height": 16
  },
  {
    "x": 976,
    "y": 368,
    "width": 464,
    "height": 16
  },
  {
    "x": 960,
    "y": 384,
    "width": 496,
    "height": 16
  },
  {
    "x": 944,
    "y": 400,
    "width": 528,
    "height": 16
  },
  {
    "x": 944,
    "y": 416,
    "width": 528,
    "height": 16
  },
  {
    "x": 928,
    "y": 432,
    "width": 560,
    "height": 16
  },
  {
    "x": 928,
    "y": 448,
    "width": 224,
    "height": 16
  },
  {
    "x": 1264,
    "y": 448,
    "width": 224,
    "height": 16
  },
  {
    "x": 928,
    "y": 464,
    "width": 224,
    "height": 16
  },
  {
    "x": 1264,
    "y": 464,
    "width": 224,
    "height": 16
  },
  {
    "x": 912,
    "y": 480,
    "width": 32,
    "height": 16
  },
  {
    "x": 1264,
    "y": 480,
    "width": 240,
    "height": 16
  },
  {
    "x": 928,
    "y": 496,
    "width": 224,
    "height": 16
  },
  {
    "x": 1264,
    "y": 496,
    "width": 224,
    "height": 16
  },
  {
    "x": 928,
    "y": 512,
    "width": 224,
    "height": 16
  },
  {
    "x": 1264,
    "y": 512,
    "width": 224,
    "height": 16
  },
  {
    "x": 928,
    "y": 528,
    "width": 560,
    "height": 16
  },
  {
    "x": 944,
    "y": 544,
    "width": 528,
    "height": 16
  },
  {
    "x": 944,
    "y": 560,
    "width": 528,
    "height": 16
  },
  {
    "x": 960,
    "y": 576,
    "width": 496,
    "height": 16
  },
  {
    "x": 976,
    "y": 592,
    "width": 464,
    "height": 16
  },
  {
    "x": 992,
    "y": 608,
    "width": 432,
    "height": 16
  },
  {
    "x": 1024,
    "y": 624,
    "width": 368,
    "height": 16
  },
  {
    "x": 1056,
    "y": 640,
    "width": 304,
    "height": 16
  },
  {
    "x": 1088,
    "y": 656,
    "width": 240,
    "height": 16
  },
  {
    "x": 1200,
    "y": 672,
    "width": 16,
    "height": 16
  },
  {
    "x": 0,
    "y": 0,
    "width": 480,
    "height": 24
  },
  {
    "x": 0,
    "y": 304,
    "width": 480,
    "height": 16
  },
  {
    "x": 336,
    "y": 16,
    "width": 80,
    "height": 16
  },
  {
    "x": 320,
    "y": 32,
    "width": 112,
    "height": 16
  },
  {
    "x": 304,
    "y": 48,
    "width": 144,
    "height": 32
  },
  {
    "x": 320,
    "y": 80,
    "width": 96,
    "height": 16
  },
  {
    "x": 352,
    "y": 96,
    "width": 48,
    "height": 16
  },
  {
    "x": 134,
    "y": 154,
    "width": 12,
    "height": 12
  },
  {
    "x": 234,
    "y": 154,
    "width": 12,
    "height": 12
  },
  {
    "x": 184,
    "y": 134,
    "width": 14,
    "height": 14
  },
  {
    "x": 112,
    "y": 102,
    "width": 16,
    "height": 16
  },
  {
    "x": 252,
    "y": 102,
    "width": 16,
    "height": 16
  },
  {
    "x": 192,
    "y": 72,
    "width": 16,
    "height": 16
  },
  {
    "x": 82,
    "y": 72,
    "width": 16,
    "height": 16
  },
  {
    "x": 292,
    "y": 202,
    "width": 16,
    "height": 16
  },
  {
    "x": 132,
    "y": 52,
    "width": 16,
    "height": 16
  },
  {
    "x": 252,
    "y": 52,
    "width": 16,
    "height": 16
  },
  {
    "x": 112,
    "y": 608,
    "width": 16,
    "height": 16
  },
  {
    "x": 208,
    "y": 624,
    "width": 16,
    "height": 16
  },
  {
    "x": 304,
    "y": 608,
    "width": 16,
    "height": 16
  },
  {
    "x": 384,
    "y": 608,
    "width": 16,
    "height": 16
  },
  {
    "x": 496,
    "y": 624,
    "width": 16,
    "height": 16
  },
  {
    "x": 576,
    "y": 624,
    "width": 16,
    "height": 16
  },
  {
    "x": 688,
    "y": 624,
    "width": 16,
    "height": 16
  },
  {
    "x": 784,
    "y": 624,
    "width": 16,
    "height": 16
  },
  {
    "x": 112,
    "y": 720,
    "width": 16,
    "height": 16
  },
  {
    "x": 208,
    "y": 704,
    "width": 16,
    "height": 16
  },
  {
    "x": 304,
    "y": 720,
    "width": 16,
    "height": 16
  },
  {
    "x": 400,
    "y": 704,
    "width": 16,
    "height": 16
  },
  {
    "x": 496,
    "y": 704,
    "width": 16,
    "height": 16
  },
  {
    "x": 592,
    "y": 720,
    "width": 16,
    "height": 16
  },
  {
    "x": 672,
    "y": 704,
    "width": 16,
    "height": 16
  },
  {
    "x": 768,
    "y": 704,
    "width": 16,
    "height": 16
  },
  {
    "x": 96,
    "y": 816,
    "width": 16,
    "height": 16
  },
  {
    "x": 192,
    "y": 800,
    "width": 16,
    "height": 16
  },
  {
    "x": 288,
    "y": 816,
    "width": 16,
    "height": 16
  },
  {
    "x": 400,
    "y": 816,
    "width": 16,
    "height": 16
  },
  {
    "x": 496,
    "y": 800,
    "width": 16,
    "height": 16
  },
  {
    "x": 576,
    "y": 816,
    "width": 16,
    "height": 16
  },
  {
    "x": 672,
    "y": 816,
    "width": 16,
    "height": 16
  },
  {
    "x": 768,
    "y": 800,
    "width": 16,
    "height": 16
  },
  {
    "x": 96,
    "y": 896,
    "width": 16,
    "height": 16
  },
  {
    "x": 192,
    "y": 912,
    "width": 16,
    "height": 16
  },
  {
    "x": 288,
    "y": 912,
    "width": 16,
    "height": 16
  },
  {
    "x": 384,
    "y": 912,
    "width": 16,
    "height": 16
  },
  {
    "x": 496,
    "y": 912,
    "width": 16,
    "height": 16
  },
  {
    "x": 576,
    "y": 896,
    "width": 16,
    "height": 16
  },
  {
    "x": 688,
    "y": 912,
    "width": 16,
    "height": 16
  },
  {
    "x": 784,
    "y": 912,
    "width": 16,
    "height": 16
  },
  {
    "x": 112,
    "y": 1008,
    "width": 16,
    "height": 16
  },
  {
    "x": 208,
    "y": 992,
    "width": 16,
    "height": 16
  },
  {
    "x": 288,
    "y": 1008,
    "width": 16,
    "height": 16
  },
  {
    "x": 400,
    "y": 1008,
    "width": 16,
    "height": 16
  },
  {
    "x": 480,
    "y": 992,
    "width": 16,
    "height": 16
  },
  {
    "x": 592,
    "y": 1008,
    "width": 16,
    "height": 16
  },
  {
    "x": 688,
    "y": 992,
    "width": 16,
    "height": 16
  },
  {
    "x": 784,
    "y": 992,
    "width": 16,
    "height": 16
  },
  {
    "x": 96,
    "y": 1104,
    "width": 16,
    "height": 16
  },
  {
    "x": 192,
    "y": 1104,
    "width": 16,
    "height": 16
  },
  {
    "x": 288,
    "y": 1088,
    "width": 16,
    "height": 16
  },
  {
    "x": 400,
    "y": 1088,
    "width": 16,
    "height": 16
  },
  {
    "x": 480,
    "y": 1088,
    "width": 16,
    "height": 16
  },
  {
    "x": 576,
    "y": 1104,
    "width": 16,
    "height": 16
  },
  {
    "x": 672,
    "y": 1104,
    "width": 16,
    "height": 16
  },
  {
    "x": 768,
    "y": 1104,
    "width": 16,
    "height": 16
  }
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
