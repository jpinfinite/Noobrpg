import fs from 'node:fs';
import path from 'node:path';

const MAP_COLS = 120;
const MAP_ROWS = 80;
const TILE_SIZE = 16;
const MAP_WIDTH_PX = MAP_COLS * TILE_SIZE; // 1920 px
const MAP_HEIGHT_PX = MAP_ROWS * TILE_SIZE; // 1280 px

console.log(`Gerando Mapa Expandido: ${MAP_COLS}x${MAP_ROWS} tiles (${MAP_WIDTH_PX}x${MAP_HEIGHT_PX} px)...`);

// 1. Matrizes para as 4 camadas
const groundBase: number[][] = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(1)); // GID 1: Grass Plain
const groundDeco: number[][] = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(0));
const collision: number[][] = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(0));
const overhead: number[][] = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(0));

// Lista de caixas de colisão AABB para o servidor autoritativo
interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
const serverObstacles: BoundingBox[] = [];

// Helper pseudo-aleatório determinístico
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
const rng = seededRandom(1337);

// ==========================================
// A. BORDAS EXTERNAS DO MUNDO (COLISÃO TOTAL)
// ==========================================
for (let c = 0; c < MAP_COLS; c++) {
  // Parede Norte (linhas 0 e 1)
  collision[0][c] = 4;
  collision[1][c] = 4;
  groundBase[0][c] = 4;
  groundBase[1][c] = 4;

  // Parede Sul (linhas 78 e 79)
  collision[78][c] = 4;
  collision[79][c] = 4;
  groundBase[78][c] = 4;
  groundBase[79][c] = 4;
}

for (let r = 0; r < MAP_ROWS; r++) {
  // Parede Oeste (colunas 0 e 1)
  collision[r][0] = 4;
  collision[r][1] = 4;
  groundBase[r][0] = 4;
  groundBase[r][1] = 4;

  // Parede Leste (colunas 118 e 119)
  collision[r][118] = 4;
  collision[r][119] = 4;
  groundBase[r][118] = 4;
  groundBase[r][119] = 4;
}

// Caixas AABB das bordas externas
serverObstacles.push({ x: 0, y: 0, width: MAP_WIDTH_PX, height: 32 }); // Topo
serverObstacles.push({ x: 0, y: MAP_HEIGHT_PX - 32, width: MAP_WIDTH_PX, height: 32 }); // Base
serverObstacles.push({ x: 0, y: 0, width: 32, height: MAP_HEIGHT_PX }); // Esquerda
serverObstacles.push({ x: MAP_WIDTH_PX - 32, y: 0, width: 32, height: MAP_HEIGHT_PX }); // Direita

// ==========================================
// B. REGIÃO NORTE — CORDILHEIRA & MINAS DE FERRO (r: 2..14, c: 25..110)
// ==========================================
for (let r = 2; r <= 12; r++) {
  for (let c = 35; c <= 110; c++) {
    // Escarpas montanhosas
    if (r <= 6 || (r <= 9 && (c % 7 !== 0 && c % 7 !== 1))) {
      collision[r][c] = 4; // Rocha sólida
      groundBase[r][c] = 16; // Topo de montanha
    } else {
      groundBase[r][c] = 2; // Solo pedregoso de cascalho/mina
      if (rng() > 0.6) {
        groundDeco[r][c] = 25; // Seixos de mineração
      }
    }
  }
}
// Caixas AABB das montanhas do norte
serverObstacles.push({ x: 35 * 16, y: 2 * 16, width: (110 - 35) * 16, height: 5 * 16 });
serverObstacles.push({ x: 50 * 16, y: 7 * 16, width: 20 * 16, height: 3 * 16 });
serverObstacles.push({ x: 80 * 16, y: 7 * 16, width: 28 * 16, height: 3 * 16 });

// ==========================================
// C. REGIÃO LESTE — O GRANDE LAGO DE CRISTAL (r: 16..45, c: 55..95)
// ==========================================
// Formato orgânico elíptico com ilha no centro
const lakeCenterR = 30;
const lakeCenterC = 75;
const lakeRadiusR = 12;
const lakeRadiusC = 18;

for (let r = lakeCenterR - lakeRadiusR - 2; r <= lakeCenterR + lakeRadiusR + 2; r++) {
  for (let c = lakeCenterC - lakeRadiusC - 2; c <= lakeCenterC + lakeRadiusC + 2; c++) {
    if (r < 2 || r >= MAP_ROWS - 2 || c < 2 || c >= MAP_COLS - 2) continue;

    const distNorm = Math.pow((r - lakeCenterR) / lakeRadiusR, 2) + Math.pow((c - lakeCenterC) / lakeRadiusC, 2);

    // Ilha central (r: 29..31, c: 73..77)
    const isIsland = Math.abs(r - lakeCenterR) <= 2 && Math.abs(c - lakeCenterC) <= 3;

    if (isIsland) {
      groundBase[r][c] = 1;
      groundDeco[r][c] = 6; // Flores na ilhota
      // Ponte de madeira conectando a margem oeste à ilha (linha 30, c: 62..72)
    } else if (distNorm <= 1.0) {
      // Água profunda colidível
      groundBase[r][c] = 3;
      collision[r][c] = 3;
    } else if (distNorm <= 1.25) {
      // Praia / Margem arenosa
      groundBase[r][c] = 28; // Areia
      groundDeco[r][c] = 17; // Margem
    }
  }
}

// Ponte de madeira conectando a margem oeste à ilha
for (let c = lakeCenterC - lakeRadiusC + 2; c < lakeCenterC - 3; c++) {
  const r = lakeCenterR;
  groundBase[r][c] = 27; // Madeira
  collision[r][c] = 0;   // Caminhável!
}

// Caixas AABB de colisão do Grande Lago (fatias horizontais precisas)
for (let r = lakeCenterR - lakeRadiusR; r <= lakeCenterR + lakeRadiusR; r++) {
  let startC = -1;
  for (let c = lakeCenterC - lakeRadiusC; c <= lakeCenterC + lakeRadiusC; c++) {
    if (collision[r] && collision[r][c] === 3) {
      if (startC === -1) startC = c;
    } else {
      if (startC !== -1) {
        serverObstacles.push({
          x: startC * 16,
          y: r * 16,
          width: (c - startC) * 16,
          height: 16
        });
        startC = -1;
      }
    }
  }
  if (startC !== -1) {
    serverObstacles.push({
      x: startC * 16,
      y: r * 16,
      width: (lakeCenterC + lakeRadiusC - startC + 1) * 16,
      height: 16
    });
  }
}

// ==========================================
// D. VILA CENTRAL & PRAÇA DA FORJA (INALTERADA PARA COMPATIBILIDADE TOTAL)
// Coordenadas: c = 2..28, r = 2..19 (Área original do mapa v1)
// ==========================================
// 1. Pavimentação da praça
for (let r = 7; r <= 12; r++) {
  for (let c = 9; c <= 17; c++) {
    groundBase[r][c] = 13; // Basalto nobre
  }
}
// Zona de fuligem ao redor da bigorna (c: 11, r: 8)
groundDeco[8][11] = 14;
groundDeco[8][12] = 15; // Brasas

// 2. Trilhas conectando a Vila às outras regiões
// - Trilha Leste saindo da praça (r: 10, c: 18..58) em direção ao lago
for (let c = 18; c <= 58; c++) {
  groundBase[10][c] = 5;
  groundDeco[9][c] = 9;
  groundDeco[11][c] = 10;
}

// - Trilha Sul saindo da praça (c: 13, r: 13..65) em direção ao Bosque Sagrado
for (let r = 13; r <= 65; r++) {
  groundBase[r][13] = 5;
  groundDeco[r][12] = 11;
  groundDeco[r][14] = 12;
}

// - Trilha Norte saindo da praça (c: 13, r: 2..6) em direção à Mina de Ferro
for (let r = 2; r <= 6; r++) {
  groundBase[r][13] = 5;
}

// - Trilha Sudeste saindo da bifurcação sul (r: 35, c: 14..80) em direção ao Covil dos Monstros
for (let c = 14; c <= 80; c++) {
  const r = 35 + Math.floor((c - 14) / 5);
  if (r < MAP_ROWS - 2) {
    groundBase[r][c] = 2; // Terra batida rústica
  }
}

// Obstáculos canônicos originais da Praça da Forja (garantem testes unitários de 57 testes!)
serverObstacles.push({ x: 0, y: 0, width: 480, height: 24 }); // Borda superior antiga da vila
serverObstacles.push({ x: 0, y: 304, width: 480, height: 16 }); // Mureta sul antiga da vila (bloqueia 180, 315)
serverObstacles.push({ x: 336, y: 16, width: 80, height: 16 }); // Lago da vila 1
serverObstacles.push({ x: 320, y: 32, width: 112, height: 16 }); // Lago da vila 2
serverObstacles.push({ x: 304, y: 48, width: 144, height: 32 }); // Lago da vila 3 (cobre 350, 60!)
serverObstacles.push({ x: 320, y: 80, width: 96, height: 16 });  // Lago da vila 4
serverObstacles.push({ x: 352, y: 96, width: 48, height: 16 });  // Lago da vila 5

serverObstacles.push({ x: 134, y: 154, width: 12, height: 12 }); // Pilar 1
serverObstacles.push({ x: 234, y: 154, width: 12, height: 12 }); // Pilar 2
serverObstacles.push({ x: 184, y: 134, width: 14, height: 14 }); // Bigorna
serverObstacles.push({ x: 112, y: 102, width: 16, height: 16 }); // Árvore 1
serverObstacles.push({ x: 252, y: 102, width: 16, height: 16 }); // Árvore 2
serverObstacles.push({ x: 192, y: 72, width: 16, height: 16 });  // Árvore 3
serverObstacles.push({ x: 82, y: 72, width: 16, height: 16 });   // Coleta madeira 1
serverObstacles.push({ x: 292, y: 202, width: 16, height: 16 }); // Coleta madeira 2
serverObstacles.push({ x: 132, y: 52, width: 16, height: 16 });  // Minério 1
serverObstacles.push({ x: 252, y: 52, width: 16, height: 16 });  // Minério 2

// Marca pilares e bigorna no tilemap de colisão
collision[9][8] = 4;
collision[9][14] = 4;

// ==========================================
// E. REGIÃO SUL — BOSQUE ANTIGO (r: 35..75, c: 5..50)
// ==========================================
// Árvores distribuídas com tronco colidível e copa aérea
for (let r = 38; r <= 72; r += 6) {
  for (let c = 6; c <= 48; c += 6) {
    if (c === 13) continue; // Não obstrui a trilha!

    const offsetR = Math.floor(rng() * 2);
    const offsetC = Math.floor(rng() * 2);
    const tr = r + offsetR;
    const tc = c + offsetC;

    if (tr < MAP_ROWS - 4 && tc < MAP_COLS - 4) {
      // Tronco sólido no chão
      collision[tr][tc] = 4;
      serverObstacles.push({ x: tc * 16, y: tr * 16, width: 16, height: 16 });

      // Copa aérea em 2x2 na camada Overhead
      overhead[tr - 1][tc] = 29;
      overhead[tr - 1][tc + 1] = 30;
      overhead[tr][tc] = 31;
      overhead[tr][tc + 1] = 32;

      // Flores ao redor
      if (groundDeco[tr + 1] && groundDeco[tr + 1][tc] === 0) {
        groundDeco[tr + 1][tc] = 6;
      }
    }
  }
}

// ==========================================
// F. REGIÃO SUDESTE — TERRAS SELVAGENS & MONSTROS (r: 45..75, c: 65..112)
// ==========================================
for (let r = 45; r <= 75; r++) {
  for (let c = 65; c <= 112; c++) {
    const rVal = rng();
    if (rVal > 0.85) {
      groundDeco[r][c] = 26; // Tufo de grama selvagem
    } else if (rVal > 0.75) {
      groundDeco[r][c] = 25; // Seixo
    }
  }
}

// Flatten arrays para o formato do Tiled
const flatGroundBase: number[] = groundBase.flat();
const flatGroundDeco: number[] = groundDeco.flat();
const flatCollision: number[] = collision.flat();
const flatOverhead: number[] = overhead.flat();

// Monta o JSON do Tilemap
const tilemapJson = {
  compressionlevel: -1,
  height: MAP_ROWS,
  width: MAP_COLS,
  infinite: false,
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tiledversion: '1.10.2',
  tileheight: TILE_SIZE,
  tilewidth: TILE_SIZE,
  version: '1.10',
  nextlayerid: 5,
  nextobjectid: 1,
  layers: [
    {
      data: flatGroundBase,
      height: MAP_ROWS,
      id: 1,
      name: 'Ground_Base',
      opacity: 1,
      type: 'tilelayer',
      visible: true,
      width: MAP_COLS,
      x: 0,
      y: 0
    },
    {
      data: flatGroundDeco,
      height: MAP_ROWS,
      id: 2,
      name: 'Ground_Deco',
      opacity: 1,
      type: 'tilelayer',
      visible: true,
      width: MAP_COLS,
      x: 0,
      y: 0
    },
    {
      data: flatCollision,
      height: MAP_ROWS,
      id: 3,
      name: 'Collision',
      opacity: 1,
      type: 'tilelayer',
      visible: true,
      width: MAP_COLS,
      x: 0,
      y: 0
    },
    {
      data: flatOverhead,
      height: MAP_ROWS,
      id: 4,
      name: 'Overhead_Foliage',
      opacity: 1,
      type: 'tilelayer',
      visible: true,
      width: MAP_COLS,
      x: 0,
      y: 0
    }
  ],
  tilesets: [
    {
      columns: 8,
      firstgid: 1,
      image: 'tileset_prototype',
      imageheight: 64,
      imagewidth: 128,
      margin: 0,
      name: 'tileset_prototype',
      spacing: 0,
      tilecount: 32,
      tileheight: 16,
      tilewidth: 16,
      tiles: [
        {
          id: 2, // GID 3 (Water)
          properties: [{ name: 'collides', type: 'bool', value: true }]
        },
        {
          id: 3, // GID 4 (Solid Wall)
          properties: [{ name: 'collides', type: 'bool', value: true }]
        }
      ]
    }
  ]
};

// Grava map_prototype.json
const outputPath = path.resolve(process.cwd(), 'packages/client/public/assets/maps/map_prototype.json');
fs.writeFileSync(outputPath, JSON.stringify(tilemapJson, null, 2), 'utf-8');
console.log(`✓ Tilemap salvo em: ${outputPath}`);

// Grava o código TypeScript de MapCollisionGrid
const collisionGridPath = path.resolve(process.cwd(), 'packages/server/src/simulation/MapCollisionGrid.ts');
const collisionGridCode = `import { SIMULATION_CONSTANTS } from './SimulationConstants.js';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class MapCollisionGrid {
  private static obstacles: BoundingBox[] = ${JSON.stringify(serverObstacles, null, 2)};

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
`;
fs.writeFileSync(collisionGridPath, collisionGridCode, 'utf-8');
console.log(`✓ MapCollisionGrid.ts gerado com ${serverObstacles.length} caixas de obstáculos em: ${collisionGridPath}`);

// Atualiza SimulationConstants.ts com o novo tamanho
const simConstantsPath = path.resolve(process.cwd(), 'packages/server/src/simulation/SimulationConstants.ts');
const simConstantsCode = `export const SIMULATION_CONSTANTS = {
  TICK_RATE: 20, // 20 ticks por segundo
  TICK_INTERVAL_MS: 50, // 50ms por tick
  SPEED_TOLERANCE_FACTOR: 1.25, // 25% de margem para compensação de jitter/latência de rede
  MAP_WIDTH: ${MAP_WIDTH_PX},
  MAP_HEIGHT: ${MAP_HEIGHT_PX},
  INTERACT_MAX_DISTANCE: 36, // Alcance máximo para nós de coleta e crafting
  PICKUP_MAX_DISTANCE: 32, // Alcance máximo para coletar drops do chão
  DROP_LIFETIME_MS: 60000 // 60 segundos antes de um item do chão expirar
} as const;
`;
fs.writeFileSync(simConstantsPath, simConstantsCode, 'utf-8');
console.log(`✓ SimulationConstants.ts atualizado com MAP_WIDTH=${MAP_WIDTH_PX}, MAP_HEIGHT=${MAP_HEIGHT_PX}`);
