import {
  ACHIEVEMENT_DEFINITIONS,
  TITLE_DEFINITIONS,
  AchievementDefinition,
  AchievementProgress,
  CharacterAchievementSummary,
  TitleDefinition,
  addItemToInventory,
  InventorySlot
} from '@noobrpg/shared';
import { IDatabase } from '../db/index.js';
import { AchievementRepository } from '../repositories/achievementRepository.js';
import { CharacterRepository } from '../repositories/characterRepository.js';
import { GoldLedgerRepository } from '../repositories/goldLedgerRepository.js';
import { PendingRewardRepository } from '../repositories/pendingRewardRepository.js';
import { InventoryRepository } from '../repositories/inventoryRepository.js';

export interface ProgressResult {
  updated: boolean;
  unlocked: boolean;
  currentProgress: number;
  targetProgress: number;
  achievement?: AchievementDefinition;
  titleUnlocked?: TitleDefinition;
}

export interface ClaimRewardResult {
  success: boolean;
  message?: string;
  goldAwarded?: number;
  xpAwarded?: number;
  itemsAwarded?: Array<{ itemId: string; quantity: number }>;
  itemsDivertedToPending?: Array<{ itemId: string; quantity: number }>;
  titleUnlocked?: TitleDefinition;
}

export class AchievementService {
  constructor(
    private db: IDatabase,
    private achievementRepo: AchievementRepository,
    private characterRepo?: CharacterRepository,
    private goldRepo?: GoldLedgerRepository,
    private pendingRewardRepo?: PendingRewardRepository,
    private inventoryRepo?: InventoryRepository
  ) {
    this.characterRepo = characterRepo || new CharacterRepository(db);
    this.goldRepo = goldRepo || new GoldLedgerRepository(db);
    this.pendingRewardRepo = pendingRewardRepo || new PendingRewardRepository(db);
    this.inventoryRepo = inventoryRepo || new InventoryRepository(db);
  }

  public async getSummary(characterId: string, tx?: IDatabase): Promise<CharacterAchievementSummary> {
    const records = await this.achievementRepo.getAllAchievements(characterId, tx);
    const unlockedTitles = await this.achievementRepo.getUnlockedTitles(characterId, tx);
    const activeTitle = await this.achievementRepo.getActiveTitle(characterId, tx);

    const achievements: Record<string, AchievementProgress> = {};

    // Popula todas as conquistas do catálogo
    for (const [id, def] of Object.entries(ACHIEVEMENT_DEFINITIONS)) {
      const rec = records.find(r => r.achievement_id === id);
      achievements[id] = {
        achievementId: id,
        currentProgress: rec ? rec.progress : 0,
        targetProgress: def.targetProgress,
        completed: rec ? rec.completed === 1 : false,
        unlockedAt: rec?.unlocked_at || undefined,
        rewardClaimed: rec ? rec.reward_claimed === 1 : false
      };
    }

    return {
      achievements,
      unlockedTitles,
      activeTitle
    };
  }

  /**
   * Registra progresso em uma conquista autoritativamente
   */
  public async recordProgress(
    characterId: string,
    achievementId: string,
    amount: number = 1,
    isAbsolute: boolean = false
  ): Promise<ProgressResult> {
    const def = ACHIEVEMENT_DEFINITIONS[achievementId];
    if (!def) {
      return { updated: false, unlocked: false, currentProgress: 0, targetProgress: 0 };
    }

    return await this.db.transaction(async tx => {
      const repo = new AchievementRepository(tx);
      const existing = await repo.getAchievement(characterId, achievementId, tx);

      if (existing && existing.completed === 1) {
        return {
          updated: false,
          unlocked: false,
          currentProgress: def.targetProgress,
          targetProgress: def.targetProgress
        };
      }

      const prevProgress = existing ? existing.progress : 0;
      let newProgress = isAbsolute ? amount : prevProgress + amount;

      // Clampa entre 0 e a meta
      newProgress = Math.max(0, Math.min(def.targetProgress, Math.floor(newProgress)));

      if (newProgress === prevProgress && existing) {
        return {
          updated: false,
          unlocked: false,
          currentProgress: prevProgress,
          targetProgress: def.targetProgress
        };
      }

      const didUnlock = newProgress >= def.targetProgress;
      const unlockedAt = didUnlock ? new Date().toISOString() : null;

      await repo.saveProgress(characterId, achievementId, newProgress, didUnlock, unlockedAt, tx);

      let titleUnlocked: TitleDefinition | undefined;

      // Se a conquista concede título, desbloqueia atomicamente
      if (didUnlock && def.reward?.titleId) {
        const titleId = def.reward.titleId;
        const unlockedNow = await repo.unlockTitle(characterId, titleId, tx);
        if (unlockedNow && TITLE_DEFINITIONS[titleId]) {
          titleUnlocked = TITLE_DEFINITIONS[titleId];
        }
      }

      return {
        updated: true,
        unlocked: didUnlock,
        currentProgress: newProgress,
        targetProgress: def.targetProgress,
        achievement: didUnlock ? def : undefined,
        titleUnlocked
      };
    });
  }

  /**
   * Reivindicação atômica de recompensas de conquista
   */
  public async claimReward(
    characterId: string,
    achievementId: string,
    playerInventory?: (InventorySlot | null)[]
  ): Promise<ClaimRewardResult> {
    const def = ACHIEVEMENT_DEFINITIONS[achievementId];
    if (!def) {
      return { success: false, message: 'Conquista não encontrada no catálogo.' };
    }

    return await this.db.transaction(async tx => {
      const achRepo = new AchievementRepository(tx);
      const charRepo = new CharacterRepository(tx);
      const goldRepo = new GoldLedgerRepository(tx);
      const pendingRepo = new PendingRewardRepository(tx);
      const invRepo = new InventoryRepository(tx);

      const achRecord = await achRepo.getAchievement(characterId, achievementId, tx);
      if (!achRecord) {
        return { success: false, message: 'Conquista ainda não possui progresso.' };
      }

      if (achRecord.completed !== 1) {
        return { success: false, message: 'Conquista ainda não foi concluída.' };
      }

      if (achRecord.reward_claimed === 1) {
        return { success: false, message: 'A recompensa desta conquista já foi resgatada.' };
      }

      const claimed = await achRepo.claimReward(characterId, achievementId, tx);
      if (!claimed) {
        return { success: false, message: 'Recompensa já resgatada por operação concorrente.' };
      }

      const reward = def.reward;
      if (!reward) {
        return { success: true, message: 'Conquista resgatada com sucesso.' };
      }

      const char = await charRepo.findById(characterId, tx);
      if (!char) {
        throw new Error(`Personagem ${characterId} não encontrado.`);
      }

      let goldAwarded = 0;
      let xpAwarded = 0;
      const itemsAwarded: Array<{ itemId: string; quantity: number }> = [];
      const itemsDivertedToPending: Array<{ itemId: string; quantity: number }> = [];

      // 1. Recompensa de Ouro
      if (reward.gold && reward.gold > 0) {
        goldAwarded = reward.gold;
        const newGold = char.gold + goldAwarded;
        await goldRepo.recordTransaction(
          characterId,
          goldAwarded,
          newGold,
          `achievement_reward_${achievementId}`,
          tx
        );
        await charRepo.updateProgression(
          characterId,
          {
            level: char.level,
            current_xp: char.current_xp,
            gold: newGold,
            hp: char.hp,
            mp: char.mp,
            pos_x: char.pos_x,
            pos_y: char.pos_y
          },
          tx
        );
      }

      // 2. Recompensa de XP
      if (reward.xp && reward.xp > 0) {
        xpAwarded = reward.xp;
        const newXp = char.current_xp + xpAwarded;
        await charRepo.updateProgression(
          characterId,
          {
            level: char.level,
            current_xp: newXp,
            gold: char.gold + goldAwarded,
            hp: char.hp,
            mp: char.mp,
            pos_x: char.pos_x,
            pos_y: char.pos_y
          },
          tx
        );
      }

      // 3. Recompensa de Itens (com prevenção de perda se inventário estiver cheio)
      if (reward.items && reward.items.length > 0) {
        let currentInv: (InventorySlot | null)[];
        if (playerInventory) {
          currentInv = playerInventory;
        } else {
          const invRows = await invRepo.getByCharacterId(characterId, tx);
          currentInv = new Array(24).fill(null);
          for (const row of invRows) {
            currentInv[row.slot_index] = {
              slotIndex: row.slot_index,
              itemId: row.item_id,
              quantity: row.quantity
            };
          }
        }

        for (const itemReward of reward.items) {
          const addRes = addItemToInventory(currentInv, itemReward.itemId, itemReward.quantity);
          const addedQty = itemReward.quantity - addRes.remaining;

          if (addedQty > 0) {
            itemsAwarded.push({ itemId: itemReward.itemId, quantity: addedQty });
          }

          if (addRes.remaining > 0) {
            // Desvia automaticamente para pending rewards sem perda silenciosa!
            await pendingRepo.addPendingReward(
              characterId,
              {
                itemId: itemReward.itemId,
                quantity: addRes.remaining,
                source: `achievement_${achievementId}`
              },
              tx
            );
            itemsDivertedToPending.push({ itemId: itemReward.itemId, quantity: addRes.remaining });
          }
        }

        // Salva inventário atualizado
        const slotsToSave: { slotIndex: number; itemId: string; quantity: number }[] = [];
        for (let i = 0; i < currentInv.length; i++) {
          const s = currentInv[i];
          if (s && s.itemId && s.quantity > 0) {
            slotsToSave.push({ slotIndex: i, itemId: s.itemId, quantity: s.quantity });
          }
        }
        await invRepo.saveSlots(characterId, slotsToSave, tx);
      }

      // 4. Recompensa de Título
      let titleUnlocked: TitleDefinition | undefined;
      if (reward.titleId) {
        await achRepo.unlockTitle(characterId, reward.titleId, tx);
        if (TITLE_DEFINITIONS[reward.titleId]) {
          titleUnlocked = TITLE_DEFINITIONS[reward.titleId];
        }
      }

      return {
        success: true,
        message: 'Recompensas resgatadas com sucesso!',
        goldAwarded: goldAwarded > 0 ? goldAwarded : undefined,
        xpAwarded: xpAwarded > 0 ? xpAwarded : undefined,
        itemsAwarded: itemsAwarded.length > 0 ? itemsAwarded : undefined,
        itemsDivertedToPending: itemsDivertedToPending.length > 0 ? itemsDivertedToPending : undefined,
        titleUnlocked
      };
    });
  }

  /**
   * Equipa ou desequipa um título desbloqueado
   */
  public async equipTitle(
    characterId: string,
    titleId: string | null
  ): Promise<{ success: boolean; activeTitle: string | null; titleDef?: TitleDefinition; reason?: string }> {
    if (!titleId) {
      await this.achievementRepo.setActiveTitle(characterId, null);
      return { success: true, activeTitle: null };
    }

    const titleDef = TITLE_DEFINITIONS[titleId];
    if (!titleDef) {
      return { success: false, activeTitle: null, reason: 'Título inexistente no catálogo.' };
    }

    const unlockedTitles = await this.achievementRepo.getUnlockedTitles(characterId);
    if (!unlockedTitles.includes(titleId)) {
      return { success: false, activeTitle: null, reason: 'Você ainda não desbloqueou este título.' };
    }

    await this.achievementRepo.setActiveTitle(characterId, titleId);
    return { success: true, activeTitle: titleId, titleDef };
  }
}
