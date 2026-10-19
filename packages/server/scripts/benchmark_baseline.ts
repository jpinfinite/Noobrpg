import fs from 'node:fs';
import path from 'node:path';
import { WebSocket } from 'ws';
import { SqliteDatabase } from '../src/db/sqlite.js';
import { runMigrations } from '../src/db/migrationRunner.js';
import { createApp } from '../src/app.js';
import { GameSimulation } from '../src/simulation/GameSimulation.js';
import { GameWebSocketServer } from '../src/multiplayer/WebSocketServer.js';
import { CharacterClass, NetMessageType } from '@noobrpg/shared';

interface LoadTierResult {
  tierName: string;
  playerCount: number;
  durationMs: number;
  totalSnapshotsReceived: number;
  avgSnapshotBytes: number;
  minSnapshotBytes: number;
  maxSnapshotBytes: number;
  snapshotsPerSecondPerPlayer: number;
  totalServerMsgPerSecond: number;
  networkThroughputKBps: number;
  avgPingLatencyMs: number;
  maxPingLatencyMs: number;
  heapUsedMB: number;
  rssMB: number;
  tickAvgDurationMs: number;
}

async function runTier(
  playerCount: number,
  durationSeconds: number,
  baseUrl: string,
  wsUrl: string,
  authService: any,
  characterService: any,
  roomManager: any
): Promise<LoadTierResult> {
  const room = roomManager.getRoom('plains_01');
  let tickTimes: number[] = [];
  const originalTick = (room as any).tick.bind(room);
  (room as any).tick = function () {
    const start = performance.now();
    originalTick();
    const duration = performance.now() - start;
    tickTimes.push(duration);
  };

  // 1. Criar contas e personagens
  const clientsData: { username: string; token: string; charId: string }[] = [];
  for (let i = 0; i < playerCount; i++) {
    const username = `bot_${i}_${Math.random().toString(36).substring(2, 6)}`;
    const pwd = 'Password123!';
    const regRes = await authService.register(username, pwd);
    const token = regRes.sessionToken;

    const char = await characterService.createCharacter(regRes.account.id, `Char_${i}_${Math.random().toString(36).substring(2, 5)}`, CharacterClass.WARRIOR);
    clientsData.push({ username, token, charId: char.id });
  }

  // 2. Conectar clientes WebSocket
  const sockets: WebSocket[] = [];
  let snapshotSizes: number[] = [];
  let totalSnapshots = 0;
  let pingLatencies: number[] = [];

  const connectPromises = clientsData.map((data, index) => {
    return new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(`${wsUrl}?token=${data.token}`);
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const sendTime = Date.now();
          ws.send(JSON.stringify({
            type: NetMessageType.C2S_PING,
            payload: { clientTimestamp: sendTime }
          }));
        }
      }, 500);

      // Movimentação periódica para gerar carga real
      const moveInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const moveX = 180 + Math.sin(Date.now() / 1000 + index) * 40;
          const moveY = 160 + Math.cos(Date.now() / 1000 + index) * 40;
          ws.send(JSON.stringify({
            type: NetMessageType.C2S_MOVE,
            payload: { targetX: Math.round(moveX), targetY: Math.round(moveY), clientDt: 50 }
          }));
        }
      }, 100);

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: NetMessageType.C2S_JOIN,
          payload: { roomId: 'plains_01', characterId: data.charId }
        }));
      });

      ws.on('message', (raw) => {
        const str = raw.toString();
        const byteLen = Buffer.byteLength(str, 'utf8');
        try {
          const parsed = JSON.parse(str);
          if (parsed.type === NetMessageType.S2C_JOINED) {
            resolve(ws);
          } else if (parsed.type === NetMessageType.S2C_SNAPSHOT || parsed.type === 's2c_snapshot') {
            totalSnapshots++;
            snapshotSizes.push(byteLen);
          } else if (parsed.type === NetMessageType.S2C_PONG) {
            const rtt = Date.now() - parsed.payload.clientTimestamp;
            pingLatencies.push(rtt);
          }
        } catch {}
      });

      ws.on('error', (err) => {
        reject(err);
      });

      (ws as any)._cleanup = () => {
        clearInterval(pingInterval);
        clearInterval(moveInterval);
      };
    });
  });

  const connectedSockets = await Promise.all(connectPromises);
  sockets.push(...connectedSockets);

  // 3. Deixa rodar pelo tempo especificado coletando métricas
  const startTime = Date.now();
  snapshotSizes = [];
  totalSnapshots = 0;
  pingLatencies = [];
  tickTimes = [];

  await new Promise(r => setTimeout(r, durationSeconds * 1000));

  const actualDurationMs = Date.now() - startTime;
  const actualDurationSec = actualDurationMs / 1000;

  // 4. Fechar sockets e limpar
  for (const s of sockets) {
    if ((s as any)._cleanup) (s as any)._cleanup();
    s.close();
  }

  // Restaura tick
  (room as any).tick = originalTick;

  // 5. Cálculos estatísticos
  const totalBytes = snapshotSizes.reduce((a, b) => a + b, 0);
  const avgBytes = snapshotSizes.length > 0 ? totalBytes / snapshotSizes.length : 0;
  const minBytes = snapshotSizes.length > 0 ? Math.min(...snapshotSizes) : 0;
  const maxBytes = snapshotSizes.length > 0 ? Math.max(...snapshotSizes) : 0;
  const hzPerPlayer = snapshotSizes.length > 0 ? (snapshotSizes.length / playerCount) / actualDurationSec : 0;
  const totalMsgSec = snapshotSizes.length / actualDurationSec;
  const kbps = (totalBytes / 1024) / actualDurationSec;

  const avgLatency = pingLatencies.length > 0 ? pingLatencies.reduce((a, b) => a + b, 0) / pingLatencies.length : 0;
  const maxLatency = pingLatencies.length > 0 ? Math.max(...pingLatencies) : 0;

  const mem = process.memoryUsage();
  const tickAvg = tickTimes.length > 0 ? tickTimes.reduce((a, b) => a + b, 0) / tickTimes.length : 0;

  // Aguarda desconexões processarem
  await new Promise(r => setTimeout(r, 200));

  return {
    tierName: `${playerCount} Jogadores`,
    playerCount,
    durationMs: actualDurationMs,
    totalSnapshotsReceived: totalSnapshots,
    avgSnapshotBytes: Math.round(avgBytes),
    minSnapshotBytes: Math.round(minBytes),
    maxSnapshotBytes: Math.round(maxBytes),
    snapshotsPerSecondPerPlayer: parseFloat(hzPerPlayer.toFixed(2)),
    totalServerMsgPerSecond: Math.round(totalMsgSec),
    networkThroughputKBps: parseFloat(kbps.toFixed(2)),
    avgPingLatencyMs: parseFloat(avgLatency.toFixed(2)),
    maxPingLatencyMs: parseFloat(maxLatency.toFixed(2)),
    heapUsedMB: parseFloat((mem.heapUsed / 1024 / 1024).toFixed(2)),
    rssMB: parseFloat((mem.rss / 1024 / 1024).toFixed(2)),
    tickAvgDurationMs: parseFloat(tickAvg.toFixed(3))
  };
}

async function main() {
  console.log('=== NOOBRPG — FASE 6: DIAGNÓSTICO DE DESEMPENHO (BASELINE) ===\n');

  const dbFile = path.resolve(process.cwd(), `bench_baseline_${Date.now()}.sqlite`);
  const db = new SqliteDatabase(dbFile);
  await runMigrations(db);

  const sim = new GameSimulation();
  const app = createApp(db, sim);
  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const wsUrl = `ws://127.0.0.1:${address.port}/ws`;

  const authService = app.locals.authService;
  const characterRepo = app.locals.characterRepo;
  const characterService = app.locals.characterService;
  const roomManager = app.locals.roomManager;
  const wsServer = new GameWebSocketServer(server, authService, characterRepo, roomManager);

  const tiers = [1, 5, 10, 20, 30, 50];
  const results: LoadTierResult[] = [];

  for (const count of tiers) {
    console.log(`[Teste de Carga] Iniciando patamar de ${count} jogadores virtuais por 3 segundos...`);
    const res = await runTier(count, 3, baseUrl, wsUrl, authService, characterService, roomManager);
    results.push(res);
    console.log(`  -> Snapshots/s por player: ${res.snapshotsPerSecondPerPlayer} Hz`);
    console.log(`  -> Tamanho médio do snapshot: ${res.avgSnapshotBytes} bytes`);
    console.log(`  -> Throughput do servidor: ${res.networkThroughputKBps} KB/s (${res.totalServerMsgPerSecond} msg/s)`);
    console.log(`  -> Latência RTT média: ${res.avgPingLatencyMs} ms`);
    console.log(`  -> Duração média do tick: ${res.tickAvgDurationMs} ms`);
    console.log(`  -> Memória Heap: ${res.heapUsedMB} MB (RSS: ${res.rssMB} MB)\n`);
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n=== TABELA CONSOLIDADA DE MÉTRICAS (BASELINE MODELO ATUAL) ===');
  console.table(results.map(r => ({
    'Jogadores': r.playerCount,
    'Tamanho Médio (bytes)': r.avgSnapshotBytes,
    'Frequência (Hz)': r.snapshotsPerSecondPerPlayer,
    'Mensagens/s': r.totalServerMsgPerSecond,
    'Vazão (KB/s)': r.networkThroughputKBps,
    'Vazão (Mbps)': parseFloat(((r.networkThroughputKBps * 8) / 1024).toFixed(3)),
    'Latência RTT (ms)': r.avgPingLatencyMs,
    'Tick Duration (ms)': r.tickAvgDurationMs,
    'Heap (MB)': r.heapUsedMB
  })));

  // Grava resultados JSON em scratch para referência
  fs.writeFileSync(
    path.resolve(process.cwd(), 'benchmark_baseline_results.json'),
    JSON.stringify(results, null, 2),
    'utf-8'
  );

  wsServer.close();
  server.close();
  sim.stop();
  roomManager.stopAll();
  await db.close();
  if (fs.existsSync(dbFile)) {
    try { fs.unlinkSync(dbFile); } catch {}
  }

  console.log('\nDiagnóstico Baseline concluído com sucesso!');
}

main().catch(err => {
  console.error('Erro no benchmark baseline:', err);
  process.exit(1);
});
