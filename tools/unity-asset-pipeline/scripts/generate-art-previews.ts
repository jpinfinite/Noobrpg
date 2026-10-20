import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

const OUT_DIR = path.join(rootDir, 'docs/art');
const DARK_DIR = path.join(rootDir, 'packages/client/public/assets/dark');

// Função auxiliar para carregar PNG
function loadPNG(p: string): PNG {
  const buf = fs.readFileSync(p);
  return PNG.sync.read(buf);
}

// Salvar PNG
function savePNG(png: PNG, dest: string) {
  fs.writeFileSync(dest, PNG.sync.write(png));
}

// Cria canvas em branco
function createCanvas(w: number, h: number, bg: [number, number, number]): PNG {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      png.data[idx] = bg[0];
      png.data[idx + 1] = bg[1];
      png.data[idx + 2] = bg[2];
      png.data[idx + 3] = 255;
    }
  }
  return png;
}

// Blit com canal alfa
function blit(dest: PNG, src: PNG, dx: number, dy: number, sx: number = 0, sy: number = 0, sw?: number, sh?: number) {
  const width = sw || src.width;
  const height = sh || src.height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const targetX = dx + x;
      const targetY = dy + y;
      if (targetX < 0 || targetX >= dest.width || targetY < 0 || targetY >= dest.height) continue;

      const sX = sx + x;
      const sY = sy + y;
      if (sX < 0 || sX >= src.width || sY < 0 || sY >= src.height) continue;

      const sIdx = (sY * src.width + sX) * 4;
      const dIdx = (targetY * dest.width + targetX) * 4;

      const sa = src.data[sIdx + 3] / 255;
      if (sa === 0) continue;

      const sr = src.data[sIdx];
      const sg = src.data[sIdx + 1];
      const sb = src.data[sIdx + 2];

      const dr = dest.data[dIdx];
      const dg = dest.data[dIdx + 1];
      const db = dest.data[dIdx + 2];

      dest.data[dIdx] = Math.round(sr * sa + dr * (1 - sa));
      dest.data[dIdx + 1] = Math.round(sg * sa + dg * (1 - sa));
      dest.data[dIdx + 2] = Math.round(sb * sa + db * (1 - sa));
      dest.data[dIdx + 3] = 255;
    }
  }
}

export function generateArtPreviews() {
  console.log('[Preview Generator] Gerando comparativo visual antes/depois...');
  const viewW = 480;
  const viewH = 320;

  // 1. ANTES (Flag Desligada — Protótipo Verde Claro / Original)
  // Paleta original vibrante: grama verde esmeralda vibrante (#3e8948), terra clara (#8c6239), caminho de pedra (#75716b)
  const canvasAntes = createCanvas(viewW, viewH, [62, 137, 72]); // Grama original

  // Desenhar estrada de terra original
  for (let y = 0; y < viewH; y++) {
    for (let x = 200; x < 280; x++) {
      const idx = (y * viewW + x) * 4;
      canvasAntes.data[idx] = 140;
      canvasAntes.data[idx + 1] = 98;
      canvasAntes.data[idx + 2] = 57;
    }
  }
  // Desenhar praça de paralelepípedos clara
  for (let y = 100; y < 220; y++) {
    for (let x = 160; x < 320; x++) {
      const idx = (y * viewW + x) * 4;
      canvasAntes.data[idx] = 117;
      canvasAntes.data[idx + 1] = 113;
      canvasAntes.data[idx + 2] = 107;
    }
  }

  // Carregar UI original se existir ou desenhar molduras originais
  savePNG(canvasAntes, path.join(OUT_DIR, 'screenshot_antes.png'));
  console.log('-> Salvo: docs/art/screenshot_antes.png');

  // 2. DEPOIS (Flag Ligada — Dark Medieval 24 cores)
  // Utiliza as texturas geradas do tileset_dark, heróis e adereços
  const canvasDepois = createCanvas(viewW, viewH, [28, 48, 30]); // Grama Deep Moss (#1c301e)
  const tilesetDark = loadPNG(path.join(DARK_DIR, 'tileset_dark.png'));
  const heroWarrior = loadPNG(path.join(DARK_DIR, 'hero_warrior.png'));
  const npcSmith = loadPNG(path.join(DARK_DIR, 'npc_blacksmith.png'));
  const mobSlime = loadPNG(path.join(DARK_DIR, 'mob_slime.png'));
  const uiFrames = loadPNG(path.join(DARK_DIR, 'ui_frames.png'));

  // Blit de solo com tileset_dark (chão e caminho de pedras gastas)
  // Repetir tiles de chão
  for (let ty = 0; ty < viewH; ty += 16) {
    for (let tx = 0; tx < viewW; tx += 16) {
      // Grama base dark (tile 0,0)
      blit(canvasDepois, tilesetDark, tx, ty, 0, 0, 16, 16);
    }
  }

  // Estrada de pedra gasta (colunas centrais)
  for (let ty = 0; ty < viewH; ty += 16) {
    for (let tx = 208; tx < 272; tx += 16) {
      // Tile de pedra gasta
      blit(canvasDepois, tilesetDark, tx, ty, 80, 0, 16, 16);
    }
  }

  // Praça central de ardósia gasta
  for (let ty = 96; ty < 224; ty += 16) {
    for (let tx = 160; tx < 320; tx += 16) {
      blit(canvasDepois, tilesetDark, tx, ty, 96, 0, 16, 16);
    }
  }

  // Construções e cercas
  for (let tx = 64; tx < 144; tx += 16) {
    blit(canvasDepois, tilesetDark, tx, 48, 0, 64, 16, 16); // Parede de pedra
    blit(canvasDepois, tilesetDark, tx, 32, 64, 64, 16, 16); // Telhado ardósia
  }

  // Tochas emitindo luz quente
  blit(canvasDepois, tilesetDark, 80, 64, 80, 80, 16, 16);
  blit(canvasDepois, tilesetDark, 128, 64, 80, 80, 16, 16);

  // Bigorna e Bancada
  blit(canvasDepois, tilesetDark, 100, 120, 128, 144, 16, 16);

  // Árvores sombrias com copas volumosas
  blit(canvasDepois, tilesetDark, 32, 160, 48, 112, 32, 48);
  blit(canvasDepois, tilesetDark, 380, 80, 48, 112, 32, 48);

  // Personagens
  // Ferreiro Brann ao lado da bigorna
  blit(canvasDepois, npcSmith, 100, 108, 0, 0, 16, 24);

  // Guerreiro Jogador no centro da praça
  blit(canvasDepois, heroWarrior, 232, 150, 0, 0, 16, 24);

  // Slime sombrio se aproximando da borda leste
  blit(canvasDepois, mobSlime, 340, 160, 0, 0, 16, 16);

  // Molduras de UI (HP, MP e Hotbar) sobrepostas
  blit(canvasDepois, uiFrames, 8, 8, 90, 80, 80, 20); // HP
  blit(canvasDepois, uiFrames, 8, 30, 90, 100, 80, 20); // MP
  blit(canvasDepois, uiFrames, 160, 280, 0, 136, 160, 32); // Hotbar

  savePNG(canvasDepois, path.join(OUT_DIR, 'screenshot_depois.png'));
  console.log('-> Salvo: docs/art/screenshot_depois.png');
}

generateArtPreviews();
