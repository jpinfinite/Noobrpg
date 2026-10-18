CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT UNIQUE NOT NULL,
  character_class TEXT NOT NULL,
  level INT NOT NULL DEFAULT 1,
  current_xp INT NOT NULL DEFAULT 0,
  gold INT NOT NULL DEFAULT 100 CHECK (gold >= 0),
  merit_points INT NOT NULL DEFAULT 0,
  pos_x INT NOT NULL DEFAULT 180,
  pos_y INT NOT NULL DEFAULT 160,
  hp INT NOT NULL,
  mp INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_characters_account ON characters(account_id);
CREATE INDEX IF NOT EXISTS idx_characters_name ON characters(name);
