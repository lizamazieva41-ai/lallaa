import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from './rls';
import { secureDB } from './rls';
import { logger } from '../utils/logger';
import { UserRole, UserTier } from '@/types';

interface ApiKeyAuthRow {
  id: string;
  key_id: string;
  user_id: string;
  name: string;
  permissions: string[];
  rate_limit: number;
  ip_whitelist: string[] | null;
  last_used_at: Date | null;
  expires_at: Date | null;
  email: string;
  role: string;
  tier: string;
  status: string;
}

interface ApiKeyRotationRow {
  created_at: Date;
  needs_rotation: boolean;
}

const getHeaderValue = (value: string | string[] | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  return Array.isArray(value) ? value[0] : value;
};

const getParamValue = (value: string | string[] | undefined): string | undefined => {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
};

/**
 * JWT Authentication Middleware with RLS Integration
 */
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = getHeaderValue(req.headers['authorization']);
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_MISSING',
          message: 'Access token is required'
        }
      });
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    if (decoded.type !== 'access') {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN_TYPE',
          message: 'Invalid token type'
        }
      });
      return;
    }

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      tier: decoded.tier,
      type: 'access'
    };

    // Log authentication event
    logger.info('User authenticated via JWT', {
      userId: req.user.userId.substring(0, 8) + '***',
      email: req.user.email,
      role: req.user.role,
      path: req.path
    });

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Access token has expired'
        }
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      const headerToken = getHeaderValue(req.headers['authorization']);
      logger.warn('Invalid JWT token attempt', {
        token: headerToken ? headerToken.substring(0, 20) + '***' : undefined,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid access token'
        }
      });
      return;
    }

    logger.error('Authentication error', error as Error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication failed'
      }
    });
    return;
  }
};

/**
 * API Key Authentication Middleware with RLS Integration
 */
export const authenticateAPIKey = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = getHeaderValue(req.headers['x-api-key']);

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: {
          code: 'API_KEY_MISSING',
          message: 'API key is required'
        }
      });
      return;
    }

    // Hash the provided API key to compare with stored hash
    const crypto = require('crypto');
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Query API key using RLS (will be applied in next middleware)
    const sql = `
      SELECT 
        ak.id, ak.key_id, ak.user_id, ak.name, ak.permissions,
        ak.rate_limit, ak.ip_whitelist, ak.last_used_at, ak.expires_at,
        u.email, u.role, u.tier, u.status
      FROM api_keys ak
      JOIN users u ON ak.user_id = u.id
      WHERE ak.key_hash = $1 AND ak.is_active = true
    `;

    // Temporarily use direct connection for API key validation
    const result = await secureDB.queryWithRLS<ApiKeyAuthRow>(
      'system',
      'service_account',
      sql,
      [apiKeyHash]
    );
    
    if (result.length === 0) {
      logger.warn('Invalid API key attempt', {
        apiKeyHash: apiKeyHash.substring(0, 16) + '***',
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key'
        }
      });
      return;
    }

    const apiKeyData = result[0];

    // Check if API key has expired
    if (apiKeyData.expires_at && new Date() > new Date(apiKeyData.expires_at)) {
      res.status(401).json({
        success: false,
        error: {
          code: 'API_KEY_EXPIRED',
          message: 'API key has expired'
        }
      });
      return;
    }

    // Check if user account is active
    if (apiKeyData.status !== 'active') {
      res.status(401).json({
        success: false,
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'User account is not active'
        }
      });
      return;
    }

    // Check IP whitelist if configured
    if (apiKeyData.ip_whitelist && apiKeyData.ip_whitelist.length > 0) {
      const clientIP = req.ip || req.connection.remoteAddress || '';
      if (!apiKeyData.ip_whitelist.includes(clientIP)) {
        logger.warn('API key IP not whitelisted', {
          apiKeyId: apiKeyData.key_id,
          clientIP,
          whitelist: apiKeyData.ip_whitelist
        });
        
        res.status(403).json({
          success: false,
          error: {
            code: 'IP_NOT_WHITELISTED',
            message: 'IP address not whitelisted for this API key'
          }
        });
        return;
      }
    }

    // Attach API key and user info to request
    req.apiKey = {
      id: apiKeyData.id,
      keyId: apiKeyData.key_id,
      userId: apiKeyData.user_id,
      name: apiKeyData.name
    };

    req.user = {
      userId: apiKeyData.user_id,
      email: apiKeyData.email,
      role: apiKeyData.role as UserRole,
      tier: apiKeyData.tier as UserTier,
      type: 'access'
    };

    // Update last used timestamp asynchronously
    secureDB.queryWithRLS('system', 'service_account', 
      'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1',
      [apiKeyData.id]
    ).catch(error => {
      logger.error('Failed to update API key last used timestamp', error);
    });

    // Log API key authentication event
    logger.info('API key authenticated', {
      apiKeyId: req.apiKey.keyId,
      userId: req.user.userId.substring(0, 8) + '***',
      email: req.user.email,
      role: req.user.role,
      path: req.path
    });

    next();
  } catch (error) {
    logger.error('API key authentication error', error as Error);
    res.status(500).json({
      success: false,
      error: {
        code: 'API_KEY_AUTHENTICATION_ERROR',
        message: 'API key authentication failed'
      }
    });
    return;
  }
};

/**
 * Flexible authentication that accepts either JWT or API Key
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const apiKey = getHeaderValue(req.headers['x-api-key']);

  // Prefer API key if present
  if (apiKey) {
    await authenticateAPIKey(req, res, next);
    return;
  }

  // Fall back to JWT token
  const authHeaderValue = getHeaderValue(authHeader);
  if (authHeaderValue && authHeaderValue.startsWith('Bearer ')) {
    await authenticateToken(req, res, next);
    return;
  }

  // No authentication provided
  res.status(401).json({
    success: false,
    error: {
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Either API key or Bearer token is required'
    }
  });
  return;
};

/**
 * Authorization middleware for role-based access control
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'User must be authenticated'
        }
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Unauthorized access attempt', {
        userId: req.user.userId,
        role: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
        method: req.method
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
        }
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to require admin role
 */
export const requireAdmin = requireRole(['admin']);

/**
 * Middleware to check user access to specific user data
 */
export const requireUserAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetUserId = getParamValue(req.params.userId) || getParamValue(req.params.id);
    const requesterId = req.user?.userId;
    const requesterRole = req.user?.role;

    if (!requesterId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'User must be authenticated'
        }
      });
      return;
    }

    // Admin can access any user data
    if (requesterRole === 'admin') {
      next();
      return;
    }

    // Users can only access their own data
    if (requesterId !== targetUserId) {
      logger.warn('Unauthorized user data access attempt', {
        requesterId: requesterId.substring(0, 8) + '***',
        targetUserId: targetUserId ? targetUserId.substring(0, 8) + '***' : 'unknown',
        role: requesterRole,
        path: req.path,
        method: req.method
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'USER_ACCESS_DENIED',
          message: 'Access denied to user data'
        }
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('User access check error', error as Error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ACCESS_CHECK_ERROR',
        message: 'Failed to verify user access'
      }
    });
    return;
  }
};

/**
 * API Key rotation middleware
 */
export const checkAPIKeyRotation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.apiKey || !req.user) {
      next();
      return;
    }

    // Check if API key needs rotation (older than 90 days)
    const sql = `
      SELECT created_at, 
             CASE 
               WHEN created_at < CURRENT_DATE - INTERVAL '90 days' THEN true
               ELSE false
             END as needs_rotation
      FROM api_keys 
      WHERE id = $1
    `;

    const result = await secureDB.queryWithRLS<ApiKeyRotationRow>(
      req.user!.userId,
      req.user!.role,
      sql,
      [req.apiKey.id]
    );

    if (result.length > 0 && result[0].needs_rotation) {
      logger.info('API key rotation needed', {
        apiKeyId: req.apiKey.keyId,
        userId: req.user!.userId,
        createdAt: result[0].created_at
      });

      // Add rotation warning to response headers
      res.setHeader('X-API-Key-Rotation-Required', 'true');
      res.setHeader('X-API-Key-Rotation-Days', Math.floor(
        (new Date().getTime() - new Date(result[0].created_at).getTime()) / (1000 * 60 * 60 * 24)
      ).toString());
    }

    next();
  } catch (error) {
    logger.error('API key rotation check error', error as Error);
    next(); // Continue even if rotation check fails
  }
};
