import Redis, { Cluster } from 'ioredis';
import config from '../config';
import { logger } from '../utils/logger';

let redisClient: Redis | Cluster | null = null;
let isClusterMode = false;

/**
 * Initialize Redis connection with cluster support
 */
export const initializeRedis = async (): Promise<void> => {
  try {
    // Check if cluster mode is enabled
    const clusterNodesRaw = config.redisCluster.nodes || [];
    const clusterNodes = clusterNodesRaw
      .map((n: any) => String(n))
      .map((s: string) => s.trim())
      .filter(Boolean)
      .map((s: string) => {
        // supports "host:port" strings
        const [host, portStr] = s.split(':');
        const port = portStr ? parseInt(portStr, 10) : 6379;
        return { host, port };
      });

    if (config.redisCluster.enabled && clusterNodes.length > 0) {
      // Initialize Redis Cluster
      redisClient = new Cluster(clusterNodes, {
        redisOptions: {
          password: config.redis.password || undefined,
          db: config.redis.db,
          keyPrefix: config.redis.keyPrefix,
          maxRetriesPerRequest: null,
          ...config.redisCluster.options,
        },
        clusterRetryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          logger.warn(`Redis cluster retry attempt ${times}, waiting ${delay}ms`);
          return delay;
        },
        enableOfflineQueue: false,
      });

      redisClient.on('connect', () => {
        logger.info('Redis Cluster connected');
        isClusterMode = true;
      });

      redisClient.on('error', (err: Error) => {
        logger.error('Redis Cluster error', { error: err.message });
      });

      redisClient.on('+node', (node: any) => {
        logger.info('Redis Cluster node added', { node: node.options.host });
      });

      redisClient.on('-node', (node: any) => {
        logger.warn('Redis Cluster node removed', { node: node.options.host });
      });

      redisClient.on('node error', (err: Error, node: any) => {
        logger.error('Redis Cluster node error', {
          error: err.message,
          node: node.options.host,
        });
      });

      await redisClient.connect();
      logger.info('Redis Cluster initialized successfully');
    } else {
      // Fallback to single Redis instance
      redisClient = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password || undefined,
        db: config.redis.db,
        keyPrefix: config.redis.keyPrefix,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
          return delay;
        },
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
      });

      redisClient.on('connect', () => {
        logger.info('Redis connected (single instance mode)');
        isClusterMode = false;
      });

      redisClient.on('error', (err: Error) => {
        logger.error('Redis error', { error: err.message });
      });

      await redisClient.connect();
      logger.info('Redis initialized successfully (single instance mode)');
    }
  } catch (error) {
    logger.error('Failed to initialize Redis', { error });
    // Try to fallback to single instance if cluster fails
    if (config.redisCluster.enabled) {
      logger.warn('Falling back to single Redis instance');
      try {
        redisClient = new Redis({
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password || undefined,
          db: config.redis.db,
          keyPrefix: config.redis.keyPrefix,
        });

        redisClient.on('connect', () => {
          logger.info('Redis connected (fallback single instance mode)');
          isClusterMode = false;
        });

        await redisClient.connect();
        logger.info('Redis fallback initialized successfully');
      } catch (fallbackError) {
        logger.error('Redis fallback also failed', { error: fallbackError });
        redisClient = null;
      }
    } else {
      redisClient = null;
    }
  }
};

/**
 * Get Redis client instance
 */
export const getRedisClient = (): Redis | Cluster | null => {
  return redisClient;
};

/**
 * Check if Redis is in cluster mode
 */
export const isRedisCluster = (): boolean => {
  return isClusterMode;
};

/**
 * Check if Redis is connected
 */
export const isRedisConnected = (): boolean => {
  return redisClient !== null && redisClient.status === 'ready';
};

/**
 * Close Redis connection
 */
export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
};

/**
 * Redis health check
 */
export const checkRedisHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  mode: 'cluster' | 'single' | 'none';
  responseTime?: number;
}> => {
  if (!redisClient) {
    return { status: 'unhealthy', mode: 'none' };
  }

  try {
    const startTime = Date.now();
    await redisClient.ping();
    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      mode: isClusterMode ? 'cluster' : 'single',
      responseTime,
    };
  } catch (error) {
    logger.error('Redis health check failed', { error });
    return {
      status: 'unhealthy',
      mode: isClusterMode ? 'cluster' : 'single',
    };
  }
};
