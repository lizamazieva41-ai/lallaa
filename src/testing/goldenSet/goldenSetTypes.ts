import { CardNetwork, CardType } from '../../types';

/**
 * Verification method for golden set records
 */
export type VerificationMethod = 'cross-source' | 'manual' | 'authoritative';

/**
 * Verified field with source information and confidence
 */
export interface VerifiedField<T = string> {
  value: T;
  sources: string[];
  confidence: number;
}

/**
 * Verified fields for a BIN record
 */
export interface VerifiedFields {
  country: VerifiedField<string>;
  network: VerifiedField<CardNetwork>;
  issuer?: VerifiedField<string>;
  type?: VerifiedField<CardType>;
}

/**
 * Golden Set Record - A verified BIN record with cross-source validation
 */
export interface GoldenSetRecord {
  bin: string;
  verifiedFields: VerifiedFields;
  verificationMethod: VerificationMethod;
  lastVerified: Date;
  verificationNotes?: string;
}

/**
 * Source agreement information
 */
export interface SourceAgreement {
  field: keyof VerifiedFields;
  sources: string[];
  agreementRate: number;
  conflictingSources?: string[];
}

/**
 * Golden Set statistics
 */
export interface GoldenSetStatistics {
  totalRecords: number;
  byVerificationMethod: Record<VerificationMethod, number>;
  bySourceCount: Record<number, number>; // Number of sources per record
  averageConfidence: number;
  sourceAgreementRates: Record<keyof VerifiedFields, number>;
}

/**
 * Golden Set validation result
 */
export interface GoldenSetValidationResult {
  record: GoldenSetRecord;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sourceAgreements: SourceAgreement[];
}
