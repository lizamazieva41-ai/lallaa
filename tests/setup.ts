import { logger } from '../src/utils/logger';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key';
process.env.POSTGRES_HOST = 'localhost';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_KEY_PREFIX = `bincheck:test:${process.env.JEST_WORKER_ID || '0'}:${Date.now()}:`;
process.env.FEATURE_CARD_GENERATION = 'true';

// Mock logger to reduce noise in tests
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  logRequest: jest.fn(),
  logError: jest.fn(),
  logSecurity: jest.fn(),
}));

// Global test timeout
jest.setTimeout(10000);

// Clean up after all tests
afterAll(async () => {
  // Any cleanup needed
});
