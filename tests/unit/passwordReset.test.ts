/**
 * Unit Tests for Password Reset Model
 */

import crypto from 'crypto';
import { passwordResetModel } from '../../src/models/passwordReset';
import database from '../../src/database/connection';

// Mock database for testing
jest.mock('../../src/database/connection', () => ({
  getPool: jest.fn(),
  query: jest.fn(),
}));

const mockDb = database as jest.Mocked<typeof database>;

const buildResetRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'reset-1',
  user_id: 'user-123',
  token_hash: 'hashed-token',
  expires_at: new Date(Date.now() + 3600000),
  used_at: null,
  created_at: new Date(),
  ...overrides,
});

describe('Password Reset Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create password reset token', async () => {
      const userId = 'user-123';
      const mockResetRow = buildResetRow({ user_id: userId });

      mockDb.query
        .mockResolvedValueOnce({ rowCount: 1 } as any)
        .mockResolvedValueOnce({
          rows: [mockResetRow],
          rowCount: 1,
        } as any);

      const result = await passwordResetModel.create(userId);

      expect(result.token).toEqual(expect.any(String));
      expect(result.reset.userId).toBe(userId);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO password_resets'),
        expect.arrayContaining([userId, expect.any(String), expect.any(Date)])
      );
    });
  });

  describe('findByToken', () => {
    it('should return reset record for valid token', async () => {
      const token = 'valid-reset-token';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const mockResetRow = buildResetRow({ token_hash: tokenHash });

      mockDb.query.mockResolvedValueOnce({
        rows: [mockResetRow],
        rowCount: 1,
      } as any);

      const result = await passwordResetModel.findByToken(token);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE token_hash = $1'),
        [tokenHash]
      );
      expect(result?.id).toBe(mockResetRow.id);
    });

    it('should return null for expired token', async () => {
      const token = 'expired-token';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      mockDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await passwordResetModel.findByToken(token);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE token_hash = $1'),
        [tokenHash]
      );
      expect(result).toBeNull();
    });
  });

  describe('markAsUsed', () => {
    it('should mark token as used', async () => {
      const tokenId = 'reset-1';

      mockDb.query.mockResolvedValueOnce({ rowCount: 1 } as any);

      await passwordResetModel.markAsUsed(tokenId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE password_resets'),
        [tokenId]
      );
    });
  });

  describe('invalidateAllUserTokens', () => {
    it('should invalidate all tokens for a user', async () => {
      const userId = 'user-123';

      mockDb.query.mockResolvedValueOnce({ rowCount: 1 } as any);

      await passwordResetModel.invalidateAllUserTokens(userId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE password_resets'),
        [userId]
      );
    });
  });
});
