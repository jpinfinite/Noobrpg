import {
  CharacterClass,
  CharacterAttributes,
  ClassCombatConfig,
  ClassGrowthRate,
  MonsterType,
  MonsterConfig,
  ItemCategory,
  ItemRarity,
  EquipmentSlot,
  ItemDefinition,
  GatheringNodeType,
  GatheringNodeConfig,
  CraftingRecipe
} from '../types/index.js';

// Dimensões do Display e Câmera
export const GAME_CONSTANTS = {
  CANVAS_WIDTH: 480,
  CANVAS_HEIGHT: 270,
  TILE_SIZE: 16,
  FPS_TARGET: 60,
  MARKETPLACE_FEE_PERCENTAGE: 0.05
} as const;

export const INVENTORY_CONSTANTS = {
  TOTAL_SLOTS: 24,
  DEFAULT_MAX_STACK: 99
} as const;

// Atributos base iniciais (Nível 1) das quatro classes
export const CLASS_BASE_ATTRIBUTES: Record<CharacterClass, CharacterAttributes> = {
  [CharacterClass.WARRIOR]: {
    maxHp: 120,
    currentHp: 120,
    maxMp: 30,
    currentMp: 30,
    attack: 12,
    defense: 8,
    speed: 90
  },
  [CharacterClass.RANGER]: {
    maxHp: 80,
    currentHp: 80,
    maxMp: 40,
    currentMp: 40,
    attack: 14,
    defense: 4,
    speed: 110
  },
  [CharacterClass.MAGE]: {
    maxHp: 70,
    currentHp: 70,
    maxMp: 100,
    currentMp: 100,
    attack: 16,
    defense: 3,
    speed: 95
  },
  [CharacterClass.DRUID]: {
    maxHp: 95,
    currentHp: 95,
    maxMp: 70,
    currentMp: 70,
    attack: 10,
    defense: 5,
    speed: 100
  }
};

// Crescimento de atributos por nível
export const CLASS_GROWTH_RATES: Record<CharacterClass, ClassGrowthRate> = {
  [CharacterClass.WARRIOR]: {
    hpPerLevel: 15,
    mpPerLevel: 2,
    attackPerLevel: 2,
    defensePerLevel: 2
  },
  [CharacterClass.RANGER]: {
    hpPerLevel: 8,
    mpPerLevel: 4,
    attackPerLevel: 3,
    defensePerLevel: 1
  },
  [CharacterClass.MAGE]: {
    hpPerLevel: 6,
    mpPerLevel: 12,
    attackPerLevel: 3.5,
    defensePerLevel: 0.8
  },
  [CharacterClass.DRUID]: {
    hpPerLevel: 11,
    mpPerLevel: 7,
    attackPerLevel: 2,
    defensePerLevel: 1.5
  }
};

// Configuração de combate e habilidades das quatro classes
export const CLASS_COMBAT_CONFIG: Record<CharacterClass, ClassCombatConfig> = {
  [CharacterClass.WARRIOR]: {
    attackRange: 32,
    attackCooldownMs: 1000,
    skill1Name: 'Golpe Pesado',
    skill1CooldownMs: 5000,
    skill1CostMp: 10
  },
  [CharacterClass.RANGER]: {
    attackRange: 140,
    attackCooldownMs: 800,
    skill1Name: 'Disparo Preciso',
    skill1CooldownMs: 4000,
    skill1CostMp: 12
  },
  [CharacterClass.MAGE]: {
    attackRange: 120,
    attackCooldownMs: 1200,
    skill1Name: 'Bola de Fogo',
    skill1CooldownMs: 4000,
    skill1CostMp: 15
  },
  [CharacterClass.DRUID]: {
    attackRange: 96,
    attackCooldownMs: 1000,
    skill1Name: 'Bênção da Natureza',
    skill1CooldownMs: 6000,
    skill1CostMp: 18
  }
};

// --- DEFINIÇÕES CENTRAIS DE ITENS ---

export const ITEM_DEFINITIONS: Record<string, ItemDefinition> = {
  wood_log: {
    id: 'wood_log',
    name: 'Madeira Rústica',
    description: 'Tronco de madeira obtido de árvores da floresta. Essencial para ferramentas e forja.',
    category: ItemCategory.RESOURCE,
    rarity: ItemRarity.COMMON,
    maxStack: 99,
    goldValue: 2,
    iconKey: 'icon_wood'
  },
  iron_ore: {
    id: 'iron_ore',
    name: 'Minério de Ferro',
    description: 'Nódulo de minério de ferro bruto extraído de rochas. Usado para fundir armas e armaduras.',
    category: ItemCategory.RESOURCE,
    rarity: ItemRarity.COMMON,
    maxStack: 99,
    goldValue: 4,
    iconKey: 'icon_ore'
  },
  herb_green: {
    id: 'herb_green',
    name: 'Erva Medicinal',
    description: 'Planta silvestre aromática com propriedades curativas. Ingrediente de alquimia.',
    category: ItemCategory.RESOURCE,
    rarity: ItemRarity.COMMON,
    maxStack: 99,
    goldValue: 3,
    iconKey: 'icon_herb'
  },
  slime_gel: {
    id: 'slime_gel',
    name: 'Gel Viscoso de Slime',
    description: 'Resíduo elástico e translúcido deixado por slimes. Agente aglutinante para poções.',
    category: ItemCategory.CRAFTING_MATERIAL,
    rarity: ItemRarity.COMMON,
    maxStack: 99,
    goldValue: 2,
    iconKey: 'icon_gel'
  },
  leather_strip: {
    id: 'leather_strip',
    name: 'Pedaço de Couro',
    description: 'Retalho de couro resistente obtido de criaturas. Base para vestimentas leves.',
    category: ItemCategory.CRAFTING_MATERIAL,
    rarity: ItemRarity.COMMON,
    maxStack: 99,
    goldValue: 5,
    iconKey: 'icon_leather'
  },
  potion_hp_minor: {
    id: 'potion_hp_minor',
    name: 'Poção de Vida Menor',
    description: 'Frasco com essência revitalizante. Restaura 35 pontos de vida imediatamente ao ser bebida.',
    category: ItemCategory.CONSUMABLE,
    rarity: ItemRarity.UNCOMMON,
    maxStack: 20,
    goldValue: 15,
    consumableEffect: {
      hpRestore: 35
    },
    iconKey: 'icon_potion_hp'
  },
  potion_mp_minor: {
    id: 'potion_mp_minor',
    name: 'Poção de Mana Menor',
    description: 'Frasco com líquido azul cintilante. Restaura 25 pontos de mana.',
    category: ItemCategory.CONSUMABLE,
    rarity: ItemRarity.UNCOMMON,
    maxStack: 20,
    goldValue: 15,
    consumableEffect: {
      mpRestore: 25
    },
    iconKey: 'icon_potion_mp'
  },
  pickaxe_copper: {
    id: 'pickaxe_copper',
    name: 'Picareta de Cobre',
    description: 'Ferramenta inicial de mineração. Também pode ser usada em combate.',
    category: ItemCategory.WEAPON,
    rarity: ItemRarity.COMMON,
    maxStack: 1,
    goldValue: 20,
    equipSlot: EquipmentSlot.WEAPON,
    requiredLevel: 1,
    attributesBonus: {
      attack: 3
    },
    iconKey: 'icon_pickaxe'
  },
  sword_iron: {
    id: 'sword_iron',
    name: 'Espada de Ferro Forjado',
    description: 'Espada balanceada com lâmina afiada. Concede bom poder de corte físico.',
    category: ItemCategory.WEAPON,
    rarity: ItemRarity.UNCOMMON,
    maxStack: 1,
    goldValue: 50,
    equipSlot: EquipmentSlot.WEAPON,
    requiredLevel: 2,
    attributesBonus: {
      attack: 8
    },
    iconKey: 'icon_sword'
  },
  armor_leather: {
    id: 'armor_leather',
    name: 'Túnica de Couro Reforçado',
    description: 'Armadura flexível que oferece proteção física e mobilidade.',
    category: ItemCategory.ARMOR,
    rarity: ItemRarity.UNCOMMON,
    maxStack: 1,
    goldValue: 45,
    equipSlot: EquipmentSlot.ARMOR,
    requiredLevel: 1,
    attributesBonus: {
      defense: 5,
      maxHp: 15
    },
    iconKey: 'icon_armor'
  },
  ring_vitality: {
    id: 'ring_vitality',
    name: 'Anel da Vitalidade',
    description: 'Anel de cobre lapidado com pedra vermelha. Aumenta a vitalidade e a resistência do usuário.',
    category: ItemCategory.ACCESSORY,
    rarity: ItemRarity.RARE,
    maxStack: 1,
    goldValue: 60,
    equipSlot: EquipmentSlot.ACCESSORY,
    requiredLevel: 1,
    attributesBonus: {
      maxHp: 20,
      defense: 2
    },
    iconKey: 'icon_ring'
  },
  bone_fragment: {
    id: 'bone_fragment',
    name: 'Fragmento de Osso',
    description: 'Fragmento ósseo resistente recolhido de esqueletos e criptas antigas. Material para ferramentas e arcos.',
    category: ItemCategory.CRAFTING_MATERIAL,
    rarity: ItemRarity.COMMON,
    maxStack: 99,
    goldValue: 6,
    iconKey: 'icon_bone'
  },
  potion_hp_medium: {
    id: 'potion_hp_medium',
    name: 'Poção de Vida Reforçada',
    description: 'Frasco denso de elixir curativo concentrado. Restaura 80 pontos de vida instantaneamente.',
    category: ItemCategory.CONSUMABLE,
    rarity: ItemRarity.RARE,
    maxStack: 20,
    goldValue: 35,
    consumableEffect: {
      hpRestore: 80
    },
    iconKey: 'icon_potion_hp_medium'
  },
  bow_composite: {
    id: 'bow_composite',
    name: 'Arco Composto Reforçado',
    description: 'Arco curvado feito com camadas de madeira e ossos polidos. Concede alto poder de ataque.',
    category: ItemCategory.WEAPON,
    rarity: ItemRarity.RARE,
    maxStack: 1,
    goldValue: 80,
    equipSlot: EquipmentSlot.WEAPON,
    requiredLevel: 3,
    attributesBonus: {
      attack: 11
    },
    iconKey: 'icon_bow'
  }
};

// --- DEFINIÇÕES DE MONSTROS E LOOT ---

export const MONSTER_DEFINITIONS: Record<MonsterType, MonsterConfig> = {
  [MonsterType.SLIME]: {
    type: MonsterType.SLIME,
    name: 'Slime Verde',
    level: 1,
    maxHp: 35,
    attack: 5,
    defense: 1,
    speed: 35,
    detectionRadius: 90,
    attackRange: 22,
    attackCooldownMs: 1400,
    xpReward: 25,
    goldRewardMin: 1,
    goldRewardMax: 3,
    respawnTimeMs: 5000,
    lootTable: [
      { itemId: 'slime_gel', chance: 1.0, minAmount: 1, maxAmount: 2 },
      { itemId: 'herb_green', chance: 0.4, minAmount: 1, maxAmount: 1 },
      { itemId: 'potion_hp_minor', chance: 0.15, minAmount: 1, maxAmount: 1 }
    ]
  },
  [MonsterType.GOBLIN]: {
    type: MonsterType.GOBLIN,
    name: 'Goblin Soldado',
    level: 5,
    maxHp: 160,
    attack: 18,
    defense: 8,
    speed: 55,
    detectionRadius: 110,
    attackRange: 26,
    attackCooldownMs: 1200,
    xpReward: 65,
    goldRewardMin: 8,
    goldRewardMax: 15,
    respawnTimeMs: 8000,
    lootTable: [
      { itemId: 'iron_ore', chance: 0.7, minAmount: 1, maxAmount: 2 },
      { itemId: 'leather_strip', chance: 0.6, minAmount: 1, maxAmount: 1 },
      { itemId: 'sword_iron', chance: 0.1, minAmount: 1, maxAmount: 1 }
    ]
  },
  [MonsterType.SKELETON]: {
    type: MonsterType.SKELETON,
    name: 'Esqueleto Guerreiro',
    level: 7,
    maxHp: 220,
    attack: 24,
    defense: 10,
    speed: 50,
    detectionRadius: 120,
    attackRange: 28,
    attackCooldownMs: 1100,
    xpReward: 95,
    goldRewardMin: 12,
    goldRewardMax: 22,
    respawnTimeMs: 10000,
    lootTable: [
      { itemId: 'bone_fragment', chance: 1.0, minAmount: 1, maxAmount: 3 },
      { itemId: 'iron_ore', chance: 0.5, minAmount: 1, maxAmount: 2 },
      { itemId: 'potion_hp_minor', chance: 0.3, minAmount: 1, maxAmount: 1 },
      { itemId: 'ring_vitality', chance: 0.08, minAmount: 1, maxAmount: 1 }
    ]
  }
};

// --- NÓS DE COLETA DO MUNDO ---

export const GATHERING_NODE_DEFINITIONS: Record<GatheringNodeType, GatheringNodeConfig> = {
  [GatheringNodeType.TREE]: {
    type: GatheringNodeType.TREE,
    name: 'Árvore Madura',
    gatherDurationMs: 1500,
    respawnTimeMs: 10000,
    droppedItemId: 'wood_log',
    dropAmountMin: 1,
    dropAmountMax: 3
  },
  [GatheringNodeType.ORE_VEIN]: {
    type: GatheringNodeType.ORE_VEIN,
    name: 'Veio de Ferro',
    gatherDurationMs: 2000,
    respawnTimeMs: 12000,
    droppedItemId: 'iron_ore',
    dropAmountMin: 1,
    dropAmountMax: 2
  },
  [GatheringNodeType.HERB_BUSH]: {
    type: GatheringNodeType.HERB_BUSH,
    name: 'Arbusto de Erva Medicinal',
    gatherDurationMs: 1000,
    respawnTimeMs: 8000,
    droppedItemId: 'herb_green',
    dropAmountMin: 1,
    dropAmountMax: 3
  }
};

// --- RECEITAS DE CRAFTING ---

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: 'recipe_hp_potion',
    name: 'Poção de Vida Menor',
    description: 'Destila ervas frescas e gel de slime para criar um elixir regenerativo.',
    category: ItemCategory.CONSUMABLE,
    resultItemId: 'potion_hp_minor',
    resultAmount: 1,
    requiredLevel: 1,
    ingredients: [
      { itemId: 'herb_green', quantity: 2 },
      { itemId: 'slime_gel', quantity: 1 }
    ]
  },
  {
    id: 'recipe_medium_hp_potion',
    name: 'Poção de Vida Reforçada',
    description: 'Concentra ervas e múltiplos frascos de poções menores para criar um elixir potente.',
    category: ItemCategory.CONSUMABLE,
    resultItemId: 'potion_hp_medium',
    resultAmount: 1,
    requiredLevel: 3,
    ingredients: [
      { itemId: 'potion_hp_minor', quantity: 2 },
      { itemId: 'herb_green', quantity: 3 }
    ]
  },
  {
    id: 'recipe_pickaxe',
    name: 'Picareta de Cobre',
    description: 'Monta uma picareta combinando minérios de ferro e cabos de madeira.',
    category: ItemCategory.WEAPON,
    resultItemId: 'pickaxe_copper',
    resultAmount: 1,
    requiredLevel: 1,
    ingredients: [
      { itemId: 'iron_ore', quantity: 3 },
      { itemId: 'wood_log', quantity: 2 }
    ]
  },
  {
    id: 'recipe_iron_sword',
    name: 'Espada de Ferro Forjado',
    description: 'Forja uma lâmina afiada resistente para aventureiros.',
    category: ItemCategory.WEAPON,
    resultItemId: 'sword_iron',
    resultAmount: 1,
    requiredLevel: 2,
    ingredients: [
      { itemId: 'iron_ore', quantity: 4 },
      { itemId: 'wood_log', quantity: 2 }
    ]
  },
  {
    id: 'recipe_composite_bow',
    name: 'Arco Composto Reforçado',
    description: 'Entalha madeira nobre e ossos para montar um arco de longo alcance.',
    category: ItemCategory.WEAPON,
    resultItemId: 'bow_composite',
    resultAmount: 1,
    requiredLevel: 3,
    ingredients: [
      { itemId: 'wood_log', quantity: 5 },
      { itemId: 'bone_fragment', quantity: 3 },
      { itemId: 'leather_strip', quantity: 2 }
    ]
  },
  {
    id: 'recipe_leather_armor',
    name: 'Túnica de Couro Reforçado',
    description: 'Costura retalhos de couro tratada para reforçar a defesa.',
    category: ItemCategory.ARMOR,
    resultItemId: 'armor_leather',
    resultAmount: 1,
    requiredLevel: 1,
    ingredients: [
      { itemId: 'leather_strip', quantity: 3 },
      { itemId: 'wood_log', quantity: 1 }
    ]
  }
];

// Constantes de Área de Interesse (AOI) e Sincronização em Rede (Fase 6)
export const AOI_CONSTANTS = {
  // Raio de visão para inclusão de entidade no snapshot do jogador (pixels)
  ENTER_RADIUS_X: 180,
  ENTER_RADIUS_Y: 120,
  // Raio com histerese para remoção da entidade do snapshot (evita flickering na borda)
  LEAVE_RADIUS_X: 220,
  LEAVE_RADIUS_Y: 150,
  // Frequência de envio de full snapshot (a cada 20 ticks = 1 segundo a 20 Hz)
  FULL_SNAPSHOT_INTERVAL_TICKS: 20
} as const;
