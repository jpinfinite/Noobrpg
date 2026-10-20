import { IDatabase } from '../db/index.js';
import { QuestProgress } from '@noobrpg/shared';

export interface CharacterQuestRecord {
  character_id: string;
  quest_id: string;
  step: number;
  completed: number;
  rewards_claimed: string;
  created_at?: string;
  updated_at?: string;
}

export class QuestRepository {
  constructor(private db: IDatabase) {}

  public async getQuest(characterId: string, questId: string, tx?: IDatabase): Promise<QuestProgress | null> {
    const client = tx || this.db;
    const rows = await client.query<CharacterQuestRecord>(
      'SELECT * FROM character_quests WHERE character_id = ? AND quest_id = ?;',
      [characterId, questId]
    );

    if (!rows || rows.length === 0) return null;
    return this.mapRecordToProgress(rows[0]);
  }

  public async getAllQuests(characterId: string, tx?: IDatabase): Promise<Record<string, QuestProgress>> {
    const client = tx || this.db;
    const rows = await client.query<CharacterQuestRecord>(
      'SELECT * FROM character_quests WHERE character_id = ?;',
      [characterId]
    );

    const result: Record<string, QuestProgress> = {};
    for (const row of rows) {
      result[row.quest_id] = this.mapRecordToProgress(row);
    }
    return result;
  }

  public async saveQuest(characterId: string, quest: QuestProgress, tx?: IDatabase): Promise<void> {
    const client = tx || this.db;
    const claimedJson = JSON.stringify(quest.claimedRewards || []);
    const completedInt = quest.completed ? 1 : 0;

    await client.execute(
      `INSERT INTO character_quests (
        character_id, quest_id, step, completed, rewards_claimed, updated_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(character_id, quest_id) DO UPDATE SET
        step = excluded.step,
        completed = excluded.completed,
        rewards_claimed = excluded.rewards_claimed,
        updated_at = CURRENT_TIMESTAMP;`,
      [characterId, quest.questId, quest.step, completedInt, claimedJson]
    );
  }

  private mapRecordToProgress(record: CharacterQuestRecord): QuestProgress {
    let claimedRewards: string[] = [];
    try {
      if (record.rewards_claimed) {
        claimedRewards = JSON.parse(record.rewards_claimed);
      }
    } catch {
      claimedRewards = [];
    }

    return {
      questId: record.quest_id,
      step: Number(record.step),
      completed: Boolean(record.completed === 1 || (record as any).completed === true),
      claimedRewards
    };
  }
}
