-- Migração 010: Livro-Razão (Ledger) Interno do NoobCoin (NOOB) e Controles de Recompensas
-- Projetado para conformidade ACID, compatibilidade SQLite/PostgreSQL e Zero Client Trust.

CREATE TABLE IF NOT EXISTS noobcoin_rewards_ledger (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL,
  source_event TEXT NOT NULL,
  amount_raw BIGINT NOT NULL CHECK (amount_raw > 0),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'QUEUED', 'SUBMITTED', 'CONFIRMED', 'REJECTED', 'CANCELLED')),
  idempotency_key TEXT NOT NULL UNIQUE,
  source_operation_id TEXT,
  onchain_tx_signature TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_noobcoin_ledger_char ON noobcoin_rewards_ledger(character_id);
CREATE INDEX IF NOT EXISTS idx_noobcoin_ledger_acc ON noobcoin_rewards_ledger(account_id);
CREATE INDEX IF NOT EXISTS idx_noobcoin_ledger_status ON noobcoin_rewards_ledger(status);
CREATE INDEX IF NOT EXISTS idx_noobcoin_ledger_idemp ON noobcoin_rewards_ledger(idempotency_key);

-- Tabela de consolidação de limites diários para prevenção de sobre-emissão e exploração de farming
CREATE TABLE IF NOT EXISTS noobcoin_daily_limits (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('ACCOUNT', 'CHARACTER')),
  entity_id TEXT NOT NULL,
  limit_date TEXT NOT NULL,
  total_amount_raw BIGINT NOT NULL DEFAULT 0,
  rewards_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (entity_type, entity_id, limit_date)
);

CREATE INDEX IF NOT EXISTS idx_noobcoin_limits_lookup ON noobcoin_daily_limits(entity_type, entity_id, limit_date);

-- Tabela de configuração global do subsistema NoobCoin
CREATE TABLE IF NOT EXISTS noobcoin_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
