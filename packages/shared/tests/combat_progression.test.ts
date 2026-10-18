import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CharacterClass,
  MonsterType,
  MONSTER_DEFINITIONS,
  calculateAttributesForLevel,
  evaluateLevelProgression,
  calculateDamage,
  calculateDistance
} from '../src/index.js';

test('Recálculo de atributos de classes ao subir de nível', () => {
  // Guerreiro Nível 1
  const warriorL1 = calculateAttributesForLevel(CharacterClass.WARRIOR, 1);
  assert.equal(warriorL1.maxHp, 120);
  assert.equal(warriorL1.attack, 12);
  assert.equal(warriorL1.defense, 8);

  // Guerreiro Nível 5 (L - 1 = 4 níveis de crescimento)
  // HP: 120 + 4*15 = 180, Atq: 12 + 4*2 = 20, Def: 8 + 4*2 = 16
  const warriorL5 = calculateAttributesForLevel(CharacterClass.WARRIOR, 5);
  assert.equal(warriorL5.maxHp, 180);
  assert.equal(warriorL5.attack, 20);
  assert.equal(warriorL5.defense, 16);

  // Mago Nível 2
  // HP: 70 + 6 = 76, MP: 100 + 12 = 112, Atq: 16 + 3.5 = 19.5 -> 20
  const mageL2 = calculateAttributesForLevel(CharacterClass.MAGE, 2);
  assert.equal(mageL2.maxHp, 76);
  assert.equal(mageL2.maxMp, 112);
  assert.equal(mageL2.attack, 20);
});

test('Progressão de XP e disparo de Level Up', () => {
  // Com 200 XP (menor que 500), continua nível 1
  const prog1 = evaluateLevelProgression(1, 200);
  assert.equal(prog1.newLevel, 1);
  assert.equal(prog1.didLevelUp, false);
  assert.equal(prog1.xpInCurrentLevel, 200);
  assert.equal(prog1.xpRequiredForNext, 500);

  // Com 500 XP exatos, deve subir para nível 2!
  const prog2 = evaluateLevelProgression(1, 500);
  assert.equal(prog2.newLevel, 2);
  assert.equal(prog2.didLevelUp, true);
  assert.equal(prog2.xpInCurrentLevel, 0);
  assert.equal(prog2.xpRequiredForNext, 700);

  // Com 1200 XP, sobe para nível 3!
  const prog3 = evaluateLevelProgression(2, 1200);
  assert.equal(prog3.newLevel, 3);
  assert.equal(prog3.didLevelUp, true);
});

test('Ciclo determinístico de combate: Guerreiro vs Slime', () => {
  const slime = MONSTER_DEFINITIONS[MonsterType.SLIME];
  const warriorAttrs = calculateAttributesForLevel(CharacterClass.WARRIOR, 1);

  // Guerreiro ataca Slime: Ataque 12 vs Defesa 1 = 11 de dano
  const damageToSlime = calculateDamage(warriorAttrs.attack, slime.defense);
  assert.equal(damageToSlime, 11);

  // Slime ataca Guerreiro: Ataque 5 vs Defesa 8 = 5 - 8 = -3 -> dano mínimo 1
  const damageToWarrior = calculateDamage(slime.attack, warriorAttrs.defense);
  assert.equal(damageToWarrior, 1);

  // Golpes para derrotar o Slime (HP: 35): ceil(35 / 11) = 4 golpes
  const hitsNeeded = Math.ceil(slime.maxHp / damageToSlime);
  assert.equal(hitsNeeded, 4);
});

test('Distância e alcance euclidiano', () => {
  const dist = calculateDistance(0, 0, 30, 40);
  assert.equal(dist, 50); // Triângulo 3-4-5 clássico
});
