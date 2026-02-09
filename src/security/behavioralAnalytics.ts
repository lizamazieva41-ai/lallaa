import { EventEmitter } from 'events';

// Interface cho phiên người dùng
export interface UserSession {
  sessionId: string;
  userId?: string;
  deviceId?: string;
  startTime: number;
  lastActivity: number;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  riskScore: number;
  events: SessionEvent[];
}

// Interface cho sự kiện phiên
export interface SessionEvent {
  id: string;
  sessionId: string;
  type: 'login' | 'logout' | 'action' | 'error' | 'suspicious';
  timestamp: number;
  description: string;
  data?: any;
  riskScore: number;
}

// Interface cho mẫu hành vi
export interface BehaviorPattern {
  patternId: string;
  userId?: string;
  sessionId?: string;
  type: 'typing' | 'mouse' | 'navigation' | 'timing';
  data: any;
  timestamp: number;
  riskScore: number;
  confidence: number;
}

// Interface cho điểm truy cập
export interface AccessPoint {
  id: string;
  path: string;
  method: string;
  timestamp: number;
  duration: number;
  success: boolean;
  riskScore: number;
}

// Interface cho phân tích hành vi
export interface BehaviorAnalysis {
  userId?: string;
  sessionId: string;
  timestamp: number;
  overallRiskScore: number;
  riskFactors: string[];
  anomalies: BehaviorAnomaly[];
  recommendations: string[];
}

// Interface cho bất thường hành vi
export interface BehaviorAnomaly {
  type: 'timing' | 'location' | 'device' | 'frequency' | 'pattern';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  detectedAt: number;
}

// Lớp phân tích hành vi
export class BehaviorAnalytics extends EventEmitter {
  private sessions: Map<string, UserSession> = new Map();
  private patterns: Map<string, BehaviorPattern> = new Map();
  private accessPoints: Map<string, AccessPoint[]> = new Map();
  private analyses: Map<string, BehaviorAnalysis> = new Map();
  private baselineProfiles: Map<string, BehaviorBaseline> = new Map();

  constructor() {
    super();
    this.initializeBaselines();
  }

  // Khởi tạo baseline
  private initializeBaselines(): void {
    // Tạo baseline hành vi mặc định
    const defaultBaseline: BehaviorBaseline = {
      userId: 'default',
      typingSpeed: { mean: 60, stdDev: 15 },
      mouseMovements: { mean: 100, stdDev: 30 },
      loginFrequency: { mean: 5, stdDev: 2 },
      activeHours: [8, 9, 10, 11, 14, 15, 16, 17, 18],
      typicalDuration: 480, // 8 giờ
      lastUpdated: Date.now()
    };

    this.baselineProfiles.set('default', defaultBaseline);
  }

  // Tạo phiên mới
  public createSession(
    sessionId: string,
    ipAddress: string,
    userAgent: string,
    userId?: string
  ): UserSession {
    const session: UserSession = {
      sessionId,
      userId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      ipAddress,
      userAgent,
      isActive: true,
      riskScore: 0,
      events: []
    };

    this.sessions.set(sessionId, session);

    // Thêm sự kiện bắt đầu phiên
    this.addEvent(sessionId, 'login', 'Phiên bắt đầu', {
      userId,
      ipAddress,
      userAgent
    });

    this.emit('sessionCreated', session);
    return session;
  }

  // Cập nhật hoạt động phiên
  public updateSessionActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) return;

    session.lastActivity = Date.now();
    this.emit('sessionUpdated', session);
  }

  // Thêm sự kiện phiên
  public addEvent(
    sessionId: string,
    type: SessionEvent['type'],
    description: string,
    data?: any,
    riskScore: number = 0
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const event: SessionEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      type,
      timestamp: Date.now(),
      description,
      data,
      riskScore
    };

    session.events.push(event);
    session.lastActivity = Date.now();

    this.emit('sessionEvent', event);

    // Kiểm tra hành vi đáng ngờ
    if (type === 'suspicious' || riskScore > 50) {
      this.analyzeSuspiciousActivity(sessionId, event);
    }
  }

  // Ghi lại mẫu hành vi
  public recordBehavior(
    sessionId: string,
    type: BehaviorPattern['type'],
    data: any
  ): BehaviorPattern {
    const pattern: BehaviorPattern = {
      patternId: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      type,
      data,
      timestamp: Date.now(),
      riskScore: this.calculatePatternRisk(sessionId, type, data),
      confidence: Math.random() // Mô phỏng độ tin cậy
    };

    this.patterns.set(pattern.patternId, pattern);
    this.emit('behaviorRecorded', pattern);

    return pattern;
  }

  // Ghi lại điểm truy cập
  public recordAccess(
    sessionId: string,
    path: string,
    method: string,
    duration: number,
    success: boolean = true
  ): AccessPoint {
    const access: AccessPoint = {
      id: `access_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      path,
      method,
      timestamp: Date.now(),
      duration,
      success,
      riskScore: this.calculateAccessRisk(sessionId, path, method, duration, success)
    };

    if (!this.accessPoints.has(sessionId)) {
      this.accessPoints.set(sessionId, []);
    }
    this.accessPoints.get(sessionId)!.push(access);

    this.emit('accessRecorded', access);
    return access;
  }

  // Tính rủi ro mẫu
  private calculatePatternRisk(
    sessionId: string,
    type: BehaviorPattern['type'],
    data: any
  ): number {
    const session = this.sessions.get(sessionId);
    if (!session) return 0;

    const baseline = this.getBaselineForUser(session.userId || 'default');
    let risk = 0;

    switch (type) {
      case 'typing':
        risk = this.analyzeTypingPattern(data, baseline);
        break;
      case 'mouse':
        risk = this.analyzeMousePattern(data, baseline);
        break;
      case 'navigation':
        risk = this.analyzeNavigationPattern(data, baseline);
        break;
      case 'timing':
        risk = this.analyzeTimingPattern(data, baseline);
        break;
    }

    return Math.min(risk, 100);
  }

  // Phân tích mẫu gõ phím
  private analyzeTypingPattern(data: any, baseline: BehaviorBaseline): number {
    const speed = data.typingSpeed || 0;
    const deviation = Math.abs(speed - baseline.typingSpeed.mean) / baseline.typingSpeed.stdDev;
    
    // Rủi ro tăng nếu tốc độ gõ khác biệt nhiều
    if (deviation > 2) return 30;
    if (deviation > 1) return 15;
    return 0;
  }

  // Phân tích mẫu chuột
  private analyzeMousePattern(data: any, baseline: BehaviorBaseline): number {
    const movements = data.movements || 0;
    const deviation = Math.abs(movements - baseline.mouseMovements.mean) / baseline.mouseMovements.stdDev;
    
    if (deviation > 2) return 25;
    if (deviation > 1) return 10;
    return 0;
  }

  // Phân tích mẫu điều hướng
  private analyzeNavigationPattern(data: any, baseline: BehaviorBaseline): number {
    // Kiểm tra truy cập các đường dẫn bất thường
    const suspiciousPaths = ['/admin', '/config', '/debug', '/system'];
    const currentPath = data.path || '';
    
    for (const suspicious of suspiciousPaths) {
      if (currentPath.includes(suspicious)) {
        return 40;
      }
    }

    // Kiểm tra tần suất truy cập
    const frequency = data.frequency || 0;
    if (frequency > baseline.loginFrequency.mean + 2 * baseline.loginFrequency.stdDev) {
      return 20;
    }

    return 0;
  }

  // Phân tích mẫu thời gian
  private analyzeTimingPattern(data: any, baseline: BehaviorBaseline): number {
    const hour = new Date().getHours();
    
    // Kiểm tra giờ hoạt động bất thường
    if (!baseline.activeHours.includes(hour)) {
      return 35;
    }

    // Kiểm tra thời gian phiên
    const sessionDuration = data.sessionDuration || 0;
    if (sessionDuration > baseline.typicalDuration * 1.5) {
      return 25;
    }

    return 0;
  }

  // Tính rủi ro truy cập
  private calculateAccessRisk(
    sessionId: string,
    path: string,
    method: string,
    duration: number,
    success: boolean
  ): number {
    let risk = 0;

    // Rủi ro từ thất bại
    if (!success) risk += 40;

    // Rủi ro từ phương thức bất thường
    if (method === 'DELETE' || method === 'PUT') risk += 15;

    // Rủi ro từ đường dẫn nhạy cảm
    const sensitivePaths = ['/api/users', '/api/admin', '/api/config'];
    for (const sensitive of sensitivePaths) {
      if (path.includes(sensitive)) {
        risk += 20;
      }
    }

    // Rủi ro từ thời gian phản hồi
    if (duration > 5000) risk += 10; // 5 giây

    return Math.min(risk, 100);
  }

  // Phân tích hành vi tổng thể
  public analyzeBehavior(sessionId: string): BehaviorAnalysis {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Phiên không tồn tại');
    }

    const accessPoints = this.accessPoints.get(sessionId) || [];
    const sessionPatterns = Array.from(this.patterns.values())
      .filter(p => p.sessionId === sessionId);

    const analysis: BehaviorAnalysis = {
      userId: session.userId,
      sessionId,
      timestamp: Date.now(),
      overallRiskScore: 0,
      riskFactors: [],
      anomalies: [],
      recommendations: []
    };

    // Phân tích rủi ro từ sự kiện phiên
    let eventRisk = 0;
    for (const event of session.events) {
      eventRisk += event.riskScore;
      if (event.riskScore > 30) {
        analysis.riskFactors.push(event.description);
      }
    }

    // Phân tích rủi ro từ mẫu hành vi
    let patternRisk = 0;
    for (const pattern of sessionPatterns) {
      patternRisk += pattern.riskScore;
    }

    // Phân tích rủi ro từ điểm truy cập
    let accessRisk = 0;
    for (const access of accessPoints) {
      accessRisk += access.riskScore;
    }

    // Tính điểm rủi ro tổng hợp
    const totalEvents = session.events.length + sessionPatterns.length + accessPoints.length;
    analysis.overallRiskScore = totalEvents > 0 
      ? (eventRisk + patternRisk + accessRisk) / totalEvents 
      : 0;

    // Phát hiện bất thường
    analysis.anomalies = this.detectAnomalies(session, sessionPatterns, accessPoints);

    // Tạo khuyến nghị
    analysis.recommendations = this.generateRecommendations(analysis);

    this.analyses.set(sessionId, analysis);
    this.emit('behaviorAnalyzed', analysis);

    return analysis;
  }

  // Phát hiện bất thường
  private detectAnomalies(
    session: UserSession,
    patterns: BehaviorPattern[],
    accessPoints: AccessPoint[]
  ): BehaviorAnomaly[] {
    const anomalies: BehaviorAnomaly[] = [];

    // Bất thường thời gian
    const sessionDuration = Date.now() - session.startTime;
    const baseline = this.getBaselineForUser(session.userId || 'default');
    
    if (sessionDuration > baseline.typicalDuration * 2) {
      anomalies.push({
        type: 'timing',
        description: 'Phiên hoạt động quá dài',
        severity: 'medium',
        riskScore: 30,
        detectedAt: Date.now()
      });
    }

    // Bất thường vị trí
    if (this.isUnusualLocation(session.ipAddress, session.userId)) {
      anomalies.push({
        type: 'location',
        description: 'Truy cập từ vị trí bất thường',
        severity: 'high',
        riskScore: 60,
        detectedAt: Date.now()
      });
    }

    // Bất thường tần suất
    const failedAttempts = session.events.filter(e => e.type === 'error').length;
    if (failedAttempts > 5) {
      anomalies.push({
        type: 'frequency',
        description: 'Nhiều lần thử thất bại',
        severity: 'critical',
        riskScore: 80,
        detectedAt: Date.now()
      });
    }

    return anomalies;
  }

  // Kiểm tra vị trí bất thường
  private isUnusualLocation(ipAddress: string, userId?: string): boolean {
    // Mô phỏng: một số IP được coi là bất thường
    const unusualIPs = ['192.168.1.999', '10.0.0.999'];
    return unusualIPs.includes(ipAddress);
  }

  // Tạo khuyến nghị
  private generateRecommendations(analysis: BehaviorAnalysis): string[] {
    const recommendations: string[] = [];

    if (analysis.overallRiskScore > 70) {
      recommendations.push('Kết thúc phiên ngay lập tức');
      recommendations.push('Yêu cầu xác thực lại');
    } else if (analysis.overallRiskScore > 50) {
      recommendations.push('Yêu cầu xác thực hai yếu tố');
      recommendations.push('Giám sát chặt chẽ');
    } else if (analysis.overallRiskScore > 30) {
      recommendations.push('Giới hạn quyền truy cập');
      recommendations.push('Ghi nhận hoạt động');
    }

    for (const anomaly of analysis.anomalies) {
      if (anomaly.severity === 'critical') {
        recommendations.push('Khóa tài khoản tạm thời');
      }
    }

    return recommendations;
  }

  // Lấy baseline cho người dùng
  private getBaselineForUser(userId: string): BehaviorBaseline {
    return this.baselineProfiles.get(userId) || this.baselineProfiles.get('default')!;
  }

  // Phân tích hoạt động đáng ngờ
  private analyzeSuspiciousActivity(sessionId: string, event: SessionEvent): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Tăng điểm rủi ro phiên
    session.riskScore = Math.min(session.riskScore + event.riskScore, 100);

    this.emit('suspiciousActivity', {
      sessionId,
      userId: session.userId,
      event,
      sessionRiskScore: session.riskScore
    });
  }

  // Kết thúc phiên
  public endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.isActive = false;
    session.lastActivity = Date.now();

    this.addEvent(sessionId, 'logout', 'Phiên kết thúc');

    this.emit('sessionEnded', session);
  }

  // Lấy phiên
  public getSession(sessionId: string): UserSession | undefined {
    return this.sessions.get(sessionId);
  }

  // Lấy tất cả phiên
  public getAllSessions(): UserSession[] {
    return Array.from(this.sessions.values());
  }

  // Lấy phân tích
  public getAnalysis(sessionId: string): BehaviorAnalysis | undefined {
    return this.analyses.get(sessionId);
  }

  // Dọn dẹp phiên cũ
  public cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 giờ
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > maxAge) {
        this.sessions.delete(sessionId);
        this.analyses.delete(sessionId);
        this.accessPoints.delete(sessionId);
        cleanedCount++;
      }
    }

    // Dọn dẹp mẫu hành vi cũ
    for (const [patternId, pattern] of this.patterns.entries()) {
      if (now - pattern.timestamp > maxAge) {
        this.patterns.delete(patternId);
        cleanedCount++;
      }
    }

    this.emit('cleanup', { cleanedCount });
  }
}

// Interface cho baseline hành vi
interface BehaviorBaseline {
  userId: string;
  typingSpeed: { mean: number; stdDev: number };
  mouseMovements: { mean: number; stdDev: number };
  loginFrequency: { mean: number; stdDev: number };
  activeHours: number[];
  typicalDuration: number;
  lastUpdated: number;
}

// Export singleton
export const behaviorAnalytics = new BehaviorAnalytics();