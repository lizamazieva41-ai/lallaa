/**
 * Custom Error Classes
 * Error classes for workflow and integration operations
 */

/**
 * Base error class for workflow operations
 */
export class WorkflowError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly recoverable: boolean;

  constructor(
    message: string,
    code: string = 'WORKFLOW_ERROR',
    statusCode: number = 500,
    recoverable: boolean = false,
  ) {
    super(message);
    this.name = 'WorkflowError';
    this.code = code;
    this.statusCode = statusCode;
    this.recoverable = recoverable;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Get error recovery strategy
   */
  getRecoveryStrategy(): string {
    if (!this.recoverable) {
      return 'No recovery available';
    }

    switch (this.code) {
      case 'WORKFLOW_TIMEOUT':
        return 'Retry with exponential backoff';
      case 'WORKFLOW_PARTIAL_FAILURE':
        return 'Continue with remaining cards';
      case 'WORKFLOW_RATE_LIMIT':
        return 'Wait and retry after rate limit window';
      default:
        return 'Retry operation';
    }
  }
}

/**
 * Error class for Doremon AI API operations
 */
export class DoremonAPIError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly retryable: boolean;
  public readonly retryAfter?: number;

  constructor(
    message: string,
    code: string = 'DOREMON_API_ERROR',
    statusCode: number = 500,
    retryable: boolean = false,
    retryAfter?: number,
  ) {
    super(message);
    this.name = 'DoremonAPIError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.retryAfter = retryAfter;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return this.retryable && (
      this.statusCode >= 500 || // Server errors
      this.statusCode === 429 || // Rate limit
      this.statusCode === 408   // Timeout
    );
  }

  /**
   * Get retry delay in milliseconds
   */
  getRetryDelay(attempt: number, baseDelay: number = 1000): number {
    if (this.retryAfter) {
      return this.retryAfter * 1000; // Convert seconds to milliseconds
    }
    return baseDelay * Math.pow(2, attempt); // Exponential backoff
  }
}

/**
 * Error class for Excel export operations
 */
export class ExcelExportError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly filePath?: string;

  constructor(
    message: string,
    code: string = 'EXCEL_EXPORT_ERROR',
    statusCode: number = 500,
    filePath?: string,
  ) {
    super(message);
    this.name = 'ExcelExportError';
    this.code = code;
    this.statusCode = statusCode;
    this.filePath = filePath;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Get error details for logging
   */
  getErrorDetails(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      filePath: this.filePath,
      statusCode: this.statusCode,
    };
  }
}

/**
 * Error codes enumeration
 */
export enum ErrorCode {
  // Workflow errors
  WORKFLOW_NOT_FOUND = 'WORKFLOW_NOT_FOUND',
  WORKFLOW_TIMEOUT = 'WORKFLOW_TIMEOUT',
  WORKFLOW_PARTIAL_FAILURE = 'WORKFLOW_PARTIAL_FAILURE',
  WORKFLOW_RATE_LIMIT = 'WORKFLOW_RATE_LIMIT',
  WORKFLOW_INVALID_INPUT = 'WORKFLOW_INVALID_INPUT',

  // Doremon API errors
  DOREMON_API_ERROR = 'DOREMON_API_ERROR',
  DOREMON_API_TIMEOUT = 'DOREMON_API_TIMEOUT',
  DOREMON_API_UNAUTHORIZED = 'DOREMON_API_UNAUTHORIZED',
  DOREMON_API_RATE_LIMIT = 'DOREMON_API_RATE_LIMIT',
  DOREMON_API_NOT_FOUND = 'DOREMON_API_NOT_FOUND',

  // Excel export errors
  EXCEL_EXPORT_ERROR = 'EXCEL_EXPORT_ERROR',
  EXCEL_EXPORT_FILE_ERROR = 'EXCEL_EXPORT_FILE_ERROR',
  EXCEL_EXPORT_VALIDATION_ERROR = 'EXCEL_EXPORT_VALIDATION_ERROR',
}

/**
 * Error recovery strategies
 */
export interface ErrorRecoveryStrategy {
  retry: boolean;
  maxRetries: number;
  backoffStrategy: 'exponential' | 'linear' | 'fixed';
  backoffDelay: number;
  fallbackAction?: () => Promise<unknown>;
}

/**
 * Get recovery strategy for error code
 */
export function getRecoveryStrategy(errorCode: string): ErrorRecoveryStrategy {
  const strategies: Record<string, ErrorRecoveryStrategy> = {
    [ErrorCode.WORKFLOW_TIMEOUT]: {
      retry: true,
      maxRetries: 3,
      backoffStrategy: 'exponential',
      backoffDelay: 1000,
    },
    [ErrorCode.DOREMON_API_TIMEOUT]: {
      retry: true,
      maxRetries: 3,
      backoffStrategy: 'exponential',
      backoffDelay: 2000,
    },
    [ErrorCode.DOREMON_API_RATE_LIMIT]: {
      retry: true,
      maxRetries: 5,
      backoffStrategy: 'fixed',
      backoffDelay: 60000, // 1 minute
    },
    [ErrorCode.EXCEL_EXPORT_FILE_ERROR]: {
      retry: true,
      maxRetries: 2,
      backoffStrategy: 'linear',
      backoffDelay: 500,
    },
  };

  return strategies[errorCode] || {
    retry: false,
    maxRetries: 0,
    backoffStrategy: 'fixed',
    backoffDelay: 0,
  };
}
