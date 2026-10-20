import { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { MapCollisionGrid } from '../src/simulation/MapCollisionGrid.js';
import { ServerPlayer } from '../src/simulation/ServerPlayer.js';
import { CharacterClass, Direction } from '@noobrpg/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const monorepoRoot = path.resolve(__dirname, '../../..');

describe('NoobRPG — Missão 2: Colisões e Jogabilidade da Vila Inicial', () => {

  it('1. Grade de Colisão da Vila Inicial: Inicializa 60x40 tiles com dados determinísticos', () => {
    const villageBounds = MapCollisionGrid.getMapBounds('map_starter_village');
    assert.strictEqual(villageBounds.width, 960, 'Largura da Vila Inicial deve ser 960 px (60 tiles x 16px)');
    assert.strictEqual(villageBounds.height, 640, 'Altura da Vila Inicial deve ser 640 px (40 tiles x 16px)');

    const isInside = MapCollisionGrid.isInsideMap(464, 320, 'map_starter_village');
    assert.strictEqual(isInside, true, 'Spawn da Vila Inicial (464, 320) deve estar dentro dos limites');

    const isOutside = MapCollisionGrid.isInsideMap(970, 320, 'map_starter_village');
    assert.strictEqual(isOutside, false, 'Coordenada fora do mapa deve ser rejeitada');
  });

  it('2. Obstáculos da Vila Inicial Bloqueiam Movimento Autoritativo', () => {
    const villageMapPath = path.resolve(monorepoRoot, 'packages/client/public/assets/staging/map_starter_village.json');
    assert.strictEqual(fs.existsSync(villageMapPath), true, 'map_starter_village.json deve existir em public/assets/staging/');
    const villageJson = JSON.parse(fs.readFileSync(villageMapPath, 'utf8'));
    const collisionLayer = villageJson.layers.find((l: any) => l.name === 'Collision');
    assert.ok(collisionLayer, 'Camada Collision deve existir no mapa da vila');

    // Identifica um tile sólido garantido (tile != 0)
    let solidX = -1;
    let solidY = -1;
    for (let ty = 0; ty < collisionLayer.height; ty++) {
      for (let tx = 0; tx < collisionLayer.width; tx++) {
        const val = collisionLayer.data[ty * collisionLayer.width + tx];
        if (val !== 0) {
          solidX = tx * 16 + 8;
          solidY = ty * 16 + 8;
          break;
        }
      }
      if (solidX !== -1) break;
    }

    assert.ok(solidX > 0 && solidY > 0, 'Deve haver ao menos um tile sólido');
    const walkable = MapCollisionGrid.isWalkable(solidX, solidY, 5, 'map_starter_village');
    assert.strictEqual(walkable, false, `Tile sólido em (${solidX}, ${solidY}) deve bloquear movimento`);
  });

  it('3. Áreas Transitáveis da Vila Inicial Permanecem Livres', () => {
    // Praça Central e Ponto de Spawn (464, 320)
    const isSpawnWalkable = MapCollisionGrid.isWalkable(464, 320, 5, 'map_starter_village');
    assert.strictEqual(isSpawnWalkable, true, 'Ponto de Spawn da Vila (464, 320) deve ser livre');

    // Ao lado da Bigorna / Forja (440, 310)
    const isCraftWalkable = MapCollisionGrid.isWalkable(440, 310, 5, 'map_starter_village');
    assert.strictEqual(isCraftWalkable, true, 'Área da praça/forja (440, 310) deve ser livre');

    // Ao redor do Ancião (464, 280)
    const isElderAreaWalkable = MapCollisionGrid.isWalkable(464, 285, 4, 'map_starter_village');
    assert.strictEqual(isElderAreaWalkable, true, 'Área diante do Ancião Aldor deve ser transitável');
  });

  it('4. Regressão Garantida no Mapa Original (map_prototype)', () => {
    // Bounds do mapa original (1920x1280)
    const protoBounds = MapCollisionGrid.getMapBounds('map_prototype');
    assert.strictEqual(protoBounds.width, 1920);
    assert.strictEqual(protoBounds.height, 1280);

    // Spawn do protótipo (180, 160)
    const isSpawnWalkable = MapCollisionGrid.isWalkable(180, 160, 5, 'map_prototype');
    assert.strictEqual(isSpawnWalkable, true, 'Spawn do mapa protótipo deve ser livre');

    // Árvore do protótipo em (120, 110)
    const isTreeWalkable = MapCollisionGrid.isWalkable(120, 110, 5, 'map_prototype');
    assert.strictEqual(isTreeWalkable, false, 'Árvore em (120, 110) do protótipo deve continuar bloqueando');
  });

  it('5. Validação Autoritativa de Movimento com ServerPlayer na Vila Inicial', () => {
    const player = new ServerPlayer({
      id: 'test_village_hero',
      accountId: 'acc_village_test',
      name: 'HeroiDaVila',
      characterClass: CharacterClass.WARRIOR,
      level: 1,
      currentXp: 0,
      gold: 100,
      meritPoints: 0,
      position: { x: 464, y: 320 },
      direction: Direction.DOWN,
      attributes: {
        maxHp: 120,
        currentHp: 120,
        maxMp: 30,
        currentMp: 30,
        attack: 15,
        defense: 5,
        speed: 120
      },
      inventory: [],
      equipped: { weapon: null, armor: null, accessory: null },
      version: 1,
      mapKey: 'map_starter_village'
    });

    assert.strictEqual(player.mapKey, 'map_starter_village');

    // Movimento legal válido de 464, 320 para 460, 320
    const moveResult = player.validateAndApplyMovement(460, 320, 50);
    assert.strictEqual(moveResult.success, true, 'Movimento válido na praça da vila deve ser aceito');
    assert.strictEqual(player.x, 460);
    assert.strictEqual(player.y, 320);

    // Tentativa de teleporte absurdo para fora do mapa
    const invalidResult = player.validateAndApplyMovement(1200, 320, 50);
    assert.strictEqual(invalidResult.success, false, 'Movimento para fora dos limites deve ser rejeitado');
  });

  it('6. Verificação de Coerência dos NPCs da Vila Inicial no Cliente', () => {
    const npcFilePath = path.resolve(monorepoRoot, 'packages/client/src/entities/NPC.ts');
    assert.strictEqual(fs.existsSync(npcFilePath), true, 'Classe NPC.ts deve existir');
    const npcCode = fs.readFileSync(npcFilePath, 'utf8');

    assert.ok(npcCode.includes('open-npc-dialog'), 'NPC deve emitir evento open-npc-dialog');
    assert.ok(npcCode.includes('updateNPC'), 'NPC deve ter rotina updateNPC com raio de interação');

    // Texturas dos NPCs em TextureGenerator.ts
    const textureGenPath = path.resolve(monorepoRoot, 'packages/client/src/utils/TextureGenerator.ts');
    const textureCode = fs.readFileSync(textureGenPath, 'utf8');
    assert.ok(textureCode.includes('npc_blacksmith'), 'TextureGenerator deve conter spritesheet do ferreiro');
    assert.ok(textureCode.includes('npc_elder'), 'TextureGenerator deve conter spritesheet do ancião');

    // UI Scene dialog & tutorial
    const uiScenePath = path.resolve(monorepoRoot, 'packages/client/src/scenes/UIScene.ts');
    const uiCode = fs.readFileSync(uiScenePath, 'utf8');
    assert.ok(uiCode.includes('createTutorialHUD'), 'UIScene deve implementar painel de tutorial');
    assert.ok(uiCode.includes('createNpcDialogModal'), 'UIScene deve implementar modal de diálogo');
    assert.ok(uiCode.includes('Ferreiro Brann'), 'UIScene deve referenciar Ferreiro Brann');
    assert.ok(uiCode.includes('Ancião Aldor'), 'UIScene deve referenciar Ancião Aldor');
  });
});
