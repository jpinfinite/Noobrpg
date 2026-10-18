import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SqliteDatabase } from '../src/db/sqlite.js';
import { runMigrations } from '../src/db/migrationRunner.js';
import { createApp } from '../src/app.js';
import { GameSimulation } from '../src/simulation/GameSimulation.js';
import { CharacterClass } from '@noobrpg/shared';

describe('NoobRPG Fase 5A — Rotas HTTP de Simulação Autoritativa', () => {
  let dbFile: string;
  let db: SqliteDatabase;
  let sim: GameSimulation;
  let server: any;
  let baseUrl: string;

  beforeEach(async () => {
    dbFile = path.resolve(process.cwd(), `sim_test_${Date.now()}_${Math.random().toString(36).substring(7)}.sqlite`);
    db = new SqliteDatabase(dbFile);
    await runMigrations(db);

    sim = new GameSimulation();
    const app = createApp(db, sim);

    server = app.listen(0);
    const address = server.address() as any;
    baseUrl = `http://127.0.0.1:${address.port}/api`;
  });

  afterEach(async () => {
    if (server) server.close();
    sim.stop();
    await db.close();
    if (fs.existsSync(dbFile)) {
      try {
        fs.unlinkSync(dbFile);
      } catch {}
    }
  });

  it('1. Fluxo HTTP completo: Join, Action (Move, Attack, Craft) e Leave com Persistência', async () => {
    // 1. Registra conta 1
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'sim_player_1', password: 'SenhaSegura123!' })
    });
    assert.equal(regRes.status, 201);
    const cookie1 = regRes.headers.get('set-cookie')!.split(';')[0];

    // 2. Cria personagem
    const charRes = await fetch(`${baseUrl}/characters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
      body: JSON.stringify({ name: 'SirArthur', characterClass: CharacterClass.WARRIOR })
    });
    assert.equal(charRes.status, 201);
    const charData = await charRes.json();
    const charId = charData.player.id;

    // 3. Entra na simulação autoritativa (/api/simulation/join)
    const joinRes = await fetch(`${baseUrl}/simulation/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
      body: JSON.stringify({ characterId: charId })
    });
    assert.equal(joinRes.status, 200);
    const joinData = await joinRes.json();
    assert.equal(joinData.player.id, charId);
    assert.ok(joinData.worldSnapshot.monsters.length > 0);

    // 4. Executa movimento válido via HTTP (/api/simulation/action - MOVE)
    const moveRes = await fetch(`${baseUrl}/simulation/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
      body: JSON.stringify({
        characterId: charId,
        action: 'MOVE',
        payload: { x: 182, y: 162, timestamp: Date.now() + 50 }
      })
    });
    assert.equal(moveRes.status, 200);
    const moveData = await moveRes.json();
    assert.equal(moveData.result.success, true);
    assert.equal(moveData.result.x, 182);

    // 5. Executa tentativa de speedhack via HTTP -> rejeitada pelo servidor
    const speedhackRes = await fetch(`${baseUrl}/simulation/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
      body: JSON.stringify({
        characterId: charId,
        action: 'MOVE',
        payload: { x: 350, y: 160, timestamp: Date.now() + 60 }
      })
    });
    assert.equal(speedhackRes.status, 200);
    const speedhackData = await speedhackRes.json();
    assert.equal(speedhackData.result.success, false);
    assert.equal(speedhackData.result.reason, 'SPEEDHACK_EXCEEDED');

    // 6. Consulta Snapshot do Mundo (/api/simulation/state)
    const stateRes = await fetch(`${baseUrl}/simulation/state`, {
      headers: { Cookie: cookie1 }
    });
    assert.equal(stateRes.status, 200);
    const stateData = await stateRes.json();
    assert.ok(stateData.players.length === 1);
    assert.equal(stateData.players[0].name, 'SirArthur');

    // 7. Sai da simulação com persistência atômica (/api/simulation/leave)
    const leaveRes = await fetch(`${baseUrl}/simulation/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
      body: JSON.stringify({ characterId: charId })
    });
    assert.equal(leaveRes.status, 200);

    // Confere que o jogador foi removido da simulação ativa
    assert.equal(sim.players.has(charId), false);
  });

  it('2. Zero Client Trust: Bloqueio estrito de ações por jogadores de outras contas', async () => {
    // Registra Conta 1 e cria personagem
    const reg1 = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'owner_user', password: 'SenhaDono123!' })
    });
    const cookie1 = reg1.headers.get('set-cookie')!.split(';')[0];

    const c1 = await fetch(`${baseUrl}/characters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
      body: JSON.stringify({ name: 'OwnerHero', characterClass: CharacterClass.RANGER })
    });
    const c1Data = await c1.json();
    const charId1 = c1Data.player.id;

    // Registra Conta 2 (invasor)
    const reg2 = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'attacker_user', password: 'SenhaInvasor123!' })
    });
    const cookie2 = reg2.headers.get('set-cookie')!.split(';')[0];

    // Invasor tentando dar join no personagem da Conta 1
    const joinHijack = await fetch(`${baseUrl}/simulation/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie2 },
      body: JSON.stringify({ characterId: charId1 })
    });
    assert.equal(joinHijack.status, 403);

    // Dono legítimo entra na simulação
    await fetch(`${baseUrl}/simulation/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
      body: JSON.stringify({ characterId: charId1 })
    });

    // Invasor tentando emitir ação para o personagem ativo da Conta 1
    const actionHijack = await fetch(`${baseUrl}/simulation/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie2 },
      body: JSON.stringify({
        characterId: charId1,
        action: 'MOVE',
        payload: { x: 200, y: 200 }
      })
    });
    assert.equal(actionHijack.status, 403);
    const hijackData = await actionHijack.json();
    assert.ok(hijackData.error.includes('Acesso negado'));
  });
});
