import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

// Multi-tenant Row Level Security Architecture
export enum TenantTier {
  BASIC = 'basic',
  PROFESSIONAL = 'professional', 
  ENTERPRISE = 'enterprise',
  CUSTOM = 'custom'
}

export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
  TERMINATED = 'terminated'
}

export enum DataAccessLevel {
  OWN_DATA = 'own_data',
  TENANT_DATA = 'tenant_data',
  SHARED_DATA = 'shared_data',
  SYSTEM_DATA = 'system_data'
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  tier: TenantTier;
  status: TenantStatus;
  domain?: string;
  subdomain?: string;
  settings: TenantSettings;
  limits: TenantLimits;
  configuration: TenantConfiguration;
  metadata: TenantMetadata;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
}

export interface TenantSettings {
  timezone: string;
  locale: string;
  currency: string;
  dateFormat: string;
  numberFormat: string;
  securitySettings: TenantSecuritySettings;
  notificationSettings: TenantNotificationSettings;
  integrationSettings: TenantIntegrationSettings;
  branding: TenantBranding;
}

export interface TenantSecuritySettings {
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    passwordHistory: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
  };
  sessionSettings: {
    maxDuration: number;
    idleTimeout: number;
    concurrentSessions: number;
    requireReauth: boolean;
  };
  apiSettings: {
    rateLimitPerMinute: number;
    rateLimitPerHour: number;
    ipWhitelist: string[];
    corsOrigins: string[];
    allowedScopes: string[];
  };
  dataSettings: {
    allowDataExport: boolean;
    allowDataSharing: boolean;
    dataRetentionDays: number;
    encryptionRequired: boolean;
    auditLogEnabled: boolean;
  };
}

export interface TenantNotificationSettings {
  email: {
    enabled: boolean;
    smtpServer?: string;
    fromAddress?: string;
    replyToAddress?: string;
    templates: {
      welcome: boolean;
      passwordReset: boolean;
      securityAlert: boolean;
      monthlyReport: boolean;
    };
  };
  sms: {
    enabled: boolean;
    provider?: string;
    apiKey?: string;
    templates: {
      verification: boolean;
      securityAlert: boolean;
    };
  };
  webhook: {
    enabled: boolean;
    urls: WebhookEndpoint[];
    events: string[];
    retryPolicy: {
      maxRetries: number;
      backoffMultiplier: number;
    };
  };
}

export interface TenantIntegrationSettings {
  sso: {
    enabled: boolean;
    provider: 'saml' | 'oauth2' | 'ldap';
    configuration: Record<string, any>;
  };
  crm: {
    enabled: boolean;
    provider: string;
    apiKey?: string;
    webhookUrl?: string;
  };
  payments: {
    enabled: boolean;
    provider: string;
    publicKey?: string;
    webhookSecret?: string;
  };
  analytics: {
    enabled: boolean;
    provider: string;
    trackingId?: string;
  };
}

export interface TenantLimits {
  users: {
    maxUsers: number;
    activeUsers: number;
  };
  storage: {
    maxStorageGB: number;
    usedStorageGB: number;
  };
  api: {
    requestsPerMonth: number;
    requestsThisMonth: number;
  };
  features: {
    maxBinLookups: number;
    maxIbanValidations: number;
    maxCardGenerations: number;
    customRules: number;
    mlModels: number;
  };
  bandwidth: {
    maxBandwidthGB: number;
    usedBandwidthGB: number;
  };
}

export interface TenantConfiguration {
  rlsPolicies: RLSPolicy[];
  customFields: CustomField[];
  workflows: Workflow[];
  permissions: Permission[];
  integrations: Integration[];
  compliance: ComplianceSetting[];
}

export interface TenantMetadata {
  industry: string;
  companySize: string;
  location: {
    country: string;
    region: string;
    timezone: string;
  };
  compliance: string[];
  technicalContact: {
    name: string;
    email: string;
    phone: string;
  };
  billingContact: {
    name: string;
    email: string;
    address: string;
  };
  tags: string[];
  notes: string;
}

export interface RLSPolicy {
  id: string;
  name: string;
  description: string;
  tableName: string;
  enabled: boolean;
  priority: number;
  conditions: RLSCondition[];
  action: RLSAction;
  exceptions: RLSException[];
  createdAt: string;
  updatedAt: string;
}

export interface RLSCondition {
  field: string;
  operator: 'eq' | 'ne' | 'in' | 'not_in' | 'contains' | 'regex' | 'gt' | 'lt' | 'between';
  value: any;
  valueType: 'string' | 'number' | 'boolean' | 'date' | 'array';
  caseSensitive: boolean;
}

export interface RLSAction {
  type: 'allow' | 'deny' | 'restrict';
  restrictions: RLSRestriction[];
}

export interface RLSRestriction {
  field: string;
  operation: 'read' | 'write' | 'update' | 'delete';
  filter: string;
}

export interface RLSException {
  type: 'user' | 'role' | 'condition';
  value: any;
  description: string;
}

export interface CustomField {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'select' | 'multiselect';
  required: boolean;
  unique: boolean;
  validation: FieldValidation;
  defaultValue?: any;
  options?: FieldOption[];
  displayOrder: number;
}

export interface FieldValidation {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  customValidator?: string;
}

export interface FieldOption {
  id: string;
  label: string;
  value: any;
  displayOrder: number;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  enabled: boolean;
  version: number;
  createdAt: string;
}

export interface WorkflowTrigger {
  type: 'event' | 'schedule' | 'manual';
  event?: string;
  schedule?: string;
  conditions?: TriggerCondition[];
}

export interface TriggerCondition {
  field: string;
  operator: string;
  value: any;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'action' | 'approval' | 'notification' | 'integration';
  configuration: Record<string, any>;
  order: number;
  conditions?: StepCondition[];
}

export interface StepCondition {
  field: string;
  operator: string;
  value: any;
  nextStepId?: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  scope: PermissionScope;
  conditions?: PermissionCondition[];
}

export interface PermissionScope {
  type: 'all' | 'own' | 'team' | 'department' | 'custom';
  value?: any;
}

export interface PermissionCondition {
  field: string;
  operator: string;
  value: any;
}

export interface Integration {
  id: string;
  name: string;
  type: 'api' | 'webhook' | 'database' | 'file_storage';
  configuration: Record<string, any>;
  status: 'active' | 'inactive' | 'error';
  lastSync?: string;
  error?: string;
}

export interface ComplianceSetting {
  framework: string;
  enabled: boolean;
  requirements: ComplianceRequirement[];
}

export interface ComplianceRequirement {
  id: string;
  name: string;
  description: string;
  mandatory: boolean;
  enabled: boolean;
  configuration: Record<string, any>;
  lastAudit?: string;
  status: 'compliant' | 'non_compliant' | 'pending_review';
}

export interface TenantBranding {
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  customCSS?: string;
  favicon?: string;
  companyName?: string;
  tagline?: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  retryCount: number;
  lastTriggered?: string;
}

// Enhanced User with tenant context
export interface TenantUser {
  id: string;
  tenantId: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
  status: 'active' | 'inactive' | 'suspended';
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  profile: UserProfile;
  settings: UserSettings;
}

export interface UserProfile {
  avatar?: string;
  phone?: string;
  timezone?: string;
  language?: string;
  department?: string;
  jobTitle?: string;
  bio?: string;
  customFields?: Record<string, any>;
}

export interface UserSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  twoFactorEnabled: boolean;
  theme: 'light' | 'dark' | 'auto';
  timezone: string;
  language: string;
  customSettings: Record<string, any>;
}

// Multi-tenant Database Context
export interface TenantContext {
  tenantId: string;
  userId: string;
  role: string;
  permissions: string[];
  dataAccessLevel: DataAccessLevel;
  isolationLevel: IsolationLevel;
  timestamp: string;
}

export enum IsolationLevel {
  COMPLETE = 'complete',      // Complete data isolation
  SCHEMA = 'schema',         // Schema-level isolation  
  ROW_LEVEL = 'row_level',   // Row-level security
  PARTIAL = 'partial'         // Partial isolation with shared data
}

// Multi-tenant Database Configuration
export interface TenantDatabaseConfig {
  tenantId: string;
  databaseType: 'shared' | 'dedicated' | 'hybrid';
  connectionString?: string;
  schemaName?: string;
  tablePrefix?: string;
  isolationLevel: IsolationLevel;
  rlsEnabled: boolean;
  encryptionEnabled: boolean;
  backupEnabled: boolean;
  replicationEnabled: boolean;
}

// Resource Usage Tracking
export interface TenantResourceUsage {
  tenantId: string;
  period: string;
  metrics: {
    apiRequests: number;
    storageUsed: number;
    bandwidthUsed: number;
    activeUsers: number;
    dataQueries: number;
    failedLogins: number;
    securityEvents: number;
  };
  timestamp: string;
}

// Tenant Analytics and Metrics
export interface TenantAnalytics {
  tenantId: string;
  period: string;
  performance: PerformanceMetrics;
  usage: UsageMetrics;
  security: SecurityMetrics;
  compliance: ComplianceMetrics;
  costs: CostMetrics;
  timestamp: string;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  uptime: number;
  databasePerformance: DatabasePerformanceMetrics;
}

export interface DatabasePerformanceMetrics {
  averageQueryTime: number;
  slowQueries: number;
  connectionPoolUsage: number;
  indexEfficiency: number;
}

export interface UsageMetrics {
  activeUsers: number;
  totalUsers: number;
  apiRequests: number;
  storageUsage: number;
  bandwidthUsage: number;
  featureUsage: Record<string, number>;
}

export interface SecurityMetrics {
  failedLogins: number;
  blockedIPs: number;
  securityEvents: number;
  incidents: number;
  riskScore: number;
}

export interface ComplianceMetrics {
  complianceScore: number;
  failedAudits: number;
  openFindings: number;
  lastAuditDate: string;
}

export interface CostMetrics {
  totalCost: number;
  computeCost: number;
  storageCost: number;
  bandwidthCost: number;
  licenseCost: number;
  supportCost: number;
}

// Multi-tenant Request Context
export interface MultiTenantRequest extends Request {
  tenantContext?: TenantContext;
  tenant?: Tenant;
  user?: any;
  isolationLevel?: IsolationLevel;
  dataAccessScope?: string[];
}

// Error types for multi-tenant
export enum TenantError {
  TENANT_NOT_FOUND = 'TENANT_NOT_FOUND',
  TENANT_SUSPENDED = 'TENANT_SUSPENDED', 
  TENANT_LIMIT_EXCEEDED = 'TENANT_LIMIT_EXCEEDED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  DATA_ACCESS_DENIED = 'DATA_ACCESS_DENIED',
  TENANT_ISOLATION_BREACH = 'TENANT_ISOLATION_BREACH',
  TENANT_CONFIGURATION_ERROR = 'TENANT_CONFIGURATION_ERROR',
  TENANT_MIGRATION_ERROR = 'TENANT_MIGRATION_ERROR'
}

export class MultiTenantError extends Error {
  public code: TenantError;
  public tenantId?: string;
  public userId?: string;
  public metadata?: Record<string, any>;

  constructor(code: TenantError, message: string, tenantId?: string, userId?: string, metadata?: Record<string, any>) {
    super(message);
    this.name = 'MultiTenantError';
    this.code = code;
    this.tenantId = tenantId;
    this.userId = userId;
    this.metadata = metadata;
  }
}

// Tenant context middleware
export interface TenantContextOptions {
  required: boolean;
  checkStatus: boolean;
  checkPermissions: string[];
  requiredDataAccess: DataAccessLevel;
  allowCrossTenant: boolean;
  auditAccess: boolean;
}