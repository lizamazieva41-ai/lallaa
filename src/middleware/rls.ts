import { Request, Response, NextFunction } from 'express';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { logger } from '@/utils/logger';
import { TokenPayload } from '@/types';

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'bincheck',
  user: process.env.DB_USER || 'bincheck',
  password: process.env.DB_PASSWORD,
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
  apiKey?: {
    id: string;
    keyId: string;
    userId: string;
    name: string;
  };
}

/**
 * Row Level Security Middleware
 * Sets the RLS context for database operations
 */
export const rlsMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client: PoolClient = await pool.connect();
  
  try {
    // Extract user information from request
    const userId = req.user?.userId || req.apiKey?.userId;
    const userRole = req.user?.role || 'user';

    if (!userId) {
      throw new Error('User ID not found in request');
    }

    // Set RLS context for all operations
    await client.query('SELECT set_rls_context($1, $2)', [userId, userRole]);
    
    // Store client in request for reuse
    req.dbClient = client;
    
    logger.info('RLS context set', {
      userId: userId.substring(0, 8) + '***',
      userRole,
      path: req.path,
      method: req.method
    });

    next();
  } catch (error) {
    logger.error('Failed to set RLS context', error as Error, {
      path: req.path,
      method: req.method
    });
    
    client.release();
    res.status(500).json({
      success: false,
      error: {
        code: 'SECURITY_CONTEXT_ERROR',
        message: 'Failed to establish security context'
      }
    });
    return;
  }
};

/**
 * Clear RLS context after request completes
 */
export const clearRLSMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client = req.dbClient as PoolClient;
  
  if (client) {
    try {
      // Clear RLS context
      await client.query('SELECT clear_rls_context()');
      client.release();
    } catch (error) {
      logger.error('Failed to clear RLS context', error as Error);
    }
  }
  
  next();
};

/**
 * Service account authentication for system operations
 */
export const serviceAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const serviceToken = req.headers['x-service-token'] as string;
  
  if (!serviceToken) {
    res.status(401).json({
      success: false,
      error: {
        code: 'SERVICE_TOKEN_MISSING',
        message: 'Service token is required'
      }
    });
    return;
  }

  // Validate service token against environment or secure store
  const validTokens = process.env.SERVICE_TOKENS?.split(',') || [];
  
  if (!validTokens.includes(serviceToken)) {
    logger.warn('Invalid service token attempt', {
      token: serviceToken.substring(0, 8) + '***',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_SERVICE_TOKEN',
        message: 'Invalid service token'
      }
    });
    return;
  }

  const client: PoolClient = await pool.connect();
  
  try {
    // Set service account context
    await client.query("SELECT set_rls_context(NULL, 'service_account')");
    req.dbClient = client;
    
    logger.info('Service account authenticated', {
      path: req.path,
      method: req.method
    });
    
    next();
  } catch (error) {
    logger.error('Failed to set service context', error as Error);
    client.release();
    
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_CONTEXT_ERROR',
        message: 'Failed to establish service context'
      }
    });
    return;
  }
};

/**
 * Enhanced database query with RLS context
 */
export class SecureDatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  /**
   * Execute query with user context
   */
  async queryWithRLS<T extends QueryResultRow = QueryResultRow>(
    userId: string,
    userRole: string,
    sql: string,
    params?: any[]
  ): Promise<T[]> {
    const client: PoolClient = await this.pool.connect();
    
    try {
      // Set RLS context
      await client.query('SELECT set_rls_context($1, $2)', [userId, userRole]);
      
      // Execute query
      const result = await client.query<T>(sql, params);
      
      // Clear context
      await client.query('SELECT clear_rls_context()');
      
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Test RLS policies for a user
   */
  async testRLSPolicies(userId: string): Promise<any> {
    const sql = 'SELECT * FROM security.test_rls_policies($1)';
    return this.queryWithRLS(userId, 'user', sql, [userId]);
  }

  /**
   * Check if user can access specific user's data
   */
  async canAccessUser(requesterId: string, targetUserId: string): Promise<boolean> {
    const sql = 'SELECT can_access_user($1) as can_access';
    const result = await this.queryWithRLS<{ can_access: boolean }>(
      requesterId,
      'user',
      sql,
      [targetUserId]
    );
    return result[0]?.can_access || false;
  }

  /**
   * Monitor RLS policy effectiveness
   */
  async getRLSAuditReport(): Promise<any> {
    const client: PoolClient = await this.pool.connect();
    
    try {
      const result = await client.query('SELECT * FROM security.rls_policy_audit');
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Get user access patterns for security monitoring
   */
  async getUserAccessAudit(): Promise<any> {
    const client: PoolClient = await this.pool.connect();
    
    try {
      const result = await client.query('SELECT * FROM security.user_access_audit');
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Secure user data retrieval with RLS
   */
  async getUserData(userId: string, requestingUserId: string, userRole: string): Promise<any> {
    const sql = `
      SELECT 
        id, email, first_name, last_name, role, status, tier,
        quota_limit, quota_used, email_verified, two_factor_enabled,
        created_at, updated_at, last_login_at
      FROM users 
      WHERE id = $1
    `;
    
    const result = await this.queryWithRLS(
      requestingUserId,
      userRole,
      sql,
      [userId]
    );
    
    return result[0] || null;
  }

  /**
   * Secure API key retrieval with RLS
   */
  async getUserAPIKeys(userId: string, requestingUserId: string, userRole: string): Promise<any[]> {
    const sql = `
      SELECT 
        id, key_id, name, rate_limit, ip_whitelist, 
        last_used_at, expires_at, is_active, created_at, updated_at
      FROM api_keys 
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    
    return this.queryWithRLS(
      requestingUserId,
      userRole,
      sql,
      [userId]
    );
  }

  /**
   * Secure usage logs retrieval with RLS
   */
  async getUserUsageLogs(
    userId: string,
    requestingUserId: string,
    userRole: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<any[]> {
    const sql = `
      SELECT 
        id, endpoint, method, query_params, response_time, 
        status_code, ip_address, created_at
      FROM usage_logs 
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    return this.queryWithRLS(
      requestingUserId,
      userRole,
      sql,
      [userId, limit, offset]
    );
  }

  /**
   * Create audit log entry
   */
  async createAuditLog(entry: {
    userId: string;
    apiKeyId?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    oldValue?: any;
    newValue?: any;
    ipAddress?: string;
    userAgent?: string;
    requestPath?: string;
    requestMethod?: string;
    statusCode?: number;
  }): Promise<void> {
    const client: PoolClient = await this.pool.connect();
    
    try {
      // Set service context for audit logging
      await client.query("SELECT set_rls_context(NULL, 'service_account')");
      
      const sql = `
        INSERT INTO audit_logs (
          user_id, api_key_id, action, entity_type, entity_id,
          old_value, new_value, ip_address, user_agent,
          request_path, request_method, status_code
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;
      
      await client.query(sql, [
        entry.userId,
        entry.apiKeyId,
        entry.action,
        entry.entityType,
        entry.entityId,
        JSON.stringify(entry.oldValue),
        JSON.stringify(entry.newValue),
        entry.ipAddress,
        entry.userAgent,
        entry.requestPath,
        entry.requestMethod,
        entry.statusCode
      ]);
      
      await client.query('SELECT clear_rls_context()');
    } finally {
      client.release();
    }
  }
}

// Export singleton instance
export const secureDB = new SecureDatabaseService();

// Export the pool for backward compatibility
export { pool };

// Type extension for Express
declare global {
  namespace Express {
    interface Request {
      dbClient?: PoolClient;
    }
  }
}
