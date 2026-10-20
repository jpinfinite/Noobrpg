import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWorkerConfig, SOLANA_GENESIS_HASHES } from '../src/config.js';
import { NetworkGuard } from '../src/networkGuard.js';

test('NoobRPG Solana Worker — Suíte 1: Bloqueio de Rede e Proteção Anti-Mainnet', async (t) => {
  await t.test('1. Rejeita configuração quando SOLANA_NETWORK não é definida', () => {
    assert.throws(
      () => loadWorkerConfig({}),
      /Variável SOLANA_NETWORK não definida/
    );
  });

  await t.test('2. Rejeita terminantemente configuração direcionada à mainnet', () => {
    assert.throws(
      () => loadWorkerConfig({ SOLANA_NETWORK: 'mainnet' }),
      /Rede não permitida: 'mainnet'/
    );

    assert.throws(
      () => loadWorkerConfig({ SOLANA_NETWORK: 'mainnet-beta' }),
      /Rede não permitida: 'mainnet-beta'/
    );
  });

  await t.test('3. Rejeita URLs de RPC contendo termo "mainnet"', () => {
    assert.throws(
      () => loadWorkerConfig({
        SOLANA_NETWORK: 'devnet',
        SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com'
      }),
      /A URL do RPC contém termo proibido de 'mainnet'/
    );

    assert.throws(
      () => loadWorkerConfig({
        SOLANA_NETWORK: 'devnet',
        SOLANA_RPC_URL: 'https://solana-mainnet.g.alchemy.com/v2/demo'
      }),
      /A URL do RPC contém termo proibido de 'mainnet'/
    );
  });

  await t.test('4. Rejeita endpoints públicos ambíguos sem menção a devnet', () => {
    assert.throws(
      () => loadWorkerConfig({
        SOLANA_NETWORK: 'devnet',
        SOLANA_RPC_URL: 'https://rpc.ankr.com/solana'
      }),
      /O endpoint RPC público deve conter 'devnet'/
    );
  });

  await t.test('5. Aceita endpoint canônico da Solana Devnet', () => {
    const config = loadWorkerConfig({
      SOLANA_NETWORK: 'devnet',
      SOLANA_RPC_URL: 'https://api.devnet.solana.com'
    });
    assert.equal(config.network, 'devnet');
    assert.equal(config.rpcUrl, 'https://api.devnet.solana.com');
  });

  await t.test('6. NetworkGuard: Bloqueia matematicamente o Genesis Hash da Mainnet', () => {
    assert.throws(
      () => NetworkGuard.assertGenesisHash(SOLANA_GENESIS_HASHES.MAINNET),
      /Genesis Hash da MAINNET da Solana/
    );
  });

  await t.test('7. NetworkGuard: Bloqueia Genesis Hash da Testnet', () => {
    assert.throws(
      () => NetworkGuard.assertGenesisHash(SOLANA_GENESIS_HASHES.TESTNET),
      /reportou a TESTNET da Solana/
    );
  });

  await t.test('8. NetworkGuard: Aceita Genesis Hash canônico da Devnet', () => {
    assert.doesNotThrow(() => {
      NetworkGuard.assertGenesisHash(SOLANA_GENESIS_HASHES.DEVNET);
    });
  });

  await t.test('9. Ausência total de credenciais privadas ou segredos expostos em configuração', () => {
    const config = loadWorkerConfig({ SOLANA_NETWORK: 'devnet' });
    assert.equal((config as any).privateKey, undefined);
    assert.equal((config as any).secretKey, undefined);
    assert.equal((config as any).mnemonic, undefined);
    assert.equal((config as any).seed, undefined);
  });
});
