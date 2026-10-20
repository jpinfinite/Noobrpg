-- Migração 008: Tabela de recompensas e itens pendentes para prevenção de perda por inventário cheio
CREATE TABLE IF NOT EXISTS character_pending_rewards (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  source TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pending_rewards_char ON character_pending_rewards(character_id);
