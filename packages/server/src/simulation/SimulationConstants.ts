export const SIMULATION_CONSTANTS = {
  TICK_RATE: 20, // 20 ticks por segundo
  TICK_INTERVAL_MS: 50, // 50ms por tick
  SPEED_TOLERANCE_FACTOR: 1.25, // 25% de margem para compensação de jitter/latência de rede
  MAP_WIDTH: 480,
  MAP_HEIGHT: 270,
  INTERACT_MAX_DISTANCE: 36, // Alcance máximo para nós de coleta e crafting
  PICKUP_MAX_DISTANCE: 32, // Alcance máximo para coletar drops do chão
  DROP_LIFETIME_MS: 60000 // 60 segundos antes de um item do chão expirar
} as const;
