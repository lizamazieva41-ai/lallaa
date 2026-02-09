import crypto from 'crypto';
import * as speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { userModel } from '../models/user';
import { logger } from '../utils/logger';
import { TwoFactorSetupResult, TwoFactorVerifyRequest } from '../types';

export class TwoFactorService {
  // Generate secret key for TOTP
  public generateSecret(): string {
    return speakeasy.generateSecret({ length: 32 }).base32!;
  }

  // Generate QR code for TOTP setup
  public async generateQRCode(email: string, secret: string): Promise<string> {
    const issuer = 'Payment Sandbox API';
    const serviceName = `${issuer} (${email})`;
    const otpauthUrl = speakeasy.otpauthURL({
      secret: secret,
      label: email,
      issuer: issuer,
      encoding: 'base32'
    });
    
    try {
      return await QRCode.toDataURL(otpauthUrl);
    } catch (error) {
      logger.error('Failed to generate QR code', { email, error });
      throw new Error('Failed to generate QR code');
    }
  }

  // Generate backup codes
  public generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  // Setup 2FA for user
  public async setupTwoFactor(userId: string): Promise<TwoFactorSetupResult> {
    const user = await userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const secret = this.generateSecret();
    const backupCodes = this.generateBackupCodes();
    
    // Store secret in database as base32 (not hashed - TOTP needs original)
    // Store backup codes as encrypted at rest
    const hashedBackupCodes = backupCodes.map(code => 
      crypto.createHash('sha256').update(code).digest('hex')
    );

    await userModel.updateTwoFactorSecret(userId, secret, hashedBackupCodes);

    // Generate QR code
    const qrCode = await this.generateQRCode(user.email, secret);

    logger.info('2FA setup initiated', { userId, email: user.email });

    return {
      secret,
      qrCode,
      backupCodes,
    };
  }

  // Verify TOTP token
  public verifyToken(secret: string, token: string): boolean {
    try {
      // Secret is now stored as base32, not hashed
      return speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 2, // Allow 2 steps before/after current time
        time: Math.floor(Date.now() / 1000)
      });
    } catch (error) {
      logger.error('Token verification failed', { error });
      return false;
    }
  }

  // Verify backup code
  public verifyBackupCode(hashedCodes: string[], providedCode: string): boolean {
    const hashedProvided = crypto
      .createHash('sha256')
      .update(providedCode.toUpperCase())
      .digest('hex');
    
    return hashedCodes.includes(hashedProvided);
  }

  // Enable 2FA after successful verification
  public async enableTwoFactor(userId: string, request: TwoFactorVerifyRequest): Promise<void> {
    const user = await userModel.findById(userId);
    if (!user || !user.twoFactorSecret) {
      throw new Error('2FA setup not initiated');
    }

    const isValid = this.verifyToken(user.twoFactorSecret, request.token);
    if (!isValid) {
      throw new Error('Invalid verification token');
    }

    await userModel.enableTwoFactor(userId);
    logger.info('2FA enabled', { userId });
  }

  // Disable 2FA
  public async disableTwoFactor(userId: string, password: string): Promise<void> {
    const user = await userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify password before disabling 2FA
    const isValidPassword = await userModel.validatePassword(user, password);
    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    await userModel.disableTwoFactor(userId);
    logger.info('2FA disabled', { userId });
  }

  // Verify 2FA during login
  public async verifyTwoFactor(userId: string, token: string): Promise<boolean> {
    const user = await userModel.findById(userId);
    if (!user || !user.twoFactorEnabled) {
      throw new Error('2FA not enabled for user');
    }

    // Try TOTP verification first
    if (this.verifyToken(user.twoFactorSecret!, token)) {
      return true;
    }

    // Try backup codes (assuming we store them as part of user model or separate table)
    // This is simplified - in production, backup codes should be stored separately
    const backupCodes = await userModel.getBackupCodes(userId);
    if (backupCodes && this.verifyBackupCode(backupCodes, token)) {
      // Remove used backup code
      await userModel.removeBackupCode(userId, token);
      logger.info('Backup code used', { userId });
      return true;
    }

    return false;
  }

  // Generate new backup codes
  public async regenerateBackupCodes(userId: string, password: string): Promise<string[]> {
    const user = await userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify password before regenerating backup codes
    const isValidPassword = await userModel.validatePassword(user, password);
    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    const newCodes = this.generateBackupCodes();
    const hashedCodes = newCodes.map(code => 
      crypto.createHash('sha256').update(code).digest('hex')
    );

    await userModel.updateBackupCodes(userId, hashedCodes);
    logger.info('Backup codes regenerated', { userId });

    return newCodes;
  }
}

export const twoFactorService = new TwoFactorService();