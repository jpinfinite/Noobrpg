import { Connection } from '@solana/web3.js';
import { NetworkGuard } from '../src/networkGuard.js';
import { SOLANA_GENESIS_HASHES } from '../src/config.js';

interface RpcMethodResult {
  method: string;
  latencyMs: number;
  success: boolean;
  data?: any;
  error?: string;
}

interface SmokeTestReport {
  timestamp: string;
  endpoint: string;
  cluster: string;
  expectedGenesisHash: string;
  observedGenesisHash: string;
  genesisMatch: boolean;
  solanaCoreVersion?: string;
  currentSlot?: number;
  latestBlockhashSample?: string;
  methods: RpcMethodResult[];
  overallStatus: 'PASS — READ-ONLY DEVNET VERIFIED' | 'BLOCKED — RPC UNAVAILABLE' | 'BLOCKED — SECURITY FINDING';
  notes: string[];
}

export async function runDevnetReadonlySmoke(
  rpcUrl: string = 'https://api.devnet.solana.com',
  timeoutMs: number = 15000
): Promise<SmokeTestReport> {
  const timestamp = new Date().toISOString();
  const report: SmokeTestReport = {
    timestamp,
    endpoint: rpcUrl,
    cluster: 'devnet',
    expectedGenesisHash: SOLANA_GENESIS_HASHES.DEVNET,
    observedGenesisHash: '',
    genesisMatch: false,
    methods: [],
    overallStatus: 'BLOCKED — RPC UNAVAILABLE',
    notes: []
  };

  // 1. Verificação estática da URL antes de abrir conexão
  const lowerRpc = rpcUrl.toLowerCase();
  if (lowerRpc.includes('mainnet')) {
    report.overallStatus = 'BLOCKED — SECURITY FINDING';
    report.notes.push('Tentativa de conexão a RPC com termo mainnet bloqueada antes do envio.');
    return report;
  }

  if (!lowerRpc.includes('devnet') && !lowerRpc.includes('127.0.0.1') && !lowerRpc.includes('localhost')) {
    report.overallStatus = 'BLOCKED — SECURITY FINDING';
    report.notes.push('Endpoint ambíguo sem termo devnet rejeitado.');
    return report;
  }

  // 2. Instanciação estritamente read-only (sem keypair, sem signer, sem carteira)
  const connection = new Connection(rpcUrl, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: timeoutMs
  });

  // Helper para medição com timeout
  async function timedCall<T>(name: string, fn: () => Promise<T>): Promise<{ result?: T; latencyMs: number; error?: string }> {
    const start = performance.now();
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout de ${timeoutMs}ms excedido na chamada ${name}`)), timeoutMs)
      );
      const result = await Promise.race([fn(), timeoutPromise]);
      const latencyMs = Math.round(performance.now() - start);
      return { result, latencyMs };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - start);
      return { latencyMs, error: err?.message || String(err) };
    }
  }

  console.log(`[SmokeTest] Iniciando validação estrita de leitura na Solana Devnet (${rpcUrl})...`);

  // Chamada 1: getGenesisHash
  const genesisCall = await timedCall('getGenesisHash', () => connection.getGenesisHash());
  if (genesisCall.error) {
    report.methods.push({ method: 'getGenesisHash', latencyMs: genesisCall.latencyMs, success: false, error: genesisCall.error });
    report.overallStatus = 'BLOCKED — RPC UNAVAILABLE';
    report.notes.push(`Falha ao obter Genesis Hash: ${genesisCall.error}`);
    return report;
  }

  report.observedGenesisHash = genesisCall.result!;
  report.methods.push({ method: 'getGenesisHash', latencyMs: genesisCall.latencyMs, success: true, data: report.observedGenesisHash });

  // Validação matemática com NetworkGuard
  try {
    NetworkGuard.assertGenesisHash(report.observedGenesisHash, false);
    report.genesisMatch = report.observedGenesisHash === SOLANA_GENESIS_HASHES.DEVNET;
  } catch (err: any) {
    report.overallStatus = 'BLOCKED — SECURITY FINDING';
    report.notes.push(`Violação de segurança de Genesis Hash: ${err?.message}`);
    return report;
  }

  // Chamada 2: getVersion
  const versionCall = await timedCall('getVersion', () => connection.getVersion());
  if (versionCall.result) {
    report.solanaCoreVersion = versionCall.result['solana-core'];
    report.methods.push({
      method: 'getVersion',
      latencyMs: versionCall.latencyMs,
      success: true,
      data: versionCall.result
    });
  } else {
    report.methods.push({
      method: 'getVersion',
      latencyMs: versionCall.latencyMs,
      success: false,
      error: versionCall.error
    });
    report.notes.push(`Aviso: Falha ao obter versão do nó: ${versionCall.error}`);
  }

  // Chamada 3: getSlot
  const slotCall = await timedCall('getSlot', () => connection.getSlot('confirmed'));
  if (slotCall.result !== undefined) {
    report.currentSlot = slotCall.result;
    report.methods.push({
      method: 'getSlot',
      latencyMs: slotCall.latencyMs,
      success: true,
      data: slotCall.result
    });
  } else {
    report.methods.push({
      method: 'getSlot',
      latencyMs: slotCall.latencyMs,
      success: false,
      error: slotCall.error
    });
    report.notes.push(`Falha ao obter slot atual: ${slotCall.error}`);
    report.overallStatus = 'BLOCKED — RPC UNAVAILABLE';
    return report;
  }

  // Chamada 4: getLatestBlockhash (opcional de leitura de estado recente; NUNCA usado para transações)
  const blockhashCall = await timedCall('getLatestBlockhash', () => connection.getLatestBlockhash('confirmed'));
  if (blockhashCall.result) {
    report.latestBlockhashSample = blockhashCall.result.blockhash;
    report.methods.push({
      method: 'getLatestBlockhash',
      latencyMs: blockhashCall.latencyMs,
      success: true,
      data: {
        blockhash: blockhashCall.result.blockhash,
        lastValidBlockHeight: blockhashCall.result.lastValidBlockHeight
      }
    });
  } else {
    report.methods.push({
      method: 'getLatestBlockhash',
      latencyMs: blockhashCall.latencyMs,
      success: false,
      error: blockhashCall.error
    });
  }

  // Avaliação final do Gate
  if (report.genesisMatch && report.currentSlot && report.currentSlot > 0) {
    report.overallStatus = 'PASS — READ-ONLY DEVNET VERIFIED';
    report.notes.push('Conectividade de leitura com a Solana Devnet validada com sucesso e Genesis Hash correspondente.');
  } else {
    report.overallStatus = 'BLOCKED — RPC UNAVAILABLE';
  }

  return report;
}

// Execução direta via CLI (npx tsx scripts/devnet_readonly_smoke.ts)
if (process.argv[1] && process.argv[1].endsWith('devnet_readonly_smoke.ts')) {
  runDevnetReadonlySmoke()
    .then(report => {
      console.log('\n===============================================================');
      console.log('📋 RELATÓRIO DO SMOKE TEST READ-ONLY — SOLANA DEVNET');
      console.log('===============================================================');
      console.log(`Status do Gate:           ${report.overallStatus}`);
      console.log(`Endpoint:                 ${report.endpoint}`);
      console.log(`Genesis Hash Esperado:    ${report.expectedGenesisHash}`);
      console.log(`Genesis Hash Observado:   ${report.observedGenesisHash}`);
      console.log(`Genesis Hash Válido:      ${report.genesisMatch ? 'SIM (100% Devnet)' : 'NÃO'}`);
      console.log(`Solana Core Version:      ${report.solanaCoreVersion || 'N/A'}`);
      console.log(`Slot Atual Observado:     ${report.currentSlot || 'N/A'}`);
      console.log(`Blockhash de Leitura:     ${report.latestBlockhashSample || 'N/A'}`);
      console.log('\n--- Latência e Métodos RPC ---');
      for (const m of report.methods) {
        console.log(`  • ${m.method.padEnd(22)}: ${m.latencyMs}ms | ${m.success ? 'OK' : 'FALHA: ' + m.error}`);
      }
      console.log('===============================================================\n');

      if (report.overallStatus !== 'PASS — READ-ONLY DEVNET VERIFIED') {
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('[FATAL]:', err?.message);
      process.exit(1);
    });
}
