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
  S2C_ChatPayload,
  WorldSnapshot,
  S2C_CombatEventPayload
} from '@noobrpg/shared';

describe('NoobRPG Fase 5B — Multiplayer em Tempo Real e Sincronização de Salas', () => {
  let dbFile: string;
  let db: SqliteDatabase;
  let sim: GameSimulation;
  let server: any;
  let wsServer: GameWebSocketServer;
  let baseUrl: string;
  let wsUrl: string;

  beforeEach(async () => {
    dbFile = path.resolve(process.cwd(), `ws_test_${Date.now()}_${Math.random().toString(36).substring(7)}.sqlite`);
    db = new SqliteDatabase(dbFile);
    await runMigrations(db);

    sim = new GameSimulation();
    const app = createApp(db, sim);

    server = app.listen(0);
    const address = server.address() as any;
    baseUrl = `http://127.0.0.1:${address.port}/api`;
    wsUrl = `ws://127.0.0.1:${address.port}/ws`;

    const { authService, characterRepo, roomManager } = app.locals;
    wsServer = new GameWebSocketServer(server, authService, characterRepo, roomManager);
  });

  afterEach(async () => {
    wsServer.close();
    if (server) server.close();
    sim.stop();
    await db.close();
    if (fs.existsSync(dbFile)) {
      try {
        fs.unlinkSync(dbFile);
      } catch {}
    }
  });

  // Helper para registrar usuário e criar personagem
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

  it('1. Rejeição de conexões não autenticadas ou com tokens forjados (HTTP 401)', async () => {
    await assert.rejects(
      () =>
        new Promise((resolve, reject) => {
          const ws = new WebSocket(wsUrl); // sem cookies nem tokens
          ws.on('open', () => {
            ws.close();
            resolve(true);
          });
          ws.on('unexpected-response', (req, res) => {
            assert.equal(res.statusCode, 401);
            reject(new Error(`HTTP ${res.statusCode}`));
          });
          ws.on('error', (err) => reject(err));
        }),
      /401/
    );
  });

  it('2. Dois jogadores entram na mesma sala e veem um ao outro em tempo real', async () => {
    const p1 = await createAccountAndHero('ws_player_1', 'SirArthur', CharacterClass.WARRIOR);
    const p2 = await createAccountAndHero('ws_player_2', 'LadyGuinevere', CharacterClass.RANGER);

    // Conecta Cliente 1
    const ws1 = new WebSocket(`${wsUrl}?token=${p1.sessionToken}`, {
      headers: { Cookie: p1.cookie }
    });

    const p1Joined = await new Promise<S2C_JoinedPayload>((resolve) => {
      ws1.on('open', () => {
        ws1.send(JSON.stringify({
          type: NetMessageType.C2S_JOIN,
          payload: { roomId: 'plains_01', characterId: p1.character.id }
        }));
      });

      ws1.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === NetMessageType.S2C_JOINED) {
          resolve(msg.payload);
        }
      });
    });

    assert.equal(p1Joined.characterId, p1.character.id);
    assert.equal(p1Joined.name, 'SirArthur');

    // Conecta Cliente 2 e verifica se Cliente 1 é notificado
    const client1NotifiedOfClient2 = new Promise<S2C_PlayerJoinedPayload>((resolve) => {
      ws1.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === NetMessageType.S2C_PLAYER_JOINED) {
          resolve(msg.payload);
        }
      });
    });

    const ws2 = new WebSocket(`${wsUrl}?token=${p2.sessionToken}`, {
      headers: { Cookie: p2.cookie }
    });

    const p2Joined = await new Promise<S2C_JoinedPayload>((resolve) => {
      ws2.on('open', () => {
        ws2.send(JSON.stringify({
          type: NetMessageType.C2S_JOIN,
          payload: { roomId: 'plains_01', characterId: p2.character.id }
        }));
      });

      ws2.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === NetMessageType.S2C_JOINED) {
          resolve(msg.payload);
        }
      });
    });

    assert.equal(p2Joined.characterId, p2.character.id);
    assert.equal(p2Joined.name, 'LadyGuinevere');

    // Cliente 1 deve ter recebido a notificação de entrada de Cliente 2
    const notification = await client1NotifiedOfClient2;
    assert.equal(notification.player.id, p2.character.id);
    assert.equal(notification.player.name, 'LadyGuinevere');

    // Cliente 2 recebe Snapshot contendo ambos os jogadores
    const snapshotWithBoth = await new Promise<WorldSnapshot>((resolve) => {
      ws2.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === NetMessageType.S2C_SNAPSHOT) {
          const snap = msg.payload as WorldSnapshot;
          if (snap.players.length >= 2) {
            resolve(snap);
          }
        }
      });
    });

    assert.ok(snapshotWithBoth.players.some(p => p.id === p1.character.id));
    assert.ok(snapshotWithBoth.players.some(p => p.id === p2.character.id));

    ws1.close();
    ws2.close();
  });

  it('3. Sincronização de movimento autoritativo entre dois clientes', async () => {
    const p1 = await createAccountAndHero('mov_user_1', 'Runner1', CharacterClass.WARRIOR);
    const p2 = await createAccountAndHero('mov_user_2', 'Observer', CharacterClass.MAGE);

    const ws1 = new WebSocket(`${wsUrl}?token=${p1.sessionToken}`);
    const ws2 = new WebSocket(`${wsUrl}?token=${p2.sessionToken}`);

    await Promise.all([
      new Promise((resolve) => ws1.on('open', resolve)),
      new Promise((resolve) => ws2.on('open', resolve))
    ]);

    ws1.send(JSON.stringify({
      type: NetMessageType.C2S_JOIN,
      payload: { roomId: 'plains_01', characterId: p1.character.id }
    }));

    ws2.send(JSON.stringify({
      type: NetMessageType.C2S_JOIN,
      payload: { roomId: 'plains_01', characterId: p2.character.id }
    }));

    // Aguarda confirmação
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Cliente 1 envia intenção de movimento válida (182, 162)
    ws1.send(JSON.stringify({
      type: NetMessageType.C2S_MOVE,
      payload: { targetX: 182, targetY: 162, clientDt: 50 }
    }));

    // Cliente 2 deve receber o Snapshot confirmando o novo posicionamento de Cliente 1
    const confirmedSnapshot = await new Promise<WorldSnapshot>((resolve) => {
      ws2.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === NetMessageType.S2C_SNAPSHOT) {
          const snap = msg.payload as WorldSnapshot;
          const p1State = snap.players.find(p => p.id === p1.character.id);
          if (p1State && p1State.x === 182 && p1State.y === 162) {
            resolve(snap);
          }
        }
      });
    });

    assert.ok(confirmedSnapshot);

    ws1.close();
    ws2.close();
  });

  it('4. Desconexão graciosa de jogador notifica os demais na sala (S2C_PLAYER_LEFT)', async () => {
    const p1 = await createAccountAndHero('dc_user_1', 'Quitter', CharacterClass.WARRIOR);
    const p2 = await createAccountAndHero('dc_user_2', 'Stayer', CharacterClass.DRUID);

    const ws1 = new WebSocket(`${wsUrl}?token=${p1.sessionToken}`);
    const ws2 = new WebSocket(`${wsUrl}?token=${p2.sessionToken}`);

    await Promise.all([
      new Promise((resolve) => ws1.on('open', resolve)),
      new Promise((resolve) => ws2.on('open', resolve))
    ]);

    ws1.send(JSON.stringify({
      type: NetMessageType.C2S_JOIN,
      payload: { roomId: 'plains_01', characterId: p1.character.id }
    }));

    ws2.send(JSON.stringify({
      type: NetMessageType.C2S_JOIN,
      payload: { roomId: 'plains_01', characterId: p2.character.id }
    }));

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Prepara escuta para S2C_PLAYER_LEFT no Cliente 2
    const playerLeftPromise = new Promise<S2C_PlayerLeftPayload>((resolve) => {
      ws2.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === NetMessageType.S2C_PLAYER_LEFT) {
          resolve(msg.payload);
        }
      });
    });

    // Cliente 1 fecha conexão abruptamente
    ws1.close();

    const leftPayload = await playerLeftPromise;
    assert.equal(leftPayload.playerId, p1.character.id);

    ws2.close();
  });

  it('5. Reconexão do mesmo personagem substitui sessão anterior sem duplicar entidades', async () => {
    const p1 = await createAccountAndHero('reconn_user', 'Reconnector', CharacterClass.WARRIOR);

    const ws1 = new WebSocket(`${wsUrl}?token=${p1.sessionToken}`);
    await new Promise((resolve) => ws1.on('open', resolve));

    ws1.send(JSON.stringify({
      type: NetMessageType.C2S_JOIN,
      payload: { roomId: 'plains_01', characterId: p1.character.id }
    }));

    await new Promise((resolve) => setTimeout(resolve, 80));

    // Cliente 1 escuta por REPLACED_SESSION
    const replacedPromise = new Promise<any>((resolve) => {
      ws1.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === NetMessageType.S2C_ERROR && msg.payload.code === 'REPLACED_SESSION') {
          resolve(msg.payload);
        }
      });
    });

    // Conecta uma segunda aba/conexão com o mesmo personagem
    const ws2 = new WebSocket(`${wsUrl}?token=${p1.sessionToken}`);
    await new Promise((resolve) => ws2.on('open', resolve));

    // Registra escuta de snapshot antes de disparar a entrada
    const singleSnapshotPromise = new Promise<WorldSnapshot>((resolve) => {
      ws2.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === NetMessageType.S2C_SNAPSHOT) {
          const snap = msg.payload as WorldSnapshot;
          const matching = snap.players.filter(p => p.id === p1.character.id);
          if (matching.length === 1) {
            resolve(snap);
          }
        }
      });
    });

    ws2.send(JSON.stringify({
      type: NetMessageType.C2S_JOIN,
      payload: { roomId: 'plains_01', characterId: p1.character.id }
    }));

    const replaceEvent = await replacedPromise;
    assert.equal(replaceEvent.code, 'REPLACED_SESSION');

    // Confere que no snapshot da sala só existe 1 única entidade para o jogador
    const singleSnapshot = await singleSnapshotPromise;
    assert.equal(singleSnapshot.players.filter(p => p.id === p1.character.id).length, 1);

    ws2.close();
  });

  it('6. Chat de proximidade em tempo real com sanitização estrita contra XSS', async () => {
    const p1 = await createAccountAndHero('chat_user_1', 'ChatterA', CharacterClass.MAGE);
    const p2 = await createAccountAndHero('chat_user_2', 'ChatterB', CharacterClass.DRUID);

    const ws1 = new WebSocket(`${wsUrl}?token=${p1.sessionToken}`);
    const ws2 = new WebSocket(`${wsUrl}?token=${p2.sessionToken}`);

    await Promise.all([
      new Promise((resolve) => ws1.on('open', resolve)),
      new Promise((resolve) => ws2.on('open', resolve))
    ]);

    ws1.send(JSON.stringify({
      type: NetMessageType.C2S_JOIN,
      payload: { roomId: 'plains_01', characterId: p1.character.id }
    }));

    ws2.send(JSON.stringify({
      type: NetMessageType.C2S_JOIN,
      payload: { roomId: 'plains_01', characterId: p2.character.id }
    }));

    await new Promise((resolve) => setTimeout(resolve, 80));

    // Prepara escuta de chat no Cliente 2
    const chatReceivedPromise = new Promise<S2C_ChatPayload>((resolve) => {
      ws2.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === NetMessageType.S2C_CHAT) {
          resolve(msg.payload);
        }
      });
    });

    // Cliente 1 envia texto com potencial script XSS
    const maliciousText = '<script>alert("hacked")</script> Olá Amigos! &';
    ws1.send(JSON.stringify({
      type: NetMessageType.C2S_CHAT,
      payload: { message: maliciousText }
    }));

    const chatMsg = await chatReceivedPromise;
    assert.equal(chatMsg.senderId, p1.character.id);
    assert.equal(chatMsg.senderName, 'ChatterA');
    // Verifica que tags HTML foram estritamente neutralizadas
    assert.ok(!chatMsg.message.includes('<script>'));
    assert.ok(chatMsg.message.includes('&lt;script&gt;'));
    assert.ok(chatMsg.message.includes('&amp;'));

    ws1.close();
    ws2.close();
  });

  it('7. Rate Limiting de Chat impede flood/spam (cooldown de 1000ms)', async () => {
    const p1 = await createAccountAndHero('spam_user', 'Spammer', CharacterClass.WARRIOR);

    const ws1 = new WebSocket(`${wsUrl}?token=${p1.sessionToken}`);
    await new Promise((resolve) => ws1.on('open', resolve));

    ws1.send(JSON.stringify({
      type: NetMessageType.C2S_JOIN,
      payload: { roomId: 'plains_01', characterId: p1.character.id }
    }));

    await new Promise((resolve) => setTimeout(resolve, 80));

    const rateLimitPromise = new Promise<any>((resolve) => {
      ws1.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === NetMessageType.S2C_ERROR && msg.payload.code === 'CHAT_COOLDOWN') {
          resolve(msg.payload);
        }
      });
    });

    // Envia primeira mensagem (permitida)
    ws1.send(JSON.stringify({
      type: NetMessageType.C2S_CHAT,
      payload: { message: 'Mensagem 1' }
    }));

    // Envia segunda mensagem imediatamente (bloqueada pelo cooldown)
    ws1.send(JSON.stringify({
      type: NetMessageType.C2S_CHAT,
      payload: { message: 'Mensagem 2 no mesmo tick!' }
    }));

    const errorResult = await rateLimitPromise;
    assert.equal(errorResult.code, 'CHAT_COOLDOWN');

    ws1.close();
  });

  it('8. Zero Client Trust: Bloqueio imediato ao tentar controlar personagem de outra conta', async () => {
    const p1 = await createAccountAndHero('victim_account', 'LegitHero', CharacterClass.WARRIOR);
    const p2 = await createAccountAndHero('attacker_account', 'AttackerHero', CharacterClass.MAGE);

    // Atacante tenta entrar na sala reivindicando o personagem da vítima
    const wsAttacker = new WebSocket(`${wsUrl}?token=${p2.sessionToken}`);
    await new Promise((resolve) => wsAttacker.on('open', resolve));

    const hijackResult = await new Promise<{ errorMsg: any; closeCode: number }>((resolve) => {
      let errorMsg: any = null;
      wsAttacker.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === NetMessageType.S2C_ERROR) {
          errorMsg = msg.payload;
        }
      });

      wsAttacker.on('close', (code) => {
        resolve({ errorMsg, closeCode: code });
      });

      wsAttacker.send(JSON.stringify({
        type: NetMessageType.C2S_JOIN,
        payload: { roomId: 'plains_01', characterId: p1.character.id } // ID DA VÍTIMA!
      }));
    });

    assert.equal(hijackResult.errorMsg?.code, 'UNAUTHORIZED_CHARACTER');
    assert.equal(hijackResult.closeCode, 4003);
  });

  it('9. Combate e dano autoritativos transmitidos a todos os clientes na sala', async () => {
    // Mago possui alcance de 120px, atingindo mob_slime_1 (distância ~50px de (180, 160))
    const p1 = await createAccountAndHero('caster_user', 'GrandMage', CharacterClass.MAGE);
    const p2 = await createAccountAndHero('spectator_user', 'Spectator', CharacterClass.DRUID);

    const ws1 = new WebSocket(`${wsUrl}?token=${p1.sessionToken}`);
    const ws2 = new WebSocket(`${wsUrl}?token=${p2.sessionToken}`);

    await Promise.all([
      new Promise((resolve) => ws1.on('open', resolve)),
      new Promise((resolve) => ws2.on('open', resolve))
    ]);

    ws1.send(JSON.stringify({
      type: NetMessageType.C2S_JOIN,
      payload: { roomId: 'plains_01', characterId: p1.character.id }
    }));

    ws2.send(JSON.stringify({
      type: NetMessageType.C2S_JOIN,
      payload: { roomId: 'plains_01', characterId: p2.character.id }
    }));

    await new Promise((resolve) => setTimeout(resolve, 80));

    // Espectador prepara escuta para evento de combate
    const combatPromise = new Promise<S2C_CombatEventPayload>((resolve) => {
      ws2.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === NetMessageType.S2C_COMBAT_EVENT) {
          resolve(msg.payload);
        }
      });
    });

    // Mago ataca mob_slime_1 diretamente dentro de seu alcance mágico de 120px
    ws1.send(JSON.stringify({
      type: NetMessageType.C2S_ATTACK,
      payload: { targetMonsterId: 'mob_slime_1' }
    }));

    const combatEvent = await combatPromise;
    assert.equal(combatEvent.type, 'PLAYER_ATTACK');
    assert.equal(combatEvent.attackerId, p1.character.id);
    assert.equal(combatEvent.targetId, 'mob_slime_1');
    assert.ok(typeof combatEvent.damage === 'number' && combatEvent.damage! > 0);

    ws1.close();
    ws2.close();
  });
});
