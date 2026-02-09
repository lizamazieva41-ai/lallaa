/**
 * Unit Tests for API Key Model
 */

import { apiKeyModel } from '../../src/models/apiKey';
import database from '../../src/database/connection';

// Mock database for testing
jest.mock('../../src/database/connection', () => ({
  getPool: jest.fn(),
  query: jest.fn(),
}));

const mockDb = database as jest.Mocked<typeof database>;

const buildApiKeyRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'key-id',
  key_id: 'test-key-id',
  user_id: 'user-123',
  key_hash: 'valid-hash-123',
  key_prefix: 'bincheck_test',
  name: 'Test Key',
  permissions: { read: true },
  rate_limit: 100,
  ip_whitelist: ['192.168.1.1'],
  last_used_at: null,
  expires_at: null,
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

describe('API Key Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should validate API key hash correctly', async () => {
      const apiKeyHash = 'valid-hash-123';
      const mockApiKeyData = buildApiKeyRow({ key_hash: apiKeyHash });

      mockDb.query.mockResolvedValueOnce({
        rows: [mockApiKeyData],
        rowCount: 1,
      } as any);

      const result = await apiKeyModel.validate(apiKeyHash);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM api_keys'),
        [apiKeyHash]
      );
      expect(result?.keyId).toBe(mockApiKeyData.key_id);
    });

    it('should return null for invalid API key', async () => {
      const invalidHash = 'invalid-hash';

      mockDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await apiKeyModel.validate(invalidHash);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create new API key with proper hash', async () => {
      const userId = 'user-123';
      const name = 'New API Key';
      const permissions = { read: true, write: false };
      const ipWhitelist = ['192.168.1.1'];
      const mockCreatedKey = buildApiKeyRow({
        user_id: userId,
        name,
        permissions,
        ip_whitelist: ipWhitelist,
      });

      mockDb.query.mockResolvedValueOnce({
        rows: [mockCreatedKey],
        rowCount: 1,
      } as any);

      const result = await apiKeyModel.create(
        userId,
        name,
        permissions,
        100,
        ipWhitelist
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO api_keys'),
        expect.arrayContaining([
          expect.any(String),
          userId,
          expect.any(String),
          expect.any(String),
          name,
          JSON.stringify(permissions),
          100,
          JSON.stringify(ipWhitelist),
        ])
      );
      expect(result.key.userId).toBe(userId);
      expect(result.rawKey).toEqual(expect.any(String));
    });
  });

  describe('updateLastUsed', () => {
    it('should update last used timestamp', async () => {
      const keyId = 'key-123';

      mockDb.query.mockResolvedValueOnce({
        rowCount: 1,
      } as any);

      await apiKeyModel.updateLastUsed(keyId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE api_keys'),
        [keyId]
      );
    });
  });

  describe('delete', () => {
    it('should deactivate API key by setting inactive', async () => {
      const keyId = 'key-123';

      mockDb.query.mockResolvedValueOnce({
        rowCount: 1,
      } as any);

      const result = await apiKeyModel.delete(keyId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE api_keys'),
        [keyId]
      );
      expect(result).toBe(true);
    });
  });
});
