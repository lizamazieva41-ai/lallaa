import winston from 'winston';
import path from 'path';
import fs from 'fs';
import config from '../config';
// =====================================================
// DATA MASKING UTILITIES
// =====================================================

// Mask sensitive data in logs
const maskSensitiveData = (data: any): any => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const masked = { ...data };

  // Mask common sensitive fields
  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'authorization', 
    'apiKey', 'api_key', 'access_token', 'refresh_token',
    'creditCard', 'card_number', 'pan', 'iban', 'accountNumber'
  ];

  for (const field of sensitiveFields) {
    if (masked[field]) {
      if (typeof masked[field] === 'string') {
        // Show first 2 and last 4 chars, mask the rest
        const value = masked[field];
        if (value.length <= 6) {
          masked[field] = '***';
        } else {
          masked[field] = value.substring(0, 2) + '***' + value.substring(value.length - 2);
        }
      } else {
        masked[field] = '***';
      }
    }
  }

  // Handle nested objects
  for (const key in masked) {
    if (typeof masked[key] === 'object' && masked[key] !== null) {
      masked[key] = maskSensitiveData(masked[key]);
    }
  }

  return masked;
};

// Mask credit card numbers (show BIN + last 4)
const maskCreditCard = (cardNumber: string): string => {
  if (!cardNumber || typeof cardNumber !== 'string') {
    return cardNumber;
  }
  
  const cleaned = cardNumber.replace(/\s/g, '');
  if (cleaned.length < 8) {
    return '***';
  }
  
  // Show BIN (first 6) + last 4, mask middle
  const bin = cleaned.substring(0, 6);
  const last4 = cleaned.substring(cleaned.length - 4);
  const maskedLength = cleaned.length - 10;
  const mask = '*'.repeat(maskedLength);
  
  return bin + mask + last4;
};

// Mask IBAN (show country + bank + last 4)
const maskIBAN = (iban: string): string => {
  if (!iban || typeof iban !== 'string') {
    return iban;
  }
  
  const cleaned = iban.replace(/\s/g, '');
  if (cleaned.length < 8) {
    return '***';
  }
  
  // Show country (2), bank (4), last 4, mask rest
  const country = cleaned.substring(0, 2);
  const bank = cleaned.substring(4, 8);
  const last4 = cleaned.substring(cleaned.length - 4);
  const maskedLength = cleaned.length - 8;
  const mask = '*'.repeat(maskedLength);
  
  return country + '***' + bank + mask + last4;
};

// Sanitize error messages to prevent sensitive data leakage
const sanitizeErrorMessage = (message: string): string => {
  if (!message || typeof message !== 'string') {
    return message;
  }

  // Remove potential sensitive data from error messages
  return message
    .replace(/password=\s*[^\s&]+/gi, 'password=***')
    .replace(/token=\s*[^\s&]+/gi, 'token=***')
    .replace(/key=\s*[^\s&]+/gi, 'key=***')
    .replace(/secret=\s*[^\s&]+/gi, 'secret=***')
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, (match) => maskCreditCard(match))
    .replace(/\b[A-Z]{2}\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4,}\b/g, (match) => maskIBAN(match));
};

// Ensure logs directory exists
const logsDir = path.resolve(config.logging.filePath);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Create transports
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: config.app.env === 'development' ? consoleFormat : structuredFormat,
  }),
];

// Add file transports in production
if (config.app.env === 'production') {
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: parseSize(config.logging.maxSize),
      maxFiles: config.logging.maxFiles,
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: parseSize(config.logging.maxSize),
      maxFiles: config.logging.maxFiles,
    })
  );
}

// Parse size string to bytes
function parseSize(size: string): number {
  const units: Record<string, number> = {
    b: 1,
    k: 1024,
    m: 1024 * 1024,
    g: 1024 * 1024 * 1024,
  };

  const match = size.match(/^(\d+)([bkmg]?)$/i);
  if (!match) return 20 * 1024 * 1024; // Default 20MB

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase() || 'b';
  return value * (units[unit] || 1);
}

// (removed duplicate logger instance; see logger below with correlation-id support)\n\n// Correlation ID support for tracking requests across services
let currentCorrelationId: string | undefined;

export const setCorrelationId = (correlationId: string): void => {
  currentCorrelationId = correlationId;
};

export const getCorrelationId = (): string | undefined => {
  return currentCorrelationId;
};

// Add correlation ID to all log entries
const correlationIdFormat = winston.format((info) => {
  if (currentCorrelationId) {
    info.correlationId = currentCorrelationId;
  } else {
    info.correlationId = 'N/A';
  }
  return info;
});

// Update structured format to include correlation ID
const structuredFormatWithCorrelation = winston.format.combine(
  correlationIdFormat(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Update console format to include correlation ID
const consoleFormatWithCorrelation = winston.format.combine(
  correlationIdFormat(),
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} [${level}] [${correlationId || 'N/A'}] ${message} ${metaStr}`;
  })
);

// Recreate logger with correlation ID support
export const logger = winston.createLogger({
  level: config.logging.level,
  format: structuredFormatWithCorrelation,
  defaultMeta: { service: 'bin-check-api' },
  transports: [
    new winston.transports.Console({
      format: config.app.env === 'development' ? consoleFormatWithCorrelation : structuredFormatWithCorrelation,
    }),
    ...(config.app.env === 'production' ? [
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        maxsize: parseSize(config.logging.maxSize),
        maxFiles: config.logging.maxFiles,
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        maxsize: parseSize(config.logging.maxSize),
        maxFiles: config.logging.maxFiles,
      }),
    ] : []),
  ],
  exceptionHandlers: config.app.env === 'production' ? [
    new winston.transports.File({ filename: path.join(logsDir, 'exceptions.log') }),
  ] : undefined,
  rejectionHandlers: config.app.env === 'production' ? [
    new winston.transports.File({ filename: path.join(logsDir, 'rejections.log') }),
  ] : undefined,
});

// Add child logger method for service-specific logging
(logger as any).child = (meta: any) => {
  return winston.createLogger({
    level: logger.level,
    format: structuredFormatWithCorrelation,
    defaultMeta: { ...logger.defaultMeta, ...meta },
    transports: logger.transports,
  });
};

// Helper methods for logging
export const logRequest = (
  requestId: string,
  method: string,
  path: string,
  statusCode?: number,
  duration?: number,
  userId?: string
): void => {
  logger.info('HTTP Request', {
    requestId,
    method,
    path,
    statusCode,
    duration,
    userId,
    timestamp: new Date().toISOString(),
  });
};

export const logError = (
  error: Error,
  context?: Record<string, unknown>
): void => {
  // Sanitize error message and mask sensitive data in context
  const sanitizedMessage = sanitizeErrorMessage(error.message);
  const maskedContext = maskSensitiveData(context);
  
  logger.error('Application Error', {
    message: sanitizedMessage,
    stack: error.stack,
    ...maskedContext,
  });
};

export const logSecurity = (
  event: string,
  details: Record<string, unknown>
): void => {
  // Mask sensitive data in security logs
  const maskedDetails = maskSensitiveData(details);
  
  logger.warn('Security Event', {
    event,
    ...maskedDetails,
    timestamp: new Date().toISOString(),
    severity: 'HIGH',
  });
};

// Enhanced audit logging for compliance
export const logAudit = (
  userId: string,
  action: string,
  resource: string,
  result: 'SUCCESS' | 'FAILURE',
  details?: Record<string, unknown>
): void => {
  // Mask sensitive data in audit logs, but keep key fields
  const maskedDetails = maskSensitiveData(details);
  
  logger.info('Audit Event', {
    userId,
    action,
    resource,
    result,
    ip: details?.ip || 'unknown',
    userAgent: details?.userAgent || 'unknown',
    timestamp: new Date().toISOString(),
    auditLevel: 'COMPLIANCE',
    ...maskedDetails,
  });
};

// Database access logging
export const logDatabaseAccess = (
  userId: string,
  operation: 'READ' | 'WRITE' | 'DELETE' | 'UPDATE',
  table: string,
  query?: string,
  result?: 'SUCCESS' | 'FAILURE'
): void => {
  logger.info('Database Access', {
    userId,
    operation,
    table,
    query: query ? query.substring(0, 200) : undefined, // Truncate long queries
    result,
    timestamp: new Date().toISOString(),
    auditLevel: 'DATABASE',
  });
};

// Vault access logging
export const logVaultAccess = (
  userId: string,
  secretPath: string,
  operation: 'READ' | 'WRITE' | 'DELETE',
  result: 'SUCCESS' | 'FAILURE'
): void => {
  logger.info('Vault Access', {
    userId,
    secretPath,
    operation,
    result,
    timestamp: new Date().toISOString(),
    auditLevel: 'VAULT',
  });
};

// Failed authentication logging
export const logFailedAuth = (
  identifier: string,
  reason: string,
  ip: string,
  userAgent?: string
): void => {
  logger.warn('Failed Authentication', {
    identifier,
    reason,
    ip,
    userAgent,
    timestamp: new Date().toISOString(),
    severity: 'MEDIUM',
    event: 'AUTH_FAILURE',
  });
};

// Suspicious activity logging
export const logSuspiciousActivity = (
  userId: string,
  activity: string,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  details: Record<string, unknown>
): void => {
  logger.error('Suspicious Activity', {
    userId,
    activity,
    severity,
    timestamp: new Date().toISOString(),
    event: 'SUSPICIOUS_ACTIVITY',
    alert: true,
    ...details,
  });
};

export default logger;
