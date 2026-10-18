export enum CharacterClass {
  WARRIOR = 'WARRIOR',
  RANGER = 'RANGER',
  MAGE = 'MAGE',
  DRUID = 'DRUID'
}

export enum Direction {
  DOWN = 'down',
  UP = 'up',
  LEFT = 'left',
  RIGHT = 'right',
  DOWN_LEFT = 'down_left',
  DOWN_RIGHT = 'down_right',
  UP_LEFT = 'up_left',
  UP_RIGHT = 'up_right'
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface CharacterAttributes {
  maxHp: number;
  currentHp: number;
  maxMp: number;
  currentMp: number;
  attack: number;
  defense: number;
  speed: number;
}

export interface ClassCombatConfig {
  attackRange: number;
  attackCooldownMs: number;
  skill1Name: string;
  skill1CooldownMs: number;
  skill1CostMp: number;
}

export interface ClassGrowthRate {
  hpPerLevel: number;
  mpPerLevel: number;
  attackPerLevel: number;
  defensePerLevel: number;
}

// --- MODELO DE ITENS E INVENTÁRIO ---

export enum ItemCategory {
  RESOURCE = 'RESOURCE',
  CONSUMABLE = 'CONSUMABLE',
  CRAFTING_MATERIAL = 'CRAFTING_MATERIAL',
  WEAPON = 'WEAPON',
  ARMOR = 'ARMOR',
  ACCESSORY = 'ACCESSORY'
}

export enum ItemRarity {
  COMMON = 'COMMON',
  UNCOMMON = 'UNCOMMON',
  RARE = 'RARE',
  EPIC = 'EPIC'
}

export enum EquipmentSlot {
  WEAPON = 'WEAPON',
  ARMOR = 'ARMOR',
  ACCESSORY = 'ACCESSORY'
}

export interface ItemAttributesBonus {
  attack?: number;
  defense?: number;
  maxHp?: number;
  maxMp?: number;
  speed?: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  maxStack: number;
  goldValue: number;
  equipSlot?: EquipmentSlot;
  requiredLevel?: number;
  requiredClass?: CharacterClass;
  attributesBonus?: ItemAttributesBonus;
  consumableEffect?: {
    hpRestore?: number;
    mpRestore?: number;
  };
  iconKey: string;
}

export interface InventorySlot {
  slotIndex: number; // 0 a 23 (24 slots)
  itemId: string;
  quantity: number;
}

export interface EquippedSlots {
  weapon: string | null;
  armor: string | null;
  accessory: string | null;
}

export interface PlayerData {
  id: string;
  name: string;
  characterClass: CharacterClass;
  level: number;
  currentXp: number;
  gold: number;
  meritPoints: number;
  attributes: CharacterAttributes;
  position: Vector2D;
  direction: Direction;
  inventory: (InventorySlot | null)[];
  equipped: EquippedSlots;
}

// --- TIPOS DE MONSTROS E LOOT ---

export enum MonsterType {
  SLIME = 'SLIME',
  GOBLIN = 'GOBLIN'
}

export enum MonsterAIState {
  IDLE_PATROL = 'IDLE_PATROL',
  CHASE = 'CHASE',
  ATTACK = 'ATTACK',
  RETURN = 'RETURN',
  DEAD = 'DEAD'
}

export interface MonsterDropEntry {
  itemId: string;
  chance: number; // 0.0 a 1.0 (ex: 0.8 = 80%)
  minAmount: number;
  maxAmount: number;
}

export interface MonsterConfig {
  type: MonsterType;
  name: string;
  level: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  detectionRadius: number;
  attackRange: number;
  attackCooldownMs: number;
  xpReward: number;
  goldRewardMin: number;
  goldRewardMax: number;
  respawnTimeMs: number;
  lootTable: MonsterDropEntry[];
}

// --- COLETA E RECURSOS ---

export enum GatheringNodeType {
  TREE = 'TREE',
  ORE_VEIN = 'ORE_VEIN',
  HERB_BUSH = 'HERB_BUSH'
}

export interface GatheringNodeConfig {
  type: GatheringNodeType;
  name: string;
  gatherDurationMs: number;
  respawnTimeMs: number;
  droppedItemId: string;
  dropAmountMin: number;
  dropAmountMax: number;
}

// --- CRAFTING ---

export interface CraftingIngredient {
  itemId: string;
  quantity: number;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  resultItemId: string;
  resultAmount: number;
  requiredLevel: number;
  ingredients: CraftingIngredient[];
}

// --- PROTOCOLO MULTIPLAYER WEBSOCKET (FASE 5B) ---

export enum NetMessageType {
  // Cliente para Servidor
  C2S_JOIN = 'c2s_join',
  C2S_MOVE = 'c2s_move',
  C2S_ATTACK = 'c2s_attack',
  C2S_SKILL1 = 'c2s_skill1',
  C2S_GATHER = 'c2s_gather',
  C2S_PICKUP = 'c2s_pickup',
  C2S_CRAFT = 'c2s_craft',
  C2S_USE_ITEM = 'c2s_use_item',
  C2S_EQUIP = 'c2s_equip',
  C2S_CHAT = 'c2s_chat',
  C2S_PING = 'c2s_ping',

  // Servidor para Cliente
  S2C_JOINED = 's2c_joined',
  S2C_ERROR = 's2c_error',
  S2C_SNAPSHOT = 's2c_snapshot',
  S2C_PLAYER_JOINED = 's2c_player_joined',
  S2C_PLAYER_LEFT = 's2c_player_left',
  S2C_CHAT = 's2c_chat',
  S2C_COMBAT_EVENT = 's2c_combat_event',
  S2C_PONG = 's2c_pong'
}

export interface PlayerSnapshotState {
  id: string;
  name: string;
  characterClass: CharacterClass;
  level: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  isDead: boolean;
  direction?: Direction;
}

export interface MonsterSnapshotState {
  id: string;
  type: MonsterType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  state: MonsterAIState;
}

export interface GatheringNodeSnapshotState {
  id: string;
  type: GatheringNodeType;
  x: number;
  y: number;
  state: string;
}

export interface GroundItemSnapshotState {
  id: string;
  itemId: string;
  quantity: number;
  x: number;
  y: number;
}

export interface WorldSnapshot {
  timestamp: number;
  players: PlayerSnapshotState[];
  monsters: MonsterSnapshotState[];
  gatheringNodes: GatheringNodeSnapshotState[];
  groundItems: GroundItemSnapshotState[];
}

export interface C2S_JoinPayload {
  roomId: string;
  characterId: string;
}

export interface C2S_MovePayload {
  targetX: number;
  targetY: number;
  clientDt: number;
}

export interface C2S_AttackPayload {
  targetMonsterId: string;
}

export interface C2S_Skill1Payload {
  targetMonsterId: string;
}

export interface C2S_GatherPayload {
  nodeId: string;
}

export interface C2S_PickupPayload {
  groundItemId: string;
}

export interface C2S_CraftPayload {
  recipeId: string;
}

export interface C2S_UseItemPayload {
  slotIndex: number;
}

export interface C2S_EquipPayload {
  slotIndex: number;
}

export interface C2S_ChatPayload {
  message: string;
}

export interface C2S_PingPayload {
  clientTimestamp: number;
}

export interface S2C_JoinedPayload {
  roomId: string;
  characterId: string;
  name: string;
  tickRate: number;
  map: string;
  playerState: PlayerSnapshotState;
}

export interface S2C_ErrorPayload {
  code: string;
  message: string;
}

export interface S2C_PlayerJoinedPayload {
  player: PlayerSnapshotState;
}

export interface S2C_PlayerLeftPayload {
  playerId: string;
}

export interface S2C_ChatPayload {
  senderId: string;
  senderName: string;
  message: string;
  timestamp: number;
}

export interface S2C_CombatEventPayload {
  type: 'PLAYER_ATTACK' | 'PLAYER_SKILL' | 'MONSTER_ATTACK' | 'MONSTER_DEATH' | 'PLAYER_LEVEL_UP';
  attackerId: string;
  targetId: string;
  damage?: number;
  xpAwarded?: number;
  goldAwarded?: number;
  newLevel?: number;
  timestamp: number;
}

export interface S2C_PongPayload {
  clientTimestamp: number;
  serverTime: number;
}

