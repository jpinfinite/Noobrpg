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
  version: number;
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

export interface CharacterAchievementRecord {
  id: string;
  character_id: string;
  achievement_id: string;
  progress: number;
  completed: number;
  unlocked_at: string | null;
  reward_claimed: number;
  created_at: string;
  updated_at: string;
}

export interface CharacterTitleRecord {
  id: string;
  character_id: string;
  title_id: string;
  unlocked_at: string;
}

export type NoobCoinRewardStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'QUEUED'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED';

export interface NoobCoinRewardRecord {
  id: string;
  character_id: string;
  account_id: string;
  reward_type: string;
  source_event: string;
  amount_raw: number; // Unidades mínimas inteiras (6 decimais: 1 NOOB = 1.000.000)
  status: NoobCoinRewardStatus;
  idempotency_key: string;
  source_operation_id: string | null;
  onchain_tx_signature: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoobCoinDailyLimitRecord {
  id: string;
  entity_type: 'ACCOUNT' | 'CHARACTER';
  entity_id: string;
  limit_date: string;
  total_amount_raw: number;
  rewards_count: number;
  updated_at: string;
}

export interface NoobCoinConfigRecord {
  key: string;
  value: string;
  updated_at: string;
}



