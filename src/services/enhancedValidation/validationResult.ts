/**
 * Validation Result Types
 * Define ValidationResult interface with field-specific errors/warnings
 */

export interface ValidationError {
  field: string;
  code: string;
  message: string;
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
}

/**
 * Validation Result
 */
export interface ValidationResult {
  isValid: boolean;
  isPotentiallyValid: boolean;
  cardNumber: string;
  cardType?: {
    niceType: string;
    type: string;
    // credit-card-type patterns can be a mix of numbers and number-ranges.
    patterns: Array<number | number[]>;
    gaps: number[];
    lengths: number[];
    code?: {
      name: string;
      size: number;
    };
  };
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata?: {
    luhnValid?: boolean;
    lengthValid?: boolean;
    formatValid?: boolean;
    networkDetected?: string;
  };
}

/**
 * Real-time validation result (for partial input)
 */
export interface RealTimeValidationResult {
  input: string;
  isValid: boolean;
  isPotentiallyValid: boolean;
  currentLength: number;
  expectedLength?: number;
  detectedNetwork?: string;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions?: string[];
}
