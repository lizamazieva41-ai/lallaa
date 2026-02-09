import { EventEmitter } from 'events';
import { Request, Response } from 'express';

// Enum loại mối đe dọa
export enum ThreatType {
  SUSPICIOUS_LOGIN = 'suspicious_login',           // Đăng nhập đáng ngờ
  BRUTE_FORCE = 'brute_force',                     // Tấn công brute force
  UNUSUAL_ACCESS_PATTERN = 'unusual_access_pattern', // Mẫu truy cập bất thường
  DATA_EXFILTRATION = 'data_exfiltration',         // Rò rỉ dữ liệu
  PRIVILEGE_ESCALATION = 'privilege_escalation',   // Leo thang đặc quyền
  MALICIOUS_PAYLOAD = 'malicious_payload',         // Payload độc hại
  ANOMALOUS_BEHAVIOR = 'anomalous_behavior',      // Hành vi bất thường
  CREDENTIAL_STUFFING = 'credential_stuffing',     // Tấn công credential stuffing
  ACCOUNT_TAKEOVER = 'account_takeover',           // Chiếm đoạt tài khoản
  CARD_TESTING = 'card_testing',                   // Test thẻ
  UNAUTHORIZED_API_ACCESS = 'unauthorized_api_access', // Lạm dụng API
  MALICIOUS_BOT = 'malicious_bot'                  // Bot độc hại
}

// Enum mức độ nghiêm trọng
export enum ThreatSeverity {
  LOW = 'low',           // Thấp
  MEDIUM = 'medium',     // Trung bình
  HIGH = 'high',         // Cao
  CRITICAL = 'critical'  // Nghiêm trọng
}

// Enum trạng thái mối đe dọa
export enum ThreatStatus {
  DETECTED = 'detected',     // Đã phát hiện
  INVESTIGATING = 'investigating', // Đang điều tra
  CONTAINED = 'contained',   // Đã cô lập
  RESOLVED = 'resolved',     // Đã giải quyết
  FALSE_POSITIVE = 'false_positive' // Báo động sai
}

// Enum phương pháp phát hiện
export enum DetectionMethod {
  RULE_BASED = 'rule_based',
  MACHINE_LEARNING = 'machine_learning',
  STATISTICAL = 'statistical'
}

// Interface cho mối đe dọa
export interface Threat {
  id: string;
  type: ThreatType;
  severity: ThreatSeverity;
  status: ThreatStatus;
  title: string;
  description: string;
  source: {
    ip?: string;
    userId?: string;
    sessionId?: string;
    userAgent?: string;
    deviceId?: string;
  };
  target: {
    endpoint?: string;
    resource?: string;
    userId?: string;
  };
  indicators: ThreatIndicator[];
  timeline: ThreatTimeline[];
  confidence: number; // 0-100
  riskScore: number; // 0-100
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
  assignedTo?: string;
  tags: string[];
  metadata: Record<string, any>;
}

export interface ThreatDetectionResult {
  id: string;
  threatType: ThreatType;
  detectionMethod: DetectionMethod;
  confidence: number; // 0-1
  riskScore: number; // 0-100
  timestamp: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  indicators?: string[];
  details?: Record<string, any>;
  requiresEscalation: boolean;
}

// Interface cho chỉ báo mối đe dọa
export interface ThreatIndicator {
  id: string;
  type: 'ip' | 'user_agent' | 'behavior' | 'pattern' | 'signature';
  value: string;
  confidence: number;
  severity: ThreatSeverity;
  description: string;
  firstSeen: number;
  lastSeen: number;
  occurrences: number;
}

// Interface cho timeline mối đe dọa
export interface ThreatTimeline {
  timestamp: number;
  event: string;
  description: string;
  severity: ThreatSeverity;
  data?: any;
}

// Interface cho mẫu hành vi
export interface BehaviorPattern {
  id: string;
  userId?: string;
  sessionId?: string;
  type: 'login' | 'navigation' | 'data_access' | 'transaction' | 'system';
  pattern: any;
  baseline: any;
  deviation: number;
  riskScore: number;
  timestamp: number;
}

export interface BehavioralPatternConfig {
  id: string;
  name: string;
  description?: string;
  threatType: ThreatType;
  detectionMethod: DetectionMethod;
  isActive: boolean;
  confidence?: number;
  riskScore?: number;
  indicators?: string[];
  metadata?: Record<string, any>;
  createdAt?: number;
  updatedAt?: number;
}

export interface UserAction {
  id: string;
  type: 'login' | 'logout' | 'card_lookup' | 'iban_validate' | 'transaction' | 'data_access' | 'api_call' | 'suspicious' | 'error';
  endpoint?: string;
  method?: string;
  statusCode?: number;
  responseTime?: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

// Interface cho rule phát hiện
export interface DetectionRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  threatType: ThreatType;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
  threshold: {
    count?: number;
    timeWindow?: number;
    severity?: ThreatSeverity;
  };
  metadata: Record<string, any>;
}

// Interface cho điều kiện rule
interface RuleCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'regex' | 'greater_than' | 'less_than';
  value: any;
  weight: number;
}

// Interface cho hành động rule
interface RuleAction {
  type: 'alert' | 'block' | 'quarantine' | 'escalate' | 'log';
  parameters: any;
}

// Lớp Behavioral Threat Detection Engine
export class BehavioralThreatDetection extends EventEmitter {
  private threats: Map<string, Threat> = new Map();
  private indicators: Map<string, ThreatIndicator> = new Map();
  private patterns: Map<string, BehaviorPattern> = new Map();
  private rules: Map<string, DetectionRule> = new Map();
  private baselineProfiles: Map<string, BehaviorBaseline> = new Map();
  private detectionResults: ThreatDetectionResult[] = [];
  private patternConfigs: Map<string, BehavioralPatternConfig> = new Map();

  constructor() {
    super();
    this.initializeDefaultRules();
    this.initializeBaselines();
    this.startContinuousMonitoring();
  }

  // Khởi tạo rule mặc định
  private initializeDefaultRules(): void {
    // Rule phát hiện đăng nhập đáng ngờ
    const suspiciousLoginRule: DetectionRule = {
      id: 'suspicious-login-001',
      name: 'Đăng nhập đáng ngờ',
      description: 'Phát hiện đăng nhập từ vị trí hoặc thiết bị lạ',
      enabled: true,
      threatType: ThreatType.SUSPICIOUS_LOGIN,
      conditions: [
        { field: 'location.unusual', operator: 'equals', value: true, weight: 0.7 },
        { field: 'device.unknown', operator: 'equals', value: true, weight: 0.5 },
        { field: 'time.unusual', operator: 'equals', value: true, weight: 0.3 }
      ],
      actions: [
        { type: 'alert', parameters: { severity: 'medium' } },
        { type: 'escalate', parameters: { threshold: 0.8 } }
      ],
      priority: 1,
      threshold: { count: 3, timeWindow: 300000 }, // 5 phút
      metadata: { category: 'authentication' }
    };

    // Rule phát hiện brute force
    const bruteForceRule: DetectionRule = {
      id: 'brute-force-001',
      name: 'Tấn công Brute Force',
      description: 'Phát hiện nhiều lần đăng nhập thất bại',
      enabled: true,
      threatType: ThreatType.BRUTE_FORCE,
      conditions: [
        { field: 'login.failed_count', operator: 'greater_than', value: 5, weight: 1.0 },
        { field: 'login.time_window', operator: 'less_than', value: 300000, weight: 0.8 } // 5 phút
      ],
      actions: [
        { type: 'block', parameters: { duration: 900000 } }, // 15 phút
        { type: 'escalate', parameters: { severity: 'high' } }
      ],
      priority: 1,
      threshold: { count: 1, timeWindow: 60000 }, // 1 phút
      metadata: { category: 'authentication' }
    };

    // Rule phát hiện truy cập bất thường
    const unusualAccessRule: DetectionRule = {
      id: 'unusual-access-001',
      name: 'Truy cập bất thường',
      description: 'Phát hiện mẫu truy cập khác biệt so với baseline',
      enabled: true,
      threatType: ThreatType.UNUSUAL_ACCESS_PATTERN,
      conditions: [
        { field: 'access.deviation', operator: 'greater_than', value: 2.0, weight: 0.8 },
        { field: 'access.frequency', operator: 'greater_than', value: 10, weight: 0.6 }
      ],
      actions: [
        { type: 'alert', parameters: { severity: 'medium' } },
        { type: 'log', parameters: { level: 'warning' } }
      ],
      priority: 2,
      threshold: { count: 3, timeWindow: 600000 }, // 10 phút
      metadata: { category: 'access' }
    };

    this.rules.set(suspiciousLoginRule.id, suspiciousLoginRule);
    this.rules.set(bruteForceRule.id, bruteForceRule);
    this.rules.set(unusualAccessRule.id, unusualAccessRule);
  }

  // Khởi tạo baseline hành vi
  private initializeBaselines(): void {
    const defaultBaseline: BehaviorBaseline = {
      userId: 'default',
      loginFrequency: { mean: 3, stdDev: 1, pattern: [] },
      accessPattern: { 
        endpoints: [], 
        frequency: {}, 
        timeDistribution: new Array(24).fill(0)
      },
      dataAccess: { 
        volume: { mean: 100, stdDev: 30 },
        sensitivity: { mean: 0.3, stdDev: 0.1 }
      },
      sessionDuration: { mean: 3600, stdDev: 1800 }, // 1 giờ
      deviceUsage: { count: 2, knownDevices: [] },
      lastUpdated: Date.now()
    };

    this.baselineProfiles.set('default', defaultBaseline);
  }

  // Bắt đầu giám sát liên tục
  private startContinuousMonitoring(): void {
    const analysisTimer = setInterval(() => {
      this.performContinuousAnalysis();
    }, 30000); // 30 giây
    analysisTimer.unref?.();

    const cleanupTimer = setInterval(() => {
      this.cleanupOldData();
    }, 300000); // 5 phút
    cleanupTimer.unref?.();

    this.emit('monitoringStarted');
  }

  // Phân tích liên tục
  private performContinuousAnalysis(): void {
    try {
      // Kiểm tra các pattern hành vi gần đây
      const recentPatterns = Array.from(this.patterns.values())
        .filter(p => Date.now() - p.timestamp < 300000); // 5 phút

      for (const pattern of recentPatterns) {
        this.analyzeBehaviorPattern(pattern);
      }

      // Đánh giá các chỉ báo đang hoạt động
      this.evaluateActiveIndicators();

      // Cập nhật threat scores
      this.updateThreatScores();

    } catch (error) {
      this.emit('analysisError', error);
    }
  }

  // Ghi lại sự kiện bảo mật
  public recordSecurityEvent(
    type: string,
    data: any,
    severity: ThreatSeverity = ThreatSeverity.MEDIUM
  ): Threat | null {
    try {
      // Tạo behavior pattern từ event
      const pattern = this.createBehaviorPattern(type, data);
      
      // Lưu pattern
      this.patterns.set(pattern.id, pattern);

      // Đánh giá với các rules
      const threats = this.evaluateDetectionRules(pattern);

      // Process các threats được phát hiện
      for (const threat of threats) {
        this.handleDetectedThreat(threat);
      }

      return threats.length > 0 ? threats[0] : null;

    } catch (error) {
      this.emit('eventProcessingError', error);
      return null;
    }
  }

  // Tạo behavior pattern
  private createBehaviorPattern(type: string, data: any): BehaviorPattern {
    const baseline = this.getBaselineForUser(data.userId || 'default');
    
    const pattern: BehaviorPattern = {
      id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: data.userId,
      sessionId: data.sessionId,
      type: this.mapEventTypeToPatternType(type),
      pattern: data,
      baseline: baseline,
      deviation: this.calculatePatternDeviation(data, baseline),
      riskScore: this.calculatePatternRiskScore(data, baseline),
      timestamp: Date.now()
    };

    return pattern;
  }

  // Map event type sang pattern type
  private mapEventTypeToPatternType(eventType: string): BehaviorPattern['type'] {
    if (eventType.includes('login') || eventType.includes('auth')) {
      return 'login';
    } else if (eventType.includes('access') || eventType.includes('navigation')) {
      return 'navigation';
    } else if (eventType.includes('data') || eventType.includes('query')) {
      return 'data_access';
    } else if (eventType.includes('transaction')) {
      return 'transaction';
    } else {
      return 'system';
    }
  }

  // Tính độ lệch pattern
  private calculatePatternDeviation(data: any, baseline: BehaviorBaseline): number {
    let deviation = 0;

    // Đánh giá tần suất đăng nhập
    if (data.loginCount) {
      const loginDeviation = Math.abs(data.loginCount - baseline.loginFrequency.mean) / baseline.loginFrequency.stdDev;
      deviation += Math.min(loginDeviation, 3);
    }

    // Đánh giá thời gian truy cập
    if (data.timestamp) {
      const hour = new Date(data.timestamp).getHours();
      const expectedAccess = baseline.accessPattern.timeDistribution[hour];
      if (expectedAccess === 0) {
        deviation += 2; // Giờ không bình thường
      }
    }

    // Đánh giá volume data access
    if (data.dataVolume) {
      const dataDeviation = Math.abs(data.dataVolume - baseline.dataAccess.volume.mean) / baseline.dataAccess.volume.stdDev;
      deviation += Math.min(dataDeviation, 3);
    }

    return deviation;
  }

  // Tính điểm rủi ro pattern
  private calculatePatternRiskScore(data: any, baseline: BehaviorBaseline): number {
    const deviation = this.calculatePatternDeviation(data, baseline);
    
    // Rủi ro cơ bản từ độ lệch
    let riskScore = Math.min(deviation * 25, 100);

    // Điều chỉnh theo loại hành vi
    if (data.suspicious) riskScore += 20;
    if (data.failedAttempts && data.failedAttempts > 3) riskScore += 30;
    if (data.unusualLocation) riskScore += 25;
    if (data.unknownDevice) riskScore += 20;

    return Math.min(riskScore, 100);
  }

  // Phân tích behavior pattern
  private analyzeBehaviorPattern(pattern: BehaviorPattern): void {
    if (pattern.riskScore > 70) {
      this.createThreatFromPattern(pattern);
    }

    // Cập nhật baseline
    this.updateBaseline(pattern);
  }

  // Tạo threat từ pattern
  private createThreatFromPattern(pattern: BehaviorPattern): void {
    const threat: Threat = {
      id: `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: ThreatType.ANOMALOUS_BEHAVIOR,
      severity: this.determineSeverityFromScore(pattern.riskScore),
      status: ThreatStatus.DETECTED,
      title: 'Hành vi bất thường được phát hiện',
      description: `Phát hiện hành vi ${pattern.type} bất thường với điểm rủi ro ${pattern.riskScore}`,
      source: {
        userId: pattern.userId,
        sessionId: pattern.sessionId
      },
      target: {},
      indicators: this.createIndicatorsFromPattern(pattern),
      timeline: [{
        timestamp: pattern.timestamp,
        event: 'pattern_detected',
        description: `Behavior pattern ${pattern.id} detected with risk score ${pattern.riskScore}`,
        severity: this.determineSeverityFromScore(pattern.riskScore),
        data: { patternId: pattern.id, deviation: pattern.deviation }
      }],
      confidence: Math.min(pattern.deviation / 3 * 100, 100),
      riskScore: pattern.riskScore,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: ['behavioral', 'anomaly', pattern.type],
      metadata: { patternId: pattern.id }
    };

    this.threats.set(threat.id, threat);
    this.addDetectionResult(threat, DetectionMethod.STATISTICAL, { patternId: pattern.id });
    this.emit('threatDetected', threat);
  }

  // Xác định mức độ nghiêm trọng từ điểm số
  private determineSeverityFromScore(score: number): ThreatSeverity {
    if (score >= 80) return ThreatSeverity.CRITICAL;
    if (score >= 60) return ThreatSeverity.HIGH;
    if (score >= 40) return ThreatSeverity.MEDIUM;
    return ThreatSeverity.LOW;
  }

  // Tạo indicators từ pattern
  private createIndicatorsFromPattern(pattern: BehaviorPattern): ThreatIndicator[] {
    const indicators: ThreatIndicator[] = [];

    if (pattern.userId) {
      indicators.push({
        id: `indicator_user_${Date.now()}`,
        type: 'user_agent',
        value: pattern.userId,
        confidence: pattern.riskScore / 100,
        severity: this.determineSeverityFromScore(pattern.riskScore),
        description: `User ${pattern.userId} exhibiting unusual behavior`,
        firstSeen: pattern.timestamp,
        lastSeen: pattern.timestamp,
        occurrences: 1
      });
    }

    return indicators;
  }

  // Đánh giá detection rules
  private evaluateDetectionRules(pattern: BehaviorPattern): Threat[] {
    const threats: Threat[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      const matches = this.evaluateRule(rule, pattern);
      if (matches.length >= (rule.threshold.count || 1)) {
        const threat = this.createThreatFromRule(rule, pattern, matches);
        threats.push(threat);
      }
    }

    return threats;
  }

  // Đánh giá rule
  private evaluateRule(rule: DetectionRule, pattern: BehaviorPattern): any[] {
    const matches: any[] = [];

    for (const condition of rule.conditions) {
      if (this.evaluateCondition(condition, pattern.pattern)) {
        matches.push(condition);
      }
    }

    return matches;
  }

  // Đánh giá điều kiện
  private evaluateCondition(condition: RuleCondition, data: any): boolean {
    const value = this.getNestedValue(data, condition.field);

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'regex':
        return new RegExp(condition.value).test(String(value));
      case 'greater_than':
        return Number(value) > Number(condition.value);
      case 'less_than':
        return Number(value) < Number(condition.value);
      default:
        return false;
    }
  }

  // Lấy giá trị nested
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // Tạo threat từ rule
  private createThreatFromRule(rule: DetectionRule, pattern: BehaviorPattern, matches: any[]): Threat {
    const threat: Threat = {
      id: `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: rule.threatType,
      severity: rule.threshold.severity || this.determineSeverityFromScore(pattern.riskScore),
      status: ThreatStatus.DETECTED,
      title: rule.name,
      description: rule.description,
      source: {
        userId: pattern.userId,
        sessionId: pattern.sessionId
      },
      target: {},
      indicators: [],
      timeline: [{
        timestamp: Date.now(),
        event: 'rule_matched',
        description: `Detection rule ${rule.name} triggered`,
        severity: this.determineSeverityFromScore(pattern.riskScore),
        data: { ruleId: rule.id, matches }
      }],
      confidence: Math.min(matches.length / rule.conditions.length * 100, 100),
      riskScore: pattern.riskScore,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: ['rule-based', rule.threatType],
      metadata: { ruleId: rule.id, patternId: pattern.id }
    };

    return threat;
  }

  // Xử lý threat được phát hiện
  private handleDetectedThreat(threat: Threat): void {
    this.threats.set(threat.id, threat);

    // Thực hiện actions từ rule
    const rule = Array.from(this.rules.values())
      .find(r => r.threatType === threat.type);

    if (rule) {
      this.executeRuleActions(rule, threat);
    }

    this.addDetectionResult(threat, DetectionMethod.RULE_BASED, rule ? { ruleId: rule.id } : undefined);
    this.emit('threatDetected', threat);
  }

  // Thực hiện actions từ rule
  private executeRuleActions(rule: DetectionRule, threat: Threat): void {
    for (const action of rule.actions) {
      switch (action.type) {
        case 'alert':
          this.createAlert(threat, action.parameters);
          break;
        case 'block':
          this.blockSource(threat.source, action.parameters);
          break;
        case 'quarantine':
          this.quarantineThreat(threat, action.parameters);
          break;
        case 'escalate':
          this.escalateThreat(threat, action.parameters);
          break;
        case 'log':
          this.logThreat(threat, action.parameters);
          break;
      }
    }
  }

  // Tạo alert
  private createAlert(threat: Threat, parameters: any): void {
    this.emit('alertCreated', {
      threat,
      parameters,
      timestamp: Date.now()
    });
  }

  // Block nguồn
  private blockSource(source: Threat['source'], parameters: any): void {
    this.emit('sourceBlocked', {
      source,
      parameters,
      timestamp: Date.now()
    });
  }

  // Cô lập threat
  private quarantineThreat(threat: Threat, parameters: any): void {
    threat.status = ThreatStatus.CONTAINED;
    threat.updatedAt = Date.now();
    
    this.emit('threatQuarantined', {
      threat,
      parameters,
      timestamp: Date.now()
    });
  }

  // Leo thang threat
  private escalateThreat(threat: Threat, parameters: any): void {
    threat.severity = ThreatSeverity.CRITICAL;
    threat.updatedAt = Date.now();
    
    this.emit('threatEscalated', {
      threat,
      parameters,
      timestamp: Date.now()
    });
  }

  // Log threat
  private logThreat(threat: Threat, parameters: any): void {
    this.emit('threatLogged', {
      threat,
      parameters,
      timestamp: Date.now()
    });
  }

  // Đánh giá indicators đang hoạt động
  private evaluateActiveIndicators(): void {
    for (const indicator of this.indicators.values()) {
      if (Date.now() - indicator.lastSeen < 300000) { // 5 phút
        this.evaluateIndicator(indicator);
      }
    }
  }

  // Đánh giá indicator
  private evaluateIndicator(indicator: ThreatIndicator): void {
    if (indicator.occurrences > 10 && indicator.confidence > 0.8) {
      this.createThreatFromIndicator(indicator);
    }
  }

  // Tạo threat từ indicator
  private createThreatFromIndicator(indicator: ThreatIndicator): void {
    const threat: Threat = {
      id: `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: ThreatType.MALICIOUS_PAYLOAD,
      severity: indicator.severity,
      status: ThreatStatus.DETECTED,
      title: 'Chỉ báo độc hại được phát hiện',
      description: `Indicator ${indicator.type}: ${indicator.value} được phát hiện với độ tin cậy ${indicator.confidence}`,
      source: {},
      target: {},
      indicators: [indicator],
      timeline: [{
        timestamp: Date.now(),
        event: 'indicator_triggered',
        description: `Threat indicator triggered: ${indicator.value}`,
        severity: indicator.severity,
        data: { indicatorId: indicator.id }
      }],
      confidence: indicator.confidence * 100,
      riskScore: indicator.confidence * 100,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: ['indicator', indicator.type],
      metadata: { indicatorId: indicator.id }
    };

    this.threats.set(threat.id, threat);
    this.addDetectionResult(threat, DetectionMethod.RULE_BASED, { indicatorId: indicator.id });
    this.emit('threatDetected', threat);
  }

  // Cập nhật threat scores
  private updateThreatScores(): void {
    for (const threat of this.threats.values()) {
      if (threat.status === ThreatStatus.DETECTED) {
        // Tăng điểm rủi ro theo thời gian
        const age = Date.now() - threat.createdAt;
        const ageMultiplier = Math.min(age / 3600000, 2); // Tối đa 2x sau 1 giờ
        threat.riskScore = Math.min(threat.riskScore * ageMultiplier, 100);
        threat.updatedAt = Date.now();
      }
    }
  }

  // Lấy baseline cho user
  private getBaselineForUser(userId: string): BehaviorBaseline {
    return this.baselineProfiles.get(userId) || this.baselineProfiles.get('default')!;
  }

  // Cập nhật baseline
  private updateBaseline(pattern: BehaviorPattern): void {
    if (!pattern.userId) return;

    let baseline = this.baselineProfiles.get(pattern.userId);
    if (!baseline) {
      baseline = { ...this.baselineProfiles.get('default')!, userId: pattern.userId };
      this.baselineProfiles.set(pattern.userId, baseline);
    }

    // Cập nhật baseline với pattern mới (simple moving average)
    const alpha = 0.1; // Learning rate
    
    if (pattern.pattern.dataVolume) {
      baseline.dataAccess.volume.mean = 
        baseline.dataAccess.volume.mean * (1 - alpha) + 
        pattern.pattern.dataVolume * alpha;
    }

    baseline.lastUpdated = Date.now();
  }

  private normalizeConfidence(confidence: number): number {
    if (Number.isNaN(confidence)) return 0;
    if (confidence > 1) return Math.min(confidence / 100, 1);
    if (confidence < 0) return 0;
    return confidence;
  }

  private calculateActionRiskScore(action: UserAction): number {
    let score = 10;

    if (action.metadata?.suspiciousPattern || action.metadata?.blocked) {
      score += 60;
    }

    if (action.statusCode && action.statusCode >= 500) score += 30;
    else if (action.statusCode && action.statusCode >= 400) score += 20;

    if (action.responseTime && action.responseTime > 5000) score += 10;

    if (action.type === 'data_access' || action.type === 'card_lookup') {
      score += 10;
    }

    return Math.min(score, 100);
  }

  private mapActionToThreatType(action: UserAction): ThreatType {
    switch (action.type) {
      case 'login':
        return ThreatType.SUSPICIOUS_LOGIN;
      case 'card_lookup':
        return ThreatType.CARD_TESTING;
      case 'iban_validate':
        return ThreatType.UNUSUAL_ACCESS_PATTERN;
      case 'transaction':
        return ThreatType.PRIVILEGE_ESCALATION;
      case 'data_access':
        return ThreatType.DATA_EXFILTRATION;
      case 'suspicious':
        return ThreatType.ANOMALOUS_BEHAVIOR;
      case 'api_call':
      default:
        return ThreatType.UNAUTHORIZED_API_ACCESS;
    }
  }

  private addDetectionResult(
    threat: Threat,
    detectionMethod: DetectionMethod,
    details?: Record<string, any>
  ): void {
    if (this.detectionResults.some(result => result.id === threat.id)) {
      return;
    }

    const result: ThreatDetectionResult = {
      id: threat.id,
      threatType: threat.type,
      detectionMethod,
      confidence: this.normalizeConfidence(threat.confidence),
      riskScore: threat.riskScore,
      timestamp: new Date(threat.createdAt).toISOString(),
      userId: threat.source.userId,
      sessionId: threat.source.sessionId,
      ipAddress: threat.source.ip,
      userAgent: threat.source.userAgent,
      indicators: threat.tags,
      details: {
        ...threat.metadata,
        ...details
      },
      requiresEscalation: threat.severity === ThreatSeverity.CRITICAL || threat.riskScore >= 80
    };

    this.detectionResults.push(result);
    if (this.detectionResults.length > 5000) {
      this.detectionResults.shift();
    }
  }

  // Dọn dẹp dữ liệu cũ
  public cleanupOldData(olderThanDays: number = 1): void {
    const now = Date.now();
    const maxAge = Math.max(olderThanDays, 1) * 24 * 60 * 60 * 1000;
    let cleanedCount = 0;

    // Dọn dẹp patterns cũ
    for (const [id, pattern] of this.patterns.entries()) {
      if (now - pattern.timestamp > maxAge) {
        this.patterns.delete(id);
        cleanedCount++;
      }
    }

    // Dọn dẹp threats đã resolved
    for (const [id, threat] of this.threats.entries()) {
      if (threat.status === ThreatStatus.RESOLVED && 
          threat.resolvedAt && 
          now - threat.resolvedAt > maxAge) {
        this.threats.delete(id);
        cleanedCount++;
      }
    }

    const beforeCount = this.detectionResults.length;
    this.detectionResults = this.detectionResults.filter(result => {
      return new Date(result.timestamp).getTime() >= now - maxAge;
    });
    cleanedCount += beforeCount - this.detectionResults.length;

    this.emit('cleanup', { cleanedCount });
  }

  // Public API Methods

  public trackUserAction(
    userId: string,
    action: UserAction,
    sessionId?: string,
    ipAddress?: string,
    userAgent?: string
  ): void {
    const normalizedAction: UserAction = {
      ...action,
      id: action.id || `action_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: action.timestamp || new Date().toISOString(),
      metadata: action.metadata && typeof action.metadata === 'object' ? action.metadata : {}
    };

    const actionRiskScore = this.calculateActionRiskScore(normalizedAction);
    const confidence = Math.min(Math.max(actionRiskScore / 100, 0.2), 1);
    const threatType = this.mapActionToThreatType(normalizedAction);

    const result: ThreatDetectionResult = {
      id: normalizedAction.id,
      threatType,
      detectionMethod: DetectionMethod.STATISTICAL,
      confidence,
      riskScore: actionRiskScore,
      timestamp: normalizedAction.timestamp,
      userId,
      sessionId,
      ipAddress,
      userAgent,
      indicators: normalizedAction.metadata?.indicators,
      details: normalizedAction.metadata,
      requiresEscalation: actionRiskScore >= 80
    };

    this.detectionResults.push(result);
    if (this.detectionResults.length > 5000) {
      this.detectionResults.shift();
    }
  }

  public getDetectionResults(limit: number = 50): ThreatDetectionResult[] {
    return this.detectionResults
      .slice()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  public getDetectionResultsByUser(userId: string, limit: number = 50): ThreatDetectionResult[] {
    return this.getDetectionResults(limit * 2)
      .filter(result => result.userId === userId)
      .slice(0, limit);
  }

  public addPattern(pattern: BehavioralPatternConfig): void {
    const now = Date.now();
    const normalizedPattern: BehavioralPatternConfig = {
      ...pattern,
      isActive: pattern.isActive !== undefined ? pattern.isActive : true,
      createdAt: pattern.createdAt || now,
      updatedAt: now
    };

    this.patternConfigs.set(pattern.id, normalizedPattern);
    this.emit('patternAdded', normalizedPattern);
  }

  public removePattern(patternId: string): boolean {
    const removed = this.patternConfigs.delete(patternId);
    if (removed) {
      this.emit('patternRemoved', patternId);
    }
    return removed;
  }

  public getPatterns(): BehavioralPatternConfig[] {
    return Array.from(this.patternConfigs.values());
  }

  public async retrainModel(patternId: string): Promise<boolean> {
    const pattern = this.patternConfigs.get(patternId);
    if (!pattern) return false;
    if (pattern.detectionMethod !== DetectionMethod.MACHINE_LEARNING) return false;

    pattern.updatedAt = Date.now();
    pattern.metadata = {
      ...(pattern.metadata || {}),
      lastTrainedAt: pattern.updatedAt
    };
    this.patternConfigs.set(patternId, pattern);
    this.emit('modelRetrained', { patternId });
    return true;
  }

  public extractSessionId(req: Request): string {
    const headerSessionId = req.headers['x-session-id'];
    if (headerSessionId) {
      return Array.isArray(headerSessionId) ? headerSessionId[0] : headerSessionId;
    }
    return req.cookies?.sessionId || this.generateSessionId();
  }

  public generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  public determineActionType(req: Request): UserAction['type'] {
    const path = req.path;
    const method = req.method;

    if (path.includes('/auth/') && method === 'POST') return 'login';
    if (path.includes('/logout')) return 'logout';
    if (path.includes('/bin/') || path.includes('/card/')) return 'card_lookup';
    if (path.includes('/iban/')) return 'iban_validate';
    if (path.includes('/transaction/')) return 'transaction';
    if (path.includes('/admin/') || path.includes('/sensitive/')) return 'data_access';

    return 'api_call';
  }

  public extractActionMetadata(req: Request, res: Response, responseTime: number): Record<string, any> {
    return {
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type'),
      requestSize: JSON.stringify(req.body).length,
      responseSize: res.get('Content-Length') || 0,
      responseTime,
      isApiRequest: req.path.startsWith('/api/'),
      isAdminRequest: req.path.includes('/admin'),
      isSensitiveOperation: req.path.includes('/sensitive') || req.path.includes('/admin')
    };
  }

  public maskEmail(email: string): string {
    if (!email || typeof email !== 'string') return 'unknown';
    const [username, domain] = email.split('@');
    if (!username || !domain) return 'unknown';

    const maskedUsername = username.length > 2 ?
      username[0] + '*'.repeat(username.length - 2) + username[username.length - 1] :
      '*'.repeat(username.length);

    return `${maskedUsername}@${domain}`;
  }

  public determineHighValueOperation(req: Request): string {
    const path = req.path;

    if (path.includes('/admin/users')) return 'user_management';
    if (path.includes('/admin/system')) return 'system_administration';
    if (path.includes('/payment/')) return 'payment_processing';
    if (path.includes('/sensitive/')) return 'sensitive_data_access';
    if (path.includes('/export/')) return 'data_export';
    if (path.includes('/delete/')) return 'data_deletion';

    return 'standard_operation';
  }

  // Lấy tất cả threats
  public getThreats(): Threat[] {
    return Array.from(this.threats.values());
  }

  // Lấy threat theo ID
  public getThreat(id: string): Threat | undefined {
    return this.threats.get(id);
  }

  // Cập nhật status threat
  public updateThreatStatus(id: string, status: ThreatStatus, assignedTo?: string): boolean {
    const threat = this.threats.get(id);
    if (!threat) return false;

    threat.status = status;
    threat.assignedTo = assignedTo;
    threat.updatedAt = Date.now();

    if (status === ThreatStatus.RESOLVED) {
      threat.resolvedAt = Date.now();
    }

    this.emit('threatUpdated', threat);
    return true;
  }

  // Thêm rule mới
  public addRule(rule: DetectionRule): void {
    this.rules.set(rule.id, rule);
    this.emit('ruleAdded', rule);
  }

  // Xóa rule
  public removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      this.emit('ruleRemoved', ruleId);
    }
    return removed;
  }

  // Lấy tất cả rules
  public getRules(): DetectionRule[] {
    return Array.from(this.rules.values());
  }

  // Lấy indicators
  public getIndicators(): ThreatIndicator[] {
    return Array.from(this.indicators.values());
  }

  // Lấy thống kê
  public getStatistics(): any {
    const threats = Array.from(this.threats.values());
    const patterns = Array.from(this.patterns.values());

    return {
      totalThreats: threats.length,
      activeThreats: threats.filter(t => t.status === ThreatStatus.DETECTED).length,
      resolvedThreats: threats.filter(t => t.status === ThreatStatus.RESOLVED).length,
      threatsByType: this.groupThreatsByType(threats),
      threatsBySeverity: this.groupThreatsBySeverity(threats),
      averageRiskScore: threats.length > 0 ? threats.reduce((sum, t) => sum + t.riskScore, 0) / threats.length : 0,
      activePatterns: patterns.filter(p => Date.now() - p.timestamp < 300000).length,
      totalIndicators: this.indicators.size
    };
  }

  // Group threats by type
  private groupThreatsByType(threats: Threat[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    
    for (const threat of threats) {
      grouped[threat.type] = (grouped[threat.type] || 0) + 1;
    }
    
    return grouped;
  }

  // Group threats by severity
  private groupThreatsBySeverity(threats: Threat[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    
    for (const threat of threats) {
      grouped[threat.severity] = (grouped[threat.severity] || 0) + 1;
    }
    
    return grouped;
  }
}

// Interface cho baseline hành vi
interface BehaviorBaseline {
  userId: string;
  loginFrequency: { mean: number; stdDev: number; pattern: any[] };
  accessPattern: { 
    endpoints: string[]; 
    frequency: Record<string, number>; 
    timeDistribution: number[];
  };
  dataAccess: { 
    volume: { mean: number; stdDev: number };
    sensitivity: { mean: number; stdDev: number };
  };
  sessionDuration: { mean: number; stdDev: number };
  deviceUsage: { count: number; knownDevices: string[] };
  lastUpdated: number;
}

// Export singleton
export const threatDetection = new BehavioralThreatDetection();
export const behavioralThreatDetection = threatDetection;
