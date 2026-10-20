-- Migração 007: Tabela de progresso de quests e controle autoritativo de recompensas
CREATE TABLE IF NOT EXISTS character_quests (
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  quest_id TEXT NOT NULL,
  step INT NOT NULL DEFAULT 0,
  completed INT NOT NULL DEFAULT 0,
  rewards_claimed TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (character_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_char_quests_char ON character_quests(character_id);
