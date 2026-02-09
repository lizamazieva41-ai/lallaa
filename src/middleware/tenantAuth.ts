import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { logger } from '@/utils/logger';
import { sendError } from '@/utils/response';
import { 
  TenantContext, Tenant, TenantUser, MultiTenantRequest,
  TenantError, IsolationLevel, DataAccessLevel,
  TenantTier, TenantStatus
} from '@/security/multiTenantArchitecture';
import { tenantManagementSystem } from '@/security/tenantManagement';
import { RowLevelSecuritySystem } from '@/security/rowLevelSecuritySimple';

// Tenant-Aware Authentication Middleware
class TenantAwareAuthImpl {

  // Middleware để validate tenant context
  validateTenant() {
    return async (req: MultiTenantRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantId = this.extractTenantId(req);
        
        if (!tenantId) {
          sendError(res, 'Tenant ID là bắt buộc', 400);
          return;
        }

        const tenant = await tenantManagementSystem.getTenant(tenantId);
        
        if (!tenant) {
          sendError(res, 'Tenant không tồn tại', 404);
          return;
        }

        if (tenant.status !== TenantStatus.ACTIVE) {
          sendError(res, `Tenant không active. Status: ${tenant.status}`, 403);
          return;
        }

        // Store tenant context
        req.tenant = tenant;
        req.tenantContext = {
          tenantId,
          userId: '', // Will be set later
          role: '',
          permissions: [],
          dataAccessLevel: DataAccessLevel.OWN_DATA,
          isolationLevel: this.determineIsolationLevel(tenant),
          timestamp: new Date().toISOString()
        };

        // Apply database RLS context
        if (tenant.status === TenantStatus.ACTIVE) {
          // We'll apply RLS when we have user context
          logger.debug('Tenant validated', { tenantId, tier: tenant.tier });
        }

        next();

      } catch (error) {
        logger.error('Lỗi validating tenant', {
          error: error instanceof Error ? error.message : 'Unknown error',
          tenantId: req.headers['x-tenant-id']
        });
        sendError(res, 'Internal server error', 500);
      }
    };
  }

  // Middleware để authenticate user trong tenant context
  authenticateTenant() {
    return async (req: MultiTenantRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const token = this.extractToken(req);
        
        if (!token) {
          sendError(res, 'Authentication token là bắt buộc', 401);
          return;
        }

        const payload = this.verifyToken(token);
        if (!payload) {
          sendError(res, 'Invalid hoặc expired token', 401);
          return;
        }

        // Validate user exists trong tenant
        const tenantUsers = tenantManagementSystem.getTenantUsers(payload.tenantId);
        const user = tenantUsers.find(u => u.id === payload.userId);

        if (!user || user.status !== 'active') {
          sendError(res, 'User không active hoặc không tồn tại', 401);
          return;
        }

        // Validate user matches tenant context
        if (req.tenant && req.tenant.id !== payload.tenantId) {
          sendError(res, 'User không thuộc tenant này', 403);
          return;
        }

        // Store user context
        req.user = user;
        if (req.tenantContext) {
          req.tenantContext.userId = payload.userId;
          req.tenantContext.role = user.role;
          req.tenantContext.permissions = user.permissions;
          req.tenantContext.dataAccessLevel = this.determineDataAccessLevel(user.role, user.permissions);
        }

        // Apply RLS context cho database
        if (req.tenant) {
          // Note: RLS will be applied at database level
          logger.debug('User authenticated within tenant context', {
            tenantId: req.tenant.id,
            userId: user.id
          });
        }

        // Log successful authentication
        logger.info('Tenant user authenticated', {
          tenantId: payload.tenantId,
          userId: payload.userId,
          role: user.role,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        next();

      } catch (error) {
        logger.error('Lỗi authenticating tenant user', {
          error: error instanceof Error ? error.message : 'Unknown error',
          token: this.extractToken(req)?.substring(0, 20)
        });
        sendError(res, 'Authentication failed', 401);
      }
    };
  }

  // Combined middleware cho tenant validation + authentication
  tenantAuth() {
    return [
      this.validateTenant(),
      this.authenticateTenant()
    ];
  }

  // Middleware để check permissions
  requirePermissions(permissions: string[]) {
    return (req: MultiTenantRequest, res: Response, next: NextFunction): void => {
      if (!req.tenantContext) {
        sendError(res, 'Tenant context không tồn tại', 401);
        return;
      }

      const userPermissions = req.tenantContext.permissions;
      const hasAllPermissions = permissions.every(permission => 
        userPermissions.includes(permission) || userPermissions.includes('admin')
      );

      if (!hasAllPermissions) {
        sendError(res, 'Insufficient permissions', 403);
        return;
      }

      next();
    };
  }

  // Middleware để check data access level
  requireDataAccessLevel(minLevel: DataAccessLevel) {
    return (req: MultiTenantRequest, res: Response, next: NextFunction): void => {
      if (!req.tenantContext) {
        sendError(res, 'Tenant context không tồn tại', 401);
        return;
      }

      const userLevel = req.tenantContext.dataAccessLevel;
      
      if (!this.isDataAccessLevelSufficient(userLevel, minLevel)) {
        sendError(res, 'Insufficient data access level', 403);
        return;
      }

      next();
    };
  }

  // Middleware để check tenant tier
  requireTier(minTier: TenantTier) {
    return (req: MultiTenantRequest, res: Response, next: NextFunction): void => {
      if (!req.tenant) {
        sendError(res, 'Tenant context không tồn tại', 401);
        return;
      }

      const tenantTier = req.tenant.tier;
      
      if (!this.isTierSufficient(tenantTier, minTier)) {
        sendError(res, 'Tenant tier không đủ', 403);
        return;
      }

      next();
    };
  }

  // Cross-tenant access control
  preventCrossTenantAccess() {
    return (req: MultiTenantRequest, res: Response, next: NextFunction): void => {
      if (!req.tenantContext) {
        sendError(res, 'Tenant context không tồn tại', 401);
        return;
      }

      // Check for cross-tenant access attempts
      const queryTenantId = req.query.tenant_id as string;
      const bodyTenantId = req.body.tenant_id;

      if (queryTenantId && queryTenantId !== req.tenantContext.tenantId) {
        logger.warn('Cross-tenant access attempt detected', {
          userTenantId: req.tenantContext.tenantId,
          attemptedTenantId: queryTenantId,
          userId: req.tenantContext.userId,
          ip: req.ip
        });
        sendError(res, 'Cross-tenant access không được phép', 403);
        return;
      }

      if (bodyTenantId && bodyTenantId !== req.tenantContext.tenantId) {
        logger.warn('Cross-tenant access attempt detected in body', {
          userTenantId: req.tenantContext.tenantId,
          attemptedTenantId: bodyTenantId,
          userId: req.tenantContext.userId,
          ip: req.ip
        });
        sendError(res, 'Cross-tenant access không được phép', 403);
        return;
      }

      next();
    };
  }

  // Tenant-aware login
  async tenantLogin(req: Request, res: Response): Promise<any> {
    try {
      const { email, password, tenantSlug } = req.body;

      if (!email || !password || !tenantSlug) {
        sendError(res, 'Email, password, và tenant slug là bắt buộc', 400);
        return;
      }

      // Find tenant by slug
      const tenants = tenantManagementSystem.getTenants();
      const tenant = tenants.find(t => t.slug === tenantSlug || t.subdomain === tenantSlug);

      if (!tenant) {
        sendError(res, 'Tenant không tồn tại', 404);
        return;
      }

      if (tenant.status !== TenantStatus.ACTIVE) {
        sendError(res, 'Tenant không active', 403);
        return;
      }

      // Find user trong tenant
      const tenantUsers = tenantManagementSystem.getTenantUsers(tenant.id);
      const user = tenantUsers.find(u => u.email === email);

      if (!user || user.status !== 'active') {
        sendError(res, 'Invalid credentials', 401);
        return;
      }

      // Verify password (assuming password hash is stored securely)
      const isPasswordValid = true; // Simplified for demo - implement proper password verification
      if (!isPasswordValid) {
        // Log failed login attempt
        logger.warn('Failed tenant login', {
          tenantId: tenant.id,
          email,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        sendError(res, 'Invalid credentials', 401);
        return;
      }

      // Generate tokens
      const tokens = this.generateTokens(user, tenant);

      // Update last login
      user.lastLoginAt = new Date().toISOString();

      logger.info('Tenant user login successful', {
        tenantId: tenant.id,
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      return {
        success: true,
        tokens,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          permissions: user.permissions
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          tier: tenant.tier
        }
      };

    } catch (error) {
      logger.error('Lỗi tenant login', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email: req.body.email
      });
      sendError(res, 'Login failed', 500);
    }
  }

  // Helper methods
  private extractTenantId(req: Request): string | null {
    return (
      req.headers['x-tenant-id'] as string ||
      req.headers['x-tenant-slug'] as string ||
      (req as any).tenant?.id ||
      req.query.tenant_id as string ||
      req.body.tenant_id
    );
  }

  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return req.query.token as string || req.body.token;
  }

  private verifyToken(token: string): any {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      return null;
    }
  }

  private generateTokens(user: TenantUser, tenant: Tenant): { accessToken: string; refreshToken: string } {
    const accessTokenPayload = {
      userId: user.id,
      tenantId: tenant.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
    };

    const refreshTokenPayload = {
      userId: user.id,
      tenantId: tenant.id,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    };

    return {
      accessToken: jwt.sign(accessTokenPayload, process.env.JWT_SECRET || 'your-secret-key'),
      refreshToken: jwt.sign(refreshTokenPayload, process.env.JWT_REFRESH_SECRET || 'your-refresh-secret')
    };
  }

  private determineIsolationLevel(tenant: Tenant): IsolationLevel {
    switch (tenant.tier) {
      case TenantTier.BASIC:
        return IsolationLevel.ROW_LEVEL;
      case TenantTier.PROFESSIONAL:
        return IsolationLevel.SCHEMA;
      case TenantTier.ENTERPRISE:
        return IsolationLevel.COMPLETE;
      case TenantTier.CUSTOM:
        return IsolationLevel.COMPLETE;
      default:
        return IsolationLevel.ROW_LEVEL;
    }
  }

  private determineDataAccessLevel(role: string, permissions: string[]): DataAccessLevel {
    if (permissions.includes('admin') || permissions.includes('system_admin')) {
      return DataAccessLevel.SYSTEM_DATA;
    }
    if (permissions.includes('tenant_admin')) {
      return DataAccessLevel.TENANT_DATA;
    }
    if (permissions.includes('team_lead')) {
      return DataAccessLevel.SHARED_DATA;
    }
    return DataAccessLevel.OWN_DATA;
  }

  private isDataAccessLevelSufficient(userLevel: DataAccessLevel, requiredLevel: DataAccessLevel): boolean {
    const levels = [DataAccessLevel.OWN_DATA, DataAccessLevel.SHARED_DATA, DataAccessLevel.TENANT_DATA, DataAccessLevel.SYSTEM_DATA];
    const userIndex = levels.indexOf(userLevel);
    const requiredIndex = levels.indexOf(requiredLevel);
    return userIndex >= requiredIndex;
  }

  private isTierSufficient(currentTier: TenantTier, requiredTier: TenantTier): boolean {
    const tiers = [TenantTier.BASIC, TenantTier.PROFESSIONAL, TenantTier.ENTERPRISE, TenantTier.CUSTOM];
    const currentIndex = tiers.indexOf(currentTier);
    const requiredIndex = tiers.indexOf(requiredTier);
    return currentIndex >= requiredIndex;
  }

  // Rate limiting per tenant
  tenantRateLimit(options: {
    windowMs: number;
    maxRequests: number;
    message?: string;
  }) {
    const requests = new Map<string, { count: number; resetTime: number }>();

    return (req: MultiTenantRequest, res: Response, next: NextFunction): void => {
      if (!req.tenantContext) {
        next();
        return;
      }

      const tenantId = req.tenantContext.tenantId;
      const now = Date.now();
      const windowStart = now - options.windowMs;

      // Cleanup old entries
      for (const [key, data] of requests.entries()) {
        if (data.resetTime < now) {
          requests.delete(key);
        }
      }

      // Get current tenant request count
      const tenantRequests = requests.get(tenantId) || { count: 0, resetTime: now + options.windowMs };
      
      if (now > tenantRequests.resetTime) {
        // Reset window
        tenantRequests.count = 1;
        tenantRequests.resetTime = now + options.windowMs;
      } else {
        tenantRequests.count++;
      }

      requests.set(tenantId, tenantRequests);

      // Check limit
      if (tenantRequests.count > options.maxRequests) {
        logger.warn('Tenant rate limit exceeded', {
          tenantId,
          count: tenantRequests.count,
          limit: options.maxRequests
        });
        
        sendError(res, options.message || 'Rate limit exceeded', 429);
        return;
      }

      next();
    };
  }
}

export const TenantAwareAuth = new TenantAwareAuthImpl();