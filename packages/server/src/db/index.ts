import path from 'node:path';
import { IDatabase } from './types.js';
import { SqliteDatabase } from './sqlite.js';
import { PostgresDatabase } from './postgres.js';
import { runMigrations } from './migrationRunner.js';

let dbInstance: IDatabase | null = null;

export interface DatabaseConfig {
  type?: 'sqlite' | 'postgres';
  sqlitePath?: string;
  postgresUrl?: string;
}

export async function initDatabase(config?: DatabaseConfig): Promise<IDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const dbType = config?.type || process.env.DATABASE_TYPE || 'sqlite';

  if (dbType === 'postgres') {
    const connStr = config?.postgresUrl || process.env.DATABASE_URL;
    if (!connStr) {
      throw new Error('DATABASE_URL é obrigatória quando DATABASE_TYPE=postgres');
    }
    console.log('[DB] Conectando ao PostgreSQL...');
    dbInstance = new PostgresDatabase(connStr);
  } else {
    const sqlitePath = config?.sqlitePath || process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), 'noobrpg.sqlite');
    console.log(`[DB] Usando SQLite em: ${sqlitePath}`);
    dbInstance = new SqliteDatabase(sqlitePath);
  }

  // Executa migrações automáticas
  await runMigrations(dbInstance);

  return dbInstance;
}

export function getDatabase(): IDatabase {
  if (!dbInstance) {
    throw new Error('Banco de dados ainda não foi inicializado. Chame initDatabase() primeiro.');
  }
  return dbInstance;
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

export * from './types.js';
