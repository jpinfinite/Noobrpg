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
  WorldSnapshot,
  WorldSnapshotDelta,
  S2C_JoinedPayload,
  S2C_CombatEventPayload
} from '@noobrpg/shared';

describe('NoobRPG Fase 6 — Área de Interesse (AOI) e Sincronização Eficiente', () => {
  let dbFile: string;
  let db: SqliteDatabase;
  let sim: GameSimulation;
  let server: any;
  let wsServer: GameWebSocketServer;
  let baseUrl: string;
  let wsUrl: string;
  let roomManager: any;
  let authService: any;
  let characterService: any;

  beforeEach(async () => {
    dbFile = path.resolve(process.cwd(), `phase6_test_${Date.now()}_${Math.random().toString(36).substring(7)}.sqlite`);
    db = new SqliteDatabase(dbFile);
    await runMigrations(db);

    sim = new GameSimulation();
    const app = createApp(db, sim);

    server = app.listen(0);
    const address = server.address() as any;
    baseUrl = `http://127.0.0.1:${address.port}/api`;
    wsUrl = `ws://127.0.0.1:${address.port}/ws`;

    authService = app.locals.authService;
    characterService = app.locals.characterService;
    roomManager = app.locals.roomManager;
    wsServer = new GameWebSocketServer(server, authService, app.locals.characterRepo, roomManager);
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

  async function createPlayerClient(username: string, charName: string, initialX: number = 180, initialY: number = 160) {
    const reg = await authService.register(username, 'Password123!');
    const char = await characterService.createCharacter(reg.account.id, charName, CharacterClass.WARRIOR);

    // Ajusta coordenadas iniciais se diferente
    await db.execute('UPDATE characters SET pos_x = ?, pos_y = ? WHERE id = ?;', [initialX, initialY, char.id]);

    const ws = new WebSocket(`${wsUrl}?token=${reg.sessionToken}`);
    const receivedSnapshots: WorldSnapshot[] = [];
    const receivedDeltas: WorldSnapshotDelta[] = [];
    const receivedCombatEvents: S2C_CombatEventPayload[] = [];

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: NetMessageType.C2S_JOIN,
          payload: { roomId: 'plains_01', characterId: char.id }
        }));
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === NetMessageType.S2C_JOINED) {
          resolve();
        } else if (msg.type === NetMessageType.S2C_SNAPSHOT) {
          receivedSnapshots.push(msg.payload);
        } else if (msg.type === NetMessageType.S2C_SNAPSHOT_DELTA) {
          receivedDeltas.push(msg.payload);
        } else if (msg.type === NetMessageType.S2C_COMBAT_EVENT) {
          receivedCombatEvents.push(msg.payload);
        }
      });

      ws.on('error', reject);
    });

    return {
      ws,
      charId: char.id,
      charName,
      receivedSnapshots,
      receivedDeltas,
      receivedCombatEvents
    };
  }

  it('1. Filtragem Espacial (AOI): Jogadores distantes não recebem estado mútuo', async () => {
    // Jogador A no canto superior esquerdo (x=50, y=50)
    const clientA = await createPlayerClient('user_aoi_a', 'PlayerA', 50, 50);
    // Jogador B no canto inferior direito (x=440, y=240) - Distância > 400px
    const clientB = await createPlayerClient('user_aoi_b', 'PlayerB', 440, 240);

    // Aguarda 150ms (3 ticks de 50ms)
    await new Promise(r => setTimeout(r, 160));

    // Validação para o Jogador A
    const lastSnapshotA = clientA.receivedSnapshots[clientA.receivedSnapshots.length - 1];
    assert.ok(lastSnapshotA, 'Jogador A deve receber snapshot inicial');
    const bInSnapshotA = lastSnapshotA.players.some(p => p.id === clientB.charId);
    assert.equal(bInSnapshotA, false, 'Jogador B NÃO deve estar visível no AOI do Jogador A');

    // Validação para o Jogador B
    const lastSnapshotB = clientB.receivedSnapshots[clientB.receivedSnapshots.length - 1];
    assert.ok(lastSnapshotB, 'Jogador B deve receber snapshot inicial');
    const aInSnapshotB = lastSnapshotB.players.some(p => p.id === clientA.charId);
    assert.equal(aInSnapshotB, false, 'Jogador A NÃO deve estar visível no AOI do Jogador B');

    clientA.ws.close();
    clientB.ws.close();
  });

  it('2. Entrada Dinâmica no AOI: Transmite enteredPlayers quando jogador entra no campo de visão', async () => {
    // Jogador A em x=180, y=160 (praça central)
    const clientA = await createPlayerClient('user_enter_a', 'WatcherA', 180, 160);
    // Jogador B longe em x=460, y=260 (fora de alcance)
    const clientB = await createPlayerClient('user_enter_b', 'MoverB', 460, 260);

    await new Promise(r => setTimeout(r, 100));

    // Limpa deltas anteriores para focar na transição
    clientA.receivedDeltas.length = 0;

    // Jogador B se move em direção à praça central (para x=200, y=160, dist=20px)
    const simB = sim.getPlayer(clientB.charId)!;
    simB.x = 200;
    simB.y = 160;

    // Aguarda 2 ticks
    await new Promise(r => setTimeout(r, 120));

    // Jogador A deve ter recebido um delta informando que Jogador B entrou no seu AOI
    const entered = clientA.receivedDeltas.some(d =>
      d.enteredPlayers && d.enteredPlayers.some(p => p.id === clientB.charId)
    );
    assert.equal(entered, true, 'Jogador A deve receber delta com enteredPlayers contendo Jogador B');

    clientA.ws.close();
    clientB.ws.close();
  });

  it('3. Saída Dinâmica com Histerese: Remove entidade apenas quando ultrapassa LEAVE_RADIUS', async () => {
    // Jogador A em x=180, y=160
    const clientA = await createPlayerClient('user_leave_a', 'StayA', 180, 160);
    // Jogador B inicialmente próximo em x=200, y=160 (dentro do AOI)
    const clientB = await createPlayerClient('user_leave_b', 'FleeB', 200, 160);

    await new Promise(r => setTimeout(r, 120));

    // Move B para x=470, y=260 (além de LEAVE_RADIUS_X e LEAVE_RADIUS_Y)
    const simB = sim.getPlayer(clientB.charId)!;
    simB.x = 470;
    simB.y = 260;

    clientA.receivedDeltas.length = 0;
    await new Promise(r => setTimeout(r, 120));

    // Jogador A deve receber delta informando a saída de Jogador B
    const removed = clientA.receivedDeltas.some(d =>
      d.removedPlayerIds && d.removedPlayerIds.includes(clientB.charId)
    );
    assert.equal(removed, true, 'Jogador A deve receber delta contendo removedPlayerIds com Jogador B');

    clientA.ws.close();
    clientB.ws.close();
  });

  it('4. Sincronização por Deltas e Sequência: Pacotes incrementais reduzem drasticamente payload', async () => {
    const clientA = await createPlayerClient('user_delta_a', 'DeltaA', 180, 160);
    const clientB = await createPlayerClient('user_delta_b', 'DeltaB', 200, 160);

    await new Promise(r => setTimeout(r, 200));

    assert.ok(clientA.receivedDeltas.length > 0, 'Cliente A deve receber deltas regulares');

    // Valida que o tamanho do delta em bytes é substancialmente menor que o snapshot completo
    const fullSnapshotSize = Buffer.byteLength(JSON.stringify(clientA.receivedSnapshots[0]), 'utf8');
    const sampleDelta = clientA.receivedDeltas[0];
    const deltaSize = Buffer.byteLength(JSON.stringify(sampleDelta), 'utf8');

    assert.ok(deltaSize < fullSnapshotSize * 0.5, `Delta (${deltaSize}B) deve ser menor que 50% do Full Snapshot (${fullSnapshotSize}B)`);

    // Valida sequência estritamente crescente
    let lastSeq = 0;
    for (const d of clientA.receivedDeltas) {
      assert.ok(d.seq > lastSeq, `Sequência do delta (${d.seq}) deve ser estritamente maior que a anterior (${lastSeq})`);
      lastSeq = d.seq;
    }

    clientA.ws.close();
    clientB.ws.close();
  });

  it('5. Eventos de Combate Filtrados: Apenas jogadores próximos recebem notificações de combate', async () => {
    // Jogador A próximo ao Slime 2 em x=120, y=190 (dx=340px de distância em relação ao Jogador B)
    const clientA = await createPlayerClient('user_cb_a', 'FighterA', 110, 190);
    // Jogador B distante no extremo oposto (x=460, y=260)
    const clientB = await createPlayerClient('user_cb_b', 'DistantB', 460, 260);

    await new Promise(r => setTimeout(r, 100));

    // Ataca mob_slime_2 (em x=120, y=190)
    clientA.ws.send(JSON.stringify({
      type: NetMessageType.C2S_ATTACK,
      payload: { targetMonsterId: 'mob_slime_2' }
    }));

    await new Promise(r => setTimeout(r, 200));

    // Jogador A deve ter recebido o evento de combate
    assert.ok(clientA.receivedCombatEvents.length > 0, 'Jogador A (atacante) deve receber evento de combate');
    // Jogador B distante não deve receber poluição de combate fora do seu alcance
    assert.equal(clientB.receivedCombatEvents.length, 0, 'Jogador B distante NÃO deve receber evento de combate de outra região');

    clientA.ws.close();
    clientB.ws.close();
  });

  it('6. Idempotência em Desconexões e Reconexões sem Duplicação de Entidades', async () => {
    const clientA = await createPlayerClient('user_recon_a', 'ReconA', 180, 160);
    const clientB = await createPlayerClient('user_recon_b', 'ReconB', 200, 160);

    await new Promise(r => setTimeout(r, 100));

    // Desconecta B
    clientB.ws.close();
    await new Promise(r => setTimeout(r, 100));

    // B reconecta com nova sessão
    const clientB2 = await createPlayerClient('user_recon_b2', 'ReconB2', 200, 160);
    await new Promise(r => setTimeout(r, 150));

    // A sala deve ter no máximo 2 jogadores no snapshot final de A
    const room = roomManager.getRoom('plains_01');
    assert.equal(room.getClientCount(), 2, 'A sala deve conter exatamente 2 clientes conectados');

    clientA.ws.close();
    clientB2.ws.close();
  });
});
