import { Vector2D, CharacterClass, CharacterAttributes } from '../types/index.js';
import { GAME_CONSTANTS, CLASS_BASE_ATTRIBUTES, CLASS_GROWTH_RATES } from '../constants/index.js';

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
 * Calcula os atributos consolidados de uma classe para um nível específico
 */
export function calculateAttributesForLevel(characterClass: CharacterClass, level: number): CharacterAttributes {
  const base = CLASS_BASE_ATTRIBUTES[characterClass];
  const growth = CLASS_GROWTH_RATES[characterClass];
  const levelDelta = Math.max(0, level - 1);

  const maxHp = Math.round(base.maxHp + growth.hpPerLevel * levelDelta);
  const maxMp = Math.round(base.maxMp + growth.mpPerLevel * levelDelta);
  const attack = Math.round(base.attack + growth.attackPerLevel * levelDelta);
  const defense = Math.round(base.defense + growth.defensePerLevel * levelDelta);

  return {
    maxHp,
    currentHp: maxHp,
    maxMp,
    currentMp: maxMp,
    attack,
    defense,
    speed: base.speed
  };
}

/**
 * Avalia o progresso de nível com base no XP total acumulado
 */
export function evaluateLevelProgression(currentLevel: number, totalXp: number): {
  newLevel: number;
  didLevelUp: boolean;
  xpInCurrentLevel: number;
  xpRequiredForNext: number;
} {
  let level = 1;
  while (totalXp >= calculateTotalXpForLevel(level + 1)) {
    level++;
  }

  const currentLevelStartXp = calculateTotalXpForLevel(level);
  const xpInCurrentLevel = totalXp - currentLevelStartXp;
  const xpRequiredForNext = calculateXpToNextLevel(level);

  return {
    newLevel: level,
    didLevelUp: level > currentLevel,
    xpInCurrentLevel,
    xpRequiredForNext
  };
}

/**
 * Calcula a distância euclidiana entre duas coordenadas
 */
export function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
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
 * Normaliza um vetor 2D garantindo que a movimentação diagonal não exceda a velocidade unitária.
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
