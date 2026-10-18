import { Vector2D } from '../types/index.js';
import { GAME_CONSTANTS } from '../constants/index.js';

/**
 * Retorna o XP total acumulado necessário para atingir o nível L.
 * Fórmula do Master Prompt: XP_total(L) = 100 * (L - 1)^2 + 400 * (L - 1)
 */
export function calculateTotalXpForLevel(level: number): number {
  if (level <= 1) return 0;
  const lMinus1 = level - 1;
  return 100 * (lMinus1 * lMinus1) + 400 * lMinus1;
}

/**
 * Retorna o XP necessário para progredir do nível L para o nível L + 1.
 * XP_para_proximo_nivel(L) = XP_total(L + 1) - XP_total(L) = 200 * (L - 1) + 500
 */
export function calculateXpToNextLevel(level: number): number {
  if (level < 1) return 500;
  return 200 * (level - 1) + 500;
}

/**
 * Calcula o dano determinístico garantindo valor mínimo de 1.
 * Dano_final = max(1, Ataque_efetivo - Defesa_efetiva)
 */
export function calculateDamage(effectiveAttack: number, effectiveDefense: number, variance: number = 0): number {
  const baseDamage = effectiveAttack * (1 + variance);
  const netDamage = baseDamage - effectiveDefense;
  return Math.max(1, Math.round(netDamage));
}

/**
 * Calcula o valor líquido da venda e a taxa de 5% do mercado.
 */
export function calculateMarketplacePayout(priceInGold: number): { sellerReceives: number; feeDeducted: number } {
  if (priceInGold <= 0) {
    return { sellerReceives: 0, feeDeducted: 0 };
  }
  const feeDeducted = Math.ceil(priceInGold * GAME_CONSTANTS.MARKETPLACE_FEE_PERCENTAGE);
  const sellerReceives = Math.max(0, priceInGold - feeDeducted);
  return { sellerReceives, feeDeducted };
}

/**
 * Normaliza um vetor 2D garantindo que a movimentação diagonal não exceda a velocidade unitária (evitando speedhack diagonal).
 */
export function normalizeVector(x: number, y: number): Vector2D {
  if (x === 0 && y === 0) {
    return { x: 0, y: 0 };
  }
  const magnitude = Math.sqrt(x * x + y * y);
  return {
    x: x / magnitude,
    y: y / magnitude
  };
}
