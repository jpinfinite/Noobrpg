export interface IDatabase {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid?: number | bigint }>;
  transaction<T>(callback: (tx: IDatabase) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface AccountRecord {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface CharacterRecord {
  id: string;
  account_id: string;
  name: string;
  character_class: string;
  level: number;
  current_xp: number;
  gold: number;
  merit_points: number;
  pos_x: number;
  pos_y: number;
  hp: number;
  mp: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryRecord {
  id: string;
  character_id: string;
  slot_index: number;
  item_id: string;
  quantity: number;
}

export interface EquipmentRecord {
  character_id: string;
  weapon_item_id: string | null;
  armor_item_id: string | null;
  accessory_item_id: string | null;
}

export interface GoldTransactionRecord {
  id: string;
  character_id: string;
  amount: number;
  balance_after: number;
  source: string;
  created_at: string;
}

export interface SessionRecord {
  token: string;
  account_id: string;
  expires_at: string;
  created_at: string;
}

