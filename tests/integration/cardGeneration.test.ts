/**
 * Integration tests for card generation
 */

import request from 'supertest';
import { app } from '../../src/index';
import { database } from '../../src/database/connection';

describe('Card Generation Integration Tests', () => {
  let authToken: string;
  let apiKey: string;

  beforeAll(async () => {
    // Setup: Create test user and get auth token
    // This would require test database setup
    // authToken = await getTestAuthToken();
  });

  afterAll(async () => {
    // Cleanup
    await database.disconnect();
  });

  describe('POST /api/v1/cards/generate-from-bin', () => {
    it('should generate a single card', async () => {
      const response = await request(app)
        .post('/api/v1/cards/generate-from-bin')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bin: '411111',
          expiryMonths: 12,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cardNumber');
      expect(response.body.data).toHaveProperty('expiryDate');
      expect(response.body.data).toHaveProperty('cvv');
    });

    it('should enforce uniqueness', async () => {
      // Generate multiple cards and verify uniqueness
      const cards: Set<string> = new Set();
      const count = 10;

      for (let i = 0; i < count; i++) {
        const response = await request(app)
          .post('/api/v1/cards/generate-from-bin')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            bin: '411111',
            expiryMonths: 12,
          });

        expect(response.status).toBe(200);
        const cardKey = `${response.body.data.cardNumber}-${response.body.data.expiryDate}-${response.body.data.cvv}`;
        expect(cards.has(cardKey)).toBe(false);
        cards.add(cardKey);
      }
    });
  });

  describe('POST /api/v1/cards/generate-async', () => {
    it('should create async job', async () => {
      const response = await request(app)
        .post('/api/v1/cards/generate-async')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bin: '411111',
          count: 100,
          expiryMonths: 12,
        });

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('jobId');
    });

    it('should track job status', async () => {
      // Create job
      const createResponse = await request(app)
        .post('/api/v1/cards/generate-async')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bin: '411111',
          count: 10,
          expiryMonths: 12,
        });

      const jobId = createResponse.body.data.jobId;

      // Check status
      const statusResponse = await request(app)
        .get(`/api/v1/cards/jobs/${jobId}/status`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data).toHaveProperty('status');
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing API contract', async () => {
      const response = await request(app)
        .get('/api/v1/cards/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          vendor: 'visa',
          count: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
    });
  });
});
