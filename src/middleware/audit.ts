import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logRequest, logAudit, logDatabaseAccess, logFailedAuth, logSuspiciousActivity } from '../utils/logger';
import { 
  recordFailedAuth, 
  recordSuspiciousActivity, 
  recordDatabaseAccess, 
  recordAuditEvent,
  recordRateLimitBreach,
  recordUnauthorizedAccess
} from '../services/metrics';

// Enhanced request logging middleware
export const auditMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  // Attach request ID to request for tracking
  req.requestId = requestId;
  
  // Log request start
  const userId = (req as any).user?.id || 'anonymous';
  const userRole = (req as any).user?.role || 'none';
  
  logRequest(requestId, req.method, req.path, undefined, undefined, userId);
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: (() => void)) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // Log completion
    logRequest(requestId, req.method, req.path, statusCode, duration, userId);
    
    // Log audit events for sensitive operations
    if (isSensitiveOperation(req.method, req.path)) {
      const auditResult = statusCode < 400 ? 'SUCCESS' : 'FAILURE';
      const auditData: any = {
        requestId,
        method: req.method,
        path: req.path,
        statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userRole,
      };

      // Add specific context for card generation operations
      if (req.path.includes('/cards/generate')) {
        auditData.operation = 'card_generation';
        auditData.bin = req.body?.bin || req.query?.bin;
        auditData.count = req.body?.count || req.query?.count;
        auditData.generationMode = req.body?.sequential ? 'sequential' : 'random';
      }

      // Add context for async job operations
      if (req.path.includes('/jobs/')) {
        auditData.operation = 'job_queue';
        auditData.jobId = req.params?.jobId;
      }

      logAudit(
        userId,
        `${req.method} ${req.path}`,
        req.path,
        auditResult,
        auditData
      );
      recordAuditEvent(`${req.method} ${req.path}`, req.path, auditResult);
    }
    
    // Detect suspicious activity
    if (isSuspiciousActivity(req, res, duration)) {
      logSuspiciousActivity(
        userId,
        `Unusual request pattern: ${req.method} ${req.path}`,
        'MEDIUM',
        {
          requestId,
          method: req.method,
          path: req.path,
          statusCode,
          duration,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          reason: 'Unusual timing or pattern detected',
        }
      );
      recordSuspiciousActivity(`Unusual request pattern: ${req.method} ${req.path}`, 'MEDIUM', userId);
    }
    
    return originalEnd.call(this, chunk, encoding, cb);
  };
  
  next();
};

// Database operation logging middleware
export const databaseAuditMiddleware = (
  userId: string,
  operation: 'READ' | 'WRITE' | 'DELETE' | 'UPDATE',
  table: string,
  query?: string,
  result: 'SUCCESS' | 'FAILURE' = 'SUCCESS'
) => {
  logDatabaseAccess(userId, operation, table, query, result);
  recordDatabaseAccess(operation, table, result);
};

// Authentication event logging
export const logAuthEvent = (
  identifier: string,
  result: 'SUCCESS' | 'FAILURE',
  reason?: string,
  ip?: string,
  userAgent?: string,
  userId?: string
): void => {
  if (result === 'FAILURE') {
    logFailedAuth(identifier, reason || 'Unknown error', ip || 'unknown', userAgent);
    recordFailedAuth(reason || 'Unknown error', ip || 'unknown');
  } else {
    logAudit(
      userId || identifier,
      'LOGIN',
      'authentication',
      'SUCCESS',
      {
        ip,
        userAgent,
        timestamp: new Date().toISOString(),
      }
    );
  }
};

// Helper functions
function isSensitiveOperation(method: string, path: string): boolean {
  const sensitivePaths = [
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/users',
    '/api/v1/admin',
    '/api/v1/cards/generate',
    '/api/v1/secrets',
    '/api/v1/vault',
  ];
  
  const sensitiveMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  
  return sensitiveMethods.includes(method) && 
         sensitivePaths.some(sensitivePath => path.startsWith(sensitivePath));
}

function isSuspiciousActivity(req: Request, res: Response, duration: number): boolean {
  // Check for unusual response times (> 5 seconds)
  if (duration > 5000) {
    return true;
  }
  
  // Check for unusual error codes
  if (res.statusCode >= 500) {
    return true;
  }
  
  // Check for requests to unusual paths
  const suspiciousPatterns = [
    '/admin',
    '/wp-admin',
    '/phpmyadmin',
    '/.env',
    '/config',
    '/backup',
  ];
  
  return suspiciousPatterns.some(pattern => req.path.toLowerCase().includes(pattern));
}

// Rate limiting breach logging
export const logRateLimitBreach = (
  identifier: string,
  ip: string,
  userAgent?: string
): void => {
  logSuspiciousActivity(
    identifier,
    'Rate limit exceeded',
    'HIGH',
    {
      ip,
      userAgent,
      timestamp: new Date().toISOString(),
      reason: 'Too many requests in short time period',
    }
  );
  recordRateLimitBreach(identifier, ip);
};

// Unauthorized access attempt logging
export const logUnauthorizedAccess = (
  ip: string,
  path: string,
  method: string,
  userAgent?: string
): void => {
  logSuspiciousActivity(
    'anonymous',
    'Unauthorized access attempt',
    'HIGH',
    {
      ip,
      path,
      method,
      userAgent,
      timestamp: new Date().toISOString(),
      reason: 'Access denied to protected resource',
    }
  );
  recordUnauthorizedAccess(ip, path, method);
};

// Uniqueness check logging
export const logUniquenessCheck = (
  userId: string,
  cardHash: string,
  layer: string,
  result: 'unique' | 'duplicate',
  duration: number,
  requestId?: string
): void => {
  logAudit(
    userId,
    'UNIQUENESS_CHECK',
    'uniqueness',
    result === 'unique' ? 'SUCCESS' : 'FAILURE',
    {
      requestId,
      cardHash: cardHash.substring(0, 16) + '...',
      layer,
      result,
      duration,
      timestamp: new Date().toISOString(),
    }
  );
};

// Job queue operation logging
export const logJobQueueOperation = (
  userId: string,
  operation: 'create' | 'status' | 'result' | 'cancel',
  jobId: string,
  result: 'SUCCESS' | 'FAILURE',
  requestId?: string
): void => {
  logAudit(
    userId,
    `JOB_QUEUE_${operation.toUpperCase()}`,
    'job_queue',
    result,
    {
      requestId,
      jobId,
      operation,
      timestamp: new Date().toISOString(),
    }
  );
};

// Cache operation logging
export const logCacheOperation = (
  userId: string,
  operation: 'get' | 'set' | 'delete' | 'invalidate',
  key: string,
  layer: 'local' | 'redis' | 'database',
  result: 'hit' | 'miss' | 'success' | 'error',
  requestId?: string
): void => {
  logAudit(
    userId,
    `CACHE_${operation.toUpperCase()}`,
    'cache',
    result === 'hit' || result === 'success' ? 'SUCCESS' : 'FAILURE',
    {
      requestId,
      key: key.substring(0, 50),
      layer,
      operation,
      result,
      timestamp: new Date().toISOString(),
    }
  );
};
