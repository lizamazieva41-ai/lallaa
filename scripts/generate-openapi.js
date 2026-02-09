#!/usr/bin/env node

/**
 * OpenAPI Documentation Generator
 * Scans the codebase and updates OpenAPI spec to match current API
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

interface RouteInfo {
  path: string;
  method: string;
  file: string;
  middleware?: string[];
  controller?: string;
  description?: string;
  parameters?: any[];
  responses?: Record<string, any>;
  tags?: string[];
}

interface OpenAPIOperation {
  path: string;
  method: string;
  operationId: string;
  summary: string;
  description: string;
  tags: string[];
  parameters?: any[];
  requestBody?: any;
  responses?: Record<string, any>;
  security?: any[];
}

class OpenAPIGenerator {
  private routes: Map<string, RouteInfo[]> = new Map();
  private operations: OpenAPIOperation[] = [];

  constructor() {
    this.scanRoutes();
    this.analyzeOperations();
  }

  private scanRoutes(): void {
    // Scan all route files in src/routes directory
    const routeFiles = glob.sync('src/routes/*.ts');
    
    for (const file of routeFiles) {
      const content = fs.readFileSync(file, 'utf8');
      this.parseRouteFile(file, content);
    }
  }

  private parseRouteFile(filePath: string, content: string): void {
    const routerName = path.basename(filePath, '.ts');
    
    // Extract route patterns using regex
    const routePatterns = [
      // GET /api/v1/...
      /router\.(?:get|GET)\('([^']+)',?[^,]*?[^;)]/g,
      // POST /api/v1/...
      /router\.(?:post|POST)\('([^']+)',?[^,]*?[^;)]/g,
      // PUT /api/v1/...
      /router\.(?:put|PUT)\('([^']+)',?[^,]*?[^;)]/g,
      // DELETE /api/v1/...
      /router\.(?:delete|DELETE)\('([^']+)',?[^,]*?[^;)]/g
    ];

    const routes: RouteInfo[] = [];

    for (const pattern of routePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const path = match[1].replace(/'/g, '');
        const method = pattern.source.includes('get') ? 'get' :
                     pattern.source.includes('GET') ? 'GET' :
                     pattern.source.includes('post') ? 'post' :
                     pattern.source.includes('POST') ? 'POST' :
                     pattern.source.includes('put') ? 'put' :
                     pattern.source.includes('PUT') ? 'PUT' :
                     pattern.source.includes('delete') ? 'delete' :
                     pattern.source.includes('DELETE') ? 'DELETE' : 'unknown';

        routes.push({
          path,
          method,
          file: filePath,
          routerName
        });
      }
    }

    if (routes.length > 0) {
      this.routes.set(routerName, routes);
    }
  }

  private analyzeOperations(): void {
    for (const [routerName, routes] of this.routes.entries()) {
      for (const route of routes) {
        this.operations.push(this.createOpenAPIOperation(route, routerName));
      }
    }
  }

  private createOpenAPIOperation(route: RouteInfo, routerName: string): OpenAPIOperation {
    const operationId = `${route.method}${route.path.split('/').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')}`;
    const full_path = `/api/v1/${routerName.split('.')[0]}/${route.path}`;

    const commonTags = [this.inferTag(routerName)];
    const commonParameters = this.inferParameters(route.path, route.method);
    const commonResponses = this.inferResponses();

    return {
      path: full_path,
      method: route.method.toLowerCase(),
      operationId,
      summary: this.generateSummary(route.method, route.path),
      description: this.generateDescription(routerName, route.path, route.method),
      tags: commonTags,
      parameters: commonParameters,
      responses: commonResponses,
      security: this.inferSecurity(routerName, route.path)
    };
  }

  private inferTag(routerName: string): string[] {
    const tagMap: Record<string, string[]> = {
      'auth': ['Authentication'],
      'bin': ['BIN Services'],
      'country': ['Payment Instruments'],
      'iban': ['Payment Instruments'],
      'cards': ['Payment Instruments'],
      'testCards': ['Payment Instruments'],
      'etl': ['Admin'],
      'admin': ['Admin'],
      'authEnhanced': ['Authentication'],
      'rateLimit': ['Security'],
      'rls': ['Security'],
      'audit': ['Security'],
      'swagger': ['Documentation']
    };

    return tagMap[routerName] || ['API'];
  }

  private inferParameters(path: string, method: string): any[] {
    const params: any[] = [];
    
    // Extract path parameters like :id, :bin, etc.
    const pathParamMatches = path.match(/:(\w+)/g);
    if (pathParamMatches) {
      for (const match of pathParamMatches) {
        params.push({
          name: match[1],
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: `${match[1].toUpperCase()} parameter`
        });
      }
    }

    // Add common query parameters for GET requests
    if (method.toLowerCase() === 'get') {
      params.push(
        {
          name: 'limit',
          in: 'query',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 100 },
          description: 'Maximum number of results to return'
        },
        {
          name: 'offset',
          in: 'query',
          required: false,
          schema: { type: 'integer', minimum: 0 },
          description: 'Number of results to skip'
        },
        {
          name: 'sort',
          in: 'query',
          required: false,
          schema: { type: 'string', enum: ['asc', 'desc'] },
          description: 'Sort order'
        }
      );
    }

    return params;
  }

  private inferResponses(): Record<string, any> {
    return {
      '200': {
        description: 'Successful operation',
        content: {
          'application/json': {
            schema: { '$ref': '#/components/schemas/SuccessResponse' }
          }
        }
      },
      '400': { '$ref': '#/components/responses/BadRequest' },
      '401': { '$ref': '#/components/responses/Unauthorized' },
      '403': { '$ref': '#/components/responses/Forbidden' },
      '404': { '$ref': '#/components/responses/NotFound' },
      '429': { '$ref': '#/components/responses/TooManyRequests' },
      '500': { '$ref': '#/components/responses/InternalServerError' }
    };
  }

  private inferSecurity(routerName: string, path: string): any[] {
    // Most endpoints require JWT authentication
    const publicRoutes = ['POST /auth/login', 'POST /auth/register', 'GET /health'];
    const fullPath = `/api/v1/${routerName.split('.')[0]}/${path}`;
    
    if (publicRoutes.some(route => fullPath.includes(route.toLowerCase()))) {
      return [];
    }

    return [{ bearerAuth: [] }];
  }

  private generateSummary(method: string, path: string): string {
    const action = method.toUpperCase();
    const resource = path.split('/')[0] || 'resource';
    
    const summaries: Record<string, string> = {
      'get': `Get ${resource}`,
      'post': `Create ${resource}`,
      'put': `Update ${resource}`,
      'delete': `Delete ${resource}`
    };

    return summaries[method.toLowerCase()] || `${action} ${resource}`;
  }

  private generateDescription(routerName: string, path: string, method: string): string {
    const action = method.toLowerCase();
    const resource = path.split('/')[0] || 'resource';
    
    return `${method.toUpperCase()} operation for ${resource} on ${routerName} endpoint`;
  }

  generateYAML(): string {
    let yaml = `openapi: 3.0.0
info:
  title: Payment Sandbox API
  description: |
    A comprehensive REST API for payment instrument testing, BIN lookup, IBAN validation, 
    and test credit card generation with enterprise-grade security and monitoring.
    
    ## Security Features
    - JWT Authentication with refresh tokens
    - Row Level Security (RLS) for data isolation
    - Rate limiting per user tier
    - Comprehensive audit logging
    - 2FA support
    - Data masking in logs
    
    ## Monitoring
    - Prometheus metrics for performance and security
    - Real-time security event tracking
    - Automated vulnerability scanning
    - Performance alerts and thresholds
    
  version: 1.1.0
  contact:
    name: Payment Sandbox Support
    email: support@payment-sandbox.com
    url: https://support.payment-sandbox.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.payment-sandbox.com/api/v1
    description: Production
  - url: https://staging-api.payment-sandbox.com/api/v1
    description: Staging
  - url: http://localhost:3000/api/v1
    description: Development

tags:
  - name: Authentication
    description: User authentication and authorization
  - name: Two-Factor Auth
    description: Two-factor authentication management
  - name: BIN Services
    description: Bank Identification Number lookup services
  - name: Payment Instruments
    description: Credit card, IBAN, and payment instrument services
  - name: Admin
    description: Administrative operations (requires admin role)
  - name: Security
    description: Security monitoring and audit endpoints

paths:
`;

    // Generate paths from operations
    const paths: Record<string, any> = {};

    for (const operation of this.operations) {
      if (!paths[operation.path]) {
        paths[operation.path] = {};
      }

      paths[operation.path][operation.method] = {
        tags: operation.tags,
        summary: operation.summary,
        description: operation.description,
        operationId: operation.operationId,
        parameters: operation.parameters,
        responses: operation.responses,
        security: operation.security
      };
    }

    yaml += this.formatPaths(paths);

    // Add components section
    yaml += this.generateComponents();

    return yaml;
  }

  private formatPaths(paths: Record<string, any>): string {
    let yaml = '';
    
    for (const [path, pathData] of Object.entries(paths)) {
      yaml += `  ${path}:\n`;
      
      for (const [method, operation] of Object.entries(pathData)) {
        yaml += `    ${method}:\n`;
        yaml += `      tags: [${operation.tags.map(tag => `'${tag}'`).join(', ')}]\n`;
        yaml += `      summary: "${operation.summary}"\n`;
        yaml += `      description: "${operation.description}"\n`;
        yaml += `      operationId: "${operation.operationId}"\n`;
        
        if (operation.parameters && operation.parameters.length > 0) {
          yaml += `      parameters:\n`;
          for (const param of operation.parameters) {
            yaml += `        - name: ${param.name}\n`;
            yaml += `          in: ${param.in}\n`;
            yaml += `          required: ${param.required}\n`;
            yaml += `          schema:\n`;
            yaml += `            type: ${param.schema.type}\n`;
            if (param.schema.description) {
              yaml += `            description: "${param.schema.description}"\n`;
            }
            if (param.schema.enum) {
              yaml += `            enum: [${param.schema.enum.map((e: string) => `'${e}'`).join(', ')}]\n`;
            }
            if (param.schema.minimum !== undefined) {
              yaml += `            minimum: ${param.schema.minimum}\n`;
            }
            if (param.schema.maximum !== undefined) {
              yaml += `            maximum: ${param.schema.maximum}\n`;
            }
          }
        }
      }
      
      yaml += `      responses:\n`;
      for (const [code, response] of Object.entries(operation.responses)) {
        yaml += `        '${code}':\n`;
        if (typeof response === 'string' && response.startsWith('$ref:')) {
          yaml += `          $ref: ${response}\n`;
        } else {
          yaml += `          description: "${response.description}"\n`;
          if (response.content) {
            yaml += `          content:\n`;
            yaml += `            application/json:\n`;
            yaml += `              schema:\n`;
            yaml += `                $ref: ${response.content['application/json'].schema.$ref}\n`;
          }
        }
      }
      
      if (operation.security && operation.security.length > 0) {
        yaml += `      security:\n`;
        for (const security of operation.security) {
          yaml += `        - ${JSON.stringify(security)}\n`;
        }
      }
      
      yaml += '\n';
    }

    return yaml;
  }

  private generateComponents(): string {
    return `components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT authentication token
      
  schemas:
    SuccessResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: object
        meta:
          type: object
          properties:
            timestamp:
              type: string
            requestId:
              type: string
            rateLimit:
              type: object
              
    Error:
      type: object
      required: [success, error]
      properties:
        success:
          type: boolean
        error:
          $ref: '#/components/schemas/ErrorDetail'
          
    ErrorDetail:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
        message:
          type: string
        details:
          type: object
          
    User:
      type: object
      properties:
        id:
          type: string
        email:
          type: string
          role:
          type: string
          status:
            type: string
        createdAt:
          type: string
          
    AuthResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: object
          properties:
            accessToken:
              type: string
            refreshToken:
              type: string
            expiresIn:
              type: number
            user:
              $ref: '#/components/schemas/User'
              
    responses:
    BadRequest:
      description: Bad Request
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
            
    Unauthorized:
      description: Unauthorized - Invalid or missing authentication
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
            
    Forbidden:
      description: Forbidden - Insufficient permissions
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
            
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
            
    TooManyRequests:
      description: Rate limit exceeded
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
            
    InternalServerError:
      description: Internal server error
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
`;
  }

  generateReport(): void {
    console.log('🔍 Scanning for OpenAPI Documentation...');
    console.log(`📊 Found ${this.operations.length} API endpoints`);
    
    const tagCounts: Record<string, number> = {};
    for (const operation of this.operations) {
      for (const tag of operation.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    console.log('\n📋 API Endpoint Distribution:');
    for (const [tag, count] of Object.entries(tagCounts)) {
      console.log(`  ${tag}: ${count} endpoints`);
    }

    const yaml = this.generateYAML();
    fs.writeFileSync('openapi-updated.yaml', yaml);
    
    console.log('\n✅ OpenAPI specification updated: openapi-updated.yaml');
    console.log('\n📝 Recommendation:');
    console.log('   1. Review the generated specification for accuracy');
    console.log('   2. Compare with current openapi.yaml');
    console.log('   3. Replace after verification');
  }
}

// Main execution
if (require.main === module) {
  const generator = new OpenAPIGenerator();
  generator.generateReport();
}