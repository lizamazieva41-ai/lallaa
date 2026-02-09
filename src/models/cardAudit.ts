import { QueryResult } from 'pg';
import database from '../database/connection';
import { logger } from '../utils/logger';

export interface CardGenerationAudit {
  id: string;
  userId?: string;
  apiKeyId?: string;
  endpoint: string;
  method: string;
  requestBody?: Record<string, unknown>;
  requestParams?: Record<string, unknown>;
  cardsGenerated: number;
  generationMode?: string;
  binUsed?: string;
  responseTimeMs?: number;
  statusCode?: number;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  createdAt: Date;
}

export interface CreateAuditInput {
  userId?: string;
  apiKeyId?: string;
  endpoint: string;
  method: string;
  requestBody?: Record<string, unknown>;
  requestParams?: Record<string, unknown>;
  cardsGenerated: number;
  generationMode?: string;
  binUsed?: string;
  responseTimeMs?: number;
  statusCode?: number;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

interface AuditRow {
  id: string;
  user_id: string | null;
  api_key_id: string | null;
  endpoint: string;
  method: string;
  request_body: Record<string, unknown> | null;
  request_params: Record<string, unknown> | null;
  cards_generated: string;
  generation_mode: string | null;
  bin_used: string | null;
  response_time_ms: number | null;
  status_code: number | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  created_at: Date;
}

const mapRowToAudit = (row: AuditRow): CardGenerationAudit => ({
  id: row.id,
  userId: row.user_id || undefined,
  apiKeyId: row.api_key_id || undefined,
  endpoint: row.endpoint,
  method: row.method,
  requestBody: row.request_body || undefined,
  requestParams: row.request_params || undefined,
  cardsGenerated: parseInt(row.cards_generated, 10),
  generationMode: row.generation_mode || undefined,
  binUsed: row.bin_used || undefined,
  responseTimeMs: row.response_time_ms || undefined,
  statusCode: row.status_code || undefined,
  ipAddress: row.ip_address || undefined,
  userAgent: row.user_agent || undefined,
  requestId: row.request_id || undefined,
  createdAt: row.created_at,
});

export class CardAuditModel {
  private tableName = 'card_generation_audit';

  /**
   * Create a new audit log entry
   */
  public async create(input: CreateAuditInput): Promise<CardGenerationAudit> {
    const query = `
      INSERT INTO ${this.tableName} (
        user_id, api_key_id, endpoint, method,
        request_body, request_params,
        cards_generated, generation_mode, bin_used,
        response_time_ms, status_code,
        ip_address, user_agent, request_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      input.userId || null,
      input.apiKeyId || null,
      input.endpoint,
      input.method,
      input.requestBody ? JSON.stringify(input.requestBody) : null,
      input.requestParams ? JSON.stringify(input.requestParams) : null,
      input.cardsGenerated,
      input.generationMode || null,
      input.binUsed || null,
      input.responseTimeMs || null,
      input.statusCode || null,
      input.ipAddress || null,
      input.userAgent || null,
      input.requestId || null,
    ];

    try {
      const result: QueryResult<AuditRow> = await database.query(query, values);
      return mapRowToAudit(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create audit log', { error, endpoint: input.endpoint });
      throw error;
    }
  }

  /**
   * Get audit logs by user ID
   */
  public async findByUserId(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ audits: CardGenerationAudit[]; total: number }> {
    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${this.tableName}
      WHERE user_id = $1
    `;

    const dataQuery = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        database.query<{ total: string }>(countQuery, [userId]),
        database.query<AuditRow>(dataQuery, [userId, limit, offset]),
      ]);

      return {
        audits: dataResult.rows.map(mapRowToAudit),
        total: parseInt(countResult.rows[0].total, 10),
      };
    } catch (error) {
      logger.error('Failed to find audit logs by user ID', { error, userId });
      throw error;
    }
  }

  /**
   * Get audit logs by BIN
   */
  public async findByBin(
    bin: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ audits: CardGenerationAudit[]; total: number }> {
    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${this.tableName}
      WHERE bin_used = $1
    `;

    const dataQuery = `
      SELECT * FROM ${this.tableName}
      WHERE bin_used = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        database.query<{ total: string }>(countQuery, [bin]),
        database.query<AuditRow>(dataQuery, [bin, limit, offset]),
      ]);

      return {
        audits: dataResult.rows.map(mapRowToAudit),
        total: parseInt(countResult.rows[0].total, 10),
      };
    } catch (error) {
      logger.error('Failed to find audit logs by BIN', { error, bin });
      throw error;
    }
  }

  /**
   * Get audit logs by date range
   */
  public async findByDateRange(
    startDate: Date,
    endDate: Date,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ audits: CardGenerationAudit[]; total: number }> {
    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${this.tableName}
      WHERE created_at >= $1 AND created_at <= $2
    `;

    const dataQuery = `
      SELECT * FROM ${this.tableName}
      WHERE created_at >= $1 AND created_at <= $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        database.query<{ total: string }>(countQuery, [startDate, endDate]),
        database.query<AuditRow>(dataQuery, [startDate, endDate, limit, offset]),
      ]);

      return {
        audits: dataResult.rows.map(mapRowToAudit),
        total: parseInt(countResult.rows[0].total, 10),
      };
    } catch (error) {
      logger.error('Failed to find audit logs by date range', { error, startDate, endDate });
      throw error;
    }
  }

  /**
   * Get audit logs by request ID (for tracing)
   */
  public async findByRequestId(requestId: string): Promise<CardGenerationAudit[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE request_id = $1
      ORDER BY created_at DESC
    `;

    try {
      const result: QueryResult<AuditRow> = await database.query(query, [requestId]);
      return result.rows.map(mapRowToAudit);
    } catch (error) {
      logger.error('Failed to find audit logs by request ID', { error, requestId });
      throw error;
    }
  }

  /**
   * Get performance metrics from audit logs
   */
  public async getPerformanceMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    totalRequests: number;
    successRate: number;
  }> {
    const query = `
      SELECT
        COUNT(*) as total_requests,
        AVG(response_time_ms) as avg_response_time,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95_response_time,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_ms) as p99_response_time,
        COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as success_count
      FROM ${this.tableName}
      WHERE created_at >= $1 AND created_at <= $2
        AND response_time_ms IS NOT NULL
    `;

    try {
      const result = await database.query<{
        total_requests: string;
        avg_response_time: string | null;
        p95_response_time: string | null;
        p99_response_time: string | null;
        success_count: string;
      }>(query, [startDate, endDate]);

      const row = result.rows[0];
      const totalRequests = parseInt(row.total_requests, 10);
      const successCount = parseInt(row.success_count, 10);

      return {
        avgResponseTime: row.avg_response_time ? parseFloat(row.avg_response_time) : 0,
        p95ResponseTime: row.p95_response_time ? parseFloat(row.p95_response_time) : 0,
        p99ResponseTime: row.p99_response_time ? parseFloat(row.p99_response_time) : 0,
        totalRequests,
        successRate: totalRequests > 0 ? (successCount / totalRequests) * 100 : 0,
      };
    } catch (error) {
      logger.error('Failed to get performance metrics', { error, startDate, endDate });
      throw error;
    }
  }
}

export const cardAuditModel = new CardAuditModel();
