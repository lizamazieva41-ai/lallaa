import crypto from 'crypto';

export interface FraudSignal {
  code: string;
  message: string;
  weight: number; // 0..1 contribution
}

export interface FraudScoreInput {
  bin?: string;
  amount?: number;
  currency?: string;
  merchantCountry?: string;
  ipCountry?: string;
  userId?: string;
  occurredAt?: string; // ISO
}

export interface FraudScoreResult {
  score: number; // 0..1
  decision: 'allow' | 'review' | 'block';
  signals: FraudSignal[];
  modelVersion: string;
  requestId: string;
}

/**
 * FraudScorer
 *
 * Phase 6 placeholder implementation:
 * - Deterministic, explainable heuristic scoring
 * - Supports later replacement with ML inference (TFJS / external model server)
 */
export class FraudScorer {
  private modelVersion = 'heuristic-v1';

  public score(input: FraudScoreInput): FraudScoreResult {
    const requestId = `fraud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    const signals: FraudSignal[] = [];
    const amount = typeof input.amount === 'number' ? input.amount : 0;
    const bin = (input.bin || '').replace(/\s/g, '').slice(0, 8);
    const merchantCountry = (input.merchantCountry || '').toUpperCase();
    const ipCountry = (input.ipCountry || '').toUpperCase();

    // Basic sanity
    if (bin && !/^\d{6,8}$/.test(bin)) {
      signals.push({ code: 'BIN_FORMAT', message: 'BIN format invalid', weight: 0.15 });
    }

    // Geo mismatch
    if (merchantCountry && ipCountry && merchantCountry !== ipCountry) {
      signals.push({
        code: 'GEO_MISMATCH',
        message: `Merchant country (${merchantCountry}) != IP country (${ipCountry})`,
        weight: 0.25,
      });
    }

    // Amount-based heuristics
    if (amount >= 5000) {
      signals.push({ code: 'HIGH_AMOUNT', message: `High amount: ${amount}`, weight: 0.35 });
    } else if (amount >= 1000) {
      signals.push({ code: 'MEDIUM_AMOUNT', message: `Medium amount: ${amount}`, weight: 0.15 });
    }

    // BIN heuristic: test BINs often used in abuse
    if (bin.startsWith('411111') || bin.startsWith('555555') || bin.startsWith('424242')) {
      signals.push({
        code: 'COMMON_TEST_BIN',
        message: 'BIN matches common test patterns',
        weight: 0.2,
      });
    }

    // Time-based (simple): transactions at unusual hours in UTC
    if (input.occurredAt) {
      const d = new Date(input.occurredAt);
      if (!Number.isNaN(d.getTime())) {
        const hour = d.getUTCHours();
        if (hour <= 4) {
          signals.push({ code: 'NIGHT_ACTIVITY', message: 'Transaction in early UTC hours', weight: 0.1 });
        }
      }
    }

    // Aggregate (cap at 1)
    const score = Math.min(1, signals.reduce((s, x) => s + x.weight, 0));

    const decision: FraudScoreResult['decision'] =
      score >= 0.75 ? 'block' : score >= 0.4 ? 'review' : 'allow';

    return {
      score,
      decision,
      signals,
      modelVersion: this.modelVersion,
      requestId,
    };
  }

  public scoreBatch(inputs: FraudScoreInput[]): FraudScoreResult[] {
    return inputs.map(i => this.score(i));
  }
}

export const fraudScorer = new FraudScorer();

