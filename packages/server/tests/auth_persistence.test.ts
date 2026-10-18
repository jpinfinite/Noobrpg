import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SqliteDatabase } from '../src/db/sqlite.js';
import { runMigrations } from '../src/db/migrationRunner.js';
import { AccountRepository, SessionRepository } from '../src/repositories/accountRepository.js';
import { CharacterRepository } from '../src/repositories/characterRepository.js';
import { InventoryRepository } from '../src/repositories/inventoryRepository.js';
import { EquipmentRepository } from '../src/repositories/equipmentRepository.js';
import { GoldLedgerRepository } from '../src/repositories/goldLedgerRepository.js';
import { AuthService } from '../src/services/authService.js';
import { CharacterService } from '../src/services/characterService.js';
import { CharacterClass } from '@noobrpg/shared';

describe('NoobRPG Fase 4 - Persistência, Autenticação e Contas', () => {
  let dbFile: string;
  let db: SqliteDatabase;
  let accountRepo: AccountRepository;
  let sessionRepo: SessionRepository;
  let charRepo: CharacterRepository;
  let invRepo: InventoryRepository;
  let eqRepo: EquipmentRepository;
  let goldRepo: GoldLedgerRepository;
  let authService: AuthService;
  let charService: CharacterService;

  beforeEach(async () => {
    // Cria banco SQLite de teste isolado em arquivo temporário
    dbFile = path.resolve(process.cwd(), `test_db_${Date.now()}_${Math.random().toString(36).substring(7)}.sqlite`);
    db = new SqliteDatabase(dbFile);
    await runMigrations(db);

    accountRepo = new AccountRepository(db);
    sessionRepo = new SessionRepository(db);
    charRepo = new CharacterRepository(db);
    invRepo = new InventoryRepository(db);
    eqRepo = new EquipmentRepository(db);
    goldRepo = new GoldLedgerRepository(db);

    authService = new AuthService(accountRepo, sessionRepo);
    charService = new CharacterService(db, charRepo, invRepo, eqRepo, goldRepo);
  });

  afterEach(async () => {
    await db.close();
    if (fs.existsSync(dbFile)) {
      try {
        fs.unlinkSync(dbFile);
      } catch (e) {
        // Ignora se o arquivo estiver bloqueado temporariamente
      }
    }
  });

  it('1. Migrações em banco vazio e em atualização de esquema', async () => {
    // Verifica se as tabelas foram criadas
    const tables = await db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC;"
    );
    const tableNames = tables.map(t => t.name);
    assert.ok(tableNames.includes('schema_migrations'));
    assert.ok(tableNames.includes('accounts'));
    assert.ok(tableNames.includes('account_sessions'));
    assert.ok(tableNames.includes('characters'));
    assert.ok(tableNames.includes('character_inventory'));
    assert.ok(tableNames.includes('character_equipment'));
    assert.ok(tableNames.includes('gold_transactions'));

    // Roda migrações novamente para testar idempotência
    await runMigrations(db);
    const migrations = await db.query('SELECT * FROM schema_migrations;');
    assert.equal(migrations.length, 6);
  });

  it('2. Registro de conta com Argon2id e bloqueio de nomes duplicados', async () => {
    const { account, sessionToken } = await authService.register('hero_player', 'SenhaSegura123!');
    assert.equal(account.username, 'hero_player');
    assert.ok(sessionToken && sessionToken.length >= 32);

    // Confere que a senha está hasheada no banco e NÃO é plaintext
    const rawAccount = await accountRepo.findByUsername('hero_player');
    assert.ok(rawAccount);
    assert.notEqual(rawAccount.password_hash, 'SenhaSegura123!');
    assert.ok(rawAccount.password_hash.startsWith('$argon2id$'));

    // Tentativa de registrar com mesmo username deve falhar
    await assert.rejects(
      () => authService.register('hero_player', 'OutraSenha123!'),
      /Nome de usuário já está em uso/
    );
  });

  it('3. Senhas incorretas e entradas inválidas', async () => {
    await authService.register('valid_user', 'SenhaForte123!');

    // Senha errada
    await assert.rejects(
      () => authService.login('valid_user', 'SenhaErrada!'),
      /Credenciais inválidas/
    );

    // Usuário inexistente retorna o mesmo erro genérico (sem enumeração de contas)
    await assert.rejects(
      () => authService.login('non_existing_user', 'SenhaQualquer123!'),
      /Credenciais inválidas/
    );

    // Senha muito curta
    await assert.rejects(
      () => authService.register('short_pwd_user', '12345'),
      /A senha deve ter entre 8 e 128 caracteres/
    );

    // Username com caracteres inválidos
    await assert.rejects(
      () => authService.register('bad@user!', 'SenhaSegura123!'),
      /Nome de usuário deve ter entre 3 e 20 caracteres/
    );
  });

  it('4. Login, validação de sessão e logout', async () => {
    await authService.register('login_user', 'SenhaForte123!');
    const { sessionToken } = await authService.login('login_user', 'SenhaForte123!');

    // Valida sessão ativa
    const current = await authService.validateSession(sessionToken);
    assert.ok(current);
    assert.equal(current.username, 'login_user');

    // Executa logout
    await authService.logout(sessionToken);

    // Sessão após logout deve ser nula
    const afterLogout = await authService.validateSession(sessionToken);
    assert.equal(afterLogout, null);
  });

  it('5. Criação e seleção de personagem com atributos e equipamentos canônicos', async () => {
    const { account } = await authService.register('warrior_acc', 'SenhaGuerreira123!');

    const player = await charService.createCharacter(account.id, 'SirGalahad', CharacterClass.WARRIOR);
    assert.equal(player.name, 'SirGalahad');
    assert.equal(player.characterClass, CharacterClass.WARRIOR);
    assert.equal(player.level, 1);
    assert.equal(player.currentXp, 0);
    assert.equal(player.gold, 100);
    assert.equal(player.equipped.weapon, 'sword_iron');
    assert.equal(player.equipped.armor, 'armor_leather');

    // Inventário de 24 posições
    assert.equal(player.inventory.length, 24);
    assert.ok(player.inventory[0]); // Poção
    assert.equal(player.inventory[0]?.itemId, 'potion_hp_minor');

    // Consulta de detalhes
    const loaded = await charService.getCharacter(account.id, player.id);
    assert.equal(loaded.id, player.id);
    assert.equal(loaded.name, 'SirGalahad');
  });

  it('6. Acesso negado a personagens de outras contas (Zero Client Trust)', async () => {
    const acc1 = await authService.register('account_one', 'SenhaConta1!');
    const acc2 = await authService.register('account_two', 'SenhaConta2!');

    const char1 = await charService.createCharacter(acc1.account.id, 'CharFromAcc1', CharacterClass.RANGER);

    // Conta 2 tentando acessar personagem da Conta 1
    await assert.rejects(
      () => charService.getCharacter(acc2.account.id, char1.id),
      /não tem permissão para acessá-lo/
    );

    // Conta 2 tentando salvar/modificar personagem da Conta 1
    await assert.rejects(
      () => charService.saveCharacter(acc2.account.id, char1.id, { hp: 50 }),
      /não tem permissão para salvá-lo/
    );
  });

  it('7. Persistência de XP, Level-Up server-authoritative, Gold e Inventário', async () => {
    const { account } = await authService.register('persisting_acc', 'SenhaPersistente123!');
    const player = await charService.createCharacter(account.id, 'MageMerlin', CharacterClass.MAGE);

    // Simula ganho de XP (550 XP faz subir do nível 1 para o nível 2, conforme fórmula canônica)
    // Simula ganho de 50 Gold e atualização de slots de inventário
    const updated = await charService.saveCharacter(account.id, player.id, {
      xpGained: 550,
      goldChange: { amount: 50, source: 'quest_reward' },
      position: { x: 220, y: 190 },
      hp: 60,
      inventory: [
        { slotIndex: 0, itemId: 'potion_hp_minor', quantity: 5 },
        { slotIndex: 1, itemId: 'wood_log', quantity: 20 },
        { slotIndex: 2, itemId: 'iron_ore', quantity: 10 }
      ],
      equipped: { weapon: 'pickaxe_copper', armor: 'armor_leather', accessory: 'ring_vitality' }
    });

    assert.equal(updated.currentXp, 550);
    assert.equal(updated.level, 2); // Nível recalculado pelo servidor!
    assert.equal(updated.gold, 150);
    assert.equal(updated.position.x, 220);
    assert.equal(updated.position.y, 190);
    assert.equal(updated.equipped.accessory, 'ring_vitality');
    assert.equal(updated.inventory[2]?.itemId, 'iron_ore');
    assert.equal(updated.inventory[2]?.quantity, 10);

    // Auditoria de transações financeiras
    const txs = await goldRepo.getTransactions(player.id);
    assert.equal(txs.length, 2); // starter_funds + quest_reward
    const questTx = txs.find(t => t.source === 'quest_reward');
    assert.ok(questTx);
    assert.equal(questTx.amount, 50);
    assert.equal(questTx.balance_after, 150);

    const starterTx = txs.find(t => t.source === 'starter_funds');
    assert.ok(starterTx);
    assert.equal(starterTx.amount, 100);
  });

  it('8. Falhas de banco e rollback de transações atômicas', async () => {
    const { account } = await authService.register('rollback_acc', 'SenhaRollback123!');
    const player = await charService.createCharacter(account.id, 'DruidPan', CharacterClass.DRUID);

    // Tentativa de gastar mais Gold do que possui (-500 com saldo de 100)
    await assert.rejects(
      () =>
        charService.saveCharacter(account.id, player.id, {
          goldChange: { amount: -500, source: 'illegal_purchase' },
          inventory: [{ slotIndex: 0, itemId: 'sword_iron', quantity: 1 }]
        }),
      /Saldo insuficiente de Gold/
    );

    // Confere que o inventário e o saldo NÃO foram alterados (Rollback funcionou)
    const afterRollback = await charService.getCharacter(account.id, player.id);
    assert.equal(afterRollback.gold, 100);
    assert.equal(afterRollback.inventory[0]?.itemId, 'potion_hp_minor');
  });

  it('9. Reentrada no jogo após reiniciar o banco/servidor', async () => {
    const { account } = await authService.register('restart_acc', 'SenhaRestart123!');
    const player = await charService.createCharacter(account.id, 'ArcherRobin', CharacterClass.RANGER);

    await charService.saveCharacter(account.id, player.id, {
      xpGained: 200,
      goldChange: { amount: 35, source: 'loot_chest' },
      position: { x: 300, y: 400 }
    });

    // Simula encerramento e reinicialização completa do banco
    await db.close();

    const newDb = new SqliteDatabase(dbFile);
    const newCharRepo = new CharacterRepository(newDb);
    const newInvRepo = new InventoryRepository(newDb);
    const newEqRepo = new EquipmentRepository(newDb);
    const newGoldRepo = new GoldLedgerRepository(newDb);
    const newCharService = new CharacterService(newDb, newCharRepo, newInvRepo, newEqRepo, newGoldRepo);

    const reloaded = await newCharService.getCharacter(account.id, player.id);
    assert.equal(reloaded.name, 'ArcherRobin');
    assert.equal(reloaded.currentXp, 200);
    assert.equal(reloaded.gold, 135);
    assert.equal(reloaded.position.x, 300);
    assert.equal(reloaded.position.y, 400);

    await newDb.close();
  });

  it('10. Cookies HttpOnly e controles de sessão via rotas HTTP Express', async () => {
    const { createApp } = await import('../src/app.js');
    const app = createApp(db);

    const server = app.listen(0);
    const address = server.address() as any;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      // Tenta acessar /api/auth/me sem cookie
      const unauthRes = await fetch(`${baseUrl}/api/auth/me`);
      assert.equal(unauthRes.status, 401);

      // Registra uma conta via HTTP
      const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'web_adventurer', password: 'SenhaSuperSegura123!' })
      });
      assert.equal(registerRes.status, 201);

      // Confere cabeçalho Set-Cookie com HttpOnly
      const setCookie = registerRes.headers.get('set-cookie');
      assert.ok(setCookie);
      assert.ok(setCookie.includes('session_token='));
      assert.ok(setCookie.toLowerCase().includes('httponly'));

      // Extrai cookie para subsequentes requisições autenticadas
      const cookieValue = setCookie.split(';')[0];

      // Acessa /api/auth/me com cookie
      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Cookie: cookieValue }
      });
      assert.equal(meRes.status, 200);
      const meData = await meRes.json();
      assert.equal(meData.account.username, 'web_adventurer');

      // Cria personagem via HTTP
      const createCharRes = await fetch(`${baseUrl}/api/characters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieValue
        },
        body: JSON.stringify({ name: 'WebWarrior', characterClass: CharacterClass.WARRIOR })
      });
      assert.equal(createCharRes.status, 201);
      const charData = await createCharRes.json();
      assert.equal(charData.player.name, 'WebWarrior');
      assert.equal(charData.player.characterClass, CharacterClass.WARRIOR);

      // Lista personagens via HTTP
      const listRes = await fetch(`${baseUrl}/api/characters`, {
        headers: { Cookie: cookieValue }
      });
      assert.equal(listRes.status, 200);
      const listData = await listRes.json();
      assert.equal(listData.characters.length, 1);
      assert.equal(listData.characters[0].name, 'WebWarrior');
    } finally {
      server.close();
    }
  });
});

