import crypto from 'crypto';
import { QueryResult } from 'pg';
import database from '../database/connection';
import config from '../config';
import { APIKey, APIKeyPublic } from '../types';
import { logger } from '../utils/logger';

interface APIKeyRow {
  id: string;
  key_id: string;
  user_id: string;
  key_hash: string;
  key_prefix: string;
  name: string;
  permissions: Record<string, unknown>;
  rate_limit: number;
  ip_whitelist: string[];
  last_used_at: Date | null;
  expires_at: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const mapRowToAPIKey = (row: APIKeyRow): APIKey => ({
  id: row.id,
  keyId: row.key_id,
  userId: row.user_id,
  keyHash: row.key_hash,
  keyPrefix: row.key_prefix,
  name: row.name,
  permissions: row.permissions,
  rateLimit: row.rate_limit,
  ipWhitelist: row.ip_whitelist,
  lastUsedAt: row.last_used_at || undefined,
  expiresAt: row.expires_at || undefined,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapToPublic = (key: APIKey): APIKeyPublic => ({
  id: key.id,
  keyId: key.keyId,
  name: key.name,
  rateLimit: key.rateLimit,
  lastUsedAt: key.lastUsedAt,
  expiresAt: key.expiresAt,
  isActive: key.isActive,
  createdAt: key.createdAt,
});

export class APIKeyModel {
  private tableName = 'api_keys';

  public async create(
    userId: string,
    name: string,
    permissions: Record<string, unknown> = {},
    rateLimit?: number,
    ipWhitelist: string[] = [],
    expiresAt?: Date
  ): Promise<{ key: APIKey; rawKey: string }> {
    const keyId = crypto.randomUUID();
    const rawKey = `${config.security.apiKeyPrefix}_${crypto.randomBytes(config.security.apiKeyBytes).toString('base64url')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 15);

    const query = `
      INSERT INTO api_keys (
        key_id, user_id, key_hash, key_prefix, name, permissions,
        rate_limit, ip_whitelist, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const userRateLimits = {
      free: config.rateLimit.limits.free,
      basic: config.rateLimit.limits.basic,
      premium: config.rateLimit.limits.premium,
      enterprise: config.rateLimit.limits.enterprise,
    };

    try {
      const result: QueryResult<APIKeyRow> = await database.query(query, [
        keyId,
        userId,
        keyHash,
        keyPrefix,
        name,
        JSON.stringify(permissions),
        rateLimit || userRateLimits.free,
        JSON.stringify(ipWhitelist),
        expiresAt || null,
      ]);

      logger.info('API key created', { userId, keyId, keyPrefix: keyPrefix + '****' });
      return { key: mapRowToAPIKey(result.rows[0]), rawKey };
    } catch (error) {
      logger.error('Failed to create API key', { userId, error });
      throw error;
    }
  }

  public async findById(id: string): Promise<APIKey | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;

    try {
      const result: QueryResult<APIKeyRow> = await database.query(query, [id]);
      if (result.rows.length === 0) {
        return null;
      }
      return mapRowToAPIKey(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find API key by ID', { id, error });
      throw error;
    }
  }

  public async findByKeyId(keyId: string): Promise<APIKey | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE key_id = $1`;

    try {
      const result: QueryResult<APIKeyRow> = await database.query(query, [keyId]);
      if (result.rows.length === 0) {
        return null;
      }
      return mapRowToAPIKey(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find API key by key ID', { keyId, error });
      throw error;
    }
  }

  public async findByUserId(userId: string): Promise<APIKey[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;

    try {
      const result: QueryResult<APIKeyRow> = await database.query(query, [userId]);
      return result.rows.map(mapRowToAPIKey);
    } catch (error) {
      logger.error('Failed to find API keys by user ID', { userId, error });
      throw error;
    }
  }

  public async getPublicByUserId(userId: string): Promise<APIKeyPublic[]> {
    const query = `
      SELECT id, key_id, name, rate_limit, last_used_at, expires_at, is_active, created_at
      FROM ${this.tableName}
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;

    try {
      const result = await database.query(query, [userId]);
      return result.rows.map((row) => ({
        id: row.id,
        keyId: row.key_id,
        name: row.name,
        rateLimit: row.rate_limit,
        lastUsedAt: row.last_used_at,
        expiresAt: row.expires_at,
        isActive: row.is_active,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('Failed to get public API keys', { userId, error });
      throw error;
    }
  }

  public async validate(keyHash: string): Promise<APIKey | null> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE key_hash = $1 AND is_active = true
    `;

    try {
      const result: QueryResult<APIKeyRow> = await database.query(query, [keyHash]);
      if (result.rows.length === 0) {
        return null;
      }

      const key = result.rows[0];

      // Check expiration
      if (key.expires_at && new Date(key.expires_at) < new Date()) {
        return null;
      }

      return mapRowToAPIKey(key);
    } catch (error) {
      logger.error('Failed to validate API key', { error });
      throw error;
    }
  }

  public async update(
    id: string,
    data: Partial<Omit<APIKey, 'id' | 'keyId' | 'userId' | 'keyHash' | 'keyPrefix' | 'createdAt'>>
  ): Promise<APIKey | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const fieldMapping: Record<string, string> = {
      name: 'name',
      permissions: 'permissions',
      rateLimit: 'rate_limit',
      ipWhitelist: 'ip_whitelist',
      lastUsedAt: 'last_used_at',
      expiresAt: 'expires_at',
      isActive: 'is_active',
    };

    for (const [key, value] of Object.entries(data)) {
      const dbField = fieldMapping[key] || key;
      updates.push(`${dbField} = $${paramIndex}`);

      if (key === 'permissions' || key === 'ipWhitelist') {
        values.push(JSON.stringify(value));
      } else if (key === 'lastUsedAt' || key === 'expiresAt') {
        values.push(value || null);
      } else {
        values.push(value);
      }
      paramIndex++;
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE ${this.tableName}
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result: QueryResult<APIKeyRow> = await database.query(query, values);
      if (result.rows.length === 0) {
        return null;
      }
      return mapRowToAPIKey(result.rows[0]);
    } catch (error) {
      logger.error('Failed to update API key', { id, error });
      throw error;
    }
  }

  public async updateLastUsed(id: string): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET last_used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    try {
      await database.query(query, [id]);
    } catch (error) {
      logger.error('Failed to update API key last used', { id, error });
      throw error;
    }
  }

  public async delete(id: string): Promise<boolean> {
    const query = `
      UPDATE ${this.tableName}
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    try {
      const result = await database.query(query, [id]);
      if ((result.rowCount ?? 0) > 0) {
        logger.info('API key deactivated', { id });
      }
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error('Failed to delete API key', { id, error });
      throw error;
    }
  }

  public async permanentDelete(id: string): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1`;

    try {
      const result = await database.query(query, [id]);
      if ((result.rowCount ?? 0) > 0) {
        logger.info('API key permanently deleted', { id });
      }
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error('Failed to permanently delete API key', { id, error });
      throw error;
    }
  }

  public async rotateKey(id: string): Promise<{ key: APIKey; rawKey: string } | null> {
    const existingKey = await this.findById(id);
    if (!existingKey) {
      return null;
    }

    const rawKey = `${config.security.apiKeyPrefix}_${crypto.randomBytes(config.security.apiKeyBytes).toString('base64url')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 15);

    const query = `
      UPDATE ${this.tableName}
      SET key_hash = $1, key_prefix = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;

    try {
      const result: QueryResult<APIKeyRow> = await database.query(query, [
        keyHash,
        keyPrefix,
        id,
      ]);

      if (result.rows.length === 0) {
        return null;
      }

      logger.info('API key rotated', { keyId: existingKey.keyId });
      return { key: mapRowToAPIKey(result.rows[0]), rawKey };
    } catch (error) {
      logger.error('Failed to rotate API key', { id, error });
      throw error;
    }
  }
}

export const apiKeyModel = new APIKeyModel();
