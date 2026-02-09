import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import config from '../config';
import { logger } from '../utils/logger';
import { recordDatabaseQuery } from '../services/metrics';

class Database {
  private pool: Pool;
  private isConnected: boolean = false;
  private connectionRetries: number = 0;
  private maxRetries: number = 3;
  private preparedStatements: Map<string, string> = new Map();
  private slowQueryThreshold: number = 100; // milliseconds

  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.username,
      password: config.database.password,
      database: config.database.name,
      // Optimized pool settings for performance
      min: config.database.pool.min || 5, // Increased from 2 to 5 for better connection availability
      max: config.database.pool.max || 20,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
      // Optimized timeout settings
      idleTimeoutMillis: 60000, // Increased from 30s to 60s to reduce connection churn
      connectionTimeoutMillis: 10000, // 10 seconds connection timeout
      statement_timeout: 30000, // 30 seconds query timeout
      query_timeout: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      // Additional performance optimizations
      allowExitOnIdle: false, // Keep pool alive
      maxUses: 7500, // Recycle connections after 7500 uses to prevent memory leaks
    });

    this.pool.on('error', (err: Error) => {
      logger.error('Unexpected database pool error', { error: err.message });
      this.isConnected = false;
    });

    this.pool.on('connect', () => {
      logger.debug('New database connection established');
      this.connectionRetries = 0;
    });

    this.pool.on('remove', () => {
      logger.debug('Database connection removed from pool');
    });

    // Monitor pool statistics
    setInterval(() => {
      this.logPoolStats();
    }, 60000); // Every minute
  }

  public async connect(): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const client = await this.pool.connect();
        client.release();
        this.isConnected = true;
        this.connectionRetries = 0;
        logger.info('Database connected successfully', {
          host: config.database.host,
          database: config.database.name,
          attempt,
        });
        return;
      } catch (error) {
        lastError = error as Error;
        this.connectionRetries = attempt;
        logger.warn('Database connection attempt failed', {
          attempt,
          maxRetries: this.maxRetries,
          error: lastError.message,
        });

        if (attempt < this.maxRetries) {
          // Exponential backoff: wait 1s, 2s, 4s
          const waitTime = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    logger.error('Database connection failed after retries', {
      attempts: this.maxRetries,
      error: lastError,
    });
    throw lastError || new Error('Database connection failed');
  }

  public async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Database disconnection failed', { error });
      throw error;
    }
  }

  public getPool(): Pool {
    return this.pool;
  }

  public async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    const operation = this.getOperationName(text);
    
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      
      // Record metrics
      recordDatabaseQuery(operation, duration / 1000);
      
      // Log slow queries
      if (duration > this.slowQueryThreshold) {
        logger.warn('Slow database query detected', {
          query: text.substring(0, 200),
          duration,
          rowCount: result.rowCount,
          operation,
          threshold: this.slowQueryThreshold,
        });
      } else {
        logger.debug('Database query executed', {
          query: text.substring(0, 100),
          duration,
          rowCount: result.rowCount,
          operation,
        });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Database query failed', {
        query: text.substring(0, 100),
        duration,
        error,
        operation,
      });
      throw error;
    }
  }

  /**
   * Get operation name from query for metrics
   */
  private getOperationName(query: string): string {
    const trimmed = query.trim().toUpperCase();
    if (trimmed.startsWith('SELECT')) return 'select';
    if (trimmed.startsWith('INSERT')) return 'insert';
    if (trimmed.startsWith('UPDATE')) return 'update';
    if (trimmed.startsWith('DELETE')) return 'delete';
    if (trimmed.startsWith('CREATE')) return 'create';
    if (trimmed.startsWith('ALTER')) return 'alter';
    if (trimmed.startsWith('DROP')) return 'drop';
    return 'other';
  }

  /**
   * Log pool statistics
   */
  private logPoolStats(): void {
    const stats = {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };

    // Log warning if pool is getting full
    if (stats.totalCount >= (this.pool.options.max || 20) * 0.8) {
      logger.warn('Database connection pool usage high', stats);
    } else {
      logger.debug('Database connection pool stats', stats);
    }
  }

  public async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public isHealthy(): boolean {
    return this.isConnected;
  }

  public async checkHealth(): Promise<{ status: string; latency: number; poolStats?: any }> {
    const start = Date.now();
    try {
      await this.query('SELECT 1');
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency,
        poolStats: {
          total: this.pool.totalCount,
          idle: this.pool.idleCount,
          waiting: this.pool.waitingCount,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
      };
    }
  }

  /**
   * Get pool statistics
   */
  public getPoolStats(): {
    total: number;
    idle: number;
    waiting: number;
    max: number;
  } {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
      max: this.pool.options.max || 20,
    };
  }

  /**
   * Execute query with prepared statement (cached)
   */
  public async queryPrepared<T extends QueryResultRow = QueryResultRow>(
    name: string,
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    // For now, use regular query - prepared statements would require connection-level management
    // In production with PgBouncer, prepared statements should be disabled anyway
    return this.query<T>(text, params);
  }
}

export const database = new Database();

// Schema initialization using master schema
export const initializeSchema = async (): Promise<void> => {
  try {
    // Read the master schema file
    const fs = await import('fs');
    const path = await import('path');
    
    const schemaPath = path.join(__dirname, 'schema-master.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await database.query(schema);
    logger.info('Database schema initialized successfully using master schema');
  } catch (error) {
    logger.error('Failed to initialize database schema', { error });
    throw error;
  }
};

export default database;
