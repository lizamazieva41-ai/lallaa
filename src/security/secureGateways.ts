import { EventEmitter } from 'events';

// Enum loại cổng kết nối
export enum GatewayType {
  API = 'api',
  WEB = 'web',
  DATABASE = 'database',
  FILE_STORAGE = 'file_storage',
  MESSAGE_QUEUE = 'message_queue',
  CLOUD_FUNCTION = 'cloud_function'
}

// Enum trạng thái cổng
export enum GatewayStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  ERROR = 'error'
}

// Interface cho cấu hình cổng
export interface GatewayConfig {
  id: string;
  name: string;
  type: GatewayType;
  endpoint: string;
  enabled: boolean;
  priority: number;
  timeout: number;
  retryCount: number;
  authRequired: boolean;
  rateLimiting: {
    enabled: boolean;
    requestsPerMinute: number;
    burstSize: number;
  };
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyRotation: boolean;
  };
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    auditLog: boolean;
  };
  validation: {
    enabled: boolean;
    schema: any;
    sanitization: boolean;
  };
}

// Interface cho yêu cầu cổng
export interface GatewayRequest {
  id: string;
  gatewayId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
  timestamp: number;
  source: {
    ip: string;
    userAgent?: string;
    sessionId?: string;
    userId?: string;
  };
}

// Interface cho phản hồi cổng
export interface GatewayResponse {
  id: string;
  requestId: string;
  status: number;
  headers: Record<string, string>;
  body?: any;
  timestamp: number;
  duration: number;
  fromCache: boolean;
}

// Interface cho chính sách cổng
export interface GatewayPolicy {
  id: string;
  gatewayId: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: PolicyCondition[];
  actions: PolicyAction[];
  priority: number;
}

// Interface cho điều kiện chính sách
interface PolicyCondition {
  type: 'ip' | 'method' | 'path' | 'header' | 'body' | 'time' | 'rate';
  operator: 'equals' | 'not_equals' | 'contains' | 'regex' | 'in' | 'not_in';
  value: any;
  caseSensitive: boolean;
}

// Interface cho hành động chính sách
interface PolicyAction {
  type: 'allow' | 'deny' | 'modify' | 'log' | 'alert' | 'redirect';
  parameters: any;
}

// Interface cho giới hạn tốc độ
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// Interface cho thống kê cổng
export interface GatewayMetrics {
  gatewayId: string;
  timestamp: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  requestsPerMinute: number;
  errorRate: number;
  cacheHitRate: number;
}

// Lớp cổng bảo mật
export class SecureGateway extends EventEmitter {
  private config: GatewayConfig;
  private policies: Map<string, GatewayPolicy> = new Map();
  private rateLimiters: Map<string, { count: number; resetTime: number }> = new Map();
  private requestCache: Map<string, GatewayResponse> = new Map();
  private metrics: GatewayMetrics;

  constructor(config: GatewayConfig) {
    super();
    this.config = config;
    this.metrics = {
      gatewayId: config.id,
      timestamp: Date.now(),
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      requestsPerMinute: 0,
      errorRate: 0,
      cacheHitRate: 0
    };
  }

  // Xử lý yêu cầu
  public async processRequest(request: GatewayRequest): Promise<GatewayResponse> {
    const startTime = Date.now();
    
    try {
      this.metrics.totalRequests++;

      // Kiểm tra giới hạn tốc độ
      if (this.config.rateLimiting.enabled && !this.checkRateLimit(request)) {
        throw new Error('Vượt quá giới hạn yêu cầu');
      }

      // Kiểm tra chính sách
      const policyDecision = this.evaluatePolicies(request);
      if (!policyDecision.allowed) {
        throw new Error(policyDecision.reason || 'Bị từ chối bởi chính sách');
      }

      // Xử lý xác thực
      if (this.config.authRequired) {
        await this.authenticate(request);
      }

      // Kiểm tra cache
      const cacheKey = this.generateCacheKey(request);
      const cachedResponse = this.requestCache.get(cacheKey);
      if (cachedResponse && this.isCacheValid(cachedResponse)) {
        this.updateMetrics(startTime, true, true);
        return { ...cachedResponse, fromCache: true };
      }

      // Xử lý yêu cầu thực tế
      const response = await this.forwardRequest(request);

      // Lưu vào cache
      if (this.shouldCache(request, response)) {
        this.requestCache.set(cacheKey, response);
      }

      this.updateMetrics(startTime, true, false);
      this.emit('requestProcessed', { request, response });

      return response;

    } catch (error) {
      this.updateMetrics(startTime, false, false);
      this.emit('requestError', { request, error });

      return {
        id: `response_${Date.now()}`,
        requestId: request.id,
        status: 500,
        headers: { 'content-type': 'application/json' },
        body: { error: 'Lỗi xử lý yêu cầu' },
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        fromCache: false
      };
    }
  }

  // Kiểm tra giới hạn tốc độ
  private checkRateLimit(request: GatewayRequest): boolean {
    const key = this.generateRateLimitKey(request);
    const now = Date.now();
    const windowMs = 60000; // 1 phút
    const maxRequests = this.config.rateLimiting.requestsPerMinute;

    let limiter = this.rateLimiters.get(key);
    
    if (!limiter || now > limiter.resetTime) {
      limiter = { count: 1, resetTime: now + windowMs };
      this.rateLimiters.set(key, limiter);
      return true;
    }

    if (limiter.count >= maxRequests) {
      return false;
    }

    limiter.count++;
    return true;
  }

  // Tạo key giới hạn tốc độ
  private generateRateLimitKey(request: GatewayRequest): string {
    const source = request.source.ip;
    return `${this.config.id}:${source}`;
  }

  // Đánh giá chính sách
  private evaluatePolicies(request: GatewayRequest): { allowed: boolean; reason?: string } {
    for (const policy of this.policies.values()) {
      if (!policy.enabled) continue;

      for (const condition of policy.conditions) {
        if (!this.evaluateCondition(condition, request)) {
          continue;
        }

        for (const action of policy.actions) {
          if (action.type === 'deny') {
            return { allowed: false, reason: 'Bị từ chối bởi chính sách' };
          }
        }
      }
    }

    return { allowed: true };
  }

  // Đánh giá điều kiện
  private evaluateCondition(condition: PolicyCondition, request: GatewayRequest): boolean {
    const value = this.getRequestValue(condition.type, request);
    const conditionValue = condition.value;

    switch (condition.operator) {
      case 'equals':
        return value === conditionValue;
      case 'not_equals':
        return value !== conditionValue;
      case 'contains':
        return String(value).includes(String(conditionValue));
      case 'regex':
        return new RegExp(conditionValue).test(String(value));
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(value);
      case 'not_in':
        return Array.isArray(conditionValue) && !conditionValue.includes(value);
      default:
        return false;
    }
  }

  // Lấy giá trị từ yêu cầu
  private getRequestValue(type: string, request: GatewayRequest): any {
    switch (type) {
      case 'ip':
        return request.source.ip;
      case 'method':
        return request.method;
      case 'path':
        return request.path;
      case 'header':
        return request.headers;
      case 'body':
        return request.body;
      case 'time':
        return Date.now();
      case 'rate':
        return this.getRateLimitUsage(request);
      default:
        return null;
    }
  }

  // Lấy mức sử dụng giới hạn tốc độ
  private getRateLimitUsage(request: GatewayRequest): number {
    const key = this.generateRateLimitKey(request);
    const limiter = this.rateLimiters.get(key);
    return limiter ? limiter.count : 0;
  }

  // Xác thực yêu cầu
  private async authenticate(request: GatewayRequest): Promise<void> {
    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      throw new Error('Thiếu header xác thực');
    }

    // Mô phỏng xác thực JWT
    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('Định dạng token không hợp lệ');
    }

    const token = authHeader.substring(7);
    // Trong thực tế, sẽ xác thực JWT ở đây
    if (token.length < 10) {
      throw new Error('Token không hợp lệ');
    }
  }

  // Tạo key cache
  private generateCacheKey(request: GatewayRequest): string {
    return `${request.method}:${request.path}:${JSON.stringify(request.query)}`;
  }

  // Kiểm tra cache hợp lệ
  private isCacheValid(response: GatewayResponse): boolean {
    const maxAge = 5 * 60 * 1000; // 5 phút
    return Date.now() - response.timestamp < maxAge;
  }

  // Nên cache
  private shouldCache(request: GatewayRequest, response: GatewayResponse): boolean {
    // Chỉ cache GET requests thành công
    return request.method === 'GET' && response.status === 200;
  }

  // Chuyển tiếp yêu cầu
  private async forwardRequest(request: GatewayRequest): Promise<GatewayResponse> {
    // Mô phỏng xử lý yêu cầu
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

    return {
      id: `response_${Date.now()}`,
      requestId: request.id,
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: { message: 'Thành công', timestamp: Date.now() },
      timestamp: Date.now(),
      duration: Math.random() * 100,
      fromCache: false
    };
  }

  // Cập nhật thống kê
  private updateMetrics(startTime: number, success: boolean, fromCache: boolean): void {
    const duration = Date.now() - startTime;
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Cập nhật thời gian phản hồi trung bình
    const totalDuration = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + duration;
    this.metrics.averageResponseTime = totalDuration / this.metrics.totalRequests;

    // Cập nhật cache hit rate
    if (fromCache) {
      const cacheHits = this.metrics.cacheHitRate * (this.metrics.totalRequests - 1) + 1;
      this.metrics.cacheHitRate = cacheHits / this.metrics.totalRequests;
    } else {
      const cacheHits = this.metrics.cacheHitRate * (this.metrics.totalRequests - 1);
      this.metrics.cacheHitRate = cacheHits / this.metrics.totalRequests;
    }

    // Cập nhật error rate
    this.metrics.errorRate = (this.metrics.failedRequests / this.metrics.totalRequests) * 100;

    // Tính requests per minute
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    // Mô phỏng: giả sử 10% yêu cầu trong 1 phút gần nhất
    this.metrics.requestsPerMinute = Math.floor(this.metrics.totalRequests * 0.1);
  }

  // Thêm chính sách
  public addPolicy(policy: GatewayPolicy): void {
    this.policies.set(policy.id, policy);
    this.emit('policyAdded', policy);
  }

  // Xóa chính sách
  public removePolicy(policyId: string): boolean {
    const removed = this.policies.delete(policyId);
    if (removed) {
      this.emit('policyRemoved', policyId);
    }
    return removed;
  }

  // Lấy cấu hình
  public getConfig(): GatewayConfig {
    return { ...this.config };
  }

  // Lấy thống kê
  public getMetrics(): GatewayMetrics {
    return { ...this.metrics };
  }

  // Dọn dẹp
  public cleanup(): void {
    const now = Date.now();
    
    // Dọn dẹp rate limiters hết hạn
    for (const [key, limiter] of this.rateLimiters.entries()) {
      if (now > limiter.resetTime) {
        this.rateLimiters.delete(key);
      }
    }

    // Dọn dẹp cache hết hạn
    for (const [key, response] of this.requestCache.entries()) {
      if (!this.isCacheValid(response)) {
        this.requestCache.delete(key);
      }
    }

    this.emit('cleanup');
  }
}

// Lớp quản lý cổng
export class SecureGatewayManager extends EventEmitter {
  private gateways: Map<string, SecureGateway> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    super();
    // Dọn dẹp mỗi 5 phút
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
    this.cleanupInterval.unref?.();
  }

  // Tạo cổng mới
  public createGateway(config: GatewayConfig): SecureGateway {
    const gateway = new SecureGateway(config);
    
    gateway.on('requestProcessed', (data) => {
      this.emit('gatewayRequestProcessed', { gatewayId: config.id, ...data });
    });

    gateway.on('requestError', (data) => {
      this.emit('gatewayRequestError', { gatewayId: config.id, ...data });
    });

    this.gateways.set(config.id, gateway);
    this.emit('gatewayCreated', config);

    return gateway;
  }

  // Lấy cổng
  public getGateway(id: string): SecureGateway | undefined {
    return this.gateways.get(id);
  }

  // Xóa cổng
  public removeGateway(id: string): boolean {
    const gateway = this.gateways.get(id);
    if (!gateway) return false;

    gateway.removeAllListeners();
    this.gateways.delete(id);
    this.emit('gatewayRemoved', id);

    return true;
  }

  // Lấy tất cả cổng
  public getAllGateways(): SecureGateway[] {
    return Array.from(this.gateways.values());
  }

  // Lấy thống kê tất cả cổng
  public getAllMetrics(): GatewayMetrics[] {
    return Array.from(this.gateways.values()).map(gateway => gateway.getMetrics());
  }

  // Dọn dẹp tất cả cổng
  private cleanup(): void {
    for (const gateway of this.gateways.values()) {
      gateway.cleanup();
    }
    this.emit('cleanup');
  }

  // Hủy manager
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    for (const [id, gateway] of this.gateways.entries()) {
      gateway.removeAllListeners();
      this.gateways.delete(id);
    }

    this.removeAllListeners();
  }
}

// Export singleton
export const gatewayManager = new SecureGatewayManager();
