import { AMLAlert } from './ruleEngine';

export type AMLCaseStatus = 'open' | 'in_review' | 'closed';

export interface AMLCase {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: AMLCaseStatus;
  subject?: {
    userId?: string;
    bin?: string;
  };
  alerts: AMLAlert[];
  notes: string[];
}

/**
 * AML Case Manager (Phase 7)
 *
 * Minimal in-memory implementation. For production, persist to DB.
 */
export class AMLCaseManager {
  private cases: Map<string, AMLCase> = new Map();

  public createCase(input: { alerts: AMLAlert[]; userId?: string; bin?: string; note?: string }): AMLCase {
    const id = `aml-case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const c: AMLCase = {
      id,
      createdAt: now,
      updatedAt: now,
      status: 'open',
      subject: { userId: input.userId, bin: input.bin },
      alerts: input.alerts,
      notes: input.note ? [input.note] : [],
    };
    this.cases.set(id, c);
    return c;
  }

  public getCase(id: string): AMLCase | null {
    return this.cases.get(id) || null;
  }

  public listCases(): AMLCase[] {
    return Array.from(this.cases.values());
  }

  public addNote(id: string, note: string): AMLCase | null {
    const c = this.cases.get(id);
    if (!c) return null;
    c.notes.push(note);
    c.updatedAt = new Date().toISOString();
    return c;
  }

  public setStatus(id: string, status: AMLCaseStatus): AMLCase | null {
    const c = this.cases.get(id);
    if (!c) return null;
    c.status = status;
    c.updatedAt = new Date().toISOString();
    return c;
  }
}

export const amlCaseManager = new AMLCaseManager();

