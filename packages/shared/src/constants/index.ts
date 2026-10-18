import { CharacterClass, CharacterAttributes } from '../types/index.js';

// Dimensões do Display e Câmera
export const GAME_CONSTANTS = {
  CANVAS_WIDTH: 480,
  CANVAS_HEIGHT: 270,
  TILE_SIZE: 16,
  FPS_TARGET: 60,
  MARKETPLACE_FEE_PERCENTAGE: 0.05 // 5% de taxa do mercado de jogadores
} as const;

// Atributos base iniciais das quatro classes de acordo com o GDD aprovado
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
