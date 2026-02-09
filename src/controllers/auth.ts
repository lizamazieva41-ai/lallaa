import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { authService } from '../services/auth';
import { twoFactorService } from '../services/twoFactor';
import { asyncHandler, sendSuccess, sendError, ValidationError, NotFoundError } from '../middleware/error';
import { userModel } from '../models/user';
import { logger } from '../utils/logger';

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required().lowercase(),
  password: Joi.string().min(8).max(128).required(),
  firstName: Joi.string().min(1).max(100).required(),
  lastName: Joi.string().min(1).max(100).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().lowercase(),
  password: Joi.string().required(),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).max(128).required(),
});

const twoFactorVerifySchema = Joi.object({
  token: Joi.string().length(6).pattern(/^\d+$/).required(),
});

const twoFactorDisableSchema = Joi.object({
  password: Joi.string().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(8).max(128).required(),
});

const regenerateBackupCodesSchema = Joi.object({
  password: Joi.string().required(),
});

// Register controller
export const register = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { email, password, firstName, lastName } = req.body;

    // Validate input
    const { error, value } = registerSchema.validate(
      { email, password, firstName, lastName },
      { abortEarly: false }
    );
    if (error) {
      throw new ValidationError('Invalid registration data', {
        details: error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
    }

    const result = await authService.register(
      value.email,
      value.password,
      value.firstName,
      value.lastName
    );

    // Set refresh token as HTTP-only cookie
    if (result.tokens.refreshToken) {
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    }

    sendSuccess(res, {
      user: result.user,
      tokens: {
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
      },
    }, req.requestId, req.rateLimit);
  }
);

// Login controller
export const login = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { email, password } = req.body;

    // Validate input
    const { error, value } = loginSchema.validate(
      { email, password },
      { abortEarly: false }
    );
    if (error) {
      throw new ValidationError('Invalid login data', {
        details: error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
    }

    const result = await authService.login(value.email, value.password);

    // Set refresh token as HTTP-only cookie
    if (result.tokens.refreshToken) {
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    }

    sendSuccess(res, {
      user: result.user,
      tokens: {
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
      },
    }, req.requestId, req.rateLimit);
  }
);

// Refresh token controller
export const refreshToken = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const refreshToken = req.body.refreshToken || req.cookies.refreshToken;

    if (!refreshToken) {
      throw new ValidationError('Refresh token is required');
    }

    const tokens = await authService.refreshToken(refreshToken);

    // Set new refresh token as HTTP-only cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    sendSuccess(res, {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    }, req.requestId, req.rateLimit);
  }
);

// Logout controller
export const logout = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.userId;

    if (userId) {
      await authService.logout(userId);
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    sendSuccess(res, { message: 'Logged out successfully' }, req.requestId);
  }
);

// Get current user controller
export const getCurrentUser = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.userId;

    if (!userId) {
      throw new NotFoundError('User not found');
    }

    const user = await userModel.getPublicProfile(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    sendSuccess(res, { user }, req.requestId, req.rateLimit);
  }
);

// Change password controller
export const changePassword = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      throw new NotFoundError('User not found');
    }

    // Validate input
    const { error, value } = changePasswordSchema.validate(
      { currentPassword, newPassword },
      { abortEarly: false }
    );
    if (error) {
      throw new ValidationError('Invalid password data', {
        details: error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
    }

    await authService.changePassword(userId, value.currentPassword, value.newPassword);

    sendSuccess(res, { message: 'Password changed successfully' }, req.requestId);
  }
);

// Request password reset controller
export const requestPasswordReset = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { email } = req.body;

    if (!email) {
      throw new ValidationError('Email is required');
    }

    await authService.requestPasswordReset(email);

    // Don't reveal if email exists
    sendSuccess(res, {
      message: 'If an account exists, a password reset link has been sent',
    }, req.requestId);
  }
);

// Reset password controller
export const resetPassword = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { token, newPassword } = req.body;

    // Validate input
    const { error, value } = resetPasswordSchema.validate(
      { token, newPassword },
      { abortEarly: false }
    );
    if (error) {
      throw new ValidationError('Invalid reset password data', {
        details: error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
    }

    await authService.resetPassword(value.token, value.newPassword);

    sendSuccess(res, {
      message: 'Password reset successfully',
    }, req.requestId);
  }
);

// 2FA: Setup 2FA controller
export const setupTwoFactor = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.userId;

    if (!userId) {
      throw new NotFoundError('User not found');
    }

    const result = await twoFactorService.setupTwoFactor(userId);

    sendSuccess(res, {
      secret: result.secret,
      qrCode: result.qrCode,
      backupCodes: result.backupCodes,
      message: 'Scan the QR code with your authenticator app and save the backup codes securely',
    }, req.requestId);
  }
);

// 2FA: Verify and enable 2FA controller
export const verifyTwoFactor = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.userId;
    const { token } = req.body;

    if (!userId) {
      throw new NotFoundError('User not found');
    }

    // Validate input
    const { error, value } = twoFactorVerifySchema.validate(
      { token },
      { abortEarly: false }
    );
    if (error) {
      throw new ValidationError('Invalid 2FA token', {
        details: error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
    }

    await twoFactorService.enableTwoFactor(userId, { token: value.token });

    sendSuccess(res, {
      message: '2FA enabled successfully',
    }, req.requestId);
  }
);

// 2FA: Disable 2FA controller
export const disableTwoFactor = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.userId;
    const { password } = req.body;

    if (!userId) {
      throw new NotFoundError('User not found');
    }

    // Validate input
    const { error, value } = twoFactorDisableSchema.validate(
      { password },
      { abortEarly: false }
    );
    if (error) {
      throw new ValidationError('Password is required', {
        details: error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
    }

    await twoFactorService.disableTwoFactor(userId, value.password);

    sendSuccess(res, {
      message: '2FA disabled successfully',
    }, req.requestId);
  }
);

// 2FA: Regenerate backup codes controller
export const regenerateBackupCodes = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.userId;
    const { password } = req.body;

    if (!userId) {
      throw new NotFoundError('User not found');
    }

    // Validate input
    const { error, value } = regenerateBackupCodesSchema.validate(
      { password },
      { abortEarly: false }
    );
    if (error) {
      throw new ValidationError('Password is required', {
        details: error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
    }

    const newCodes = await twoFactorService.regenerateBackupCodes(userId, value.password);

    sendSuccess(res, {
      backupCodes: newCodes,
      message: 'Backup codes regenerated. Store them securely.',
    }, req.requestId);
  }
);

// Create API key controller
export const createAPIKey = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.userId;
    const { name, permissions, rateLimit, ipWhitelist, expiresAt } = req.body;

    if (!userId) {
      throw new NotFoundError('User not found');
    }

    if (!name || typeof name !== 'string') {
      throw new ValidationError('API key name is required');
    }

    const result = await authService.createAPIKey(
      userId,
      name,
      permissions,
      rateLimit,
      ipWhitelist,
      expiresAt ? new Date(expiresAt) : undefined
    );

    // Only return the key once at creation time
    sendSuccess(res, {
      key: result.key,
      keyId: result.keyId,
      name: result.name,
      message: 'Store this key securely. It will not be shown again.',
    }, req.requestId);
  }
);

// Get API keys controller
export const getAPIKeys = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.userId;

    if (!userId) {
      throw new NotFoundError('User not found');
    }

    const result = await authService.getAPIKeys(userId);

    sendSuccess(res, result, req.requestId, req.rateLimit);
  }
);

// Revoke API key controller
export const revokeAPIKey = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.userId;
    const keyIdParam = req.params.keyId;
    const keyId = Array.isArray(keyIdParam) ? keyIdParam[0] : keyIdParam;

    if (!userId) {
      throw new NotFoundError('User not found');
    }

    if (!keyId) {
      throw new ValidationError('API key ID is required');
    }

    await authService.revokeAPIKey(keyId, userId);

    sendSuccess(res, { message: 'API key revoked successfully' }, req.requestId);
  }
);

// Rotate API key controller
export const rotateAPIKey = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.userId;
    const keyIdParam = req.params.keyId;
    const keyId = Array.isArray(keyIdParam) ? keyIdParam[0] : keyIdParam;

    if (!userId) {
      throw new NotFoundError('User not found');
    }

    if (!keyId) {
      throw new ValidationError('API key ID is required');
    }

    const result = await authService.rotateAPIKey(keyId, userId);

    sendSuccess(res, {
      key: result.key,
      keyId,
      message: 'Store this new key securely. It will not be shown again.',
    }, req.requestId);
  }
);

export default {
  register,
  login,
  refreshToken,
  logout,
  getCurrentUser,
  changePassword,
  requestPasswordReset,
  resetPassword,
  setupTwoFactor,
  verifyTwoFactor,
  disableTwoFactor,
  regenerateBackupCodes,
  createAPIKey,
  getAPIKeys,
  revokeAPIKey,
  rotateAPIKey,
};
