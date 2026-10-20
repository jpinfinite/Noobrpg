import { Connection } from '@solana/web3.js';
import { WorkerEnvironmentConfig, ClusterVerificationResult } from './types.js';
import { SOLANA_GENESIS_HASHES } from './config.js';

export class NetworkGuard {
  /**
   * Validação estática de configuração para impedir clusters proibidos
   */
  public static validateConfig(config: WorkerEnvironmentConfig): void {
    if (config.network !== 'devnet') {
      throw new Error(`[GUARD_VIOLATION] Rede inválida: '${config.network}'. Apenas 'devnet' é permitida.`);
    }

    const lowerRpc = config.rpcUrl.toLowerCase();
    if (lowerRpc.includes('mainnet')) {
      throw new Error(`[GUARD_VIOLATION] Tentativa de conexão a RPC com padrão mainnet: ${config.rpcUrl}`);
    }
  }

  /**
   * Valida o Genesis Hash da rede de forma matemática e inalterável
   */
  public static assertGenesisHash(genesisHash: string, allowCustomForTesting: boolean = false): void {
    if (genesisHash === SOLANA_GENESIS_HASHES.MAINNET) {
      throw new Error(
        `[CRITICAL_SECURITY_ABORT] O nó RPC reportou o Genesis Hash da MAINNET da Solana (${genesisHash})! Execução terminada imediatamente para proteção de ativos.`
      );
    }

    if (genesisHash === SOLANA_GENESIS_HASHES.TESTNET) {
      throw new Error(
        `[GUARD_VIOLATION] O nó RPC reportou a TESTNET da Solana (${genesisHash}). Apenas a DEVNET é autorizada.`
      );
    }

    if (!allowCustomForTesting && genesisHash !== SOLANA_GENESIS_HASHES.DEVNET) {
      throw new Error(
        `[GUARD_VIOLATION] Genesis Hash desconhecido: '${genesisHash}'. Esperado Devnet: ${SOLANA_GENESIS_HASHES.DEVNET}`
      );
    }
  }

  /**
   * Conecta ativamente ao nó RPC e valida o cluster real antes de autorizar qualquer instrução
   */
  public static async verifyRpcCluster(
    connection: Connection,
    allowCustomForTesting: boolean = false
  ): Promise<ClusterVerificationResult> {
    try {
      const genesisHash = await connection.getGenesisHash();
      this.assertGenesisHash(genesisHash, allowCustomForTesting);

      let versionInfo: string | undefined;
      try {
        const ver = await connection.getVersion();
        versionInfo = ver['solana-core'];
      } catch {
        // Falha leve ao ler versão não invalida a verificação do genesis hash
      }

      const isDevnet = genesisHash === SOLANA_GENESIS_HASHES.DEVNET || allowCustomForTesting;

      return {
        isDevnet,
        genesisHash,
        endpoint: connection.rpcEndpoint,
        solanaCoreVersion: versionInfo
      };
    } catch (err: any) {
      return {
        isDevnet: false,
        genesisHash: '',
        endpoint: connection.rpcEndpoint,
        error: err?.message || 'Falha desconhecida ao verificar cluster RPC'
      };
    }
  }
}
