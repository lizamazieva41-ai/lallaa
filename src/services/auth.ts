import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { userModel } from '../models/user';
import { apiKeyModel } from '../models/apiKey';
import { passwordResetModel } from '../models/passwordReset';
import { config } from '../config';
import { User, UserTier, AuthTokens, TokenPayload, PasswordResetRequest, PasswordResetConfirmRequest, AppError } from '../types';
import { logger } from '../utils/logger';

export interface RegisterResult {
  user: Omit<User, 'passwordHash' | 'twoFactorSecret'>;
  tokens: AuthTokens;
}

export interface LoginResult {
  user: Omit<User, 'passwordHash' | 'twoFactorSecret'>;
  tokens: AuthTokens;
  requiresTwoFactor?: boolean;
}

export class AuthService {
  // Generate access token
  private generateAccessToken(user: User): string {
    const payload: Omit<TokenPayload, 'type'> = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tier: user.tier,
    };

    return jwt.sign({ ...payload, type: 'access' }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);
  }

  // Generate refresh token
  private generateRefreshToken(user: User): string {
    const payload: Omit<TokenPayload, 'type'> = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tier: user.tier,
    };

    return jwt.sign({ ...payload, type: 'refresh' }, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    } as jwt.SignOptions);
  }

  // Generate tokens
  private generateTokens(user: User): AuthTokens {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Parse expiresIn to seconds
    const expiresIn = this.parseExpiresIn(config.jwt.expiresIn);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // Default 15 minutes

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 60 * 60 * 24;
      default:
        return 900;
    }
  }

  // Register new user
  public async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ): Promise<RegisterResult> {
    // Check if user exists
    const existingUser = await userModel.findByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Validate password strength
    this.validatePasswordStrength(password);

    // Create user
    const user = await userModel.create(email, password, firstName, lastName);

    // Generate tokens
    const tokens = this.generateTokens(user);

    logger.info('User registered', { userId: user.id, email });

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  // Login user
  public async login(
    email: string,
    password: string
  ): Promise<LoginResult> {
    const user = await userModel.findByEmail(email);

    if (!user) {
      throw new AppError('Invalid credentials', 401, 'AUTH_ERROR', true);
    }

    if (user.status !== 'active') {
      throw new AppError('Account is not active', 403, 'FORBIDDEN', true);
    }

    // Verify password
    const isValid = await userModel.validatePassword(user, password);
    if (!isValid) {
      throw new AppError('Invalid credentials', 401, 'AUTH_ERROR', true);
    }

    // Check if 2FA is enabled (simplified - would need actual 2FA implementation)
    if (user.twoFactorEnabled) {
      return {
        user: this.sanitizeUser(user),
        tokens: {} as AuthTokens,
        requiresTwoFactor: true,
      };
    }

    // Update last login
    await userModel.updateLastLogin(user.id);

    // Generate tokens
    const tokens = this.generateTokens(user);

    logger.info('User logged in', { userId: user.id });

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  // Refresh access token
  public async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(
        refreshToken,
        config.jwt.refreshSecret
      ) as TokenPayload;

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if refresh token is blacklisted
      const { getRedisClient } = await import('./redisConnection');
      const redisClient = getRedisClient();
      
      if (redisClient) {
        const blacklistKey = `blacklist:refresh_token:${decoded.userId}`;
        const isBlacklisted = await redisClient.get(blacklistKey);
        
        if (isBlacklisted) {
          throw new Error('Refresh token has been revoked');
        }
      }

      const user = await userModel.findById(decoded.userId);
      if (!user || user.status !== 'active') {
        throw new Error('User not found or inactive');
      }

      return this.generateTokens(user);
    } catch (error) {
      logger.error('Token refresh failed', { error });
      throw new Error('Invalid or expired refresh token');
    }
  }

  // Logout (invalidate refresh token on client side)
  public async logout(userId: string): Promise<void> {
    try {
      // Get current refresh token from database/storage
      const user = await userModel.findById(userId);
      if (!user) {
        logger.warn('Logout attempted for non-existent user', { userId });
        return;
      }

      // If we have a Redis client, blacklist the refresh token
      const { getRedisClient } = await import('./redisConnection');
      const redisClient = getRedisClient();
      
      if (redisClient) {
        // Find and blacklist active refresh tokens for this user
        // For now, we'll create a user-specific blacklist key
        const blacklistKey = `blacklist:refresh_token:${userId}`;
        const blacklistTTL = 7 * 24 * 60 * 60; // 7 days (same as refresh token expiry)
        
        await redisClient.set(blacklistKey, '1', 'EX', blacklistTTL);
        
        logger.info('Refresh tokens blacklisted for user', { userId });
      } else {
        logger.warn('Redis not available - cannot blacklist refresh tokens', { userId });
      }

      // Optional: Mark user as logged out in database
      await userModel.updateLastActivity(userId);
      
      logger.info('User logged out successfully', { userId });
    } catch (error) {
      logger.error('Error during logout', { error, userId });
      throw error;
    }
  }

  // Change password
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValid = await userModel.validatePassword(user, currentPassword);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password strength
    this.validatePasswordStrength(newPassword);

    // Hash new password
    const newPasswordHash = await bcrypt.hash(
      newPassword,
      config.security.bcryptRounds
    );

    // Update password
    await userModel.updatePassword(userId, newPasswordHash);

    logger.info('Password changed', { userId });
  }

  // Request password reset
  public async requestPasswordReset(email: string): Promise<void> {
    const user = await userModel.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists - always return success
      logger.info('Password reset requested for non-existent email', { email });
      return;
    }

    // Check if user has recent reset request (prevent spam)
    const hasRecentRequest = await passwordResetModel.hasRecentRequest(user.id, 5);
    if (hasRecentRequest) {
      logger.info('Password reset requested too frequently', { email, userId: user.id });
      // Don't reveal that we're rate limiting
      return;
    }

    try {
      const { token, reset } = await passwordResetModel.create(user.id);
      
      // Send email with reset token (in production, integrate with email service)
      await this.sendPasswordResetEmail(user.email, token);
      
      logger.info('Password reset token generated and email sent', { 
        email, 
        userId: user.id, 
        tokenId: reset.id,
        expiresAt: reset.expiresAt 
      });
    } catch (error) {
      logger.error('Failed to create password reset token', { email, userId: user.id, error });
      // Don't reveal internal errors to user
    }
  }

  // Reset password with token
  public async resetPassword(
    token: string,
    newPassword: string
  ): Promise<void> {
    // Validate password strength
    this.validatePasswordStrength(newPassword);

    // Find valid reset token
    const reset = await passwordResetModel.findByToken(token);
    if (!reset) {
      throw new Error('Invalid or expired reset token');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(
      newPassword,
      config.security.bcryptRounds
    );

    // Update user password
    await userModel.updatePassword(reset.userId, newPasswordHash);

    // Mark token as used
    await passwordResetModel.markAsUsed(reset.id);

    logger.info('Password reset completed', { 
      userId: reset.userId, 
      tokenId: reset.id 
    });
  }

  // Send password reset email (placeholder - integrate with email service)
  private async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    // In production, integrate with email service like SendGrid, AWS SES, etc.
    const resetUrl = `${config.app.frontendUrl || 'http://localhost:3000'}/reset-password?token=${token}`;
    
    logger.info('Password reset email would be sent', { 
      email, 
      resetUrl,
      token: config.app.env === 'development' ? token : '[REDACTED]'
    });

    // Email content template:
    /*
    Subject: Reset your Payment Sandbox API password
    
    Hi there,
    
    You requested to reset your password for your Payment Sandbox API account.
    
    Click the link below to reset your password:
    ${resetUrl}
    
    This link will expire in 1 hour.
    
    If you didn't request this password reset, you can safely ignore this email.
    
    Thanks,
    Payment Sandbox API Team
    */
  }

  // Validate password strength
  private validatePasswordStrength(password: string): void {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    if (errors.length > 0) {
      throw new Error(errors.join('. '));
    }
  }

  // Sanitize user object (remove sensitive data)
  private sanitizeUser(
    user: User
  ): Omit<User, 'passwordHash' | 'twoFactorSecret'> {
    const { passwordHash, twoFactorSecret, ...sanitized } = user;
    return sanitized;
  }

  // Verify JWT token
  public verifyToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;
      return decoded;
    } catch {
      return null;
    }
  }

  // Create API key
  public async createAPIKey(
    userId: string,
    name: string,
    permissions?: Record<string, unknown>,
    rateLimit?: number,
    ipWhitelist?: string[],
    expiresAt?: Date
  ): Promise<{ key: string; keyId: string; name: string }> {
    const { key, rawKey } = await apiKeyModel.create(
      userId,
      name,
      permissions,
      rateLimit,
      ipWhitelist,
      expiresAt
    );

    logger.info('API key created', { userId, keyId: key.keyId });

    return {
      key: rawKey,
      keyId: key.keyId,
      name: key.name,
    };
  }

  // Get user API keys
  public async getAPIKeys(userId: string): Promise<{
    keys: Array<{
      id: string;
      keyId: string;
      name: string;
      rateLimit: number;
      lastUsedAt?: Date;
      expiresAt?: Date;
      isActive: boolean;
      createdAt: Date;
    }>;
  }> {
    const keys = await apiKeyModel.getPublicByUserId(userId);
    return { keys };
  }

  // Revoke API key
  public async revokeAPIKey(keyId: string, userId: string): Promise<void> {
    const keys = await apiKeyModel.findByUserId(userId);
    const key = keys.find((k) => k.keyId === keyId);

    if (!key) {
      throw new Error('API key not found');
    }

    await apiKeyModel.delete(key.id);
    logger.info('API key revoked', { userId, keyId });
  }

  // Rotate API key
  public async rotateAPIKey(keyId: string, userId: string): Promise<{ key: string }> {
    const keys = await apiKeyModel.findByUserId(userId);
    const key = keys.find((k) => k.keyId === keyId);

    if (!key) {
      throw new Error('API key not found');
    }

    const result = await apiKeyModel.rotateKey(key.id);
    if (!result) {
      throw new Error('Failed to rotate API key');
    }

    logger.info('API key rotated', { userId, keyId });

    return { key: result.rawKey };
  }
}

export const authService = new AuthService();
