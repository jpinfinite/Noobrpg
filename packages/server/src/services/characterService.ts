import { randomUUID } from 'node:crypto';
import {
  CharacterClass,
  Direction,
  InventorySlot,
  PlayerData,
  CLASS_BASE_ATTRIBUTES,
  ITEM_DEFINITIONS,
  INVENTORY_CONSTANTS,
  calculateAttributesForLevel,
  evaluateLevelProgression
} from '@noobrpg/shared';
import { IDatabase, CharacterRecord } from '../db/index.js';
import { CharacterRepository } from '../repositories/characterRepository.js';
import { InventoryRepository } from '../repositories/inventoryRepository.js';
import { EquipmentRepository } from '../repositories/equipmentRepository.js';
import { GoldLedgerRepository } from '../repositories/goldLedgerRepository.js';

export interface SaveCharacterPayload {
  position?: { x: number; y: number };
  hp?: number;
  mp?: number;
  xpGained?: number;
  goldChange?: { amount: number; source: string };
  inventory?: (InventorySlot | null)[];
  equipped?: { weapon: string | null; armor: string | null; accessory: string | null };
}

export class CharacterService {
  constructor(
    private db: IDatabase,
    private characterRepo: CharacterRepository,
    private inventoryRepo: InventoryRepository,
    private equipmentRepo: EquipmentRepository,
    private goldLedgerRepo: GoldLedgerRepository
  ) {}

  public async createCharacter(
    accountId: string,
    name: string,
    characterClass: CharacterClass
  ): Promise<PlayerData> {
    const cleanName = (name || '').trim();
    if (!/^[a-zA-Z0-9_ ]{3,16}$/.test(cleanName)) {
      throw new Error('O nome do personagem deve ter entre 3 e 16 caracteres alfanuméricos.');
    }

    if (!Object.values(CharacterClass).includes(characterClass)) {
      throw new Error('Classe de personagem inválida.');
    }

    // Limite de personagens por conta (máximo 4)
    const existingChars = await this.characterRepo.listByAccountId(accountId);
    if (existingChars.length >= 4) {
      throw new Error('Limite máximo de 4 personagens atingido para esta conta.');
    }

    // Verifica unicidade do nome
    const nameTaken = await this.characterRepo.findByName(cleanName);
    if (nameTaken) {
      throw new Error('Já existe um personagem com este nome.');
    }

    const baseAttrs = CLASS_BASE_ATTRIBUTES[characterClass];
    const charId = randomUUID();
    const initialGold = 100;

    // Executa criação atômica com transação
    return await this.db.transaction(async tx => {
      const charRepo = new CharacterRepository(tx);
      const invRepo = new InventoryRepository(tx);
      const eqRepo = new EquipmentRepository(tx);
      const goldRepo = new GoldLedgerRepository(tx);

      // 1. Cria personagem
      await charRepo.create(
        {
          id: charId,
          account_id: accountId,
          name: cleanName,
          character_class: characterClass,
          level: 1,
          current_xp: 0,
          gold: initialGold,
          merit_points: 0,
          pos_x: 180,
          pos_y: 160,
          hp: baseAttrs.maxHp,
          mp: baseAttrs.maxMp
        },
        tx
      );

      // 2. Inventário inicial: 2 Poções de Vida e 1 Ferramenta/Arma inicial
      const starterInventory: { slotIndex: number; itemId: string; quantity: number }[] = [
        { slotIndex: 0, itemId: 'potion_hp_minor', quantity: 2 },
        { slotIndex: 1, itemId: 'wood_log', quantity: 5 }
      ];
      await invRepo.saveSlots(charId, starterInventory, tx);

      // 3. Equipamento inicial de acordo com a classe
      let starterWeapon: string | null = null;
      if (characterClass === CharacterClass.WARRIOR) {
        starterWeapon = 'sword_iron';
      } else {
        starterWeapon = 'pickaxe_copper';
      }

      await eqRepo.saveEquipment(
        charId,
        {
          weapon: starterWeapon,
          armor: 'armor_leather',
          accessory: null
        },
        tx
      );

      // 4. Registro no livro-razão de Gold
      await goldRepo.recordTransaction(charId, initialGold, initialGold, 'starter_funds', tx);

      // Monta dados completos retornados
      return this.formatPlayerData(
        {
          id: charId,
          account_id: accountId,
          name: cleanName,
          character_class: characterClass,
          level: 1,
          current_xp: 0,
          gold: initialGold,
          merit_points: 0,
          pos_x: 180,
          pos_y: 160,
          hp: baseAttrs.maxHp,
          mp: baseAttrs.maxMp,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        starterInventory,
        { weapon: starterWeapon, armor: 'armor_leather', accessory: null }
      );
    });
  }

  public async listCharacters(accountId: string): Promise<CharacterRecord[]> {
    return this.characterRepo.listByAccountId(accountId);
  }

  public async getCharacter(accountId: string, characterId: string): Promise<PlayerData> {
    const char = await this.characterRepo.findByIdAndAccount(characterId, accountId);
    if (!char) {
      throw new Error('Personagem não encontrado ou você não tem permissão para acessá-lo.');
    }

    const inventoryRows = await this.inventoryRepo.getByCharacterId(characterId);
    const equipmentRow = await this.equipmentRepo.getByCharacterId(characterId);

    const inventorySlots = inventoryRows.map(r => ({
      slotIndex: r.slot_index,
      itemId: r.item_id,
      quantity: r.quantity
    }));

    const equipment = {
      weapon: equipmentRow?.weapon_item_id || null,
      armor: equipmentRow?.armor_item_id || null,
      accessory: equipmentRow?.accessory_item_id || null
    };

    return this.formatPlayerData(char, inventorySlots, equipment);
  }

  public async saveCharacter(
    accountId: string,
    characterId: string,
    payload: SaveCharacterPayload
  ): Promise<PlayerData> {
    // 1. Checa propriedade
    const char = await this.characterRepo.findByIdAndAccount(characterId, accountId);
    if (!char) {
      throw new Error('Personagem não encontrado ou você não tem permissão para salvá-lo.');
    }

    return await this.db.transaction(async tx => {
      const charRepo = new CharacterRepository(tx);
      const invRepo = new InventoryRepository(tx);
      const eqRepo = new EquipmentRepository(tx);
      const goldRepo = new GoldLedgerRepository(tx);

      // 2. Calcula novo XP e Nível Server-Authoritative
      let currentXp = char.current_xp;
      if (typeof payload.xpGained === 'number' && payload.xpGained > 0) {
        currentXp += Math.floor(payload.xpGained);
      }
      const progression = evaluateLevelProgression(char.level, currentXp);
      const newLevel = progression.newLevel;

      // 3. Valida Atributos e HP/MP
      const charClass = char.character_class as CharacterClass;
      const calculatedAttrs = calculateAttributesForLevel(charClass, newLevel);

      let currentHp = char.hp;
      if (typeof payload.hp === 'number') {
        currentHp = Math.max(0, Math.min(Math.floor(payload.hp), calculatedAttrs.maxHp));
      }

      let currentMp = char.mp;
      if (typeof payload.mp === 'number') {
        currentMp = Math.max(0, Math.min(Math.floor(payload.mp), calculatedAttrs.maxMp));
      }

      // 4. Valida Posição
      let posX = char.pos_x;
      let posY = char.pos_y;
      if (payload.position && typeof payload.position.x === 'number' && typeof payload.position.y === 'number') {
        // Coordenadas devem ser finitas
        if (Number.isFinite(payload.position.x) && Number.isFinite(payload.position.y)) {
          posX = Math.round(payload.position.x);
          posY = Math.round(payload.position.y);
        }
      }

      // 5. Trata alteração de Gold com auditoria
      let currentGold = char.gold;
      if (payload.goldChange && typeof payload.goldChange.amount === 'number' && payload.goldChange.amount !== 0) {
        const delta = Math.floor(payload.goldChange.amount);
        const nextGold = currentGold + delta;
        if (nextGold < 0) {
          throw new Error('Saldo insuficiente de Gold para a operação.');
        }
        currentGold = nextGold;
        await goldRepo.recordTransaction(
          char.id,
          delta,
          currentGold,
          payload.goldChange.source || 'client_update',
          tx
        );
      }

      // Atualiza tabela characters
      const updatedChar = await charRepo.updateProgression(
        char.id,
        {
          level: newLevel,
          current_xp: currentXp,
          gold: currentGold,
          hp: currentHp,
          mp: currentMp,
          pos_x: posX,
          pos_y: posY
        },
        tx
      );

      // 6. Atualiza inventário se fornecido
      let finalInventorySlots: { slotIndex: number; itemId: string; quantity: number }[] = [];
      if (Array.isArray(payload.inventory)) {
        for (let i = 0; i < payload.inventory.length; i++) {
          const slot = payload.inventory[i];
          if (slot && slot.itemId && slot.quantity > 0) {
            // Valida se o item existe nas definições canônicas
            const def = ITEM_DEFINITIONS[slot.itemId];
            if (def) {
              const qty = Math.min(slot.quantity, def.maxStack);
              finalInventorySlots.push({
                slotIndex: i,
                itemId: slot.itemId,
                quantity: qty
              });
            }
          }
        }
        await invRepo.saveSlots(char.id, finalInventorySlots, tx);
      } else {
        const existing = await invRepo.getByCharacterId(char.id, tx);
        finalInventorySlots = existing.map(e => ({
          slotIndex: e.slot_index,
          itemId: e.item_id,
          quantity: e.quantity
        }));
      }

      // 7. Atualiza equipamentos se fornecido
      let finalEquipment = {
        weapon: null as string | null,
        armor: null as string | null,
        accessory: null as string | null
      };

      if (payload.equipped) {
        // Valida itens de equipamento
        if (payload.equipped.weapon && ITEM_DEFINITIONS[payload.equipped.weapon]) {
          finalEquipment.weapon = payload.equipped.weapon;
        }
        if (payload.equipped.armor && ITEM_DEFINITIONS[payload.equipped.armor]) {
          finalEquipment.armor = payload.equipped.armor;
        }
        if (payload.equipped.accessory && ITEM_DEFINITIONS[payload.equipped.accessory]) {
          finalEquipment.accessory = payload.equipped.accessory;
        }
        await eqRepo.saveEquipment(char.id, finalEquipment, tx);
      } else {
        const existingEq = await eqRepo.getByCharacterId(char.id, tx);
        finalEquipment = {
          weapon: existingEq?.weapon_item_id || null,
          armor: existingEq?.armor_item_id || null,
          accessory: existingEq?.accessory_item_id || null
        };
      }

      return this.formatPlayerData(updatedChar, finalInventorySlots, finalEquipment);
    });
  }

  private formatPlayerData(
    char: CharacterRecord,
    inventorySlots: { slotIndex: number; itemId: string; quantity: number }[],
    equipment: { weapon: string | null; armor: string | null; accessory: string | null }
  ): PlayerData {
    const charClass = char.character_class as CharacterClass;
    const baseAttrs = calculateAttributesForLevel(charClass, char.level);

    // Soma bônus de equipamentos
    let bonusAttack = 0;
    let bonusDefense = 0;
    let bonusMaxHp = 0;
    let bonusMaxMp = 0;
    let bonusSpeed = 0;

    const equipKeys: (keyof typeof equipment)[] = ['weapon', 'armor', 'accessory'];
    for (const key of equipKeys) {
      const itemId = equipment[key];
      if (itemId && ITEM_DEFINITIONS[itemId]) {
        const b = ITEM_DEFINITIONS[itemId].attributesBonus;
        if (b) {
          if (b.attack) bonusAttack += b.attack;
          if (b.defense) bonusDefense += b.defense;
          if (b.maxHp) bonusMaxHp += b.maxHp;
          if (b.maxMp) bonusMaxMp += b.maxMp;
          if (b.speed) bonusSpeed += b.speed;
        }
      }
    }

    const calculatedAttributes = {
      maxHp: baseAttrs.maxHp + bonusMaxHp,
      currentHp: Math.min(char.hp, baseAttrs.maxHp + bonusMaxHp),
      maxMp: baseAttrs.maxMp + bonusMaxMp,
      currentMp: Math.min(char.mp, baseAttrs.maxMp + bonusMaxMp),
      attack: baseAttrs.attack + bonusAttack,
      defense: baseAttrs.defense + bonusDefense,
      speed: baseAttrs.speed + bonusSpeed
    };

    // Monta array fixo de 24 slots
    const inventoryArray: (InventorySlot | null)[] = new Array(INVENTORY_CONSTANTS.TOTAL_SLOTS).fill(null);
    for (const slot of inventorySlots) {
      if (slot.slotIndex >= 0 && slot.slotIndex < INVENTORY_CONSTANTS.TOTAL_SLOTS) {
        inventoryArray[slot.slotIndex] = {
          slotIndex: slot.slotIndex,
          itemId: slot.itemId,
          quantity: slot.quantity
        };
      }
    }

    return {
      id: char.id,
      name: char.name,
      characterClass: charClass,
      level: char.level,
      currentXp: char.current_xp,
      gold: char.gold,
      meritPoints: char.merit_points,
      attributes: calculatedAttributes,
      position: { x: char.pos_x, y: char.pos_y },
      direction: Direction.DOWN,
      inventory: inventoryArray,
      equipped: equipment
    };
  }
}
