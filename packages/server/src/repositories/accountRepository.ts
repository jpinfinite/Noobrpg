import { IDatabase, AccountRecord, SessionRecord } from '../db/index.js';

export class AccountRepository {
  constructor(private db: IDatabase) {}

  public async create(account: { id: string; username: string; password_hash: string }): Promise<AccountRecord> {
    await this.db.execute(
      'INSERT INTO accounts (id, username, password_hash) VALUES (?, ?, ?);',
      [account.id, account.username, account.password_hash]
    );

    const rows = await this.db.query<AccountRecord>(
      'SELECT id, username, password_hash, created_at, updated_at FROM accounts WHERE id = ?;',
      [account.id]
    );
    return rows[0];
  }

  public async findByUsername(username: string): Promise<AccountRecord | null> {
    const rows = await this.db.query<AccountRecord>(
      'SELECT id, username, password_hash, created_at, updated_at FROM accounts WHERE username = ?;',
      [username]
    );
    return rows[0] || null;
  }

  public async findById(id: string): Promise<AccountRecord | null> {
    const rows = await this.db.query<AccountRecord>(
      'SELECT id, username, password_hash, created_at, updated_at FROM accounts WHERE id = ?;',
      [id]
    );
    return rows[0] || null;
  }
}

export class SessionRepository {
  constructor(private db: IDatabase) {}

  public async create(session: { token: string; account_id: string; expires_at: string }): Promise<SessionRecord> {
    await this.db.execute(
      'INSERT INTO account_sessions (token, account_id, expires_at) VALUES (?, ?, ?);',
      [session.token, session.account_id, session.expires_at]
    );

    const rows = await this.db.query<SessionRecord>(
      'SELECT token, account_id, expires_at, created_at FROM account_sessions WHERE token = ?;',
      [session.token]
    );
    return rows[0];
  }

  public async findByToken(token: string): Promise<SessionRecord | null> {
    const rows = await this.db.query<SessionRecord>(
      'SELECT token, account_id, expires_at, created_at FROM account_sessions WHERE token = ?;',
      [token]
    );
    if (!rows[0]) return null;

    // Checa expiração
    const now = new Date();
    const expiresAt = new Date(rows[0].expires_at);
    if (expiresAt <= now) {
      await this.deleteByToken(token);
      return null;
    }

    return rows[0];
  }

  public async deleteByToken(token: string): Promise<void> {
    await this.db.execute('DELETE FROM account_sessions WHERE token = ?;', [token]);
  }
}
