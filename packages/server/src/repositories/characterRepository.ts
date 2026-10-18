import { IDatabase, CharacterRecord } from '../db/index.js';

export class CharacterRepository {
  constructor(private db: IDatabase) {}

  public async create(record: Omit<CharacterRecord, 'created_at' | 'updated_at' | 'version'>, tx?: IDatabase): Promise<CharacterRecord> {
    const client = tx || this.db;
    await client.execute(
      `INSERT INTO characters (
        id, account_id, name, character_class, level, current_xp, gold, merit_points, pos_x, pos_y, hp, mp, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1);`,
      [
        record.id,
        record.account_id,
        record.name,
        record.character_class,
        record.level,
        record.current_xp,
        record.gold,
        record.merit_points,
        record.pos_x,
        record.pos_y,
        record.hp,
        record.mp
      ]
    );

    const rows = await client.query<CharacterRecord>(
      'SELECT * FROM characters WHERE id = ?;',
      [record.id]
    );
    return rows[0];
  }

  public async listByAccountId(accountId: string): Promise<CharacterRecord[]> {
    return this.db.query<CharacterRecord>(
      'SELECT * FROM characters WHERE account_id = ? ORDER BY created_at ASC;',
      [accountId]
    );
  }

  public async findById(id: string): Promise<CharacterRecord | null> {
    const rows = await this.db.query<CharacterRecord>(
      'SELECT * FROM characters WHERE id = ?;',
      [id]
    );
    return rows[0] || null;
  }

  public async findByIdAndAccount(id: string, accountId: string): Promise<CharacterRecord | null> {
    const rows = await this.db.query<CharacterRecord>(
      'SELECT * FROM characters WHERE id = ? AND account_id = ?;',
      [id, accountId]
    );
    return rows[0] || null;
  }

  public async findByName(name: string): Promise<CharacterRecord | null> {
    const rows = await this.db.query<CharacterRecord>(
      'SELECT * FROM characters WHERE LOWER(name) = LOWER(?);',
      [name]
    );
    return rows[0] || null;
  }

  public async updateProgression(
    id: string,
    updates: {
      level?: number;
      current_xp?: number;
      gold?: number;
      merit_points?: number;
      pos_x?: number;
      pos_y?: number;
      hp?: number;
      mp?: number;
      expectedVersion?: number;
    },
    tx?: IDatabase
  ): Promise<CharacterRecord> {
    const client = tx || this.db;
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.level !== undefined) {
      fields.push('level = ?');
      values.push(updates.level);
    }
    if (updates.current_xp !== undefined) {
      fields.push('current_xp = ?');
      values.push(updates.current_xp);
    }
    if (updates.gold !== undefined) {
      fields.push('gold = ?');
      values.push(updates.gold);
    }
    if (updates.merit_points !== undefined) {
      fields.push('merit_points = ?');
      values.push(updates.merit_points);
    }
    if (updates.pos_x !== undefined) {
      fields.push('pos_x = ?');
      values.push(updates.pos_x);
    }
    if (updates.pos_y !== undefined) {
      fields.push('pos_y = ?');
      values.push(updates.pos_y);
    }
    if (updates.hp !== undefined) {
      fields.push('hp = ?');
      values.push(updates.hp);
    }
    if (updates.mp !== undefined) {
      fields.push('mp = ?');
      values.push(updates.mp);
    }

    fields.push('version = version + 1');
    fields.push("updated_at = CURRENT_TIMESTAMP");

    values.push(id);

    let whereClause = 'WHERE id = ?';
    if (updates.expectedVersion !== undefined) {
      whereClause += ' AND version = ?';
      values.push(updates.expectedVersion);
    }

    const result = await client.execute(
      `UPDATE characters SET ${fields.join(', ')} ${whereClause};`,
      values
    );

    if (updates.expectedVersion !== undefined && result.changes === 0) {
      throw new Error('Conflito de versão: o estado do personagem foi modificado por outra sessão.');
    }

    const rows = await client.query<CharacterRecord>(
      'SELECT * FROM characters WHERE id = ?;',
      [id]
    );
    return rows[0];
  }
}
