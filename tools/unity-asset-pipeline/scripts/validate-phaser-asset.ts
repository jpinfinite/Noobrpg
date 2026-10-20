import fs from 'fs';
import path from 'path';

export interface TiledMapSchema {
  compressionlevel: number;
  width: number;
  height: number;
  infinite: boolean;
  orientation: string;
  renderorder: string;
  tiledversion: string;
  tileheight: number;
  tilewidth: number;
  version: string;
  nextlayerid: number;
  nextobjectid: number;
  layers: Array<{
    name: string;
    type: string;
    width: number;
    height: number;
    visible: boolean;
    opacity: number;
    data: number[];
  }>;
  tilesets: Array<{
    name: string;
    firstgid: number;
    image: string;
    tilewidth: number;
    tileheight: number;
    tilecount: number;
    columns: number;
  }>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    width: number;
    height: number;
    tileWidth: number;
    tileHeight: number;
    layerCount: number;
    layerNames: string[];
  };
}

/**
 * Validador estrito de conformidade para Mapas Tiled JSON compatíveis com o NoobRPG Phaser 3
 */
export function validateTiledMap(filePath: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!fs.existsSync(filePath)) {
    return { valid: false, errors: [`Arquivo não encontrado: ${filePath}`], warnings: [] };
  }

  let mapData: TiledMapSchema;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    mapData = JSON.parse(raw);
  } catch (err: any) {
    return { valid: false, errors: [`JSON inválido ou corrompido: ${err.message}`], warnings: [] };
  }

  // 1. Verificações de estrutura e dimensões básicas
  if (mapData.orientation !== 'orthogonal') {
    errors.push(`Orientação inválida: "${mapData.orientation}". Deve ser estritamente "orthogonal".`);
  }
  if (mapData.tilewidth !== 16 || mapData.tileheight !== 16) {
    errors.push(`Dimensão de tile inválida (${mapData.tilewidth}x${mapData.tileheight}). NoobRPG requer estritamente 16x16.`);
  }
  if (!mapData.width || mapData.width <= 0 || !mapData.height || mapData.height <= 0) {
    errors.push(`Dimensões de mapa inválidas: ${mapData.width}x${mapData.height}.`);
  }

  // 2. Verificação de Tilesets
  if (!mapData.tilesets || mapData.tilesets.length === 0) {
    errors.push('O mapa deve referenciar ao menos um tileset com firstgid=1.');
  } else {
    const primary = mapData.tilesets[0];
    if (primary.firstgid !== 1) {
      warnings.push(`firstgid do primeiro tileset é ${primary.firstgid}; o esperado é 1.`);
    }
  }

  // 3. Verificação de Camadas Canônicas
  if (!mapData.layers || !Array.isArray(mapData.layers)) {
    errors.push('Campo "layers" ausente ou inválido no JSON do mapa.');
    return { valid: false, errors, warnings };
  }

  const layerNames = mapData.layers.map(l => l.name);
  const canonicalRequired = ['Ground_Base', 'Collision'];
  for (const req of canonicalRequired) {
    if (!layerNames.some(n => n.toLowerCase() === req.toLowerCase() || (req === 'Ground_Base' && n.toLowerCase() === 'ground'))) {
      errors.push(`Camada obrigatória ausente: "${req}".`);
    }
  }

  // 4. Verificação de integridade dos dados de cada camada
  const expectedLength = mapData.width * mapData.height;
  for (const layer of mapData.layers) {
    if (layer.type === 'tilelayer') {
      if (!Array.isArray(layer.data)) {
        errors.push(`Camada "${layer.name}" não contém um array numérico no campo "data".`);
      } else if (layer.data.length !== expectedLength) {
        errors.push(
          `Camada "${layer.name}" possui tamanho de dados inconsistente (${layer.data.length}). Esperado: ${expectedLength} (${mapData.width}x${mapData.height}).`
        );
      }
    }
  }

  const valid = errors.length === 0;
  return {
    valid,
    errors,
    warnings,
    metadata: {
      width: mapData.width,
      height: mapData.height,
      tileWidth: mapData.tilewidth,
      tileHeight: mapData.tileheight,
      layerCount: mapData.layers.length,
      layerNames
    }
  };
}

// Execução direta via CLI se chamado diretamente
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const targetFile = process.argv[2] || 'packages/client/public/assets/maps/map_prototype.json';
  console.log(`[Asset Validator] Inspecionando mapa: ${targetFile}`);
  const result = validateTiledMap(targetFile);
  console.log('Resultado da validação:', JSON.stringify(result, null, 2));
  process.exit(result.valid ? 0 : 1);
}
