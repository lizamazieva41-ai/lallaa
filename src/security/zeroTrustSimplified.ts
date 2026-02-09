import { EventEmitter } from 'events';

// Enum mức độ tin cậy
export enum TrustLevel {
  UNTRUSTED = 0,    // Không tin cậy
  LOW = 25,         // Tin cậy thấp
  MEDIUM = 50,      // Tin cậy trung bình
  HIGH = 75,        // Tin cậy cao
  VERIFIED = 100    // Đã xác thực
}

// Enum phương thức xác thực
export enum VerificationMethod {
  PASSWORD = 'password',                    // Mật khẩu
  MFA = 'mfa',                            // Xác thực hai yếu tố
  BIOMETRIC = 'biometric',                // Sinh trắc học
  HARDWARE_TOKEN = 'hardware_token',      // Token phần cứng
  CERTIFICATE = 'certificate',             // Chứng chỉ
  BEHAVIORAL = 'behavioral',              // Hành vi
  CONTEXTUAL = 'contextual'               // Ngữ cảnh
}

// Interface cho ngữ cảnh xác thực
export interface AuthContext {
  userId: string;
  sessionId: string;
  method: VerificationMethod;
  timestamp: number;
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
  riskScore: number;
}

// Interface cho điều kiện chính sách
export interface PolicyCondition {
  type: 'time' | 'location' | 'device' | 'risk' | 'method';
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
  description: string;
}

// Interface cho hành động chính sách
export interface PolicyAction {
  type: 'allow' | 'deny' | 'require_mfa' | 'escalate' | 'log';
  description: string;
  parameters?: any;
}

// Interface cho chính sách bảo mật
export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  conditions: PolicyCondition[];
  actions: PolicyAction[];
  createdAt: Date;
  updatedAt: Date;
}

// Interface cho quyết định truy cập
export interface AccessDecision {
  allowed: boolean;
  trustLevel: TrustLevel;
  riskScore: number;
  policies: string[];
  requiredActions: PolicyAction[];
  reason: string;
  expiresAt?: number;
}

// Interface cho thông tin rủi ro
export interface RiskFactors {
  unknownDevice: boolean;
  unusualLocation: boolean;
  unusualTime: boolean;
  failedAttempts: number;
  suspicionScore: number;
  factors: string[];
}

// Lớp đánh giá rủi ro đơn giản
export class RiskAssessment {
  private calculateRiskScoreInternal(context: AuthContext, factors: RiskFactors): number {
    let score = 0;
    
    // Rủi ro từ thiết bị lạ
    if (factors.unknownDevice) score += 30;
    
    // Rủi ro từ vị trí bất thường
    if (factors.unusualLocation) score += 25;
    
    // Rủi ro từ thời gian bất thường
    if (factors.unusualTime) score += 20;
    
    // Rủi ro từ lần thử thất bại
    score += Math.min(factors.failedAttempts * 10, 30);
    
    // Rủi ro từ điểm đáng ngờ
    score += factors.suspicionScore;
    
    return Math.min(score, 100);
  }

  public assessRisk(context: AuthContext): RiskFactors {
    const factors: RiskFactors = {
      unknownDevice: Math.random() > 0.7,
      unusualLocation: Math.random() > 0.8,
      unusualTime: Math.random() > 0.6,
      failedAttempts: Math.floor(Math.random() * 5),
      suspicionScore: Math.floor(Math.random() * 20),
      factors: []
    };

    if (factors.unknownDevice) factors.factors.push('Thiết bị không xác định');
    if (factors.unusualLocation) factors.factors.push('Vị trí bất thường');
    if (factors.unusualTime) factors.factors.push('Thời gian truy cập bất thường');
    if (factors.failedAttempts > 0) factors.factors.push(`Thất bại: ${factors.failedAttempts} lần`);

    return factors;
  }

  public calculateRiskScore(context: AuthContext): number {
    const factors = this.assessRisk(context);
    return this.calculateRiskScoreInternal(context, factors);
  }

  public cleanup(): void {
    // Placeholder for future cleanup hooks
  }
}

// Lớp động cơ chính sách đơn giản
export class PolicyEngine {
  private policies: Map<string, SecurityPolicy> = new Map();

  constructor() {
    this.initializeDefaultPolicies();
  }

  private initializeDefaultPolicies(): void {
    // Chính sách chặn rủi ro cao
    const highRiskPolicy: SecurityPolicy = {
      id: 'high-risk-block',
      name: 'Chặn rủi ro cao',
      description: 'Chặn truy cập khi rủi ro cao hơn 80',
      enabled: true,
      priority: 1,
      conditions: [{
        type: 'risk',
        operator: 'greater_than',
        value: 80,
        description: 'Điểm rủi ro > 80'
      }],
      actions: [{
        type: 'deny',
        description: 'Từ chối truy cập do rủi ro cao'
      }],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Chính sách yêu cầu MFA cho rủi ro trung bình
    const mediumRiskPolicy: SecurityPolicy = {
      id: 'medium-risk-mfa',
      name: 'Yêu cầu MFA rủi ro trung bình',
      description: 'Yêu cầu xác thực hai yếu tố khi rủi ro từ 40-80',
      enabled: true,
      priority: 2,
      conditions: [{
        type: 'risk',
        operator: 'greater_than',
        value: 40,
        description: 'Điểm rủi ro > 40'
      }],
      actions: [{
        type: 'require_mfa',
        description: 'Yêu cầu xác thực hai yếu tố'
      }],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.policies.set(highRiskPolicy.id, highRiskPolicy);
    this.policies.set(mediumRiskPolicy.id, mediumRiskPolicy);
  }

  public evaluatePolicies(context: AuthContext): AccessDecision {
    const riskScore = context.riskScore;
    let allowed = true;
    const appliedPolicies: string[] = [];
    const requiredActions: PolicyAction[] = [];
    let reason = 'Cho phép truy cập';

    // Sắp xếp chính sách theo ưu tiên
    const sortedPolicies = Array.from(this.policies.values())
      .filter(p => p.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const policy of sortedPolicies) {
      if (this.evaluateCondition(policy.conditions[0], context, riskScore)) {
        appliedPolicies.push(policy.name);
        
        for (const action of policy.actions) {
          if (action.type === 'deny') {
            allowed = false;
            reason = action.description;
          } else if (action.type === 'require_mfa' && context.method !== VerificationMethod.MFA) {
            requiredActions.push(action);
            reason = 'Yêu cầu xác thực bổ sung';
          }
        }
      }
    }

    // Xác định mức độ tin cậy
    let trustLevel: TrustLevel;
    if (riskScore < 20) {
      trustLevel = TrustLevel.VERIFIED;
    } else if (riskScore < 40) {
      trustLevel = TrustLevel.HIGH;
    } else if (riskScore < 60) {
      trustLevel = TrustLevel.MEDIUM;
    } else if (riskScore < 80) {
      trustLevel = TrustLevel.LOW;
    } else {
      trustLevel = TrustLevel.UNTRUSTED;
    }

    return {
      allowed: allowed && requiredActions.length === 0,
      trustLevel,
      riskScore,
      policies: appliedPolicies,
      requiredActions,
      reason,
      expiresAt: Date.now() + (60 * 60 * 1000) // 1 giờ
    };
  }

  private evaluateCondition(condition: PolicyCondition, context: AuthContext, riskScore: number): boolean {
    switch (condition.type) {
      case 'risk':
        switch (condition.operator) {
          case 'greater_than':
            return riskScore > condition.value;
          case 'less_than':
            return riskScore < condition.value;
          case 'equals':
            return riskScore === condition.value;
          default:
            return false;
        }
      default:
        return false;
    }
  }

  public addPolicy(policy: SecurityPolicy): void {
    this.policies.set(policy.id, policy);
  }

  public removePolicy(policyId: string): boolean {
    return this.policies.delete(policyId);
  }

  public getPolicy(policyId: string): SecurityPolicy | undefined {
    return this.policies.get(policyId);
  }

  public getAllPolicies(): SecurityPolicy[] {
    return Array.from(this.policies.values());
  }
}

// Lớp quản lý ngữ cảnh Zero-Trust
export class ZeroTrustContextManager extends EventEmitter {
  private contexts: Map<string, AuthContext> = new Map();
  private riskAssessment: RiskAssessment;
  private policyEngine: PolicyEngine;

  constructor() {
    super();
    this.riskAssessment = new RiskAssessment();
    this.policyEngine = new PolicyEngine();
  }

  public createContext(context: Omit<AuthContext, 'riskScore'>): AuthContext {
    const riskScore = this.riskAssessment.calculateRiskScore(context as AuthContext);
    const fullContext: AuthContext = {
      ...context,
      riskScore
    };

    this.contexts.set(context.sessionId, fullContext);
    this.emit('contextCreated', fullContext);
    
    return fullContext;
  }

  public updateContext(sessionId: string, updates: Partial<AuthContext>): AuthContext | null {
    const existing = this.contexts.get(sessionId);
    if (!existing) return null;

    const updated: AuthContext = { ...existing, ...updates };
    const riskScore = this.riskAssessment.calculateRiskScore(updated);
    updated.riskScore = riskScore;

    this.contexts.set(sessionId, updated);
    this.emit('contextUpdated', updated);
    
    return updated;
  }

  public evaluateAccess(sessionId: string): AccessDecision | null {
    const context = this.contexts.get(sessionId);
    if (!context) return null;

    const decision = this.policyEngine.evaluatePolicies(context);
    this.emit('accessEvaluated', { context, decision });
    
    return decision;
  }

  public getContext(sessionId: string): AuthContext | null {
    return this.contexts.get(sessionId) || null;
  }

  public removeContext(sessionId: string): boolean {
    const removed = this.contexts.delete(sessionId);
    if (removed) {
      this.emit('contextRemoved', sessionId);
    }
    return removed;
  }

  public getAllContexts(): AuthContext[] {
    return Array.from(this.contexts.values());
  }

  public getRiskAssessment(): RiskAssessment {
    return this.riskAssessment;
  }

  public getPolicyEngine(): PolicyEngine {
    return this.policyEngine;
  }
}

// Export singleton instance
export const zeroTrustManager = new ZeroTrustContextManager();
