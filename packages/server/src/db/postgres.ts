import pg from 'pg';
import { IDatabase } from './types.js';

export class PostgresDatabase implements IDatabase {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    const isSsl = connectionString.includes('sslmode=require') || process.env.NODE_ENV === 'production';
    this.pool = new pg.Pool({
      connectionString,
      ssl: isSsl ? { rejectUnauthorized: false } : undefined
    });
  }

  // Converte placeholders ? para $1, $2, $3 do PostgreSQL
  private formatSql(sql: string): string {
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const formatted = this.formatSql(sql);
    const result = await this.pool.query(formatted, params);
    return result.rows as T[];
  }

  public async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid?: number | bigint }> {
    const formatted = this.formatSql(sql);
    const result = await this.pool.query(formatted, params);
    return {
      changes: result.rowCount || 0
    };
  }

  public async transaction<T>(callback: (tx: IDatabase) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN;');
      const txAdapter: IDatabase = {
        query: async <K = any>(sql: string, params: any[] = []) => {
          const formatted = this.formatSql(sql);
          const res = await client.query(formatted, params);
          return res.rows as K[];
        },
        execute: async (sql: string, params: any[] = []) => {
          const formatted = this.formatSql(sql);
          const res = await client.query(formatted, params);
          return { changes: res.rowCount || 0 };
        },
        transaction: async () => {
          throw new Error('Transações aninhadas não são suportadas');
        },
        close: async () => {}
      };

      const result = await callback(txAdapter);
      await client.query('COMMIT;');
      return result;
    } catch (err) {
      await client.query('ROLLBACK;');
      throw err;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
