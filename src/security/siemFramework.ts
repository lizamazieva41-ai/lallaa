import { Request } from 'express';
import { logger } from '@/utils/logger';
import { performanceMonitor } from '@/services/performanceMonitor';

// Enhanced Security Incident Types with Detailed Classification
export enum IncidentCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATA_BREACH = 'data_breach',
  DDOS = 'ddos',
  FRAUD = 'fraud',
  MALWARE = 'malware',
  NETWORK_INTRUSION = 'network_intrusion',
  PHISHING = 'phishing',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  SQL_INJECTION = 'sql_injection',
  XSS = 'xss',
  RATE_LIMIT = 'rate_limit',
  ANOMALOUS_BEHAVIOR = 'anomalous_behavior'
}

export enum SecuritySeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export enum IncidentStatus {
  NEW = 'new',
  INVESTIGATING = 'investigating',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  ESCALATED = 'escalated',
  FALSE_POSITIVE = 'false_positive'
}

export interface SecurityEvent {
  id: string;
  category: IncidentCategory;
  severity: SecuritySeverity;
  status: IncidentStatus;
  title: string;
  description: string;
  source: string;
  affectedSystems: string[];
  userId?: string;
  ipAddress?: string;
  timestamp: string;
  details: Record<string, any>;
  assignee?: string | null;
  escalatedTo?: string | null;
  resolution?: string | null;
  resolutionTime?: string | null;
  tags: string[];
  metadata: Record<string, any>;
}

export interface AlertThreshold {
  category: IncidentCategory;
  severity: SecuritySeverity;
  maxCount: number;
  timeWindowMinutes: number;
  action: 'log' | 'alert' | 'block' | 'escalate';
}

export interface EscalationPolicy {
  category: IncidentCategory;
  severity: SecuritySeverity;
  levels: EscalationLevel[];
}

export interface EscalationLevel {
  level: number;
  delayMinutes: number;
  action: 'notify' | 'escalate' | 'auto_respond';
  stakeholders: string[];
  message: string;
}

export interface IncidentMetrics {
  totalEvents: number;
  criticalEvents: number;
  highEvents: number;
  mediumEvents: number;
  lowEvents: number;
  activeIncidents: number;
  resolvedToday: number;
  averageResolutionTime: number;
  eventsByCategory: Record<IncidentCategory, number>;
  eventsBySeverity: Record<SecuritySeverity, number>;
}

export interface SecurityMetrics {
  incidentCounts: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  responseTimes: {
    average: number;
    critical: number;
    high: number;
  };
  trends: {
    daily: Array<{ date: string; count: number }>;
    severity: Record<SecuritySeverity, number>;
  };
  systemHealth: {
    eventsProcessed: number;
    alertsTriggered: number;
    falsePositives: number;
    escalatedIncidents: number;
  };
}

export interface IncidentReport {
  id: string;
  generatedAt: string;
  period: string;
  summary: {
    totalEvents: number;
    criticalEvents: number;
    resolvedEvents: number;
    averageResolutionTime: number;
  };
  categories: Record<IncidentCategory, {
    count: number;
    severity: Record<SecuritySeverity, number>;
  }>;
  trends: {
    daily: Array<{ date: string; count: number }>;
    severity: Record<SecuritySeverity, number>;
  };
  recommendations: string[];
}

export interface Stakeholder {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  notifications: {
    email: boolean;
    sms: boolean;
    categories: IncidentCategory[];
    severities: SecuritySeverity[];
  };
}

export class SIEMFramework {
  private events: Map<string, SecurityEvent> = new Map();
  private activeIncidents: Map<string, SecurityEvent> = new Map();
  private alertThresholds: Map<string, AlertThreshold> = new Map();
  private escalationPolicies: Map<string, EscalationPolicy> = new Map();
  private stakeholders: Map<string, Stakeholder> = new Map();

  constructor() {
    this.initializeDefaultConfigurations();
  }

  private initializeDefaultConfigurations(): void {
    // Default alert thresholds
    const defaultThresholds: AlertThreshold[] = [
      {
        category: IncidentCategory.AUTHENTICATION,
        severity: SecuritySeverity.CRITICAL,
        maxCount: 1,
        timeWindowMinutes: 5,
        action: 'escalate'
      },
      {
        category: IncidentCategory.RATE_LIMIT,
        severity: SecuritySeverity.HIGH,
        maxCount: 10,
        timeWindowMinutes: 1,
        action: 'block'
      },
      {
        category: IncidentCategory.ANOMALOUS_BEHAVIOR,
        severity: SecuritySeverity.MEDIUM,
        maxCount: 5,
        timeWindowMinutes: 10,
        action: 'alert'
      }
    ];

    defaultThresholds.forEach(threshold => {
      this.alertThresholds.set(`${threshold.category}_${threshold.severity}`, threshold);
    });

    // Default escalation policies
    const defaultPolicies: EscalationPolicy[] = [
      {
        category: IncidentCategory.AUTHENTICATION,
        severity: SecuritySeverity.CRITICAL,
        levels: [
          {
            level: 1,
            delayMinutes: 0,
            action: 'notify',
            stakeholders: ['security-lead'],
            message: 'Critical authentication failure detected'
          },
          {
            level: 2,
            delayMinutes: 5,
            action: 'escalate',
            stakeholders: ['security-manager'],
            message: 'Critical incident unresolved - escalating to management'
          }
        ]
      }
    ];

    defaultPolicies.forEach(policy => {
      this.escalationPolicies.set(`${policy.category}_${policy.severity}`, policy);
    });
  }

  createEvent(
    category: IncidentCategory,
    severity: SecuritySeverity,
    title: string,
    description: string,
    source: string,
    affectedSystems: string[] = [],
    details: Record<string, any> = {},
    userId?: string,
    ipAddress?: string,
    tags: string[] = []
  ): SecurityEvent {
    const eventId = this.generateEventId();
    
    const event: SecurityEvent = {
      id: eventId,
      category,
      severity,
      status: IncidentStatus.NEW,
      title,
      description,
      source,
      affectedSystems,
      userId,
      ipAddress,
      timestamp: new Date().toISOString(),
      details,
      assignee: null,
      escalatedTo: null,
      resolution: null,
      resolutionTime: null,
      tags,
      metadata: {}
    };

    this.events.set(eventId, event);
    this.activeIncidents.set(eventId, event);

    // Log to performance monitor
    performanceMonitor.recordMetric({
      duration: 0,
      statusCode: 0,
      method: 'security_event',
      route: 'siem_framework',
      userId,
      userAgent: 'SIEM Framework',
      ip: ipAddress,
      responseSize: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    });

    logger.warn('Security event created', {
      eventId,
      category,
      severity,
      title,
      timestamp: event.timestamp
    });

    this.checkEscalationRequirements(event);
    this.checkAlertThresholds(event);

    return event;
  }

  updateEvent(
    eventId: string,
    updates: Partial<SecurityEvent>
  ): SecurityEvent | null {
    const event = this.events.get(eventId);
    if (!event) {
      logger.error('Event not found for update', { eventId });
      return null;
    }

    const updatedEvent = { ...event, ...updates };
    this.events.set(eventId, updatedEvent);

    if (updates.status) {
      const activeIncident = this.activeIncidents.get(eventId);
      if (activeIncident) {
        this.activeIncidents.set(eventId, updatedEvent);
      }
    }

    logger.info('Security event updated', {
      eventId,
      updates: Object.keys(updates)
    });

    return updatedEvent;
  }

  private checkEscalationRequirements(event: SecurityEvent): void {
    const policyKey = `${event.category}_${event.severity}`;
    const policy = this.escalationPolicies.get(policyKey);
    
    if (!policy) return;

    policy.levels.forEach(level => {
      setTimeout(() => {
        const currentEvent = this.events.get(event.id);
        if (currentEvent && currentEvent.status !== IncidentStatus.RESOLVED) {
          this.escalateEvent(event.id, level);
        }
      }, level.delayMinutes * 60 * 1000);
    });
  }

  private escalateEvent(eventId: string, level: EscalationLevel): void {
    const event = this.events.get(eventId);
    if (!event) return;

    const updatedEvent = {
      ...event,
      status: IncidentStatus.ESCALATED,
      escalatedTo: level.stakeholders.join(', '),
      metadata: {
        ...event.metadata,
        escalationLevel: level.level,
        escalatedAt: new Date().toISOString()
      }
    };

    this.events.set(eventId, updatedEvent);

    logger.error('Security incident escalated', {
      eventId,
      level: level.level,
      stakeholders: level.stakeholders,
      message: level.message
    });
  }

  private checkAlertThresholds(event: SecurityEvent): void {
    const thresholdKey = `${event.category}_${event.severity}`;
    const threshold = this.alertThresholds.get(thresholdKey);
    
    if (!threshold) return;

    const now = new Date();
    const windowStart = new Date(now.getTime() - threshold.timeWindowMinutes * 60 * 1000);
    
    const recentEvents = Array.from(this.events.values()).filter(
      e => e.category === event.category &&
           e.severity === event.severity &&
           new Date(e.timestamp) >= windowStart
    );

    if (recentEvents.length >= threshold.maxCount) {
      logger.error('Alert threshold exceeded', {
        category: event.category,
        severity: event.severity,
        count: recentEvents.length,
        threshold: threshold.maxCount,
        action: threshold.action
      });

      if (threshold.action === 'escalate') {
        const policy = this.escalationPolicies.get(thresholdKey);
        if (policy && policy.levels.length > 0) {
          this.escalateEvent(event.id, policy.levels[0]);
        }
      }
    }
  }

  getEvent(eventId: string): SecurityEvent | null {
    return this.events.get(eventId) || null;
  }

  getActiveIncidents(): SecurityEvent[] {
    return Array.from(this.activeIncidents.values()).filter(
      incident => incident.status !== IncidentStatus.RESOLVED
    );
  }

  getEventsByCategory(category: IncidentCategory): SecurityEvent[] {
    return Array.from(this.events.values()).filter(event => event.category === category);
  }

  getEventsBySeverity(severity: SecuritySeverity): SecurityEvent[] {
    return Array.from(this.events.values()).filter(event => event.severity === severity);
  }

  getSecurityMetrics(): SecurityMetrics {
    const events = Array.from(this.events.values());
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const severityCounts = {
      total: events.length,
      critical: events.filter(e => e.severity === SecuritySeverity.CRITICAL).length,
      high: events.filter(e => e.severity === SecuritySeverity.HIGH).length,
      medium: events.filter(e => e.severity === SecuritySeverity.MEDIUM).length,
      low: events.filter(e => e.severity === SecuritySeverity.LOW).length
    };

    const activeIncidents = events.filter(e => 
      e.status !== IncidentStatus.RESOLVED && e.status !== IncidentStatus.FALSE_POSITIVE
    );

    return {
      incidentCounts: severityCounts,
      responseTimes: {
        average: this.calculateAverageResolutionTime(),
        critical: this.calculateAverageResolutionTimeBySeverity(SecuritySeverity.CRITICAL),
        high: this.calculateAverageResolutionTimeBySeverity(SecuritySeverity.HIGH)
      },
      trends: this.calculateDailyTrends(),
      systemHealth: {
        eventsProcessed: events.length,
        alertsTriggered: severityCounts.high + severityCounts.critical,
        falsePositives: events.filter(e => e.status === IncidentStatus.FALSE_POSITIVE).length,
        escalatedIncidents: events.filter(e => e.status === IncidentStatus.ESCALATED).length
      }
    };
  }

  private calculateAverageResolutionTime(): number {
    const resolvedEvents = Array.from(this.events.values()).filter(
      event => event.status === IncidentStatus.RESOLVED && event.resolutionTime
    );

    if (resolvedEvents.length === 0) return 0;

    const totalTime = resolvedEvents.reduce((sum, event) => {
      const created = new Date(event.timestamp).getTime();
      const resolved = new Date(event.resolutionTime!).getTime();
      return sum + (resolved - created);
    }, 0);

    return totalTime / resolvedEvents.length / 1000 / 60; // Convert to minutes
  }

  private calculateAverageResolutionTimeBySeverity(severity: SecuritySeverity): number {
    const resolvedEvents = Array.from(this.events.values()).filter(
      event => event.status === IncidentStatus.RESOLVED && 
               event.severity === severity &&
               event.resolutionTime
    );

    if (resolvedEvents.length === 0) return 0;

    const totalTime = resolvedEvents.reduce((sum, event) => {
      const created = new Date(event.timestamp).getTime();
      const resolved = new Date(event.resolutionTime!).getTime();
      return sum + (resolved - created);
    }, 0);

    return totalTime / resolvedEvents.length / 1000 / 60; // Convert to minutes
  }

  private calculateDailyTrends(): SecurityMetrics['trends'] {
    const eventsByDay = new Map<string, number>();
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      eventsByDay.set(dateStr, 0);
    }

    Array.from(this.events.values()).forEach(event => {
      const eventDate = event.timestamp.split('T')[0];
      if (eventsByDay.has(eventDate)) {
        eventsByDay.set(eventDate, eventsByDay.get(eventDate)! + 1);
      }
    });

    const events = Array.from(this.events.values());
    const severityDistribution = {
      [SecuritySeverity.CRITICAL]: events.filter(e => e.severity === SecuritySeverity.CRITICAL).length,
      [SecuritySeverity.HIGH]: events.filter(e => e.severity === SecuritySeverity.HIGH).length,
      [SecuritySeverity.MEDIUM]: events.filter(e => e.severity === SecuritySeverity.MEDIUM).length,
      [SecuritySeverity.LOW]: events.filter(e => e.severity === SecuritySeverity.LOW).length
    };

    return {
      daily: Array.from(eventsByDay.entries()).map(([date, count]) => ({
        date,
        count
      })),
      severity: severityDistribution
    };
  }

  generateIncidentReport(period: string = '24h'): IncidentReport {
    const events = Array.from(this.events.values());
    const now = new Date();
    const periodMs = period === '24h' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const periodStart = new Date(now.getTime() - periodMs);

    const periodEvents = events.filter(event => 
      new Date(event.timestamp) >= periodStart
    );

    const resolvedEvents = periodEvents.filter(event => 
      event.status === IncidentStatus.RESOLVED && event.resolutionTime
    );

    const avgResolutionTime = resolvedEvents.length > 0 ? 
      resolvedEvents.reduce((sum, event) => {
        const created = new Date(event.timestamp).getTime();
        const resolved = new Date(event.resolutionTime!).getTime();
        return sum + (resolved - created);
      }, 0) / resolvedEvents.length / 1000 / 60 : 0;

    const eventsByCategory = new Map<IncidentCategory, SecurityEvent[]>();
    periodEvents.forEach(event => {
      if (!eventsByCategory.has(event.category)) {
        eventsByCategory.set(event.category, []);
      }
      eventsByCategory.get(event.category)!.push(event);
    });

    const categories: Record<IncidentCategory, any> = {} as any;
    eventsByCategory.forEach((catEvents, category) => {
      categories[category] = {
        count: catEvents.length,
        severity: {
          [SecuritySeverity.CRITICAL]: catEvents.filter(e => e.severity === SecuritySeverity.CRITICAL).length,
          [SecuritySeverity.HIGH]: catEvents.filter(e => e.severity === SecuritySeverity.HIGH).length,
          [SecuritySeverity.MEDIUM]: catEvents.filter(e => e.severity === SecuritySeverity.MEDIUM).length,
          [SecuritySeverity.LOW]: catEvents.filter(e => e.severity === SecuritySeverity.LOW).length
        }
      };
    });

    const criticalEvents = periodEvents.filter(e => e.severity === SecuritySeverity.CRITICAL);
    const recommendations: string[] = [];

    if (criticalEvents.length > 0) {
      recommendations.push('Immediate attention required for critical security incidents');
    }

    if (avgResolutionTime > 60) {
      recommendations.push('Average resolution time exceeds 60 minutes - consider streamlining response procedures');
    }

    if (periodEvents.length > 50) {
      recommendations.push('High volume of security incidents detected - review security controls');
    }

    return {
      id: this.generateEventId(),
      generatedAt: now.toISOString(),
      period,
      summary: {
        totalEvents: periodEvents.length,
        criticalEvents: criticalEvents.length,
        resolvedEvents: resolvedEvents.length,
        averageResolutionTime: avgResolutionTime
      },
      categories,
      trends: this.calculateDailyTrends(),
      recommendations
    };
  }

  // Stakeholder management
  addStakeholder(stakeholder: Stakeholder): void {
    this.stakeholders.set(stakeholder.id, stakeholder);
    logger.info('Stakeholder added to SIEM framework', { id: stakeholder.id, role: stakeholder.role });
  }

  removeStakeholder(stakeholderId: string): void {
    const removed = this.stakeholders.delete(stakeholderId);
    if (removed) {
      logger.info('Stakeholder removed from SIEM framework', { stakeholderId });
    }
  }

  getStakeholders(): Stakeholder[] {
    return Array.from(this.stakeholders.values());
  }

  notifyStakeholders(event: SecurityEvent): void {
    const relevantStakeholders = Array.from(this.stakeholders.values()).filter(stakeholder =>
      stakeholder.notifications.categories.includes(event.category) &&
      stakeholder.notifications.severities.includes(event.severity)
    );

    relevantStakeholders.forEach(stakeholder => {
      if (stakeholder.notifications.email) {
        logger.info('Email notification sent', {
          stakeholderId: stakeholder.id,
          email: stakeholder.email,
          eventId: event.id
        });
      }
    });
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  cleanupOldEvents(olderThanDays: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const eventsToDelete: string[] = [];
    
    this.events.forEach((event, id) => {
      if (new Date(event.timestamp) < cutoffDate && 
          event.status === IncidentStatus.RESOLVED) {
        eventsToDelete.push(id);
      }
    });

    eventsToDelete.forEach(id => {
      this.events.delete(id);
      this.activeIncidents.delete(id);
    });

    if (eventsToDelete.length > 0) {
      logger.info('Cleaned up old security events', {
        deletedCount: eventsToDelete.length,
        cutoffDate: cutoffDate.toISOString()
      });
    }
  }
}

// Singleton instance
export const siemFramework = new SIEMFramework();