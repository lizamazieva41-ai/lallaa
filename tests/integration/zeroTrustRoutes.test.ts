import express from 'express';
import request from 'supertest';
import zeroTrustRoutes from '@/routes/zeroTrust';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/zero-trust', zeroTrustRoutes);
  return app;
};

describe('Zero Trust routes', () => {
  it('should reject invalid context method', async () => {
    const app = buildApp();
    const response = await request(app)
      .post('/zero-trust/context')
      .send({ sessionId: 'session-1', method: 'invalid' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should create context and evaluate access', async () => {
    const app = buildApp();
    const createResponse = await request(app)
      .post('/zero-trust/context')
      .send({ sessionId: 'session-2', method: 'password', userId: 'user-1' });

    expect(createResponse.status).toBe(200);
    expect(createResponse.body.success).toBe(true);

    const evalResponse = await request(app)
      .post('/zero-trust/context/session-2/evaluate')
      .send({});

    expect(evalResponse.status).toBe(200);
    expect(evalResponse.body.success).toBe(true);
  });

  it('should validate identity proofs and behavior events', async () => {
    const app = buildApp();
    const proofResponse = await request(app)
      .post('/zero-trust/identity/proof')
      .send({ sessionId: 'session-3', type: 'password', data: { password: 'secret' } });

    expect(proofResponse.status).toBe(200);
    expect(proofResponse.body.success).toBe(true);

    const invalidEvent = await request(app)
      .post('/zero-trust/behavior/event')
      .send({ sessionId: 'session-3', type: 'invalid' });

    expect(invalidEvent.status).toBe(400);
    expect(invalidEvent.body.success).toBe(false);

    const validEvent = await request(app)
      .post('/zero-trust/behavior/event')
      .send({ sessionId: 'session-3', type: 'login', description: 'login ok' });

    expect(validEvent.status).toBe(200);
    expect(validEvent.body.success).toBe(true);
  });

  it('should record behavior patterns', async () => {
    const app = buildApp();
    const badPattern = await request(app)
      .post('/zero-trust/behavior/pattern')
      .send({ sessionId: 'session-4', type: 'invalid' });

    expect(badPattern.status).toBe(400);

    const okPattern = await request(app)
      .post('/zero-trust/behavior/pattern')
      .send({ sessionId: 'session-4', type: 'typing', data: { typingSpeed: 70 } });

    expect(okPattern.status).toBe(200);
    expect(okPattern.body.success).toBe(true);
  });
});
