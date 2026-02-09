/**
 * Unit Tests for User Model
 */

import bcrypt from 'bcrypt';
import { userModel } from '../../src/models/user';
import database from '../../src/database/connection';
import { UserRole, UserStatus, UserTier } from '../../src/types';

// Mock database for testing
jest.mock('../../src/database/connection', () => ({
  getPool: jest.fn(),
  query: jest.fn(),
}));
jest.mock('bcrypt');

const mockDb = database as jest.Mocked<typeof database>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

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

const buildUserRow = (overrides: Partial<UserRow> = {}): UserRow => ({
  id: 'user-123',
  email: 'test@example.com',
  password_hash: 'hashed-password',
  first_name: 'Test',
  last_name: 'User',
  role: UserRole.USER,
  status: UserStatus.ACTIVE,
  tier: UserTier.FREE,
  quota_limit: 100,
  quota_used: 0,
  email_verified: false,
  two_factor_enabled: false,
  two_factor_secret: null,
  backup_codes: null,
  created_at: new Date(),
  updated_at: new Date(),
  last_login_at: null,
  ...overrides,
});

describe('User Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const userId = 'user-123';
      const mockUser = buildUserRow({ id: userId });

      mockDb.query.mockResolvedValueOnce({
        rows: [mockUser],
        rowCount: 1
      } as any);

      const result = await userModel.findById(userId);

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );
      expect(result?.id).toBe(userId);
      expect(result?.email).toBe('test@example.com');
    });

    it('should return null when user not found', async () => {
      const userId = 'nonexistent-user';

      mockDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      } as any);

      const result = await userModel.findById(userId);

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const userId = 'user-123';
      const dbError = new Error('Database connection failed');

      mockDb.query.mockRejectedValueOnce(dbError);

      await expect(userModel.findById(userId)).rejects.toThrow(dbError);
    });
  });

  describe('findByEmail', () => {
    it('should return user when found by email', async () => {
      const email = 'test@example.com';
      const mockUser = buildUserRow({ email });

      mockDb.query.mockResolvedValueOnce({
        rows: [mockUser],
        rowCount: 1
      } as any);

      const result = await userModel.findByEmail(email);

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1',
        [email.toLowerCase()]
      );
      expect(result?.email).toBe(email);
    });

    it('should return null when email not found', async () => {
      const email = 'nonexistent@example.com';

      mockDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      } as any);

      const result = await userModel.findByEmail(email);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create new user with hashed password', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'plaintext-password',
        firstName: 'New',
        lastName: 'User',
      };

      const mockCreatedUser = buildUserRow({
        id: 'new-user-id',
        email: userData.email,
        first_name: userData.firstName,
        last_name: userData.lastName,
      });

      (mockBcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      mockDb.query.mockResolvedValueOnce({
        rows: [mockCreatedUser],
        rowCount: 1
      } as any);

      const result = await userModel.create(
        userData.email,
        userData.password,
        userData.firstName,
        userData.lastName
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        [
          userData.email.toLowerCase(),
          'hashed-password',
          userData.firstName,
          userData.lastName,
        ]
      );
      expect(result.email).toBe(userData.email);
    });

    it('should handle duplicate email error', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'password',
        firstName: 'Existing',
        lastName: 'User',
      };

      const duplicateError = new Error('Duplicate key value violates unique constraint');

      mockDb.query.mockRejectedValueOnce(duplicateError);

      await expect(
        userModel.create(
          userData.email,
          userData.password,
          userData.firstName,
          userData.lastName
        )
      ).rejects.toThrow(duplicateError);
    });
  });

  describe('updateLastActivity', () => {
    it('should update user last activity timestamp', async () => {
      const userId = 'user-123';

      mockDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 1
      } as any);

      await userModel.updateLastActivity(userId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        [userId]
      );
    });
  });
});
