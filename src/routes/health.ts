/**
 * Health Check Routes
 * Provides health check endpoints for monitoring
 */

import { Router, Request, Response } from 'express';
import database from '../database/connection';
import { getRedisClient } from '../services/redisConnection';
import { getJobQueue, getQueueStats } from '../services/jobQueue';
import { getWebSocketServer } from '../services/websocketService';
import { uniquenessService } from '../services/uniquenessService';
import { getBloomFilterService } from '../services/bloomFilterService';
import axios from 'axios';
import config from '../config';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  services: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
    };
    redis: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      mode?: 'single' | 'cluster';
    };
    jobQueue: {
      status: 'healthy' | 'unhealthy';
      stats?: {
        waiting: number;
        active: number;
        completed: number;
        failed: number;
      };
    };
    uniquenessService: {
      status: 'healthy' | 'unhealthy';
    };
    websocket: {
      status: 'healthy' | 'unhealthy';
      connectedClients?: number;
    };
    bloomFilter: {
      status: 'healthy' | 'unhealthy';
    };
    doremonAI: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
    };
  };
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<{ status: 'healthy' | 'unhealthy'; responseTime?: number }> {
  const startTime = Date.now();
  try {
    await database.query('SELECT 1');
    const responseTime = Date.now() - startTime;
    return { status: 'healthy', responseTime };
  } catch (error) {
    return { status: 'unhealthy' };
  }
}

/**
 * Check Redis connectivity
 */
async function checkRedis(): Promise<{ status: 'healthy' | 'unhealthy'; responseTime?: number; mode?: 'single' | 'cluster' }> {
  const startTime = Date.now();
  try {
    const redisClient = getRedisClient();
    if (!redisClient) {
      return { status: 'unhealthy' };
    }
    await redisClient.ping();
    const responseTime = Date.now() - startTime;
    const mode = config.redisCluster.enabled ? 'cluster' : 'single';
    return { status: 'healthy', responseTime, mode };
  } catch (error) {
    return { status: 'unhealthy' };
  }
}

/**
 * Check Job Queue
 */
async function checkJobQueue(): Promise<{ status: 'healthy' | 'unhealthy'; stats?: any }> {
  try {
    const queue = getJobQueue();
    if (!queue) {
      return { status: 'unhealthy' };
    }
    const stats = await getQueueStats();
    return { status: 'healthy', stats };
  } catch (error) {
    return { status: 'unhealthy' };
  }
}

/**
 * Check Uniqueness Service
 */
async function checkUniquenessService(): Promise<{ status: 'healthy' | 'unhealthy' }> {
  try {
    // Simple health check - verify service is initialized
    if (!uniquenessService) {
      return { status: 'unhealthy' };
    }
    return { status: 'healthy' };
  } catch (error) {
    return { status: 'unhealthy' };
  }
}

/**
 * Check WebSocket Server
 */
async function checkWebSocket(): Promise<{ status: 'healthy' | 'unhealthy'; connectedClients?: number }> {
  try {
    const io = getWebSocketServer();
    if (!io) {
      return { status: 'unhealthy' };
    }
    const connectedClients = io.sockets.sockets.size;
    return { status: 'healthy', connectedClients };
  } catch (error) {
    return { status: 'unhealthy' };
  }
}

/**
 * Check Bloom Filter
 */
async function checkBloomFilter(): Promise<{ status: 'healthy' | 'unhealthy' }> {
  try {
    const bloomFilterService = getBloomFilterService();
    const health = await bloomFilterService.healthCheck();
    return { status: health.status === 'healthy' ? 'healthy' : 'unhealthy' };
  } catch (error) {
    return { status: 'unhealthy' };
  }
}

/**
 * Check doremon-ai API connectivity
 */
async function checkDoremonAI(): Promise<{ status: 'healthy' | 'unhealthy'; responseTime?: number }> {
  const startTime = Date.now();
  try {
    const response = await axios.get(`${config.doremonAI.doremonApiUrl}/health`, {
      timeout: 5000,
      headers: {
        'X-API-Key': config.doremonAI.doremonApiKey,
      },
    });
    const responseTime = Date.now() - startTime;
    if (response.status === 200) {
      return { status: 'healthy', responseTime };
    }
    return { status: 'unhealthy' };
  } catch (error) {
    return { status: 'unhealthy' };
  }
}

/**
 * GET /health
 * Comprehensive health check
 */
router.get('/health', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [database, redis, jobQueue, uniquenessService, websocket, bloomFilter, doremonAI] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkJobQueue(),
      checkUniquenessService(),
      checkWebSocket(),
      checkBloomFilter(),
      checkDoremonAI(),
    ]);

    const services = {
      database,
      redis,
      jobQueue,
      uniquenessService,
      websocket,
      bloomFilter,
      doremonAI,
    };

    // Determine overall status
    const allHealthy = Object.values(services).every(s => s.status === 'healthy');
    const anyUnhealthy = Object.values(services).some(s => s.status === 'unhealthy');

    const overallStatus: 'healthy' | 'unhealthy' | 'degraded' = allHealthy
      ? 'healthy'
      : anyUnhealthy
      ? 'unhealthy'
      : 'degraded';

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services,
    };

    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

/**
 * GET /health/liveness
 * Simple liveness probe
 */
router.get('/health/liveness', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/readiness
 * Readiness probe - checks if service is ready to accept traffic
 */
router.get('/health/readiness', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [database, redis, jobQueue] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkJobQueue(),
    ]);
    
    // Service is ready if critical services are healthy
    const isReady = database.status === 'healthy' && redis.status === 'healthy';
    
    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        services: {
          database: database.status,
          redis: redis.status,
          jobQueue: jobQueue.status,
        },
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        reason: 'Critical services not available',
        services: {
          database: database.status,
          redis: redis.status,
          jobQueue: jobQueue.status,
        },
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed',
    });
  }
});

export default router;
