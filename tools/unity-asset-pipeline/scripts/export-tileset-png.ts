import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const monorepoRoot = path.resolve(__dirname, '../../..');

/**
 * Cria um buffer PNG válido RGBA sem bibliotecas externas pesadas, usando zlib nativo do Node.js.
 */
function createPngBuffer(width: number, height: number, rgbaData: Buffer): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // Chunk IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression method
  ihdr[11] = 0; // Filter method
  ihdr[12] = 0; // Interlace method

  const ihdrChunk = createChunk('IHDR', ihdr);

  // Raw image scanlines com filtro 0 (None)
  const scanlineLength = 1 + width * 4;
  const rawScanlines = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    const scanlineStart = y * scanlineLength;
    rawScanlines[scanlineStart] = 0; // Filter: 0 (None)
    rgbaData.copy(rawScanlines, scanlineStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(rawScanlines);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type: string, data: Buffer): Buffer {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

// Tabela e cálculo de CRC32 padrão IEEE 802.3 para PNG
const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function exportTilesetAssets(): void {
  const width = 128;
  const height = 64;
  const rgbaBuffer = Buffer.alloc(width * height * 4, 0);

  // Helper para pintar retângulos
  const fillRect = (rx: number, ry: number, rw: number, rh: number, r: number, g: number, b: number, a: number = 255) => {
    for (let y = ry; y < ry + rh; y++) {
      if (y < 0 || y >= height) continue;
      for (let x = rx; x < rx + rw; x++) {
        if (x < 0 || x >= width) continue;
        const idx = (y * width + x) * 4;
        rgbaBuffer[idx] = r;
        rgbaBuffer[idx + 1] = g;
        rgbaBuffer[idx + 2] = b;
        rgbaBuffer[idx + 3] = a;
      }
    }
  };

  // Cores canônicas do NoobRPG
  // GID 1 (0,0): Grama rica #2d6a4f
  fillRect(0, 0, 16, 16, 0x2d, 0x6a, 0x4f);
  fillRect(2, 2, 3, 2, 0x40, 0x91, 0x6c);
  fillRect(8, 4, 2, 2, 0x40, 0x91, 0x6c);

  // GID 2 (16,0): Terra rústica #8b5e34
  fillRect(16, 0, 16, 16, 0x8b, 0x5e, 0x34);
  fillRect(18, 3, 4, 3, 0xa0, 0x6a, 0x3b);
  fillRect(24, 8, 3, 3, 0xa0, 0x6a, 0x3b);

  // GID 3 (32,0): Pavimento de pedra cinza #6c757d
  fillRect(32, 0, 16, 16, 0x6c, 0x75, 0x7d);
  fillRect(32, 7, 16, 1, 0x49, 0x50, 0x57);
  fillRect(39, 0, 1, 7, 0x49, 0x50, 0x57);

  // GID 4 (48,0): Parede de masmorra #343a40
  fillRect(48, 0, 16, 16, 0x34, 0x3a, 0x40);
  fillRect(48, 8, 16, 1, 0x21, 0x25, 0x29);
  fillRect(55, 0, 1, 8, 0x21, 0x25, 0x29);

  // GID 5 (64,0): Água azul com ondas #0077b6
  fillRect(64, 0, 16, 16, 0x00, 0x77, 0xb6);
  fillRect(66, 3, 5, 2, 0x00, 0x96, 0xc7);

  // GID 6 (80,0): Flores amarelas
  fillRect(80, 0, 16, 16, 0x2d, 0x6a, 0x4f);
  fillRect(83, 4, 3, 3, 0xfe, 0xf0, 0x8a);

  // GID 7 (96,0): Flores vermelhas
  fillRect(96, 0, 16, 16, 0x2d, 0x6a, 0x4f);
  fillRect(99, 4, 3, 3, 0xf4, 0x3f, 0x5e);

  // GID 8 (112,0): Cerca de madeira rústica
  fillRect(112, 0, 16, 16, 0x2d, 0x6a, 0x4f);
  fillRect(114, 2, 3, 14, 0x78, 0x35, 0x0f);
  fillRect(122, 2, 3, 14, 0x78, 0x35, 0x0f);
  fillRect(112, 5, 16, 3, 0x92, 0x40, 0x0e);

  // GID 16 (112, 16): Água reflexiva
  fillRect(112, 16, 16, 16, 0x00, 0x77, 0xb6);
  fillRect(114, 19, 6, 2, 0xca, 0xf0, 0xf8);

  // GID 25 (0, 48): Calçamento nobre de basalto #374151
  fillRect(0, 48, 16, 16, 0x37, 0x41, 0x51);
  fillRect(0, 55, 16, 1, 0x1f, 0x29, 0x37);
  fillRect(7, 48, 1, 7, 0x1f, 0x29, 0x37);

  // GID 26 (16, 48): Poste de sinalização
  fillRect(16, 48, 16, 16, 0x2d, 0x6a, 0x4f);
  fillRect(23, 50, 2, 14, 0x78, 0x35, 0x0f);
  fillRect(19, 51, 10, 4, 0xa1, 0x62, 0x07);

  // GID 29 (64, 48): Copa de árvore superior
  fillRect(64, 48, 16, 16, 0x1b, 0x43, 0x32);
  fillRect(68, 50, 8, 8, 0x2d, 0x6a, 0x4f);
  fillRect(70, 52, 4, 4, 0x52, 0xb7, 0x88);

  // GID 32 (112, 48): Tronco e raízes
  fillRect(112, 48, 16, 16, 0x2d, 0x6a, 0x4f);
  fillRect(118, 50, 5, 12, 0x58, 0x2f, 0x0e);
  fillRect(120, 50, 2, 12, 0x7f, 0x4f, 0x24);

  const pngBuffer = createPngBuffer(width, height, rgbaBuffer);

  const stagingDir = path.resolve(monorepoRoot, 'tools/unity-asset-pipeline/staging/starter-village');
  if (!fs.existsSync(stagingDir)) fs.mkdirSync(stagingDir, { recursive: true });

  const targetPng = path.join(stagingDir, 'tileset_prototype.png');
  fs.writeFileSync(targetPng, pngBuffer);

  // Metadados do tileset
  const meta = {
    name: 'tileset_prototype',
    image: 'tileset_prototype.png',
    imagewidth: width,
    imageheight: height,
    tilewidth: 16,
    tileheight: 16,
    tilecount: 32,
    columns: 8,
    margin: 0,
    spacing: 0,
    properties: {
      pixelArt: true,
      filterMode: 'Point',
      compression: 'None'
    }
  };
  fs.writeFileSync(path.join(stagingDir, 'tileset_prototype.meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

  console.log(`✓ Tileset PNG e metadados exportados em: ${stagingDir}`);
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  exportTilesetAssets();
}
