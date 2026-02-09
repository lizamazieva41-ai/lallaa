import { logger } from '@/utils/logger';
import { 
  Tenant, TenantTier, TenantStatus, TenantSettings, TenantLimits, 
  TenantConfiguration, TenantUser, MultiTenantError, TenantError,
  TenantContext, IsolationLevel, DataAccessLevel,
  TenantResourceUsage, TenantAnalytics, TenantDatabaseConfig 
} from '@/security/multiTenantArchitecture';

// Tenant Management System - Quản lý Multi-tenant
export class TenantManagementSystem {
  private tenants: Map<string, Tenant> = new Map();
  private users: Map<string, TenantUser[]> = new Map();
  private contexts: Map<string, TenantContext> = new Map();
  private resourceUsage: Map<string, TenantResourceUsage[]> = new Map();
  private analytics: Map<string, TenantAnalytics[]> = new Map();

  constructor() {
    this.initializeDefaultTenants();
    this.startResourceMonitoring();
  }

  private initializeDefaultTenants(): void {
    // Tạo tenant mẫu
    const defaultTenants: Tenant[] = [
      {
        id: 'tenant_main',
        name: 'Main Banking Platform',
        slug: 'main',
        tier: TenantTier.ENTERPRISE,
        status: TenantStatus.ACTIVE,
        domain: 'api.bankplatform.com',
        subdomain: 'main',
        settings: {
          timezone: 'Asia/Ho_Chi_Minh',
          locale: 'vi-VN',
          currency: 'VND',
          dateFormat: 'DD/MM/YYYY',
          numberFormat: '#,##0.00',
          securitySettings: {
            passwordPolicy: {
              minLength: 12,
              requireUppercase: true,
              requireLowercase: true,
              requireNumbers: true,
              requireSpecialChars: true,
              passwordHistory: 5,
              maxLoginAttempts: 5,
              lockoutDuration: 1800
            },
            sessionSettings: {
              maxDuration: 86400,
              idleTimeout: 3600,
              concurrentSessions: 3,
              requireReauth: true
            },
            apiSettings: {
              rateLimitPerMinute: 1000,
              rateLimitPerHour: 50000,
              ipWhitelist: [],
              corsOrigins: ['*'],
              allowedScopes: ['read', 'write', 'admin']
            },
            dataSettings: {
              allowDataExport: true,
              allowDataSharing: false,
              dataRetentionDays: 2555,
              encryptionRequired: true,
              auditLogEnabled: true
            }
          },
          notificationSettings: {
            email: {
              enabled: true,
              fromAddress: 'noreply@bankplatform.com',
              templates: {
                welcome: true,
                passwordReset: true,
                securityAlert: true,
                monthlyReport: true
              }
            },
            sms: {
              enabled: true,
              provider: 'twilio',
              templates: {
                verification: true,
                securityAlert: true
              }
            },
            webhook: {
              enabled: true,
              urls: [
                {
                  id: 'security_webhook',
                  url: 'https://webhook.bankplatform.com/security',
                  events: ['security_alert', 'login_attempt', 'data_access'],
                  active: true,
                  retryCount: 0
                }
              ],
              events: ['security_alert', 'login_attempt', 'data_access'],
              retryPolicy: {
                maxRetries: 3,
                backoffMultiplier: 2
              }
            }
          },
          integrationSettings: {
            sso: {
              enabled: true,
              provider: 'saml',
              configuration: {
                entityId: 'urn:bankplatform:saml:idp',
                ssoUrl: 'https://sso.bankplatform.com/saml',
                certificate: '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'
              }
            },
            crm: {
              enabled: false,
              provider: 'salesforce'
            },
            payments: {
              enabled: true,
              provider: 'stripe',
              webhookSecret: 'whsec_...'
            },
            analytics: {
              enabled: true,
              provider: 'google-analytics',
              trackingId: 'GA-XXXXXXXXX'
            }
          },
          branding: {
            logo: 'https://cdn.bankplatform.com/logo-main.png',
            primaryColor: '#1e40af',
            secondaryColor: '#60a5fa',
            fontFamily: 'Inter, sans-serif',
            companyName: 'Main Banking Platform',
            tagline: 'Secure Payment Processing'
          }
        },
        limits: {
          users: {
            maxUsers: 10000,
            activeUsers: 234
          },
          storage: {
            maxStorageGB: 1000,
            usedStorageGB: 156.7
          },
          api: {
            requestsPerMonth: 10000000,
            requestsThisMonth: 567890
          },
          features: {
            maxBinLookups: 10000000,
            maxIbanValidations: 5000000,
            maxCardGenerations: 1000000,
            customRules: 100,
            mlModels: 10
          },
          bandwidth: {
            maxBandwidthGB: 5000,
            usedBandwidthGB: 1234.5
          }
        },
        configuration: {
          rlsPolicies: [
            {
              id: 'tenant_isolation_policy',
              name: 'Tenant Data Isolation',
              description: 'Ensures users can only access their tenant data',
              tableName: 'all',
              enabled: true,
              priority: 1,
              conditions: [
                {
                  field: 'tenant_id',
                  operator: 'eq',
                  value: 'CURRENT_TENANT',
                  valueType: 'string',
                  caseSensitive: false
                }
              ],
              action: {
                type: 'restrict',
                restrictions: [
                  {
                    field: '*',
                    operation: 'read',
                    filter: 'tenant_id = CURRENT_TENANT'
                  },
                  {
                    field: '*',
                    operation: 'write',
                    filter: 'tenant_id = CURRENT_TENANT'
                  }
                ]
              },
              exceptions: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ],
          customFields: [],
          workflows: [],
          permissions: [],
          integrations: [],
          compliance: [
            {
              framework: 'PCI_DSS',
              enabled: true,
              requirements: [
                {
                  id: 'pci_dss_1',
                  name: 'Install and maintain a firewall configuration',
                  description: 'Firewall must be installed and maintained',
                  mandatory: true,
                  enabled: true,
                  configuration: {},
                  status: 'compliant'
                },
                {
                  id: 'pci_dss_2',
                  name: 'Do not use vendor-supplied defaults',
                  description: 'Change default passwords and configurations',
                  mandatory: true,
                  enabled: true,
                  configuration: {},
                  status: 'compliant'
                }
              ]
            }
          ]
        },
        metadata: {
          industry: 'Banking & Financial Services',
          companySize: 'Enterprise',
          location: {
            country: 'Vietnam',
            region: 'Ho Chi Minh City',
            timezone: 'Asia/Ho_Chi_Minh'
          },
          compliance: ['PCI-DSS', 'GDPR', 'SOX'],
          technicalContact: {
            name: 'Security Team',
            email: 'security@bankplatform.com',
            phone: '+84-28-1234-5678'
          },
          billingContact: {
            name: 'Billing Department',
            email: 'billing@bankplatform.com',
            address: '123 Nguyen Hue, District 1, HCMC, Vietnam'
          },
          tags: ['enterprise', 'banking', 'financial', 'pci-compliant'],
          notes: 'Main tenant for banking platform operations'
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString()
      }
    ];

    defaultTenants.forEach(tenant => {
      this.tenants.set(tenant.id, tenant);
    });

    logger.info('Khởi tạo tenant management system', {
      totalTenants: defaultTenants.length,
      activeTenants: defaultTenants.filter(t => t.status === TenantStatus.ACTIVE).length
    });
  }

  // Tenant CRUD Operations
  async createTenant(tenantData: Partial<Tenant>): Promise<Tenant> {
    const tenantId = `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const newTenant: Tenant = {
      id: tenantId,
      name: tenantData.name || 'New Tenant',
      slug: tenantData.slug || tenantId,
      tier: tenantData.tier || TenantTier.BASIC,
      status: TenantStatus.PENDING,
      settings: {
        timezone: 'Asia/Ho_Chi_Minh',
        locale: 'vi-VN',
        currency: 'VND',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: '#,##0.00',
        securitySettings: {
          passwordPolicy: {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: false,
            passwordHistory: 3,
            maxLoginAttempts: 5,
            lockoutDuration: 900
          },
          sessionSettings: {
            maxDuration: 3600,
            idleTimeout: 1800,
            concurrentSessions: 1,
            requireReauth: false
          },
          apiSettings: {
            rateLimitPerMinute: 60,
            rateLimitPerHour: 1000,
            ipWhitelist: [],
            corsOrigins: ['*'],
            allowedScopes: ['read']
          },
          dataSettings: {
            allowDataExport: false,
            allowDataSharing: false,
            dataRetentionDays: 365,
            encryptionRequired: true,
            auditLogEnabled: true
          }
        },
        notificationSettings: {
          email: {
            enabled: true,
            templates: {
              welcome: true,
              passwordReset: true,
              securityAlert: false,
              monthlyReport: false
            }
          },
          sms: {
            enabled: false,
            templates: {
              verification: false,
              securityAlert: false
            }
          },
          webhook: {
            enabled: false,
            urls: [],
            events: [],
            retryPolicy: {
              maxRetries: 3,
              backoffMultiplier: 2
            }
          }
        },
        integrationSettings: {
          sso: {
            enabled: false,
            provider: 'saml',
            configuration: {}
          },
          crm: {
            enabled: false,
            provider: ''
          },
          payments: {
            enabled: false,
            provider: ''
          },
          analytics: {
            enabled: false,
            provider: ''
          }
        },
        branding: {
          companyName: tenantData.name || 'New Tenant'
        }
      },
      limits: {
        users: {
          maxUsers: this.getDefaultTierLimits(tenantData.tier || TenantTier.BASIC).maxUsers,
          activeUsers: 0
        },
        storage: {
          maxStorageGB: this.getDefaultTierLimits(tenantData.tier || TenantTier.BASIC).maxStorageGB,
          usedStorageGB: 0
        },
        api: {
          requestsPerMonth: this.getDefaultTierLimits(tenantData.tier || TenantTier.BASIC).maxApiRequests,
          requestsThisMonth: 0
        },
        features: {
          maxBinLookups: this.getDefaultTierLimits(tenantData.tier || TenantTier.BASIC).maxBinLookups,
          maxIbanValidations: this.getDefaultTierLimits(tenantData.tier || TenantTier.BASIC).maxIbanValidations,
          maxCardGenerations: 0,
          customRules: 0,
          mlModels: 0
        },
        bandwidth: {
          maxBandwidthGB: this.getDefaultTierLimits(tenantData.tier || TenantTier.BASIC).maxBandwidthGB,
          usedBandwidthGB: 0
        }
      },
      configuration: {
        rlsPolicies: [],
        customFields: [],
        workflows: [],
        permissions: [],
        integrations: [],
        compliance: []
      },
      metadata: {
        industry: 'General',
        companySize: 'Small',
        location: {
          country: 'Vietnam',
          region: 'Ho Chi Minh City',
          timezone: 'Asia/Ho_Chi_Minh'
        },
        compliance: [],
        technicalContact: {
          name: '',
          email: '',
          phone: ''
        },
        billingContact: {
          name: '',
          email: '',
          address: ''
        },
        tags: [],
        notes: ''
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString()
    };

    this.tenants.set(tenantId, newTenant);

    // Initialize tenant database
    await this.initializeTenantDatabase(newTenant);

    logger.info('Đã tạo tenant mới', {
      tenantId,
      name: newTenant.name,
      tier: newTenant.tier
    });

    return newTenant;
  }

  async updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant> {
    const existingTenant = this.tenants.get(tenantId);
    if (!existingTenant) {
      throw new MultiTenantError(
        TenantError.TENANT_NOT_FOUND,
        `Tenant ${tenantId} không tồn tại`,
        tenantId
      );
    }

    if (existingTenant.status === TenantStatus.TERMINATED) {
      throw new MultiTenantError(
        TenantError.TENANT_SUSPENDED,
        `Tenant ${tenantId} đã bị terminated`,
        tenantId
      );
    }

    const updatedTenant: Tenant = {
      ...existingTenant,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.tenants.set(tenantId, updatedTenant);

    // Apply database changes if needed
    if (updates.settings || updates.configuration) {
      await this.updateTenantDatabase(updatedTenant);
    }

    logger.info('Đã cập nhật tenant', {
      tenantId,
      updatedFields: Object.keys(updates)
    });

    return updatedTenant;
  }

  async deleteTenant(tenantId: string): Promise<boolean> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      return false;
    }

    // Soft delete - mark as terminated
    const terminatedTenant = {
      ...tenant,
      status: TenantStatus.TERMINATED,
      updatedAt: new Date().toISOString()
    };

    this.tenants.set(tenantId, terminatedTenant);

    // Archive data
    await this.archiveTenantData(tenantId);

    logger.info('Đã xóa tenant', { tenantId, name: tenant.name });

    return true;
  }

  // User Management within Tenants
  async createTenantUser(tenantId: string, userData: Partial<TenantUser>): Promise<TenantUser> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new MultiTenantError(
        TenantError.TENANT_NOT_FOUND,
        `Tenant ${tenantId} không tồn tại`,
        tenantId
      );
    }

    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const newUser: TenantUser = {
      id: userId,
      tenantId,
      email: userData.email || '',
      username: userData.username || '',
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      role: userData.role || 'user',
      permissions: userData.permissions || ['read'],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      profile: userData.profile || {
        timezone: 'Asia/Ho_Chi_Minh',
        language: 'vi-VN'
      },
      settings: userData.settings || {
        emailNotifications: true,
        smsNotifications: false,
        twoFactorEnabled: false,
        theme: 'auto',
        timezone: 'Asia/Ho_Chi_Minh',
        language: 'vi-VN',
        customSettings: {}
      }
    };

    const tenantUsers = this.users.get(tenantId) || [];
    tenantUsers.push(newUser);
    this.users.set(tenantId, tenantUsers);

    // Update active user count
    if (tenant.limits) {
      tenant.limits.users.activeUsers++;
      tenant.lastActivityAt = new Date().toISOString();
      this.tenants.set(tenantId, tenant);
    }

    logger.info('Đã tạo user cho tenant', {
      userId,
      tenantId,
      email: newUser.email,
      role: newUser.role
    });

    return newUser;
  }

  // Tenant Context Management
  async createTenantContext(tenantId: string, userId: string): Promise<TenantContext> {
    const tenant = this.tenants.get(tenantId);
    const tenantUsers = this.users.get(tenantId) || [];
    const user = tenantUsers.find(u => u.id === userId);

    if (!tenant) {
      throw new MultiTenantError(
        TenantError.TENANT_NOT_FOUND,
        `Tenant ${tenantId} không tồn tại`,
        tenantId,
        userId
      );
    }

    if (tenant.status !== TenantStatus.ACTIVE) {
      throw new MultiTenantError(
        TenantError.TENANT_SUSPENDED,
        `Tenant ${tenantId} không active`,
        tenantId,
        userId
      );
    }

    if (!user || user.status !== 'active') {
      throw new MultiTenantError(
        TenantError.INSUFFICIENT_PERMISSIONS,
        `User ${userId} không có quyền truy cập`,
        tenantId,
        userId
      );
    }

    const context: TenantContext = {
      tenantId,
      userId,
      role: user.role,
      permissions: user.permissions,
      dataAccessLevel: this.determineDataAccessLevel(user.role, user.permissions),
      isolationLevel: this.determineIsolationLevel(tenant),
      timestamp: new Date().toISOString()
    };

    this.contexts.set(`${tenantId}:${userId}`, context);

    // Update last activity
    user.lastLoginAt = new Date().toISOString();
    tenant.lastActivityAt = new Date().toISOString();
    this.users.set(tenantId, tenantUsers);
    this.tenants.set(tenantId, tenant);

    logger.info('Đã tạo tenant context', {
      tenantId,
      userId,
      role: user.role,
      dataAccessLevel: context.dataAccessLevel
    });

    return context;
  }

  // Resource Usage Tracking
  async updateResourceUsage(tenantId: string, metrics: Partial<TenantResourceUsage['metrics']>): Promise<void> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return;

    const currentUsage = this.resourceUsage.get(tenantId) || [];
    const usage: TenantResourceUsage = {
      tenantId,
      period: new Date().toISOString().substring(0, 7), // YYYY-MM
      metrics: {
        apiRequests: 0,
        storageUsed: 0,
        bandwidthUsed: 0,
        activeUsers: 0,
        dataQueries: 0,
        failedLogins: 0,
        securityEvents: 0,
        ...metrics
      },
      timestamp: new Date().toISOString()
    };

    currentUsage.push(usage);
    this.resourceUsage.set(tenantId, currentUsage);

    // Update tenant limits
    if (metrics.apiRequests) {
      tenant.limits.api.requestsThisMonth += metrics.apiRequests;
    }

    this.tenants.set(tenantId, tenant);

    logger.debug('Đã cập nhật resource usage', {
      tenantId,
      metrics: Object.keys(metrics)
    });
  }

  // Tier Management
  async upgradeTenantTier(tenantId: string, newTier: TenantTier): Promise<Tenant> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new MultiTenantError(
        TenantError.TENANT_NOT_FOUND,
        `Tenant ${tenantId} không tồn tại`,
        tenantId
      );
    }

    const newLimits = this.getDefaultTierLimits(newTier);
    
    const updatedTenant: Tenant = {
      ...tenant,
      tier: newTier,
      limits: {
        ...tenant.limits,
        ...newLimits
      },
      updatedAt: new Date().toISOString()
    };

    this.tenants.set(tenantId, updatedTenant);

    logger.info('Đã nâng cấp tenant tier', {
      tenantId,
      oldTier: tenant.tier,
      newTier,
      newLimits
    });

    return updatedTenant;
  }

  private getDefaultTierLimits(tier: TenantTier): any {
    const limits = {
      [TenantTier.BASIC]: {
        maxUsers: 10,
        maxStorageGB: 10,
        maxApiRequests: 100000,
        maxBandwidthGB: 100,
        maxBinLookups: 10000,
        maxIbanValidations: 5000,
        maxCardGenerations: 0,
        customRules: 5,
        mlModels: 0
      },
      [TenantTier.PROFESSIONAL]: {
        maxUsers: 100,
        maxStorageGB: 100,
        maxApiRequests: 1000000,
        maxBandwidthGB: 1000,
        maxBinLookups: 1000000,
        maxIbanValidations: 500000,
        maxCardGenerations: 100,
        customRules: 20,
        mlModels: 2
      },
      [TenantTier.ENTERPRISE]: {
        maxUsers: 10000,
        maxStorageGB: 1000,
        maxApiRequests: 10000000,
        maxBandwidthGB: 10000,
        maxBinLookups: 10000000,
        maxIbanValidations: 5000000,
        maxCardGenerations: 1000,
        customRules: 100,
        mlModels: 10
      },
      [TenantTier.CUSTOM]: {
        maxUsers: 100000,
        maxStorageGB: 10000,
        maxApiRequests: 100000000,
        maxBandwidthGB: 100000,
        maxBinLookups: 100000000,
        maxIbanValidations: 50000000,
        maxCardGenerations: 10000,
        customRules: 1000,
        mlModels: 100
      }
    };

    return limits[tier] || limits[TenantTier.BASIC];
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

  // Database Operations
  private async initializeTenantDatabase(tenant: Tenant): Promise<void> {
    // TODO: Implement actual database initialization
    // Create tenant-specific schema, tables, indexes
    // Apply RLS policies
    // Set up tenant-specific configurations

    logger.info('Khởi tạo tenant database', {
      tenantId: tenant.id,
      tier: tenant.tier,
      isolationLevel: this.determineIsolationLevel(tenant)
    });
  }

  private async updateTenantDatabase(tenant: Tenant): Promise<void> {
    // TODO: Implement database updates
    // Update tenant schema, modify RLS policies
    // Apply configuration changes

    logger.info('Cập nhật tenant database', {
      tenantId: tenant.id,
      updatedFields: ['settings', 'configuration']
    });
  }

  private async archiveTenantData(tenantId: string): Promise<void> {
    // TODO: Implement data archiving
    // Move tenant data to archive storage
    // Create backup before deletion
    // Update billing records

    logger.info('Archive tenant data', { tenantId });
  }

  // Monitoring and Analytics
  private startResourceMonitoring(): void {
    const monitoringTimer = setInterval(() => {
      this.collectResourceMetrics();
    }, 60000); // Every minute
    monitoringTimer.unref?.();
  }

  private async collectResourceMetrics(): Promise<void> {
    for (const [tenantId, tenant] of this.tenants.entries()) {
      if (tenant.status !== TenantStatus.ACTIVE) continue;

      // Collect actual usage metrics
      // This would integrate with actual system metrics
      const metrics = {
        apiRequests: Math.floor(Math.random() * 1000),
        storageUsed: Math.random() * 100,
        bandwidthUsed: Math.random() * 10,
        activeUsers: this.users.get(tenantId)?.filter(u => u.status === 'active').length || 0,
        dataQueries: Math.floor(Math.random() * 500),
        failedLogins: Math.floor(Math.random() * 5),
        securityEvents: Math.floor(Math.random() * 2)
      };

      await this.updateResourceUsage(tenantId, metrics);
    }
  }

  // Public API Methods
  getTenant(tenantId: string): Tenant | null {
    return this.tenants.get(tenantId) || null;
  }

  getTenants(): Tenant[] {
    return Array.from(this.tenants.values());
  }

  getTenantsByTier(tier: TenantTier): Tenant[] {
    return Array.from(this.tenants.values()).filter(t => t.tier === tier);
  }

  getTenantsByStatus(status: TenantStatus): Tenant[] {
    return Array.from(this.tenants.values()).filter(t => t.status === status);
  }

  getTenantUsers(tenantId: string): TenantUser[] {
    return this.users.get(tenantId) || [];
  }

  getTenantContext(tenantId: string, userId: string): TenantContext | null {
    return this.contexts.get(`${tenantId}:${userId}`) || null;
  }

  getResourceUsage(tenantId: string, limit: number = 12): TenantResourceUsage[] {
    const usage = this.resourceUsage.get(tenantId) || [];
    return usage.slice(-limit); // Last N periods
  }

  getTenantAnalytics(tenantId: string): TenantAnalytics | null {
    const analytics = this.analytics.get(tenantId);
    return analytics ? analytics[analytics.length - 1] : null;
  }

  async checkTenantLimits(tenantId: string): Promise<{ withinLimits: boolean; violations: string[] }> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      return { withinLimits: false, violations: ['Tenant not found'] };
    }

    const violations: string[] = [];
    const limits = tenant.limits;

    // Check user limits
    if (limits.users.activeUsers >= limits.users.maxUsers) {
      violations.push('User limit exceeded');
    }

    // Check storage limits
    if (limits.storage.usedStorageGB >= limits.storage.maxStorageGB) {
      violations.push('Storage limit exceeded');
    }

    // Check API limits
    if (limits.api.requestsThisMonth >= limits.api.requestsPerMonth) {
      violations.push('API request limit exceeded');
    }

    return {
      withinLimits: violations.length === 0,
      violations
    };
  }
}

// Singleton instance
export const tenantManagementSystem = new TenantManagementSystem();
