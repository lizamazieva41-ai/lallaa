/**
 * Security Monitoring Middleware
 * Provides real-time security monitoring and alerting
 */

import { Request, Response, NextFunction } from 'express';
import { performanceMonitor } from '../services/performanceMonitor';
import { logger } from '../utils/logger';

interface SecurityEvent {
  type: 'authentication' | 'authorization' | 'injection' | 'rate_limit' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  timestamp: string;
  ip?: string;
  userId?: string;
  userAgent?: string;
}

class SecurityMonitor {
  private events: SecurityEvent[] = [];
  private blockedIPs: Map<string, { count: number; lastBlock: number }> = new Map();
  private suspiciousUsers: Map<string, { count: number; lastSuspicious: number }> = new Map();

  constructor() {
    // Clean up old blocks/suspicious flags periodically
    const cleanupTimer = setInterval(() => this.cleanupOldEntries(), 60000); // Every 1 minute
    cleanupTimer.unref?.();
  }

  recordEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      ip: event.ip || this.getCurrentIP(),
    };

    this.events.push(fullEvent);
    this.evaluateRisk(fullEvent);
    this.logSecurityEvent(fullEvent);
  }

  private evaluateRisk(event: SecurityEvent): void {
    // Track repeated failed authentication
    if (event.type === 'authentication' && event.ip) {
      const ipData = this.blockedIPs.get(event.ip) || { count: 0, lastBlock: 0 };
      ipData.count++;
      this.blockedIPs.set(event.ip, ipData);

      // Auto-block IP after too many failed attempts
      if (ipData.count >= 10) {
        this.blockIP(event.ip, 'Too many failed authentication attempts');
      }
    }

    // Track suspicious user activity
    if (event.userId && event.severity === 'high') {
      const userData = this.suspiciousUsers.get(event.userId) || { count: 0, lastSuspicious: 0 };
      userData.count++;
      userData.lastSuspicious = Date.now();
      this.suspiciousUsers.set(event.userId, userData);

      // Flag user for admin review after multiple high-severity events
      if (userData.count >= 3) {
        logger.warn('User flagged for security review', { 
          userId: event.userId,
          events: userData.count,
          lastSuspicious: new Date(userData.lastSuspicious).toISOString()
        });
      }
    }
  }

  private blockIP(ip: string, reason: string): void {
    this.blockedIPs.set(ip, {
      count: this.blockedIPs.get(ip)?.count || 0,
      lastBlock: Date.now()
    });

    logger.warn('IP auto-blocked', {
      ip,
      reason,
      timestamp: new Date().toISOString()
    });
  }

  private cleanupOldEntries(): void {
    const now = Date.now();
    const blockDuration = 3600000; // 1 hour blocks
    const suspiciousDuration = 1800000; // 30 minutes suspicion tracking

    // Clean up old IP blocks
    for (const [ip, data] of this.blockedIPs.entries()) {
      if (now - data.lastBlock > blockDuration) {
        this.blockedIPs.delete(ip);
      }
    }

    // Clean up old suspicious user flags
    for (const [userId, data] of this.suspiciousUsers.entries()) {
      if (now - data.lastSuspicious > suspiciousDuration) {
        this.suspiciousUsers.delete(userId);
      }
    }

    // Keep only last 1000 events for memory efficiency
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
  }

  private logSecurityEvent(event: SecurityEvent): void {
    const level = event.severity === 'critical' ? 'error' : 
                 event.severity === 'high' ? 'warn' : 
                 event.severity === 'medium' ? 'warn' : 'info';

    logger[level]('Security event detected', {
      type: event.type,
      severity: event.severity,
      ip: event.ip,
      userId: event.userId,
      details: event.details,
      timestamp: event.timestamp
    });

    // Log to security metrics
    performanceMonitor.recordMetric({
      duration: 0,
      statusCode: 0,
      method: 'security',
      route: 'monitor',
      userId: event.userId,
      userAgent: event.userAgent,
      ip: event.ip,
      responseSize: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    });
  }

  private getCurrentIP(): string {
    // In real implementation, this would get the real client IP
    return 'unknown';
  }

  isIPBlocked(ip: string): boolean {
    const blockData = this.blockedIPs.get(ip);
    if (!blockData) return false;

    const blockDuration = 3600000; // 1 hour
    return (Date.now() - blockData.lastBlock) < blockDuration;
  }

  isUserSuspicious(userId: string): boolean {
    const userData = this.suspiciousUsers.get(userId);
    if (!userData) return false;

    const suspiciousDuration = 1800000; // 30 minutes
    return (Date.now() - userData.lastSuspicious) < suspiciousDuration;
  }

  getSecuritySummary(): {
    totalEvents: number;
    criticalEvents: number;
    highEvents: number;
    mediumEvents: number;
    lowEvents: number;
    blockedIPs: number;
    suspiciousUsers: number;
    recentEvents: SecurityEvent[];
  } {
    const now = Date.now();
    const recentPeriod = 3600000; // Last 1 hour

    const recentEvents = this.events.filter(event => 
      now - new Date(event.timestamp).getTime() < recentPeriod
    );

    return {
      totalEvents: this.events.length,
      criticalEvents: this.events.filter(e => e.severity === 'critical').length,
      highEvents: this.events.filter(e => e.severity === 'high').length,
      mediumEvents: this.events.filter(e => e.severity === 'medium').length,
      lowEvents: this.events.filter(e => e.severity === 'low').length,
      blockedIPs: this.blockedIPs.size,
      suspiciousUsers: this.suspiciousUsers.size,
      recentEvents: recentEvents.slice(-10) // Last 10 events
    };
  }

  generateSecurityReport(): string {
    const summary = this.getSecuritySummary();
    
    return `
# 🔒 Security Monitoring Report

**Timestamp:** ${new Date().toISOString()}

## 📊 Summary
- **Total Events:** ${summary.totalEvents}
- **Critical Events:** ${summary.criticalEvents}
- **High Events:** ${summary.highEvents}
- **Medium Events:** ${summary.mediumEvents}
- **Low Events:** ${summary.lowEvents}
- **Blocked IPs:** ${summary.blockedIPs}
- **Suspicious Users:** ${summary.suspiciousUsers}

## 🔥 Recent Events (Last 10)
${summary.recentEvents.map(event => 
      `- **${event.type.toUpperCase()}** (${event.severity}): ${event.details.message || 'No details'}`
    ).join('\n')}

## 🚨 Critical Issues Requiring Immediate Attention
${summary.criticalEvents > 0 ? 'CRITICAL: Immediate security review required!' : '✅ No critical issues detected'}
${summary.highEvents > 5 ? 'HIGH: Elevated security activity detected!' : '✅ Security activity within normal ranges'}

---
*This report is generated automatically. Review logs for detailed analysis.*
    `.trim();
  }
}

export const securityMonitor = new SecurityMonitor();

// Middleware functions
export const securityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Check if IP is blocked
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  
  if (securityMonitor.isIPBlocked(clientIP)) {
    logger.warn('Blocked IP attempted access', {
      ip: clientIP,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent')
    });

    return res.status(403).json({
      success: false,
      error: {
        code: 'IP_BLOCKED',
        message: 'Access denied: IP address has been blocked due to suspicious activity'
      }
    });
  }

  // Check for suspicious activity
  const userId = (req as any).user?.userId;
  if (userId && securityMonitor.isUserSuspicious(userId)) {
    logger.warn('Suspicious user activity detected', {
      userId,
      ip: clientIP,
      path: req.path,
      method: req.method
    });

    // Require re-authentication for suspicious users
    return res.status(401).json({
      success: false,
      error: {
        code: 'USER_SUSPICIOUS',
        message: 'Additional authentication required for security verification'
      }
    });
  }

  next();
};

export const recordSecurityEvent = (event: Omit<SecurityEvent, 'timestamp'>) => {
  securityMonitor.recordEvent(event);
};

export const getSecuritySummary = () => securityMonitor.getSecuritySummary();

export const generateSecurityReport = () => securityMonitor.generateSecurityReport();
