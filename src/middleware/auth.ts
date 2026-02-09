import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger, logSecurity } from '../utils/logger';
import config from '../config';
import { TokenPayload, AppError } from '../types';
import { userModel } from '../models/user';
import { apiKeyModel } from '../models/apiKey';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      apiKeyId?: string;
      userId?: string;
      requestId?: string;
    }
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string, code: string = 'AUTH_ERROR') {
    super(message, 401, code, true);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string, code: string = 'FORBIDDEN') {
    super(message, 403, code, true);
    this.name = 'AuthorizationError';
  }
}

// JWT token verification middleware
export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];

    try {
      // Explicitly set algorithms to prevent 'none' algorithm attacks
      const decoded = jwt.verify(token, config.jwt.secret, {
        algorithms: ['HS256'],
        ignoreExpiration: false
      }) as TokenPayload;

      if (decoded.type !== 'access') {
        throw new AuthenticationError('Invalid token type');
      }

      // Verify user still exists and is active
      const user = await userModel.findById(decoded.userId);
      if (!user || user.status !== 'active') {
        throw new AuthenticationError('User not found or inactive');
      }

      req.user = decoded;
      req.userId = decoded.userId;
      next();
    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Token expired');
      }
      if (jwtError instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid token');
      }
      throw jwtError;
    }
  } catch (error) {
    if (error instanceof AuthenticationError) {
      logSecurity('Authentication failed', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        message: error.message,
      });
    }
    next(error);
  }
};

// API Key verification middleware
export const authenticateAPIKey = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string | undefined;

    if (!apiKey) {
      throw new AuthenticationError('Missing API key');
    }

    // Hash the provided key for comparison
    const crypto = await import('crypto');
    const keyHash = crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');

    const keyData = await apiKeyModel.validate(keyHash);

    if (!keyData) {
      throw new AuthenticationError('Invalid API key');
    }

    if (keyData.userId) {
      req.userId = keyData.userId;
    }
    req.apiKeyId = keyData.keyId;

    // Check IP whitelist if configured
    if (keyData.ipWhitelist.length > 0 && req.ip) {
      const clientIP = req.ip.replace(/^::ffff:/, ''); // Handle IPv4-mapped IPv6
      if (!keyData.ipWhitelist.includes(clientIP)) {
        throw new AuthorizationError('IP address not whitelisted');
      }
    }

    // Update last used timestamp (async, don't wait)
    apiKeyModel.updateLastUsed(keyData.id).catch((err) => {
      logger.error('Failed to update API key last used', { error: err });
    });

    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      logSecurity('API key authentication failed', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        message: error.message,
      });
    }
    next(error);
  }
};

// Combined authentication middleware (accepts either JWT or API Key)
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string | undefined;

    if (apiKey) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/68f74db3-bc9b-4d85-afd1-80287a0b1f9b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'baseline',hypothesisId:'H2',location:'src/middleware/auth.ts:authenticate',message:'auth.branch',data:{requestId:req.requestId,path:req.path,method:req.method,branch:'apiKey',ip:req.ip},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return authenticateAPIKey(req, res, next);
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/68f74db3-bc9b-4d85-afd1-80287a0b1f9b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'baseline',hypothesisId:'H2',location:'src/middleware/auth.ts:authenticate',message:'auth.branch',data:{requestId:req.requestId,path:req.path,method:req.method,branch:'jwt',ip:req.ip},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return authenticateJWT(req, res, next);
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/68f74db3-bc9b-4d85-afd1-80287a0b1f9b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'baseline',hypothesisId:'H2',location:'src/middleware/auth.ts:authenticate',message:'auth.branch',data:{requestId:req.requestId,path:req.path,method:req.method,branch:'missing',ip:req.ip},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return next(new AuthenticationError('Authentication required'));
  } catch (error) {
    next(error);
  }
};

// Role-based authorization middleware
export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AuthorizationError('Insufficient permissions');
    }

    next();
  };
};

// Optional authentication (doesn't throw if not authenticated)
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string | undefined;
    const authHeader = req.headers.authorization;

    if (apiKey) {
      return authenticateAPIKey(req, res, next);
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authenticateJWT(req, res, next);
    }

    next();
  } catch (error) {
    // Don't throw on optional auth failures
    next();
  }
};

// Rate limit tracking for authenticated users
export const trackUserActivity = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.userId) {
    res.set('X-User-ID', req.userId);
  }
  if (req.apiKeyId) {
    res.set('X-API-Key-ID', req.apiKeyId);
  }
  next();
};
