import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTotalXpForLevel,
  calculateXpToNextLevel,
  calculateDamage,
  calculateMarketplacePayout,
  normalizeVector
} from '../src/formulas/index.js';

test('Curva de XP acumulada e delta de níveis', () => {
  // L = 1 => 0 XP
  assert.equal(calculateTotalXpForLevel(1), 0);
  // L = 2 => 100*(1)^2 + 400*(1) = 500 XP
  assert.equal(calculateTotalXpForLevel(2), 500);
  // L = 3 => 100*(4) + 400*(2) = 1200 XP
  assert.equal(calculateTotalXpForLevel(3), 1200);
  // L = 10 => 100*(81) + 400*(9) = 8100 + 3600 = 11700 XP
  assert.equal(calculateTotalXpForLevel(10), 11700);

  // XP para próximo nível
  assert.equal(calculateXpToNextLevel(1), 500);
  assert.equal(calculateXpToNextLevel(2), 700);
  assert.equal(calculateXpToNextLevel(9), 2100);
});

test('Fórmula de dano determinístico e limites mínimos', () => {
  // Dano padrão: 15 ataque - 5 defesa = 10
  assert.equal(calculateDamage(15, 5), 10);
  // Defesa superior ao ataque deve garantir sempre dano mínimo 1
  assert.equal(calculateDamage(5, 20), 1);
  assert.equal(calculateDamage(10, 10), 1);
});

test('Taxa de 5% do Mercado e integridade de repasse', () => {
  const payout1000 = calculateMarketplacePayout(1000);
  assert.equal(payout1000.feeDeducted, 50); // 5% de 1000
  assert.equal(payout1000.sellerReceives, 950);

  const payout100 = calculateMarketplacePayout(100);
  assert.equal(payout100.feeDeducted, 5);
  assert.equal(payout100.sellerReceives, 95);
});

test('Normalização de vetor 2D para movimento em 8 direções', () => {
  // Vetor parado
  const zero = normalizeVector(0, 0);
  assert.equal(zero.x, 0);
  assert.equal(zero.y, 0);

  // Vetor cardinal (apenas direita)
  const right = normalizeVector(1, 0);
  assert.equal(right.x, 1);
  assert.equal(right.y, 0);

  // Vetor diagonal (baixo-direita)
  const diagonal = normalizeVector(1, 1);
  const expected = Math.SQRT1_2; // ~0.70710678...
  assert.ok(Math.abs(diagonal.x - expected) < 1e-6);
  assert.ok(Math.abs(diagonal.y - expected) < 1e-6);

  // Magnitude total deve ser exatamente 1.0 (ou ~1.0 dentro de erro de ponto flutuante)
  const magnitude = Math.sqrt(diagonal.x * diagonal.x + diagonal.y * diagonal.y);
  assert.ok(Math.abs(magnitude - 1.0) < 1e-6);
});
