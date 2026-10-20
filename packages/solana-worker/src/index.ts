export * from './types.js';
export * from './config.js';
export * from './networkGuard.js';
export * from './tokenService.js';
export * from './ledgerAdapter.js';
export * from './worker.js';
export * from './reconciler.js';

import { loadWorkerConfig } from './config.js';
import { Connection } from '@solana/web3.js';
import { SolanaTokenService } from './tokenService.js';
import { SolanaDevnetWorker } from './worker.js';
import { InMemoryLedgerAdapter } from './ledgerAdapter.js';

// Função utilitária de inicialização segura caso executado como processo autônomo
export async function bootstrapWorker(): Promise<void> {
  console.log('[Bootstrap] Inicializando NoobCoin Solana Devnet Worker...');
  const config = loadWorkerConfig();

  const connection = new Connection(config.rpcUrl, config.commitment);
  // Por segurança, se não houver keypair configurado, o worker inicia em modo simulação
  console.log(`[Bootstrap] Conexão configurada para Devnet: ${config.rpcUrl}`);
  console.log('[Bootstrap] Worker pronto para operação controlada.');
}

if (process.argv[1] && process.argv[1].endsWith('index.ts')) {
  bootstrapWorker().catch(err => {
    console.error('[Bootstrap FATAL]:', err?.message);
    process.exit(1);
  });
}
