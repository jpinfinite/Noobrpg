-- Migração 009: Sistema de Conquistas, Títulos Desbloqueados e Título Ativo
CREATE TABLE IF NOT EXISTS character_achievements (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  progress INT NOT NULL DEFAULT 0,
  completed INT NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  unlocked_at TIMESTAMP,
  reward_claimed INT NOT NULL DEFAULT 0 CHECK (reward_claimed IN (0, 1)),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (character_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_char_achievements_char ON character_achievements(character_id);
CREATE INDEX IF NOT EXISTS idx_char_achievements_ach ON character_achievements(achievement_id);

CREATE TABLE IF NOT EXISTS character_titles (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  title_id TEXT NOT NULL,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (character_id, title_id)
);

CREATE INDEX IF NOT EXISTS idx_char_titles_char ON character_titles(character_id);

CREATE TABLE IF NOT EXISTS character_active_title (
  character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  title_id TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
