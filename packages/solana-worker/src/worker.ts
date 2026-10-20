import { PublicKey } from '@solana/web3.js';
import { NOOBCOIN_DECIMALS } from '@noobrpg/shared';
import { WorkerEnvironmentConfig, ITokenOperations, TokenTransferResult } from './types.js';
import { ILedgerAdapter, LedgerRewardItem } from './ledgerAdapter.js';
import { NetworkGuard } from './networkGuard.js';

export interface BatchProcessingSummary {
  processed: number;
  confirmed: number;
  submitted: number;
  failed: number;
  reconciled: number;
  errors: string[];
}

export interface MintValidationCacheEntry {
  cacheKey: string;
  mintAddress: string;
  network: string;
  rpcUrl: string;
  validatedAt: number;
}

export class SolanaDevnetWorker {
  private isRunning: boolean = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private validationCache: MintValidationCacheEntry | null = null;
  private cacheTtlMs: number = 60_000; // TTL padrão de 60 segundos
  private inFlightValidations: Map<string, Promise<void>> = new Map();

  constructor(
    private config: WorkerEnvironmentConfig,
    private tokenOps: ITokenOperations,
    private ledger: ILedgerAdapter
  ) {}

  /**
   * Validação defensiva de leitura do mint configurado (fail-closed)
   * Verifica se o endereço é uma chave pública Solana de 32 bytes decodificados em Base58,
   * se o mint existe na rede autorizada e se possui exatamente 6 decimais (NOOBCOIN_DECIMALS).
   */
  public async validateConfiguredMint(mintAddress?: string): Promise<void> {
    const targetMint = mintAddress || this.config.testMintAddress;

    if (!targetMint || typeof targetMint !== 'string' || targetMint.trim().length === 0) {
      throw new Error('[MINT_DEFENSE_ABORT] Endereço de mint não configurado ou vazio.');
    }

    const trimmed = targetMint.trim();

    // 1. Validação estrita de formato textual Base58 de chave pública Solana (32 a 44 caracteres)
    if (!/^[1-9A-HJ-NP-za-km-z]{32,44}$/.test(trimmed)) {
      throw new Error(
        `[MINT_DEFENSE_ABORT] Endereço de mint possui caracteres Base58 inválidos ou comprimento fora da faixa esperada (32-44 caracteres): '${trimmed}'`
      );
    }

    // 2. Validação explícita de decodificação e comprimento exato de 32 bytes (AUD-30M-01)
    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(trimmed);
      const bytes = pubkey.toBytes();
      if (bytes.length !== 32) {
        throw new Error(`Buffer decodificado possui ${bytes.length} bytes (esperado exatamente 32 bytes).`);
      }
    } catch (err: any) {
      throw new Error(
        `[MINT_DEFENSE_ABORT] Endereço de mint não corresponde a uma chave pública Solana válida de 32 bytes: '${trimmed}'. Detalhes: ${err?.message || err}`
      );
    }

    // 3. Validação de Cache Composto (Endereço + Rede + RPC) com TTL defensivo (AUD-30M-02)
    const canonicalAddress = pubkey.toBase58();
    const currentCacheKey = `${canonicalAddress}_${this.config.network}_${this.config.rpcUrl}`;
    const now = Date.now();

    if (
      this.validationCache &&
      this.validationCache.cacheKey === currentCacheKey &&
      now - this.validationCache.validatedAt < this.cacheTtlMs
    ) {
      return;
    }

    // Se já houver validação idêntica em andamento no RPC, aguarda a promessa existente (deduplicação concorrente)
    const inFlight = this.inFlightValidations.get(currentCacheKey);
    if (inFlight) {
      await inFlight;
      return;
    }

    const validationPromise = (async () => {
      // 4. Consulta ao nó RPC (somente-leitura)
      let mintInfo;
      try {
        mintInfo = await this.tokenOps.getMintInfo(canonicalAddress);
      } catch (err: any) {
        // Falha na consulta invalida qualquer cache prévio imediatamente (fail-closed, sem fallback permissivo)
        this.validationCache = null;
        throw new Error(`[MINT_DEFENSE_ABORT] Falha de leitura do mint no RPC: ${err?.message || err}`);
      }

      // Verificação de alteração de configuração durante o vôo da consulta RPC
      const finalCacheKey = `${canonicalAddress}_${this.config.network}_${this.config.rpcUrl}`;
      if (finalCacheKey !== currentCacheKey || (!mintAddress && this.config.testMintAddress !== targetMint)) {
        this.validationCache = null;
        throw new Error(
          `[MINT_DEFENSE_ABORT] Configuração de rede, RPC ou mint alterada durante a validação em andamento. Validação cancelada.`
        );
      }

      if (!mintInfo || typeof mintInfo.decimals !== 'number') {
        this.validationCache = null;
        throw new Error(`[MINT_DEFENSE_ABORT] Resposta inválida ou metadados de mint ausentes para '${canonicalAddress}'`);
      }

      if (!mintInfo.isInitialized) {
        this.validationCache = null;
        throw new Error(`[MINT_DEFENSE_ABORT] O mint '${canonicalAddress}' não está inicializado on-chain.`);
      }

      if (mintInfo.decimals !== NOOBCOIN_DECIMALS) {
        this.validationCache = null;
        throw new Error(
          `[MINT_DEFENSE_ABORT] Divergência de decimais detectada no mint '${canonicalAddress}': esperado ${NOOBCOIN_DECIMALS} decimais, encontrado ${mintInfo.decimals} decimais. Abortando com fail-closed.`
        );
      }

      // 5. Validação aprovada: armazena entrada no cache composto com timestamp
      this.validationCache = {
        cacheKey: currentCacheKey,
        mintAddress: canonicalAddress,
        network: this.config.network,
        rpcUrl: this.config.rpcUrl,
        validatedAt: Date.now()
      };
    })();

    this.inFlightValidations.set(currentCacheKey, validationPromise);

    try {
      await validationPromise;
    } finally {
      this.inFlightValidations.delete(currentCacheKey);
    }
  }

  /**
   * Invalida o cache de validação do mint (útil para testes, auditoria e rotação)
   */
  public resetMintValidationCache(): void {
    this.validationCache = null;
    this.inFlightValidations.clear();
  }

  /**
   * Configura o TTL do cache de validação em milissegundos
   */
  public setCacheTtlMs(ttlMs: number): void {
    this.cacheTtlMs = ttlMs;
  }

  /**
   * Retorna os metadados do cache de validação atual (somente-leitura para testes e auditoria)
   */
  public getValidationCache(): MintValidationCacheEntry | null {
    return this.validationCache ? { ...this.validationCache } : null;
  }

  /**
   * Valida as salvaguardas de rede antes de iniciar o loop de trabalho
   */
  public async initialize(): Promise<void> {
    NetworkGuard.validateConfig(this.config);

    const genesis = await this.tokenOps.getGenesisHash();
    // Permite genesis customizado apenas se for mock ou explicitamente devnet
    NetworkGuard.assertGenesisHash(genesis, this.config.rpcUrl.includes('localhost') || genesis.startsWith('Mock'));

    // Valida defensivamente o mint se configurado e não estiver em dryRun sem mint
    if (this.config.testMintAddress && !this.config.dryRun) {
      await this.validateConfiguredMint(this.config.testMintAddress);
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    await this.initialize();

    this.isRunning = true;
    console.log(`[SolanaWorker] Iniciado em modo Devnet (RPC: ${this.config.rpcUrl})`);

    const loop = async () => {
      if (!this.isRunning) return;
      try {
        await this.processBatch();
      } catch (err: any) {
        console.error('[SolanaWorker] Erro no ciclo de processamento:', err?.message);
      }
      if (this.isRunning) {
        this.pollTimer = setTimeout(loop, this.config.pollIntervalMs);
      }
    };

    loop();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    console.log('[SolanaWorker] Serviço encerrado.');
  }

  /**
   * Processa um lote de recompensas com reconciliação preventiva contra duplicações
   */
  public async processBatch(): Promise<BatchProcessingSummary> {
    const summary: BatchProcessingSummary = {
      processed: 0,
      confirmed: 0,
      submitted: 0,
      failed: 0,
      reconciled: 0,
      errors: []
    };

    // 1. RECONCILIAÇÃO PREVENTIVA: Consulta recompensas que ficaram em 'SUBMITTED'
    const pendingSubmissions = await this.ledger.fetchSubmittedRewards(this.config.batchSize);
    for (const sub of pendingSubmissions) {
      if (!sub.onchainTxSignature) continue;

      const sigStatus = await this.tokenOps.getSignatureStatus(sub.onchainTxSignature);
      if (sigStatus.confirmed) {
        await this.ledger.markConfirmed(sub.id, sub.onchainTxSignature);
        summary.reconciled++;
        summary.confirmed++;
      } else if (sigStatus.err) {
        // Falha confirmada na blockchain
        await this.ledger.markCancelled(sub.id, `Falha on-chain confirmada: ${JSON.stringify(sigStatus.err)}`);
        summary.failed++;
      }
    }

    // Se estiver em modo dryRun sem mint configurada, encerra o ciclo aqui
    if (this.config.dryRun || !this.config.testMintAddress) {
      return summary;
    }

    // 2. BUSCA DE NOVAS RECOMPENSAS APROVADAS
    const approvedRewards = await this.ledger.fetchApprovedRewards(this.config.batchSize);
    if (approvedRewards.length > 0) {
      // Validação defensiva fail-closed do mint antes de processar transferências
      await this.validateConfiguredMint(this.config.testMintAddress);
    }

    for (const reward of approvedRewards) {
      summary.processed++;
      try {
        await this.processSingleReward(reward, summary);
      } catch (err: any) {
        summary.failed++;
        summary.errors.push(`Recompensa ${reward.id}: ${err?.message}`);
      }
    }

    return summary;
  }

  private async processSingleReward(
    reward: LedgerRewardItem,
    summary: BatchProcessingSummary
  ): Promise<void> {
    // 1. Validação de destinatário
    const recipientWallet = reward.recipientWallet || (await this.ledger.getRecipientPublicKey(reward.characterId));
    if (!recipientWallet) {
      throw new Error(`Personagem ${reward.characterId} não possui carteira Solana vinculada.`);
    }

    // Validação de formato de chave pública (Base58 de 32 a 44 caracteres)
    if (!/^[1-9A-HJ-NP-za-km-z]{32,44}$/.test(recipientWallet)) {
      await this.ledger.markCancelled(reward.id, `Chave pública Solana inválida: ${recipientWallet}`);
      throw new Error(`Formato de chave pública inválido para destinatário: ${recipientWallet}`);
    }

    // 2. Validação estrita de quantidade inteira
    if (!Number.isInteger(reward.amountRaw) || reward.amountRaw <= 0 || !Number.isSafeInteger(reward.amountRaw)) {
      await this.ledger.markCancelled(reward.id, `Quantidade bruta inválida: ${reward.amountRaw}`);
      throw new Error(`Quantidade bruta de tokens inválida: ${reward.amountRaw}`);
    }

    // 3. Transiciona para QUEUED no ledger interno
    await this.ledger.markQueued(reward.id);

    // 4. Cria ou obtém a ATA de destino na Solana Devnet
    const destinationAta = await this.tokenOps.getOrCreateAssociatedTokenAccount(
      this.config.testMintAddress!,
      recipientWallet
    );

    // 5. Executa a transferência de tokens
    const transferRes: TokenTransferResult = await this.tokenOps.transferTokens(
      this.config.testMintAddress!,
      destinationAta,
      reward.amountRaw,
      reward.idempotencyKey
    );

    // 6. Atualização atômica do ledger conforme o retorno
    if (transferRes.signature) {
      await this.ledger.markSubmitted(reward.id, transferRes.signature);
      summary.submitted++;

      if (transferRes.status === 'CONFIRMED') {
        await this.ledger.markConfirmed(reward.id, transferRes.signature);
        summary.confirmed++;
      }
    } else if (transferRes.status === 'FAILED_FATAL') {
      await this.ledger.markCancelled(reward.id, transferRes.error || 'Falha fatal na transferência');
      summary.failed++;
    } else {
      // Erro transitório de rede sem signature: permanece em QUEUED ou falha recuperável
      throw new Error(transferRes.error || 'Erro transitório de rede');
    }
  }
}
