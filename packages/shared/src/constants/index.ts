import {
  CharacterClass,
  CharacterAttributes,
  ClassCombatConfig,
  ClassGrowthRate,
  MonsterType,
  MonsterConfig
} from '../types/index.js';

// Dimensões do Display e Câmera
export const GAME_CONSTANTS = {
  CANVAS_WIDTH: 480,
  CANVAS_HEIGHT: 270,
  TILE_SIZE: 16,
  FPS_TARGET: 60,
  MARKETPLACE_FEE_PERCENTAGE: 0.05
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

// Crescimento de atributos por nível de acordo com o COMBAT_AND_BALANCE.md
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

// Configurações e definições centrais de monstros
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
    respawnTimeMs: 5000
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
    respawnTimeMs: 8000
  }
};
