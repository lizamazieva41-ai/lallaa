import { PoolClient, QueryResult } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import database from '../database/connection';
import config from '../config';
import { User, UserRole, UserStatus, UserTier, UserPublic } from '../types';
import { logger } from '../utils/logger';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  status: UserStatus;
  tier: UserTier;
  quota_limit: number;
  quota_used: number;
  email_verified: boolean;
  two_factor_enabled: boolean;
  two_factor_secret: string | null;
  backup_codes: string[] | null;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
}

const mapRowToUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  passwordHash: row.password_hash,
  firstName: row.first_name,
  lastName: row.last_name,
  role: row.role,
  status: row.status,
  tier: row.tier,
  quotaLimit: row.quota_limit,
  quotaUsed: row.quota_used,
  emailVerified: row.email_verified,
  twoFactorEnabled: row.two_factor_enabled,
  twoFactorSecret: row.two_factor_secret || undefined,
  backupCodes: row.backup_codes ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastLoginAt: row.last_login_at || undefined,
});

const mapUserToPublic = (user: User): UserPublic => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  tier: user.tier,
  emailVerified: user.emailVerified,
  createdAt: user.createdAt,
});

export class UserModel {
  private tableName = 'users';

  public async create(
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ): Promise<User> {
    const passwordHash = await bcrypt.hash(
      password,
      config.security.bcryptRounds
    );

    const query = `
      INSERT INTO users (email, password_hash, first_name, last_name)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    try {
      const result: QueryResult<UserRow> = await database.query(query, [
        email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
      ]);

      if (result.rows.length === 0) {
        throw new Error('Failed to create user');
      }

      logger.info('User created successfully', { email });
      return mapRowToUser(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create user', { email, error });
      throw error;
    }
  }

  public async findById(id: string): Promise<User | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;

    try {
      const result: QueryResult<UserRow> = await database.query(query, [id]);
      if (result.rows.length === 0) {
        return null;
      }
      return mapRowToUser(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find user by ID', { id, error });
      throw error;
    }
  }

  public async findByEmail(email: string): Promise<User | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE email = $1`;

    try {
      const result: QueryResult<UserRow> = await database.query(query, [
        email.toLowerCase(),
      ]);
      if (result.rows.length === 0) {
        return null;
      }
      return mapRowToUser(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find user by email', { email, error });
      throw error;
    }
  }

  public async update(
    id: string,
    data: Partial<Omit<User, 'id' | 'createdAt'>>
  ): Promise<User | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const fieldMapping: Record<string, string> = {
      firstName: 'first_name',
      lastName: 'last_name',
      passwordHash: 'password_hash',
      role: 'role',
      status: 'status',
      tier: 'tier',
      quotaLimit: 'quota_limit',
      quotaUsed: 'quota_used',
      emailVerified: 'email_verified',
      twoFactorEnabled: 'two_factor_enabled',
      twoFactorSecret: 'two_factor_secret',
      backupCodes: 'backup_codes',
    };

    for (const [key, value] of Object.entries(data)) {
      const dbField = fieldMapping[key] || key;
      const dbValue =
        key === 'backupCodes' && value !== undefined
          ? JSON.stringify(value)
          : value;
      updates.push(`${dbField} = $${paramIndex}`);
      values.push(dbValue);
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
      const result: QueryResult<UserRow> = await database.query(query, values);
      if (result.rows.length === 0) {
        return null;
      }
      return mapRowToUser(result.rows[0]);
    } catch (error) {
      logger.error('Failed to update user', { id, error });
      throw error;
    }
  }

  public async updateLastLogin(id: string): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    try {
      await database.query(query, [id]);
    } catch (error) {
      logger.error('Failed to update last login', { id, error });
      throw error;
    }
  }

  public async updateLastActivity(id: string): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    try {
      await database.query(query, [id]);
    } catch (error) {
      logger.error('Failed to update last activity', { id, error });
      throw error;
    }
  }

  public async incrementQuota(userId: string, amount: number = 1): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET quota_used = quota_used + $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;

    try {
      await database.query(query, [amount, userId]);
    } catch (error) {
      logger.error('Failed to increment quota', { userId, amount, error });
      throw error;
    }
  }

  public async validatePassword(
    user: User,
    password: string
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(password, user.passwordHash);
    } catch (error) {
      logger.error('Password validation failed', { userId: user.id, error });
      return false;
    }
  }

  public async updatePassword(
    userId: string,
    newPasswordHash: string
  ): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;

    try {
      await database.query(query, [newPasswordHash, userId]);
      logger.info('Password updated successfully', { userId });
    } catch (error) {
      logger.error('Failed to update password', { userId, error });
      throw error;
    }
  }

  public async getPublicProfile(userId: string): Promise<UserPublic | null> {
    const query = `
      SELECT id, email, first_name, last_name, role, tier, email_verified, created_at
      FROM ${this.tableName}
      WHERE id = $1
    `;

    try {
      const result = await database.query(query, [userId]);
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        role: row.role,
        tier: row.tier,
        emailVerified: row.email_verified,
        createdAt: row.created_at,
      };
    } catch (error) {
      logger.error('Failed to get public profile', { userId, error });
      throw error;
    }
  }

  public async checkQuota(userId: string): Promise<{
    used: number;
    limit: number;
    remaining: number;
    isExceeded: boolean;
  }> {
    const query = `
      SELECT quota_used, quota_limit
      FROM ${this.tableName}
      WHERE id = $1
    `;

    try {
      const result = await database.query(query, [userId]);
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const { quota_used, quota_limit } = result.rows[0];
      return {
        used: quota_used,
        limit: quota_limit,
        remaining: Math.max(0, quota_limit - quota_used),
        isExceeded: quota_used >= quota_limit,
      };
    } catch (error) {
      logger.error('Failed to check quota', { userId, error });
      throw error;
    }
  }

  // 2FA related methods
  public async updateTwoFactorSecret(userId: string, secret: string, backupCodes: string[]): Promise<void> {
    // For now, store as JSON array. In production, use a separate table
    const backupCodesJson = JSON.stringify(backupCodes);
    const query = `
      UPDATE ${this.tableName}
      SET two_factor_secret = $1, backup_codes = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `;

    try {
      await database.query(query, [secret, backupCodesJson, userId]);
      logger.info('2FA secret updated', { userId });
    } catch (error) {
      logger.error('Failed to update 2FA secret', { userId, error });
      throw error;
    }
  }

  public async enableTwoFactor(userId: string): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET two_factor_enabled = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    try {
      await database.query(query, [userId]);
      logger.info('2FA enabled', { userId });
    } catch (error) {
      logger.error('Failed to enable 2FA', { userId, error });
      throw error;
    }
  }

  public async disableTwoFactor(userId: string): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET two_factor_enabled = false, two_factor_secret = NULL, backup_codes = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    try {
      await database.query(query, [userId]);
      logger.info('2FA disabled', { userId });
    } catch (error) {
      logger.error('Failed to disable 2FA', { userId, error });
      throw error;
    }
  }

  public async getBackupCodes(userId: string): Promise<string[] | null> {
    const query = `
      SELECT backup_codes
      FROM ${this.tableName}
      WHERE id = $1 AND backup_codes IS NOT NULL
    `;

    try {
      const result = await database.query(query, [userId]);
      if (result.rows.length === 0) {
        return null;
      }
      return result.rows[0].backup_codes;
    } catch (error) {
      logger.error('Failed to get backup codes', { userId, error });
      throw error;
    }
  }

  public async updateBackupCodes(userId: string, backupCodes: string[]): Promise<void> {
    const backupCodesJson = JSON.stringify(backupCodes);
    const query = `
      UPDATE ${this.tableName}
      SET backup_codes = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;

    try {
      await database.query(query, [backupCodesJson, userId]);
      logger.info('Backup codes updated', { userId });
    } catch (error) {
      logger.error('Failed to update backup codes', { userId, error });
      throw error;
    }
  }

  public async removeBackupCode(userId: string, codeToRemove: string): Promise<void> {
    const currentCodes = await this.getBackupCodes(userId);
    if (!currentCodes) return;

    const hashedToRemove = require('crypto')
      .createHash('sha256')
      .update(codeToRemove.toUpperCase())
      .digest('hex');

    const filteredCodes = currentCodes.filter((code: string) => code !== hashedToRemove);
    
    await this.updateBackupCodes(userId, filteredCodes);
  }
}

export const userModel = new UserModel();
