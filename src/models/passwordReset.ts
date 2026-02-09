import { PoolClient, QueryResult } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import database from '../database/connection';
import { logger } from '../utils/logger';
import { PasswordReset } from '../types';

interface PasswordResetRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

const mapRowToPasswordReset = (row: PasswordResetRow, token?: string): PasswordReset => ({
  id: row.id,
  userId: row.user_id,
  token: token || '', // Never return stored token
  tokenHash: row.token_hash,
  expiresAt: row.expires_at,
  isUsed: row.used_at !== null,
  createdAt: row.created_at,
});

export class PasswordResetModel {
  private tableName = 'password_resets';
  private readonly TOKEN_EXPIRY_HOURS = 1; // 1 hour expiry

  // Create password reset token
  public async create(userId: string): Promise<{ token: string; reset: PasswordReset }> {
    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    // Calculate expiry time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.TOKEN_EXPIRY_HOURS);

    // Invalidate any existing tokens for this user
    await this.invalidateAllUserTokens(userId);

    const query = `
      INSERT INTO ${this.tableName} (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    try {
      const result: QueryResult<PasswordResetRow> = await database.query(query, [
        userId,
        tokenHash, // Only store hash, never plaintext
        expiresAt,
      ]);

      if (result.rows.length === 0) {
        throw new Error('Failed to create password reset token');
      }

      const reset = mapRowToPasswordReset(result.rows[0]);
      logger.info('Password reset token created', { userId, tokenId: reset.id });

      return { token, reset };
    } catch (error) {
      logger.error('Failed to create password reset token', { userId, error });
      throw error;
    }
  }

  // Find valid password reset by token hash
  public async findByToken(token: string): Promise<PasswordReset | null> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 1
    `;

    try {
      const result: QueryResult<PasswordResetRow> = await database.query(query, [tokenHash]);
      if (result.rows.length === 0) {
        return null;
      }
      return mapRowToPasswordReset(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find password reset by token', { error });
      throw error;
    }
  }

  // Mark token as used
  public async markAsUsed(tokenId: string): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET used_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    try {
      await database.query(query, [tokenId]);
      logger.info('Password reset token marked as used', { tokenId });
    } catch (error) {
      logger.error('Failed to mark password reset as used', { tokenId, error });
      throw error;
    }
  }

  // Invalidate all tokens for a user
  public async invalidateAllUserTokens(userId: string): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET used_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND used_at IS NULL
    `;

    try {
      await database.query(query, [userId]);
    } catch (error) {
      logger.error('Failed to invalidate user tokens', { userId, error });
      throw error;
    }
  }

  // Clean up expired tokens (called by scheduled job)
  public async cleanupExpired(): Promise<number> {
    const query = `
      DELETE FROM ${this.tableName}
      WHERE (used_at IS NOT NULL AND used_at < CURRENT_TIMESTAMP - INTERVAL '7 days')
         OR (expires_at < CURRENT_TIMESTAMP)
    `;

    try {
      const result = await database.query(query);
      const deletedCount = result.rowCount || 0;
      
      if (deletedCount > 0) {
        logger.info('Cleaned up expired password reset tokens', { count: deletedCount });
      }
      
      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired password reset tokens', { error });
      throw error;
    }
  }

  // Get active tokens count for a user
  public async getActiveTokenCount(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM ${this.tableName}
      WHERE user_id = $1 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
    `;

    try {
      const result = await database.query(query, [userId]);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Failed to get active token count', { userId, error });
      throw error;
    }
  }

  // Check if user has recent reset request (to prevent spam)
  public async hasRecentRequest(userId: string, minutes: number = 5): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count
      FROM ${this.tableName}
      WHERE user_id = $1 
        AND created_at > CURRENT_TIMESTAMP - INTERVAL '${minutes} minutes'
        AND used_at IS NULL
    `;

    try {
      const result = await database.query(query, [userId]);
      return parseInt(result.rows[0].count, 10) > 0;
    } catch (error) {
      logger.error('Failed to check recent reset requests', { userId, error });
      throw error;
    }
  }
}

export const passwordResetModel = new PasswordResetModel();