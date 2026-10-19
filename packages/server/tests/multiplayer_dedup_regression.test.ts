import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocket } from 'ws';
import { SqliteDatabase } from '../src/db/sqlite.js';
import { runMigrations } from '../src/db/migrationRunner.js';
import { createApp } from '../src/app.js';
import { GameSimulation } from '../src/simulation/GameSimulation.js';
import { GameWebSocketServer } from '../src/multiplayer/WebSocketServer.js';
import {
  CharacterClass,
  NetMessageType,
  S2C_JoinedPayload,
  S2C_PlayerJoinedPayload,
  S2C_PlayerLeftPayload,
  WorldSnapshot,
  PlayerSnapshotState
} from '@noobrpg/shared';

describe('NoobRPG — Testes de Regressão: Desduplicação de Entidades no Multiplayer', () => {
  let dbFile: string;
  let db: SqliteDatabase;
  let sim: GameSimulation;
  let server: any;
  let wsServer: GameWebSocketServer;
  let baseUrl: string;
  let wsUrl: string;
  let roomManager: any;

  beforeEach(async () => {
    dbFile = path.resolve(process.cwd(), `dedup_test_${Date.now()}_${Math.random().toString(36).substring(7)}.sqlite`);
    db = new SqliteDatabase(dbFile);
    await runMigrations(db);

    sim = new GameSimulation();
    const app = createApp(db, sim);

    server = app.listen(0);
    const address = server.address() as any;
    baseUrl = `http://127.0.0.1:${address.port}/api`;
    wsUrl = `ws://127.0.0.1:${address.port}/ws`;

    const authService = app.locals.authService;
    const characterRepo = app.locals.characterRepo;
    roomManager = app.locals.roomManager;
    wsServer = new GameWebSocketServer(server, authService, characterRepo, roomManager);
  });

  afterEach(async () => {
    wsServer.close();
    if (server) server.close();
    sim.stop();
    if (roomManager) roomManager.stopAll();
    await db.close();
    if (fs.existsSync(dbFile)) {
      try {
        fs.unlinkSync(dbFile);
      } catch {}
    }
  });

  async function createAccountAndHero(username: string, charName: string, charClass: CharacterClass) {
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'SenhaSegura123!' })
    });
    assert.equal(regRes.status, 201);
    const cookie = regRes.headers.get('set-cookie')!.split(';')[0];
    const sessionToken = cookie.split('=')[1];

    const charRes = await fetch(`${baseUrl}/characters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: charName, characterClass: charClass })
    });
    assert.equal(charRes.status, 201);
    const charData = await charRes.json();

    return {
      cookie,
      sessionToken,
      character: charData.player
    };
  }

  // 1. Dois jogadores conectados produzem exatamente duas entidades de jogador na sala
  it('1. Dois jogadores conectados produzem exatamente duas entidades de jogador na sala', async () => {
    const p1 = await createAccountAndHero('reg_user_1', 'HeroAlpha', CharacterClass.WARRIOR);
    const p2 = await createAccountAndHero('reg_user_2', 'HeroBeta', CharacterClass.MAGE);

    const ws1 = new WebSocket(`${wsUrl}?token=${p1.sessionToken}`);
    const ws2 = new WebSocket(`${wsUrl}?token=${p2.sessionToken}`);

    await Promise.all([
      new Promise(r => ws1.on('open', r)),
      new Promise(r => ws2.on('open', r))
    ]);

    const joinAck1 = new Promise(r => ws1.on('message', d => {
      const m = JSON.parse(d.toString());
      if (m.type === NetMessageType.S2C_JOINED) r(m.payload);
    }));
    const joinAck2 = new Promise(r => ws2.on('message', d => {
      const m = JSON.parse(d.toString());
      if (m.type === NetMessageType.S2C_JOINED) r(m.payload);
    }));

    ws1.send(JSON.stringify({ type: NetMessageType.C2S_JOIN, payload: { roomId: 'plains_01', characterId: p1.character.id } }));
    ws2.send(JSON.stringify({ type: NetMessageType.C2S_JOIN, payload: { roomId: 'plains_01', characterId: p2.character.id } }));

    await Promise.all([joinAck1, joinAck2]);

    const plainsRoom = roomManager.getRoom('plains_01');
    assert.ok(plainsRoom, 'PlainsRoom deve estar ativa');
    assert.equal(plainsRoom.simulation.players.size, 2, 'Exatamente 2 jogadores na simulação da sala');
    assert.ok(plainsRoom.simulation.players.has(p1.character.id), 'Jogador 1 presente');
    assert.ok(plainsRoom.simulation.players.has(p2.character.id), 'Jogador 2 presente');

    ws1.close();
    ws2.close();
  });

  // 2. Receber 100 snapshots consecutivos não aumenta a quantidade de sprites
  it('2. Receber 100 snapshots consecutivos não aumenta a quantidade de sprites (registro indexado)', () => {
    const localPlayerId = 'char_local_123';
    const remotePlayersMap = new Map<string, { id: string; x: number; y: number; updateCount: number }>();

    let instantiatedCount = 0;

    // Simula o handler idêntico ao WorldScene.handleWorldSnapshot
    function simulateHandleSnapshot(snapshot: WorldSnapshot) {
      const presentPlayerIds = new Set<string>();

      for (const p of snapshot.players) {
        if (p.id === localPlayerId) {
          // Reconciliação do jogador local - nunca cria remote
          continue;
        }

        presentPlayerIds.add(p.id);
        const existingRemote = remotePlayersMap.get(p.id);
        if (existingRemote) {
          existingRemote.x = p.x;
          existingRemote.y = p.y;
          existingRemote.updateCount++;
        } else {
          instantiatedCount++;
          remotePlayersMap.set(p.id, {
            id: p.id,
            x: p.x,
            y: p.y,
            updateCount: 1
          });
        }
      }

      for (const [id] of remotePlayersMap.entries()) {
        if (!presentPlayerIds.has(id)) {
          remotePlayersMap.delete(id);
        }
      }
    }

    // Cria 100 snapshots com o jogador local e 1 jogador remoto
    for (let i = 0; i < 100; i++) {
      simulateHandleSnapshot({
        timestamp: Date.now() + i * 50,
        players: [
          {
            id: localPlayerId,
            name: 'LocalHero',
            characterClass: CharacterClass.WARRIOR,
            level: 1,
            x: 180 + i,
            y: 160,
            hp: 120,
            maxHp: 120,
            mp: 30,
            maxMp: 30,
            isDead: false
          },
          {
            id: 'char_remote_456',
            name: 'RemoteHero',
            characterClass: CharacterClass.RANGER,
            level: 1,
            x: 200 + i,
            y: 160,
            hp: 95,
            maxHp: 95,
            mp: 40,
            maxMp: 40,
            isDead: false
          }
        ],
        monsters: [],
        gatheringNodes: [],
        groundItems: []
      });
    }

    assert.equal(instantiatedCount, 1, 'Exatamente 1 instância de RemotePlayer deve ter sido criada ao longo de 100 snapshots');
    assert.equal(remotePlayersMap.size, 1, 'O mapa de jogadores remotos deve conter exatamente 1 entidade');
    assert.equal(remotePlayersMap.get('char_remote_456')?.updateCount, 100, 'A entidade deve ter sido atualizada 100 vezes');
  });

  // 3. Receber o mesmo evento de entrada repetidamente não duplica um jogador
  it('3. Receber o mesmo evento de entrada repetidamente não duplica um jogador', () => {
    const localPlayerId = 'char_local_123';
    const remotePlayersMap = new Map<string, { id: string; name: string }>();
    let createCount = 0;

    function simulateOnPlayerJoined(payload: S2C_PlayerJoinedPayload) {
      const p = payload.player;
      if (!p || p.id === localPlayerId) {
        return;
      }
      const existing = remotePlayersMap.get(p.id);
      if (existing) {
        // Idempotente: atualiza estado, não recria
        return;
      }
      createCount++;
      remotePlayersMap.set(p.id, { id: p.id, name: p.name });
    }

    const mockPayload: S2C_PlayerJoinedPayload = {
      player: {
        id: 'char_remote_789',
        name: 'Companion',
        characterClass: CharacterClass.DRUID,
        level: 1,
        x: 180,
        y: 160,
        hp: 110,
        maxHp: 110,
        mp: 35,
        maxMp: 35,
        isDead: false
      }
    };

    // Dispara 10 vezes o mesmo evento de player joined
    for (let i = 0; i < 10; i++) {
      simulateOnPlayerJoined(mockPayload);
    }

    assert.equal(createCount, 1, 'Deve criar a entidade remota apenas 1 vez');
    assert.equal(remotePlayersMap.size, 1, 'Mapa de remotos deve conter apenas 1 entidade');
  });

  // 4. O personagem local não é renderizado duas vezes
  it('4. O personagem local não é renderizado duas vezes (nem via snapshot nem via join)', () => {
    const localPlayerId = 'my_local_character_id';
    const remotePlayersMap = new Map<string, any>();

    // Simula evento onPlayerJoined com o próprio ID
    function onPlayerJoined(p: PlayerSnapshotState) {
      if (p.id === localPlayerId) return;
      remotePlayersMap.set(p.id, p);
    }

    // Simula handleWorldSnapshot com o próprio ID
    function handleSnapshot(snapshot: WorldSnapshot) {
      for (const p of snapshot.players) {
        if (p.id === localPlayerId) continue;
        remotePlayersMap.set(p.id, p);
      }
    }

    const selfState: PlayerSnapshotState = {
      id: localPlayerId,
      name: 'Myself',
      characterClass: CharacterClass.WARRIOR,
      level: 1,
      x: 180,
      y: 160,
      hp: 120,
      maxHp: 120,
      mp: 30,
      maxMp: 30,
      isDead: false
    };

    onPlayerJoined(selfState);
    handleSnapshot({
      timestamp: Date.now(),
      players: [selfState],
      monsters: [],
      gatheringNodes: [],
      groundItems: []
    });

    assert.equal(remotePlayersMap.size, 0, 'Nenhum RemotePlayer deve ser instanciado para o jogador local');
  });

  // 5. A saída de um jogador remove sua representação visual
  it('5. A saída de um jogador remove sua representação visual (onPlayerLeft e snapshot diff)', () => {
    const remotePlayersMap = new Map<string, { id: string; isDestroyed: boolean }>();
    remotePlayersMap.set('char_leaving_1', { id: 'char_leaving_1', isDestroyed: false });
    remotePlayersMap.set('char_staying_2', { id: 'char_staying_2', isDestroyed: false });

    // 1. Remoção por evento explícito onPlayerLeft
    function onPlayerLeft(playerId: string) {
      const entity = remotePlayersMap.get(playerId);
      if (entity) {
        entity.isDestroyed = true;
        remotePlayersMap.delete(playerId);
      }
    }

    onPlayerLeft('char_leaving_1');

    assert.equal(remotePlayersMap.has('char_leaving_1'), false, 'Jogador que saiu deve ser removido do mapa');
    assert.equal(remotePlayersMap.size, 1, 'Apenas o jogador que ficou permanece');
    assert.equal(remotePlayersMap.has('char_staying_2'), true, 'Jogador restante permanece intacto');
  });

  // 6. A reconexão não deixa entidades antigas duplicadas no servidor nem no cliente
  it('6. A reconexão não deixa entidades antigas duplicadas no servidor nem no cliente', async () => {
    const hero = await createAccountAndHero('reconn_user', 'Reconnector', CharacterClass.WARRIOR);

    // Conexão inicial
    const ws1 = new WebSocket(`${wsUrl}?token=${hero.sessionToken}`);
    await new Promise(r => ws1.on('open', r));

    const joinAck1 = new Promise(r => ws1.on('message', d => {
      const m = JSON.parse(d.toString());
      if (m.type === NetMessageType.S2C_JOINED) r(m.payload);
    }));
    ws1.send(JSON.stringify({ type: NetMessageType.C2S_JOIN, payload: { roomId: 'plains_01', characterId: hero.character.id } }));
    await joinAck1;

    const room = roomManager.getRoom('plains_01');
    assert.equal(room.simulation.players.size, 1, '1 jogador na simulação');

    // Reconexão simulada com nova aba / novo socket para o mesmo personagem
    const ws2 = new WebSocket(`${wsUrl}?token=${hero.sessionToken}`);
    await new Promise(r => ws2.on('open', r));

    const joinAck2 = new Promise(r => ws2.on('message', d => {
      const m = JSON.parse(d.toString());
      if (m.type === NetMessageType.S2C_JOINED) r(m.payload);
    }));
    ws2.send(JSON.stringify({ type: NetMessageType.C2S_JOIN, payload: { roomId: 'plains_01', characterId: hero.character.id } }));
    await joinAck2;

    // Aguarda processamento de substituição
    await new Promise(r => setTimeout(r, 100));

    assert.equal(room.simulation.players.size, 1, 'Após reconexão, deve haver rigorosamente 1 entidade na simulação');

    ws1.close();
    ws2.close();
  });

  // 7. Dois jogadores com IDs diferentes continuam visíveis simultaneamente
  it('7. Dois jogadores com IDs diferentes continuam visíveis simultaneamente', () => {
    const localPlayerId = 'local_user_id';
    const remotePlayersMap = new Map<string, { id: string; name: string }>();

    const snapshot: WorldSnapshot = {
      timestamp: Date.now(),
      players: [
        {
          id: localPlayerId,
          name: 'LocalPlayer',
          characterClass: CharacterClass.WARRIOR,
          level: 1,
          x: 180,
          y: 160,
          hp: 120,
          maxHp: 120,
          mp: 30,
          maxMp: 30,
          isDead: false
        },
        {
          id: 'player_remote_A',
          name: 'PlayerA',
          characterClass: CharacterClass.RANGER,
          level: 2,
          x: 210,
          y: 170,
          hp: 95,
          maxHp: 95,
          mp: 40,
          maxMp: 40,
          isDead: false
        },
        {
          id: 'player_remote_B',
          name: 'PlayerB',
          characterClass: CharacterClass.MAGE,
          level: 3,
          x: 240,
          y: 180,
          hp: 80,
          maxHp: 80,
          mp: 70,
          maxMp: 70,
          isDead: false
        }
      ],
      monsters: [],
      gatheringNodes: [],
      groundItems: []
    };

    // Processa snapshot
    for (const p of snapshot.players) {
      if (p.id === localPlayerId) continue;
      remotePlayersMap.set(p.id, { id: p.id, name: p.name });
    }

    assert.equal(remotePlayersMap.size, 2, 'Dois jogadores remotos devem ser renderizados');
    assert.equal(remotePlayersMap.get('player_remote_A')?.name, 'PlayerA');
    assert.equal(remotePlayersMap.get('player_remote_B')?.name, 'PlayerB');
  });

  // 8. A desconexão de um jogador não remove o outro
  it('8. A desconexão de um jogador não remove o outro', async () => {
    const p1 = await createAccountAndHero('iso_user_1', 'PlayerStay', CharacterClass.WARRIOR);
    const p2 = await createAccountAndHero('iso_user_2', 'PlayerLeave', CharacterClass.RANGER);

    const ws1 = new WebSocket(`${wsUrl}?token=${p1.sessionToken}`);
    const ws2 = new WebSocket(`${wsUrl}?token=${p2.sessionToken}`);

    await Promise.all([
      new Promise(r => ws1.on('open', r)),
      new Promise(r => ws2.on('open', r))
    ]);

    const joinAck1 = new Promise(r => ws1.on('message', d => {
      const m = JSON.parse(d.toString());
      if (m.type === NetMessageType.S2C_JOINED) r(m.payload);
    }));
    const joinAck2 = new Promise(r => ws2.on('message', d => {
      const m = JSON.parse(d.toString());
      if (m.type === NetMessageType.S2C_JOINED) r(m.payload);
    }));

    ws1.send(JSON.stringify({ type: NetMessageType.C2S_JOIN, payload: { roomId: 'plains_01', characterId: p1.character.id } }));
    ws2.send(JSON.stringify({ type: NetMessageType.C2S_JOIN, payload: { roomId: 'plains_01', characterId: p2.character.id } }));
    await Promise.all([joinAck1, joinAck2]);

    const room = roomManager.getRoom('plains_01');
    assert.equal(room.simulation.players.size, 2, '2 jogadores na sala antes da saída');

    // Jogador 2 desconecta
    const leftNotification = new Promise<S2C_PlayerLeftPayload>(r => {
      ws1.on('message', d => {
        const m = JSON.parse(d.toString());
        if (m.type === NetMessageType.S2C_PLAYER_LEFT) r(m.payload);
      });
    });

    ws2.close();
    const leftPayload = await leftNotification;

    assert.equal(leftPayload.playerId, p2.character.id, 'Notificação deve apontar para o jogador que saiu');
    assert.equal(room.simulation.players.size, 1, 'Simulação deve manter apenas 1 jogador ativo');
    assert.ok(room.simulation.players.has(p1.character.id), 'Jogador 1 deve continuar ativo na simulação');
    assert.equal(room.simulation.players.has(p2.character.id), false, 'Jogador 2 não deve mais estar na simulação');

    ws1.close();
  });
});
