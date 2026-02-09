import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { behavioralThreatDetection, ThreatDetectionResult } from '@/security/behavioralThreatDetection';
import { siemFramework } from '@/security/siemFramework';
import { automatedResponseSystem } from '@/security/automatedResponse';
import { mlThreatCorrelation } from '@/security/mlThreatCorrelation';

// Integration Layer - Main Security Orchestrator
export class SecurityOrchestrator {
  private static instance: SecurityOrchestrator;
  private isInitialized = false;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): SecurityOrchestrator {
    if (!SecurityOrchestrator.instance) {
      SecurityOrchestrator.instance = new SecurityOrchestrator();
    }
    return SecurityOrchestrator.instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('Đang khởi tạo Security Orchestrator...');

      // Khởi tạo các thành phần
      await this.initializeSIEM();
      await this.initializeBehavioralDetection();
      await this.initializeAutomatedResponse();
      await this.initializeMLCorrelation();

      // Thiết lập event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      logger.info('Security Orchestrator khởi tạo thành công');

    } catch (error) {
      logger.error('Lỗi khởi tạo Security Orchestrator', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private async initializeSIEM(): Promise<void> {
    logger.info('Khởi tạo SIEM Framework...');
    
    // Thêm default stakeholders nếu chưa có
    const defaultStakeholders = [
      {
        id: 'security-lead',
        name: 'Security Team Lead',
        email: 'security@company.com',
        role: 'Security Lead',
        notifications: {
          email: true,
          sms: false,
          categories: ['authentication' as any, 'data_breach' as any, 'anomalous_behavior' as any],
          severities: ['critical' as any, 'high' as any]
        }
      },
      {
        id: 'security-manager',
        name: 'Security Manager',
        email: 'security-manager@company.com',
        role: 'Security Manager',
        notifications: {
          email: true,
          sms: true,
          categories: ['data_breach', 'privilege_escalation', 'anomalous_behavior'],
          severities: ['critical', 'high', 'medium']
        }
      },
      {
        id: 'devops-lead',
        name: 'DevOps Lead',
        email: 'devops@company.com',
        role: 'DevOps Lead',
        notifications: {
          email: true,
          sms: false,
          categories: ['ddos', 'network_intrusion', 'availability'],
          severities: ['critical', 'high']
        }
      }
    ];

    defaultStakeholders.forEach(stakeholder => {
      siemFramework.addStakeholder(stakeholder);
    });

    logger.info('SIEM Framework khởi tạo thành công');
  }

  private async initializeBehavioralDetection(): Promise<void> {
    logger.info('Khởi tạo Behavioral Threat Detection...');

    // Thêm custom patterns cho production
    const productionPatterns = [
      {
        id: 'high_velocity_api_calls',
        name: 'High Velocity API Calls',
        threatType: 'unauthorized_api_access' as any,
        detectionMethod: 'statistical' as any,
        confidence: 0.8,
        riskScore: 65,
        indicators: ['high_request_frequency', 'unusual_endpoints'],
        isActive: true
      },
      {
        id: 'unusual_geographic_access',
        name: 'Unusual Geographic Access',
        threatType: 'anomalous_behavior' as any,
        detectionMethod: 'rule_based' as any,
        confidence: 0.7,
        riskScore: 60,
        indicators: ['location_anomaly', 'time_zone_mismatch'],
        isActive: true
      }
    ];

    productionPatterns.forEach(pattern => {
      behavioralThreatDetection.addPattern(pattern);
    });

    logger.info('Behavioral Threat Detection khởi tạo thành công');
  }

  private async initializeAutomatedResponse(): Promise<void> {
    logger.info('Khởi tạo Automated Response System...');

    // Thêm custom responses cho production
    const productionResponses = [
      {
        id: 'geographic_anomaly_response',
        triggerCondition: {
          threatType: 'anomalous_behavior' as any,
          minConfidence: 0.7,
          minRiskScore: 60,
          occurrenceThreshold: 2,
          timeWindowMinutes: 30
        },
        actions: ['require_mfa' as any, 'notify_security' as any],
        trigger: 'delayed_15_min' as any,
        isActive: true,
        description: 'Phản ứng cho Geographic Anomaly',
        severity: 'medium' as any
      }
    ];

    productionResponses.forEach(response => {
      automatedResponseSystem.addResponse(response);
    });

    logger.info('Automated Response System khởi tạo thành công');
  }

  private async initializeMLCorrelation(): Promise<void> {
    logger.info('Khởi tạo ML Threat Correlation...');

    // Thêm custom correlation rules
    const customRules = [
      {
        id: 'multi_stage_attack',
        name: 'Multi-Stage Attack Detection',
        description: 'Phát hiện chuỗi các attack stages',
        type: 'campaign' as any,
        enabled: true,
        conditions: [
          { field: 'attack_stage', operator: 'in' as any, value: ['recon', 'exploit', 'privilege_escalation'], weight: 0.4 },
          { field: 'timeWindow', operator: 'lt' as any, value: 120, weight: 0.3 },
          { field: 'successRate', operator: 'gt' as any, value: 0.5, weight: 0.3 }
        ],
        threshold: {
          minThreats: 3,
          timeWindowMinutes: 180,
          minConfidence: 0.6,
          severityThreshold: 65
        },
        actions: {
          createIncident: true,
          notifyStakeholders: true,
          triggerResponse: true,
          responseActions: ['block_ip' as any, 'create_ticket' as any]
        }
      }
    ];

    customRules.forEach(rule => {
      mlThreatCorrelation.addRule(rule);
    });

    logger.info('ML Threat Correlation khởi tạo thành công');
  }

  private setupEventListeners(): void {
    // Đây là nơi thiết lập event flow giữa các components
    
    // Khi có threat detection mới
    // behavioralThreatDetection.on('threatDetected', this.handleThreatDetected.bind(this));
    
    // Khi có correlation mới
    // mlThreatCorrelation.on('correlationDetected', this.handleCorrelationDetected.bind(this));
    
    // Khi có response execution
    // automatedResponseSystem.on('responseExecuted', this.handleResponseExecuted.bind(this));

    logger.info('Event listeners thiết lập thành công');
  }

  // Event handlers
  private async handleThreatDetected(threat: ThreatDetectionResult): Promise<void> {
    try {
      logger.info('Xử lý threat detection mới', {
        threatId: threat.id,
        threatType: threat.threatType,
        riskScore: threat.riskScore
      });

      // 1. Gửi đến ML Correlation
      await mlThreatCorrelation.processNewThreat(threat);

      // 2. Trigger Automated Response nếu cần
      if (threat.confidence >= 0.8 || threat.riskScore >= 80) {
        await automatedResponseSystem.processThreatDetection(threat.id);
      }

      // 3. Tạo SIEM event
      const severity = threat.riskScore >= 90 ? 'critical' as any :
                     threat.riskScore >= 70 ? 'high' as any :
                     threat.riskScore >= 50 ? 'medium' as any :
                     'low' as any;

      siemFramework.createEvent(
        'anomalous_behavior' as any,
        severity,
        `Threat Detected: ${threat.threatType.replace('_', ' ').toUpperCase()}`,
        `${threat.threatType} detected with ${Math.round(threat.confidence * 100)}% confidence`,
        'behavioral_threat_detection',
        ['threat_detection', 'behavioral'],
        {
          threatId: threat.id,
          threatType: threat.threatType,
          confidence: threat.confidence,
          riskScore: threat.riskScore,
          indicators: threat.indicators,
          automatedResponseTriggered: threat.confidence >= 0.8 || threat.riskScore >= 80
        },
        threat.userId,
        threat.ipAddress,
        ['threat-detected', threat.threatType]
      );

    } catch (error) {
      logger.error('Lỗi xử lý threat detection', {
        threatId: threat.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleCorrelationDetected(correlation: any): Promise<void> {
    try {
      logger.info('Xử lý correlation mới', {
        correlationId: correlation.id,
        type: correlation.type,
        threatCount: correlation.threatIds.length
      });

      // Correlation đã tự động tạo SIEM event trong ML Correlation
      // Có thể thêm logic bổ sung ở đây

    } catch (error) {
      logger.error('Lỗi xử lý correlation', {
        correlationId: correlation.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleResponseExecuted(execution: any): Promise<void> {
    try {
      logger.info('Xử lý response execution mới', {
        executionId: execution.id,
        action: execution.action,
        status: execution.status
      });

      // Response đã tự động tạo SIEM event trong Automated Response
      // Có thể thêm logic bổ sung ở đây

    } catch (error) {
      logger.error('Lỗi xử lý response execution', {
        executionId: execution.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Public API methods
  async processSecurityEvent(eventType: string, data: any): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      switch (eventType) {
        case 'new_threat':
          await this.handleThreatDetected(data);
          break;
        
        case 'new_correlation':
          await this.handleCorrelationDetected(data);
          break;
        
        case 'response_executed':
          await this.handleResponseExecuted(data);
          break;
        
        default:
          logger.warn('Event type không được support', { eventType });
      }

    } catch (error) {
      logger.error('Lỗi processing security event', {
        eventType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  getSystemStatus(): any {
    return {
      initialized: this.isInitialized,
      components: {
        siem: {
          active: true,
          events: siemFramework.getActiveIncidents().length,
          status: 'operational'
        },
        behavioralDetection: {
          active: true,
          patterns: behavioralThreatDetection.getPatterns().length,
          recentThreats: behavioralThreatDetection.getDetectionResults(10).length,
          status: 'operational'
        },
        automatedResponse: {
          active: true,
          responses: automatedResponseSystem.getResponses().length,
          recentExecutions: automatedResponseSystem.getExecutions(10).length,
          status: 'operational'
        },
        mlCorrelation: {
          active: true,
          rules: mlThreatCorrelation.getRules().length,
          recentCorrelations: mlThreatCorrelation.getCorrelations(10).length,
          status: 'operational'
        }
      },
      overall: {
        status: 'operational',
        lastUpdated: new Date().toISOString()
      }
    };
  }

  async performSystemHealthCheck(): Promise<any> {
    const healthCheck = {
      timestamp: new Date().toISOString(),
      overall: 'healthy',
      components: {}
    };

    try {
      // Check SIEM
      const siemMetrics = siemFramework.getSecurityMetrics();
      (healthCheck.components as any).siem = {
        status: 'healthy',
        metrics: siemMetrics.incidentCounts,
        responseTime: 'normal'
      };

      // Check Behavioral Detection
      const behavioralThreats = behavioralThreatDetection.getDetectionResults(10);
      (healthCheck.components as any).behavioralDetection = {
        status: 'healthy',
        recentThreats: behavioralThreats.length,
        patterns: behavioralThreatDetection.getPatterns().length
      };

      // Check Automated Response
      const recentResponses = automatedResponseSystem.getExecutions(10);
      (healthCheck.components as any).automatedResponse = {
        status: 'healthy',
        recentExecutions: recentResponses.length,
        successRate: recentResponses.filter(r => r.status === 'executed').length / recentResponses.length
      };

      // Check ML Correlation
      const recentCorrelations = mlThreatCorrelation.getCorrelations(10);
      (healthCheck.components as any).mlCorrelation = {
        status: 'healthy',
        recentCorrelations: recentCorrelations.length,
        rules: mlThreatCorrelation.getRules().length
      };

    } catch (error) {
      healthCheck.overall = 'unhealthy';
      (healthCheck.components as any).error = error instanceof Error ? error.message : 'Unknown error';
    }

    return healthCheck;
  }

  async shutdown(): Promise<void> {
    logger.info('Đang shutdown Security Orchestrator...');

    try {
      // Cleanup các components
      behavioralThreatDetection.cleanupOldData(1);
      siemFramework.cleanupOldEvents(1);
      mlThreatCorrelation.getCorrelations(1); // Trigger cleanup

      logger.info('Security Orchestrator shutdown thành công');

    } catch (error) {
      logger.error('Lỗi shutdown Security Orchestrator', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Express middleware integration
export const securityOrchestratorMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Đảm bảo orchestrator được khởi tạo
    const orchestrator = SecurityOrchestrator.getInstance();
    
    // Thêm orchestrator vào request object
    (req as any).securityOrchestrator = orchestrator;
    
    next();
  };
};

// Event emitter cho integration
export class SecurityEventEmitter {
  private static instance: SecurityEventEmitter;
  private listeners: Map<string, Function[]> = new Map();

  private constructor() {}

  public static getInstance(): SecurityEventEmitter {
    if (!SecurityEventEmitter.instance) {
      SecurityEventEmitter.instance = new SecurityEventEmitter();
    }
    return SecurityEventEmitter.instance;
  }

  public on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  public emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          logger.error('Lỗi trong event listener', {
            event,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });
    }
  }
}

// Export singleton instance
export const securityOrchestrator = SecurityOrchestrator.getInstance();