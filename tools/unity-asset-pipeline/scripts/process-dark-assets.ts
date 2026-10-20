import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

const PALETTE_PATH = path.join(rootDir, 'docs/art/palette.json');
const RAW_DIR = path.join(rootDir, 'assets_src/raw');
const OUT_DIR = path.join(rootDir, 'packages/client/public/assets/dark');
const DOCS_ART_DIR = path.join(rootDir, 'docs/art');

interface PaletteColor {
  index: number;
  hex: string;
  name: string;
  usage: string;
  r: number;
  g: number;
  b: number;
}

interface DecodedImage {
  width: number;
  height: number;
  data: Buffer | Uint8Array;
}

// 1. Carregar Paleta de 24 cores
function loadPalette(): PaletteColor[] {
  const raw = fs.readFileSync(PALETTE_PATH, 'utf-8');
  const json = JSON.parse(raw);
  return json.colors.map((c: any) => {
    const hex = c.hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return { ...c, r, g, b };
  });
}

const palette = loadPalette();

// Distância euclidiana entre cores
function colorDist(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

// Quantiza para a cor mais próxima da paleta
function quantize(r: number, g: number, b: number): { r: number; g: number; b: number } {
  let bestDist = Infinity;
  let best = palette[0];
  for (const p of palette) {
    const d = colorDist(r, g, b, p.r, p.g, p.b);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return { r: best.r, g: best.g, b: best.b };
}

// Identifica se é fundo magenta (#FF00FF)
function isMagenta(r: number, g: number, b: number): boolean {
  // Chroma key tolerante a artefatos de compressão JPEG/PNG
  if (r > 175 && b > 175 && g < 110) return true;
  const distToPureMagenta = colorDist(r, g, b, 255, 0, 255);
  return distToPureMagenta < 12000;
}

// Decodifica arquivo imagem (PNG ou JPEG)
function decodeFile(filePath: string): DecodedImage {
  const buf = fs.readFileSync(filePath);
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    const jpg = jpeg.decode(buf, { useTArray: false });
    return { width: jpg.width, height: jpg.height, data: Buffer.from(jpg.data) };
  } else {
    const png = PNG.sync.read(buf);
    return { width: png.width, height: png.height, data: png.data };
  }
}

// Cria novo PNG vazio com dimensões
function createBlankPNG(w: number, h: number): PNG {
  const png = new PNG({ width: w, height: h });
  png.data.fill(0);
  return png;
}

// Recorta e quantiza uma região
function cropAndQuantize(
  src: DecodedImage,
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number,
  removeMagenta: boolean = true
): PNG {
  const out = createBlankPNG(cropW, cropH);

  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const sx = Math.min(src.width - 1, Math.max(0, cropX + x));
      const sy = Math.min(src.height - 1, Math.max(0, cropY + y));
      const sIdx = (sy * src.width + sx) * 4;
      const oIdx = (y * cropW + x) * 4;

      const r = src.data[sIdx];
      const g = src.data[sIdx + 1];
      const b = src.data[sIdx + 2];
      const a = src.data.length > sIdx + 3 ? src.data[sIdx + 3] : 255;

      if (a === 0 || (removeMagenta && isMagenta(r, g, b))) {
        out.data[oIdx] = 0;
        out.data[oIdx + 1] = 0;
        out.data[oIdx + 2] = 0;
        out.data[oIdx + 3] = 0;
      } else {
        const q = quantize(r, g, b);
        out.data[oIdx] = q.r;
        out.data[oIdx + 1] = q.g;
        out.data[oIdx + 2] = q.b;
        out.data[oIdx + 3] = 255;
      }
    }
  }

  return out;
}

// Salva PNG no disco
function savePNG(png: PNG, destPath: string) {
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(destPath, PNG.sync.write(png));
}

// Processa todas as imagens
export function processAllAssets() {
  console.log('[Pipeline] Iniciando processamento dos assets dark medieval...');
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const generatedManifest: Record<string, any> = {};
  const validationSummary: { name: string; status: string; errors: string[] }[] = [];

  // 1. Tileset do Mundo
  console.log('-> Processando tileset_dark...');
  const rawTileset = decodeFile(path.join(RAW_DIR, 'tileset_dark.png'));
  const processedTileset = cropAndQuantize(rawTileset, 0, 0, rawTileset.width, rawTileset.height);
  const tilesetOutPath = path.join(OUT_DIR, 'tileset_dark.png');
  savePNG(processedTileset, tilesetOutPath);
  generatedManifest['tileset_dark'] = {
    file: 'tileset_dark.png',
    frameWidth: 16,
    frameHeight: 16,
    width: processedTileset.width,
    height: processedTileset.height,
    type: 'tileset'
  };

  // 2. Heróis (Warrior, Ranger, Mage, Druid)
  console.log('-> Processando heróis...');
  const rawHeroes = decodeFile(path.join(RAW_DIR, 'characters_heroes.png'));
  const heroClasses = [
    { key: 'hero_warrior', rowStart: 0, rows: 2 },
    { key: 'hero_ranger', rowStart: 2, rows: 2 },
    { key: 'hero_mage', rowStart: 4, rows: 2 },
    { key: 'hero_druid', rowStart: 6, rows: 2 }
  ];

  const heroRowHeight = Math.floor(rawHeroes.height / 8);
  for (const hc of heroClasses) {
    const yStart = hc.rowStart * heroRowHeight;
    const h = hc.rows * heroRowHeight;
    const heroPng = cropAndQuantize(rawHeroes, 0, yStart, rawHeroes.width, h);
    savePNG(heroPng, path.join(OUT_DIR, `${hc.key}.png`));
    generatedManifest[hc.key] = {
      file: `${hc.key}.png`,
      frameWidth: 16,
      frameHeight: 24,
      directions: ['down', 'left', 'right', 'up'],
      animations: ['idle', 'walk', 'attack', 'hurt', 'death'],
      fps: 8,
      type: 'spritesheet'
    };
  }

  // 3. Monstros e NPCs
  console.log('-> Processando monstros e NPCs...');
  const rawMobsNpcs = decodeFile(path.join(RAW_DIR, 'characters_monsters_npcs.png'));
  const mobRows = [
    { key: 'mob_slime', row: 0, frameW: 16, frameH: 16 },
    { key: 'mob_goblin', row: 1, frameW: 16, frameH: 24 },
    { key: 'mob_skeleton', row: 2, frameW: 16, frameH: 24 },
    { key: 'npc_blacksmith', row: 3, frameW: 16, frameH: 24 },
    { key: 'npc_elder', row: 4, frameW: 16, frameH: 24 },
    { key: 'npc_guard', row: 5, frameW: 16, frameH: 24 },
    { key: 'npc_tavern', row: 6, frameW: 16, frameH: 24 }
  ];
  const mobRowHeight = Math.floor(rawMobsNpcs.height / 7);
  for (const mob of mobRows) {
    const yStart = mob.row * mobRowHeight;
    const mobPng = cropAndQuantize(rawMobsNpcs, 0, yStart, rawMobsNpcs.width, mobRowHeight);
    savePNG(mobPng, path.join(OUT_DIR, `${mob.key}.png`));
    generatedManifest[mob.key] = {
      file: `${mob.key}.png`,
      frameWidth: mob.frameW,
      frameHeight: mob.frameH,
      directions: ['down', 'left', 'right', 'up'],
      fps: 6,
      type: 'spritesheet'
    };
  }

  // 4. Retratos dos 4 NPCs (48x48)
  console.log('-> Processando retratos...');
  const rawPortraits = decodeFile(path.join(RAW_DIR, 'portraits_npcs.png'));
  const halfW = Math.floor(rawPortraits.width / 2);
  const halfH = Math.floor(rawPortraits.height / 2);
  const portraitsConfig = [
    { key: 'portrait_blacksmith', x: 0, y: 0 },
    { key: 'portrait_elder', x: halfW, y: 0 },
    { key: 'portrait_guard', x: 0, y: halfH },
    { key: 'portrait_tavern', x: halfW, y: halfH }
  ];
  for (const pc of portraitsConfig) {
    const pPng = cropAndQuantize(rawPortraits, pc.x, pc.y, halfW, halfH);
    savePNG(pPng, path.join(OUT_DIR, `${pc.key}.png`));
    generatedManifest[pc.key] = {
      file: `${pc.key}.png`,
      width: 48,
      height: 48,
      type: 'portrait'
    };
  }

  // 5. FX de combate
  console.log('-> Processando FX de combate...');
  const rawFx = decodeFile(path.join(RAW_DIR, 'fx_effects.png'));
  const fxList = [
    { key: 'fx_slash', row: 0 },
    { key: 'fx_arrow', row: 1 },
    { key: 'fx_magic_orb', row: 2 },
    { key: 'fx_nature_burst', row: 3 },
    { key: 'fx_impact_spark', row: 4 },
    { key: 'fx_heal_aura', row: 5 }
  ];
  const fxRowH = Math.floor(rawFx.height / 6);
  for (const fx of fxList) {
    const yStart = fx.row * fxRowH;
    const fxPng = cropAndQuantize(rawFx, 0, yStart, rawFx.width, fxRowH);
    savePNG(fxPng, path.join(OUT_DIR, `${fx.key}.png`));
    generatedManifest[fx.key] = {
      file: `${fx.key}.png`,
      frameHeight: 32,
      type: 'fx'
    };
  }

  // 6. Molduras de UI
  console.log('-> Processando molduras de UI...');
  const rawUi = decodeFile(path.join(RAW_DIR, 'ui_frames.png'));
  const uiPng = cropAndQuantize(rawUi, 0, 0, rawUi.width, rawUi.height);
  savePNG(uiPng, path.join(OUT_DIR, 'ui_frames.png'));
  generatedManifest['ui_frames'] = {
    file: 'ui_frames.png',
    type: 'ui'
  };

  // 7. Gerar Manifesto em manifest.json
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(generatedManifest, null, 2));
  console.log('[Pipeline] manifest.json gerado com sucesso.');

  // 8. Montar e exportar Mapa da Vila Inicial Tiled JSON 1.10
  console.log('-> Montando mapa da vila inicial dark medieval...');
  const mapWidth = 60;
  const mapHeight = 40;
  const totalTiles = mapWidth * mapHeight;

  // Ground_Base: Grama escura (GID 1)
  const groundBase = new Array(totalTiles).fill(1);

  // Ground_Deco: Estradas, praça e caminhos de pedra gasta (GID 2: terra, GID 25: pedra)
  const groundDeco = new Array(totalTiles).fill(0);
  for (let y = 0; y < mapHeight; y++) {
    groundDeco[y * mapWidth + 28] = 2;
    groundDeco[y * mapWidth + 29] = 2;
  }
  for (let x = 10; x < 50; x++) {
    groundDeco[19 * mapWidth + x] = 2;
    groundDeco[20 * mapWidth + x] = 2;
  }
  for (let y = 16; y <= 23; y++) {
    for (let x = 24; x <= 33; x++) {
      groundDeco[y * mapWidth + x] = 25;
    }
  }

  // Collision: Paredes de pedra (GID 4), cercas (GID 8)
  const collision = new Array(totalTiles).fill(0);
  for (let x = 0; x < mapWidth; x++) {
    if (x !== 28 && x !== 29) {
      collision[0 * mapWidth + x] = 8;
      collision[(mapHeight - 1) * mapWidth + x] = 8;
    }
  }
  for (let y = 0; y < mapHeight; y++) {
    collision[y * mapWidth + 0] = 8;
    collision[y * mapWidth + (mapWidth - 1)] = 8;
  }

  // Construções medievais
  const buildDarkHouse = (startX: number, startY: number, w: number, h: number) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cx = startX + x;
        const cy = startY + y;
        if (y < h - 2) {
          if (y === h - 3 && (x === Math.floor(w / 2) || x === Math.floor(w / 2) - 1)) {
            continue;
          }
          collision[cy * mapWidth + cx] = 4;
        }
      }
    }
  };

  buildDarkHouse(8, 7, 10, 7); // Forja
  buildDarkHouse(40, 7, 12, 8); // Taverna
  buildDarkHouse(8, 26, 10, 7); // Casa do Ancião

  // Overhead_Foliage: Copas das árvores
  const overheadFoliage = new Array(totalTiles).fill(0);

  const darkMapTiled = {
    compressionlevel: -1,
    width: mapWidth,
    height: mapHeight,
    infinite: false,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tiledversion: '1.10.2',
    tilewidth: 16,
    tileheight: 16,
    version: '1.10',
    nextlayerid: 5,
    nextobjectid: 1,
    tilesets: [
      {
        firstgid: 1,
        name: 'tileset_dark',
        tilewidth: 16,
        tileheight: 16,
        tilecount: 100,
        columns: 10,
        image: 'tileset_dark.png'
      }
    ],
    layers: [
      {
        id: 1,
        name: 'Ground_Base',
        type: 'tilelayer',
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        width: mapWidth,
        height: mapHeight,
        data: groundBase
      },
      {
        id: 2,
        name: 'Ground_Deco',
        type: 'tilelayer',
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        width: mapWidth,
        height: mapHeight,
        data: groundDeco
      },
      {
        id: 3,
        name: 'Collision',
        type: 'tilelayer',
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        width: mapWidth,
        height: mapHeight,
        data: collision
      },
      {
        id: 4,
        name: 'Overhead_Foliage',
        type: 'tilelayer',
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        width: mapWidth,
        height: mapHeight,
        data: overheadFoliage
      }
    ]
  };

  const mapOutPath = path.join(OUT_DIR, 'map_starter_village_dark.json');
  fs.writeFileSync(mapOutPath, JSON.stringify(darkMapTiled, null, 2));
  console.log('[Pipeline] Mapa Tiled map_starter_village_dark.json exportado com sucesso.');

  // 9. Extração de colisão para o servidor em docs/art/collision.json
  const collisionData = {
    mapWidth,
    mapHeight,
    tileWidth: 16,
    tileHeight: 16,
    totalColliders: collision.filter(c => c > 0).length,
    collisionGrid: collision,
    blockedCoords: [] as { x: number; y: number; tileX: number; tileY: number }[]
  };

  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
      if (collision[y * mapWidth + x] > 0) {
        collisionData.blockedCoords.push({
          x: x * 16 + 8,
          y: y * 16 + 8,
          tileX: x,
          tileY: y
        });
      }
    }
  }

  fs.writeFileSync(path.join(DOCS_ART_DIR, 'collision.json'), JSON.stringify(collisionData, null, 2));
  console.log('[Pipeline] collision.json salvo em docs/art/collision.json.');

  // 10. Auto-validação de conformidade de todos os assets
  console.log('-> Executando validação automática estrita...');
  const filesToCheck = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png'));
  for (const f of filesToCheck) {
    const pngPath = path.join(OUT_DIR, f);
    const pngBuf = fs.readFileSync(pngPath);
    const png = PNG.sync.read(pngBuf);
    let invalidPixels = 0;
    const errors: string[] = [];

    for (let i = 0; i < png.data.length; i += 4) {
      const a = png.data[i + 3];
      if (a === 0) continue; // Transparência permitida
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];

      const match = palette.some(p => p.r === r && p.g === g && p.b === b);
      if (!match) {
        invalidPixels++;
      }
    }

    if (invalidPixels > 0) {
      errors.push(`${invalidPixels} pixels fora da paleta de 24 cores.`);
    }

    validationSummary.push({
      name: f,
      status: errors.length === 0 ? 'APROVADO' : 'ABAIXO DO PADRÃO',
      errors
    });
  }

  console.log('\n=== RELATÓRIO DE VALIDAÇÃO AUTOMÁTICA ===');
  console.table(validationSummary);
  return { manifest: generatedManifest, validation: validationSummary };
}

// Execução
try {
  processAllAssets();
} catch (e) {
  console.error('[Pipeline Erro]:', e);
  process.exit(1);
}
