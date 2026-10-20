import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  Commitment
} from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  createTransferCheckedInstruction,
  getAccount,
  getMint,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { NOOBCOIN_DECIMALS } from '@noobrpg/shared';
import { ITokenOperations, TokenTransferResult, SignatureVerificationStatus, MintVerificationResult } from './types.js';
import { NetworkGuard } from './networkGuard.js';

export class SolanaTokenService implements ITokenOperations {
  constructor(
    private connection: Connection,
    private payer: Keypair,
    private commitment: Commitment = 'confirmed'
  ) {}

  public async getGenesisHash(): Promise<string> {
    return this.connection.getGenesisHash();
  }

  public async getSolanaVersion(): Promise<string> {
    const v = await this.connection.getVersion();
    return v['solana-core'];
  }

  public async getBalanceLamports(publicKeyStr: string): Promise<number> {
    const pub = new PublicKey(publicKeyStr);
    return this.connection.getBalance(pub, this.commitment);
  }

  /**
   * Consulta os metadados do mint na blockchain (SPL Token) de forma somente-leitura
   */
  public async getMintInfo(mintAddress: string): Promise<MintVerificationResult> {
    const mintPub = new PublicKey(mintAddress);
    const mint = await getMint(this.connection, mintPub, this.commitment, TOKEN_PROGRAM_ID);
    return {
      mintAddress: mint.address.toBase58(),
      decimals: mint.decimals,
      isInitialized: mint.isInitialized,
      supply: mint.supply,
      mintAuthority: mint.mintAuthority ? mint.mintAuthority.toBase58() : null,
      freezeAuthority: mint.freezeAuthority ? mint.freezeAuthority.toBase58() : null
    };
  }

  /**
   * Cria uma mint de teste do NoobCoin (tNOOB) na Solana Devnet
   */
  public async createTestMint(decimals: number = NOOBCOIN_DECIMALS): Promise<{ mintAddress: string; signature: string }> {
    // 1. Verificação de segurança ativa antes de qualquer emissão
    const cluster = await NetworkGuard.verifyRpcCluster(this.connection);
    if (!cluster.isDevnet) {
      throw new Error(`[ABORT] Operação cancelada: Nó RPC não é Devnet válida. Erro: ${cluster.error}`);
    }

    const mintKeypair = Keypair.generate();

    const mintPubkey = await createMint(
      this.connection,
      this.payer,
      this.payer.publicKey,       // mintAuthority
      this.payer.publicKey,       // freezeAuthority (temporário para testes)
      decimals,
      mintKeypair,
      { commitment: this.commitment },
      TOKEN_PROGRAM_ID
    );

    return {
      mintAddress: mintPubkey.toBase58(),
      signature: 'mint_initialized'
    };
  }

  /**
   * Obtém ou cria a Associated Token Account (ATA) do destinatário
   */
  public async getOrCreateAssociatedTokenAccount(mintAddress: string, ownerPublicKey: string): Promise<string> {
    const mintPub = new PublicKey(mintAddress);
    const ownerPub = new PublicKey(ownerPublicKey);

    const ataAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.payer,
      mintPub,
      ownerPub,
      false,
      this.commitment,
      { commitment: this.commitment },
      TOKEN_PROGRAM_ID
    );

    return ataAccount.address.toBase58();
  }

  /**
   * Executa a transferência de tokens de teste utilizando SPL Token Checked (6 decimais)
   */
  public async transferTokens(
    mintAddress: string,
    destinationAta: string,
    amountRaw: number,
    referenceId: string
  ): Promise<TokenTransferResult> {
    // 1. Validação estrita de quantidade inteira
    if (!Number.isInteger(amountRaw) || amountRaw <= 0 || !Number.isSafeInteger(amountRaw)) {
      return {
        success: false,
        status: 'FAILED_FATAL',
        error: `Quantidade bruta inválida para transferência: ${amountRaw}`
      };
    }

    try {
      const mintPub = new PublicKey(mintAddress);
      const destPub = new PublicKey(destinationAta);

      // 2. Obtém a ATA de origem (pertencente ao payer da distribuição)
      const sourceAta = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.payer,
        mintPub,
        this.payer.publicKey,
        false,
        this.commitment,
        { commitment: this.commitment },
        TOKEN_PROGRAM_ID
      );

      // 3. Verifica se a conta de origem possui saldo suficiente
      const sourceInfo = await getAccount(this.connection, sourceAta.address, this.commitment, TOKEN_PROGRAM_ID);
      if (sourceInfo.amount < BigInt(amountRaw)) {
        return {
          success: false,
          status: 'FAILED_RETRYABLE',
          error: `Saldo insuficiente na carteira de distribuição. Disponível: ${sourceInfo.amount}, Necessário: ${amountRaw}`
        };
      }

      // 4. Monta instrução SPL transferChecked (6 decimais)
      const tx = new Transaction().add(
        createTransferCheckedInstruction(
          sourceAta.address,
          mintPub,
          destPub,
          this.payer.publicKey,
          BigInt(amountRaw),
          NOOBCOIN_DECIMALS,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      const signature = await sendAndConfirmTransaction(this.connection, tx, [this.payer], {
        commitment: this.commitment,
        preflightCommitment: this.commitment
      });

      return {
        success: true,
        signature,
        status: 'CONFIRMED'
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'FAILED_RETRYABLE',
        error: err?.message || 'Erro durante envio de transação na Solana'
      };
    }
  }

  /**
   * Consulta o status de confirmação de uma assinatura na Solana
   */
  public async getSignatureStatus(signature: string): Promise<SignatureVerificationStatus> {
    try {
      const resp = await this.connection.getSignatureStatus(signature, {
        searchTransactionHistory: true
      });

      const val = resp?.value;
      if (!val) {
        return { confirmed: false, err: null };
      }

      const isConfirmed = val.confirmationStatus === 'confirmed' || val.confirmationStatus === 'finalized';
      return {
        confirmed: isConfirmed && !val.err,
        err: val.err,
        slot: val.slot,
        confirmations: val.confirmations
      };
    } catch (err) {
      return { confirmed: false, err };
    }
  }
}

/**
 * Implementação Mock em memória de ITokenOperations para testes unitários,
 * simulação de falhas de RPC, timeouts e testes de reconciliação.
 */
export class MockTokenService implements ITokenOperations {
  public genesisHash: string = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'; // Devnet Genesis por padrão
  public solanaVersion: string = '1.18.25';
  public balances: Map<string, number> = new Map();
  public accounts: Map<string, string> = new Map(); // key: mint+owner -> ata
  public signatures: Map<string, SignatureVerificationStatus> = new Map();
  public mints: Map<string, MintVerificationResult> = new Map();
  public shouldSimulateTimeout: boolean = false;
  public shouldSimulateRejection: boolean = false;
  public shouldSimulateMintError: boolean = false;
  public transferCount: number = 0;
  public ataCallCount: number = 0;

  public async getGenesisHash(): Promise<string> {
    return this.genesisHash;
  }

  public async getSolanaVersion(): Promise<string> {
    return this.solanaVersion;
  }

  public async getBalanceLamports(publicKey: string): Promise<number> {
    return this.balances.get(publicKey) ?? 10_000_000_000; // 10 SOL simulados
  }

  /**
   * Registra manualmente uma mint mock com parâmetros controlados para testes
   */
  public setMockMint(mintAddress: string, decimals: number = NOOBCOIN_DECIMALS, isInitialized: boolean = true): void {
    this.mints.set(mintAddress, {
      mintAddress,
      decimals,
      isInitialized,
      supply: 1_000_000_000_000n,
      mintAuthority: 'MockMintAuthPublicKey',
      freezeAuthority: 'MockFreezeAuthPublicKey'
    });
  }

  /**
   * Consulta os metadados do mint simulado
   */
  public async getMintInfo(mintAddress: string): Promise<MintVerificationResult> {
    if (this.shouldSimulateMintError) {
      throw new Error(`[MOCK_RPC_ERROR] Falha de conexão simulada ao consultar mint: ${mintAddress}`);
    }

    const registered = this.mints.get(mintAddress);
    if (registered) {
      return registered;
    }

    // Provisiona dinamicamente mint mock devnet com 6 decimais para retrocompatibilidade em testes gerais
    return {
      mintAddress,
      decimals: NOOBCOIN_DECIMALS,
      isInitialized: true,
      supply: 1_000_000_000_000n,
      mintAuthority: 'MockMintAuthPublicKey',
      freezeAuthority: 'MockFreezeAuthPublicKey'
    };
  }

  public async createTestMint(decimals: number = NOOBCOIN_DECIMALS): Promise<{ mintAddress: string; signature: string }> {
    NetworkGuard.assertGenesisHash(this.genesisHash, true);
    const mintAddress = 'MintMockDevnet' + Math.random().toString(36).slice(2, 10);
    const signature = 'SigMint' + Math.random().toString(36).slice(2, 12);
    this.signatures.set(signature, { confirmed: true, err: null });
    this.setMockMint(mintAddress, decimals, true);
    return { mintAddress, signature };
  }


  public async getOrCreateAssociatedTokenAccount(mintAddress: string, ownerPublicKey: string): Promise<string> {
    this.ataCallCount++;
    const key = `${mintAddress}_${ownerPublicKey}`;
    if (!this.accounts.has(key)) {
      const ata = 'AtaMock' + Math.random().toString(36).slice(2, 10);
      this.accounts.set(key, ata);
    }
    return this.accounts.get(key)!;
  }

  public async transferTokens(
    mintAddress: string,
    destinationAta: string,
    amountRaw: number,
    referenceId: string
  ): Promise<TokenTransferResult> {
    this.transferCount++;

    if (this.shouldSimulateRejection) {
      return {
        success: false,
        status: 'FAILED_FATAL',
        error: 'Simulated on-chain rejection: custom program error 0x1'
      };
    }

    const signature = 'SigTx' + Math.random().toString(36).slice(2, 14);

    if (this.shouldSimulateTimeout) {
      // Transação enviada, mas o RPC deu timeout antes de retornar confirmação
      this.signatures.set(signature, { confirmed: true, err: null, slot: 123456 });
      return {
        success: false,
        signature,
        status: 'FAILED_RETRYABLE',
        error: 'Transaction simulation timeout: confirmation unknown'
      };
    }

    this.signatures.set(signature, { confirmed: true, err: null, slot: 123456 });
    return {
      success: true,
      signature,
      status: 'CONFIRMED',
      slot: 123456
    };
  }

  public async getSignatureStatus(signature: string): Promise<SignatureVerificationStatus> {
    return this.signatures.get(signature) || { confirmed: false, err: null };
  }
}
