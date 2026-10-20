import { IDatabase } from '../db/index.js';
import { PendingRewardItem } from '@noobrpg/shared';
import { randomUUID } from 'node:crypto';

export interface PendingRewardRecord {
  id: string;
  character_id: string;
  item_id: string;
  quantity: number;
  source: string;
  created_at?: string;
}

export class PendingRewardRepository {
  constructor(private db: IDatabase) {}

  public async getByCharacterId(characterId: string, tx?: IDatabase): Promise<PendingRewardItem[]> {
    const client = tx || this.db;
    const rows = await client.query<PendingRewardRecord>(
      'SELECT id, character_id, item_id, quantity, source, created_at FROM character_pending_rewards WHERE character_id = ? ORDER BY created_at ASC;',
      [characterId]
    );

    return rows.map(r => ({
      id: r.id,
      itemId: r.item_id,
      quantity: Number(r.quantity),
      source: r.source,
      createdAt: r.created_at
    }));
  }

  public async savePendingRewards(
    characterId: string,
    items: PendingRewardItem[],
    tx?: IDatabase
  ): Promise<void> {
    const client = tx || this.db;

    // Remove as pendências anteriores do personagem
    await client.execute('DELETE FROM character_pending_rewards WHERE character_id = ?;', [characterId]);

    // Insere as pendências ativas
    for (const item of items) {
      if (item.quantity > 0 && item.itemId) {
        const id = item.id || randomUUID();
        await client.execute(
          'INSERT INTO character_pending_rewards (id, character_id, item_id, quantity, source) VALUES (?, ?, ?, ?, ?);',
          [id, characterId, item.itemId, item.quantity, item.source || 'system']
        );
      }
    }
  }

  public async addPendingReward(
    characterId: string,
    reward: { itemId: string; quantity: number; source: string },
    tx?: IDatabase
  ): Promise<PendingRewardItem> {
    const client = tx || this.db;
    const id = randomUUID();
    await client.execute(
      'INSERT INTO character_pending_rewards (id, character_id, item_id, quantity, source) VALUES (?, ?, ?, ?, ?);',
      [id, characterId, reward.itemId, reward.quantity, reward.source]
    );

    return {
      id,
      itemId: reward.itemId,
      quantity: reward.quantity,
      source: reward.source,
      createdAt: new Date().toISOString()
    };
  }

  public async deleteById(id: string, tx?: IDatabase): Promise<void> {
    const client = tx || this.db;
    await client.execute('DELETE FROM character_pending_rewards WHERE id = ?;', [id]);
  }
}
