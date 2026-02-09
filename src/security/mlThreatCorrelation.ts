import { logger } from '@/utils/logger';
import { siemFramework, IncidentCategory, SecuritySeverity } from '@/security/siemFramework';
import { behavioralThreatDetection, ThreatType, ThreatDetectionResult } from '@/security/behavioralThreatDetection';
import { automatedResponseSystem, ResponseAction } from '@/security/automatedResponse';

// Advanced ML-powered Threat Correlation Engine
export enum CorrelationType {
  SPATIAL = 'spatial',         // Không gian (IP, Location)
  TEMPORAL = 'temporal',       // Thời gian
  BEHAVIORAL = 'behavioral',     // Hành vi
  NETWORK = 'network',           // Mạng
  IDENTITY = 'identity',         // Identity
  CAMPAIGN = 'campaign'         // Campaign/Attack pattern
}

export enum CorrelationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ThreatCorrelation {
  id: string;
  name: string;
  description: string;
  type: CorrelationType;
  severity: CorrelationSeverity;
  confidence: number;
  threatIds: string[];
  relatedEntities: {
    ipAddresses: string[];
    userIds: string[];
    sessions: string[];
    devices: string[];
    locations: string[];
  };
  timeline: CorrelationEvent[];
  patterns: CorrelationPattern[];
  indicators: CorrelationIndicator[];
  recommendations: string[];
  requiresEscalation: boolean;
  createdAt: string;
  lastUpdated: string;
}

export interface CorrelationEvent {
  id: string;
  timestamp: string;
  threatId: string;
  eventType: string;
  severity: number;
  confidence: number;
  metadata: Record<string, any>;
}

export interface CorrelationPattern {
  id: string;
  type: string;
  description: string;
  strength: number;
  evidence: any[];
}

export interface CorrelationIndicator {
  type: string;
  value: string | number;
  description: string;
  severity: number;
}

export interface CorrelationRule {
  id: string;
  name: string;
  description: string;
  type: CorrelationType;
  enabled: boolean;
  conditions: CorrelationCondition[];
  threshold: {
    minThreats: number;
    timeWindowMinutes: number;
    minConfidence: number;
    severityThreshold: number;
  };
  actions: {
    createIncident: boolean;
    notifyStakeholders: boolean;
    triggerResponse: boolean;
    responseActions?: ResponseAction[];
  };
}

export interface CorrelationCondition {
  field: string;
  operator: 'eq' | 'ne' | 'in' | 'not_in' | 'contains' | 'regex' | 'gt' | 'lt' | 'between';
  value: any;
  weight: number;
}

export interface ThreatEntity {
  type: 'ip' | 'user' | 'session' | 'device' | 'location';
  value: string;
  riskScore: number;
  lastSeen: string;
  associatedThreats: string[];
}

export class MLThreatCorrelation {
  private correlations: Map<string, ThreatCorrelation> = new Map();
  private rules: Map<string, CorrelationRule> = new Map();
  private entities: Map<string, ThreatEntity> = new Map();
  private patterns: Map<string, CorrelationPattern> = new Map();

  constructor() {
    this.initializeDefaultRules();
    this.startCorrelationEngine();
  }

  private initializeDefaultRules(): void {
    const defaultRules: CorrelationRule[] = [
      // Quy tắc correlated attack từ cùng IP
      {
        id: 'coordinated_attack_ip',
        name: 'Coordinated Attack from Single IP',
        description: 'Phát hiện nhiều threat types từ cùng một IP trong thời gian ngắn',
        type: CorrelationType.SPATIAL,
        enabled: true,
        conditions: [
          { field: 'ipAddress', operator: 'eq', value: 'same', weight: 0.4 },
          { field: 'threatType', operator: 'in', value: ['account_takeover', 'card_testing', 'unauthorized_api_access'], weight: 0.3 },
          { field: 'timeWindow', operator: 'lt', value: 30, weight: 0.3 }
        ],
        threshold: {
          minThreats: 3,
          timeWindowMinutes: 30,
          minConfidence: 0.7,
          severityThreshold: 70
        },
        actions: {
          createIncident: true,
          notifyStakeholders: true,
          triggerResponse: true,
          responseActions: [ResponseAction.BLOCK_IP, ResponseAction.NOTIFY_SECURITY]
        }
      },

      // Quy tắc distributed attack
      {
        id: 'distributed_attack_campaign',
        name: 'Distributed Attack Campaign',
        description: 'Phát hiện cùng threat type từ nhiều IP locations',
        type: CorrelationType.CAMPAIGN,
        enabled: true,
        conditions: [
          { field: 'threatType', operator: 'eq', value: 'card_testing', weight: 0.4 },
          { field: 'ipAddress', operator: 'not_in', value: 'unique', weight: 0.3 },
          { field: 'timeWindow', operator: 'lt', value: 60, weight: 0.3 }
        ],
        threshold: {
          minThreats: 5,
          timeWindowMinutes: 60,
          minConfidence: 0.6,
          severityThreshold: 60
        },
        actions: {
          createIncident: true,
          notifyStakeholders: true,
          triggerResponse: false
        }
      },

      // Quy tắc user behavior anomaly
      {
        id: 'user_behavior_anomaly',
        name: 'User Behavior Anomaly Pattern',
        description: 'Phát hiện pattern hành vi bất thường của user',
        type: CorrelationType.BEHAVIORAL,
        enabled: true,
        conditions: [
          { field: 'userId', operator: 'eq', value: 'same', weight: 0.4 },
          { field: 'threatType', operator: 'in', value: ['account_takeover', 'data_exfiltration', 'unauthorized_api_access'], weight: 0.4 },
          { field: 'timeWindow', operator: 'lt', value: 120, weight: 0.2 }
        ],
        threshold: {
          minThreats: 2,
          timeWindowMinutes: 120,
          minConfidence: 0.8,
          severityThreshold: 80
        },
        actions: {
          createIncident: true,
          notifyStakeholders: true,
          triggerResponse: true,
          responseActions: [ResponseAction.QUARANTINE_USER, ResponseAction.REQUIRE_MFA]
        }
      },

      // Quy tắc temporal pattern
      {
        id: 'temporal_attack_pattern',
        name: 'Temporal Attack Pattern',
        description: 'Phát hiện tấn công theo pattern thời gian',
        type: CorrelationType.TEMPORAL,
        enabled: true,
        conditions: [
          { field: 'hourOfDay', operator: 'between', value: [2, 6], weight: 0.3 },
          { field: 'threatCount', operator: 'gt', value: 5, weight: 0.4 },
          { field: 'successRate', operator: 'lt', value: 0.3, weight: 0.3 }
        ],
        threshold: {
          minThreats: 5,
          timeWindowMinutes: 240,
          minConfidence: 0.6,
          severityThreshold: 60
        },
        actions: {
          createIncident: true,
          notifyStakeholders: true,
          triggerResponse: false
        }
      }
    ];

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });

    logger.info('Khởi tạo ML Threat Correlation rules', {
      total: defaultRules.length,
      active: defaultRules.filter(r => r.enabled).length
    });
  }

  private startCorrelationEngine(): void {
    // Chạy correlation analysis mỗi 5 phút
    const analysisTimer = setInterval(() => {
      this.performCorrelationAnalysis();
    }, 5 * 60 * 1000);
    analysisTimer.unref?.();

    // Cleanup correlation data mỗi giờ
    const cleanupTimer = setInterval(() => {
      this.cleanupOldCorrelations();
    }, 60 * 60 * 1000);
    cleanupTimer.unref?.();

    logger.info('Khởi động ML Threat Correlation Engine');
  }

  async processNewThreat(threatResult: ThreatDetectionResult): Promise<void> {
    try {
      // Cập nhật entities
      this.updateEntities(threatResult);

      // Thực thi correlation rules ngay lập tức
      await this.executeCorrelationRules(threatResult);

      logger.info('Đã xử lý threat cho correlation analysis', {
        threatId: threatResult.id,
        threatType: threatResult.threatType
      });

    } catch (error) {
      logger.error('Lỗi processing threat cho correlation', {
        threatId: threatResult.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private updateEntities(threat: ThreatDetectionResult): void {
    // Update IP entity
    if (threat.ipAddress) {
      const ipKey = `ip:${threat.ipAddress}`;
      const existingIp = this.entities.get(ipKey);
      
      this.entities.set(ipKey, {
        type: 'ip',
        value: threat.ipAddress,
        riskScore: Math.max(existingIp?.riskScore || 0, threat.riskScore),
        lastSeen: threat.timestamp,
        associatedThreats: [...(existingIp?.associatedThreats || []), threat.id]
      });
    }

    // Update User entity
    if (threat.userId) {
      const userKey = `user:${threat.userId}`;
      const existingUser = this.entities.get(userKey);
      
      this.entities.set(userKey, {
        type: 'user',
        value: threat.userId,
        riskScore: Math.max(existingUser?.riskScore || 0, threat.riskScore),
        lastSeen: threat.timestamp,
        associatedThreats: [...(existingUser?.associatedThreats || []), threat.id]
      });
    }

    // Update Session entity
    if (threat.sessionId) {
      const sessionKey = `session:${threat.sessionId}`;
      const existingSession = this.entities.get(sessionKey);
      
      this.entities.set(sessionKey, {
        type: 'session',
        value: threat.sessionId,
        riskScore: Math.max(existingSession?.riskScore || 0, threat.riskScore),
        lastSeen: threat.timestamp,
        associatedThreats: [...(existingSession?.associatedThreats || []), threat.id]
      });
    }
  }

  private async executeCorrelationRules(newThreat: ThreatDetectionResult): Promise<void> {
    const enabledRules = Array.from(this.rules.values()).filter(rule => rule.enabled);
    
    for (const rule of enabledRules) {
      try {
        const correlation = await this.evaluateRule(rule, newThreat);
        
        if (correlation) {
          await this.handleCorrelation(rule, correlation);
        }
      } catch (error) {
        logger.error('Lỗi evaluating correlation rule', {
          ruleId: rule.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private async evaluateRule(rule: CorrelationRule, newThreat: ThreatDetectionResult): Promise<ThreatCorrelation | null> {
    // Lấy các threats liên quan
    const relatedThreats = this.findRelatedThreats(rule, newThreat);
    
    if (relatedThreats.length < rule.threshold.minThreats - 1) {
      return null; // -1 vì newThreat chưa được đếm
    }

    // Tính correlation score
    const correlationScore = this.calculateCorrelationScore(rule, relatedThreats, newThreat);
    
    if (correlationScore.confidence < rule.threshold.minConfidence ||
        correlationScore.severity < rule.threshold.severityThreshold) {
      return null;
    }

    // Tạo correlation object
    const correlationId = `corr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const allThreatIds = [...relatedThreats.map(t => t.id), newThreat.id];
    
    const correlation: ThreatCorrelation = {
      id: correlationId,
      name: rule.name,
      description: rule.description,
      type: rule.type,
      severity: this.getCorrelationSeverity(correlationScore.severity),
      confidence: correlationScore.confidence,
      threatIds: allThreatIds,
      relatedEntities: this.extractRelatedEntities(allThreatIds),
      timeline: this.buildTimeline(allThreatIds),
      patterns: this.identifyPatterns(relatedThreats, newThreat),
      indicators: this.extractIndicators(relatedThreats, newThreat),
      recommendations: this.generateRecommendations(rule, correlationScore),
      requiresEscalation: correlationScore.severity >= 80,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    this.correlations.set(correlationId, correlation);

    return correlation;
  }

  private findRelatedThreats(rule: CorrelationRule, newThreat: ThreatDetectionResult): ThreatDetectionResult[] {
    const allThreats = behavioralThreatDetection.getDetectionResults(1000);
    const timeWindow = rule.threshold.timeWindowMinutes * 60 * 1000;
    const cutoffTime = new Date(new Date().getTime() - timeWindow);

    return allThreats.filter(threat => {
      if (threat.id === newThreat.id) return false;
      if (new Date(threat.timestamp) < cutoffTime) return false;

      // Apply rule conditions
      return this.evaluateCondition(rule, threat, newThreat);
    });
  }

  private evaluateCondition(rule: CorrelationRule, threat: ThreatDetectionResult, newThreat: ThreatDetectionResult): boolean {
    for (const condition of rule.conditions) {
      let result = false;
      
      switch (condition.field) {
        case 'ipAddress':
          result = threat.ipAddress === newThreat.ipAddress;
          break;
        
        case 'userId':
          result = threat.userId === newThreat.userId;
          break;
        
        case 'threatType':
          if (Array.isArray(condition.value)) {
            result = condition.value.includes(threat.threatType) && 
                     condition.value.includes(newThreat.threatType);
          } else {
            result = threat.threatType === condition.value && 
                     newThreat.threatType === condition.value;
          }
          break;
        
        case 'timeWindow':
          const threatTime = new Date(threat.timestamp).getTime();
          const newThreatTime = new Date(newThreat.timestamp).getTime();
          result = Math.abs(threatTime - newThreatTime) <= condition.value * 60 * 1000;
          break;
        
        case 'hourOfDay':
          const hour = new Date(threat.timestamp).getHours();
          if (Array.isArray(condition.value)) {
            result = hour >= condition.value[0] && hour <= condition.value[1];
          } else {
            result = hour === condition.value;
          }
          break;
        
        case 'threatCount':
          // This would be calculated differently in practice
          result = true;
          break;
        
        case 'successRate':
          // This would need additional data in practice
          result = true;
          break;
        
        default:
          result = false;
      }

      // Weight the result based on condition weight
      if (!result && condition.weight > 0.5) {
        return false; // High-weight conditions must be met
      }
    }

    return true;
  }

  private calculateCorrelationScore(rule: CorrelationRule, relatedThreats: ThreatDetectionResult[], newThreat: ThreatDetectionResult): {
    confidence: number;
    severity: number;
  } {
    const allThreats = [...relatedThreats, newThreat];
    
    // Calculate confidence based on condition satisfaction
    let satisfiedConditions = 0;
    for (const condition of rule.conditions) {
      if (this.evaluateCondition(rule, newThreat, newThreat)) {
        satisfiedConditions += condition.weight;
      }
    }
    
    const totalWeight = rule.conditions.reduce((sum, c) => sum + c.weight, 0);
    const confidence = satisfiedConditions / totalWeight;
    
    // Calculate severity based on threat scores
    const avgSeverity = allThreats.reduce((sum, t) => sum + t.riskScore, 0) / allThreats.length;
    const maxSeverity = Math.max(...allThreats.map(t => t.riskScore));
    
    // Weight severity by recency and frequency
    const severity = (avgSeverity * 0.6) + (maxSeverity * 0.4);
    
    return { confidence, severity };
  }

  private getCorrelationSeverity(severityScore: number): CorrelationSeverity {
    if (severityScore >= 90) return CorrelationSeverity.CRITICAL;
    if (severityScore >= 70) return CorrelationSeverity.HIGH;
    if (severityScore >= 50) return CorrelationSeverity.MEDIUM;
    return CorrelationSeverity.LOW;
  }

  private extractRelatedEntities(threatIds: string[]): ThreatCorrelation['relatedEntities'] {
    const entities = {
      ipAddresses: new Set<string>(),
      userIds: new Set<string>(),
      sessions: new Set<string>(),
      devices: new Set<string>(),
      locations: new Set<string>()
    };

    const allThreats = behavioralThreatDetection.getDetectionResults(1000);
    const relevantThreats = allThreats.filter(t => threatIds.includes(t.id));

    relevantThreats.forEach(threat => {
      if (threat.ipAddress) entities.ipAddresses.add(threat.ipAddress);
      if (threat.userId) entities.userIds.add(threat.userId);
      if (threat.sessionId) entities.sessions.add(threat.sessionId);
    });

    return {
      ipAddresses: Array.from(entities.ipAddresses),
      userIds: Array.from(entities.userIds),
      sessions: Array.from(entities.sessions),
      devices: Array.from(entities.devices),
      locations: Array.from(entities.locations)
    };
  }

  private buildTimeline(threatIds: string[]): CorrelationEvent[] {
    const allThreats = behavioralThreatDetection.getDetectionResults(1000);
    const relevantThreats = allThreats.filter(t => threatIds.includes(t.id));

    return relevantThreats.map(threat => ({
      id: threat.id,
      timestamp: threat.timestamp,
      threatId: threat.id,
      eventType: threat.threatType,
      severity: threat.riskScore,
      confidence: threat.confidence,
      metadata: { indicators: threat.indicators || [] }
    })).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  private identifyPatterns(relatedThreats: ThreatDetectionResult[], newThreat: ThreatDetectionResult): CorrelationPattern[] {
    const patterns: CorrelationPattern[] = [];
    
    // Pattern 1: Increasing severity
    const allThreats = [...relatedThreats, newThreat].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    if (allThreats.length >= 3) {
      const isIncreasing = allThreats.slice(1).every((threat, i) => 
        threat.riskScore > allThreats[i].riskScore
      );
      
      if (isIncreasing) {
        patterns.push({
          id: 'increasing_severity',
          type: 'severity_progression',
          description: 'Risk scores increasing over time',
          strength: 0.8,
          evidence: allThreats.map(t => ({ 
            threatId: t.id, 
            riskScore: t.riskScore, 
            timestamp: t.timestamp 
          }))
        });
      }
    }

    // Pattern 2: Multi-vector attack
    const uniqueTypes = new Set(allThreats.map(t => t.threatType));
    if (uniqueTypes.size >= 2) {
      patterns.push({
        id: 'multi_vector',
        type: 'attack_diversification',
        description: 'Attack using multiple threat types',
        strength: 0.7,
        evidence: Array.from(uniqueTypes)
      });
    }

    return patterns;
  }

  private extractIndicators(relatedThreats: ThreatDetectionResult[], newThreat: ThreatDetectionResult): CorrelationIndicator[] {
    const indicators: CorrelationIndicator[] = [];
    const allThreats = [...relatedThreats, newThreat];
    
    // Common IP addresses
    const ipCounts = new Map<string, number>();
    allThreats.forEach(threat => {
      if (threat.ipAddress) {
        ipCounts.set(threat.ipAddress, (ipCounts.get(threat.ipAddress) || 0) + 1);
      }
    });
    
    for (const [ip, count] of ipCounts.entries()) {
      if (count >= 2) {
        indicators.push({
          type: 'repeated_ip',
          value: ip,
          description: `IP address appears in ${count} threats`,
          severity: Math.min(count * 20, 100)
        });
      }
    }

    // Common users
    const userCounts = new Map<string, number>();
    allThreats.forEach(threat => {
      if (threat.userId) {
        userCounts.set(threat.userId, (userCounts.get(threat.userId) || 0) + 1);
      }
    });
    
    for (const [user, count] of userCounts.entries()) {
      if (count >= 2) {
        indicators.push({
          type: 'affected_user',
          value: user,
          description: `User involved in ${count} threats`,
          severity: Math.min(count * 25, 100)
        });
      }
    }

    return indicators;
  }

  private generateRecommendations(rule: CorrelationRule, score: { confidence: number; severity: number }): string[] {
    const recommendations: string[] = [];
    
    if (score.severity >= 80) {
      recommendations.push('Khẩn cấp: Cần immediate investigation và response');
      recommendations.push('Cân nhắc blocking tất cả related entities');
    } else if (score.severity >= 60) {
      recommendations.push('Nâng cao monitoring cho related entities');
      recommendations.push('Chuẩn bị additional response measures');
    }
    
    if (score.confidence >= 0.8) {
      recommendations.push('High confidence correlation - có thể automated response');
    } else if (score.confidence >= 0.6) {
      recommendations.push('Manual review recommended trước khi trigger response');
    }
    
    return recommendations;
  }

  private async handleCorrelation(rule: CorrelationRule, correlation: ThreatCorrelation): Promise<void> {
    try {
      // Log correlation
      logger.warn('Threat correlation detected', {
        correlationId: correlation.id,
        ruleId: rule.id,
        type: correlation.type,
        severity: correlation.severity,
        threatCount: correlation.threatIds.length
      });

      // Tạo SIEM event
      const siemSeverity = correlation.severity === CorrelationSeverity.CRITICAL ? SecuritySeverity.CRITICAL :
                          correlation.severity === CorrelationSeverity.HIGH ? SecuritySeverity.HIGH :
                          correlation.severity === CorrelationSeverity.MEDIUM ? SecuritySeverity.MEDIUM :
                          SecuritySeverity.LOW;

      siemFramework.createEvent(
        IncidentCategory.ANOMALOUS_BEHAVIOR,
        siemSeverity,
        `Threat Correlation: ${correlation.name}`,
        `${correlation.description} - ${correlation.threatIds.length} threats correlated`,
        'ml_correlation',
        ['correlation', 'ml', 'security'],
        {
          correlationId: correlation.id,
          ruleId: rule.id,
          type: correlation.type,
          confidence: correlation.confidence,
          threatIds: correlation.threatIds,
          relatedEntities: correlation.relatedEntities
        },
        undefined, // Could extract userId from correlation
        undefined, // Could extract IP from correlation
        ['threat-correlation', 'ml-detection', correlation.type]
      );

      // Execute actions
      if (rule.actions.createIncident) {
        // Additional incident handling logic here
      }

      if (rule.actions.notifyStakeholders) {
        // Notification logic here
      }

      if (rule.actions.triggerResponse && rule.actions.responseActions) {
        for (const threatId of correlation.threatIds) {
          await automatedResponseSystem.processThreatDetection(threatId);
        }
      }

    } catch (error) {
      logger.error('Lỗi handling correlation', {
        correlationId: correlation.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private performCorrelationAnalysis(): void {
    try {
      // Periodic comprehensive correlation analysis
      const recentThreats = behavioralThreatDetection.getDetectionResults(500);
      const timeWindow = 60 * 60 * 1000; // 1 hour
      const cutoffTime = new Date(Date.now() - timeWindow);

      const recentThreatsInWindow = recentThreats.filter(threat => 
        new Date(threat.timestamp) >= cutoffTime
      );

      if (recentThreatsInWindow.length > 0) {
        // Advanced ML correlation logic here
        this.performAdvancedMLCorrelation(recentThreatsInWindow);
      }

    } catch (error) {
      logger.error('Lỗi trong periodic correlation analysis', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private performAdvancedMLCorrelation(threats: ThreatDetectionResult[]): void {
    // Implement advanced ML algorithms for correlation:
    // - Clustering algorithms (DBSCAN, K-means)
    // - Anomaly detection on correlation patterns
    // - Time series analysis for temporal patterns
    // - Graph-based correlation analysis
    
    logger.debug('Thực hiện advanced ML correlation analysis', {
      threatCount: threats.length
    });

    // Placeholder for advanced ML correlation
    // In production, this would use actual ML libraries
  }

  private cleanupOldCorrelations(): void {
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
    let cleanedCount = 0;

    for (const [id, correlation] of this.correlations.entries()) {
      if (new Date(correlation.createdAt) < cutoffDate) {
        this.correlations.delete(id);
        cleanedCount++;
      }
    }

    // Cleanup old entities
    const entityCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day
    let entityCleanedCount = 0;
    
    for (const [id, entity] of this.entities.entries()) {
      if (new Date(entity.lastSeen) < entityCutoff) {
        this.entities.delete(id);
        entityCleanedCount++;
      }
    }

    if (cleanedCount > 0 || entityCleanedCount > 0) {
      logger.info('Đã cleanup old correlations và entities', {
        cleanedCorrelations: cleanedCount,
        cleanedEntities: entityCleanedCount
      });
    }
  }

  // Public API methods
  getCorrelations(limit: number = 50): ThreatCorrelation[] {
    return Array.from(this.correlations.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  getCorrelation(correlationId: string): ThreatCorrelation | null {
    return this.correlations.get(correlationId) || null;
  }

  getEntities(): ThreatEntity[] {
    return Array.from(this.entities.values())
      .sort((a, b) => b.riskScore - a.riskScore);
  }

  addRule(rule: CorrelationRule): void {
    this.rules.set(rule.id, rule);
    logger.info('Đã thêm correlation rule', { 
      ruleId: rule.id, 
      type: rule.type 
    });
  }

  removeRule(ruleId: string): void {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      logger.info('Đã xóa correlation rule', { ruleId });
    }
  }

  getRules(): CorrelationRule[] {
    return Array.from(this.rules.values());
  }

  updateRule(ruleId: string, updates: Partial<CorrelationRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    const updatedRule = { ...rule, ...updates };
    this.rules.set(ruleId, updatedRule);

    logger.info('Đã cập nhật correlation rule', { 
      ruleId, 
      updatedFields: Object.keys(updates) 
    });

    return true;
  }
}

// Singleton instance
export const mlThreatCorrelation = new MLThreatCorrelation();
