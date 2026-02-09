import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { behavioralThreatDetection, UserAction } from '@/security/behavioralThreatDetection';

// Enhanced middleware for behavioral threat detection integration
// Use any for compatibility with existing TokenPayload interface
export interface AuthenticatedRequest extends Request {
  user?: any;
  requestId?: string;
}

class BehavioralTrackingMiddleware {
  // Main tracking middleware
  static trackBehavior() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      const startTime = Date.now();
      
      // Store original end method
      const originalEnd = res.end;
      
      // Override end method to capture response data
      res.end = function(chunk?: any, encoding?: any, cb?: any): Response {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // Extract user and session information
        const userId = req.user?.userId || req.user?.id;
        const sessionId = behavioralThreatDetection.extractSessionId(req);
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        
        if (userId) {
          // Create user action from request
          const action: UserAction = {
            id: `action_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            type: behavioralThreatDetection.determineActionType(req),
            endpoint: req.route?.path || req.path,
            method: req.method,
            statusCode: res.statusCode,
            responseTime,
            timestamp: new Date().toISOString(),
            metadata: behavioralThreatDetection.extractActionMetadata(req, res, responseTime)
          };
          
          // Track the action
          behavioralThreatDetection.trackUserAction(
            userId,
            action,
            sessionId,
            ipAddress,
            userAgent
          );
        }
        
        // Call original end method
        return originalEnd.call(this, chunk, encoding, cb);
      };
      
      next();
    };
  }

  // Login attempt tracking
  static trackLoginAttempt() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const originalEnd = res.end;
      const startTime = Date.now();
      
      res.end = function(chunk?: any, encoding?: any, cb?: any): Response {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        const email = req.body?.email || req.body?.username;
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        const sessionId = behavioralThreatDetection.generateSessionId();
        
        // Create login action
        const action: UserAction = {
          id: `login_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: 'login',
          endpoint: '/api/v1/auth/login',
          method: req.method,
          statusCode: res.statusCode,
          responseTime,
          timestamp: new Date().toISOString(),
          metadata: {
            email: email ? behavioralThreatDetection.maskEmail(email) : 'unknown',
            userAgent,
            loginSuccess: res.statusCode === 200,
            loginReason: res.statusCode === 200 ? 'successful_login' : 'failed_login'
          }
        };
        
        // Track login attempt (use email as temporary user ID for login tracking)
        behavioralThreatDetection.trackUserAction(
          email || 'anonymous',
          action,
          sessionId,
          ipAddress,
          userAgent
        );
        
        return originalEnd.call(this, chunk, encoding, cb);
      };
      
      next();
    };
  }

  // Card lookup tracking for fraud detection
  static trackCardLookup() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const originalEnd = res.end;
      const startTime = Date.now();
      
      res.end = function(chunk?: any, encoding?: any, cb?: any): Response {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        const user = (req as any).user;
        const userId = user?.userId || user?.id;
        const sessionId = behavioralThreatDetection.extractSessionId(req);
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        
        if (userId) {
          const bin = req.params?.bin || req.body?.bin;
          
          const action: UserAction = {
            id: `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            type: 'card_lookup',
            endpoint: req.route?.path || req.path,
            method: req.method,
            statusCode: res.statusCode,
            responseTime,
            timestamp: new Date().toISOString(),
            metadata: {
              bin: bin ? bin.substring(0, 6) : 'unknown',
              lookupSuccess: res.statusCode === 200,
              responseSize: chunk ? chunk.length : 0
            }
          };
          
          behavioralThreatDetection.trackUserAction(
            userId,
            action,
            sessionId,
            ipAddress,
            userAgent
          );
        }
        
        return originalEnd.call(this, chunk, encoding, cb);
      };
      
      next();
    };
  }

  // High-value operation tracking
  static trackHighValueOperation() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      const originalEnd = res.end;
      const startTime = Date.now();
      
      res.end = function(chunk?: any, encoding?: any, cb?: any): Response {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        const userId = req.user?.userId || req.user?.id;
        const sessionId = behavioralThreatDetection.extractSessionId(req);
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        
        if (userId) {
          const action: UserAction = {
            id: `high_value_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            type: 'api_call',
            endpoint: req.route?.path || req.path,
            method: req.method,
            statusCode: res.statusCode,
            responseTime,
            timestamp: new Date().toISOString(),
            metadata: {
              isHighValue: true,
              operationType: behavioralThreatDetection.determineHighValueOperation(req),
              requestSize: JSON.stringify(req.body).length,
              responseSize: chunk ? chunk.length : 0,
              requiresEscalation: req.path.includes('/admin') || req.path.includes('/sensitive')
            }
          };
          
          behavioralThreatDetection.trackUserAction(
            userId,
            action,
            sessionId,
            ipAddress,
            userAgent
          );
        }
        
        return originalEnd.call(this, chunk, encoding, cb);
      };
      
      next();
    };
  }

  // API abuse detection middleware
  static detectAPIAbuse() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      const endpoint = req.path;
      const method = req.method;
      
      // Check for suspicious patterns
      const suspiciousPatterns = [
        /\.\./,  // Path traversal
        /<script/i,  // XSS attempts
        /union.*select/i,  // SQL injection
        /cmd\.exe|\/bin\/bash/i,  // Command injection
      ];
      
      const isSuspicious = suspiciousPatterns.some(pattern => 
        pattern.test(JSON.stringify(req.query) + JSON.stringify(req.body) + endpoint)
      );
      
      if (isSuspicious) {
        logger.warn('Suspicious request pattern detected', {
          ipAddress,
          userAgent,
          endpoint,
          method,
          suspiciousPattern: true
        });
        
        // Create anonymous tracking for suspicious activity
        const action: UserAction = {
          id: `suspicious_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: 'api_call',
          endpoint,
          method,
          timestamp: new Date().toISOString(),
          metadata: {
            suspiciousPattern: true,
            blocked: true,
            reason: 'malicious_pattern_detected'
          }
        };
        
        behavioralThreatDetection.trackUserAction(
          'suspicious_activity',
          action,
          behavioralThreatDetection.generateSessionId(),
          ipAddress,
          userAgent
        );
        
        // Optionally block the request
        if (process.env.NODE_ENV === 'production') {
          res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Access denied'
            }
          });
          return;
        }
      }
      
      next();
    };
  }
}

// Extend behavioralThreatDetection with helper methods
declare module '@/security/behavioralThreatDetection' {
  interface BehavioralThreatDetection {
    extractSessionId(req: Request): string;
    generateSessionId(): string;
    determineActionType(req: Request): UserAction['type'];
    extractActionMetadata(req: Request, res: Response, responseTime: number): Record<string, any>;
    maskEmail(email: string): string;
    determineHighValueOperation(req: Request): string;
  }
}

// Implement helper methods by extending the class
const BehavioralThreatDetectionExtensions = {
  extractSessionId(req: Request): string {
    return req.headers['x-session-id'] as string || 
           req.cookies?.sessionId || 
           `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  },

  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  },

  determineActionType(req: Request): UserAction['type'] {
    const path = req.path;
    const method = req.method;
    
    if (path.includes('/auth/') && method === 'POST') return 'login';
    if (path.includes('/logout')) return 'logout';
    if (path.includes('/bin/') || path.includes('/card/')) return 'card_lookup';
    if (path.includes('/iban/')) return 'iban_validate';
    if (path.includes('/transaction/')) return 'transaction';
    if (path.includes('/admin/') || path.includes('/sensitive/')) return 'data_access';
    
    return 'api_call';
  },

  extractActionMetadata(req: Request, res: Response, responseTime: number): Record<string, any> {
    return {
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type'),
      requestSize: JSON.stringify(req.body).length,
      responseSize: res.get('Content-Length') || 0,
      responseTime,
      isApiRequest: req.path.startsWith('/api/'),
      isAdminRequest: req.path.includes('/admin'),
      isSensitiveOperation: req.path.includes('/sensitive') || req.path.includes('/admin')
    };
  },

  maskEmail(email: string): string {
    if (!email || typeof email !== 'string') return 'unknown';
    const [username, domain] = email.split('@');
    if (!username || !domain) return 'unknown';
    
    const maskedUsername = username.length > 2 ? 
      username[0] + '*'.repeat(username.length - 2) + username[username.length - 1] : 
      '*'.repeat(username.length);
    
    return `${maskedUsername}@${domain}`;
  },

  determineHighValueOperation(req: Request): string {
    const path = req.path;
    
    if (path.includes('/admin/users')) return 'user_management';
    if (path.includes('/admin/system')) return 'system_administration';
    if (path.includes('/payment/')) return 'payment_processing';
    if (path.includes('/sensitive/')) return 'sensitive_data_access';
    if (path.includes('/export/')) return 'data_export';
    if (path.includes('/delete/')) return 'data_deletion';
    
    return 'standard_operation';
  }
};

// Apply extensions
Object.assign(behavioralThreatDetection, BehavioralThreatDetectionExtensions);

// Export the class with extensions
class BehavioralTrackingMiddlewareExtended extends BehavioralTrackingMiddleware {}

export { BehavioralTrackingMiddlewareExtended as BehavioralTrackingMiddleware };
