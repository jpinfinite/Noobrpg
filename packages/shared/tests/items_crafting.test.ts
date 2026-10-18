import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CharacterClass,
  createEmptyInventory,
  addItemToInventory,
  removeItemFromSlot,
  getItemCount,
  calculateTotalPlayerAttributes,
  executeCrafting
} from '../src/index.js';

test('Inventário de 24 slots: criação, empilhamento e limite de capacidade', () => {
  const inv = createEmptyInventory();
  assert.equal(inv.length, 24);
  assert.ok(inv.every(slot => slot === null));

  // Adiciona 60 Madeiras (maxStack: 99)
  const res1 = addItemToInventory(inv, 'wood_log', 60);
  assert.equal(res1.success, true);
  assert.equal(res1.remainingQuantity, 0);
  assert.equal(inv[0]?.quantity, 60);

  // Adiciona mais 50 Madeiras: 39 devem entrar no slot 0 (atingindo 99) e 11 no slot 1
  const res2 = addItemToInventory(inv, 'wood_log', 50);
  assert.equal(res2.success, true);
  assert.equal(res2.remainingQuantity, 0);
  assert.equal(inv[0]?.quantity, 99);
  assert.equal(inv[1]?.quantity, 11);
  assert.equal(getItemCount(inv, 'wood_log'), 110);

  // Ocupa todos os slots restantes até os 24
  for (let i = 2; i < 24; i++) {
    inv[i] = { slotIndex: i, itemId: 'iron_ore', quantity: 99 };
  }

  // Tenta adicionar um item não empilhável (Espada de Ferro) com inventário lotado
  const resFull = addItemToInventory(inv, 'sword_iron', 1);
  assert.equal(resFull.success, false);
  assert.equal(resFull.remainingQuantity, 1);
});

test('Remoção de itens e limpeza de slots', () => {
  const inv = createEmptyInventory();
  addItemToInventory(inv, 'herb_green', 10);
  assert.equal(inv[0]?.quantity, 10);

  // Remove 3 ervas -> restam 7
  const ok1 = removeItemFromSlot(inv, 0, 3);
  assert.equal(ok1, true);
  assert.equal(inv[0]?.quantity, 7);

  // Tenta remover 15 (mais do que possui) -> rejeita
  const fail = removeItemFromSlot(inv, 0, 15);
  assert.equal(fail, false);
  assert.equal(inv[0]?.quantity, 7);

  // Remove as 7 restantes -> slot vira null
  const ok2 = removeItemFromSlot(inv, 0, 7);
  assert.equal(ok2, true);
  assert.equal(inv[0], null);
});

test('Equipamentos: cálculo idempotente de atributos sem duplicidade de bônus', () => {
  const charClass = CharacterClass.WARRIOR;
  const level = 1;

  // Sem equipamentos (Atributos base Nível 1: HP 120, Atq 12, Def 8)
  const baseAttrs = calculateTotalPlayerAttributes(charClass, level, {
    weapon: null,
    armor: null,
    accessory: null
  });
  assert.equal(baseAttrs.maxHp, 120);
  assert.equal(baseAttrs.attack, 12);
  assert.equal(baseAttrs.defense, 8);

  // Equipa Espada de Ferro (+8 Atq) e Túnica de Couro (+5 Def, +15 HP)
  const equippedAttrs = calculateTotalPlayerAttributes(charClass, level, {
    weapon: 'sword_iron',
    armor: 'armor_leather',
    accessory: null
  });
  assert.equal(equippedAttrs.attack, 20); // 12 + 8
  assert.equal(equippedAttrs.defense, 13); // 8 + 5
  assert.equal(equippedAttrs.maxHp, 135); // 120 + 15

  // Desequipa a espada: ataque deve retornar exatamente ao valor base
  const unequippedAttrs = calculateTotalPlayerAttributes(charClass, level, {
    weapon: null,
    armor: 'armor_leather',
    accessory: null
  });
  assert.equal(unequippedAttrs.attack, 12);
  assert.equal(unequippedAttrs.defense, 13);

  // Idempotência: rodar o cálculo múltiplas vezes produz exatamente o mesmo resultado
  for (let i = 0; i < 5; i++) {
    const testRecompute = calculateTotalPlayerAttributes(charClass, level, {
      weapon: 'sword_iron',
      armor: 'armor_leather',
      accessory: null
    });
    assert.equal(testRecompute.attack, 20);
  }
});

test('Crafting Atômico: sucesso, falta de materiais e inventário cheio', () => {
  const inv = createEmptyInventory();

  // Receita de Poção de Vida Menor: 2 ervas + 1 slime_gel
  addItemToInventory(inv, 'herb_green', 2);
  addItemToInventory(inv, 'slime_gel', 1);

  // 1. Sucesso no Crafting
  const craftSuccess = executeCrafting(inv, 'recipe_hp_potion', 1);
  assert.equal(craftSuccess.success, true);
  assert.equal(craftSuccess.resultItemId, 'potion_hp_minor');
  // Materiais devem ter sido consumidos
  assert.equal(getItemCount(inv, 'herb_green'), 0);
  assert.equal(getItemCount(inv, 'slime_gel'), 0);
  assert.equal(getItemCount(inv, 'potion_hp_minor'), 1);

  // 2. Falha por falta de materiais
  const craftFailMaterials = executeCrafting(inv, 'recipe_hp_potion', 1);
  assert.equal(craftFailMaterials.success, false);
  assert.equal(craftFailMaterials.reason, 'MISSING_INGREDIENTS');
  // Poção anterior continua intacta no inventário
  assert.equal(getItemCount(inv, 'potion_hp_minor'), 1);

  // 3. Falha por inventário lotado (Rollback atômico)
  // Adiciona ingredientes em pilhas que não serão totalmente esvaziadas (ex: 10 ferros e 10 madeiras)
  addItemToInventory(inv, 'iron_ore', 10);
  addItemToInventory(inv, 'wood_log', 10);
  // Ocupa todos os slots restantes até o final (24 slots cheios)
  for (let i = 0; i < 24; i++) {
    if (inv[i] === null) {
      inv[i] = { slotIndex: i, itemId: 'leather_strip', quantity: 99 };
    }
  }

  // Tenta fabricar a Picareta (requer 3 ferros e 2 madeiras, mas gerará 1 item não-empilhável sem slot livre)
  const craftFailFull = executeCrafting(inv, 'recipe_pickaxe', 1);
  assert.equal(craftFailFull.success, false);
  assert.equal(craftFailFull.reason, 'INVENTORY_FULL');
  // Ingredientes NÃO foram consumidos (preservam as 10 unidades de cada)
  assert.equal(getItemCount(inv, 'iron_ore'), 10);
  assert.equal(getItemCount(inv, 'wood_log'), 10);
});
