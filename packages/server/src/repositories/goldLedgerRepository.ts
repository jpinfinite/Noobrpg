import { IDatabase, GoldTransactionRecord } from '../db/index.js';
import { randomUUID } from 'node:crypto';

export class GoldLedgerRepository {
  constructor(private db: IDatabase) {}

  public async recordTransaction(
    characterId: string,
    amount: number,
    balanceAfter: number,
    source: string,
    tx?: IDatabase
  ): Promise<GoldTransactionRecord> {
    const client = tx || this.db;
    const id = randomUUID();

    await client.execute(
      `INSERT INTO gold_transactions (id, character_id, amount, balance_after, source)
       VALUES (?, ?, ?, ?, ?);`,
      [id, characterId, amount, balanceAfter, source]
    );

    const rows = await client.query<GoldTransactionRecord>(
      'SELECT id, character_id, amount, balance_after, source, created_at FROM gold_transactions WHERE id = ?;',
      [id]
    );
    return rows[0];
  }

  public async getTransactions(characterId: string, limit: number = 50): Promise<GoldTransactionRecord[]> {
    return this.db.query<GoldTransactionRecord>(
      'SELECT id, character_id, amount, balance_after, source, created_at FROM gold_transactions WHERE character_id = ? ORDER BY created_at DESC LIMIT ?;',
      [characterId, limit]
    );
  }
}
