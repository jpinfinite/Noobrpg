import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOOBCOIN_DECIMALS,
  NOOBCOIN_RAW_PER_TOKEN,
  NOOBCOIN_CONSTANTS
} from '@noobrpg/shared';
import { loadWorkerConfig, SOLANA_GENESIS_HASHES } from '../src/config.js';
import { NetworkGuard } from '../src/networkGuard.js';
import { MockTokenService } from '../src/tokenService.js';
import { InMemoryLedgerAdapter, LedgerRewardItem } from '../src/ledgerAdapter.js';
import { SolanaDevnetWorker } from '../src/worker.js';

// Chaves públicas Solana canônicas determinísticas de 32 bytes válidas (Base58)
const VALID_MINT_32_BYTES_A = '4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi'; // 32 bytes (buffer 1)
const VALID_MINT_32_BYTES_B = '8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR'; // 32 bytes (buffer 2)
const VALID_MINT_32_BYTES_C = 'CktRuQ2mttgRGkXJtyksdKHjUdc2C4TgDzyB98oEzy8'; // 32 bytes (buffer 3)
const VALID_MINT_32_BYTES_D = 'GgBaCs3NCBuZN12kCJgAW63ydqohFkHEdfdEXBPzLHq'; // 32 bytes (buffer 4)

// Chave Base58 válida que decodifica para exatamente 20 bytes (não 32 bytes)
const VALID_BASE58_BUT_20_BYTES = 'p3u5PhN9wrNpsGCwfkeedq6MYc';

test('NoobRPG Solana Worker — Suíte 4: Validação Defensiva de Mint, Precisão Canônica de 6 Decimais e Correção AUD-30M (Missão 30N)', async (t) => {
  const baseDevnetEnv = {
    SOLANA_NETWORK: 'devnet',
    SOLANA_RPC_URL: 'http://localhost:8899',
    NOOB_TEST_MINT_ADDRESS: VALID_MINT_32_BYTES_A,
    WORKER_DRY_RUN: 'false'
  };

  // =========================================================================
  // GRUPO 1: AUD-30M-01 — Validação Explícita de Chave Pública de 32 Bytes
  // =========================================================================

  await t.test('1.1. AUD-30M-01: Rejeição imediata de endereços vazios ou com espaços antes do RPC', async () => {
    const invalidEmpty = ['', '   ', '\t', '\n'];
    for (const empty of invalidEmpty) {
      const config = loadWorkerConfig({ ...baseDevnetEnv, NOOB_TEST_MINT_ADDRESS: empty });
      const mockTokenOps = new MockTokenService();
      let rpcCallCount = 0;
      mockTokenOps.getMintInfo = async () => {
        rpcCallCount++;
        throw new Error('RPC não deveria ser chamado para mint vazio');
      };

      const ledger = new InMemoryLedgerAdapter();
      const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

      await assert.rejects(
        async () => {
          await worker.validateConfiguredMint();
        },
        /\[MINT_DEFENSE_ABORT\] Endereço de mint não configurado ou vazio/
      );

      assert.equal(rpcCallCount, 0, 'Nenhuma chamada ao RPC deve ser realizada para mint vazio');
    }
  });

  await t.test('1.2. AUD-30M-01: Rejeição de caracteres ilegais em Base58 (0, O, I, l e símbolos)', async () => {
    // Solana Base58 exclui 0, O, I, l para evitar confusão visual
    const malformedAddrs = [
      '4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkL0', // Contém '0'
      '4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLO', // Contém 'O'
      '4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLI', // Contém 'I'
      '4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLl', // Contém 'l'
      'Special!Characters#NotBase58AtAll1111111111',
      'Contains Spaces In Middle Of Key111111111111'
    ];

    for (const badAddr of malformedAddrs) {
      const config = loadWorkerConfig({ ...baseDevnetEnv, NOOB_TEST_MINT_ADDRESS: badAddr });
      const mockTokenOps = new MockTokenService();
      let rpcCallCount = 0;
      mockTokenOps.getMintInfo = async () => {
        rpcCallCount++;
        throw new Error('RPC não deveria ser chamado');
      };

      const ledger = new InMemoryLedgerAdapter();
      const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

      await assert.rejects(
        async () => {
          await worker.validateConfiguredMint();
        },
        /\[MINT_DEFENSE_ABORT\]/
      );

      assert.equal(rpcCallCount, 0, `Nenhuma chamada ao RPC para endereço malformado: '${badAddr}'`);
    }
  });

  await t.test('1.3. AUD-30M-01: Rejeição de string Base58 válida que decodifica para comprimento incorreto (!= 32 bytes)', async () => {
    const config = loadWorkerConfig({
      ...baseDevnetEnv,
      NOOB_TEST_MINT_ADDRESS: VALID_BASE58_BUT_20_BYTES
    });

    const mockTokenOps = new MockTokenService();
    let rpcCallCount = 0;
    mockTokenOps.getMintInfo = async () => {
      rpcCallCount++;
      throw new Error('RPC não deveria ser chamado para chave de 20 bytes');
    };

    const ledger = new InMemoryLedgerAdapter();
    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

    await assert.rejects(
      async () => {
        await worker.validateConfiguredMint();
      },
      /\[MINT_DEFENSE_ABORT\]/
    );

    // Validação criptográfica deve falhar localmente ANTES de consultar o RPC
    assert.equal(rpcCallCount, 0, 'Rejeição de tamanho incorreto deve ocorrer antes do RPC');
  });

  await t.test('1.4. AUD-30M-01: Chave pública Solana de 32 bytes válida é aprovada e consulta o RPC com sucesso', async () => {
    const config = loadWorkerConfig(baseDevnetEnv);
    const mockTokenOps = new MockTokenService();
    mockTokenOps.setMockMint(VALID_MINT_32_BYTES_A, 6, true);

    const ledger = new InMemoryLedgerAdapter();
    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

    await assert.doesNotReject(async () => {
      await worker.validateConfiguredMint();
    });

    const cache = worker.getValidationCache();
    assert.ok(cache);
    assert.equal(cache.mintAddress, VALID_MINT_32_BYTES_A);
  });

  // =========================================================================
  // GRUPO 2: AUD-30M-02 — Cache de Validação Composto, Invalidação e TTL
  // =========================================================================

  await t.test('2.1. AUD-30M-02: Chave de cache composta associa mint, rede e rpcUrl', async () => {
    const config = loadWorkerConfig(baseDevnetEnv);
    const mockTokenOps = new MockTokenService();
    mockTokenOps.setMockMint(VALID_MINT_32_BYTES_A, 6, true);

    const ledger = new InMemoryLedgerAdapter();
    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

    await worker.validateConfiguredMint();

    const cache = worker.getValidationCache();
    assert.ok(cache);
    const expectedKey = `${VALID_MINT_32_BYTES_A}_devnet_http://localhost:8899`;
    assert.equal(cache.cacheKey, expectedKey);
    assert.equal(cache.network, 'devnet');
    assert.equal(cache.rpcUrl, 'http://localhost:8899');
  });

  await t.test('2.2. AUD-30M-02: Mudança de endereço do mint invalida cache anterior e revalida o novo', async () => {
    const config = loadWorkerConfig(baseDevnetEnv);
    const mockTokenOps = new MockTokenService();
    mockTokenOps.setMockMint(VALID_MINT_32_BYTES_A, 6, true);
    mockTokenOps.setMockMint(VALID_MINT_32_BYTES_B, 6, true);

    const ledger = new InMemoryLedgerAdapter();
    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

    // Valida o Mint A
    await worker.validateConfiguredMint(VALID_MINT_32_BYTES_A);
    assert.equal(worker.getValidationCache()?.mintAddress, VALID_MINT_32_BYTES_A);

    // Consulta para Mint B não pode reaproveitar o cache do Mint A
    let rpcCountMintB = 0;
    const originalGetMintInfo = mockTokenOps.getMintInfo.bind(mockTokenOps);
    mockTokenOps.getMintInfo = async (addr: string) => {
      if (addr === VALID_MINT_32_BYTES_B) rpcCountMintB++;
      return originalGetMintInfo(addr);
    };

    await worker.validateConfiguredMint(VALID_MINT_32_BYTES_B);
    assert.equal(rpcCountMintB, 1, 'Deve consultar o RPC para o novo mint');
    assert.equal(worker.getValidationCache()?.mintAddress, VALID_MINT_32_BYTES_B);
  });

  await t.test('2.3. AUD-30M-02: Mudança de cluster ou endpoint RPC invalida o cache', async () => {
    const config1 = loadWorkerConfig({
      ...baseDevnetEnv,
      SOLANA_RPC_URL: 'http://localhost:8899'
    });
    const mockTokenOps = new MockTokenService();
    mockTokenOps.setMockMint(VALID_MINT_32_BYTES_A, 6, true);

    const ledger = new InMemoryLedgerAdapter();
    const worker = new SolanaDevnetWorker(config1, mockTokenOps, ledger);

    await worker.validateConfiguredMint();
    assert.ok(worker.getValidationCache()?.cacheKey.includes('8899'));

    // Altera a URL de RPC na configuração da instância
    (config1 as any).rpcUrl = 'http://localhost:8900';

    let rpcCountNewRpc = 0;
    const orig = mockTokenOps.getMintInfo.bind(mockTokenOps);
    mockTokenOps.getMintInfo = async (addr: string) => {
      rpcCountNewRpc++;
      return orig(addr);
    };

    // A próxima validação deve ignorar o cache antigo por divergência de chave composta
    await worker.validateConfiguredMint();
    assert.equal(rpcCountNewRpc, 1, 'Deve revalidar após alteração do endpoint RPC');
    assert.ok(worker.getValidationCache()?.cacheKey.includes('8900'));
  });

  await t.test('2.4. AUD-30M-02: Expiração de TTL força nova validação no nó RPC', async () => {
    const config = loadWorkerConfig(baseDevnetEnv);
    const mockTokenOps = new MockTokenService();
    mockTokenOps.setMockMint(VALID_MINT_32_BYTES_A, 6, true);

    const ledger = new InMemoryLedgerAdapter();
    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

    // Configura TTL curtíssimo de 15 milissegundos para o teste
    worker.setCacheTtlMs(15);

    let fetchCount = 0;
    const orig = mockTokenOps.getMintInfo.bind(mockTokenOps);
    mockTokenOps.getMintInfo = async (addr: string) => {
      fetchCount++;
      return orig(addr);
    };

    // Chamada 1: validação inicial (popula cache)
    await worker.validateConfiguredMint();
    assert.equal(fetchCount, 1);

    // Chamada 2 imediata: deve usar o cache
    await worker.validateConfiguredMint();
    assert.equal(fetchCount, 1);

    // Aguarda expiração do TTL (25ms > 15ms)
    await new Promise(resolve => setTimeout(resolve, 25));

    // Chamada 3 pós-TTL: força nova validação no RPC
    await worker.validateConfiguredMint();
    assert.equal(fetchCount, 2, 'Deve ter revalidado no RPC após expiração do TTL');
  });

  await t.test('2.5. AUD-30M-02: Falha na revalidação zera o cache e bloqueia a operação (fail-closed, sem fallback)', async () => {
    const config = loadWorkerConfig(baseDevnetEnv);
    const mockTokenOps = new MockTokenService();
    mockTokenOps.setMockMint(VALID_MINT_32_BYTES_A, 6, true);

    const ledger = new InMemoryLedgerAdapter();
    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);
    worker.setCacheTtlMs(15);

    // 1. Validação inicial bem-sucedida
    await worker.validateConfiguredMint();
    assert.ok(worker.getValidationCache());

    // 2. Aguarda TTL expirar
    await new Promise(resolve => setTimeout(resolve, 25));

    // 3. Simula que a rede RPC caiu durante a tentativa de revalidação
    mockTokenOps.shouldSimulateMintError = true;

    // 4. A revalidação DEVE falhar e NÃO pode utilizar o cache anterior como fallback permissivo
    await assert.rejects(
      async () => {
        await worker.validateConfiguredMint();
      },
      /\[MINT_DEFENSE_ABORT\] Falha de leitura do mint no RPC/
    );

    // 5. O cache deve ter sido totalmente zerado (fail-closed)
    assert.equal(worker.getValidationCache(), null, 'O cache anterior deve ser eliminado após falha');
  });

  await t.test('2.6. AUD-30M-02 / Missão 30O: Chamadas concorrentes simultâneas durante a primeira validação compartilham a mesma promessa in-flight (zero duplicação de RPC)', async () => {
    const config = loadWorkerConfig(baseDevnetEnv);
    const mockTokenOps = new MockTokenService();
    mockTokenOps.setMockMint(VALID_MINT_32_BYTES_A, 6, true);

    let rpcCallCount = 0;
    const orig = mockTokenOps.getMintInfo.bind(mockTokenOps);
    mockTokenOps.getMintInfo = async (addr: string) => {
      rpcCallCount++;
      // Simula pequena latência de rede no RPC para permitir concorrência real
      await new Promise(resolve => setTimeout(resolve, 15));
      return orig(addr);
    };

    const ledger = new InMemoryLedgerAdapter();
    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

    // Dispara 5 validações concorrentes simultâneas
    await Promise.all([
      worker.validateConfiguredMint(),
      worker.validateConfiguredMint(),
      worker.validateConfiguredMint(),
      worker.validateConfiguredMint(),
      worker.validateConfiguredMint()
    ]);

    // O RPC DEVE ter sido chamado exatamente 1 vez
    assert.equal(rpcCallCount, 1, 'Exatamente uma chamada ao RPC deve ser feita para validações concorrentes');
    assert.ok(worker.getValidationCache(), 'Cache deve estar devidamente populado');
  });

  await t.test('2.7. AUD-30M-02 / Missão 30O: Mudança de configuração de RPC durante validação em andamento aborta com fail-closed e não armazena cache inválido', async () => {
    const config = loadWorkerConfig(baseDevnetEnv);
    const mockTokenOps = new MockTokenService();
    mockTokenOps.setMockMint(VALID_MINT_32_BYTES_A, 6, true);

    const orig = mockTokenOps.getMintInfo.bind(mockTokenOps);
    mockTokenOps.getMintInfo = async (addr: string) => {
      // Simula latência no RPC
      await new Promise(resolve => setTimeout(resolve, 15));
      // Altera a configuração do RPC durante o vôo da requisição
      (config as any).rpcUrl = 'http://localhost:9999-tampered';
      return orig(addr);
    };

    const ledger = new InMemoryLedgerAdapter();
    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

    await assert.rejects(
      async () => {
        await worker.validateConfiguredMint();
      },
      /\[MINT_DEFENSE_ABORT\] Configuração de rede, RPC ou mint alterada durante a validação em andamento/
    );

    // O cache DEVE ser nulo por segurança
    assert.equal(worker.getValidationCache(), null, 'Nenhum cache inconsistente deve ser armazenado');
  });

  await t.test('2.8. Missão 30P: Chamadas concorrentes para mints diferentes executam suas próprias consultas independentemente', async () => {
    const config = loadWorkerConfig(baseDevnetEnv);
    const mockTokenOps = new MockTokenService();
    mockTokenOps.setMockMint(VALID_MINT_32_BYTES_A, 6, true);
    mockTokenOps.setMockMint(VALID_MINT_32_BYTES_B, 6, true);

    const queriedMints: string[] = [];
    const orig = mockTokenOps.getMintInfo.bind(mockTokenOps);
    mockTokenOps.getMintInfo = async (addr: string) => {
      queriedMints.push(addr);
      await new Promise(resolve => setTimeout(resolve, 15));
      return orig(addr);
    };

    const ledger = new InMemoryLedgerAdapter();
    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

    // Dispara validações concorrentes para mints DIFERENTES
    await Promise.all([
      worker.validateConfiguredMint(VALID_MINT_32_BYTES_A),
      worker.validateConfiguredMint(VALID_MINT_32_BYTES_B)
    ]);

    assert.equal(queriedMints.length, 2, 'Deve consultar ambos os mints no RPC');
    assert.ok(queriedMints.includes(VALID_MINT_32_BYTES_A));
    assert.ok(queriedMints.includes(VALID_MINT_32_BYTES_B));
  });

  await t.test('2.9. Missão 30P: Mudança de testMintAddress enquanto a validação sem parâmetro está em vôo aborta e anula o cache', async () => {
    const config = loadWorkerConfig({
      ...baseDevnetEnv,
      NOOB_TEST_MINT_ADDRESS: VALID_MINT_32_BYTES_A
    });
    const mockTokenOps = new MockTokenService();
    mockTokenOps.setMockMint(VALID_MINT_32_BYTES_A, 6, true);
    mockTokenOps.setMockMint(VALID_MINT_32_BYTES_B, 6, true);

    const orig = mockTokenOps.getMintInfo.bind(mockTokenOps);
    mockTokenOps.getMintInfo = async (addr: string) => {
      await new Promise(resolve => setTimeout(resolve, 15));
      // Altera o testMintAddress configurado no meio do vôo
      config.testMintAddress = VALID_MINT_32_BYTES_B;
      return orig(addr);
    };

    const ledger = new InMemoryLedgerAdapter();
    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

    await assert.rejects(
      async () => {
        await worker.validateConfiguredMint();
      },
      /\[MINT_DEFENSE_ABORT\] Configuração de rede, RPC ou mint alterada durante a validação em andamento/
    );

    assert.equal(worker.getValidationCache(), null, 'Nenhum cache do mint anterior deve ser gravado');
  });

  await t.test('2.10. Missão 30P: Falha RPC compartilhada por várias chamadas concorrentes rejeita todas e limpa in-flight permitindo retry posterior', async () => {
    const config = loadWorkerConfig(baseDevnetEnv);
    const mockTokenOps = new MockTokenService();
    // Simula erro de RPC inicialmente
    mockTokenOps.shouldSimulateMintError = true;

    let rpcAttempts = 0;
    const orig = mockTokenOps.getMintInfo.bind(mockTokenOps);
    mockTokenOps.getMintInfo = async (addr: string) => {
      rpcAttempts++;
      await new Promise(resolve => setTimeout(resolve, 15));
      return orig(addr);
    };

    const ledger = new InMemoryLedgerAdapter();
    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

    // Dispara 3 chamadas concorrentes que irão falhar
    const results = await Promise.allSettled([
      worker.validateConfiguredMint(),
      worker.validateConfiguredMint(),
      worker.validateConfiguredMint()
    ]);

    // Todas as 3 chamadas devem ter sido rejeitadas (fail-closed)
    assert.equal(results.filter(r => r.status === 'rejected').length, 3);
    assert.equal(rpcAttempts, 1, 'Exatamente 1 consulta RPC realizada durante a concorrência');
    assert.equal(worker.getValidationCache(), null);

    // Agora o RPC se recupera
    mockTokenOps.shouldSimulateMintError = false;
    mockTokenOps.setMockMint(VALID_MINT_32_BYTES_A, 6, true);

    // Próxima chamada (retry seguro): NÃO deve estar bloqueada por promessas pendentes
    await assert.doesNotReject(async () => {
      await worker.validateConfiguredMint();
    });

    assert.equal(rpcAttempts, 2, 'Nova chamada após recuperação deve executar com sucesso');
    assert.ok(worker.getValidationCache() !== null, 'Cache deve ser atualizado com sucesso após retry');
  });

  // =========================================================================
  // GRUPO 3: Decimais Canônicos e Proteção do Batch
  // =========================================================================

  await t.test('3.1. Mint com 9 decimais é estritamente rejeitado e anula o cache', async () => {
    const config = loadWorkerConfig({
      ...baseDevnetEnv,
      NOOB_TEST_MINT_ADDRESS: VALID_MINT_32_BYTES_B
    });
    const mockTokenOps = new MockTokenService();
    mockTokenOps.setMockMint(VALID_MINT_32_BYTES_B, 9, true); // 9 decimais não autorizados

    const ledger = new InMemoryLedgerAdapter();
    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

    await assert.rejects(
      async () => {
        await worker.validateConfiguredMint();
      },
      /\[MINT_DEFENSE_ABORT\] Divergência de decimais detectada no mint.*esperado 6 decimais, encontrado 9 decimais/
    );

    assert.equal(worker.getValidationCache(), null);
  });

  await t.test('3.2. processBatch() aborta com fail-closed e ZERO transferências em mint inválido ou divergente', async () => {
    const config = loadWorkerConfig({
      ...baseDevnetEnv,
      NOOB_TEST_MINT_ADDRESS: VALID_MINT_32_BYTES_C
    });
    const mockTokenOps = new MockTokenService();
    mockTokenOps.setMockMint(VALID_MINT_32_BYTES_C, 8, true); // 8 decimais

    const ledger = new InMemoryLedgerAdapter();
    ledger.wallets.set('char_p1', '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');

    const reward: LedgerRewardItem = {
      id: 'rew_batch_fail_defense',
      characterId: 'char_p1',
      accountId: 'acc_01',
      rewardType: 'SEASON_REWARD',
      amountRaw: 10_000_000,
      status: 'APPROVED',
      idempotencyKey: 'idemp_defense_01'
    };
    ledger.rewards.set(reward.id, reward);

    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

    await assert.rejects(
      async () => {
        await worker.processBatch();
      },
      /\[MINT_DEFENSE_ABORT\] Divergência de decimais detectada/
    );

    assert.equal(mockTokenOps.ataCallCount, 0, 'ZERO chamadas de criação/obtenção de ATA');
    assert.equal(mockTokenOps.transferCount, 0, 'ZERO transferências chamadas');
    assert.equal(ledger.rewards.get('rew_batch_fail_defense')?.status, 'APPROVED', 'Estado no ledger inalterado');
  });

  await t.test('3.3. Missão 30O: Falha de validação do mint resulta explicitamente em ZERO chamadas de ATA, ZERO transferências e ZERO avanço de estado', async () => {
    const config = loadWorkerConfig({
      ...baseDevnetEnv,
      NOOB_TEST_MINT_ADDRESS: VALID_MINT_32_BYTES_C
    });
    const mockTokenOps = new MockTokenService();
    mockTokenOps.shouldSimulateMintError = true;

    const ledger = new InMemoryLedgerAdapter();
    ledger.wallets.set('char_p1', '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');

    const reward: LedgerRewardItem = {
      id: 'rew_zero_calls_test',
      characterId: 'char_p1',
      accountId: 'acc_01',
      rewardType: 'EVENT_REWARD',
      amountRaw: 10_000_000,
      status: 'APPROVED',
      idempotencyKey: 'idemp_zero_calls'
    };
    ledger.rewards.set(reward.id, reward);

    const worker = new SolanaDevnetWorker(config, mockTokenOps, ledger);

    await assert.rejects(
      async () => {
        await worker.processBatch();
      },
      /\[MINT_DEFENSE_ABORT\] Falha de leitura do mint no RPC/
    );

    // Verificações explícitas de contagem ZERO exigidas na Missão 30O
    assert.equal(mockTokenOps.ataCallCount, 0, 'ZERO chamadas a getOrCreateAssociatedTokenAccount');
    assert.equal(mockTokenOps.accounts.size, 0, 'ZERO ATAs criadas');
    assert.equal(mockTokenOps.transferCount, 0, 'ZERO chamadas a transferTokens');
    assert.equal(ledger.rewards.get('rew_zero_calls_test')?.status, 'APPROVED', 'Recompensa permanece APPROVED (não avançou)');
    assert.equal(ledger.rewards.get('rew_zero_calls_test')?.onchainTxSignature, undefined, 'Nenhuma assinatura atribuída');
  });

  await t.test('3.4. Missão 30O: Modo dryRun bloqueia transferência de tokens (zero transferências e zero ATAs)', async () => {
    const configDryRun = loadWorkerConfig({
      ...baseDevnetEnv,
      WORKER_DRY_RUN: 'true'
    });
    const mockTokenOps = new MockTokenService();
    mockTokenOps.setMockMint(VALID_MINT_32_BYTES_A, 6, true);

    const ledger = new InMemoryLedgerAdapter();
    ledger.wallets.set('char_p1', '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');

    const reward: LedgerRewardItem = {
      id: 'rew_dry_run_test',
      characterId: 'char_p1',
      accountId: 'acc_01',
      rewardType: 'DRY_RUN_REWARD',
      amountRaw: 5_000_000,
      status: 'APPROVED',
      idempotencyKey: 'idemp_dry_run'
    };
    ledger.rewards.set(reward.id, reward);

    const worker = new SolanaDevnetWorker(configDryRun, mockTokenOps, ledger);
    const summary = await worker.processBatch();

    assert.equal(summary.processed, 0);
    assert.equal(summary.submitted, 0);
    assert.equal(summary.confirmed, 0);
    assert.equal(mockTokenOps.ataCallCount, 0, 'ZERO chamadas de ATA em dryRun');
    assert.equal(mockTokenOps.transferCount, 0, 'ZERO transferências em dryRun');
    assert.equal(ledger.rewards.get('rew_dry_run_test')?.status, 'APPROVED', 'Recompensa permanece intacta');
  });

  // =========================================================================
  // GRUPO 4: AUD-30M-03 — Precisão do Ledger e Limites Aritméticos
  // =========================================================================

  await t.test('4.1. AUD-30M-03: Integridade matemática de 6 decimais e ausência de conversão insegura', () => {
    assert.equal(NOOBCOIN_DECIMALS, 6);
    assert.equal(NOOBCOIN_RAW_PER_TOKEN, 1_000_000);

    // Oferta de teste: 1.000.000 tNOOB = 10^12 unidades
    const testSupplyRaw = 1_000_000n * 1_000_000n;
    assert.equal(testSupplyRaw, 1_000_000_000_000n);
    assert.ok(Number.isSafeInteger(Number(testSupplyRaw)));

    // Oferta teórica máxima de 1 bilhão: 10^15 unidades
    const maxTheoretical = NOOBCOIN_CONSTANTS.THEORETICAL_MAX_SUPPLY_RAW;
    assert.equal(maxTheoretical, 1_000_000_000_000_000n);
    assert.ok(Number.isSafeInteger(Number(maxTheoretical)));

    // Confirma que não há confusão de autorização: a constante é puramente matemática
    assert.equal(typeof maxTheoretical, 'bigint');
  });

  // =========================================================================
  // GRUPO 5: Preservação de Bloqueios Anti-Mainnet
  // =========================================================================

  await t.test('5.1. NetworkGuard bloqueia Genesis Hash de Mainnet e Testnet', () => {
    assert.throws(
      () => NetworkGuard.assertGenesisHash(SOLANA_GENESIS_HASHES.MAINNET),
      /CRITICAL_SECURITY_ABORT/
    );

    assert.throws(
      () => NetworkGuard.assertGenesisHash(SOLANA_GENESIS_HASHES.TESTNET),
      /reportou a TESTNET da Solana/
    );

    assert.doesNotThrow(() => {
      NetworkGuard.assertGenesisHash(SOLANA_GENESIS_HASHES.DEVNET);
    });
  });

  await t.test('5.2. Inexistência de credenciais privadas ou chamadas on-chain reais', () => {
    assert.equal(process.env.SOLANA_PRIVATE_KEY, undefined);
    assert.equal(process.env.NOOB_MINT_KEYPAIR, undefined);
  });
});
