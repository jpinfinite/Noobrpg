export type SolanaNetworkType = 'devnet';

export interface WorkerEnvironmentConfig {
  network: SolanaNetworkType;
  rpcUrl: string;
  commitment: 'confirmed' | 'finalized';
  pollIntervalMs: number;
  batchSize: number;
  maxRetries: number;
  testMintAddress?: string;
  payerKeypairPath?: string;
  dryRun: boolean;
}

export interface ClusterVerificationResult {
  isDevnet: boolean;
  genesisHash: string;
  endpoint: string;
  solanaCoreVersion?: string;
  error?: string;
}

export interface TokenTransferRequest {
  rewardId: string;
  recipientPublicKey: string;
  amountRaw: number; // Inteiro seguro em unidades mínimas (6 decimais)
  idempotencyKey: string;
}

export interface TokenTransferResult {
  success: boolean;
  signature?: string;
  error?: string;
  status: 'SUBMITTED' | 'CONFIRMED' | 'FAILED_RETRYABLE' | 'FAILED_FATAL';
  slot?: number;
  blockTime?: number;
}

export interface SignatureVerificationStatus {
  confirmed: boolean;
  err: any | null;
  slot?: number;
  confirmations?: number | null;
}

export interface MintVerificationResult {
  mintAddress: string;
  decimals: number;
  isInitialized: boolean;
  supply: bigint;
  mintAuthority: string | null;
  freezeAuthority: string | null;
}

export interface ITokenOperations {
  getGenesisHash(): Promise<string>;
  getSolanaVersion(): Promise<string>;
  getBalanceLamports(publicKey: string): Promise<number>;
  getMintInfo(mintAddress: string): Promise<MintVerificationResult>;
  createTestMint(decimals?: number): Promise<{ mintAddress: string; signature: string }>;
  getOrCreateAssociatedTokenAccount(mintAddress: string, ownerPublicKey: string): Promise<string>;
  transferTokens(
    mintAddress: string,
    destinationAta: string,
    amountRaw: number,
    referenceId: string
  ): Promise<TokenTransferResult>;
  getSignatureStatus(signature: string): Promise<SignatureVerificationStatus>;
}
