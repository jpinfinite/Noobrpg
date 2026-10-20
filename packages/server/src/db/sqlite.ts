import { DatabaseSync } from 'node:sqlite';
import { IDatabase } from './types.js';

export class SqliteDatabase implements IDatabase {
  private db: DatabaseSync;

  constructor(filePath: string = ':memory:') {
    this.db = new DatabaseSync(filePath);
    // Ativa suporte a chaves estrangeiras no SQLite
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  public async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid?: number | bigint }> {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return {
      changes: Number(result.changes),
      lastInsertRowid: result.lastInsertRowid
    };
  }

  private transactionQueue: Promise<void> = Promise.resolve();

  public async transaction<T>(callback: (tx: IDatabase) => Promise<T>): Promise<T> {
    const executeTx = async () => {
      this.db.exec('BEGIN TRANSACTION;');
      try {
        const result = await callback(this);
        this.db.exec('COMMIT;');
        return result;
      } catch (err) {
        try {
          this.db.exec('ROLLBACK;');
        } catch (_) {
          // Ignora erro se já abortado
        }
        throw err;
      }
    };

    // Serializa a execução de transações na conexão SQLite de escrita única
    let releaseQueue: () => void;
    const previousQueue = this.transactionQueue;
    this.transactionQueue = new Promise<void>(resolve => {
      releaseQueue = resolve;
    });

    await previousQueue;
    try {
      return await executeTx();
    } finally {
      releaseQueue!();
    }
  }

  private isOpen: boolean = true;

  public async close(): Promise<void> {
    if (this.isOpen) {
      try {
        this.db.close();
      } catch (e) {
        // Ignora erro se já fechado
      }
      this.isOpen = false;
    }
  }
}
