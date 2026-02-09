import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(process.cwd(), '.env') });

export interface AppConfig {
  env: string;
  port: number;
  host: string;
  apiPrefix: string;
  frontendUrl?: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
  pool: {
    min: number;
    max: number;
  };
  ssl: boolean;
}

export interface RedisConfig {
  host: string;
  port: number;
  password: string | null;
  db: number;
  keyPrefix: string;
}

export interface JwtConfig {
  secret: string;
  refreshSecret: string;
  expiresIn: string;
  refreshExpiresIn: string;
}

export interface SecurityConfig {
  bcryptRounds: number;
  saltRounds: number;
  apiKeyPrefix: string;
  apiKeyBytes: number;
}

export interface RateLimitConfig {
  windowMs: number;
  failPolicy: 'open' | 'closed';
  limits: {
    free: number;
    basic: number;
    premium: number;
    enterprise: number;
  };
}

export interface LoggingConfig {
  level: string;
  filePath: string;
  maxFiles: number;
  maxSize: string;
}

export interface CorsConfig {
  origin: string;
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
}

export interface FeatureFlagsConfig {
  cardGeneration: boolean;
  testCardsAccess: boolean;
  adminPanel: boolean;
}

export interface DoremonAIConfig {
  doremonApiUrl: string;
  doremonApiKey: string;
  doremonTimeout: number;
  doremonRetryAttempts: number;
  excelExportPath: string;
  workflowStatusCheckInterval: number;
}

export interface RedisClusterConfig {
  nodes?: string[];
  options?: Record<string, any>;
  enabled: boolean;
}

export interface BullQueueConfig {
  redis: {
    host: string;
    port: number;
    password: string | null;
    db: number;
  };
  concurrency: number;
  maxJobsPerWorker: number;
  defaultJobAttempts: number;
  defaultJobBackoffDelay: number;
  defaultJobTimeout: number;
}

export interface BloomFilterConfig {
  capacity: number;
  errorRate: number;
  syncInterval: number;
}

export interface UniquenessServiceConfig {
  retryAttempts: number;
  retryBackoffBase: number;
  poolTtlSeconds: number;
  poolCleanupInterval: number;
}

export interface MultiTierCacheConfig {
  localMemory: {
    size: number;
    ttl: number;
  };
  redis: {
    ttl: {
      bin: number;
      statistics: number;
      card: number;
    };
  };
  warming: {
    enabled: boolean;
    interval: number;
  };
}

export interface WebSocketConfig {
  port: number;
  corsOrigin: string;
  pingInterval: number;
  pingTimeout: number;
}

export interface JobQueueConfig {
  priority: {
    high: number;
    normal: number;
    low: number;
  };
  maxJobs: number;
  removeOnComplete: number;
  removeOnFail: number;
}

export interface Config {
  app: AppConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  redisCluster: RedisClusterConfig;
  jwt: JwtConfig;
  security: SecurityConfig;
  rateLimit: RateLimitConfig;
  logging: LoggingConfig;
  cors: CorsConfig;
  features: FeatureFlagsConfig;
  doremonAI: DoremonAIConfig;
  bullQueue: BullQueueConfig;
  bloomFilter: BloomFilterConfig;
  uniquenessService: UniquenessServiceConfig;
  multiTierCache: MultiTierCacheConfig;
  websocket: WebSocketConfig;
  jobQueue: JobQueueConfig;
}

const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const getEnvNumber = (key: string, defaultValue?: number): number => {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue ?? 0;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    return defaultValue ?? 0;
  }
  return parsed;
};

const getEnvBoolean = (key: string, defaultValue?: boolean): boolean => {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue ?? false;
  }
  return value.toLowerCase() === 'true';
};

export const config: Config = {
  app: {
    env: getEnv('NODE_ENV', 'development'),
    port: getEnvNumber('API_PORT', 8080),
    host: getEnv('API_HOST', '0.0.0.0'),
    apiPrefix: '/api/v1',
    frontendUrl: getEnv('FRONTEND_URL', 'http://localhost:3000'),
  },

  database: {
    host: getEnv('DB_HOST', 'localhost'),
    port: getEnvNumber('DB_PORT', 5432),
    username: getEnv('POSTGRES_USER', 'bincheck'),
    password: getEnv('POSTGRES_PASSWORD', 'bincheck_secret'),
    name: getEnv('POSTGRES_DB', 'bincheck'),
    pool: {
      min: getEnvNumber('DB_POOL_MIN', 2),
      max: getEnvNumber('DB_POOL_MAX', 10),
    },
    ssl: getEnvBoolean('DB_SSL', false),
  },

  redis: {
    host: getEnv('REDIS_HOST', 'localhost'),
    port: getEnvNumber('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD || null,
    db: getEnvNumber('REDIS_DB', 0),
    keyPrefix: getEnv('REDIS_KEY_PREFIX', 'bincheck:'),
  },

  jwt: {
    secret: getEnv('JWT_SECRET', 'your-secret-key'),
    refreshSecret: getEnv('JWT_REFRESH_SECRET', 'your-refresh-secret-key'),
    expiresIn: getEnv('JWT_EXPIRES_IN', '15m'),
    refreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  security: {
    bcryptRounds: getEnvNumber('BCRYPT_ROUNDS', 12),
    saltRounds: getEnvNumber('SALT_ROUNDS', 10),
    apiKeyPrefix: getEnv('API_KEY_PREFIX', 'bincheck'),
    apiKeyBytes: getEnvNumber('API_KEY_BYTES', 32),
  },

  rateLimit: {
    windowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 60000),
    failPolicy: (process.env.RATE_LIMIT_FAIL_POLICY as 'open' | 'closed') || 'open',
    limits: {
      free: getEnvNumber('RATE_LIMIT_MAX_FREE', 100),
      basic: getEnvNumber('RATE_LIMIT_MAX_BASIC', 500),
      premium: getEnvNumber('RATE_LIMIT_MAX_PREMIUM', 2000),
      enterprise: getEnvNumber('RATE_LIMIT_MAX_ENTERPRISE', 10000),
    },
  },

  logging: {
    level: getEnv('LOG_LEVEL', 'info'),
    filePath: getEnv('LOG_FILE_PATH', './logs'),
    maxFiles: getEnvNumber('LOG_MAX_FILES', 5),
    maxSize: getEnv('LOG_MAX_SIZE', '20m'),
  },

  cors: {
    origin: getEnv('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: getEnvBoolean('CORS_CREDENTIALS', true),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  },

  features: {
    cardGeneration: getEnv('NODE_ENV') === 'production' 
      ? getEnvBoolean('FEATURE_CARD_GENERATION_PRODUCTION_UNLOCK', false)
      : getEnvBoolean('FEATURE_CARD_GENERATION', true), // Enable in dev/staging by default
    testCardsAccess: getEnvBoolean('FEATURE_TEST_CARDS_ACCESS', true),
    adminPanel: getEnvBoolean('FEATURE_ADMIN_PANEL', true),
  },

  doremonAI: {
    doremonApiUrl: getEnv('DOREMON_API_URL', 'http://localhost:8000'),
    doremonApiKey: getEnv('DOREMON_API_KEY', ''),
    doremonTimeout: getEnvNumber('DOREMON_TIMEOUT', 30000),
    doremonRetryAttempts: getEnvNumber('DOREMON_RETRY_ATTEMPTS', 3),
    excelExportPath: getEnv('EXCEL_EXPORT_PATH', './temp/exports'),
    workflowStatusCheckInterval: getEnvNumber('WORKFLOW_STATUS_CHECK_INTERVAL', 5000),
  },

  redisCluster: {
    nodes: process.env.REDIS_CLUSTER_NODES?.split(',') || [],
    options: process.env.REDIS_CLUSTER_OPTIONS 
      ? JSON.parse(process.env.REDIS_CLUSTER_OPTIONS)
      : { enableReadyCheck: true, maxRetriesPerRequest: null },
    enabled: getEnvBoolean('REDIS_CLUSTER_ENABLED', false),
  },

  bullQueue: {
    redis: {
      host: getEnv('BULL_REDIS_HOST', 'localhost'),
      port: getEnvNumber('BULL_REDIS_PORT', 6379),
      password: process.env.BULL_REDIS_PASSWORD || null,
      db: getEnvNumber('BULL_REDIS_DB', 1),
    },
    concurrency: getEnvNumber('BULL_CONCURRENCY', 5),
    maxJobsPerWorker: getEnvNumber('BULL_MAX_JOBS_PER_WORKER', 1000),
    defaultJobAttempts: getEnvNumber('BULL_DEFAULT_JOB_ATTEMPTS', 3),
    defaultJobBackoffDelay: getEnvNumber('BULL_DEFAULT_JOB_BACKOFF_DELAY', 2000),
    defaultJobTimeout: getEnvNumber('BULL_DEFAULT_JOB_TIMEOUT', 300000),
  },

  bloomFilter: {
    capacity: getEnvNumber('BLOOM_FILTER_CAPACITY', 100000000),
    errorRate: getEnvNumber('BLOOM_FILTER_ERROR_RATE', 0.001),
    syncInterval: getEnvNumber('BLOOM_FILTER_SYNC_INTERVAL', 3600000),
  },

  uniquenessService: {
    retryAttempts: getEnvNumber('UNIQUENESS_RETRY_ATTEMPTS', 3),
    retryBackoffBase: getEnvNumber('UNIQUENESS_RETRY_BACKOFF_BASE', 100),
    poolTtlSeconds: getEnvNumber('UNIQUENESS_POOL_TTL_SECONDS', 300),
    poolCleanupInterval: getEnvNumber('UNIQUENESS_POOL_CLEANUP_INTERVAL', 60000),
  },

  multiTierCache: {
    localMemory: {
      size: getEnvNumber('CACHE_LOCAL_MEMORY_SIZE', 10000),
      ttl: getEnvNumber('CACHE_LOCAL_MEMORY_TTL', 300000),
    },
    redis: {
      ttl: {
        bin: getEnvNumber('CACHE_REDIS_TTL_BIN', 3600),
        statistics: getEnvNumber('CACHE_REDIS_TTL_STATISTICS', 1800),
        card: getEnvNumber('CACHE_REDIS_TTL_CARD', 86400),
      },
    },
    warming: {
      enabled: getEnvBoolean('CACHE_WARMING_ENABLED', true),
      interval: getEnvNumber('CACHE_WARMING_INTERVAL', 3600000),
    },
  },

  websocket: {
    port: getEnvNumber('WEBSOCKET_PORT', 8081),
    corsOrigin: getEnv('WEBSOCKET_CORS_ORIGIN', 'http://localhost:3000'),
    pingInterval: getEnvNumber('WEBSOCKET_PING_INTERVAL', 25000),
    pingTimeout: getEnvNumber('WEBSOCKET_PING_TIMEOUT', 60000),
  },

  jobQueue: {
    priority: {
      high: getEnvNumber('JOB_QUEUE_PRIORITY_HIGH', 1),
      normal: getEnvNumber('JOB_QUEUE_PRIORITY_NORMAL', 5),
      low: getEnvNumber('JOB_QUEUE_PRIORITY_LOW', 10),
    },
    maxJobs: getEnvNumber('JOB_QUEUE_MAX_JOBS', 100000),
    removeOnComplete: getEnvNumber('JOB_QUEUE_REMOVE_ON_COMPLETE', 100),
    removeOnFail: getEnvNumber('JOB_QUEUE_REMOVE_ON_FAIL', 1000),
  },
};

// Validate critical configurations
export const validateConfig = (): void => {
  const requiredVars = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'DB_HOST',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_DB'
  ];
  
  const missingVars: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }

  // Redis validation - accept either URL or individual params
  const hasRedisUrl = process.env.REDIS_URL;
  const hasRedisParams = process.env.REDIS_HOST && process.env.REDIS_PORT;
  
  if (!hasRedisUrl && !hasRedisParams) {
    missingVars.push('Redis configuration (REDIS_URL or REDIS_HOST + REDIS_PORT)');
  }

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Production-specific validations
  if (config.app.env === 'production') {
    // Check for default/weak secrets
    if (config.jwt.secret.includes('your-') || config.jwt.secret.includes('secret')) {
      throw new Error('JWT_SECRET must be changed from default value in production');
    }
    
    if (config.jwt.refreshSecret.includes('your-') || config.jwt.refreshSecret.includes('secret')) {
      throw new Error('JWT_REFRESH_SECRET must be changed from default value in production');
    }
    
    // Check database connection security
    if (!config.database.ssl && !process.env.DB_HOST?.includes('localhost') && !process.env.DB_HOST?.includes('127.0.0.1')) {
      console.warn('⚠️  Warning: Database SSL is disabled in production');
    }
  }

  // Security feature flags checks
  if (config.app.env === 'production' && config.features.cardGeneration && !process.env.FEATURE_CARD_GENERATION_PRODUCTION_UNLOCK) {
    console.warn('⚠️  Warning: Card generation feature is enabled in production');
  }

  // DoremonAI configuration validation
  if (!config.doremonAI.doremonApiUrl) {
    throw new Error('DOREMON_API_URL is required');
  }
  if (config.doremonAI.doremonTimeout < 1000) {
    throw new Error('DOREMON_TIMEOUT must be at least 1000ms');
  }
  if (config.doremonAI.doremonRetryAttempts < 1 || config.doremonAI.doremonRetryAttempts > 10) {
    throw new Error('DOREMON_RETRY_ATTEMPTS must be between 1 and 10');
  }
  if (config.doremonAI.workflowStatusCheckInterval < 1000) {
    throw new Error('WORKFLOW_STATUS_CHECK_INTERVAL must be at least 1000ms');
  }

  // Bull Queue configuration validation
  if (config.bullQueue.concurrency < 1) {
    throw new Error('BULL_CONCURRENCY must be at least 1');
  }
  if (config.bullQueue.defaultJobTimeout < 1000) {
    throw new Error('BULL_DEFAULT_JOB_TIMEOUT must be at least 1000ms');
  }

  // Bloom Filter configuration validation
  if (config.bloomFilter.capacity < 1000) {
    throw new Error('BLOOM_FILTER_CAPACITY must be at least 1000');
  }
  if (config.bloomFilter.errorRate <= 0 || config.bloomFilter.errorRate >= 1) {
    throw new Error('BLOOM_FILTER_ERROR_RATE must be between 0 and 1');
  }

  // Uniqueness Service configuration validation
  if (config.uniquenessService.retryAttempts < 1) {
    throw new Error('UNIQUENESS_RETRY_ATTEMPTS must be at least 1');
  }
  if (config.uniquenessService.poolTtlSeconds < 60) {
    throw new Error('UNIQUENESS_POOL_TTL_SECONDS must be at least 60 seconds');
  }

  // Multi-tier Cache configuration validation
  if (config.multiTierCache.localMemory.size < 100) {
    throw new Error('CACHE_LOCAL_MEMORY_SIZE must be at least 100');
  }
  if (config.multiTierCache.localMemory.ttl < 1000) {
    throw new Error('CACHE_LOCAL_MEMORY_TTL must be at least 1000ms');
  }

  // WebSocket configuration validation
  if (config.websocket.port < 1024 || config.websocket.port > 65535) {
    throw new Error('WEBSOCKET_PORT must be between 1024 and 65535');
  }
  if (config.websocket.pingInterval < 1000) {
    throw new Error('WEBSOCKET_PING_INTERVAL must be at least 1000ms');
  }
};

export default config;
