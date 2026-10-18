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
  speed: number; // Pixels por segundo
}

export interface ClassCombatConfig {
  attackRange: number;       // Alcance do ataque em pixels
  attackCooldownMs: number;  // Intervalo entre ataques em milissegundos
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
}

// --- TIPOS DE MONSTROS E IA ---

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
}
