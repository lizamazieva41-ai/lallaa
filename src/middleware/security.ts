/**
 * Security Middleware
 * Additional security enhancements including input sanitization and anomaly detection
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { recordSuspiciousActivity, recordUnauthorizedAccess } from '../services/metrics';

/**
 * Input sanitization middleware
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Sanitize string inputs
  const sanitizeString = (str: string): string => {
    return str
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  };

  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return sanitizeString(obj);
      } else if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      } else if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const key in obj) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
        return sanitized;
      }
      return obj;
    };

    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key] as string);
      }
    }
  }

  next();
};

/**
 * Anomaly detection for generation patterns
 */
export const detectAnomalies = (req: Request, res: Response, next: NextFunction): void => {
  // Track generation patterns
  const userId = (req as any).user?.id;
  const apiKeyId = (req as any).apiKey?.id;
  const path = req.path;

  // Check for suspicious patterns
  if (path.includes('/cards/generate') || path.includes('/cards/generate-async')) {
    const count = parseInt(req.body?.count || req.query?.count || '1', 10);
    const bin = req.body?.bin || req.query?.bin;

    // Detect suspicious patterns
    const suspiciousPatterns: string[] = [];

    // Very high count requests
    if (count > 10000) {
      suspiciousPatterns.push('excessive_count');
    }

    // Rapid repeated requests (would need rate limiting integration)
    // This is handled by rate limiting middleware

    // Unusual BIN patterns
    if (bin && !/^\d{6,8}$/.test(bin)) {
      suspiciousPatterns.push('invalid_bin_format');
    }

    if (suspiciousPatterns.length > 0) {
      logger.warn('Suspicious activity detected', {
        userId,
        apiKeyId,
        path,
        patterns: suspiciousPatterns,
        requestId: req.requestId,
      });

      recordSuspiciousActivity(suspiciousPatterns.join(','), 'medium');
    }
  }

  next();
};

/**
 * Security headers validation
 */
export const validateSecurityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Add security headers if missing
  if (!res.getHeader('X-Content-Type-Options')) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
  if (!res.getHeader('X-Frame-Options')) {
    res.setHeader('X-Frame-Options', 'DENY');
  }
  if (!res.getHeader('X-XSS-Protection')) {
    res.setHeader('X-XSS-Protection', '1; mode=block');
  }

  next();
};

/**
 * WebSocket security middleware
 */
export const websocketSecurity = (socket: any, next: Function): void => {
  // Validate authentication token
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

  if (!token) {
    logger.warn('WebSocket connection attempt without authentication', {
      socketId: socket.id,
    });
    recordUnauthorizedAccess('unknown', '/websocket', 'CONNECT');
    return next(new Error('Authentication required'));
  }

  // Token validation would be done here
  // For now, just pass through
  next();
};

/**
 * Rate limiting for WebSocket connections
 */
const websocketConnections = new Map<string, { count: number; resetAt: number }>();

export const websocketRateLimit = (socket: any, next: Function): void => {
  const clientId = socket.handshake.address || socket.id;
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxConnections = 10; // Max 10 connections per minute per client

  const clientData = websocketConnections.get(clientId);

  if (!clientData || now > clientData.resetAt) {
    websocketConnections.set(clientId, { count: 1, resetAt: now + windowMs });
    return next();
  }

  if (clientData.count >= maxConnections) {
    logger.warn('WebSocket rate limit exceeded', {
      clientId,
      count: clientData.count,
    });
    recordUnauthorizedAccess('unknown', '/websocket', 'CONNECT');
    return next(new Error('Rate limit exceeded'));
  }

  clientData.count++;
  next();
};
