import express from 'express';
import request from 'supertest';

jest.mock('@/security/rowLevelSecuritySimple', () => ({
  RowLevelSecuritySystem: class {
    async testRLSConfiguration() {
      return { success: true, issues: [], recommendations: [] };
    }

    async getTablePolicies() {
      return ['policy_a'];
    }

    async getAllPolicies() {
      return { users: ['policy_a'] };
    }
  }
}));

import multiTenantRoutes from '@/routes/multiTenant';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/multi-tenant', multiTenantRoutes);
  return app;
};

describe('Multi-tenant routes', () => {
  it('should validate tenant creation input', async () => {
    const app = buildApp();
    const response = await request(app)
      .post('/multi-tenant/tenants')
      .send({ name: 'Tenant A' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should create, update, and delete a tenant', async () => {
    const app = buildApp();
    const createResponse = await request(app)
      .post('/multi-tenant/tenants')
      .send({ name: 'Tenant B', slug: 'tenant-b' });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.success).toBe(true);

    const tenantId = createResponse.body.data.tenant.id;

    const updateResponse = await request(app)
      .put(`/multi-tenant/tenants/${tenantId}`)
      .send({ name: 'Tenant B Updated' });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.success).toBe(true);

    const deleteResponse = await request(app)
      .delete(`/multi-tenant/tenants/${tenantId}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.success).toBe(true);
  });

  it('should list tenants and policies', async () => {
    const app = buildApp();
    const listResponse = await request(app)
      .get('/multi-tenant/tenants')
      .query({ page: '1', limit: '5' });

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.success).toBe(true);

    const policiesResponse = await request(app)
      .get('/multi-tenant/tenants/tenant_main/rls-policies');

    expect(policiesResponse.status).toBe(200);
    expect(policiesResponse.body.success).toBe(true);
  });

  it('should return system health', async () => {
    const app = buildApp();
    const response = await request(app)
      .get('/multi-tenant/system/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
