import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const monorepoRoot = path.resolve(__dirname, '../../..');

export const STARTER_VILLAGE_WIDTH = 60;
export const STARTER_VILLAGE_HEIGHT = 40;
export const TILE_SIZE = 16;

export interface StarterVillageExportResult {
  mapJson: any;
  pipelineStagingPath: string;
  clientStagingPath: string;
}

/**
 * Gera os dados de mapa canônicos da Vila Inicial (NoobRPG_StarterVillage)
 * contendo as 4 camadas exigidas e paridade total com o exportador do Unity.
 */
export function buildStarterVillageMap(): any {
  const width = STARTER_VILLAGE_WIDTH;
  const height = STARTER_VILLAGE_HEIGHT;
  const totalTiles = width * height;

  // 1. Ground_Base: Grama verde em todo o terreno da vila (GID 1)
  const groundBase: number[] = new Array(totalTiles).fill(1);

  // 2. Ground_Deco: Estradas, praça central, bordas de trilha e flores
  const groundDeco: number[] = new Array(totalTiles).fill(0);

  // Estrada Principal Norte-Sul (colunas 28 e 29)
  for (let y = 0; y < height; y++) {
    groundDeco[y * width + 28] = 2; // GID 2: Terra batida
    groundDeco[y * width + 29] = 2;
  }

  // Estrada Secundária Leste-Oeste (linhas 19 e 20 conectando casas e lago)
  for (let x = 10; x < 50; x++) {
    groundDeco[19 * width + x] = 2;
    groundDeco[20 * width + x] = 2;
  }

  // Praça Central da Vila (x: 24..33, y: 16..23)
  for (let y = 16; y <= 23; y++) {
    for (let x = 24; x <= 33; x++) {
      groundDeco[y * width + x] = 25; // GID 25: Calçamento nobre de basalto
    }
  }

  // Detalhes de flores e ervas no solo
  groundDeco[15 * width + 22] = 6; // Flores amarelas
  groundDeco[15 * width + 35] = 7; // Flores vermelhas
  groundDeco[24 * width + 22] = 6;
  groundDeco[24 * width + 35] = 7;
  groundDeco[21 * width + 12] = 11; // Trevos
  groundDeco[18 * width + 46] = 10; // Seixos

  // 3. Collision: Obstáculos intransponíveis
  const collision: number[] = new Array(totalTiles).fill(0);

  // Cercas rústicas nas bordas da vila com passagens nas estradas
  for (let x = 0; x < width; x++) {
    if (x !== 28 && x !== 29) {
      collision[0 * width + x] = 8; // Cerca Norte
      collision[(height - 1) * width + x] = 8; // Cerca Sul
    }
  }
  for (let y = 0; y < height; y++) {
    collision[y * width + 0] = 8; // Cerca Oeste
    collision[y * width + (width - 1)] = 8; // Cerca Leste
  }

  // Função auxiliar para erguer casas medievais
  const buildHouse = (startX: number, startY: number, w: number, h: number) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const curX = startX + x;
        const curY = startY + y;
        // Metade inferior são paredes sólidas de tijolo (GID 4)
        if (y < h - 2) {
          // Porta de entrada na base
          if (y === h - 3 && (x === Math.floor(w / 2) || x === Math.floor(w / 2) - 1)) {
            continue;
          }
          collision[curY * width + curX] = 4;
        }
      }
    }
  };

  // Construção 1: Forja do Ferreiro (Noroeste: x: 8..17, y: 7..13)
  buildHouse(8, 7, 10, 7);

  // Construção 2: Taverna da Vila (Nordeste: x: 40..51, y: 7..14)
  buildHouse(40, 7, 12, 8);

  // Construção 3: Casa do Ancião (Sudoeste: x: 8..17, y: 26..32)
  buildHouse(8, 26, 10, 7);

  // O Lago Cristalino (Sudeste: x: 42..54, y: 25..34)
  for (let y = 25; y <= 34; y++) {
    for (let x = 42; x <= 54; x++) {
      const tileGid = ((x + y) % 3 === 0) ? 16 : 5; // Água cintilante ou azul
      collision[y * width + x] = tileGid;
    }
  }

  // Postes de iluminação na entrada da praça
  collision[15 * width + 27] = 26;
  collision[15 * width + 30] = 26;
  collision[24 * width + 27] = 26;
  collision[24 * width + 30] = 26;

  // Troncos de árvores na floresta periférica
  const treePositions = [
    { x: 4, y: 5 }, { x: 6, y: 4 }, { x: 20, y: 4 }, { x: 37, y: 4 }, { x: 56, y: 5 },
    { x: 4, y: 35 }, { x: 20, y: 36 }, { x: 37, y: 36 }, { x: 56, y: 36 }
  ];
  for (const t of treePositions) {
    collision[t.y * width + t.x] = 32; // Tronco com raízes sólido
  }

  // 4. Overhead_Foliage: Copas aéreas renderizadas em depth 2000
  const overhead: number[] = new Array(totalTiles).fill(0);

  // Telhados das casas em camada aérea
  const addRoof = (startX: number, startY: number, w: number, h: number) => {
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < w; x++) {
        overhead[(startY + y) * width + (startX + x)] = 29; // Telhado/copa
      }
    }
  };
  addRoof(8, 5, 10, 7);
  addRoof(40, 5, 12, 8);
  addRoof(8, 24, 10, 7);

  // Copas das árvores acima dos troncos
  for (const t of treePositions) {
    if (t.y - 1 >= 0) {
      overhead[(t.y - 1) * width + t.x] = 29; // Centro da copa
      if (t.x - 1 >= 0) overhead[(t.y - 1) * width + (t.x - 1)] = 30; // Borda esquerda
      if (t.x + 1 < width) overhead[(t.y - 1) * width + (t.x + 1)] = 31; // Borda direita
    }
  }

  // Coleta todos os GIDs únicos de colisão para popular os metadados de tileset
  const collisionGids = Array.from(new Set(collision.filter(gid => gid > 0)));
  const tilesProps = collisionGids.map(gid => ({
    id: gid - 1,
    properties: [
      {
        name: 'collides',
        type: 'bool',
        value: true
      }
    ]
  }));

  const mapJson = {
    compressionlevel: -1,
    height,
    width,
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
        id: 1,
        name: 'Ground_Base',
        type: 'tilelayer',
        width,
        height,
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        data: groundBase
      },
      {
        id: 2,
        name: 'Ground_Deco',
        type: 'tilelayer',
        width,
        height,
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        data: groundDeco
      },
      {
        id: 3,
        name: 'Collision',
        type: 'tilelayer',
        width,
        height,
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        data: collision
      },
      {
        id: 4,
        name: 'Overhead_Foliage',
        type: 'tilelayer',
        width,
        height,
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        data: overhead
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
        tileheight: TILE_SIZE,
        tilewidth: TILE_SIZE,
        tiles: tilesProps
      }
    ]
  };

  return mapJson;
}

export function exportStarterVillage(): StarterVillageExportResult {
  const mapJson = buildStarterVillageMap();

  const pipelineStagingDir = path.resolve(monorepoRoot, 'tools/unity-asset-pipeline/staging/starter-village');
  const clientStagingDir = path.resolve(monorepoRoot, 'packages/client/public/assets/staging');

  if (!fs.existsSync(pipelineStagingDir)) {
    fs.mkdirSync(pipelineStagingDir, { recursive: true });
  }
  if (!fs.existsSync(clientStagingDir)) {
    fs.mkdirSync(clientStagingDir, { recursive: true });
  }

  const pipelineStagingPath = path.join(pipelineStagingDir, 'map_starter_village.json');
  const clientStagingPath = path.join(clientStagingDir, 'map_starter_village.json');

  const content = JSON.stringify(mapJson, null, 2);
  fs.writeFileSync(pipelineStagingPath, content, 'utf-8');
  fs.writeFileSync(clientStagingPath, content, 'utf-8');

  // Gera README de Staging
  const readmeContent = `# Staging da Vila Inicial — NoobRPG

- **Nome do Mapa:** \`map_starter_village.json\`
- **Dimensões:** 60 x 40 tiles (960 x 640 pixels)
- **Tamanho do Tile:** 16 x 16 pixels
- **Orientação:** Ortogonal (Tiled JSON 1.10)
- **Tileset de Referência:** \`tileset_prototype\` (32 tiles, 8 colunas x 4 linhas)
- **Camadas Canônicas:**
  1. \`Ground_Base\` (depth 0)
  2. \`Ground_Deco\` (depth 1)
  3. \`Collision\` (depth 2, com propriedades \`collides: true\` registradas)
  4. \`Overhead_Foliage\` (depth 2000, copas de árvores e beirais acima do jogador)
- **Ponto de Spawn Recomendado:** Praça Central da Vila em x: 464, y: 320 (tile 29, 20)
`;
  fs.writeFileSync(path.join(pipelineStagingDir, 'README.md'), readmeContent, 'utf-8');

  return { mapJson, pipelineStagingPath, clientStagingPath };
}

// Execução direta
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  console.log('[StarterVillage] Exportando mapa da Vila Inicial...');
  const res = exportStarterVillage();
  console.log(`✓ Exportado com sucesso para:`);
  console.log(`  - Pipeline Staging: ${res.pipelineStagingPath}`);
  console.log(`  - Client Staging:   ${res.clientStagingPath}`);
}
