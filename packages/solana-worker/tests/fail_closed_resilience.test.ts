import test from 'node:test';
import assert from 'node:assert/strict';
import { Connection } from '@solana/web3.js';
import { loadWorkerConfig, SOLANA_GENESIS_HASHES } from '../src/config.js';
import { NetworkGuard } from '../src/networkGuard.js';
import { MockTokenService } from '../src/tokenService.js';
import { InMemoryLedgerAdapter, LedgerRewardItem } from '../src/ledgerAdapter.js';
import { SolanaDevnetWorker } from '../src/worker.js';
import { LedgerReconciler } from '../src/reconciler.js';

test('NoobRPG Solana Worker — Suíte 3: Validação Fail-Closed e Resiliência Operacional', async (t) => {
  // Setup de configuração básica para testes
  const baseValidEnv = {
    SOLANA_NETWORK: 'devnet',
    SOLANA_RPC_URL: 'http://localhost:8899',
    NOOB_TEST_MINT_ADDRESS: 'MintMockDevnetTest1111111111111111111111111',
    WORKER_DRY_RUN: 'false'
  };

  // =========================================================================
  // GRUPO 1: Validação Fail-Closed de Configuração e Rede
  // =========================================================================

  await t.test('1.1. Fail-closed: Ausência de SOLANA_NETWORK jamais habilita rede padrão', () => {
    assert.throws(
      () => loadWorkerConfig({}),
      {
        message: /Variável SOLANA_NETWORK não definida/
      }
    );

    assert.throws(
      () => loadWorkerConfig({ SOLANA_NETWORK: '' }),
      {
        message: /Variável SOLANA_NETWORK não definida/
      }
    );

    assert.throws(
      () => loadWorkerConfig({ SOLANA_NETWORK: '   ' }),
      {
        message: /Variável SOLANA_NETWORK não definida/
      }
    );
  });

  await t.test('1.2. Fail-closed: Rejeição estrita de redes não autorizadas (mainnet, testnet, staging)', () => {
    const invalidNetworks = ['mainnet', 'mainnet-beta', 'testnet', 'localnet', 'staging', 'polygon', 'ethereum'];
    for (const net of invalidNetworks) {
      assert.throws(
        () => loadWorkerConfig({ SOLANA_NETWORK: net }),
        {
          message: new RegExp(`Rede não permitida: '${net}'`)
        }
      );
    }
  });

  await t.test('1.3. Fail-closed: URLs com termos proibidos ou sem devnet explícito em endpoint público', () => {
    // Protocolo inválido
    assert.throws(
      () => loadWorkerConfig({ SOLANA_NETWORK: 'devnet', SOLANA_RPC_URL: 'ftp://devnet.solana.com' }),
      { message: /Protocolo RPC inválido/ }
    );

    // Contém mainnet disfarçada
    assert.throws(
      () => loadWorkerConfig({ SOLANA_NETWORK: 'devnet', SOLANA_RPC_URL: 'https://devnet-mirror.mainnet.com' }),
      { message: /A URL do RPC contém termo proibido de 'mainnet'/ }
    );

    // Endpoint público sem identificador devnet
    assert.throws(
      () => loadWorkerConfig({ SOLANA_NETWORK: 'devnet', SOLANA_RPC_URL: 'https://api.solana.company.org' }),
      { message: /O endpoint RPC público deve conter 'devnet'/ }
    );
  });

  await t.test('1.4. Fail-closed: Sanitização de parâmetros numéricos inválidos ou corrompidos', () => {
    const sanitized = loadWorkerConfig({
      SOLANA_NETWORK: 'devnet',
      SOLANA_RPC_URL: 'https://api.devnet.solana.com',
      WORKER_POLL_INTERVAL_MS: '-500',
      WORKER_BATCH_SIZE: '0',
      WORKER_MAX_RETRIES: 'invalid_num'
    });

    assert.equal(sanitized.pollIntervalMs, 5000, 'Deve usar fallback conservador de 5000ms');
    assert.equal(sanitized.batchSize, 10, 'Deve usar fallback seguro de 10');
    assert.equal(sanitized.maxRetries, 3, 'Deve usar fallback seguro de 3');
  });

  // =========================================================================
  // GRUPO 2: Genesis Hash e Verificação de RPC
  // =========================================================================

  await t.test('2.1. Fail-closed: NetworkGuard aborta execução se Genesis Hash for Mainnet', () => {
    assert.throws(
      () => NetworkGuard.assertGenesisHash(SOLANA_GENESIS_HASHES.MAINNET),
      {
        message: /CRITICAL_SECURITY_ABORT/
      }
    );
  });

  await t.test('2.2. Fail-closed: NetworkGuard aborta se Genesis Hash for desconhecido', () => {
    assert.throws(
      () => NetworkGuard.assertGenesisHash('FakeGenesisHashUnknown1234567890'),
      {
        message: /GUARD_VIOLATION.*Genesis Hash desconhecido/
      }
    );
  });

  await t.test('2.3. Fail-closed: verifyRpcCluster reporta isDevnet=false e erro capturado quando RPC falha', async () => {
    // Simula uma conexão com nó RPC offline/inacessível
    const fakeConnection = {
      rpcEndpoint: 'https://api.devnet.solana.com',
      getGenesisHash: async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:8899');
      },
      getVersion: async () => {
        throw new Error('RPC unavailable');
      }
    } as unknown as Connection;

    const result = await NetworkGuard.verifyRpcCluster(fakeConnection);
    assert.equal(result.isDevnet, false, 'isDevnet deve ser estritamente false quando RPC falha');
    assert.equal(result.genesisHash, '');
    assert.match(result.error || '', /ECONNREFUSED/);
  });

  await t.test('2.4. Fail-closed: Worker initialize() rejeita se RPC retornar Genesis Hash incorreto', async () => {
    const config = loadWorkerConfig(baseValidEnv);
    const mockTokenOps = new MockTokenService();
    mockTokenOps.genesisHash = SOLANA_GENESIS_HASHES.MAINNET; // Simula nó RPC reportando mainnet

    const ledger = new InMemoryLedgerAdapter();
    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

    await assert.rejects(
      async () => {
        await worker.initialize();
      },
      {
        message: /CRITICAL_SECURITY_ABORT/
      }
    );
  });

  await t.test('2.5. Fail-closed: Worker initialize() rejeita se RPC estiver offline (falha de rede)', async () => {
    const config = loadWorkerConfig(baseValidEnv);
    const mockTokenOps = new MockTokenService();
    mockTokenOps.getGenesisHash = async () => {
      throw new Error('ETIMEDOUT: Falha de conexão com nó Solana RPC');
    };

    const ledger = new InMemoryLedgerAdapter();
    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

    await assert.rejects(
      async () => {
        await worker.initialize();
      },
      {
        message: /ETIMEDOUT/
      }
    );
  });

  // =========================================================================
  // GRUPO 3: Resiliência a Timeouts, Incerteza e Máquina de Estados
  // =========================================================================

  await t.test('3.1. Operação com timeout permanece em SUBMITTED e NÃO é marcada como CONFIRMED', async () => {
    const config = loadWorkerConfig(baseValidEnv);
    const mockTokenOps = new MockTokenService();
    const ledger = new InMemoryLedgerAdapter();
    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

    mockTokenOps.shouldSimulateTimeout = true;

    const reward: LedgerRewardItem = {
      id: 'rew_timeout_uncertain',
      characterId: 'char_hero_01',
      accountId: 'acc_01',
      rewardType: 'BATTLE_REWARD',
      amountRaw: 1_000_000,
      status: 'APPROVED',
      idempotencyKey: 'idemp_timeout_unc'
    };
    ledger.wallets.set('char_hero_01', '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');
    ledger.rewards.set(reward.id, reward);

    const summary = await worker.processBatch();

    // Deve ser marcada como SUBMITTED, jamais CONFIRMED prematuramente
    assert.equal(summary.submitted, 1);
    assert.equal(summary.confirmed, 0);

    const saved = ledger.rewards.get('rew_timeout_uncertain')!;
    assert.equal(saved.status, 'SUBMITTED');
    assert.ok(saved.onchainTxSignature);
  });

  await t.test('3.2. Confirmação incerta: se getSignatureStatus retornar unconfirmed, permanece em SUBMITTED sem duplicar', async () => {
    const config = loadWorkerConfig(baseValidEnv);
    const mockTokenOps = new MockTokenService();
    const ledger = new InMemoryLedgerAdapter();
    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

    // Recompensa já submetida previamente
    const pendingItem: LedgerRewardItem = {
      id: 'rew_still_pending',
      characterId: 'char_hero_01',
      accountId: 'acc_01',
      rewardType: 'QUEST_REWARD',
      amountRaw: 2_000_000,
      status: 'SUBMITTED',
      idempotencyKey: 'idemp_pending_01',
      onchainTxSignature: 'SigTxPendingSlot100'
    };
    ledger.rewards.set(pendingItem.id, pendingItem);

    // O status no RPC ainda é não confirmado (confirmação incerta / em trânsito)
    mockTokenOps.signatures.set('SigTxPendingSlot100', { confirmed: false, err: null });

    const summary = await worker.processBatch();

    // Não deve confirmar, nem falhar, nem reenviar
    assert.equal(summary.confirmed, 0);
    assert.equal(summary.failed, 0);
    assert.equal(summary.reconciled, 0);
    assert.equal(mockTokenOps.transferCount, 0, 'Zero chamadas de transferência efetuadas');

    const check = ledger.rewards.get('rew_still_pending')!;
    assert.equal(check.status, 'SUBMITTED', 'Permanece em SUBMITTED com segurança');
  });

  await t.test('3.3. Reconciliação pós-reinicialização do processo (Crash Recovery)', async () => {
    const config = loadWorkerConfig(baseValidEnv);
    const mockTokenOps = new MockTokenService();
    const sharedLedger = new InMemoryLedgerAdapter();

    // Simula estado antes do crash: processo caiu enquanto uma transação estava SUBMITTED
    const crashedReward: LedgerRewardItem = {
      id: 'rew_crash_recovered',
      characterId: 'char_hero_01',
      accountId: 'acc_01',
      rewardType: 'BOSS_DROP',
      amountRaw: 8_000_000,
      status: 'SUBMITTED',
      idempotencyKey: 'idemp_crash_01',
      onchainTxSignature: 'SigTxCrashedBeforeConfirm'
    };
    sharedLedger.rewards.set(crashedReward.id, crashedReward);

    // Na blockchain, a transação foi confirmada durante o downtime do worker
    mockTokenOps.signatures.set('SigTxCrashedBeforeConfirm', { confirmed: true, err: null, slot: 9999 });

    // Nova instância do Worker inicia após crash
    const newWorkerInstance = new SolanaDevnetWorker(config, mockTokenOps, sharedLedger);
    const summary = await newWorkerInstance.processBatch();

    assert.equal(summary.reconciled, 1, 'Deve reconciliar a transação órfã');
    assert.equal(summary.confirmed, 1, 'Deve promover para CONFIRMED');
    assert.equal(mockTokenOps.transferCount, 0, 'NÃO pode gerar nova transação (idempotência preservada)');

    const recovered = sharedLedger.rewards.get('rew_crash_recovered')!;
    assert.equal(recovered.status, 'CONFIRMED');
    assert.equal(recovered.onchainTxSignature, 'SigTxCrashedBeforeConfirm');
  });

  // =========================================================================
  // GRUPO 4: Concorrência e Idempotência
  // =========================================================================

  await t.test('4.1. Concorrência: Duas chamadas simultâneas não causam duplo envio da mesma recompensa', async () => {
    const config = loadWorkerConfig(baseValidEnv);
    const mockTokenOps = new MockTokenService();
    const ledger = new InMemoryLedgerAdapter();
    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

    ledger.wallets.set('char_hero_01', '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');

    const reward: LedgerRewardItem = {
      id: 'rew_concurrent_test',
      characterId: 'char_hero_01',
      accountId: 'acc_01',
      rewardType: 'ACHIEVEMENT',
      amountRaw: 3_000_000,
      status: 'APPROVED',
      idempotencyKey: 'idemp_concurrent_key'
    };
    ledger.rewards.set(reward.id, reward);

    // Dispara dois lotes concorrentes simultaneamente
    const [res1, res2] = await Promise.all([
      worker.processBatch(),
      worker.processBatch()
    ]);

    const totalConfirmed = res1.confirmed + res2.confirmed;
    assert.equal(totalConfirmed, 1, 'Exatamente uma execução deve confirmar a recompensa');
    assert.equal(mockTokenOps.transferCount, 1, 'Transferência chamada estritamente 1 vez');
  });

  // =========================================================================
  // GRUPO 5: Validação de Integridade Numérica e Limites Inteiros
  // =========================================================================

  await t.test('5.1. Fail-closed: Valores de tokens não inteiros (float) são cancelados imediatamente', async () => {
    const config = loadWorkerConfig(baseValidEnv);
    const mockTokenOps = new MockTokenService();
    const ledger = new InMemoryLedgerAdapter();
    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

    ledger.wallets.set('char_hero_01', '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');

    const floatReward: LedgerRewardItem = {
      id: 'rew_float_amount',
      characterId: 'char_hero_01',
      accountId: 'acc_01',
      rewardType: 'FLOAT_TEST',
      amountRaw: 12345.67, // Float não permitido em amountRaw
      status: 'APPROVED',
      idempotencyKey: 'idemp_float'
    };
    ledger.rewards.set(floatReward.id, floatReward);

    const summary = await worker.processBatch();
    assert.equal(summary.failed, 1);

    const saved = ledger.rewards.get('rew_float_amount')!;
    assert.equal(saved.status, 'CANCELLED');
    assert.equal(mockTokenOps.transferCount, 0);
  });

  await t.test('5.2. Fail-closed: Valores acima de Number.MAX_SAFE_INTEGER são rejeitados', async () => {
    const config = loadWorkerConfig(baseValidEnv);
    const mockTokenOps = new MockTokenService();
    const ledger = new InMemoryLedgerAdapter();
    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

    ledger.wallets.set('char_hero_01', '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');

    const overflowReward: LedgerRewardItem = {
      id: 'rew_overflow_amount',
      characterId: 'char_hero_01',
      accountId: 'acc_01',
      rewardType: 'OVERFLOW_TEST',
      amountRaw: Number.MAX_SAFE_INTEGER + 1000,
      status: 'APPROVED',
      idempotencyKey: 'idemp_overflow'
    };
    ledger.rewards.set(overflowReward.id, overflowReward);

    const summary = await worker.processBatch();
    assert.equal(summary.failed, 1);

    const saved = ledger.rewards.get('rew_overflow_amount')!;
    assert.equal(saved.status, 'CANCELLED');
    assert.equal(mockTokenOps.transferCount, 0);
  });

  // =========================================================================
  // GRUPO 6: Isolamento e Inexistência de Caminhos Sem Controles
  // =========================================================================

  await t.test('6.1. Fail-closed: Destinatário sem carteira Solana vinculada resulta em erro e não envia', async () => {
    const config = loadWorkerConfig(baseValidEnv);
    const mockTokenOps = new MockTokenService();
    const ledger = new InMemoryLedgerAdapter();
    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

    // Não vincula nenhuma carteira para char_no_wallet
    const noWalletReward: LedgerRewardItem = {
      id: 'rew_no_wallet',
      characterId: 'char_no_wallet',
      accountId: 'acc_01',
      rewardType: 'NO_WALLET',
      amountRaw: 1_000_000,
      status: 'APPROVED',
      idempotencyKey: 'idemp_no_wallet'
    };
    ledger.rewards.set(noWalletReward.id, noWalletReward);

    const summary = await worker.processBatch();
    assert.equal(summary.failed, 1);
    assert.equal(mockTokenOps.transferCount, 0);
    assert.match(summary.errors[0], /não possui carteira Solana/);
  });

  await t.test('6.2. Auditoria de caminhos de transação: Nenhuma API pública ou endpoint contorna processBatch()', () => {
    const config = loadWorkerConfig(baseValidEnv);
    const mockTokenOps = new MockTokenService();
    const ledger = new InMemoryLedgerAdapter();
    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

    // Verifica que métodos de submissão expostos são estritamente os controlados
    const exposedKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(worker));
    assert.ok(exposedKeys.includes('processBatch'));
    assert.ok(exposedKeys.includes('initialize'));
    assert.ok(exposedKeys.includes('start'));
    assert.ok(exposedKeys.includes('stop'));

    // Garante que não existem métodos diretos como "sendTransactionDirect", "bypassGuard", "forcePayout"
    assert.equal((worker as any).sendTransactionDirect, undefined);
    assert.equal((worker as any).bypassGuard, undefined);
    assert.equal((worker as any).forcePayout, undefined);
    assert.equal((worker as any).rawTransfer, undefined);
  });
});
