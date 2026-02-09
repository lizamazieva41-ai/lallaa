import { Pool } from 'pg';
import { logger } from '@/utils/logger';

// Simplified Row Level Security for Multi-tenant Database
class RowLevelSecuritySystemImpl {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // Apply tenant context cho database connection
  async applyTenantContext(tenantId: string, userId: string): Promise<void> {
    try {
      // Set PostgreSQL session variables cho RLS
      await this.pool.query(`
        SELECT set_config('app.current_tenant_id', $1, true);
        SELECT set_config('app.current_user_id', $2, true);
        SELECT set_config('app.current_user_role', $3, true);
      `, [tenantId, userId, 'user']);

      // Enable RLS cho các table
      const tables = ['users', 'financial_transactions', 'payment_cards', 'bin_records', 'iban_records', 'audit_logs'];
      for (const table of tables) {
        await this.pool.query(`ALTER TABLE IF EXISTS ${table} ENABLE ROW LEVEL SECURITY;`);
        
        // Apply basic tenant isolation policy
        await this.pool.query(`
          DROP POLICY IF EXISTS ${table}_tenant_isolation_policy ON ${table};
          CREATE POLICY ${table}_tenant_isolation_policy ON ${table}
          FOR ALL
          TO authenticated_user
          USING (tenant_id = current_setting('app.current_tenant_id'))
          WITH CHECK (tenant_id = current_setting('app.current_tenant_id'));
        `);
      }

      logger.info('Đã áp dụng tenant context và RLS', {
        tenantId,
        userId,
        tablesEnabled: tables.length
      });

    } catch (error) {
      logger.error('Lỗi áp dụng tenant context', {
        tenantId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Query execution với RLS enforcement
  async executeQuery<R = any>(
    query: string,
    params: any[] = [],
    tenantId?: string,
    userId?: string,
    options: {
      bypassRLS?: boolean;
      includeSystemData?: boolean;
      auditQuery?: boolean;
    } = {}
  ): Promise<R[]> {
    let client;
    
    try {
      client = await this.pool.connect();

      // Set tenant context nếu được cung cấp
      if (tenantId && userId && !options.bypassRLS) {
        await client.query(`
          SET LOCAL app.current_tenant_id = $1;
          SET LOCAL app.current_user_id = $2;
          SET LOCAL app.current_user_role = 'user';
        `, [tenantId, userId]);
      }

      // Bật/tắt RLS tạm thời
      if (options.bypassRLS) {
        await client.query('SET LOCAL row_level_security = OFF;');
      }

      // Log query nếu cần audit
      if (options.auditQuery && tenantId && userId) {
        await this.auditQuery(client, query, params, tenantId, userId);
      }

      // Execute main query
      const result = await client.query(query, params);
      const rows = result.rows;

      // Restore RLS settings
      if (options.bypassRLS) {
        await client.query('SET LOCAL row_level_security = ON;');
      }

      return rows;

    } catch (error) {
      logger.error('Lỗi executing query với RLS', {
        query: query.substring(0, 100),
        tenantId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      if (client) {
        // Clear session context
        await client.query(`
          RESET LOCAL app.current_tenant_id;
          RESET LOCAL app.current_user_id;
          RESET LOCAL app.current_user_role;
        `);
        client.release();
      }
    }
  }

  private async auditQuery(
    client: any,
    query: string,
    params: any[],
    tenantId: string,
    userId: string
  ): Promise<void> {
    try {
      await client.query(`
        INSERT INTO audit_logs (
          tenant_id,
          user_id,
          query_text,
          query_params,
          executed_at,
          ip_address,
          user_agent
        ) VALUES ($1, $2, $3, $4, NOW(), $5, $6)
      `, [
        tenantId,
        userId,
        query,
        JSON.stringify(params),
        '127.0.0.1', // Would come from request context
        'API Client' // Would come from request context
      ]);

    } catch (auditError) {
      logger.error('Lỗi audit query', {
        tenantId,
        userId,
        query: query.substring(0, 100),
        error: auditError instanceof Error ? auditError.message : 'Unknown error'
      });
    }
  }

  // Test RLS configuration
  async testRLSConfiguration(): Promise<{
    success: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Test basic RLS functionality
      await this.executeQuery('SELECT 1', [], 'test_tenant', 'test_user', { bypassRLS: false });
      
      // Check if RLS is enabled
      const rlsStatus = await this.pool.query(`
        SELECT tablename, rowsecurity 
        FROM pg_tables 
        WHERE schemaname = 'public'
      `);

      const tablesWithoutRLS = rlsStatus.rows.filter((row: any) => !row.rowsecurity);
      if (tablesWithoutRLS.length > 0) {
        issues.push(`Tables không có RLS: ${tablesWithoutRLS.map((r: any) => r.tablename).join(', ')}`);
        recommendations.push('Enable RLS cho tất cả tables chứa multi-tenant data');
      }

      return {
        success: issues.length === 0,
        issues,
        recommendations
      };

    } catch (error) {
      logger.error('Lỗi test RLS configuration', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        issues: ['RLS test failed'],
        recommendations: ['Check database connection và permissions']
      };
    }
  }

  // Admin function để bypass RLS cho system operations
  async executeSystemQuery<R = any>(query: string, params: any[] = []): Promise<R[]> {
    let client;
    
    try {
      client = await this.pool.connect();
      
      // Temporarily disable RLS và set system context
      await client.query(`
        SET LOCAL row_level_security = OFF;
        SET LOCAL app.current_user_role = 'system_admin';
      `);

      const result = await client.query(query, params);
      
      return result.rows;

    } catch (error) {
      logger.error('Lỗi executing system query', {
        query: query.substring(0, 100),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      if (client) {
        // Restore normal settings
        await client.query(`
          SET LOCAL row_level_security = ON;
          RESET LOCAL app.current_user_role;
        `);
        client.release();
      }
    }
  }

  async getTablePolicies(tableName: string): Promise<string[]> {
    const rows = await this.executeSystemQuery<{ policyname: string }>(
      `
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = $1
      `,
      [tableName]
    );

    return rows.map(row => row.policyname);
  }

  async getAllPolicies(): Promise<Record<string, string[]>> {
    const rows = await this.executeSystemQuery<{ tablename: string; policyname: string }>(
      `
        SELECT tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
      `
    );

    const grouped: Record<string, string[]> = {};
    for (const row of rows) {
      if (!grouped[row.tablename]) {
        grouped[row.tablename] = [];
      }
      grouped[row.tablename].push(row.policyname);
    }

    return grouped;
  }
}

export { RowLevelSecuritySystemImpl as RowLevelSecuritySystem };
