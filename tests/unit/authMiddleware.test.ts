import { authenticateJWT, authenticateAPIKey, authenticate, authorize, optionalAuth, trackUserActivity, AuthenticationError, AuthorizationError } from '../../src/middleware/auth';
import jwt from 'jsonwebtoken';
import { userModel } from '../../src/models/user';
import { apiKeyModel } from '../../src/models/apiKey';

jest.mock('../../src/models/user', () => ({
  userModel: {
    findById: jest.fn(),
  },
}));

jest.mock('../../src/models/apiKey', () => ({
  apiKeyModel: {
    validate: jest.fn(),
    updateLastUsed: jest.fn(),
  },
}));

jest.mock('jsonwebtoken', () => {
  class TokenExpiredError extends Error {}
  class JsonWebTokenError extends Error {}
  return {
    verify: jest.fn(),
    TokenExpiredError,
    JsonWebTokenError,
  };
});

const mockJwt = jwt as unknown as {
  verify: jest.Mock;
  TokenExpiredError: new (message?: string) => Error;
  JsonWebTokenError: new (message?: string) => Error;
};

const mockUserModel = userModel as unknown as { findById: jest.Mock };
const mockApiKeyModel = apiKeyModel as unknown as { validate: jest.Mock; updateLastUsed: jest.Mock };

const buildRes = () => ({
  set: jest.fn(),
});

describe('Auth middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reject missing JWT header', async () => {
    const req = { headers: {}, path: '/x', method: 'GET' } as any;
    const res = {} as any;
    const next = jest.fn();

    await authenticateJWT(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
  });

  it('should accept valid JWT', async () => {
    mockJwt.verify.mockReturnValue({
      userId: 'user-1',
      email: 'a@b.com',
      role: 'user',
      tier: 'free',
      type: 'access',
    });
    mockUserModel.findById.mockResolvedValue({ id: 'user-1', status: 'active' });

    const req = {
      headers: { authorization: 'Bearer token' },
      path: '/x',
      method: 'GET',
    } as any;
    const res = {} as any;
    const next = jest.fn();

    await authenticateJWT(req, res, next);
    expect(req.userId).toBe('user-1');
    expect(next).toHaveBeenCalledWith();
  });

  it('should reject expired JWT', async () => {
    mockJwt.verify.mockImplementation(() => {
      throw new mockJwt.TokenExpiredError('expired');
    });

    const req = { headers: { authorization: 'Bearer token' }, path: '/x', method: 'GET' } as any;
    const res = {} as any;
    const next = jest.fn();

    await authenticateJWT(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
  });

  it('should reject invalid API key', async () => {
    mockApiKeyModel.validate.mockResolvedValue(null);
    const req = { headers: { 'x-api-key': 'bad' }, path: '/x', method: 'GET' } as any;
    const res = {} as any;
    const next = jest.fn();

    await authenticateAPIKey(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
  });

  it('should reject API key for non-whitelisted IP', async () => {
    mockApiKeyModel.validate.mockResolvedValue({
      id: 'key-1',
      keyId: 'key-id',
      userId: 'user-1',
      ipWhitelist: ['5.5.5.5'],
    });

    const req = { headers: { 'x-api-key': 'good' }, ip: '1.2.3.4', path: '/x', method: 'GET' } as any;
    const res = {} as any;
    const next = jest.fn();

    await authenticateAPIKey(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
  });

  it('should accept API key and set request fields', async () => {
    mockApiKeyModel.validate.mockResolvedValue({
      id: 'key-1',
      keyId: 'key-id',
      userId: 'user-1',
      ipWhitelist: [],
    });
    mockApiKeyModel.updateLastUsed.mockResolvedValue(undefined);

    const req = { headers: { 'x-api-key': 'good' }, ip: '1.2.3.4', path: '/x', method: 'GET' } as any;
    const res = {} as any;
    const next = jest.fn();

    await authenticateAPIKey(req, res, next);
    expect(req.userId).toBe('user-1');
    expect(req.apiKeyId).toBe('key-id');
    expect(next).toHaveBeenCalledWith();
  });

  it('should authenticate using API key when provided', async () => {
    mockApiKeyModel.validate.mockResolvedValue({
      id: 'key-1',
      keyId: 'key-id',
      userId: 'user-1',
      ipWhitelist: [],
    });
    mockApiKeyModel.updateLastUsed.mockResolvedValue(undefined);

    const req = { headers: { 'x-api-key': 'good' }, ip: '1.2.3.4', path: '/x', method: 'GET' } as any;
    const res = {} as any;
    const next = jest.fn();

    await authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('should authorize allowed roles', () => {
    const req = { user: { role: 'admin' } } as any;
    const res = {} as any;
    const next = jest.fn();

    authorize('admin')(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('should pass optional auth even on failure', async () => {
    mockJwt.verify.mockImplementation(() => {
      throw new Error('bad token');
    });

    const req = { headers: { authorization: 'Bearer bad' }, path: '/x', method: 'GET' } as any;
    const res = {} as any;
    const next = jest.fn();

    await optionalAuth(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should set tracking headers', () => {
    const req = { userId: 'user-1', apiKeyId: 'key-1' } as any;
    const res = buildRes();
    const next = jest.fn();

    trackUserActivity(req, res as any, next);
    expect(res.set).toHaveBeenCalledWith('X-User-ID', 'user-1');
    expect(res.set).toHaveBeenCalledWith('X-API-Key-ID', 'key-1');
    expect(next).toHaveBeenCalledWith();
  });
});
