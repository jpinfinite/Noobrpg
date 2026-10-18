import { randomUUID, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { AccountRepository, SessionRepository } from '../repositories/accountRepository.js';
import { AccountRecord } from '../db/index.js';

export interface PublicAccount {
  id: string;
  username: string;
  createdAt: string;
}

export class AuthService {
  // Limite simples de tentativas em memória para mitigar força bruta (5 tentativas a cada 60s)
  private loginAttempts: Map<string, { count: number; firstAttempt: number }> = new Map();

  constructor(
    private accountRepo: AccountRepository,
    private sessionRepo: SessionRepository
  ) {}

  private checkRateLimit(key: string): void {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minuto
    const maxAttempts = 5;

    const entry = this.loginAttempts.get(key);
    if (!entry) {
      this.loginAttempts.set(key, { count: 1, firstAttempt: now });
      return;
    }

    if (now - entry.firstAttempt > windowMs) {
      this.loginAttempts.set(key, { count: 1, firstAttempt: now });
      return;
    }

    if (entry.count >= maxAttempts) {
      throw new Error('Muitas tentativas de login consecutivas. Aguarde um minuto.');
    }

    entry.count++;
  }

  private resetRateLimit(key: string): void {
    this.loginAttempts.delete(key);
  }

  public validateCredentials(username: string, password: string): void {
    if (!username || typeof username !== 'string') {
      throw new Error('Nome de usuário é obrigatório.');
    }
    const cleanUsername = username.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      throw new Error('Nome de usuário deve ter entre 3 e 20 caracteres (apenas letras, números e sublinhados).');
    }

    if (!password || typeof password !== 'string') {
      throw new Error('Senha é obrigatória.');
    }
    if (password.length < 8 || password.length > 128) {
      throw new Error('A senha deve ter entre 8 e 128 caracteres.');
    }
  }

  public async register(username: string, password: string): Promise<{ account: PublicAccount; sessionToken: string }> {
    this.validateCredentials(username, password);
    const cleanUsername = username.trim();

    const existing = await this.accountRepo.findByUsername(cleanUsername);
    if (existing) {
      throw new Error('Nome de usuário já está em uso.');
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    });

    const accountId = randomUUID();
    const created = await this.accountRepo.create({
      id: accountId,
      username: cleanUsername,
      password_hash: passwordHash
    });

    // Cria sessão inicial de 7 dias
    const sessionToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await this.sessionRepo.create({
      token: sessionToken,
      account_id: created.id,
      expires_at: expiresAt
    });

    return {
      account: {
        id: created.id,
        username: created.username,
        createdAt: created.created_at
      },
      sessionToken
    };
  }

  public async login(
    username: string,
    password: string,
    clientIp: string = 'unknown'
  ): Promise<{ account: PublicAccount; sessionToken: string }> {
    this.checkRateLimit(`${clientIp}_${username}`);

    this.validateCredentials(username, password);
    const cleanUsername = username.trim();

    const account = await this.accountRepo.findByUsername(cleanUsername);
    if (!account) {
      // Resposta genérica para não revelar a existência da conta
      throw new Error('Credenciais inválidas.');
    }

    const isValid = await argon2.verify(account.password_hash, password);
    if (!isValid) {
      throw new Error('Credenciais inválidas.');
    }

    // Sucesso no login: reseta rate limit
    this.resetRateLimit(`${clientIp}_${username}`);

    const sessionToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await this.sessionRepo.create({
      token: sessionToken,
      account_id: account.id,
      expires_at: expiresAt
    });

    return {
      account: {
        id: account.id,
        username: account.username,
        createdAt: account.created_at
      },
      sessionToken
    };
  }

  public async validateSession(sessionToken: string): Promise<PublicAccount | null> {
    if (!sessionToken) return null;

    const session = await this.sessionRepo.findByToken(sessionToken);
    if (!session) return null;

    const account = await this.accountRepo.findById(session.account_id);
    if (!account) return null;

    return {
      id: account.id,
      username: account.username,
      createdAt: account.created_at
    };
  }

  public async logout(sessionToken: string): Promise<void> {
    if (sessionToken) {
      await this.sessionRepo.deleteByToken(sessionToken);
    }
  }
}
