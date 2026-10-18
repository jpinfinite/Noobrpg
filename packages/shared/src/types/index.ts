export enum CharacterClass {
  WARRIOR = 'WARRIOR',
  RANGER = 'RANGER',
  MAGE = 'MAGE',
  DRUID = 'DRUID'
}

export enum Direction {
  DOWN = 'down',
  UP = 'up',
  LEFT = 'left',
  RIGHT = 'right',
  DOWN_LEFT = 'down_left',
  DOWN_RIGHT = 'down_right',
  UP_LEFT = 'up_left',
  UP_RIGHT = 'up_right'
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface CharacterAttributes {
  maxHp: number;
  currentHp: number;
  maxMp: number;
  currentMp: number;
  attack: number;
  defense: number;
  speed: number;
}

export interface ClassCombatConfig {
  attackRange: number;
  attackCooldownMs: number;
  skill1Name: string;
  skill1CooldownMs: number;
  skill1CostMp: number;
}

export interface ClassGrowthRate {
  hpPerLevel: number;
  mpPerLevel: number;
  attackPerLevel: number;
  defensePerLevel: number;
}

// --- MODELO DE ITENS E INVENTÁRIO ---

export enum ItemCategory {
  RESOURCE = 'RESOURCE',
  CONSUMABLE = 'CONSUMABLE',
  CRAFTING_MATERIAL = 'CRAFTING_MATERIAL',
  WEAPON = 'WEAPON',
  ARMOR = 'ARMOR',
  ACCESSORY = 'ACCESSORY'
}

export enum ItemRarity {
  COMMON = 'COMMON',
  UNCOMMON = 'UNCOMMON',
  RARE = 'RARE',
  EPIC = 'EPIC'
}

export enum EquipmentSlot {
  WEAPON = 'WEAPON',
  ARMOR = 'ARMOR',
  ACCESSORY = 'ACCESSORY'
}

export interface ItemAttributesBonus {
  attack?: number;
  defense?: number;
  maxHp?: number;
  maxMp?: number;
  speed?: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  maxStack: number;
  goldValue: number;
  equipSlot?: EquipmentSlot;
  requiredLevel?: number;
  requiredClass?: CharacterClass;
  attributesBonus?: ItemAttributesBonus;
  consumableEffect?: {
    hpRestore?: number;
    mpRestore?: number;
  };
  iconKey: string;
}

export interface InventorySlot {
  slotIndex: number; // 0 a 23 (24 slots)
  itemId: string;
  quantity: number;
}

export interface EquippedSlots {
  weapon: string | null;
  armor: string | null;
  accessory: string | null;
}

export interface PlayerData {
  id: string;
  name: string;
  characterClass: CharacterClass;
  level: number;
  currentXp: number;
  gold: number;
  meritPoints: number;
  attributes: CharacterAttributes;
  position: Vector2D;
  direction: Direction;
  inventory: (InventorySlot | null)[];
  equipped: EquippedSlots;
}

// --- TIPOS DE MONSTROS E LOOT ---

export enum MonsterType {
  SLIME = 'SLIME',
  GOBLIN = 'GOBLIN'
}

export enum MonsterAIState {
  IDLE_PATROL = 'IDLE_PATROL',
  CHASE = 'CHASE',
  ATTACK = 'ATTACK',
  RETURN = 'RETURN',
  DEAD = 'DEAD'
}

export interface MonsterDropEntry {
  itemId: string;
  chance: number; // 0.0 a 1.0 (ex: 0.8 = 80%)
  minAmount: number;
  maxAmount: number;
}

export interface MonsterConfig {
  type: MonsterType;
  name: string;
  level: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  detectionRadius: number;
  attackRange: number;
  attackCooldownMs: number;
  xpReward: number;
  goldRewardMin: number;
  goldRewardMax: number;
  respawnTimeMs: number;
  lootTable: MonsterDropEntry[];
}

// --- COLETA E RECURSOS ---

export enum GatheringNodeType {
  TREE = 'TREE',
  ORE_VEIN = 'ORE_VEIN',
  HERB_BUSH = 'HERB_BUSH'
}

export interface GatheringNodeConfig {
  type: GatheringNodeType;
  name: string;
  gatherDurationMs: number;
  respawnTimeMs: number;
  droppedItemId: string;
  dropAmountMin: number;
  dropAmountMax: number;
}

// --- CRAFTING ---

export interface CraftingIngredient {
  itemId: string;
  quantity: number;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  resultItemId: string;
  resultAmount: number;
  requiredLevel: number;
  ingredients: CraftingIngredient[];
}
