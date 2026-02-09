/**
 * Integration Types
 * TypeScript interfaces for card verification integration workflow
 */

/**
 * Request to start a workflow
 */
export interface WorkflowStartRequest {
  /** BIN code (6-8 digits) */
  bin: string;
  /** Number of cards to generate (optional, default: 10) */
  cardCount?: number;
  /** Number of months for expiry dates (optional, default: 12) */
  expiryMonths?: number;
  /** Whether to generate sequential card numbers (optional, default: false) */
  sequential?: boolean;
}

/**
 * Response for workflow status
 */
export interface WorkflowStatusResponse {
  /** Unique workflow identifier */
  workflowId: string;
  /** Current workflow status */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** Progress percentage (0-100) */
  progress: number;
  /** Process ID from doremon-ai (optional) */
  processId?: string;
  /** Error message if failed (optional) */
  errorMessage?: string;
  /** Workflow creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Response for workflow result
 */
export interface WorkflowResultResponse {
  /** Unique workflow identifier */
  workflowId: string;
  /** Final workflow status */
  status: string;
  /** URL to download the processed Excel file */
  excelFileUrl: string;
  /** Total number of cards processed */
  totalCards: number;
  /** Number of verified cards */
  verifiedCards: number;
  /** Number of failed cards */
  failedCards: number;
  /** Completion timestamp */
  completedAt: Date;
}
