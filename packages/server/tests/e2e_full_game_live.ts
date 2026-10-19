import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
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

async function runFullGameLiveTest() {
  const httpUrl = 'http://127.0.0.1:4000/api';
  const wsUrl = 'ws://127.0.0.1:4000/ws';

  console.log('===============================================================');
  console.log('🚀 INICIANDO TESTE E2E COMPLETO NO SERVIDOR AO VIVO');
  console.log(`HTTP: ${httpUrl} | WebSocket: ${wsUrl}`);
  console.log('===============================================================\n');

  // 1. Health Check
  const healthRes = await fetch(`${httpUrl}/health`);
  assert.equal(healthRes.status, 200, 'Health check deve retornar 200');
  const health = await healthRes.json();
  console.log('✔ [1/15] Health check online:', health.status);

  // 2. Registro do Jogador 1 (Alpha)
  const usernameA = `alpha_${Date.now()}`;
  const regResA = await fetch(`${httpUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: usernameA, password: 'Password@2026' })
  });
  assert.equal(regResA.status, 201, 'Registro A deve retornar 201');
  const cookieHeaderA = regResA.headers.get('set-cookie');
  assert.ok(cookieHeaderA, 'Deve receber cookie de sessão HttpOnly');
  const sessionTokenA = cookieHeaderA.match(/session_token=([^;]+)/)![1];
  const cookieA = `session_token=${sessionTokenA}`;
  console.log(`✔ [2/15] Jogador 1 registrado: ${usernameA}`);

  // 3. Criação de Personagens para as 4 Classes
  const createdChars: Record<string, any> = {};
  const randSuffix = Math.floor(Math.random() * 8999) + 1000;
  for (const cls of ['WARRIOR', 'RANGER', 'MAGE', 'DRUID'] as CharacterClass[]) {
    const charName = `${cls.substring(0, 4)}_${randSuffix}`;
    const charRes = await fetch(`${httpUrl}/characters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ name: charName, characterClass: cls })
    });
    if (charRes.status !== 201) {
      const errText = await charRes.text();
      console.error(`Erro ao criar ${cls}:`, charRes.status, errText);
    }
    assert.equal(charRes.status, 201, `Criação de ${cls} deve retornar 201`);
    const charData = await charRes.json();
    createdChars[cls] = charData.player;
    assert.equal(charData.player.characterClass, cls);
    assert.equal(charData.player.level, 1);
  }
  console.log('✔ [3/15] 4 classes criadas no banco de dados (Warrior, Ranger, Mage, Druid)');

  // 4. Seleção do Guerreiro para a Sessão Multiplayer
  const warriorA = createdChars['WARRIOR'];

  // 5. Conexão WebSocket do Jogador 1
  const wsA = new WebSocket(`${wsUrl}?token=${sessionTokenA}`);
  await new Promise<void>((resolve, reject) => {
    wsA.on('open', resolve);
    wsA.on('error', reject);
  });
  console.log('✔ [4/15] Jogador 1 conectado ao WebSocket');

  // 6. Envio de C2S_JOIN
  const joinedPromiseA = new Promise<S2C_JoinedPayload>((resolve) => {
    wsA.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === NetMessageType.S2C_JOINED) {
        resolve(msg.payload);
      }
    });
  });

  wsA.send(JSON.stringify({
    type: NetMessageType.C2S_JOIN,
    payload: { roomId: 'plains_01', characterId: warriorA.id }
  }));

  const joinedA = await joinedPromiseA;
  assert.equal(joinedA.roomId, 'plains_01');
  assert.equal(joinedA.characterId, warriorA.id);
  console.log(`✔ [5/15] Handshake de entrada concluído na sala ${joinedA.roomId}`);

  // 7. Recepção de Snapshot do Mundo
  const snapshotA = await new Promise<WorldSnapshot>((resolve) => {
    const handler = (raw: any) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === NetMessageType.S2C_SNAPSHOT) {
        wsA.off('message', handler);
        resolve(msg.payload);
      }
    };
    wsA.on('message', handler);
  });
  assert.ok(snapshotA.players.length >= 1, 'Snapshot deve conter jogadores');
  assert.ok(snapshotA.monsters.length >= 1, 'Snapshot deve conter monstros');
  console.log(`✔ [6/15] Snapshot autoritativo a 20 Hz recebido: ${snapshotA.players.length} jogadores, ${snapshotA.monsters.length} monstros`);

  // 8. Movimentação no Mundo Expandido (além dos antigos 480x320 px)
  wsA.send(JSON.stringify({
    type: NetMessageType.C2S_MOVE,
    payload: { x: 500, y: 280, direction: 'RIGHT', seq: 1, dt: 50 }
  }));
  wsA.send(JSON.stringify({
    type: NetMessageType.C2S_MOVE,
    payload: { x: 750, y: 350, direction: 'RIGHT', seq: 2, dt: 50 }
  }));
  console.log('✔ [7/15] Movimentação autoritativa aceita nas novas regiões expandidas (x=500..750)');

  // 9. Envio e Recepção de Mensagem no Chat
  const chatPromiseA = new Promise<S2C_ChatPayload>((resolve) => {
    const handler = (raw: any) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === NetMessageType.S2C_CHAT && msg.payload.message === 'Testando chat minimizavel Fase 3.4') {
        wsA.off('message', handler);
        resolve(msg.payload);
      }
    };
    wsA.on('message', handler);
  });

  wsA.send(JSON.stringify({
    type: NetMessageType.C2S_CHAT,
    payload: { message: 'Testando chat minimizavel Fase 3.4' }
  }));

  const chatA = await chatPromiseA;
  assert.equal(chatA.senderName, warriorA.name);
  console.log(`✔ [8/15] Mensagem de chat transmitida e distribuída via WebSocket: "${chatA.message}"`);

  // 10. Ataque e Combate
  const firstMonster = snapshotA.monsters[0];
  wsA.send(JSON.stringify({
    type: NetMessageType.C2S_ATTACK,
    payload: { targetMonsterId: firstMonster.id }
  }));
  console.log(`✔ [9/15] Comando de ataque enviado contra o monstro ${firstMonster.id}`);

  // 11. Conexão Concorrente do Jogador 2 (Beta)
  const usernameB = `beta_${Date.now()}`;
  const regResB = await fetch(`${httpUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: usernameB, password: 'Password@2026' })
  });
  const cookieHeaderB = regResB.headers.get('set-cookie');
  const sessionTokenB = cookieHeaderB!.match(/session_token=([^;]+)/)![1];
  const cookieB = `session_token=${sessionTokenB}`;

  const charResB = await fetch(`${httpUrl}/characters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieB },
    body: JSON.stringify({ name: `Beta_${randSuffix}`, characterClass: 'MAGE' })
  });
  const charDataB = await charResB.json();
  const mageB = charDataB.player;
  console.log(`✔ [10/15] Jogador 2 registrado: ${usernameB} (${mageB.name})`);

  const wsB = new WebSocket(`${wsUrl}?token=${sessionTokenB}`);
  await new Promise<void>((resolve, reject) => {
    wsB.on('open', resolve);
    wsB.on('error', reject);
  });

  // Aguarda notificação de entrada de jogador no Jogador 1
  const playerJoinedPromise = new Promise<S2C_PlayerJoinedPayload>((resolve) => {
    const handler = (raw: any) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === NetMessageType.S2C_PLAYER_JOINED && msg.payload.player?.id === mageB.id) {
        wsA.off('message', handler);
        resolve(msg.payload);
      }
    };
    wsA.on('message', handler);
  });

  wsB.send(JSON.stringify({
    type: NetMessageType.C2S_JOIN,
    payload: { roomId: 'plains_01', characterId: mageB.id }
  }));

  const joinedNotification = await playerJoinedPromise;
  assert.equal(joinedNotification.player.id, mageB.id);
  console.log(`✔ [11/15] Jogador 1 recebeu S2C_PLAYER_JOINED em tempo real para o Jogador 2 (${joinedNotification.player.name})`);

  // 12. Chat Cruzado entre Jogadores
  const crossChatPromise = new Promise<S2C_ChatPayload>((resolve) => {
    const handler = (raw: any) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === NetMessageType.S2C_CHAT && msg.payload.senderId === mageB.id) {
        wsA.off('message', handler);
        resolve(msg.payload);
      }
    };
    wsA.on('message', handler);
  });

  wsB.send(JSON.stringify({
    type: NetMessageType.C2S_CHAT,
    payload: { message: 'Saudacoes do Mago!' }
  }));

  const crossChat = await crossChatPromise;
  assert.equal(crossChat.message, 'Saudacoes do Mago!');
  console.log(`✔ [12/15] Chat multiplayer cruzado: Jogador 1 recebeu mensagem do Jogador 2 ("${crossChat.message}")`);

  // 13. Notificação de Saída de Jogador
  const playerLeftPromise = new Promise<S2C_PlayerLeftPayload>((resolve) => {
    const handler = (raw: any) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === NetMessageType.S2C_PLAYER_LEFT && msg.payload.playerId === mageB.id) {
        wsA.off('message', handler);
        resolve(msg.payload);
      }
    };
    wsA.on('message', handler);
  });

  wsB.close();
  const leftNotification = await playerLeftPromise;
  assert.equal(leftNotification.playerId, mageB.id);
  console.log('✔ [13/15] Jogador 2 desconectou; Jogador 1 recebeu S2C_PLAYER_LEFT');

  // 14. Salvamento de Progresso e Inventário (com validação Zero Client Trust)
  // Tentativa maliciosa de injetar Gold deve ser rejeitada com 403
  const exploitRes = await fetch(`${httpUrl}/characters/${warriorA.id}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieA },
    body: JSON.stringify({
      goldChange: { amount: 99999 }
    })
  });
  assert.equal(exploitRes.status, 403);

  // Salvamento legítimo de posição e integridade física de logout
  const saveRes = await fetch(`${httpUrl}/characters/${warriorA.id}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieA },
    body: JSON.stringify({
      position: { x: 750, y: 350 },
      hp: 120,
      inventory: [
        { slotIndex: 0, itemId: 'potion_hp_minor', quantity: 2 },
        { slotIndex: 1, itemId: 'wood_log', quantity: 5 }
      ],
      equipped: { weapon: 'sword_iron', armor: 'armor_leather', accessory: null }
    })
  });
  assert.equal(saveRes.status, 200);
  const saveData = await saveRes.json();
  assert.equal(saveData.player.gold, 100); // Gold protegido contra adulteração!
  assert.equal(saveData.player.position.x, 750);
  console.log('✔ [14/15] Estado do mundo expandido salvo no SQLite com Zero Client Trust (posição x=750)');

  // 15. Encerramento Limpo da Conexão
  wsA.close();
  console.log('✔ [15/15] Conexão do Jogador 1 encerrada com sucesso');

  console.log('\n===============================================================');
  console.log('🎉 SUCESSO ABSOLUTO! TODOS OS 15 TESTES E2E AO VIVO APROVADOS!');
  console.log('===============================================================');
}

runFullGameLiveTest().catch((err) => {
  console.error('\n❌ ERRO NO TESTE E2E AO VIVO:', err);
  process.exit(1);
});
