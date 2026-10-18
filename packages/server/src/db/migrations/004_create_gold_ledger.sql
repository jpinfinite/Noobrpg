CREATE TABLE IF NOT EXISTS gold_transactions (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  balance_after INT NOT NULL CHECK (balance_after >= 0),
  source TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gold_char ON gold_transactions(character_id);
