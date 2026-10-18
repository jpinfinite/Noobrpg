import {
  Vector2D,
  CharacterClass,
  CharacterAttributes,
  EquippedSlots,
  InventorySlot,
  CraftingIngredient
} from '../types/index.js';
import {
  GAME_CONSTANTS,
  INVENTORY_CONSTANTS,
  CLASS_BASE_ATTRIBUTES,
  CLASS_GROWTH_RATES,
  ITEM_DEFINITIONS,
  CRAFTING_RECIPES
} from '../constants/index.js';

/**
 * Retorna o XP total acumulado necessário para atingir o nível L.
 */
export function calculateTotalXpForLevel(level: number): number {
  if (level <= 1) return 0;
  const lMinus1 = level - 1;
  return 100 * (lMinus1 * lMinus1) + 400 * lMinus1;
}

/**
 * Retorna o XP necessário para progredir do nível L para o nível L + 1.
 */
export function calculateXpToNextLevel(level: number): number {
  if (level < 1) return 500;
  return 200 * (level - 1) + 500;
}

/**
 * Calcula os atributos consolidados base de uma classe para um nível específico (sem equipamentos)
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
 * Função única, pura e testável para calcular os atributos totais do personagem,
 * combinando base da classe, crescimento por nível e bônus dos equipamentos equipados.
 * Idempotente: nunca acumula no estado anterior.
 */
export function calculateTotalPlayerAttributes(
  characterClass: CharacterClass,
  level: number,
  equipped: EquippedSlots
): CharacterAttributes {
  const base = calculateAttributesForLevel(characterClass, level);

  let bonusAttack = 0;
  let bonusDefense = 0;
  let bonusMaxHp = 0;
  let bonusMaxMp = 0;
  let bonusSpeed = 0;

  const equippedIds = [equipped.weapon, equipped.armor, equipped.accessory].filter(Boolean) as string[];

  for (const itemId of equippedIds) {
    const itemDef = ITEM_DEFINITIONS[itemId];
    if (itemDef?.attributesBonus) {
      if (itemDef.attributesBonus.attack) bonusAttack += itemDef.attributesBonus.attack;
      if (itemDef.attributesBonus.defense) bonusDefense += itemDef.attributesBonus.defense;
      if (itemDef.attributesBonus.maxHp) bonusMaxHp += itemDef.attributesBonus.maxHp;
      if (itemDef.attributesBonus.maxMp) bonusMaxMp += itemDef.attributesBonus.maxMp;
      if (itemDef.attributesBonus.speed) bonusSpeed += itemDef.attributesBonus.speed;
    }
  }

  const finalMaxHp = base.maxHp + bonusMaxHp;
  const finalMaxMp = base.maxMp + bonusMaxMp;

  return {
    maxHp: finalMaxHp,
    currentHp: finalMaxHp,
    maxMp: finalMaxMp,
    currentMp: finalMaxMp,
    attack: base.attack + bonusAttack,
    defense: base.defense + bonusDefense,
    speed: base.speed + bonusSpeed
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

// --- FUNÇÕES PURAS DE GESTÃO DE INVENTÁRIO (24 SLOTS) ---

/**
 * Inicializa um inventário vazio de 24 posições
 */
export function createEmptyInventory(): (InventorySlot | null)[] {
  const inventory: (InventorySlot | null)[] = [];
  for (let i = 0; i < INVENTORY_CONSTANTS.TOTAL_SLOTS; i++) {
    inventory.push(null);
  }
  return inventory;
}

/**
 * Adiciona um item ao inventário respeitando maxStack e limites de slots.
 * Retorna se a operação foi bem-sucedida e a quantidade restante que não coube.
 */
export function addItemToInventory(
  inventory: (InventorySlot | null)[],
  itemId: string,
  quantity: number
): { success: boolean; addedQuantity: number; remainingQuantity: number } {
  const itemDef = ITEM_DEFINITIONS[itemId];
  if (!itemDef || quantity <= 0) {
    return { success: false, addedQuantity: 0, remainingQuantity: quantity };
  }

  let remaining = quantity;
  const maxStack = itemDef.maxStack;

  // 1. Tenta empilhar em slots existentes com o mesmo item
  if (maxStack > 1) {
    for (let i = 0; i < inventory.length; i++) {
      const slot = inventory[i];
      if (slot && slot.itemId === itemId && slot.quantity < maxStack) {
        const spaceInSlot = maxStack - slot.quantity;
        const toAdd = Math.min(spaceInSlot, remaining);
        slot.quantity += toAdd;
        remaining -= toAdd;
        if (remaining <= 0) break;
      }
    }
  }

  // 2. Se sobrar, procura primeiro slot vazio
  if (remaining > 0) {
    for (let i = 0; i < inventory.length; i++) {
      if (inventory[i] === null) {
        const toAdd = Math.min(maxStack, remaining);
        inventory[i] = {
          slotIndex: i,
          itemId,
          quantity: toAdd
        };
        remaining -= toAdd;
        if (remaining <= 0) break;
      }
    }
  }

  const added = quantity - remaining;
  return {
    success: remaining === 0,
    addedQuantity: added,
    remainingQuantity: remaining
  };
}

/**
 * Remove uma quantidade de item de um slot específico
 */
export function removeItemFromSlot(
  inventory: (InventorySlot | null)[],
  slotIndex: number,
  quantity: number
): boolean {
  if (slotIndex < 0 || slotIndex >= inventory.length) return false;
  const slot = inventory[slotIndex];
  if (!slot || slot.quantity < quantity || quantity <= 0) return false;

  slot.quantity -= quantity;
  if (slot.quantity === 0) {
    inventory[slotIndex] = null;
  }
  return true;
}

/**
 * Remove uma quantidade total de um itemId no inventário
 */
export function removeItemById(
  inventory: (InventorySlot | null)[],
  itemId: string,
  quantity: number
): boolean {
  if (getItemCount(inventory, itemId) < quantity) return false;

  let remainingToRemove = quantity;
  for (let i = 0; i < inventory.length; i++) {
    const slot = inventory[i];
    if (slot && slot.itemId === itemId) {
      if (slot.quantity <= remainingToRemove) {
        remainingToRemove -= slot.quantity;
        inventory[i] = null;
      } else {
        slot.quantity -= remainingToRemove;
        remainingToRemove = 0;
      }
      if (remainingToRemove === 0) break;
    }
  }
  return true;
}

/**
 * Retorna a contagem total de unidades de um item no inventário
 */
export function getItemCount(inventory: (InventorySlot | null)[], itemId: string): number {
  let count = 0;
  for (const slot of inventory) {
    if (slot && slot.itemId === itemId) {
      count += slot.quantity;
    }
  }
  return count;
}

/**
 * Verifica se o inventário possui todos os ingredientes de uma receita
 */
export function hasIngredients(
  inventory: (InventorySlot | null)[],
  ingredients: CraftingIngredient[]
): boolean {
  for (const ing of ingredients) {
    if (getItemCount(inventory, ing.itemId) < ing.quantity) {
      return false;
    }
  }
  return true;
}

/**
 * Executa fabricação atômica de uma receita:
 * Valida ingredientes e espaço no inventário. Se viável, remove ingredientes e adiciona o produto final em uma única operação lógica.
 */
export function executeCrafting(
  inventory: (InventorySlot | null)[],
  recipeId: string,
  playerLevel: number
): { success: boolean; resultItemId?: string; reason?: string } {
  const recipe = CRAFTING_RECIPES.find(r => r.id === recipeId);
  if (!recipe) {
    return { success: false, reason: 'RECIPE_NOT_FOUND' };
  }

  if (playerLevel < recipe.requiredLevel) {
    return { success: false, reason: 'LEVEL_TOO_LOW' };
  }

  if (!hasIngredients(inventory, recipe.ingredients)) {
    return { success: false, reason: 'MISSING_INGREDIENTS' };
  }

  // Clone de simulação para garantir atomicidade estrita
  const clonedInventory: (InventorySlot | null)[] = inventory.map(slot =>
    slot ? { ...slot } : null
  );

  // 1. Remove materiais no clone
  for (const ing of recipe.ingredients) {
    const removed = removeItemById(clonedInventory, ing.itemId, ing.quantity);
    if (!removed) {
      return { success: false, reason: 'TRANSACTION_ABORTED' };
    }
  }

  // 2. Adiciona item final no clone
  const addResult = addItemToInventory(clonedInventory, recipe.resultItemId, recipe.resultAmount);
  if (!addResult.success) {
    return { success: false, reason: 'INVENTORY_FULL' };
  }

  // 3. Aplica a transação no inventário real
  for (let i = 0; i < inventory.length; i++) {
    inventory[i] = clonedInventory[i];
  }

  return {
    success: true,
    resultItemId: recipe.resultItemId
  };
}
