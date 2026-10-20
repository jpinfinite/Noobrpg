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

  // Registro dinâmico de mapas indexados por chave
  private static villageSolidGrid: Uint8Array | null = null;
  private static villageObstacles: BoundingBox[] | null = null;

  /**
   * Inicializa e extrai deterministamente a grade de colisões da Vila Inicial
   */
  public static initVillageCollision(): void {
    if (this.villageSolidGrid) return;

    const width = 60;
    const height = 40;
    const totalTiles = width * height;
    this.villageSolidGrid = new Uint8Array(totalTiles);
    const obstaclesList: BoundingBox[] = [];

    // Helper para marcar tile e gerar AABB
    const markSolid = (col: number, row: number) => {
      if (col < 0 || col >= width || row < 0 || row >= height) return;
      const idx = row * width + col;
      if (this.villageSolidGrid![idx] === 0) {
        this.villageSolidGrid![idx] = 1;
        obstaclesList.push({
          x: col * 16,
          y: row * 16,
          width: 16,
          height: 16
        });
      }
    };

    // 1. Cercas externas com aberturas nas estradas Norte e Sul (colunas 28 e 29)
    for (let x = 0; x < width; x++) {
      if (x !== 28 && x !== 29) {
        markSolid(x, 0); // Borda Norte
        markSolid(x, height - 1); // Borda Sul
      }
    }
    for (let y = 0; y < height; y++) {
      markSolid(0, y); // Borda Oeste
      markSolid(width - 1, y); // Borda Leste
    }

    // 2. Construção 1: Forja do Ferreiro (x: 8..17, y: 7..13) com porta central aberta
    for (let y = 7; y <= 11; y++) {
      for (let x = 8; x <= 17; x++) {
        if (y === 11 && (x === 12 || x === 13)) continue; // Porta transitável
        markSolid(x, y);
      }
    }

    // 3. Construção 2: Taverna da Vila (x: 40..51, y: 7..14) com porta central aberta
    for (let y = 7; y <= 12; y++) {
      for (let x = 40; x <= 51; x++) {
        if (y === 12 && (x === 45 || x === 46)) continue; // Porta transitável
        markSolid(x, y);
      }
    }

    // 4. Construção 3: Casa do Ancião (x: 8..17, y: 26..32) com porta central aberta
    for (let y = 26; y <= 30; y++) {
      for (let x = 8; x <= 17; x++) {
        if (y === 30 && (x === 12 || x === 13)) continue; // Porta transitável
        markSolid(x, y);
      }
    }

    // 5. O Lago Cristalino (Sudeste: x: 42..54, y: 25..34)
    for (let y = 25; y <= 34; y++) {
      for (let x = 42; x <= 54; x++) {
        markSolid(x, y);
      }
    }

    // 6. Postes de iluminação na praça
    markSolid(27, 15);
    markSolid(30, 15);
    markSolid(27, 24);
    markSolid(30, 24);

    // 7. Troncos de árvores na periferia
    const trees = [
      { x: 4, y: 5 }, { x: 6, y: 4 }, { x: 20, y: 4 }, { x: 37, y: 4 }, { x: 56, y: 5 },
      { x: 4, y: 35 }, { x: 20, y: 36 }, { x: 37, y: 36 }, { x: 56, y: 36 }
    ];
    for (const t of trees) {
      markSolid(t.x, t.y);
    }

    this.villageObstacles = obstaclesList;
  }

  /**
   * Retorna os limites de mundo em pixels para o mapa informado
   */
  public static getMapBounds(mapKey: string = 'map_prototype'): { width: number; height: number } {
    if (mapKey === 'map_starter_village' || mapKey === 'starter_village') {
      return { width: 960, height: 640 };
    }
    return { width: SIMULATION_CONSTANTS.MAP_WIDTH, height: SIMULATION_CONSTANTS.MAP_HEIGHT };
  }

  /**
   * Verifica se a coordenada está dentro dos limites do mapa
   */
  public static isInsideMap(x: number, y: number, mapKey: string = 'map_prototype'): boolean {
    const bounds = this.getMapBounds(mapKey);
    return x >= 0 && x <= bounds.width && y >= 0 && y <= bounds.height;
  }

  /**
   * Retorna a lista de caixas AABB de obstáculos para o mapa informado
   */
  public static getObstacles(mapKey: string = 'map_prototype'): BoundingBox[] {
    if (mapKey === 'map_starter_village' || mapKey === 'starter_village') {
      this.initVillageCollision();
      return this.villageObstacles || [];
    }
    return this.obstacles;
  }

  /**
   * Validação autoritativa e consistente de colisão para múltiplos mapas do NoobRPG.
   * Suporta raio do pé do jogador e busca O(1) em grade de tiles.
   */
  public static isWalkable(x: number, y: number, radius: number = 5, mapKey: string = 'map_prototype'): boolean {
    const isVillage = mapKey === 'map_starter_village' || mapKey === 'starter_village';

    if (isVillage) {
      this.initVillageCollision();
      const mapWidth = 960;
      const mapHeight = 640;

      // 1. Limites do mapa da Vila Inicial
      if (
        x < radius ||
        x > mapWidth - radius ||
        y < radius ||
        y > mapHeight - radius
      ) {
        return false;
      }

      // 2. Checagem em grade O(1) de tiles interceptados pelo raio do pé
      const minCol = Math.max(0, Math.floor((x - radius) / 16));
      const maxCol = Math.min(59, Math.floor((x + radius) / 16));
      const minRow = Math.max(0, Math.floor((y - radius) / 16));
      const maxRow = Math.min(39, Math.floor((y + radius) / 16));

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const idx = r * 60 + c;
          if (this.villageSolidGrid && this.villageSolidGrid[idx] === 1) {
            return false;
          }
        }
      }

      return true;
    }

    // Mapa Padrão (map_prototype) — Preservação estrita de regressão e limites
    if (
      x < radius ||
      x > SIMULATION_CONSTANTS.MAP_WIDTH - radius ||
      y < radius ||
      y > SIMULATION_CONSTANTS.MAP_HEIGHT - radius
    ) {
      return false;
    }

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
