CREATE TABLE IF NOT EXISTS character_inventory (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  slot_index INT NOT NULL CHECK (slot_index >= 0 AND slot_index <= 23),
  item_id TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  UNIQUE (character_id, slot_index)
);

CREATE TABLE IF NOT EXISTS character_equipment (
  character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  weapon_item_id TEXT,
  armor_item_id TEXT,
  accessory_item_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_inventory_char ON character_inventory(character_id);
