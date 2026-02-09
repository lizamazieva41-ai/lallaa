import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import config from '../config';
import { logger, logSecurity } from '../utils/logger';
import { getRedisClient, initializeRedis as initRedis } from '../services/redisConnection';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      rateLimit?: {
        limit: number;
        remaining: number;
        resetAt: number;
      };
    }
  }
}

let rateLimiter: RateLimiterRedis | null = null;

// Rate limiter cache to avoid creating new instances per request
const limiterCache = new Map<string, RateLimiterRedis>();
const MAX_CACHE_SIZE = 100;

// Initialize rate limiter (Redis connection is handled by redisConnection service)
export const initializeRateLimiter = async (): Promise<void> => {
  try {
    // Initialize Redis connection first
    await initRedis();
    
    const redisClient = getRedisClient();
    if (!redisClient) {
      logger.warn('Redis client not available, rate limiter will be disabled');
      return;
    }

    rateLimiter = new RateLimiterRedis({
      storeClient: redisClient as any, // ioredis is compatible with rate-limiter-flexible
      keyPrefix: `${config.redis.keyPrefix}ratelimit:`,
      points: config.rateLimit.limits.free, // Default to free tier max points
      duration: 60, // 60 seconds (1 minute) window
      blockDuration: 60, // Block for 60 seconds if exceeded
    });

    logger.info('Rate limiter initialized with Redis');
  } catch (error) {
    logger.error('Failed to initialize rate limiter', { error });
    // Continue without rate limiting if Redis is not available
  }
};

// Get rate limit based on tier
const getRateLimitByTier = (tier: string): number => {
  const limits: Record<string, number> = {
    free: config.rateLimit.limits.free,
    basic: config.rateLimit.limits.basic,
    premium: config.rateLimit.limits.premium,
    enterprise: config.rateLimit.limits.enterprise,
  };
  return limits[tier] || limits.free;
};

// Rate limit middleware factory
export const rateLimiterMiddleware = (options?: {
  tier?: string;
  points?: number;
  duration?: number;
  failPolicy?: 'open' | 'closed';
}) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Skip rate limiting if rate limiter is not initialized
    const redisClient = getRedisClient();
    if (!rateLimiter || !redisClient) {
      const failPolicy = options?.failPolicy || process.env.RATE_LIMIT_FAIL_POLICY || 'open';
      
      if (failPolicy === 'closed') {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/68f74db3-bc9b-4d85-afd1-80287a0b1f9b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'baseline',hypothesisId:'H3',location:'src/middleware/rateLimit.ts:unavailable',message:'ratelimit.unavailable',data:{requestId:req.requestId,path:req.path,policy:'closed'},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        res.status(503).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_UNAVAILABLE',
            message: 'Service temporarily unavailable - rate limiting system down',
            details: {
              policy: 'fail-closed',
              reason: 'Redis rate limiter not available'
            }
          }
        });
        return;
      }
      
      // fail-open: allow request but log warning
      logger.warn('Rate limiting disabled - Redis unavailable', {
        path: req.path,
        ip: req.ip,
        userId: req.userId,
        policy: 'fail-open'
      });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/68f74db3-bc9b-4d85-afd1-80287a0b1f9b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'baseline',hypothesisId:'H3',location:'src/middleware/rateLimit.ts:unavailable',message:'ratelimit.unavailable',data:{requestId:req.requestId,path:req.path,policy:'open'},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return next();
    }

    try {
      // Determine rate limit points
      let points = options?.points || 100;
      let duration = options?.duration || 60;

      // Get user tier from authenticated request
      if (req.user && options?.points === undefined) {
        points = getRateLimitByTier(req.user.tier);
        duration = 60; // 1 minute window
      }

      // Create cache key for limiter
      const cacheKey = `${points}-${duration}`;
      
      // Get or create cached limiter
      let userRateLimiter = limiterCache.get(cacheKey);
      if (!userRateLimiter) {
        const redisClientForLimiter = getRedisClient();
        if (!redisClientForLimiter) {
          logger.warn('Redis client not available for rate limiter');
          return next();
        }
        
        userRateLimiter = new RateLimiterRedis({
          storeClient: redisClientForLimiter as any,
          keyPrefix: `${config.redis.keyPrefix}ratelimit:`,
          points: points, // Max points for this tier
          duration: duration, // Window duration
          blockDuration: 60, // Block for 60 seconds if exceeded
        });
        
        // Add to cache with cleanup logic
        limiterCache.set(cacheKey, userRateLimiter);
        
        // Cleanup old limiters if cache is full
        if (limiterCache.size > MAX_CACHE_SIZE) {
          const oldestKey = limiterCache.keys().next().value;
          if (oldestKey !== undefined) {
            limiterCache.delete(oldestKey);
            logger.debug('Rate limiter cache cleanup', { removedKey: oldestKey, cacheSize: limiterCache.size });
          }
        }
      }

      // Create rate limit key for this specific user/path
      const key = req.userId || req.apiKeyId || req.ip || 'anonymous';
      const rateLimitKey = `${key}:${req.path}`;

      try {
        const rateLimitRes = await userRateLimiter.consume(rateLimitKey, 1); // Consume 1 point per request

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': String(points),
          'X-RateLimit-Remaining': String(rateLimitRes.remainingPoints),
          'X-RateLimit-Reset': String(Math.ceil(rateLimitRes.msBeforeNext / 1000)),
        });

        // Store rate limit info in request
        req.rateLimit = {
          limit: points,
          remaining: rateLimitRes.remainingPoints,
          resetAt: Date.now() + rateLimitRes.msBeforeNext,
        };

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/68f74db3-bc9b-4d85-afd1-80287a0b1f9b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'baseline',hypothesisId:'H3',location:'src/middleware/rateLimit.ts:consume',message:'ratelimit.ok',data:{requestId:req.requestId,path:req.path,keyType:req.userId?'userId':(req.apiKeyId?'apiKeyId':(req.ip?'ip':'anon')),points,remaining:rateLimitRes.remainingPoints},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        next();
      } catch (error) { // renamed rateLimiterRes to error to avoid confusion
        if (error instanceof Error) { // if it's a generic error, rethrow
          throw error;
        }
        // Assert error as RateLimiterRes since it's thrown when limit is exceeded
        const rateLimiterRes = error as RateLimiterRes;

        const retryAfter = Math.ceil(rateLimiterRes.msBeforeNext / 1000);

        res.set({
          'X-RateLimit-Limit': String(rateLimiterRes.totalPoints),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(rateLimiterRes.msBeforeNext / 1000)),
          'Retry-After': String(retryAfter),
        });

        logSecurity('Rate limit exceeded', {
          key,
          path: req.path,
          method: req.method,
          retryAfter,
        });

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/68f74db3-bc9b-4d85-afd1-80287a0b1f9b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'baseline',hypothesisId:'H3',location:'src/middleware/rateLimit.ts:consume',message:'ratelimit.exceeded',data:{requestId:req.requestId,path:req.path,retryAfterSec:retryAfter,totalPoints:rateLimiterRes.totalPoints},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
            details: {
              retryAfter,
              limit: rateLimiterRes.totalPoints,
              window: '1 minute',
            },
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
          },
        });
        return;
      }
    } catch (error) {
      logger.error('Rate limiter error', { error });
      // Allow request on rate limiter errors
      next();
    }
  };
};

// Strict rate limit for authentication endpoints
export const authRateLimiter = rateLimiterMiddleware({
  points: 5,
  duration: 60 * 15, // 15 minutes
});

// API key creation rate limit
export const apiKeyRateLimiter = rateLimiterMiddleware({
  points: 10,
  duration: 60 * 60, // 1 hour
});

// Admin operations rate limit (more restrictive)
export const adminRateLimiter = rateLimiterMiddleware({
  points: 50,
  duration: 60, // 1 minute
});

// Sensitive admin operations rate limit (very restrictive)
export const adminSensitiveRateLimiter = rateLimiterMiddleware({
  points: 5,
  duration: 60 * 5, // 5 minutes
});

// Get rate limiter stats
export const getRateLimiterStats = async (): Promise<{
  status: string;
  memoryUsage: number;
}> => {
  if (!rateLimiter) {
    return { status: 'not initialized', memoryUsage: 0 };
  }

  try {
    const stats = await rateLimiter.getStats();
    return {
      status: 'active',
      memoryUsage: stats.points, // Number of keys in store (assuming points indicates count)
    };
  } catch (error) {
    logger.error('Failed to get rate limiter stats', { error });
    return { status: 'error', memoryUsage: 0 };
  }
};

// Cleanup rate limiter
export const cleanupRateLimiter = async (): Promise<void> => {
  rateLimiter = null;
  // Redis connection cleanup is handled by redisConnection service
  logger.info('Rate limiter cleanup completed');
};
