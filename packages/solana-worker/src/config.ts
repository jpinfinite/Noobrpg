import { WorkerEnvironmentConfig } from './types.js';

export const SOLANA_GENESIS_HASHES = {
  DEVNET: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
  MAINNET: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
  TESTNET: '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY'
} as const;

export const DEFAULT_DEVNET_RPC_URL = 'https://api.devnet.solana.com';

/**
 * Carrega e valida rigorosamente as configurações de ambiente do Worker.
 * Impede explicitamente qualquer tentativa de inicialização em redes que não sejam Devnet.
 */
export function loadWorkerConfig(env: Record<string, string | undefined> = process.env): WorkerEnvironmentConfig {
  const rawNetwork = env.SOLANA_NETWORK?.trim().toLowerCase();

  // 1. Bloqueio absoluto de mainnet ou redes alternativas
  if (!rawNetwork) {
    throw new Error(
      '[FATAL_CONFIG] Variável SOLANA_NETWORK não definida. O worker exige estritamente SOLANA_NETWORK="devnet".'
    );
  }

  if (rawNetwork !== 'devnet') {
    throw new Error(
      `[FATAL_CONFIG] Rede não permitida: '${rawNetwork}'. Esta missão autoriza EXCLUSIVAMENTE a rede 'devnet'. Operação abortada para segurança.`
    );
  }

  const rawRpcUrl = (env.SOLANA_RPC_URL || DEFAULT_DEVNET_RPC_URL).trim();

  // 2. Validação sintática e de segurança do endpoint RPC
  if (!rawRpcUrl.startsWith('https://') && !rawRpcUrl.startsWith('http://127.0.0.1') && !rawRpcUrl.startsWith('http://localhost')) {
    throw new Error(
      `[FATAL_CONFIG] Protocolo RPC inválido: '${rawRpcUrl}'. Deve iniciar com https:// (ou http://localhost para testes locais simulados).`
    );
  }

  const lowerRpc = rawRpcUrl.toLowerCase();
  if (lowerRpc.includes('mainnet') || lowerRpc.includes('mainnet-beta')) {
    throw new Error(
      `[FATAL_SECURITY] A URL do RPC contém termo proibido de 'mainnet': '${rawRpcUrl}'. Execução bloqueada pelo NetworkGuard.`
    );
  }

  // Se não for localhost/mock, a URL pública deve apontar explicitamente para devnet
  const isLocal = lowerRpc.includes('localhost') || lowerRpc.includes('127.0.0.1');
  if (!isLocal && !lowerRpc.includes('devnet')) {
    throw new Error(
      `[FATAL_CONFIG] O endpoint RPC público deve conter 'devnet': '${rawRpcUrl}'. Endpoints ambíguos são rejeitados.`
    );
  }

  const commitment = (env.SOLANA_COMMITMENT === 'finalized' ? 'finalized' : 'confirmed') as 'confirmed' | 'finalized';
  const pollIntervalMs = env.WORKER_POLL_INTERVAL_MS ? parseInt(env.WORKER_POLL_INTERVAL_MS, 10) : 5000;
  const batchSize = env.WORKER_BATCH_SIZE ? parseInt(env.WORKER_BATCH_SIZE, 10) : 10;
  const maxRetries = env.WORKER_MAX_RETRIES ? parseInt(env.WORKER_MAX_RETRIES, 10) : 3;
  const dryRun = env.WORKER_DRY_RUN === 'true' || env.WORKER_DRY_RUN === '1';

  return {
    network: 'devnet',
    rpcUrl: rawRpcUrl,
    commitment,
    pollIntervalMs: isNaN(pollIntervalMs) || pollIntervalMs < 500 ? 5000 : pollIntervalMs,
    batchSize: isNaN(batchSize) || batchSize < 1 ? 10 : batchSize,
    maxRetries: isNaN(maxRetries) || maxRetries < 1 ? 3 : maxRetries,
    testMintAddress: env.NOOB_TEST_MINT_ADDRESS?.trim(),
    payerKeypairPath: env.SOLANA_PAYER_KEYPAIR_PATH?.trim(),
    dryRun
  };
}
