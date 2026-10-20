import { NOOBCOIN_DECIMALS } from '@noobrpg/shared';
import { IDatabase, NoobCoinRewardRecord, NoobCoinRewardStatus } from '../db/index.js';
import { NoobCoinRepository, CreateRewardParams } from '../repositories/noobcoinRepository.js';

export interface GrantRewardInput {
  characterId: string;
  accountId: string;
  rewardType: string;
  sourceEvent: string;
  amountRaw: number; // Em unidades mínimas (6 decimais: 1 NOOB = 1.000.000)
  idempotencyKey: string;
  sourceOperationId?: string;
}

export interface GrantRewardResult {
  success: boolean;
  reward?: NoobCoinRewardRecord;
  isDuplicate?: boolean;
  error?: string;
  code?:
    | 'SUCCESS'
    | 'DUPLICATE_OPERATION'
    | 'INVALID_AMOUNT'
    | 'DISTRIBUTION_PAUSED'
    | 'DAILY_CHARACTER_LIMIT_EXCEEDED'
    | 'DAILY_ACCOUNT_LIMIT_EXCEEDED'
    | 'INTERNAL_ERROR';
}

export class NoobCoinRewardService {
  constructor(
    private db: IDatabase,
    private noobcoinRepo: NoobCoinRepository
  ) {}

  /**
   * Converte representação decimal em unidades mínimas inteiras (6 casas decimais)
   * sem risco de imprecisão de ponto flutuante IEEE-754.
   * Ex: "1.5" -> 1500000; "100" -> 100000000
   */
  public static parseUnits(decimalStr: string, decimals: number = NOOBCOIN_DECIMALS): number {
    const trimmed = decimalStr.trim();
    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
      throw new Error(`Formato decimal inválido para unidades NOOB: '${decimalStr}'`);
    }

    const parts = trimmed.split('.');
    const whole = parts[0];
    let frac = parts[1] || '';

    if (frac.length > decimals) {
      throw new Error(`Número excessivo de casas decimais (máximo ${decimals}): '${decimalStr}'`);
    }

    frac = frac.padEnd(decimals, '0');
    const fullIntStr = whole + frac;
    const value = Number(fullIntStr);

    if (!Number.isSafeInteger(value)) {
      throw new Error(`Valor excede limite de inteiro seguro em JS: '${decimalStr}'`);
    }

    return value;
  }

  /**
   * Converte unidades mínimas inteiras para representação em string legível
   * Ex: 1500000 -> "1.500000" NOOB
   */
  public static formatUnits(amountRaw: number, decimals: number = NOOBCOIN_DECIMALS): string {
    if (!Number.isInteger(amountRaw) || amountRaw < 0 || !Number.isSafeInteger(amountRaw)) {
      throw new Error(`Quantidade bruta inválida ou insegura: ${amountRaw}`);
    }

    const str = amountRaw.toString().padStart(decimals + 1, '0');
    const whole = str.slice(0, -decimals) || '0';
    const frac = str.slice(-decimals);
    return `${whole}.${frac}`;
  }

  /**
   * Obtém a data corrente em formato UTC (YYYY-MM-DD) para consolidação diária
   */
  private getTodayUtcDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Concede uma recompensa autoritativa no livro-razão interno com checagem de limites e idempotência
   */
  public async grantReward(input: GrantRewardInput): Promise<GrantRewardResult> {
    // 1. Validação estrita de quantidade inteira
    if (!Number.isInteger(input.amountRaw) || input.amountRaw <= 0 || !Number.isSafeInteger(input.amountRaw)) {
      return {
        success: false,
        code: 'INVALID_AMOUNT',
        error: 'A quantidade de NOOB deve ser um número inteiro estritamente positivo e seguro.'
      };
    }

    // 2. Garante parâmetros padrão de configuração
    await this.noobcoinRepo.ensureDefaultConfig();

    // 3. Checagem de pausa do sistema
    const pausedVal = await this.noobcoinRepo.getConfigValue('distribution_paused');
    if (pausedVal === '1') {
      return {
        success: false,
        code: 'DISTRIBUTION_PAUSED',
        error: 'A distribuição de recompensas NoobCoin está temporariamente pausada para auditoria.'
      };
    }

    // 4. Checagem de idempotência rápida antes da transação
    const existing = await this.noobcoinRepo.getRewardByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      return {
        success: true,
        reward: existing,
        isDuplicate: true,
        code: 'DUPLICATE_OPERATION'
      };
    }

    const today = this.getTodayUtcDate();

    // 5. Consulta limites diários configurados
    const charLimitStr = await this.noobcoinRepo.getConfigValue('daily_character_limit_raw');
    const accLimitStr = await this.noobcoinRepo.getConfigValue('daily_account_limit_raw');
    const charLimit = charLimitStr ? Number(charLimitStr) : 100_000_000; // 100 NOOB
    const accLimit = accLimitStr ? Number(accLimitStr) : 250_000_000;    // 250 NOOB

    // 6. Transação atômica ACID de validação de teto e registro
    return this.db.transaction(async tx => {
      // Revalida idempotência dentro da transação
      const txExisting = await this.noobcoinRepo.getRewardByIdempotencyKey(input.idempotencyKey, tx);
      if (txExisting) {
        return {
          success: true,
          reward: txExisting,
          isDuplicate: true,
          code: 'DUPLICATE_OPERATION'
        };
      }

      // Consulta montantes já acumulados no dia
      const charDailyCurrent = await this.noobcoinRepo.getDailyAmount('CHARACTER', input.characterId, today, tx);
      if (charDailyCurrent + input.amountRaw > charLimit) {
        return {
          success: false,
          code: 'DAILY_CHARACTER_LIMIT_EXCEEDED',
          error: `Limite diário por personagem excedido. Atual: ${charDailyCurrent}, Tentado: ${input.amountRaw}, Teto: ${charLimit}`
        };
      }

      const accDailyCurrent = await this.noobcoinRepo.getDailyAmount('ACCOUNT', input.accountId, today, tx);
      if (accDailyCurrent + input.amountRaw > accLimit) {
        return {
          success: false,
          code: 'DAILY_ACCOUNT_LIMIT_EXCEEDED',
          error: `Limite diário por conta excedido. Atual: ${accDailyCurrent}, Tentado: ${input.amountRaw}, Teto: ${accLimit}`
        };
      }

      // Registra a recompensa no ledger como APPROVED
      const params: CreateRewardParams = {
        characterId: input.characterId,
        accountId: input.accountId,
        rewardType: input.rewardType,
        sourceEvent: input.sourceEvent,
        amountRaw: input.amountRaw,
        idempotencyKey: input.idempotencyKey,
        sourceOperationId: input.sourceOperationId,
        initialStatus: 'APPROVED'
      };

      const recordRes = await this.noobcoinRepo.recordReward(params, tx);

      // Se for registro novo, incrementa os limites diários
      if (!recordRes.isDuplicate) {
        await this.noobcoinRepo.addDailyAmount('CHARACTER', input.characterId, today, input.amountRaw, tx);
        await this.noobcoinRepo.addDailyAmount('ACCOUNT', input.accountId, today, input.amountRaw, tx);
      }

      return {
        success: true,
        reward: recordRes.reward,
        isDuplicate: recordRes.isDuplicate,
        code: recordRes.isDuplicate ? 'DUPLICATE_OPERATION' : 'SUCCESS'
      };
    });
  }

  /**
   * Pausa a distribuição global de recompensas
   */
  public async pauseDistribution(): Promise<void> {
    await this.noobcoinRepo.setConfigValue('distribution_paused', '1');
  }

  /**
   * Retoma a distribuição global de recompensas
   */
  public async resumeDistribution(): Promise<void> {
    await this.noobcoinRepo.setConfigValue('distribution_paused', '0');
  }

  /**
   * Verifica se o subsistema está pausado
   */
  public async isDistributionPaused(): Promise<boolean> {
    const val = await this.noobcoinRepo.getConfigValue('distribution_paused');
    return val === '1';
  }

  /**
   * Configura os limites diários de distribuição
   */
  public async setDailyLimits(characterLimitRaw: number, accountLimitRaw: number): Promise<void> {
    if (
      !Number.isInteger(characterLimitRaw) ||
      !Number.isInteger(accountLimitRaw) ||
      characterLimitRaw <= 0 ||
      accountLimitRaw <= 0 ||
      !Number.isSafeInteger(characterLimitRaw) ||
      !Number.isSafeInteger(accountLimitRaw)
    ) {
      throw new Error('Limites diários devem ser números inteiros estritamente positivos e seguros.');
    }
    await this.noobcoinRepo.setConfigValue('daily_character_limit_raw', characterLimitRaw.toString());
    await this.noobcoinRepo.setConfigValue('daily_account_limit_raw', accountLimitRaw.toString());
  }

  /**
   * Consulta histórico de recompensas de um personagem
   */
  public async getCharacterHistory(characterId: string, limit: number = 50): Promise<NoobCoinRewardRecord[]> {
    return this.noobcoinRepo.getRewardsByCharacter(characterId, limit);
  }

  /**
   * Consulta histórico de recompensas de uma conta
   */
  public async getAccountHistory(accountId: string, limit: number = 50): Promise<NoobCoinRewardRecord[]> {
    return this.noobcoinRepo.getRewardsByAccount(accountId, limit);
  }

  /**
   * Consulta totais acumulados no dia atual
   */
  public async getDailyUsage(characterId: string, accountId: string): Promise<{ characterTotal: number; accountTotal: number }> {
    const today = this.getTodayUtcDate();
    const characterTotal = await this.noobcoinRepo.getDailyAmount('CHARACTER', characterId, today);
    const accountTotal = await this.noobcoinRepo.getDailyAmount('ACCOUNT', accountId, today);
    return { characterTotal, accountTotal };
  }
}
