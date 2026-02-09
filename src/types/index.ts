// User types
export enum UserTier {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  tier: UserTier;
  quotaLimit: number;
  quotaUsed: number;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  backupCodes?: string[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface UserPublic {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tier: UserTier;
  emailVerified: boolean;
  createdAt: Date;
}

// BIN types
export enum CardType {
  DEBIT = 'debit',
  CREDIT = 'credit',
  PREPAID = 'prepaid',
  CORPORATE = 'corporate',
}

export enum CardNetwork {
  VISA = 'visa',
  MASTERCARD = 'mastercard',
  AMEX = 'amex',
  JCB = 'jcb',
  UNIONPAY = 'unionpay',
  DISCOVER = 'discover',
  DINERS = 'diners',
  OTHER = 'other',
}

export interface BIN {
  bin: string;
  bankName: string;
  bankNameLocal?: string;
  countryCode: string;
  countryName: string;
  cardType: CardType;
  cardNetwork: CardNetwork;
  isActive: boolean;
  bankCode?: string;
  branchCode?: string;
  programType?: string;
  regulatoryType?: string;
  binRangeStart?: string;
  binRangeEnd?: string;
  length?: number;
  luhn?: boolean;
  scheme?: string;
  brand?: string;
  issuer?: string;
  country?: string;
  url?: string;
  phone?: string;
  city?: string;
  // Provenance fields (for admin/audit only)
  source: string;
  sourceVersion?: string;
  importDate?: Date;
  lastUpdated?: Date;
  raw?: Record<string, unknown>;
  confidenceScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BINLookupResult {
  bin: string;
  bank: {
    name: string;
    nameLocal?: string;
    code?: string;
    website?: string;
  };
  country: {
    code: string;
    name: string;
    emoji?: string;
  };
  card: {
    type: CardType;
    network: CardNetwork;
    brand?: string;
  };
  metadata?: {
    binRange?: string;
    issueDate?: string;
    expiryDate?: string;
    expectedLength?: number;
  };
}

// Country types
export interface Country {
  countryCode: string;
  countryName: string;
  continent: string;
  currencyCode: string;
  currencyName: string;
  ibanLength: number;
  bankCodeLength: number;
  accountNumberLength: number;
  exampleIban: string;
  ibanRegex: string;
  isSEPA: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// IBAN types
export interface IBANValidationResult {
  isValid: boolean;
  iban: string;
  countryCode: string;
  checkDigits: string;
  bban: string;
  bankCode?: string;
  accountNumber?: string;
  nationalCheckDigit?: string;
  formattedIban: string;
  errors?: string[];
}

export interface IBANGenerationOptions {
  countryCode: string;
  bankCode?: string;
  accountNumber?: string;
  includeCheckDigit?: boolean;
  format?: boolean;
}

// API Key types
export interface APIKey {
  id: string;
  keyId: string;
  userId: string;
  keyHash: string;
  keyPrefix: string;
  name: string;
  permissions: Record<string, unknown>;
  rateLimit: number;
  ipWhitelist: string[];
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface APIKeyPublic {
  id: string;
  keyId: string;
  name: string;
  rateLimit: number;
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
}

// Request types
export interface AuthRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  tier: UserTier;
  type: 'access' | 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    rateLimit?: {
      limit: number;
      remaining: number;
      resetAt: string;
    };
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error types
export class AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational: boolean,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Logger types
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

// Metrics types
export interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  responseTimePercentiles: {
    p50: number;
    p95: number;
    p99: number;
  };
}

export interface UsageMetrics {
  userId: string;
  period: string;
  totalRequests: number;
  binLookups: number;
  ibanValidations: number;
  ibanGenerations: number;
}

// 2FA types
export interface TwoFactorSetupResult {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface TwoFactorVerifyRequest {
  token: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
}

export interface PasswordReset {
  id: string;
  userId: string;
  token: string;
  tokenHash: string;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}

// Uniqueness Service types
export interface UniquenessCheckResult {
  isUnique: boolean;
  layer: 'bloom' | 'redis' | 'database' | 'pool' | 'final';
  cardHash: string;
}

export interface UniquenessReservationResult {
  reserved: boolean;
  cardHash: string;
  reservedUntil: Date;
}

// Job Queue types
export interface CardGenerationJobData {
  bin: string;
  count: number;
  expiryMonths?: number;
  sequential?: boolean;
  startSequence?: number;
  userId?: string;
  apiKeyId?: string;
  requestId?: string;
  generationMode: 'random' | 'sequential' | 'batch_999';
}

export interface JobStatus {
  jobId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: number;
  result?: any;
  error?: string;
  createdAt: Date;
  processedAt?: Date;
  finishedAt?: Date;
}

export interface JobResult {
  success: boolean;
  cardsGenerated: number;
  cards: Array<{
    cardNumber: string;
    bin: string;
    expiryDate: string;
    cvv: string;
  }>;
}

// WebSocket types
export interface WebSocketMessage {
  type: 'job:progress' | 'job:completed' | 'job:error';
  jobId: string;
  data?: any;
  timestamp: string;
}

export interface JobProgressMessage extends WebSocketMessage {
  type: 'job:progress';
  progress: number;
  message?: string;
}

export interface JobCompletedMessage extends WebSocketMessage {
  type: 'job:completed';
  result: JobResult;
}

export interface JobErrorMessage extends WebSocketMessage {
  type: 'job:error';
  error: string;
}

// Cache types
export interface CacheResult<T> {
  hit: boolean;
  data?: T;
  layer: 'local' | 'redis' | 'database';
}

export interface CacheStats {
  local: {
    hits: number;
    misses: number;
    size: number;
    evictions: number;
  };
  redis: {
    hits: number;
    misses: number;
  };
  database: {
    hits: number;
    misses: number;
  };
  localSize: number;
  hitRate: number;
}
