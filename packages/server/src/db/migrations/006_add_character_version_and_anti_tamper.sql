-- Migração 006: Versionamento de estado de personagem e controle de concorrência otimista
ALTER TABLE characters ADD COLUMN version INT NOT NULL DEFAULT 1;
