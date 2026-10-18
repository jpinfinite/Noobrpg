import { Vector2D } from '../types/index.js';
/**
 * Retorna o XP total acumulado necessário para atingir o nível L.
 * Fórmula do Master Prompt: XP_total(L) = 100 * (L - 1)^2 + 400 * (L - 1)
 */
export declare function calculateTotalXpForLevel(level: number): number;
/**
 * Retorna o XP necessário para progredir do nível L para o nível L + 1.
 * XP_para_proximo_nivel(L) = XP_total(L + 1) - XP_total(L) = 200 * (L - 1) + 500
 */
export declare function calculateXpToNextLevel(level: number): number;
/**
 * Calcula o dano determinístico garantindo valor mínimo de 1.
 * Dano_final = max(1, Ataque_efetivo - Defesa_efetiva)
 */
export declare function calculateDamage(effectiveAttack: number, effectiveDefense: number, variance?: number): number;
/**
 * Calcula o valor líquido da venda e a taxa de 5% do mercado.
 */
export declare function calculateMarketplacePayout(priceInGold: number): {
    sellerReceives: number;
    feeDeducted: number;
};
/**
 * Normaliza um vetor 2D garantindo que a movimentação diagonal não exceda a velocidade unitária (evitando speedhack diagonal).
 */
export declare function normalizeVector(x: number, y: number): Vector2D;
//# sourceMappingURL=index.d.ts.map