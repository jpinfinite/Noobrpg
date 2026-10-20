import {
  AOI_CONSTANTS,
  WorldSnapshot,
  WorldSnapshotDelta,
  PlayerSnapshotState,
  PlayerDeltaState,
  MonsterSnapshotState,
  MonsterDeltaState,
  GatheringNodeSnapshotState,
  GroundItemSnapshotState
} from '@noobrpg/shared';
import { ServerPlayer } from '../simulation/ServerPlayer.js';
import { ServerMonster } from '../simulation/ServerMonster.js';
import { ServerGroundItem } from '../simulation/ServerGroundItem.js';
import { ServerGatheringNode } from '../simulation/ServerGatheringNode.js';

export interface ClientAOIState {
  characterId: string;
  seq: number;
  ticksSinceLastFullSnapshot: number;
  visiblePlayerIds: Set<string>;
  visibleMonsterIds: Set<string>;
  visibleGroundItemIds: Set<string>;
  lastKnownPlayerStates: Map<string, PlayerSnapshotState>;
  lastKnownMonsterStates: Map<string, MonsterSnapshotState>;
}

export class AreaOfInterestManager {
  private clientStates: Map<string, ClientAOIState> = new Map();

  /**
   * Registra um novo cliente no gerenciador de AOI
   */
  public registerClient(characterId: string): void {
    this.clientStates.set(characterId, {
      characterId,
      seq: 1,
      ticksSinceLastFullSnapshot: 0,
      visiblePlayerIds: new Set(),
      visibleMonsterIds: new Set(),
      visibleGroundItemIds: new Set(),
      lastKnownPlayerStates: new Map(),
      lastKnownMonsterStates: new Map()
    });
  }

  /**
   * Remove o cliente e limpa seus estados
   */
  public unregisterClient(characterId: string): void {
    this.clientStates.delete(characterId);
  }

  /**
   * Verifica se uma entidade está atualmente no conjunto de visibilidade do cliente
   */
  public isEntityVisibleToClient(characterId: string, entityId: string): boolean {
    const state = this.clientStates.get(characterId);
    if (!state) return false;
    return state.visiblePlayerIds.has(entityId) || state.visibleMonsterIds.has(entityId) || state.visibleGroundItemIds.has(entityId);
  }

  /**
   * Verifica se uma entidade está dentro do raio de interesse em relação a um ponto central (x, y)
   * Usa histerese: se já era visível usa LEAVE_RADIUS, senão ENTER_RADIUS
   */
  public isEntityInAOI(
    targetX: number,
    targetY: number,
    centerX: number,
    centerY: number,
    alreadyVisible: boolean
  ): boolean {
    const dx = Math.abs(targetX - centerX);
    const dy = Math.abs(targetY - centerY);
    const limitX = alreadyVisible ? AOI_CONSTANTS.LEAVE_RADIUS_X : AOI_CONSTANTS.ENTER_RADIUS_X;
    const limitY = alreadyVisible ? AOI_CONSTANTS.LEAVE_RADIUS_Y : AOI_CONSTANTS.ENTER_RADIUS_Y;
    return dx <= limitX && dy <= limitY;
  }

  /**
   * Gera o pacote de sincronização (Full Snapshot ou Delta) personalizado para um cliente específico
   */
  public generatePacketForClient(
    characterId: string,
    allPlayers: Map<string, ServerPlayer>,
    allMonsters: Map<string, ServerMonster>,
    allGatheringNodes: Map<string, ServerGatheringNode>,
    allGroundItems: Map<string, ServerGroundItem>,
    forceFullSnapshot: boolean = false
  ): { type: 'FULL' | 'DELTA'; snapshot?: WorldSnapshot; delta?: WorldSnapshotDelta } | null {
    const clientState = this.clientStates.get(characterId);
    if (!clientState) return null;

    const selfPlayer = allPlayers.get(characterId);
    if (!selfPlayer) return null;

    const centerX = selfPlayer.x;
    const centerY = selfPlayer.y;
    const now = Date.now();
    const currentSeq = clientState.seq++;

    const isFull = forceFullSnapshot || clientState.ticksSinceLastFullSnapshot >= AOI_CONSTANTS.FULL_SNAPSHOT_INTERVAL_TICKS;

    // --- Determina entidades visíveis neste tick ---
    const currentVisiblePlayers = new Map<string, PlayerSnapshotState>();
    for (const [pId, p] of allPlayers.entries()) {
      const alreadyVisible = clientState.visiblePlayerIds.has(pId);
      // O próprio jogador sempre é considerado dentro do seu AOI
      const inRange = pId === characterId || this.isEntityInAOI(p.x, p.y, centerX, centerY, alreadyVisible);
      if (inRange) {
        currentVisiblePlayers.set(pId, {
          id: p.id,
          name: p.name,
          characterClass: p.characterClass,
          level: p.level,
          x: Math.round(p.x),
          y: Math.round(p.y),
          hp: p.hp,
          maxHp: p.getMaxHp(),
          mp: p.mp,
          maxMp: p.getMaxMp(),
          isDead: p.isDead,
          activeTitle: p.activeTitle || null
        });
      }
    }

    const currentVisibleMonsters = new Map<string, MonsterSnapshotState>();
    for (const [mId, m] of allMonsters.entries()) {
      const alreadyVisible = clientState.visibleMonsterIds.has(mId);
      if (this.isEntityInAOI(m.x, m.y, centerX, centerY, alreadyVisible)) {
        currentVisibleMonsters.set(mId, {
          id: m.id,
          type: m.type,
          x: Math.round(m.x),
          y: Math.round(m.y),
          hp: m.hp,
          maxHp: m.maxHp,
          state: m.state
        });
      }
    }

    const currentVisibleGroundItems = new Map<string, GroundItemSnapshotState>();
    for (const [iId, i] of allGroundItems.entries()) {
      const alreadyVisible = clientState.visibleGroundItemIds.has(iId);
      if (this.isEntityInAOI(i.x, i.y, centerX, centerY, alreadyVisible)) {
        currentVisibleGroundItems.set(iId, {
          id: i.id,
          itemId: i.itemId,
          quantity: i.quantity,
          x: Math.round(i.x),
          y: Math.round(i.y)
        });
      }
    }

    // --- Caso 1: FULL SNAPSHOT ---
    if (isFull) {
      clientState.ticksSinceLastFullSnapshot = 0;
      clientState.visiblePlayerIds = new Set(currentVisiblePlayers.keys());
      clientState.visibleMonsterIds = new Set(currentVisibleMonsters.keys());
      clientState.visibleGroundItemIds = new Set(currentVisibleGroundItems.keys());
      clientState.lastKnownPlayerStates = new Map(currentVisiblePlayers);
      clientState.lastKnownMonsterStates = new Map(currentVisibleMonsters);

      // Gathering nodes visíveis (são estáticos, mas incluídos no full snapshot)
      const visibleNodes: GatheringNodeSnapshotState[] = [];
      for (const [nId, n] of allGatheringNodes.entries()) {
        if (this.isEntityInAOI(n.x, n.y, centerX, centerY, true)) {
          visibleNodes.push({
            id: n.id,
            type: n.type,
            x: n.x,
            y: n.y,
            state: n.state
          });
        }
      }

      const fullSnapshot: WorldSnapshot = {
        seq: currentSeq,
        timestamp: now,
        players: Array.from(currentVisiblePlayers.values()),
        monsters: Array.from(currentVisibleMonsters.values()),
        gatheringNodes: visibleNodes,
        groundItems: Array.from(currentVisibleGroundItems.values())
      };

      return { type: 'FULL', snapshot: fullSnapshot };
    }

    // --- Caso 2: DELTA SNAPSHOT ---
    clientState.ticksSinceLastFullSnapshot++;

    // 1. Jogadores
    const enteredPlayers: PlayerSnapshotState[] = [];
    const removedPlayerIds: string[] = [];
    const changedPlayers: PlayerDeltaState[] = [];

    // Detecta novos jogadores no AOI
    for (const [pId, pState] of currentVisiblePlayers.entries()) {
      if (!clientState.visiblePlayerIds.has(pId)) {
        enteredPlayers.push(pState);
      } else {
        // Já era visível: checa o que mudou
        const last = clientState.lastKnownPlayerStates.get(pId);
        if (!last || last.x !== pState.x || last.y !== pState.y || last.hp !== pState.hp || last.mp !== pState.mp || last.level !== pState.level || last.isDead !== pState.isDead || last.activeTitle !== pState.activeTitle) {
          const delta: PlayerDeltaState = { id: pId };
          if (!last || last.x !== pState.x) delta.x = pState.x;
          if (!last || last.y !== pState.y) delta.y = pState.y;
          if (!last || last.hp !== pState.hp) delta.hp = pState.hp;
          if (!last || last.maxHp !== pState.maxHp) delta.maxHp = pState.maxHp;
          if (!last || last.mp !== pState.mp) delta.mp = pState.mp;
          if (!last || last.maxMp !== pState.maxMp) delta.maxMp = pState.maxMp;
          if (!last || last.level !== pState.level) delta.level = pState.level;
          if (!last || last.isDead !== pState.isDead) delta.isDead = pState.isDead;
          if (!last || last.activeTitle !== pState.activeTitle) delta.activeTitle = pState.activeTitle;
          changedPlayers.push(delta);
        }
      }
    }

    // Detecta jogadores que saíram do AOI
    for (const oldId of clientState.visiblePlayerIds) {
      if (!currentVisiblePlayers.has(oldId)) {
        removedPlayerIds.push(oldId);
      }
    }

    // 2. Monstros
    const enteredMonsters: MonsterSnapshotState[] = [];
    const removedMonsterIds: string[] = [];
    const changedMonsters: MonsterDeltaState[] = [];

    for (const [mId, mState] of currentVisibleMonsters.entries()) {
      if (!clientState.visibleMonsterIds.has(mId)) {
        enteredMonsters.push(mState);
      } else {
        const last = clientState.lastKnownMonsterStates.get(mId);
        if (!last || last.x !== mState.x || last.y !== mState.y || last.hp !== mState.hp || last.state !== mState.state) {
          const delta: MonsterDeltaState = { id: mId };
          if (!last || last.x !== mState.x) delta.x = mState.x;
          if (!last || last.y !== mState.y) delta.y = mState.y;
          if (!last || last.hp !== mState.hp) delta.hp = mState.hp;
          if (!last || last.maxHp !== mState.maxHp) delta.maxHp = mState.maxHp;
          if (!last || last.state !== mState.state) delta.state = mState.state;
          changedMonsters.push(delta);
        }
      }
    }

    for (const oldId of clientState.visibleMonsterIds) {
      if (!currentVisibleMonsters.has(oldId)) {
        removedMonsterIds.push(oldId);
      }
    }

    // 3. Ground Items
    const enteredGroundItems: GroundItemSnapshotState[] = [];
    const removedGroundItemIds: string[] = [];

    for (const [iId, iState] of currentVisibleGroundItems.entries()) {
      if (!clientState.visibleGroundItemIds.has(iId)) {
        enteredGroundItems.push(iState);
      }
    }

    for (const oldId of clientState.visibleGroundItemIds) {
      if (!currentVisibleGroundItems.has(oldId)) {
        removedGroundItemIds.push(oldId);
      }
    }

    // Atualiza estados conhecidos para o próximo tick
    clientState.visiblePlayerIds = new Set(currentVisiblePlayers.keys());
    clientState.visibleMonsterIds = new Set(currentVisibleMonsters.keys());
    clientState.visibleGroundItemIds = new Set(currentVisibleGroundItems.keys());
    clientState.lastKnownPlayerStates = new Map(currentVisiblePlayers);
    clientState.lastKnownMonsterStates = new Map(currentVisibleMonsters);

    const deltaSnapshot: WorldSnapshotDelta = {
      seq: currentSeq,
      timestamp: now,
      isDelta: true,
      players: changedPlayers.length > 0 ? changedPlayers : undefined,
      monsters: changedMonsters.length > 0 ? changedMonsters : undefined,
      enteredPlayers: enteredPlayers.length > 0 ? enteredPlayers : undefined,
      enteredMonsters: enteredMonsters.length > 0 ? enteredMonsters : undefined,
      enteredGroundItems: enteredGroundItems.length > 0 ? enteredGroundItems : undefined,
      removedPlayerIds: removedPlayerIds.length > 0 ? removedPlayerIds : undefined,
      removedMonsterIds: removedMonsterIds.length > 0 ? removedMonsterIds : undefined,
      removedGroundItemIds: removedGroundItemIds.length > 0 ? removedGroundItemIds : undefined
    };

    return { type: 'DELTA', delta: deltaSnapshot };
  }
}
