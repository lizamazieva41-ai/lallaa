/**
 * TwoFactor Service Unit Tests
 */

import { TwoFactorService } from '../../src/services/twoFactor';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { userModel } from '../../src/models/user';

// Mock dependencies
jest.mock('speakeasy', () => ({
  generateSecret: jest.fn(),
  otpauthURL: jest.fn(),
  totp: {
    verify: jest.fn(),
  },
}));
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));
jest.mock('crypto', () => ({
  randomBytes: jest.fn(),
  createHash: jest.fn(),
}));
jest.mock('../../src/models/user', () => ({
  userModel: {
    findById: jest.fn(),
    updateTwoFactorSecret: jest.fn(),
    validatePassword: jest.fn(),
    enableTwoFactor: jest.fn(),
    disableTwoFactor: jest.fn(),
    getBackupCodes: jest.fn(),
    removeBackupCode: jest.fn(),
    updateBackupCodes: jest.fn(),
  },
}));

const mockSpeakeasy = speakeasy as unknown as {
  generateSecret: jest.Mock;
  otpauthURL: jest.Mock;
  totp: { verify: jest.Mock };
};
const mockQRCode = QRCode as unknown as { toDataURL: jest.Mock };
const mockCrypto = crypto as unknown as {
  randomBytes: jest.Mock;
  createHash: jest.Mock;
};
const mockUserModel = userModel as unknown as {
  findById: jest.Mock;
  updateTwoFactorSecret: jest.Mock;
  validatePassword: jest.Mock;
  enableTwoFactor: jest.Mock;
  disableTwoFactor: jest.Mock;
  getBackupCodes: jest.Mock;
  removeBackupCode: jest.Mock;
  updateBackupCodes: jest.Mock;
};

describe('TwoFactor Service', () => {
  let twoFactorService: TwoFactorService;

  beforeEach(() => {
    jest.clearAllMocks();
    twoFactorService = new TwoFactorService();
    
    // Setup default mocks
    mockSpeakeasy.generateSecret.mockReturnValue({
      base32: 'JBSWY3DPEHPK3PXP',
      ascii: 'test-secret'
    } as any);
    
    mockSpeakeasy.totp.verify.mockReturnValue(true);
    mockSpeakeasy.otpauthURL.mockReturnValue('otpauth://totp/test');
    
    mockQRCode.toDataURL.mockResolvedValue('data:image/png;base64,mock-qr-code');
    
    mockCrypto.randomBytes.mockReturnValue({
      toString: jest.fn().mockReturnValue('test-code')
    } as any);
    
    mockCrypto.createHash.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('hashed-value')
    } as any);
    
    mockUserModel.findById.mockResolvedValue({
      id: 'user123',
      email: 'test@example.com'
    } as any);
    
    mockUserModel.updateTwoFactorSecret.mockResolvedValue(undefined);
  });

  describe('generateSecret', () => {
    it('should generate a base32 secret', () => {
      const secret = twoFactorService.generateSecret();

      expect(mockSpeakeasy.generateSecret).toHaveBeenCalledWith({ length: 32 });
      expect(secret).toBe('JBSWY3DPEHPK3PXP');
    });
  });

  describe('generateQRCode', () => {
    it('should generate QR code for TOTP setup', async () => {
      const email = 'test@example.com';
      const secret = 'JBSWY3DPEHPK3PXP';

      const qrCode = await twoFactorService.generateQRCode(email, secret);

      expect(mockSpeakeasy.otpauthURL).toHaveBeenCalledWith({
        secret: secret,
        label: email,
        issuer: 'Payment Sandbox API',
        encoding: 'base32'
      });
      expect(mockQRCode.toDataURL).toHaveBeenCalledWith('otpauth://totp/test');
      expect(qrCode).toBe('data:image/png;base64,mock-qr-code');
    });

    it('should handle QR code generation errors', async () => {
      mockQRCode.toDataURL.mockRejectedValue(new Error('QR generation failed'));

      await expect(twoFactorService.generateQRCode('test@example.com', 'secret'))
        .rejects.toThrow('Failed to generate QR code');
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate 10 backup codes by default', () => {
      const backupCodes = twoFactorService.generateBackupCodes();

      expect(mockCrypto.randomBytes).toHaveBeenCalledTimes(10);
      expect(backupCodes).toHaveLength(10);
      expect(backupCodes[0]).toBe('TEST-CODE');
    });

    it('should generate custom number of backup codes', () => {
      const backupCodes = twoFactorService.generateBackupCodes(5);

      expect(mockCrypto.randomBytes).toHaveBeenCalledTimes(5);
      expect(backupCodes).toHaveLength(5);
    });
  });

  describe('setupTwoFactor', () => {
    it('should setup 2FA for user', async () => {
      const userId = 'user123';

      const result = await twoFactorService.setupTwoFactor(userId);

      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(mockUserModel.updateTwoFactorSecret).toHaveBeenCalledWith(
        userId,
        'JBSWY3DPEHPK3PXP',
        ['hashed-value', 'hashed-value', 'hashed-value', 'hashed-value', 'hashed-value',
         'hashed-value', 'hashed-value', 'hashed-value', 'hashed-value', 'hashed-value']
      );
      expect(result).toHaveProperty('secret', 'JBSWY3DPEHPK3PXP');
      expect(result).toHaveProperty('qrCode', 'data:image/png;base64,mock-qr-code');
      expect(result).toHaveProperty('backupCodes');
      expect(result.backupCodes).toHaveLength(10);
    });

    it('should throw error if user not found', async () => {
      mockUserModel.findById.mockResolvedValue(null);

      await expect(twoFactorService.setupTwoFactor('nonexistent'))
        .rejects.toThrow('User not found');
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid TOTP token', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const token = '123456';

      const result = twoFactorService.verifyToken(secret, token);

      expect(mockSpeakeasy.totp.verify).toHaveBeenCalledWith({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 2,
        time: expect.any(Number)
      });
      expect(result).toBe(true);
    });

    it('should reject invalid TOTP token', () => {
      mockSpeakeasy.totp.verify.mockReturnValue(false);

      const result = twoFactorService.verifyToken('JBSWY3DPEHPK3PXP', '000000');

      expect(result).toBe(false);
    });

    it('should handle verification errors gracefully', () => {
      mockSpeakeasy.totp.verify.mockImplementation(() => {
        throw new Error('Verification error');
      });

      const result = twoFactorService.verifyToken('JBSWY3DPEHPK3PXP', '123456');

      expect(result).toBe(false);
    });
  });

  describe('verifyBackupCode', () => {
    it('should verify a valid backup code', () => {
      const hashedCodes = ['hashed-valid-code'];
      const providedCode = 'valid-code';

      // Mock the hash creation for the provided code
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValueOnce('hashed-valid-code')
      };
      mockCrypto.createHash.mockReturnValue(mockHash as any);

      const result = twoFactorService.verifyBackupCode(hashedCodes, providedCode);

      expect(result).toBe(true);
    });

    it('should reject invalid backup code', () => {
      const hashedCodes = ['hashed-valid-code'];
      const providedCode = 'invalid-code';

      // Mock the hash creation for the provided code
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValueOnce('hashed-invalid-code')
      };
      mockCrypto.createHash.mockReturnValue(mockHash as any);

      const result = twoFactorService.verifyBackupCode(hashedCodes, providedCode);

      expect(result).toBe(false);
    });
  });
});
