import { Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { siemFramework, IncidentCategory, SecuritySeverity } from '@/security/siemFramework';
import { behavioralThreatDetection, ThreatType } from '@/security/behavioralThreatDetection';

// Automated Response System for Security Incidents
export enum ResponseAction {
  BLOCK_IP = 'block_ip',
  LOCK_ACCOUNT = 'lock_account', 
  RATE_LIMIT = 'rate_limit',
  REQUIRE_MFA = 'require_mfa',
  LOG_OUT_SESSIONS = 'log_out_sessions',
  NOTIFY_SECURITY = 'notify_security',
  CREATE_TICKET = 'create_ticket',
  QUARANTINE_USER = 'quarantine_user',
  DISABLE_API_KEY = 'disable_api_key',
  BLOCK_COUNTRY = 'block_country',
  SCAN_DEVICE = 'scan_device',
  CAPTCHA_CHALLENGE = 'captcha_challenge'
}

export enum ResponseTrigger {
  IMMEDIATE = 'immediate',        // Tức thì
  DELAYED_5_MIN = 'delayed_5_min', // 5 phút
  DELAYED_15_MIN = 'delayed_15_min', // 15 phút  
  DELAYED_1_HOUR = 'delayed_1_hour', // 1 giờ
  MANUAL_REVIEW = 'manual_review'   // Cần xem xét thủ công
}

export interface AutomatedResponse {
  id: string;
  triggerCondition: {
    threatType: ThreatType;
    minConfidence: number;
    minRiskScore: number;
    occurrenceThreshold?: number;
    timeWindowMinutes?: number;
  };
  actions: ResponseAction[];
  trigger: ResponseTrigger;
  isActive: boolean;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ResponseExecution {
  id: string;
  responseId: string;
  threatId: string;
  action: ResponseAction;
  status: 'pending' | 'executed' | 'failed' | 'rollback';
  executedAt?: string;
  result?: any;
  error?: string;
  metadata: Record<string, any>;
}

export interface IPBlockRecord {
  ipAddress: string;
  reason: string;
  blockedAt: string;
  expiresAt?: string;
  threatIds: string[];
  active: boolean;
}

export interface AccountLockRecord {
  userId: string;
  reason: string;
  lockedAt: string;
  lockedBy: 'system' | 'manual';
  expiresAt?: string;
  threatIds: string[];
  active: boolean;
}

export class AutomatedResponseSystem {
  private responses: Map<string, AutomatedResponse> = new Map();
  private executions: Map<string, ResponseExecution> = new Map();
  private ipBlocks: Map<string, IPBlockRecord> = new Map();
  private accountLocks: Map<string, AccountLockRecord> = new Map();
  private rateLimiters: Map<string, any> = new Map();

  constructor() {
    this.initializeDefaultResponses();
    this.startCleanupTimer();
  }

  private initializeDefaultResponses(): void {
    const defaultResponses: AutomatedResponse[] = [
      // Phản ứng ngay lập tức cho Account Takeover
      {
        id: 'account_takeover_immediate',
        triggerCondition: {
          threatType: ThreatType.ACCOUNT_TAKEOVER,
          minConfidence: 0.8,
          minRiskScore: 85,
          occurrenceThreshold: 1
        },
        actions: [
          ResponseAction.LOCK_ACCOUNT,
          ResponseAction.LOG_OUT_SESSIONS,
          ResponseAction.NOTIFY_SECURITY,
          ResponseAction.REQUIRE_MFA
        ],
        trigger: ResponseTrigger.IMMEDIATE,
        isActive: true,
        description: 'Phản ứng tức thì cho Account Takeover',
        severity: 'critical'
      },

      // Phản ứng cho Card Testing Attack
      {
        id: 'card_testing_response',
        triggerCondition: {
          threatType: ThreatType.CARD_TESTING,
          minConfidence: 0.7,
          minRiskScore: 75,
          occurrenceThreshold: 3,
          timeWindowMinutes: 15
        },
        actions: [
          ResponseAction.BLOCK_IP,
          ResponseAction.RATE_LIMIT,
          ResponseAction.CAPTCHA_CHALLENGE,
          ResponseAction.NOTIFY_SECURITY
        ],
        trigger: ResponseTrigger.DELAYED_5_MIN,
        isActive: true,
        description: 'Phản ứng cho Card Testing Attack',
        severity: 'high'
      },

      // Phản ứng cho API Abuse
      {
        id: 'api_abuse_response',
        triggerCondition: {
          threatType: ThreatType.UNAUTHORIZED_API_ACCESS,
          minConfidence: 0.75,
          minRiskScore: 70,
          occurrenceThreshold: 5,
          timeWindowMinutes: 10
        },
        actions: [
          ResponseAction.DISABLE_API_KEY,
          ResponseAction.RATE_LIMIT,
          ResponseAction.NOTIFY_SECURITY,
          ResponseAction.CREATE_TICKET
        ],
        trigger: ResponseTrigger.DELAYED_15_MIN,
        isActive: true,
        description: 'Phản ứng cho API Abuse',
        severity: 'high'
      },

      // Phản ứng cho Data Exfiltration
      {
        id: 'data_exfiltration_response',
        triggerCondition: {
          threatType: ThreatType.DATA_EXFILTRATION,
          minConfidence: 0.85,
          minRiskScore: 90,
          occurrenceThreshold: 1
        },
        actions: [
          ResponseAction.QUARANTINE_USER,
          ResponseAction.LOG_OUT_SESSIONS,
          ResponseAction.BLOCK_IP,
          ResponseAction.NOTIFY_SECURITY,
          ResponseAction.CREATE_TICKET
        ],
        trigger: ResponseTrigger.IMMEDIATE,
        isActive: true,
        description: 'Phản ứng khẩn cấp cho Data Exfiltration',
        severity: 'critical'
      },

      // Phản ứng cho Malicious Bot
      {
        id: 'bot_detection_response',
        triggerCondition: {
          threatType: ThreatType.MALICIOUS_BOT,
          minConfidence: 0.6,
          minRiskScore: 50,
          occurrenceThreshold: 10,
          timeWindowMinutes: 5
        },
        actions: [
          ResponseAction.CAPTCHA_CHALLENGE,
          ResponseAction.RATE_LIMIT,
          ResponseAction.BLOCK_COUNTRY
        ],
        trigger: ResponseTrigger.DELAYED_5_MIN,
        isActive: true,
        description: 'Phản ứng cho Malicious Bot Detection',
        severity: 'medium'
      },

      // Phản ứng cho Credential Stuffing
      {
        id: 'credential_stuffing_response',
        triggerCondition: {
          threatType: ThreatType.CREDENTIAL_STUFFING,
          minConfidence: 0.8,
          minRiskScore: 80,
          occurrenceThreshold: 5,
          timeWindowMinutes: 5
        },
        actions: [
          ResponseAction.BLOCK_IP,
          ResponseAction.RATE_LIMIT,
          ResponseAction.NOTIFY_SECURITY,
          ResponseAction.CAPTCHA_CHALLENGE
        ],
        trigger: ResponseTrigger.IMMEDIATE,
        isActive: true,
        description: 'Phản ứng cho Credential Stuffing',
        severity: 'high'
      }
    ];

    defaultResponses.forEach(response => {
      this.responses.set(response.id, response);
    });

    logger.info('Khởi tạo hệ thống phản hồi tự động', {
      total: defaultResponses.length,
      active: defaultResponses.filter(r => r.isActive).length
    });
  }

  // Xử lý threat detection và trigger phản hồi tự động
  async processThreatDetection(threatId: string): Promise<void> {
    try {
      const threatResults = behavioralThreatDetection.getDetectionResults(1000);
      const threat = threatResults.find(r => r.id === threatId);
      
      if (!threat) {
        logger.warn('Không tìm thấy threat', { threatId });
        return;
      }

      // Tìm các phản hồi phù hợp
      const matchingResponses = this.findMatchingResponses(threat);
      
      if (matchingResponses.length === 0) {
        logger.info('Không có phản hồi tự động phù hợp', { 
          threatId, 
          threatType: threat.threatType 
        });
        return;
      }

      // Lên lịch thực thi các phản hồi
      for (const response of matchingResponses) {
        await this.scheduleResponse(response, threat);
      }

    } catch (error) {
      logger.error('Lỗi xử lý threat detection', { 
        threatId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private findMatchingResponses(threat: any): AutomatedResponse[] {
    return Array.from(this.responses.values()).filter(response => {
      if (!response.isActive) return false;
      
      const condition = response.triggerCondition;
      return (
        threat.threatType === condition.threatType &&
        threat.confidence >= condition.minConfidence &&
        threat.riskScore >= condition.minRiskScore
      );
    });
  }

  private async scheduleResponse(response: AutomatedResponse, threat: any): Promise<void> {
    const delay = this.calculateDelay(response.trigger);
    
    if (delay > 0) {
      setTimeout(async () => {
        await this.executeResponse(response, threat);
      }, delay);
    } else {
      await this.executeResponse(response, threat);
    }

    logger.info('Đã lên lịch phản hồi tự động', {
      responseId: response.id,
      threatId: threat.id,
      trigger: response.trigger,
      delayMinutes: delay / 60000
    });
  }

  private calculateDelay(trigger: ResponseTrigger): number {
    switch (trigger) {
      case ResponseTrigger.IMMEDIATE: return 0;
      case ResponseTrigger.DELAYED_5_MIN: return 5 * 60 * 1000;
      case ResponseTrigger.DELAYED_15_MIN: return 15 * 60 * 1000;
      case ResponseTrigger.DELAYED_1_HOUR: return 60 * 60 * 1000;
      case ResponseTrigger.MANUAL_REVIEW: return -1; // Cần xử lý thủ công
      default: return 0;
    }
  }

  private async executeResponse(response: AutomatedResponse, threat: any): Promise<void> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    for (const action of response.actions) {
      const execution: ResponseExecution = {
        id: executionId + '_' + action,
        responseId: response.id,
        threatId: threat.id,
        action,
        status: 'pending',
        metadata: {
          threatType: threat.threatType,
          confidence: threat.confidence,
          riskScore: threat.riskScore,
          ipAddress: threat.ipAddress,
          userId: threat.userId
        }
      };

      this.executions.set(execution.id, execution);

      try {
        const result = await this.executeAction(action, threat, execution);
        
        execution.status = 'executed';
        execution.executedAt = new Date().toISOString();
        execution.result = result;

        logger.info('Thực thi phản hồi thành công', {
          executionId: execution.id,
          action,
          threatId: threat.id
        });

      } catch (error) {
        execution.status = 'failed';
        execution.error = error instanceof Error ? error.message : 'Unknown error';

        logger.error('Thực thi phản hồi thất bại', {
          executionId: execution.id,
          action,
          threatId: threat.id,
          error: execution.error
        });
      }
    }

    // Ghi nhận vào SIEM
    this.logResponseToSIEM(response, threat);
  }

  private async executeAction(action: ResponseAction, threat: any, execution: ResponseExecution): Promise<any> {
    // Tìm response phù hợp với threat
    const matchingResponse = Array.from(this.responses.values()).find(r => 
      r.triggerCondition.threatType === threat.threatType
    );

    switch (action) {
      case ResponseAction.BLOCK_IP:
        return await this.blockIPAddress(threat.ipAddress, threat.id, execution);
      
      case ResponseAction.LOCK_ACCOUNT:
        return await this.lockUserAccount(threat.userId, threat.id, execution);
      
      case ResponseAction.RATE_LIMIT:
        return await this.applyRateLimit(threat.ipAddress, threat.id, execution);
      
      case ResponseAction.REQUIRE_MFA:
        return await this.enforceMFA(threat.userId, threat.id, execution);
      
      case ResponseAction.LOG_OUT_SESSIONS:
        return await this.logoutUserSessions(threat.userId, threat.id, execution);
      
      case ResponseAction.NOTIFY_SECURITY:
        return await this.notifySecurityTeam(matchingResponse!, threat, execution);
      
      case ResponseAction.CREATE_TICKET:
        return await this.createSecurityTicket(threat, execution);
      
      case ResponseAction.QUARANTINE_USER:
        return await this.quarantineUser(threat.userId, threat.id, execution);
      
      case ResponseAction.DISABLE_API_KEY:
        return await this.disableUserAPIKeys(threat.userId, threat.id, execution);
      
      case ResponseAction.BLOCK_COUNTRY:
        return await this.blockCountry(threat.ipAddress, threat.id, execution);
      
      case ResponseAction.CAPTCHA_CHALLENGE:
        return await this.requireCaptcha(threat.ipAddress, threat.id, execution);
      
      default:
        throw new Error(`Hành động không được hỗ trợ: ${action}`);
    }
  }

  // Các phương thức thực thi cụ thể
  private async blockIPAddress(ipAddress: string, threatId: string, execution: ResponseExecution): Promise<any> {
    const blockRecord: IPBlockRecord = {
      ipAddress,
      reason: `Threat ID: ${threatId}`,
      blockedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 giờ
      threatIds: [threatId],
      active: true
    };

    this.ipBlocks.set(ipAddress, blockRecord);

    // TODO: Thực tế triển khai: Cập nhật firewall, nginx, cloudflare
    logger.warn('Đã block IP address', {
      ipAddress,
      threatId,
      executionId: execution.id
    });

    return { blocked: true, expiresAt: blockRecord.expiresAt };
  }

  private async lockUserAccount(userId: string, threatId: string, execution: ResponseExecution): Promise<any> {
    if (!userId) {
      throw new Error('User ID là bắt buộc để lock account');
    }

    const lockRecord: AccountLockRecord = {
      userId,
      reason: `Security threat detected - Threat ID: ${threatId}`,
      lockedAt: new Date().toISOString(),
      lockedBy: 'system',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 giờ
      threatIds: [threatId],
      active: true
    };

    this.accountLocks.set(userId, lockRecord);

    // TODO: Thực tế triển khai: Cập nhật database, gửi email, logout all sessions
    logger.warn('Đã lock user account', {
      userId,
      threatId,
      executionId: execution.id
    });

    return { locked: true, expiresAt: lockRecord.expiresAt };
  }

  private async applyRateLimit(ipAddress: string, threatId: string, execution: ResponseExecution): Promise<any> {
    const rateLimitConfig = {
      windowMs: 5 * 60 * 1000, // 5 phút
      maxRequests: 10, // Tối đa 10 requests
      blockDuration: 30 * 60 * 1000 // Block 30 phút
    };

    this.rateLimiters.set(ipAddress, {
      ...rateLimitConfig,
      appliedAt: new Date().toISOString(),
      threatId
    });

    // TODO: Thực tế triển khai: Cập nhật rate limiter
    logger.info('Đã áp dụng rate limit', {
      ipAddress,
      threatId,
      executionId: execution.id,
      config: rateLimitConfig
    });

    return { rateLimited: true, config: rateLimitConfig };
  }

  private async enforceMFA(userId: string, threatId: string, execution: ResponseExecution): Promise<any> {
    // TODO: Thực tế triển khai: Force MFA cho user
    logger.info('Yêu cầu MFA cho user', {
      userId,
      threatId,
      executionId: execution.id
    });

    return { mfaRequired: true, method: 'totp' };
  }

  private async logoutUserSessions(userId: string, threatId: string, execution: ResponseExecution): Promise<any> {
    // TODO: Thực tế triển khai: Invalidate all user sessions
    logger.info('Đã logout tất cả sessions', {
      userId,
      threatId,
      executionId: execution.id
    });

    return { sessionsLoggedOut: true, count: 'all' };
  }

  private async notifySecurityTeam(response: AutomatedResponse, threat: any, execution: ResponseExecution): Promise<any> {
    // Tạo SIEM event
    siemFramework.createEvent(
      IncidentCategory.ANOMALOUS_BEHAVIOR,
      threat.riskScore >= 90 ? SecuritySeverity.CRITICAL : 
      threat.riskScore >= 70 ? SecuritySeverity.HIGH : SecuritySeverity.MEDIUM,
      `Automated Response Triggered: ${response.description}`,
      `Threat ${threat.threatType} detected with ${Math.round(threat.confidence * 100)}% confidence`,
      'automated_response',
      ['security', 'automation'],
      {
        threatId: threat.id,
        responseId: response.id,
        actions: response.actions,
        severity: response.severity,
        triggeredAt: new Date().toISOString()
      },
      threat.userId,
      threat.ipAddress,
      ['automated-response', 'security-alert', threat.threatType]
    );

    // TODO: Thực tế triển khai: Gửi email, Slack, PagerDuty
    logger.error('Thông báo cho security team - CRITICAL', {
      threatId: threat.id,
      responseId: response.id,
      severity: response.severity,
      executionId: execution.id
    });

    return { notified: true, channels: ['siem', 'email'] };
  }

  private async createSecurityTicket(threat: any, execution: ResponseExecution): Promise<any> {
    // TODO: Thực tế triển khai: Tạo ticket trong Jira, ServiceNow
    const ticketId = `SEC-${Date.now()}`;
    
    logger.info('Đã tạo security ticket', {
      ticketId,
      threatId: threat.id,
      executionId: execution.id
    });

    return { ticketCreated: true, ticketId, url: `https://tickets.company.com/${ticketId}` };
  }

  private async quarantineUser(userId: string, threatId: string, execution: ResponseExecution): Promise<any> {
    // TODO: Thực tế triển khai: Quarantine user với limited access
    logger.warn('Đã quarantine user', {
      userId,
      threatId,
      executionId: execution.id
    });

    return { quarantined: true, accessLevel: 'limited' };
  }

  private async disableUserAPIKeys(userId: string, threatId: string, execution: ResponseExecution): Promise<any> {
    // TODO: Thực tế triển khai: Disable tất cả API keys của user
    logger.info('Đã disable API keys', {
      userId,
      threatId,
      executionId: execution.id
    });

    return { apiKeysDisabled: true, count: 'all' };
  }

  private async blockCountry(ipAddress: string, threatId: string, execution: ResponseExecution): Promise<any> {
    // TODO: Thực tế triển khai: Xác định country và block
    logger.warn('Đã block country', {
      ipAddress,
      threatId,
      executionId: execution.id
    });

    return { countryBlocked: true, country: 'detected' };
  }

  private async requireCaptcha(ipAddress: string, threatId: string, execution: ResponseExecution): Promise<any> {
    // TODO: Thực tế triển khai: Thêm captcha challenge
    logger.info('Đã yêu cầu CAPTCHA', {
      ipAddress,
      threatId,
      executionId: execution.id
    });

    return { captchaRequired: true, type: 'recaptcha' };
  }

  private logResponseToSIEM(response: AutomatedResponse, threat: any): void {
    siemFramework.createEvent(
      IncidentCategory.ANOMALOUS_BEHAVIOR,
      threat.riskScore >= 90 ? SecuritySeverity.CRITICAL : SecuritySeverity.HIGH,
      `Automated Response Executed: ${response.description}`,
      `Response actions executed for ${threat.threatType} threat`,
      'automated_response',
      ['automation', 'security'],
      {
        threatId: threat.id,
        responseId: response.id,
        actions: response.actions,
        executionTime: new Date().toISOString()
      },
      threat.userId,
      threat.ipAddress,
      ['automated-response', 'threat-mitigation']
    );
  }

  // Public API methods
  addResponse(response: AutomatedResponse): void {
    this.responses.set(response.id, response);
    logger.info('Đã thêm automated response', { 
      responseId: response.id, 
      threatType: response.triggerCondition.threatType 
    });
  }

  removeResponse(responseId: string): void {
    const removed = this.responses.delete(responseId);
    if (removed) {
      logger.info('Đã xóa automated response', { responseId });
    }
  }

  getResponses(): AutomatedResponse[] {
    return Array.from(this.responses.values());
  }

  getExecutions(limit: number = 50): ResponseExecution[] {
    return Array.from(this.executions.values())
      .sort((a, b) => new Date(b.executedAt || '').getTime() - new Date(a.executedAt || '').getTime())
      .slice(0, limit);
  }

  getIPBlocks(): IPBlockRecord[] {
    return Array.from(this.ipBlocks.values()).filter(block => block.active);
  }

  getAccountLocks(): AccountLockRecord[] {
    return Array.from(this.accountLocks.values()).filter(lock => lock.active);
  }

  // Rollback functionality
  async rollbackExecution(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== 'executed') {
      return false;
    }

    try {
      await this.rollbackAction(execution.action, execution);
      execution.status = 'rollback';
      
      logger.info('Đã rollback execution', { executionId, action: execution.action });
      return true;
    } catch (error) {
      logger.error('Rollback thất bại', { 
        executionId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  private async rollbackAction(action: ResponseAction, execution: ResponseExecution): Promise<void> {
    switch (action) {
      case ResponseAction.BLOCK_IP:
        const ipBlock = this.ipBlocks.get(execution.metadata.ipAddress);
        if (ipBlock) {
          ipBlock.active = false;
          logger.info('Đã unblock IP', { ipAddress: execution.metadata.ipAddress });
        }
        break;
      
      case ResponseAction.LOCK_ACCOUNT:
        const accountLock = this.accountLocks.get(execution.metadata.userId);
        if (accountLock) {
          accountLock.active = false;
          logger.info('Đã unlock account', { userId: execution.metadata.userId });
        }
        break;
      
      // TODO: Implement rollback cho các actions khác
      default:
        logger.warn('Rollback chưa được support', { action });
    }
  }

  // Cleanup timer
  private startCleanupTimer(): void {
    const cleanupTimer = setInterval(() => {
      this.cleanupExpiredBlocks();
      this.cleanupOldExecutions();
    }, 60 * 60 * 1000); // Run mỗi giờ
    cleanupTimer.unref?.();
  }

  private cleanupExpiredBlocks(): void {
    const now = new Date();
    
    // Cleanup IP blocks
    for (const [ip, block] of this.ipBlocks.entries()) {
      if (block.expiresAt && new Date(block.expiresAt) < now) {
        block.active = false;
        logger.info('IP block đã hết hạn', { ipAddress: ip });
      }
    }

    // Cleanup account locks
    for (const [userId, lock] of this.accountLocks.entries()) {
      if (lock.expiresAt && new Date(lock.expiresAt) < now) {
        lock.active = false;
        logger.info('Account lock đã hết hạn', { userId });
      }
    }
  }

  private cleanupOldExecutions(): void {
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 ngày
    let cleanedCount = 0;

    for (const [id, execution] of this.executions.entries()) {
      if (new Date(execution.executedAt || '') < cutoffDate) {
        this.executions.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Đã cleanup old executions', { count: cleanedCount });
    }
  }
}

// Singleton instance
export const automatedResponseSystem = new AutomatedResponseSystem();
