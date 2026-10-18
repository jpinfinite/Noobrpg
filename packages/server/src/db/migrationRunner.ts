import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IDatabase } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(db: IDatabase): Promise<void> {
  // 1. Cria tabela de controle de migrações se não existir
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Busca migrações já aplicadas
  const appliedRows = await db.query<{ version: string }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC;'
  );
  const appliedVersions = new Set(appliedRows.map(r => r.version));

  // 3. Lê arquivos da pasta migrations/
  // Suporta tanto caminhos em src/ quanto em dist/
  let migrationsDir = path.resolve(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    migrationsDir = path.resolve(__dirname, '../src/db/migrations');
  }
  if (!fs.existsSync(migrationsDir)) {
    migrationsDir = path.resolve(process.cwd(), 'packages/server/src/db/migrations');
  }

  if (!fs.existsSync(migrationsDir)) {
    console.warn(`[Migrations] Diretório não encontrado: ${migrationsDir}`);
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (!appliedVersions.has(file)) {
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');

      console.log(`[Migrations] Aplicando migração: ${file}`);

      await db.transaction(async tx => {
        // Divide por ponto e vírgula para execução segura
        const statements = sqlContent
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0);

        for (const statement of statements) {
          await tx.execute(statement);
        }

        await tx.execute('INSERT INTO schema_migrations (version) VALUES (?);', [file]);
      });

      console.log(`[Migrations] Migração ${file} concluída com sucesso.`);
    }
  }
}
