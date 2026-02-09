import { AMLCase } from './caseManager';

export interface SARReport {
  id: string;
  generatedAt: string;
  caseId: string;
  summary: string;
  evidence: {
    alerts: AMLCase['alerts'];
    notes: string[];
  };
}

/**
 * Compliance Reporter (Phase 7)
 *
 * Minimal SAR generator. Replace with regulator-specific formats as needed.
 */
export class ComplianceReporter {
  public generateSAR(amlCase: AMLCase): SARReport {
    return {
      id: `sar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      generatedAt: new Date().toISOString(),
      caseId: amlCase.id,
      summary: `SAR generated for case ${amlCase.id} with ${amlCase.alerts.length} alerts.`,
      evidence: {
        alerts: amlCase.alerts,
        notes: amlCase.notes,
      },
    };
  }
}

export const complianceReporter = new ComplianceReporter();

