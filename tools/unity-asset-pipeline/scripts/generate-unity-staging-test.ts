import fs from 'fs';
import path from 'path';

/**
 * Gera um mapa protótipo de staging no formato exato exportado pelo NoobRpgMapExporter (Unity)
 * para validar o pipeline sem alterar o mapa de produção (map_prototype.json).
 */
export function generateUnityStagingMap(outputPath: string): void {
  const width = 30; // 30 tiles = 480 px (1 tela exata)
  const height = 20; // 20 tiles = 320 px (~1 tela)
  const totalTiles = width * height;

  // Camada 1: Ground_Base (Grama uniforme: GID 4)
  const groundBaseData: number[] = new Array(totalTiles).fill(4);

  // Camada 2: Ground_Deco (Caminho central de terra GID 1 e flores GID 6)
  const groundDecoData: number[] = new Array(totalTiles).fill(0);
  for (let y = 0; y < height; y++) {
    // Caminho vertical na coluna 14 e 15
    groundDecoData[y * width + 14] = 1;
    groundDecoData[y * width + 15] = 1;
  }
  // Flores esparsas
  groundDecoData[5 * width + 5] = 6;
  groundDecoData[12 * width + 22] = 6;

  // Camada 3: Collision (Lago nos cantos e paredes nas bordas)
  const collisionData: number[] = new Array(totalTiles).fill(0);
  // Bordas sólidas
  for (let x = 0; x < width; x++) {
    collisionData[0 * width + x] = 12; // Borda superior
    collisionData[(height - 1) * width + x] = 12; // Borda inferior
  }
  for (let y = 0; y < height; y++) {
    collisionData[y * width + 0] = 12; // Borda esquerda
    collisionData[y * width + (width - 1)] = 12; // Borda direita
  }
  // Pequeno lago intransponível em (x: 20..25, y: 5..10)
  for (let y = 5; y <= 10; y++) {
    for (let x = 20; x <= 25; x++) {
      collisionData[y * width + x] = 9; // Tile de água/colisão
    }
  }

  // Camada 4: Overhead_Foliage (Copas de árvores decorativas acima do player)
  const overheadData: number[] = new Array(totalTiles).fill(0);
  overheadData[4 * width + 8] = 15;
  overheadData[4 * width + 9] = 16;

  const mapJson = {
    compressionlevel: -1,
    height,
    width,
    infinite: false,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tiledversion: '1.10.2',
    tileheight: 16,
    tilewidth: 16,
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
        data: groundBaseData
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
        data: groundDecoData
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
        data: collisionData
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
        data: overheadData
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
        tilewidth: 16
      }
    ]
  };

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(mapJson, null, 2), 'utf-8');
  console.log(`[Unity Pipeline Staging] Mapa gerado com sucesso em: ${outputPath}`);
}

// Execução
const target = path.resolve('packages/client/public/assets/staging/map_unity_prototype.json');
generateUnityStagingMap(target);
