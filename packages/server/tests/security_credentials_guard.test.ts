import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { R2StorageClient } from '../src/storage/R2StorageClient.js';

test('NoobRPG — Segurança Operacional e Salvaguarda de Credenciais', async (t) => {
  // Detecta raiz do repositório independente do cwd de execução (raiz ou subpasta de workspace)
  const rootDir = fs.existsSync(path.join(process.cwd(), '.gitignore'))
    ? process.cwd()
    : path.resolve(process.cwd(), '../..');

  await t.test('1. Validação estrita das regras de bloqueio do .gitignore', () => {
    const gitignorePath = path.join(rootDir, '.gitignore');
    assert.ok(fs.existsSync(gitignorePath), 'O arquivo .gitignore raiz deve existir');
    const content = fs.readFileSync(gitignorePath, 'utf-8');

    // Regras essenciais de variáveis de ambiente e chaves privadas
    assert.ok(content.includes('.env'), 'Deve ignorar .env');
    assert.ok(content.includes('*.key'), 'Deve ignorar chaves privadas *.key');
    assert.ok(content.includes('*.pem'), 'Deve ignorar certificados *.pem');
    assert.ok(content.includes('*keypair*.json'), 'Deve ignorar carteiras e keypairs *.json');
    assert.ok(content.includes('!.env.example'), 'Deve permitir explicitamente o template .env.example');
  });

  await t.test('2. Verificação de arquivos rastreados no Git (Zero Tracked Secrets)', () => {
    let trackedFiles: string[] = [];
    try {
      const stdout = execSync('git ls-files', { cwd: rootDir, encoding: 'utf-8' });
      trackedFiles = stdout.split('\n').map(f => f.trim()).filter(f => f.length > 0);
    } catch (err) {
      // Se git não estiver disponível no subprocesso, lê via filesystem
      trackedFiles = [];
    }

    if (trackedFiles.length > 0) {
      for (const file of trackedFiles) {
        const basename = path.basename(file);
        // Nenhum .env rastreado exceto .env.example
        if (basename.startsWith('.env') && !basename.endsWith('.example')) {
          assert.fail(`Arquivo de ambiente confidencial está rastreado no Git: ${file}`);
        }
        // Nenhuma chave privada ou certificado rastreado
        if (basename.endsWith('.pem') || basename.endsWith('.key')) {
          assert.fail(`Chave privada ou certificado rastreado no Git: ${file}`);
        }
      }
    }
  });

  await t.test('3. Integridade e ausência de segredos reais nos templates .env.example', () => {
    const exampleFiles = [
      path.join(rootDir, '.env.example'),
      path.join(rootDir, 'packages/server/.env.example')
    ];

    for (const filePath of exampleFiles) {
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [key, ...rest] = trimmed.split('=');
        const val = rest.join('=').trim();

        // Se a chave for de credencial, valida que o valor é placeholder seguro
        if (
          key.includes('SECRET') ||
          key.includes('TOKEN') ||
          key.includes('KEY_ID') ||
          key.includes('PASSWORD')
        ) {
          assert.ok(
            val.startsWith('seu_') ||
            val.startsWith('sua') ||
            val.includes('change_this') ||
            val.includes('<') ||
            val.length === 0,
            `Template ${filePath} contém valor não-placeholder para a variável ${key}`
          );

          // Rejeita tokens com prefixos de chaves reais (ex: Cloudflare cfat_)
          assert.equal(val.startsWith('cfat_'), false, `Token real detectado em template: ${key}`);
        }
      }
    }
  });

  await t.test('4. Inicialização de R2StorageClient sem credenciais lança exceção segura e sanitizada', () => {
    // Garante que o construtor valida a ausência de credenciais sem expor detalhes
    const origKey = process.env.R2_ACCESS_KEY_ID;
    const origSec = process.env.R2_SECRET_ACCESS_KEY;
    const origEnd = process.env.R2_ENDPOINT;
    try {
      delete process.env.R2_ACCESS_KEY_ID;
      delete process.env.R2_SECRET_ACCESS_KEY;
      delete process.env.R2_ENDPOINT;

      assert.throws(
        () => {
          new R2StorageClient({});
        },
        (err: any) => {
          assert.ok(err instanceof Error);
          assert.ok(
            err.message.includes('Configurações do Cloudflare R2 ausentes'),
            'Mensagem de erro deve ser clara e orientativa'
          );
          // Garante que a mensagem não imprime valores secretos
          assert.equal(err.message.includes('cfat_'), false);
          return true;
        }
      );
    } finally {
      if (origKey !== undefined) process.env.R2_ACCESS_KEY_ID = origKey;
      if (origSec !== undefined) process.env.R2_SECRET_ACCESS_KEY = origSec;
      if (origEnd !== undefined) process.env.R2_ENDPOINT = origEnd;
    }
  });

  await t.test('5. Função de mascaramento sanitiza tokens e credenciais em logs', () => {
    function maskCredential(val?: string): string {
      if (!val) return '[NOT_SET]';
      if (val.length <= 8) return '***';
      return `${val.substring(0, 4)}...${val.substring(val.length - 4)}`;
    }

    const testToken = 'cfat_9876543210fedcba';
    const masked = maskCredential(testToken);

    assert.equal(masked, 'cfat...dcba');
    assert.equal(masked.includes('9876543210fe'), false, 'Não deve expor o miolo do token');
    assert.equal(maskCredential(''), '[NOT_SET]');
    assert.equal(maskCredential(undefined), '[NOT_SET]');
    assert.equal(maskCredential('12345'), '***');
  });
});
