import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { SqliteDatabase } from '../src/db/sqlite.js';
import { runMigrations } from '../src/db/migrationRunner.js';
import { CharacterRepository } from '../src/repositories/characterRepository.js';
import { InventoryRepository } from '../src/repositories/inventoryRepository.js';
import { EquipmentRepository } from '../src/repositories/equipmentRepository.js';
import { GoldLedgerRepository } from '../src/repositories/goldLedgerRepository.js';
import { QuestRepository } from '../src/repositories/questRepository.js';
import { PendingRewardRepository } from '../src/repositories/pendingRewardRepository.js';
import { CharacterService } from '../src/services/characterService.js';
import { GameSimulation, ALCHEMY_STATIONS, CRAFTING_STATIONS } from '../src/simulation/GameSimulation.js';
import {
  CharacterClass,
  getItemCount,
  addItemToInventory,
  ITEM_DEFINITIONS,
  ItemCategory,
  CRAFTING_RECIPES
} from '@noobrpg/shared';

describe('NoobRPG — Missão 7: Alquimia, Integridade do Inventário e Economia de Recompensas', () => {
  let db: SqliteDatabase;
  let charRepo: CharacterRepository;
  let invRepo: InventoryRepository;
  let eqRepo: EquipmentRepository;
  let goldRepo: GoldLedgerRepository;
  let questRepo: QuestRepository;
  let pendingRepo: PendingRewardRepository;
  let charService: CharacterService;
  let simulation: GameSimulation;

  const testAccountId = 'acc_alchemy_01';
  const testAccount2Id = 'acc_alchemy_02';

  beforeEach(async () => {
    db = new SqliteDatabase(':memory:');
    await runMigrations(db);

    charRepo = new CharacterRepository(db);
    invRepo = new InventoryRepository(db);
    eqRepo = new EquipmentRepository(db);
    goldRepo = new GoldLedgerRepository(db);
    questRepo = new QuestRepository(db);
    pendingRepo = new PendingRewardRepository(db);

    charService = new CharacterService(db, charRepo, invRepo, eqRepo, goldRepo, questRepo, pendingRepo);
    simulation = new GameSimulation();

    await db.execute('INSERT INTO accounts (id, username, password_hash) VALUES (?, ?, ?);', [
      testAccountId,
      'alchemist_1',
      'hash_1'
    ]);
    await db.execute('INSERT INTO accounts (id, username, password_hash) VALUES (?, ?, ?);', [
      testAccount2Id,
      'alchemist_2',
      'hash_2'
    ]);
  });

  // ==========================================
  // FASE A: INTEGRIDADE DO INVENTÁRIO & RECOMPENSAS PENDENTES
  // ==========================================

  it('1. Recompensa com inventário vazio: entrega direta e sem pendências', async () => {
    const pData = await charService.createCharacter(testAccountId, 'HerbalistA', CharacterClass.DRUID);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    // Esvazia qualquer item inicial para garantir inventário vazio
    player.inventory.fill(null);

    const deliv = simulation.deliverItemOrPend(player, 'potion_hp_minor', 2, 'quest_test');
    assert.strictEqual(deliv.deliveredToInventory, 2);
    assert.strictEqual(deliv.pendedQuantity, 0);
    assert.strictEqual(getItemCount(player.inventory, 'potion_hp_minor'), 2);
    assert.strictEqual(player.pendingRewards.length, 0);
  });

  it('2. Recompensa com pilha existente: empilha sem criar novo slot e sem perda', async () => {
    const pData = await charService.createCharacter(testAccountId, 'HerbalistB', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    player.inventory.fill(null);
    player.inventory[0] = { itemId: 'potion_hp_minor', quantity: 5 };

    const deliv = simulation.deliverItemOrPend(player, 'potion_hp_minor', 3, 'quest_test');
    assert.strictEqual(deliv.deliveredToInventory, 3);
    assert.strictEqual(deliv.pendedQuantity, 0);
    assert.strictEqual(player.inventory[0]?.quantity, 8);
    assert.strictEqual(player.pendingRewards.length, 0);
  });

  it('3. Recompensa com inventário 100% cheio: zero perda, desvio seguro para pendingRewards', async () => {
    const pData = await charService.createCharacter(testAccountId, 'FullBagHero', CharacterClass.MAGE);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    // Preenche todos os 24 slots com itens no limite de pilha
    for (let i = 0; i < 24; i++) {
      player.inventory[i] = { itemId: 'wood_log', quantity: 99 };
    }

    const deliv = simulation.deliverItemOrPend(player, 'potion_hp_minor', 3, 'quest_tavern_supplies');
    assert.strictEqual(deliv.deliveredToInventory, 0);
    assert.strictEqual(deliv.pendedQuantity, 3);
    assert.strictEqual(player.pendingRewards.length, 1);
    assert.strictEqual(player.pendingRewards[0].itemId, 'potion_hp_minor');
    assert.strictEqual(player.pendingRewards[0].quantity, 3);
    assert.strictEqual(player.pendingRewards[0].source, 'quest_tavern_supplies');
  });

  it('4. Resgate autoritativo após liberar espaço (claimPendingRewards)', async () => {
    const pData = await charService.createCharacter(testAccountId, 'ClaimHero', CharacterClass.RANGER);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    // Enche o inventário
    for (let i = 0; i < 24; i++) {
      player.inventory[i] = { itemId: 'iron_ore', quantity: 99 };
    }

    // Adiciona 2 recompensas pendentes
    simulation.deliverItemOrPend(player, 'potion_hp_minor', 2, 'quest_reward_1');
    simulation.deliverItemOrPend(player, 'herb_green', 5, 'quest_reward_2');

    assert.strictEqual(player.pendingRewards.length, 2);

    // Tenta resgatar com inventário ainda cheio: deve falhar sem perder nada
    const claimFail = simulation.claimPendingRewards(player.id);
    assert.strictEqual(claimFail.success, false);
    assert.strictEqual(claimFail.reason, 'INVENTORY_FULL');
    assert.strictEqual(player.pendingRewards.length, 2);

    // Libera 2 slots do inventário
    player.inventory[0] = null;
    player.inventory[1] = null;

    // Resgata os itens com sucesso
    const claimSuccess = simulation.claimPendingRewards(player.id);
    assert.strictEqual(claimSuccess.success, true);
    assert.strictEqual(claimSuccess.claimed.length, 2);
    assert.strictEqual(player.pendingRewards.length, 0);

    // Verifica presença no inventário
    assert.strictEqual(getItemCount(player.inventory, 'potion_hp_minor'), 2);
    assert.strictEqual(getItemCount(player.inventory, 'herb_green'), 5);
  });

  it('5. Resgate parcial: quando há espaço apenas para fração dos pacotes pendentes', async () => {
    const pData = await charService.createCharacter(testAccountId, 'PartialHero', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    // Enche todos os 24 slots
    for (let i = 0; i < 24; i++) {
      player.inventory[i] = { itemId: 'iron_ore', quantity: 99 };
    }
    // Cria 2 pacotes pendentes distintos
    player.addPendingReward('potion_hp_minor', 1, 'quest_1');
    player.addPendingReward('potion_hp_medium', 1, 'quest_2');
    assert.strictEqual(player.pendingRewards.length, 2);

    // Libera exatamente 1 slot
    player.inventory[0] = null;

    const claimRes = simulation.claimPendingRewards(player.id);
    assert.strictEqual(claimRes.success, true);
    assert.strictEqual(claimRes.claimed.length, 1);
    // Exatamente 1 pacote continua pendente e nenhum item foi duplicado
    assert.strictEqual(player.pendingRewards.length, 1);
    assert.strictEqual(player.pendingRewards[0].itemId, 'potion_hp_medium');
    assert.strictEqual(getItemCount(player.inventory, 'potion_hp_minor'), 1);
  });

  it('6. Idempotência: requisições concorrentes de resgate via Promise.all não duplicam itens', async () => {
    const pData = await charService.createCharacter(testAccountId, 'ConcurrentClaim', CharacterClass.MAGE);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    player.inventory.fill(null);
    player.addPendingReward('potion_hp_minor', 1, 'quest_conc');

    // Executa múltiplos resgates concorrentes
    const results = await Promise.all([
      Promise.resolve(simulation.claimPendingRewards(player.id)),
      Promise.resolve(simulation.claimPendingRewards(player.id)),
      Promise.resolve(simulation.claimPendingRewards(player.id))
    ]);

    const successes = results.filter(r => r.success);
    assert.strictEqual(successes.length, 1, 'Apenas uma operação deve resgatar os itens');
    assert.strictEqual(player.pendingRewards.length, 0);
    assert.strictEqual(getItemCount(player.inventory, 'potion_hp_minor'), 1, 'Item não pode ser duplicado');
  });

  it('7. Persistência relacional: restauração após restart do banco de dados', async () => {
    const pData = await charService.createCharacter(testAccountId, 'RestartHero', CharacterClass.DRUID);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    // Adiciona recompensas pendentes e salva autoritativamente
    player.addPendingReward('potion_hp_minor', 4, 'quest_persist_1');
    player.addPendingReward('herb_green', 10, 'quest_persist_2');

    await charService.saveAuthoritativePlayer(player);

    // Simula reinício: recarrega o personagem do banco via CharacterService
    const reloaded = await charService.getCharacter(player.id);
    assert.ok(reloaded);
    assert.ok(reloaded.pendingRewards);
    assert.strictEqual(reloaded.pendingRewards.length, 2);

    const minor = reloaded.pendingRewards.find(r => r.itemId === 'potion_hp_minor');
    const herb = reloaded.pendingRewards.find(r => r.itemId === 'herb_green');
    assert.strictEqual(minor?.quantity, 4);
    assert.strictEqual(herb?.quantity, 10);
  });

  it('8. Isolamento entre múltiplos personagens', async () => {
    const charA = await charService.createCharacter(testAccountId, 'HeroAlpha', CharacterClass.WARRIOR);
    const charB = await charService.createCharacter(testAccount2Id, 'HeroBeta', CharacterClass.RANGER);

    const playerA = simulation.joinPlayer(charA, testAccountId, 1, 'map_starter_village');
    const playerB = simulation.joinPlayer(charB, testAccount2Id, 1, 'map_starter_village');

    playerA.addPendingReward('potion_hp_minor', 3, 'alpha_quest');
    await charService.saveAuthoritativePlayer(playerA);
    await charService.saveAuthoritativePlayer(playerB);

    const reloadedA = await charService.getCharacter(playerA.id);
    const reloadedB = await charService.getCharacter(playerB.id);

    assert.strictEqual(reloadedA?.pendingRewards?.length, 1);
    assert.strictEqual(reloadedB?.pendingRewards?.length, 0);
  });

  // ==========================================
  // FASE B: SISTEMA DE ALQUIMIA
  // ==========================================

  it('9. Alquimia: Fabricação com sucesso da Poção Menor de Vida pura com 3 ervas', async () => {
    const pData = await charService.createCharacter(testAccountId, 'AlchemistHero', CharacterClass.DRUID);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    player.inventory.fill(null);
    player.inventory[0] = { itemId: 'herb_green', quantity: 5 };

    // Posiciona o jogador exatamente na bancada de alquimia da vila (530, 290)
    player.x = 530;
    player.y = 290;

    const res = simulation.processCraft(player.id, 'recipe_hp_potion_simple');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.resultItemId, 'potion_hp_minor');
    assert.strictEqual(getItemCount(player.inventory, 'potion_hp_minor'), 1);
    assert.strictEqual(getItemCount(player.inventory, 'herb_green'), 2); // 5 - 3 = 2
  });

  it('10. Alquimia: Fabricação com sucesso da Poção Média de Vida combinando poções e ervas', async () => {
    const pData = await charService.createCharacter(testAccountId, 'MasterAlchemist', CharacterClass.MAGE);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    player.level = 3; // Requisito de nível 3 para receita de Poção Média
    player.inventory.fill(null);
    player.inventory[0] = { itemId: 'potion_hp_minor', quantity: 3 };
    player.inventory[1] = { itemId: 'herb_green', quantity: 5 };

    player.x = 530;
    player.y = 290;

    const res = simulation.processCraft(player.id, 'recipe_medium_hp_potion');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.resultItemId, 'potion_hp_medium');
    assert.strictEqual(getItemCount(player.inventory, 'potion_hp_medium'), 1);
    assert.strictEqual(getItemCount(player.inventory, 'potion_hp_minor'), 1); // 3 - 2 = 1
    assert.strictEqual(getItemCount(player.inventory, 'herb_green'), 2); // 5 - 3 = 2
  });

  it('11. Alquimia Zero Client Trust: Bloqueio por distância da bancada (TOO_FAR_FROM_CRAFTING_STATION)', async () => {
    const pData = await charService.createCharacter(testAccountId, 'FarAlchemist', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    player.inventory.fill(null);
    player.inventory[0] = { itemId: 'herb_green', quantity: 10 };

    // Posiciona longe de qualquer bancada de alquimia
    player.x = 100;
    player.y = 100;

    const res = simulation.processCraft(player.id, 'recipe_hp_potion_simple');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.reason, 'TOO_FAR_FROM_CRAFTING_STATION');
    assert.strictEqual(getItemCount(player.inventory, 'herb_green'), 10, 'Nenhum ingrediente pode ser consumido');
  });

  it('12. Alquimia Zero Client Trust: Bloqueio por ingredientes insuficientes (MISSING_INGREDIENTS)', async () => {
    const pData = await charService.createCharacter(testAccountId, 'PoorAlchemist', CharacterClass.DRUID);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    player.inventory.fill(null);
    player.inventory[0] = { itemId: 'herb_green', quantity: 2 }; // Precisa de 3

    player.x = 530;
    player.y = 290;

    const res = simulation.processCraft(player.id, 'recipe_hp_potion_simple');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.reason, 'MISSING_INGREDIENTS');
    assert.strictEqual(getItemCount(player.inventory, 'herb_green'), 2, 'Nenhum ingrediente consumido');
  });

  it('13. Alquimia Zero Client Trust: Bloqueio quando inventário está cheio sem consumir materiais', async () => {
    const pData = await charService.createCharacter(testAccountId, 'FullAlchemist', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    for (let i = 0; i < 23; i++) {
      player.inventory[i] = { itemId: 'sword_iron', quantity: 1 };
    }
    player.inventory[23] = { itemId: 'herb_green', quantity: 10 }; // 10 ervas

    player.x = 530;
    player.y = 290;

    // Tentativa de craft: restarão 7 ervas, logo não libera slot e poção não pode entrar
    const res = simulation.processCraft(player.id, 'recipe_hp_potion_simple');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.reason, 'INVENTORY_FULL');
    assert.strictEqual(getItemCount(player.inventory, 'herb_green'), 10, 'Ervas não podem ser consumidas se não há espaço');
  });

  // ==========================================
  // FASE C: USO E PERSISTÊNCIA DE CONSUMÍVEIS
  // ==========================================

  it('14. Consumíveis: Uso autoritativo de poção cura respeitando maxHp e consome 1 unidade', async () => {
    const pData = await charService.createCharacter(testAccountId, 'HealerHero', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    player.inventory.fill(null);
    player.inventory[0] = { itemId: 'potion_hp_minor', quantity: 3 };

    // Reduz o HP do jogador
    player.currentHp = 50;
    assert.strictEqual(player.hp, 50);

    const useRes = simulation.processUseItem(player.id, 0);
    assert.strictEqual(useRes.success, true);
    // potion_hp_minor restaura 35 HP: 50 + 35 = 85
    assert.strictEqual(player.hp, 85);
    assert.strictEqual(player.currentHp, 85);
    assert.strictEqual(getItemCount(player.inventory, 'potion_hp_minor'), 2);
  });

  it('15. Consumíveis: Cura limitada ao teto de maxHp', async () => {
    const pData = await charService.createCharacter(testAccountId, 'CapHealHero', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    player.inventory.fill(null);
    player.inventory[0] = { itemId: 'potion_hp_minor', quantity: 2 };

    // Deixa com 110 HP (com armadura inicial, maxHp é 135)
    player.currentHp = 110;

    const useRes = simulation.processUseItem(player.id, 0);
    assert.strictEqual(useRes.success, true);
    // 110 + 35 não pode exceder player.getMaxHp()
    assert.strictEqual(player.hp, player.getMaxHp());
    assert.strictEqual(getItemCount(player.inventory, 'potion_hp_minor'), 1);
  });

  it('16. Consumíveis: Concorrência com Promise.all na última poção disponível', async () => {
    const pData = await charService.createCharacter(testAccountId, 'RacePotionHero', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    player.inventory.fill(null);
    player.inventory[0] = { itemId: 'potion_hp_minor', quantity: 1 }; // Apenas 1 poção
    player.currentHp = 30;

    const results = await Promise.all([
      Promise.resolve(simulation.processUseItem(player.id, 0)),
      Promise.resolve(simulation.processUseItem(player.id, 0)),
      Promise.resolve(simulation.processUseItem(player.id, 0))
    ]);

    const successes = results.filter(r => r.success);
    assert.strictEqual(successes.length, 1, 'Apenas 1 uso deve ter sucesso');
    assert.strictEqual(getItemCount(player.inventory, 'potion_hp_minor'), 0);
    assert.strictEqual(player.hp, 65); // 30 + 35 = 65
  });

  // ==========================================
  // FASE D: REGRESSÃO DE QUESTS E RECOMPENSAS
  // ==========================================

  it('17. Regressão Quests: Conclusão de quest_tavern_supplies com inventário cheio não perde a poção recompensada', async () => {
    const pData = await charService.createCharacter(testAccountId, 'TavernHero', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    player.x = 510;
    player.y = 290;

    // Aceita a missão
    simulation.processQuestAction(player.id, 'quest_tavern_supplies', 'npc_tavern', 'START');

    // Fornece 3 ervas e preenche os outros 23 slots
    player.inventory.fill(null);
    for (let i = 0; i < 23; i++) {
      player.inventory[i] = { itemId: 'wood_log', quantity: 99 };
    }
    player.inventory[23] = { itemId: 'herb_green', quantity: 3 };

    // Conclui a quest: as 3 ervas são consumidas, liberando o slot 23!
    // A poção de recompensa (potion_hp_medium) entra perfeitamente no slot liberado!
    const res = simulation.processQuestAction(player.id, 'quest_tavern_supplies', 'npc_tavern', 'COMPLETE');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.quest?.completed, true);
    assert.strictEqual(getItemCount(player.inventory, 'potion_hp_medium'), 1);
    assert.strictEqual(player.pendingRewards.length, 0);

    // Tentativa de duplicar recompensa chamando COMPLETE novamente
    const resDup = simulation.processQuestAction(player.id, 'quest_tavern_supplies', 'npc_tavern', 'COMPLETE');
    assert.strictEqual(resDup.success, true);
    assert.strictEqual(resDup.rewardsAwarded, undefined, 'Recompensa não pode ser entregue em duplicidade');
    assert.strictEqual(getItemCount(player.inventory, 'potion_hp_medium'), 1, 'Recompensa não pode ser duplicada');
  });

  it('18. Regressão Quests: Conclusão com inventário 100% cheio guarda recompensa em pendingRewards sem duplicação', async () => {
    const pData = await charService.createCharacter(testAccountId, 'FullQuestHero', CharacterClass.WARRIOR);
    const player = simulation.joinPlayer(pData, testAccountId, 1, 'map_starter_village');

    player.x = 450;
    player.y = 90;

    // Inicia e avança quest_plains_threat até o step 2 (pronta para conclusão)
    simulation.processQuestAction(player.id, 'quest_plains_threat', 'npc_guard', 'START');
    const q = player.getQuest('quest_plains_threat');
    q.step = 2; // Simula 3 mortes de monstros

    // Enche todos os 24 slots do jogador
    for (let i = 0; i < 24; i++) {
      player.inventory[i] = { itemId: 'iron_ore', quantity: 99 };
    }

    // A recompensa da quest_plains_threat inclui 2x potion_hp_minor
    const res = simulation.processQuestAction(player.id, 'quest_plains_threat', 'npc_guard', 'COMPLETE');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.quest?.completed, true);

    // Como o inventário estava 24/24 ocupado por minério, as 2 poções foram salvas com segurança em pendingRewards
    assert.strictEqual(player.pendingRewards.length, 1);
    assert.strictEqual(player.pendingRewards[0].itemId, 'potion_hp_minor');
    assert.strictEqual(player.pendingRewards[0].quantity, 2);

    // O jogador libera 1 slot
    player.inventory[0] = null;

    // Resgata com sucesso
    const claimRes = simulation.claimPendingRewards(player.id);
    assert.strictEqual(claimRes.success, true);
    assert.strictEqual(getItemCount(player.inventory, 'potion_hp_minor'), 2);
    assert.strictEqual(player.pendingRewards.length, 0);
  });
});
