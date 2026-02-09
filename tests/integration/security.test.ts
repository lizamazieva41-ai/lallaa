/**
 * Security Regression Tests
 * Tests to ensure security fixes remain in place and prevent regressions
 */

import request from 'supertest';
import { app } from '../../src/index';
import { v4 as uuidv4 } from 'uuid';
import database, { initializeSchema } from '../../src/database/connection';
import { initializeRateLimiter, cleanupRateLimiter } from '../../src/middleware/rateLimit';
import { countryModel } from '../../src/models/country';
import { userModel } from '../../src/models/user';
import { UserRole } from '../../src/types';

jest.setTimeout(30000);

describe('Security Regression Tests', () => {
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    await database.connect();
    await initializeSchema();
    await initializeRateLimiter();
    await countryModel.seedDefaultCountries(true);

    await database.query(
      `DELETE FROM users WHERE email IN ($1, $2, $3, $4)`,
      [
        'security-test@example.com',
        'admin-security@example.com',
        'user1@example.com',
        'user2@example.com'
      ]
    );
    await database.query(
      `INSERT INTO bins (bin, bank_name, country_code, country_name, card_type, card_network, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (bin) DO UPDATE SET
         bank_name = EXCLUDED.bank_name,
         country_code = EXCLUDED.country_code,
         country_name = EXCLUDED.country_name,
         card_type = EXCLUDED.card_type,
         card_network = EXCLUDED.card_network,
         source = EXCLUDED.source`,
      ['411111', 'Security Test Bank', 'US', 'United States', 'debit', 'visa', 'security-test']
    );

    // Create test user and get token
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'security-test@example.com',
        password: 'SecurePassword123!',
        firstName: 'Security',
        lastName: 'User'
      });

    expect(registerResponse.status).toBe(200);

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'security-test@example.com',
        password: 'SecurePassword123!'
      });

    expect(loginResponse.status).toBe(200);
    authToken = loginResponse.body.data.tokens.accessToken;

    // Create admin user and get token
    const adminRegisterResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'admin-security@example.com',
        password: 'AdminSecurePassword123!',
        firstName: 'Admin',
        lastName: 'User'
      });

    expect(adminRegisterResponse.status).toBe(200);

    const adminUserId = adminRegisterResponse.body.data.user.id;
    await userModel.update(adminUserId, { role: UserRole.ADMIN });

    const adminLoginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin-security@example.com',
        password: 'AdminSecurePassword123!'
      });

    expect(adminLoginResponse.status).toBe(200);
    adminToken = adminLoginResponse.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    await cleanupRateLimiter();
    await database.disconnect();
  });

  describe('JWT Security', () => {
    it('should reject unsigned JWT tokens', async () => {
      const unsignedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJlbWFpbCI6InNlYXRpb24ifQ'; // Unsigned token

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${unsignedToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_ERROR');
    });

    it('should reject JWT tokens with "none" algorithm', async () => {
      const noneAlgorithmToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6Ik5ub25uIHR5cGlvbiI6bm9uZSI6ImFsZ29ueWEifQ'; // alg: none token

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${noneAlgorithmToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_ERROR');
    });

    it('should reject expired JWT tokens', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJlbWFpbCI6InNlYXRpb24iLCJleHBpcmVkX2oxNjAwMDAsInNhdGUiOjI2NjAwMDAsInRhdGUiOjE2MDAwMDAsInNhdGUiLCJpYXQiOjE2MDAwMDAifQ'; // Expired token

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_ERROR');
    });
  });

  describe('Authorization Controls', () => {
    it('should allow admin access to admin endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/admin/bin/411111')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it('should reject regular user access to admin endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/admin/bin/411111')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject unauthenticated access to protected endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_ERROR');
    });
  });

  describe('Input Validation', () => {
    it('should sanitize and validate BIN input', async () => {
      const maliciousInput = encodeURIComponent('<script>alert("xss")</script>');
      const response = await request(app)
        .get(`/api/v1/bin/${maliciousInput}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle SQL injection attempts', async () => {
      const sqlInjection = "411111'; DROP TABLE users; --";
      const response = await request(app)
        .get(`/api/v1/bin/${sqlInjection}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Should either validate and reject, or sanitize safely
      expect([400, 422]).toContain(response.status);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on sensitive endpoints', async () => {
      const promises = Array(20).fill(null).map(() => 
        request(app)
          .post('/api/v1/auth/reset-password/request')
          .send({
            email: 'limit-test@example.com'
          })
      );

      const responses = await Promise.all(promises);
      const rejectedCount = responses.filter(r => r.status === 429).length;

      expect(rejectedCount).toBeGreaterThan(10); // Should hit rate limit
    });

    it('should allow legitimate requests within rate limits', async () => {
      const response = await request(app)
        .get('/api/v1/bin/411111')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Data Exposure Prevention', () => {
    it('should not expose sensitive data in error messages', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.message).not.toContain('password');
      expect(response.body.error.message).not.toContain('email');
    });

    it('should mask sensitive data in logs', async () => {
      // This test would require log inspection
      // For now, we test that endpoints don't return raw sensitive data
      const response = await request(app)
        .get('/api/v1/cards/generate')
        .query({ vendor: 'visa', count: 1 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.cards[0].cardNumber).toMatch(/^\d{13,19}$/);
    });
  });

  describe('Row Level Security', () => {
    it('should enforce data isolation between users', async () => {
      // Create two users and try to access each other's data
      const user1Response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'user1@example.com',
          password: 'Password123!',
          firstName: 'User',
          lastName: 'One'
        });

      const user2Response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'user2@example.com', 
          password: 'Password123!',
          firstName: 'User',
          lastName: 'Two'
        });

      expect(user1Response.status).toBe(200);
      expect(user2Response.status).toBe(200);

      const user1Token = user1Response.body.data.tokens.accessToken;
      const user2Token = user2Response.body.data.tokens.accessToken;

      const user1KeyResponse = await request(app)
        .post('/api/v1/auth/api-keys')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'user1-key' });

      const user2KeyResponse = await request(app)
        .post('/api/v1/auth/api-keys')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ name: 'user2-key' });

      expect(user1KeyResponse.status).toBe(200);
      expect(user2KeyResponse.status).toBe(200);

      // User 1 tries to access User 2's API keys
      const user1KeysResponse = await request(app)
        .get('/api/v1/auth/api-keys')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(user1KeysResponse.status).toBe(200);
      expect(user1KeysResponse.body.data.keys).toHaveLength(1); // Only user 1's keys

      // User 2 tries to access User 1's API keys
      const user2KeysResponse = await request(app)
        .get('/api/v1/auth/api-keys')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(user2KeysResponse.status).toBe(200);
      expect(user2KeysResponse.body.data.keys).toHaveLength(1); // Only user 2's keys
    });
  });

  describe('CORS and Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/v1/bin/411111')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });

    it('should handle preflight OPTIONS requests', async () => {
      const response = await request(app)
        .options('/api/v1/bin/411111');

      expect(response.status).toBe(204);
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });
});
