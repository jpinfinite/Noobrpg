export interface LedgerRewardItem {
  id: string;
  characterId: string;
  accountId: string;
  rewardType: string;
  amountRaw: number;
  status: 'APPROVED' | 'QUEUED' | 'SUBMITTED' | 'CONFIRMED' | 'CANCELLED';
  idempotencyKey: string;
  onchainTxSignature?: string | null;
  recipientWallet?: string;
}

export interface ILedgerAdapter {
  fetchApprovedRewards(limit: number): Promise<LedgerRewardItem[]>;
  fetchSubmittedRewards(limit: number): Promise<LedgerRewardItem[]>;
  markQueued(rewardId: string): Promise<void>;
  markSubmitted(rewardId: string, signature: string): Promise<void>;
  markConfirmed(rewardId: string, signature: string): Promise<void>;
  markCancelled(rewardId: string, reason: string): Promise<void>;
  getRecipientPublicKey(characterId: string): Promise<string | null>;
}

/**
 * Adapter em memória para testes unitários e simulações do Worker sem banco de dados externo
 */
export class InMemoryLedgerAdapter implements ILedgerAdapter {
  public rewards: Map<string, LedgerRewardItem> = new Map();
  public wallets: Map<string, string> = new Map();

  public async fetchApprovedRewards(limit: number): Promise<LedgerRewardItem[]> {
    const list: LedgerRewardItem[] = [];
    for (const item of this.rewards.values()) {
      if (item.status === 'APPROVED') {
        const wallet = this.wallets.get(item.characterId);
        list.push({ ...item, recipientWallet: wallet });
        if (list.length >= limit) break;
      }
    }
    return list;
  }

  public async fetchSubmittedRewards(limit: number): Promise<LedgerRewardItem[]> {
    const list: LedgerRewardItem[] = [];
    for (const item of this.rewards.values()) {
      if (item.status === 'SUBMITTED') {
        list.push({ ...item });
        if (list.length >= limit) break;
      }
    }
    return list;
  }

  public async markQueued(rewardId: string): Promise<void> {
    const r = this.rewards.get(rewardId);
    if (!r) throw new Error(`Recompensa ${rewardId} não encontrada`);
    if (r.status !== 'APPROVED') throw new Error(`Transição inválida de ${r.status} para QUEUED`);
    r.status = 'QUEUED';
  }

  public async markSubmitted(rewardId: string, signature: string): Promise<void> {
    const r = this.rewards.get(rewardId);
    if (!r) throw new Error(`Recompensa ${rewardId} não encontrada`);
    if (r.status !== 'QUEUED') throw new Error(`Transição inválida de ${r.status} para SUBMITTED`);
    r.status = 'SUBMITTED';
    r.onchainTxSignature = signature;
  }

  public async markConfirmed(rewardId: string, signature: string): Promise<void> {
    const r = this.rewards.get(rewardId);
    if (!r) throw new Error(`Recompensa ${rewardId} não encontrada`);
    if (r.status !== 'SUBMITTED') throw new Error(`Transição inválida de ${r.status} para CONFIRMED`);
    r.status = 'CONFIRMED';
    r.onchainTxSignature = signature;
  }

  public async markCancelled(rewardId: string, reason: string): Promise<void> {
    const r = this.rewards.get(rewardId);
    if (!r) throw new Error(`Recompensa ${rewardId} não encontrada`);
    r.status = 'CANCELLED';
  }

  public async getRecipientPublicKey(characterId: string): Promise<string | null> {
    return this.wallets.get(characterId) || null;
  }
}
