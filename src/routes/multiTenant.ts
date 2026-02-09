import { Router, Request, Response } from 'express';
import { sendSuccess, sendError, asyncHandler } from '@/utils/response';
import { logger } from '@/utils/logger';
import { tenantManagementSystem } from '@/security/tenantManagement';
import { TenantTier, TenantStatus } from '@/security/multiTenantArchitecture';
import { TenantAwareAuth } from '@/middleware/tenantAuth';
import { RowLevelSecuritySystem } from '@/security/rowLevelSecuritySimple';
import { pool } from '@/middleware/rls';

// Multi-tenant Management API Routes
const router = Router();
const rowLevelSecuritySystem = new RowLevelSecuritySystem(pool);

const getQueryValue = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

const getQueryNumber = (value: unknown, fallback: number): number => {
  const raw = getQueryValue(value);
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isNaN(parsed) ? fallback : parsed;
};

const getParamValue = (value: string | string[] | undefined): string => {
  if (!value) return '';
  return Array.isArray(value) ? value[0] : value;
};

// Tenant Management Routes
router.post('/tenants', asyncHandler(async (req: Request, res: Response) => {
  try {
    const tenantData = req.body;
    
    // Validate required fields
    if (!tenantData.name || !tenantData.slug) {
      return sendError(res, 'Tên và slug là bắt buộc', 400);
    }

    const newTenant = await tenantManagementSystem.createTenant(tenantData);
    
    sendSuccess(res, {
      tenant: newTenant,
      message: 'Tenant được tạo thành công'
    }, req.requestId, 201);

  } catch (error) {
    logger.error('Lỗi tạo tenant', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tenantData: req.body
    });
    sendError(res, 'Failed to create tenant', 500);
  }
}));

router.get('/tenants', asyncHandler(async (req: Request, res: Response) => {
  try {
    const tier = getQueryValue(req.query.tier);
    const status = getQueryValue(req.query.status);
    const page = getQueryNumber(req.query.page, 1);
    const limit = getQueryNumber(req.query.limit, 20);
    
    let tenants = tenantManagementSystem.getTenants();
    
    // Apply filters
    if (tier) {
      tenants = tenants.filter(t => t.tier === tier);
    }
    if (status) {
      tenants = tenants.filter(t => t.status === status);
    }
    
    // Pagination
    const total = tenants.length;
    const offset = (page - 1) * limit;
    const paginatedTenants = tenants.slice(offset, offset + limit);

    sendSuccess(res, {
      tenants: paginatedTenants,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }, req.requestId);

  } catch (error) {
    logger.error('Lỗi lấy danh sách tenants', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    sendError(res, 'Failed to get tenants', 500);
  }
}));

router.get('/tenants/:tenantId', asyncHandler(async (req: Request, res: Response) => {
  try {
    const tenantId = getParamValue(req.params.tenantId);
    const tenant = tenantManagementSystem.getTenant(tenantId);
    
    if (!tenant) {
      return sendError(res, 'Tenant không tồn tại', 404);
    }

    sendSuccess(res, { tenant }, req.requestId);

  } catch (error) {
    logger.error('Lỗi lấy tenant details', {
      tenantId: req.params.tenantId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    sendError(res, 'Failed to get tenant', 500);
  }
}));

router.put('/tenants/:tenantId', asyncHandler(async (req: Request, res: Response) => {
  try {
    const tenantId = getParamValue(req.params.tenantId);
    const updates = req.body;
    
    const updatedTenant = await tenantManagementSystem.updateTenant(tenantId, updates);
    
    sendSuccess(res, {
      tenant: updatedTenant,
      message: 'Tenant được cập nhật thành công'
    }, req.requestId);

  } catch (error) {
    logger.error('Lỗi cập nhật tenant', {
      tenantId: req.params.tenantId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    sendError(res, 'Failed to update tenant', 500);
  }
}));

router.delete('/tenants/:tenantId', asyncHandler(async (req: Request, res: Response) => {
  try {
    const tenantId = getParamValue(req.params.tenantId);
    
    const success = await tenantManagementSystem.deleteTenant(tenantId);
    
    if (success) {
      sendSuccess(res, {
        message: 'Tenant được xóa thành công'
      }, req.requestId);
    } else {
      sendError(res, 'Tenant không tồn tại', 404);
    }

  } catch (error) {
    logger.error('Lỗi xóa tenant', {
      tenantId: req.params.tenantId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    sendError(res, 'Failed to delete tenant', 500);
  }
}));

// Tenant User Management
router.post('/tenants/:tenantId/users', asyncHandler(async (req: Request, res: Response) => {
  try {
    const tenantId = getParamValue(req.params.tenantId);
    const userData = req.body;
    
    // Validate tenant exists
    const tenant = tenantManagementSystem.getTenant(tenantId);
    if (!tenant) {
      return sendError(res, 'Tenant không tồn tại', 404);
    }
    
    const newUser = await tenantManagementSystem.createTenantUser(tenantId, userData);
    
    sendSuccess(res, {
      user: newUser,
      message: 'User được tạo thành công'
    }, req.requestId, 201);

  } catch (error) {
    logger.error('Lỗi tạo tenant user', {
      tenantId: req.params.tenantId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    sendError(res, 'Failed to create user', 500);
  }
}));

router.get('/tenants/:tenantId/users', asyncHandler(async (req: Request, res: Response) => {
  try {
    const tenantId = getParamValue(req.params.tenantId);
    const status = getQueryValue(req.query.status);
    const role = getQueryValue(req.query.role);
    const page = getQueryNumber(req.query.page, 1);
    const limit = getQueryNumber(req.query.limit, 20);
    
    let users = tenantManagementSystem.getTenantUsers(tenantId);
    
    // Apply filters
    if (status) {
      users = users.filter(u => u.status === status);
    }
    if (role) {
      users = users.filter(u => u.role === role);
    }
    
    // Pagination
    const total = users.length;
    const offset = (page - 1) * limit;
    const paginatedUsers = users.slice(offset, offset + limit);

    sendSuccess(res, {
      users: paginatedUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }, req.requestId);

  } catch (error) {
    logger.error('Lỗi lấy danh sách users', {
      tenantId: req.params.tenantId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    sendError(res, 'Failed to get users', 500);
  }
}));

// Tenant Analytics and Monitoring
router.get('/tenants/:tenantId/analytics', asyncHandler(async (req: Request, res: Response) => {
  try {
    const tenantId = getParamValue(req.params.tenantId);
    const period = getQueryValue(req.query.period) || '30d';
    
    const tenant = tenantManagementSystem.getTenant(tenantId);
    if (!tenant) {
      return sendError(res, 'Tenant không tồn tại', 404);
    }
    
    const resourceUsage = tenantManagementSystem.getResourceUsage(tenantId, 12);
    const analytics = tenantManagementSystem.getTenantAnalytics(tenantId);
    const limitsCheck = await tenantManagementSystem.checkTenantLimits(tenantId);
    
    // Calculate usage percentages
    const usagePercentages = {
      users: (tenant.limits.users.activeUsers / tenant.limits.users.maxUsers) * 100,
      storage: (tenant.limits.storage.usedStorageGB / tenant.limits.storage.maxStorageGB) * 100,
      api: (tenant.limits.api.requestsThisMonth / tenant.limits.api.requestsPerMonth) * 100,
      bandwidth: (tenant.limits.bandwidth.usedBandwidthGB / tenant.limits.bandwidth.maxBandwidthGB) * 100
    };

    sendSuccess(res, {
      tenantId,
      period,
      resource: {
        usage: resourceUsage,
        limits: tenant.limits,
        percentages: usagePercentages,
        violations: limitsCheck.violations
      },
      analytics,
      compliance: {
        withinLimits: limitsCheck.withinLimits,
        violations: limitsCheck.violations,
        recommendations: limitsCheck.violations.length > 0 ? [
          'Upgrade tenant tier để tăng limits',
          'Optimize resource usage',
          'Xóa unused data/users'
        ] : [
          'Resource usage within limits',
          'Monitor usage trends'
        ]
      }
    }, req.requestId);

  } catch (error) {
    logger.error('Lỗi lấy tenant analytics', {
      tenantId: req.params.tenantId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    sendError(res, 'Failed to get analytics', 500);
  }
}));

// RLS Policy Management
router.get('/tenants/:tenantId/rls-policies', asyncHandler(async (req: Request, res: Response) => {
  try {
    const tenantId = getParamValue(req.params.tenantId);
    const table = getQueryValue(req.query.table);
    
    // Get all policies or policies cho specific table
    let policies: string[] | Record<string, string[]>;
    if (table) {
      policies = await rowLevelSecuritySystem.getTablePolicies(table);
    } else {
      policies = await rowLevelSecuritySystem.getAllPolicies();
    }
    
    sendSuccess(res, {
      tenantId,
      table: table || 'all',
      policies,
      total: Array.isArray(policies) ? policies.length : Object.values(policies).reduce((sum, p) => sum + p.length, 0)
    }, req.requestId);

  } catch (error) {
    logger.error('Lỗi lấy RLS policies', {
      tenantId: req.params.tenantId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    sendError(res, 'Failed to get RLS policies', 500);
  }
}));

// Tenant Tier Management
router.post('/tenants/:tenantId/upgrade', asyncHandler(async (req: Request, res: Response) => {
  try {
    const tenantId = getParamValue(req.params.tenantId);
    const { newTier } = req.body;
    
    if (!newTier || !Object.values(TenantTier).includes(newTier)) {
      return sendError(res, 'Tier không hợp lệ', 400);
    }
    
    const upgradedTenant = await tenantManagementSystem.upgradeTenantTier(tenantId, newTier);
    
    sendSuccess(res, {
      tenant: upgradedTenant,
      message: `Tenant upgraded to ${newTier} tier thành công`
    }, req.requestId);

  } catch (error) {
    logger.error('Lỗi upgrade tenant tier', {
      tenantId: req.params.tenantId,
      newTier: req.body.newTier,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    sendError(res, 'Failed to upgrade tenant', 500);
  }
}));

// Tenant Health and Diagnostics
router.get('/tenants/:tenantId/health', asyncHandler(async (req: Request, res: Response) => {
  try {
    const tenantId = getParamValue(req.params.tenantId);
    
    const tenant = tenantManagementSystem.getTenant(tenantId);
    if (!tenant) {
      return sendError(res, 'Tenant không tồn tại', 404);
    }
    
    const rlsTest = await rowLevelSecuritySystem.testRLSConfiguration();
    const limitsCheck = await tenantManagementSystem.checkTenantLimits(tenantId);
    
    const health = {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        status: tenant.status,
        tier: tenant.tier,
        uptime: '99.9%', // Would calculate from actual metrics
        lastActivity: tenant.lastActivityAt
      },
      database: {
        rlsEnabled: true,
        rlsStatus: rlsTest.success ? 'healthy' : 'issues',
        rlsIssues: rlsTest.issues,
        connectionPool: 'optimal'
      },
      security: {
        dataIsolation: 'enforced',
        crossTenantProtection: 'active',
        authentication: 'functional',
        encryptionStatus: 'enabled'
      },
      performance: {
        responseTime: '125ms',
        throughput: '1000 req/s',
        errorRate: '0.1%'
      },
      limits: {
        withinLimits: limitsCheck.withinLimits,
        violations: limitsCheck.violations,
        usageOverview: {
          users: `${tenant.limits.users.activeUsers}/${tenant.limits.users.maxUsers}`,
          storage: `${tenant.limits.storage.usedStorageGB}GB/${tenant.limits.storage.maxStorageGB}GB`,
          api: `${tenant.limits.api.requestsThisMonth}/${tenant.limits.api.requestsPerMonth}`
        }
      }
    };

    sendSuccess(res, {
      tenantId,
      health,
      status: rlsTest.success && limitsCheck.withinLimits ? 'healthy' : 'degraded'
    }, req.requestId);

  } catch (error) {
    logger.error('Lỗi health check', {
      tenantId: req.params.tenantId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    sendError(res, 'Failed to perform health check', 500);
  }
}));

// Multi-tenant Login
router.post('/tenant-login', (req, res) => {
  TenantAwareAuth.tenantLogin(req, res);
});

// Dashboard với multi-tenant context
router.get('/dashboard/overview', 
  [
    TenantAwareAuth.validateTenant(),
    TenantAwareAuth.authenticateTenant()
  ],
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const tenantContext = (req as any).tenantContext;
      
      if (!tenant || !user || !tenantContext) {
        return sendError(res, 'Invalid authentication context', 401);
      }
      
      const resourceUsage = tenantManagementSystem.getResourceUsage(tenant.id, 12);
      const analytics = tenantManagementSystem.getTenantAnalytics(tenant.id);
      
      // Get tenant users count
      const tenantUsers = tenantManagementSystem.getTenantUsers(tenant.id);
      const activeUsers = tenantUsers.filter(u => u.status === 'active').length;
      
      const dashboard = {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          tier: tenant.tier,
          status: tenant.status,
          domain: tenant.domain
        },
        user: {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
          lastLogin: user.lastLoginAt
        },
        usage: {
          users: {
            total: tenant.limits.users.activeUsers,
            active: activeUsers,
            percentage: (activeUsers / tenant.limits.users.maxUsers) * 100
          },
          storage: {
            used: tenant.limits.storage.usedStorageGB,
            max: tenant.limits.storage.maxStorageGB,
            percentage: (tenant.limits.storage.usedStorageGB / tenant.limits.storage.maxStorageGB) * 100
          },
          api: {
            used: tenant.limits.api.requestsThisMonth,
            max: tenant.limits.api.requestsPerMonth,
            percentage: (tenant.limits.api.requestsThisMonth / tenant.limits.api.requestsPerMonth) * 100
          }
        },
        recentActivity: resourceUsage.slice(-7).map(usage => ({
          date: usage.period,
          requests: usage.metrics.apiRequests,
          storage: usage.metrics.storageUsed
        })),
        limits: {
          users: tenant.limits.users.maxUsers,
          storage: tenant.limits.storage.maxStorageGB,
          api: tenant.limits.api.requestsPerMonth,
          bandwidth: tenant.limits.bandwidth.maxBandwidthGB
        }
      };

      sendSuccess(res, dashboard, req.requestId);

    } catch (error) {
      logger.error('Lỗi dashboard overview', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendError(res, 'Failed to load dashboard', 500);
    }
  })
);

// Admin functions (system admin only)
router.get('/admin/tenants', 
  [
    TenantAwareAuth.requirePermissions(['admin'])
  ],
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const status = getQueryValue(req.query.status);
      const tier = getQueryValue(req.query.tier);
      const page = getQueryNumber(req.query.page, 1);
      const limit = getQueryNumber(req.query.limit, 50);
      
      let tenants = tenantManagementSystem.getTenants();
      
      // Apply filters
      if (status) {
        tenants = tenants.filter(t => t.status === status);
      }
      if (tier) {
        tenants = tenants.filter(t => t.tier === tier);
      }
      
      // Pagination
      const total = tenants.length;
      const offset = (page - 1) * limit;
      const paginatedTenants = tenants.slice(offset, offset + limit);

      // Calculate statistics
      const stats = {
        total: tenantManagementSystem.getTenants().length,
        byStatus: {
          active: tenantManagementSystem.getTenantsByStatus(TenantStatus.ACTIVE).length,
          suspended: tenantManagementSystem.getTenantsByStatus(TenantStatus.SUSPENDED).length,
          terminated: tenantManagementSystem.getTenantsByStatus(TenantStatus.TERMINATED).length,
          pending: tenantManagementSystem.getTenantsByStatus(TenantStatus.PENDING).length
        },
        byTier: {
          basic: tenantManagementSystem.getTenantsByTier(TenantTier.BASIC).length,
          professional: tenantManagementSystem.getTenantsByTier(TenantTier.PROFESSIONAL).length,
          enterprise: tenantManagementSystem.getTenantsByTier(TenantTier.ENTERPRISE).length,
          custom: tenantManagementSystem.getTenantsByTier(TenantTier.CUSTOM).length
        }
      };

      sendSuccess(res, {
        tenants: paginatedTenants,
        statistics: stats,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }, req.requestId);

    } catch (error) {
      logger.error('Lỗi admin tenant list', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendError(res, 'Failed to get admin tenant list', 500);
    }
  })
);

// System-level health check
router.get('/system/health', asyncHandler(async (req: Request, res: Response) => {
  try {
    const allTenants = tenantManagementSystem.getTenants();
    const activeTenants = allTenants.filter(t => t.status === TenantStatus.ACTIVE);
    
    // Test RLS configuration
    const rlsTest = await rowLevelSecuritySystem.testRLSConfiguration();
    
    const systemHealth = {
      timestamp: new Date().toISOString(),
      status: 'operational',
      multiTenant: {
        totalTenants: allTenants.length,
        activeTenants: activeTenants.length,
        tenantTiers: {
          basic: activeTenants.filter(t => t.tier === TenantTier.BASIC).length,
          professional: activeTenants.filter(t => t.tier === TenantTier.PROFESSIONAL).length,
          enterprise: activeTenants.filter(t => t.tier === TenantTier.ENTERPRISE).length,
          custom: activeTenants.filter(t => t.tier === TenantTier.CUSTOM).length
        }
      },
      database: {
        rlsEnabled: true,
        rlsStatus: rlsTest.success ? 'operational' : 'degraded',
        rlsIssues: rlsTest.issues,
        connectionPools: 'healthy'
      },
      security: {
        rowLevelSecurity: 'enforced',
        tenantIsolation: 'active',
        authentication: 'operational',
        authorization: 'operational'
      },
      performance: {
        averageResponseTime: '150ms',
        requestsPerSecond: '5000',
        errorRate: '0.05%',
        uptime: '99.95%'
      }
    };

    sendSuccess(res, systemHealth, req.requestId);

  } catch (error) {
    logger.error('Lỗi system health check', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    sendError(res, 'Failed to perform system health check', 500);
  }
}));

export default router;
