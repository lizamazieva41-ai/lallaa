export type AMLRuleSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AMLRule {
  id: string;
  name: string;
  severity: AMLRuleSeverity;
  description: string;
  condition: (ctx: AMLContext) => boolean;
}

export interface AMLContext {
  amount?: number;
  currency?: string;
  merchantCountry?: string;
  ipCountry?: string;
  bin?: string;
  userId?: string;
}

export interface AMLAlert {
  id: string;
  ruleId: string;
  severity: AMLRuleSeverity;
  message: string;
  createdAt: string;
}

/**
 * AML Rule Engine (Phase 7)
 *
 * Minimal rule-based engine with in-memory rule definitions.
 * Replace or extend with config-driven rules and persistence as needed.
 */
export class AMLRuleEngine {
  private rules: AMLRule[] = [];

  constructor() {
    this.rules = this.defaultRules();
  }

  public evaluate(ctx: AMLContext): AMLAlert[] {
    const alerts: AMLAlert[] = [];
    for (const rule of this.rules) {
      if (rule.condition(ctx)) {
        alerts.push({
          id: `aml-alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.description,
          createdAt: new Date().toISOString(),
        });
      }
    }
    return alerts;
  }

  public listRules(): Array<Pick<AMLRule, 'id' | 'name' | 'severity' | 'description'>> {
    return this.rules.map(r => ({ id: r.id, name: r.name, severity: r.severity, description: r.description }));
  }

  private defaultRules(): AMLRule[] {
    return [
      {
        id: 'geo-mismatch',
        name: 'Geo mismatch',
        severity: 'medium',
        description: 'Merchant country and IP country mismatch may indicate suspicious activity.',
        condition: (ctx) =>
          Boolean(ctx.merchantCountry && ctx.ipCountry && ctx.merchantCountry !== ctx.ipCountry),
      },
      {
        id: 'high-amount',
        name: 'High amount threshold',
        severity: 'high',
        description: 'High amount transaction requires review.',
        condition: (ctx) => typeof ctx.amount === 'number' && ctx.amount >= 10000,
      },
    ];
  }
}

export const amlRuleEngine = new AMLRuleEngine();

