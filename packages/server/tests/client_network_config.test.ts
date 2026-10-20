import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isLocalEnvironment,
  normalizeWsUrl,
  resolveWsUrl,
  resolveApiUrl,
  getNetworkConfig
} from '../../client/src/net/networkConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

describe('NoobRPG — Configuração de Rede Centralizada e Resolução de Endpoints (Missão 31C)', () => {

  test('1. Configuração padrão de desenvolvimento local', () => {
    const loc = { hostname: 'localhost', protocol: 'http:' };
    assert.strictEqual(isLocalEnvironment(loc.hostname), true);

    const wsUrl = resolveWsUrl(undefined, undefined, loc);
    assert.strictEqual(wsUrl, 'ws://localhost:4000/ws');

    const apiUrl = resolveApiUrl(undefined, loc);
    assert.strictEqual(apiUrl, '/api');

    const config = getNetworkConfig(undefined, undefined, undefined, loc);
    assert.strictEqual(config.isLocalDevelopment, true);
    assert.strictEqual(config.isConfigured, true);
    assert.strictEqual(config.wsUrl, 'ws://localhost:4000/ws');
    assert.strictEqual(config.apiUrl, '/api');
    assert.strictEqual(config.warning, undefined);
  });

  test('2. Detecção de 127.0.0.1 como ambiente local', () => {
    const loc = { hostname: '127.0.0.1', protocol: 'http:' };
    assert.strictEqual(isLocalEnvironment(loc.hostname), true);

    const wsUrl = resolveWsUrl(undefined, undefined, loc);
    assert.strictEqual(wsUrl, 'ws://127.0.0.1:4000/ws');
  });

  test('3. Configuração válida de produção com variáveis explícitas', () => {
    const loc = { hostname: 'noobrpg.pages.dev', protocol: 'https:' };
    assert.strictEqual(isLocalEnvironment(loc.hostname), false);

    const wsUrl = resolveWsUrl(undefined, 'wss://tunnel-backend.noobrpg.com/ws', loc);
    assert.strictEqual(wsUrl, 'wss://tunnel-backend.noobrpg.com/ws');

    const apiUrl = resolveApiUrl('https://tunnel-backend.noobrpg.com/api', loc);
    assert.strictEqual(apiUrl, 'https://tunnel-backend.noobrpg.com/api');

    const config = getNetworkConfig(undefined, 'wss://tunnel-backend.noobrpg.com/ws', 'https://tunnel-backend.noobrpg.com/api', loc);
    assert.strictEqual(config.isLocalDevelopment, false);
    assert.strictEqual(config.isConfigured, true);
    assert.strictEqual(config.wsUrl, 'wss://tunnel-backend.noobrpg.com/ws');
    assert.strictEqual(config.apiUrl, 'https://tunnel-backend.noobrpg.com/api');
    assert.strictEqual(config.warning, undefined);
  });

  test('4. Ausência de endpoint WebSocket em produção resulta em null e aviso explicativo (sem URLs fantasmas)', () => {
    const loc = { hostname: 'noobrpg.pages.dev', protocol: 'https:' };
    assert.strictEqual(isLocalEnvironment(loc.hostname), false);

    // Sem VITE_WS_URL definida
    const wsUrl = resolveWsUrl(undefined, '', loc);
    assert.strictEqual(wsUrl, null, 'Em produção sem VITE_WS_URL definida, wsUrl deve ser null para evitar conexões silenciosas');

    const config = getNetworkConfig(undefined, '', undefined, loc);
    assert.strictEqual(config.isConfigured, false);
    assert.strictEqual(config.wsUrl, null);
    assert.ok(config.warning?.includes('VITE_WS_URL ausente'), 'Deve conter aviso explicando que VITE_WS_URL está ausente');
  });

  test('5. Garantia compulsória de WSS quando o protocolo da página for HTTPS (Prevenção de Mixed Content)', () => {
    // Caso 1: Usuário informou ws:// mas a página está em https:
    const ws1 = normalizeWsUrl('ws://meu-host.com/ws', 'https:');
    assert.strictEqual(ws1, 'wss://meu-host.com/ws');

    // Caso 2: URL sem protocolo em página https:
    const ws2 = normalizeWsUrl('meu-host.com/ws', 'https:');
    assert.strictEqual(ws2, 'wss://meu-host.com/ws');

    // Caso 3: URL em dev http: mantém ws://
    const ws3 = normalizeWsUrl('ws://localhost:4000/ws', 'http:');
    assert.strictEqual(ws3, 'ws://localhost:4000/ws');
  });

  test('6. Rejeição e validação defensiva de URLs inválidas ou vazias', () => {
    assert.throws(() => normalizeWsUrl(''), /URL de WebSocket vazia/);
    assert.throws(() => normalizeWsUrl('   '), /URL de WebSocket vazia/);
    assert.throws(() => normalizeWsUrl(null as any), /URL de WebSocket inválida/);
  });

  test('7. Ausência total de referências a "trycloudflare.com" no código-fonte do cliente', () => {
    const clientSrcDir = path.resolve(rootDir, 'packages/client/src');
    const redirectsFile = path.resolve(rootDir, 'packages/client/public/_redirects');

    function searchDir(dir: string): string[] {
      let results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(searchDir(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.html') || entry.name.endsWith('.css'))) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.toLowerCase().includes('trycloudflare.com')) {
            results.push(fullPath);
          }
        }
      }
      return results;
    }

    const matchesInSrc = searchDir(clientSrcDir);
    assert.strictEqual(matchesInSrc.length, 0, `Nenhum arquivo em packages/client/src pode conter "trycloudflare.com": ${matchesInSrc.join(', ')}`);

    if (fs.existsSync(redirectsFile)) {
      const redirectsContent = fs.readFileSync(redirectsFile, 'utf-8');
      assert.strictEqual(
        redirectsContent.toLowerCase().includes('len-bit-election-notebooks'),
        false,
        'O arquivo _redirects não pode conter a URL do túnel temporário morto'
      );
    }
  });

  test('8. Arquivo .env.example do cliente existe e não contém segredos ou credenciais', () => {
    const envExamplePath = path.resolve(rootDir, 'packages/client/.env.example');
    assert.strictEqual(fs.existsSync(envExamplePath), true, 'packages/client/.env.example deve existir');

    const content = fs.readFileSync(envExamplePath, 'utf-8');
    assert.ok(content.includes('VITE_API_URL'), 'Deve documentar VITE_API_URL');
    assert.ok(content.includes('VITE_WS_URL'), 'Deve documentar VITE_WS_URL');
    assert.ok(!content.includes('secret') && !content.includes('password') && !content.includes('token=ghp'), 'Não pode conter segredos');
  });

  test('9. Injeção dinâmica de endpoint para testes rápidos via query parameter ?server= sem rebuild (Missão 31D)', () => {
    const loc = { 
      hostname: 'noobrpg.pages.dev', 
      protocol: 'https:', 
      search: '?server=quick-tunnel-123.trycloudflare.com' 
    };
    assert.strictEqual(isLocalEnvironment(loc.hostname), false);

    const wsUrl = resolveWsUrl(undefined, undefined, loc);
    assert.strictEqual(wsUrl, 'wss://quick-tunnel-123.trycloudflare.com/ws');

    const apiUrl = resolveApiUrl(undefined, loc);
    assert.strictEqual(apiUrl, 'https://quick-tunnel-123.trycloudflare.com/api');

    const config = getNetworkConfig(undefined, undefined, undefined, loc);
    assert.strictEqual(config.isConfigured, true);
    assert.strictEqual(config.wsUrl, 'wss://quick-tunnel-123.trycloudflare.com/ws');
    assert.strictEqual(config.apiUrl, 'https://quick-tunnel-123.trycloudflare.com/api');
    assert.strictEqual(config.warning, undefined);
  });

  test('10. Injeção dinâmica granular via query parameters ?ws= e ?api= (Missão 31D)', () => {
    const loc = { 
      hostname: 'noobrpg.pages.dev', 
      protocol: 'https:', 
      search: '?ws=wss://custom-ws.example.com/ws&api=https://custom-api.example.com/api' 
    };

    const wsUrl = resolveWsUrl(undefined, undefined, loc);
    assert.strictEqual(wsUrl, 'wss://custom-ws.example.com/ws');

    const apiUrl = resolveApiUrl(undefined, loc);
    assert.strictEqual(apiUrl, 'https://custom-api.example.com/api');
  });

  test('11. Sanitização do Backend: Ausência de tolerâncias genéricas a trycloudflare.com em CORS e WebSocket (Missão 31D)', () => {
    const appTsPath = path.resolve(rootDir, 'packages/server/src/app.ts');
    const wsServerTsPath = path.resolve(rootDir, 'packages/server/src/multiplayer/WebSocketServer.ts');

    const appContent = fs.readFileSync(appTsPath, 'utf-8');
    assert.strictEqual(
      appContent.includes("origin.includes('trycloudflare.com')"),
      false,
      'app.ts não deve conter tolerância arbitrária a trycloudflare.com no CORS'
    );

    const wsContent = fs.readFileSync(wsServerTsPath, 'utf-8');
    assert.strictEqual(
      wsContent.includes("lowerOrigin.includes('trycloudflare.com')"),
      false,
      'WebSocketServer.ts não deve conter tolerância arbitrária a trycloudflare.com no Anti-CSWSH'
    );
  });

});

