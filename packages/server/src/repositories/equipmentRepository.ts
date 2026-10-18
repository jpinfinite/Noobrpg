import { IDatabase, EquipmentRecord } from '../db/index.js';

export class EquipmentRepository {
  constructor(private db: IDatabase) {}

  public async getByCharacterId(characterId: string, tx?: IDatabase): Promise<EquipmentRecord | null> {
    const client = tx || this.db;
    const rows = await client.query<EquipmentRecord>(
      'SELECT character_id, weapon_item_id, armor_item_id, accessory_item_id FROM character_equipment WHERE character_id = ?;',
      [characterId]
    );
    return rows[0] || null;
  }

  public async saveEquipment(
    characterId: string,
    equipment: { weapon: string | null; armor: string | null; accessory: string | null },
    tx?: IDatabase
  ): Promise<void> {
    const client = tx || this.db;

    // Upsert nos equipamentos do personagem
    const existing = await this.getByCharacterId(characterId, client);
    if (existing) {
      await client.execute(
        `UPDATE character_equipment 
         SET weapon_item_id = ?, armor_item_id = ?, accessory_item_id = ?
         WHERE character_id = ?;`,
        [equipment.weapon, equipment.armor, equipment.accessory, characterId]
      );
    } else {
      await client.execute(
        `INSERT INTO character_equipment (character_id, weapon_item_id, armor_item_id, accessory_item_id)
         VALUES (?, ?, ?, ?);`,
        [characterId, equipment.weapon, equipment.armor, equipment.accessory]
      );
    }
  }
}
