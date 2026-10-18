import { IDatabase, InventoryRecord } from '../db/index.js';
import { randomUUID } from 'node:crypto';

export class InventoryRepository {
  constructor(private db: IDatabase) {}

  public async getByCharacterId(characterId: string, tx?: IDatabase): Promise<InventoryRecord[]> {
    const client = tx || this.db;
    return client.query<InventoryRecord>(
      'SELECT id, character_id, slot_index, item_id, quantity FROM character_inventory WHERE character_id = ? ORDER BY slot_index ASC;',
      [characterId]
    );
  }

  public async saveSlots(
    characterId: string,
    slots: { slotIndex: number; itemId: string; quantity: number }[],
    tx?: IDatabase
  ): Promise<void> {
    const client = tx || this.db;

    // Remove slots atuais do personagem
    await client.execute('DELETE FROM character_inventory WHERE character_id = ?;', [characterId]);

    // Insere os novos slots não-vazios
    for (const slot of slots) {
      if (slot.slotIndex >= 0 && slot.slotIndex <= 23 && slot.quantity > 0 && slot.itemId) {
        const id = randomUUID();
        await client.execute(
          'INSERT INTO character_inventory (id, character_id, slot_index, item_id, quantity) VALUES (?, ?, ?, ?, ?);',
          [id, characterId, slot.slotIndex, slot.itemId, slot.quantity]
        );
      }
    }
  }
}
