import { ITokenOperations } from './types.js';
import { ILedgerAdapter, LedgerRewardItem } from './ledgerAdapter.js';

export interface ReconciliationAuditReport {
  timestamp: string;
  totalConfirmedAmountRaw: number;
  totalConfirmedRewardsCount: number;
  totalSubmittedRewardsCount: number;
  divergentSignatures: string[];
  isBalanced: boolean;
  notes: string[];
}

export class LedgerReconciler {
  constructor(
    private ledger: ILedgerAdapter,
    private tokenOps: ITokenOperations
  ) {}

  /**
   * Executa auditoria contábil completa entre o ledger interno e o estado on-chain da Solana
   */
  public async auditReconciliation(allRewards: LedgerRewardItem[]): Promise<ReconciliationAuditReport> {
    const report: ReconciliationAuditReport = {
      timestamp: new Date().toISOString(),
      totalConfirmedAmountRaw: 0,
      totalConfirmedRewardsCount: 0,
      totalSubmittedRewardsCount: 0,
      divergentSignatures: [],
      isBalanced: true,
      notes: []
    };

    for (const r of allRewards) {
      if (r.status === 'CONFIRMED') {
        report.totalConfirmedAmountRaw += r.amountRaw;
        report.totalConfirmedRewardsCount++;

        if (r.onchainTxSignature) {
          const status = await this.tokenOps.getSignatureStatus(r.onchainTxSignature);
          if (!status.confirmed) {
            report.divergentSignatures.push(r.onchainTxSignature);
            report.isBalanced = false;
            report.notes.push(`Recompensa ${r.id} marcada como CONFIRMED, mas assinatura ${r.onchainTxSignature} não está confirmada na rede.`);
          }
        } else {
          report.isBalanced = false;
          report.notes.push(`Recompensa ${r.id} confirmada sem assinatura on-chain associada.`);
        }
      } else if (r.status === 'SUBMITTED') {
        report.totalSubmittedRewardsCount++;
      }
    }

    if (report.divergentSignatures.length === 0 && report.isBalanced) {
      report.notes.push('Reconciliação 100% equilibrada: todas as recompensas confirmadas conferem com o estado on-chain.');
    }

    return report;
  }
}
