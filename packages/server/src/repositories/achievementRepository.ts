import { randomUUID } from 'node:crypto';
import { IDatabase, CharacterAchievementRecord, CharacterTitleRecord } from '../db/index.js';

export class AchievementRepository {
  constructor(private db: IDatabase) {}

  public async getAllAchievements(
    characterId: string,
    tx?: IDatabase
  ): Promise<CharacterAchievementRecord[]> {
    const client = tx || this.db;
    return client.query<CharacterAchievementRecord>(
      'SELECT id, character_id, achievement_id, progress, completed, unlocked_at, reward_claimed, created_at, updated_at FROM character_achievements WHERE character_id = ? ORDER BY created_at ASC;',
      [characterId]
    );
  }

  public async getAchievement(
    characterId: string,
    achievementId: string,
    tx?: IDatabase
  ): Promise<CharacterAchievementRecord | null> {
    const client = tx || this.db;
    const rows = await client.query<CharacterAchievementRecord>(
      'SELECT id, character_id, achievement_id, progress, completed, unlocked_at, reward_claimed, created_at, updated_at FROM character_achievements WHERE character_id = ? AND achievement_id = ?;',
      [characterId, achievementId]
    );
    return rows[0] || null;
  }

  public async saveProgress(
    characterId: string,
    achievementId: string,
    progress: number,
    completed: boolean,
    unlockedAt?: string | null,
    tx?: IDatabase
  ): Promise<void> {
    const client = tx || this.db;
    const existing = await this.getAchievement(characterId, achievementId, client);

    const now = new Date().toISOString();
    const completedInt = completed ? 1 : 0;
    const effectiveUnlockedAt = completed ? (unlockedAt || existing?.unlocked_at || now) : null;

    if (existing) {
      await client.execute(
        `UPDATE character_achievements 
         SET progress = ?, completed = ?, unlocked_at = ?, updated_at = ? 
         WHERE character_id = ? AND achievement_id = ?;`,
        [progress, completedInt, effectiveUnlockedAt, now, characterId, achievementId]
      );
    } else {
      const id = randomUUID();
      await client.execute(
        `INSERT INTO character_achievements (id, character_id, achievement_id, progress, completed, unlocked_at, reward_claimed, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?);`,
        [id, characterId, achievementId, progress, completedInt, effectiveUnlockedAt, now, now]
      );
    }
  }

  public async claimReward(
    characterId: string,
    achievementId: string,
    tx?: IDatabase
  ): Promise<boolean> {
    const client = tx || this.db;
    const existing = await this.getAchievement(characterId, achievementId, client);
    if (!existing || existing.completed !== 1 || existing.reward_claimed === 1) {
      return false;
    }

    const res = await client.execute(
      `UPDATE character_achievements 
       SET reward_claimed = 1, updated_at = ? 
       WHERE character_id = ? AND achievement_id = ? AND reward_claimed = 0;`,
      [new Date().toISOString(), characterId, achievementId]
    );

    return res.changes > 0;
  }

  public async getUnlockedTitles(characterId: string, tx?: IDatabase): Promise<string[]> {
    const client = tx || this.db;
    const rows = await client.query<CharacterTitleRecord>(
      'SELECT title_id FROM character_titles WHERE character_id = ? ORDER BY unlocked_at ASC;',
      [characterId]
    );
    return rows.map(r => r.title_id);
  }

  public async unlockTitle(characterId: string, titleId: string, tx?: IDatabase): Promise<boolean> {
    const client = tx || this.db;
    const existing = await client.query<{ title_id: string }>(
      'SELECT title_id FROM character_titles WHERE character_id = ? AND title_id = ?;',
      [characterId, titleId]
    );

    if (existing.length > 0) {
      return false; // Já desbloqueado
    }

    const id = randomUUID();
    await client.execute(
      'INSERT INTO character_titles (id, character_id, title_id, unlocked_at) VALUES (?, ?, ?, ?);',
      [id, characterId, titleId, new Date().toISOString()]
    );
    return true;
  }

  public async getActiveTitle(characterId: string, tx?: IDatabase): Promise<string | null> {
    const client = tx || this.db;
    const rows = await client.query<{ title_id: string }>(
      'SELECT title_id FROM character_active_title WHERE character_id = ?;',
      [characterId]
    );
    return rows[0]?.title_id || null;
  }

  public async setActiveTitle(
    characterId: string,
    titleId: string | null,
    tx?: IDatabase
  ): Promise<void> {
    const client = tx || this.db;
    if (!titleId) {
      await client.execute('DELETE FROM character_active_title WHERE character_id = ?;', [characterId]);
      return;
    }

    const existing = await this.getActiveTitle(characterId, client);
    const now = new Date().toISOString();

    if (existing) {
      await client.execute(
        'UPDATE character_active_title SET title_id = ?, updated_at = ? WHERE character_id = ?;',
        [titleId, now, characterId]
      );
    } else {
      await client.execute(
        'INSERT INTO character_active_title (character_id, title_id, updated_at) VALUES (?, ?, ?);',
        [characterId, titleId, now]
      );
    }
  }
}
