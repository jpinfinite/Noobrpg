import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateTiledMap } from '../../../tools/unity-asset-pipeline/scripts/validate-phaser-asset.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const monorepoRoot = path.resolve(__dirname, '../../..');

describe('NoobRPG — Pipeline de Integração Unity -> Phaser 3', () => {
  it('1. Valida conformidade do mapa de produção existente', () => {
    const prodMapPath = path.resolve(monorepoRoot, 'packages/client/public/assets/maps/map_prototype.json');
    assert.ok(fs.existsSync(prodMapPath), 'map_prototype.json deve existir');

    const result = validateTiledMap(prodMapPath);
    assert.equal(result.valid, true, `Erros encontrados: ${result.errors.join(', ')}`);
    assert.equal(result.metadata?.tileWidth, 16);
    assert.equal(result.metadata?.tileHeight, 16);
    assert.ok(result.metadata?.layerNames.includes('Ground_Base') || result.metadata?.layerNames.includes('Ground'));
    assert.ok(result.metadata?.layerNames.includes('Collision'));
  });

  it('2. Valida compatibilidade do mapa exportado pelo pipeline Unity (staging)', () => {
    const stagingMapPath = path.resolve(monorepoRoot, 'packages/client/public/assets/staging/map_unity_prototype.json');
    assert.ok(fs.existsSync(stagingMapPath), 'map_unity_prototype.json deve existir na pasta de staging');

    const result = validateTiledMap(stagingMapPath);
    assert.equal(result.valid, true, `Erros encontrados: ${result.errors.join(', ')}`);
    assert.equal(result.metadata?.width, 30);
    assert.equal(result.metadata?.height, 20);
    assert.equal(result.metadata?.tileWidth, 16);
    assert.equal(result.metadata?.tileHeight, 16);
    assert.deepEqual(result.metadata?.layerNames, [
      'Ground_Base',
      'Ground_Deco',
      'Collision',
      'Overhead_Foliage'
    ]);
  });

  it('3. Valida metadados de spritesheet do pipeline Unity (origem no pé e grade 16x24)', () => {
    const metaPath = path.resolve(monorepoRoot, 'packages/client/public/assets/staging/spritesheet_unity_test.meta.json');
    assert.ok(fs.existsSync(metaPath), 'spritesheet_unity_test.meta.json deve existir');

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    assert.equal(meta.frameHeight, 24);
    assert.equal(meta.originX, 0.5);
    assert.equal(meta.originY, 1.0);
    assert.ok(meta.animations.length > 0);
  });

  it('4. Valida presença dos scripts C# de exportação do Unity Editor', () => {
    const mapExporterPath = path.resolve(monorepoRoot, 'tools/unity-asset-pipeline/Assets/Editor/NoobRpgMapExporter.cs');
    const spriteExporterPath = path.resolve(monorepoRoot, 'tools/unity-asset-pipeline/Assets/Editor/NoobRpgSpriteExporter.cs');

    assert.ok(fs.existsSync(mapExporterPath), 'NoobRpgMapExporter.cs deve existir no pipeline');
    assert.ok(fs.existsSync(spriteExporterPath), 'NoobRpgSpriteExporter.cs deve existir no pipeline');

    const mapCode = fs.readFileSync(mapExporterPath, 'utf-8');
    assert.ok(mapCode.includes('TiledMapJson'));
    assert.ok(mapCode.includes('ExportGridToTiledJson'));

    const spriteCode = fs.readFileSync(spriteExporterPath, 'utf-8');
    assert.ok(spriteCode.includes('ExportSpritesToHorizontalSheet'));
    assert.ok(spriteCode.includes('TextureFormat.RGBA32'));
  });

  it('5. Valida conformidade e integridade da Vila Inicial (map_starter_village.json)', () => {
    const villageClientPath = path.resolve(monorepoRoot, 'packages/client/public/assets/staging/map_starter_village.json');
    assert.ok(fs.existsSync(villageClientPath), 'map_starter_village.json deve existir no staging do cliente');

    const result = validateTiledMap(villageClientPath);
    assert.equal(result.valid, true, `Erros encontrados: ${result.errors.join(', ')}`);
    assert.equal(result.metadata?.width, 60, 'Largura deve ser exatamente 60 tiles');
    assert.equal(result.metadata?.height, 40, 'Altura deve ser exatamente 40 tiles');
    assert.equal(result.metadata?.tileWidth, 16);
    assert.equal(result.metadata?.tileHeight, 16);
    assert.deepEqual(result.metadata?.layerNames, [
      'Ground_Base',
      'Ground_Deco',
      'Collision',
      'Overhead_Foliage'
    ]);

    // Valida propriedades de colisão no tileset
    const mapData = JSON.parse(fs.readFileSync(villageClientPath, 'utf-8'));
    assert.ok(mapData.tilesets[0].tiles.length > 0, 'Tileset deve registrar tiles com propriedades de colisão');
    const hasCollidesProp = mapData.tilesets[0].tiles.some((t: any) =>
      t.properties && t.properties.some((p: any) => p.name === 'collides' && p.value === true)
    );
    assert.ok(hasCollidesProp, 'Tileset deve conter ao menos um tile com propriedade "collides": true');
  });

  it('6. Valida pacote de artefatos de staging da Vila Inicial em tools/staging/', () => {
    const stagingDir = path.resolve(monorepoRoot, 'tools/unity-asset-pipeline/staging/starter-village');
    assert.ok(fs.existsSync(stagingDir), 'Diretório staging/starter-village deve existir');

    const mapJsonPath = path.join(stagingDir, 'map_starter_village.json');
    const pngPath = path.join(stagingDir, 'tileset_prototype.png');
    const metaPath = path.join(stagingDir, 'tileset_prototype.meta.json');
    const readmePath = path.join(stagingDir, 'README.md');

    assert.ok(fs.existsSync(mapJsonPath), 'map_starter_village.json deve existir no pipeline staging');
    assert.ok(fs.existsSync(pngPath), 'tileset_prototype.png deve existir');
    assert.ok(fs.existsSync(metaPath), 'tileset_prototype.meta.json deve existir');
    assert.ok(fs.existsSync(readmePath), 'README.md deve existir');

    const pngStat = fs.statSync(pngPath);
    assert.ok(pngStat.size > 0, 'tileset_prototype.png não pode estar vazio');
  });

  it('7. Valida cena de autoria Unity NoobRPG_StarterVillage e construtor C#', () => {
    const scenePath = path.resolve(monorepoRoot, 'tools/unity-asset-pipeline/Assets/Scenes/NoobRPG_StarterVillage.unity');
    const builderPath = path.resolve(monorepoRoot, 'tools/unity-asset-pipeline/Assets/Editor/StarterVillageBuilder.cs');
    const versionPath = path.resolve(monorepoRoot, 'tools/unity-asset-pipeline/ProjectSettings/ProjectVersion.txt');

    assert.ok(fs.existsSync(scenePath), 'Cena NoobRPG_StarterVillage.unity deve existir');
    assert.ok(fs.existsSync(builderPath), 'StarterVillageBuilder.cs deve existir');
    assert.ok(fs.existsSync(versionPath), 'ProjectVersion.txt deve existir');

    const sceneContent = fs.readFileSync(scenePath, 'utf-8');
    assert.ok(sceneContent.includes('Ground_Base'), 'Cena deve conter a camada Ground_Base');
    assert.ok(sceneContent.includes('Collision'), 'Cena deve conter a camada Collision');
    assert.ok(sceneContent.includes('Overhead_Foliage'), 'Cena deve conter a camada Overhead_Foliage');
  });
});
