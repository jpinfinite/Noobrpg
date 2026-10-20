import { IDatabase, NoobCoinRewardRecord, NoobCoinRewardStatus, NoobCoinDailyLimitRecord, NoobCoinConfigRecord } from '../db/index.js';
import { randomUUID } from 'node:crypto';

export interface CreateRewardParams {
  characterId: string;
  accountId: string;
  rewardType: string;
  sourceEvent: string;
  amountRaw: number; // Inteiro seguro em unidades mínimas (6 decimais: 1 NOOB = 1.000.000)
  idempotencyKey: string;
  sourceOperationId?: string;
  initialStatus?: 'PENDING' | 'APPROVED';
}

export class NoobCoinRepository {
  constructor(private db: IDatabase) {}

  /**
   * Inicializa parâmetros padrão de configuração se ainda não existirem
   */
  public async ensureDefaultConfig(tx?: IDatabase): Promise<void> {
    const client = tx || this.db;
    const defaults: Record<string, string> = {
      distribution_paused: '0',
      daily_character_limit_raw: '100000000', // 100 NOOB por personagem/dia
      daily_account_limit_raw: '250000000',   // 250 NOOB por conta/dia
      min_character_level: '5'
    };

    for (const [key, value] of Object.entries(defaults)) {
      const existing = await client.query<NoobCoinConfigRecord>(
        'SELECT key, value, updated_at FROM noobcoin_config WHERE key = ?;',
        [key]
      );
      if (existing.length === 0) {
        await client.execute(
          'INSERT INTO noobcoin_config (key, value) VALUES (?, ?);',
          [key, value]
        );
      }
    }
  }

  /**
   * Registra uma nova recompensa no ledger de forma atômica e idempotente.
   * Se a idempotency_key já existir, retorna o registro já gravado sem duplicar.
   */
  public async recordReward(
    params: CreateRewardParams,
    tx?: IDatabase
  ): Promise<{ reward: NoobCoinRewardRecord; isDuplicate: boolean }> {
    const client = tx || this.db;

    // 1. Verificação prévia de idempotência
    const existing = await this.getRewardByIdempotencyKey(params.idempotencyKey, client);
    if (existing) {
      return { reward: existing, isDuplicate: true };
    }

    const id = randomUUID();
    const status = params.initialStatus || 'PENDING';
    const sourceOpId = params.sourceOperationId || null;

    try {
      await client.execute(
        `INSERT INTO noobcoin_rewards_ledger 
         (id, character_id, account_id, reward_type, source_event, amount_raw, status, idempotency_key, source_operation_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          id,
          params.characterId,
          params.accountId,
          params.rewardType,
          params.sourceEvent,
          params.amountRaw,
          status,
          params.idempotencyKey,
          sourceOpId
        ]
      );
    } catch (err: any) {
      // Se ocorrer colisão de chave única em concorrência real
      const duplicate = await this.getRewardByIdempotencyKey(params.idempotencyKey, client);
      if (duplicate) {
        return { reward: duplicate, isDuplicate: true };
      }
      throw err;
    }

    const created = await this.getRewardById(id, client);
    if (!created) {
      throw new Error(`Falha ao recuperar recompensa recém-criada ${id}`);
    }

    return { reward: created, isDuplicate: false };
  }

  public async getRewardById(id: string, tx?: IDatabase): Promise<NoobCoinRewardRecord | null> {
    const client = tx || this.db;
    const rows = await client.query<NoobCoinRewardRecord>(
      `SELECT id, character_id, account_id, reward_type, source_event, amount_raw, status, 
              idempotency_key, source_operation_id, onchain_tx_signature, created_at, updated_at
       FROM noobcoin_rewards_ledger WHERE id = ?;`,
      [id]
    );
    return rows[0] || null;
  }

  public async getRewardByIdempotencyKey(key: string, tx?: IDatabase): Promise<NoobCoinRewardRecord | null> {
    const client = tx || this.db;
    const rows = await client.query<NoobCoinRewardRecord>(
      `SELECT id, character_id, account_id, reward_type, source_event, amount_raw, status, 
              idempotency_key, source_operation_id, onchain_tx_signature, created_at, updated_at
       FROM noobcoin_rewards_ledger WHERE idempotency_key = ?;`,
      [key]
    );
    return rows[0] || null;
  }

  public async getRewardsByCharacter(characterId: string, limit: number = 50, tx?: IDatabase): Promise<NoobCoinRewardRecord[]> {
    const client = tx || this.db;
    return client.query<NoobCoinRewardRecord>(
      `SELECT id, character_id, account_id, reward_type, source_event, amount_raw, status, 
              idempotency_key, source_operation_id, onchain_tx_signature, created_at, updated_at
       FROM noobcoin_rewards_ledger WHERE character_id = ? ORDER BY created_at DESC LIMIT ?;`,
      [characterId, limit]
    );
  }

  public async getRewardsByAccount(accountId: string, limit: number = 50, tx?: IDatabase): Promise<NoobCoinRewardRecord[]> {
    const client = tx || this.db;
    return client.query<NoobCoinRewardRecord>(
      `SELECT id, character_id, account_id, reward_type, source_event, amount_raw, status, 
              idempotency_key, source_operation_id, onchain_tx_signature, created_at, updated_at
       FROM noobcoin_rewards_ledger WHERE account_id = ? ORDER BY created_at DESC LIMIT ?;`,
      [accountId, limit]
    );
  }

  public async getRewardsByStatus(
    status: NoobCoinRewardStatus,
    limit: number = 50,
    tx?: IDatabase
  ): Promise<NoobCoinRewardRecord[]> {
    const client = tx || this.db;
    return client.query<NoobCoinRewardRecord>(
      `SELECT id, character_id, account_id, reward_type, source_event, amount_raw, status, 
              idempotency_key, source_operation_id, onchain_tx_signature, created_at, updated_at
       FROM noobcoin_rewards_ledger WHERE status = ? ORDER BY created_at ASC LIMIT ?;`,
      [status, limit]
    );
  }

  /**
   * Transiciona o status com validação estrita da máquina de estados.
   * Não permite transições arbitrárias.
   */
  public async updateRewardStatus(
    rewardId: string,
    newStatus: NoobCoinRewardStatus,
    onchainSignature?: string,
    allowOnchainTransitions: boolean = false,
    tx?: IDatabase
  ): Promise<NoobCoinRewardRecord> {
    const client = tx || this.db;
    const current = await this.getRewardById(rewardId, client);
    if (!current) {
      throw new Error(`Recompensa ${rewardId} não encontrada no ledger.`);
    }

    // Validação estrita da máquina de estados
    this.validateStateTransition(current.status, newStatus);

    // Bloqueia transições on-chain caso não tenham sido explicitamente liberadas
    if ((newStatus === 'SUBMITTED' || newStatus === 'CONFIRMED') && !allowOnchainTransitions) {
      throw new Error(
        `Transição para status '${newStatus}' está inativa na Missão 29: exige autorização explícita de integração on-chain.`
      );
    }

    const sig = onchainSignature || current.onchain_tx_signature || null;
    await client.execute(
      `UPDATE noobcoin_rewards_ledger 
       SET status = ?, onchain_tx_signature = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?;`,
      [newStatus, sig, rewardId]
    );

    const updated = await this.getRewardById(rewardId, client);
    return updated!;
  }

  public async markRewardQueued(rewardId: string, tx?: IDatabase): Promise<NoobCoinRewardRecord> {
    return this.updateRewardStatus(rewardId, 'QUEUED', undefined, true, tx);
  }

  public async markRewardSubmitted(rewardId: string, signature: string, tx?: IDatabase): Promise<NoobCoinRewardRecord> {
    return this.updateRewardStatus(rewardId, 'SUBMITTED', signature, true, tx);
  }

  public async markRewardConfirmed(rewardId: string, signature: string, tx?: IDatabase): Promise<NoobCoinRewardRecord> {
    return this.updateRewardStatus(rewardId, 'CONFIRMED', signature, true, tx);
  }

  private validateStateTransition(current: NoobCoinRewardStatus, next: NoobCoinRewardStatus): void {
    const validTransitions: Record<NoobCoinRewardStatus, NoobCoinRewardStatus[]> = {
      PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
      APPROVED: ['QUEUED', 'CANCELLED'],
      QUEUED: ['SUBMITTED', 'CANCELLED'],
      SUBMITTED: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: [], // Estado terminal
      REJECTED: [],  // Estado terminal
      CANCELLED: []  // Estado terminal
    };

    const allowed = validTransitions[current] || [];
    if (!allowed.includes(next)) {
      throw new Error(
        `Transição de estado inválida no ledger do NoobCoin: de '${current}' para '${next}'.`
      );
    }
  }

  /**
   * Consulta o acumulado diário de recompensas concedidas/aprovadas
   */
  public async getDailyAmount(
    entityType: 'ACCOUNT' | 'CHARACTER',
    entityId: string,
    dateStr: string,
    tx?: IDatabase
  ): Promise<number> {
    const client = tx || this.db;
    const rows = await client.query<NoobCoinDailyLimitRecord>(
      'SELECT total_amount_raw FROM noobcoin_daily_limits WHERE entity_type = ? AND entity_id = ? AND limit_date = ?;',
      [entityType, entityId, dateStr]
    );

    if (rows.length === 0) return 0;
    return Number(rows[0].total_amount_raw);
  }

  /**
   * Registra incremento atômico no acumulador diário
   */
  public async addDailyAmount(
    entityType: 'ACCOUNT' | 'CHARACTER',
    entityId: string,
    dateStr: string,
    amountRaw: number,
    tx?: IDatabase
  ): Promise<void> {
    if (!Number.isInteger(amountRaw) || amountRaw <= 0 || !Number.isSafeInteger(amountRaw)) {
      throw new Error(`Quantidade a acumular inválida ou insegura: ${amountRaw}`);
    }

    const client = tx || this.db;
    const existing = await client.query<NoobCoinDailyLimitRecord>(
      'SELECT id, total_amount_raw, rewards_count FROM noobcoin_daily_limits WHERE entity_type = ? AND entity_id = ? AND limit_date = ?;',
      [entityType, entityId, dateStr]
    );

    if (existing.length === 0) {
      const id = randomUUID();
      await client.execute(
        `INSERT INTO noobcoin_daily_limits (id, entity_type, entity_id, limit_date, total_amount_raw, rewards_count)
         VALUES (?, ?, ?, ?, ?, 1);`,
        [id, entityType, entityId, dateStr, amountRaw]
      );
    } else {
      const current = existing[0];
      const newTotal = Number(current.total_amount_raw) + amountRaw;
      if (!Number.isSafeInteger(newTotal)) {
        throw new Error(`Total acumulado diário excedeu o limite seguro de inteiros.`);
      }
      const newCount = Number(current.rewards_count) + 1;
      await client.execute(
        `UPDATE noobcoin_daily_limits 
         SET total_amount_raw = ?, rewards_count = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?;`,
        [newTotal, newCount, current.id]
      );
    }
  }

  public async getConfigValue(key: string, tx?: IDatabase): Promise<string | null> {
    const client = tx || this.db;
    const rows = await client.query<NoobCoinConfigRecord>(
      'SELECT value FROM noobcoin_config WHERE key = ?;',
      [key]
    );
    return rows[0]?.value || null;
  }

  public async setConfigValue(key: string, value: string, tx?: IDatabase): Promise<void> {
    const client = tx || this.db;
    const existing = await this.getConfigValue(key, client);
    if (existing !== null) {
      await client.execute(
        'UPDATE noobcoin_config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?;',
        [value, key]
      );
    } else {
      await client.execute(
        'INSERT INTO noobcoin_config (key, value) VALUES (?, ?);',
        [key, value]
      );
    }
  }
}
