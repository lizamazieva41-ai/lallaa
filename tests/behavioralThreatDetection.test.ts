jest.useFakeTimers();

const {
  threatDetection,
  ThreatType,
} = require('@/security/behavioralThreatDetection');

describe('Behavioral Threat Detection', () => {
  afterAll(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should expose default rules', () => {
    const rules = threatDetection.getRules();
    expect(rules.length).toBeGreaterThan(0);
  });

  it('should add and remove a rule', () => {
    const rule = {
      id: 'custom-rule-1',
      name: 'Custom Rule',
      description: 'Custom rule for testing',
      enabled: true,
      threatType: ThreatType.SUSPICIOUS_LOGIN,
      conditions: [
        { field: 'login.failed_count', operator: 'greater_than', value: 3, weight: 1 }
      ],
      actions: [
        { type: 'log', parameters: { level: 'warning' } }
      ],
      priority: 10,
      threshold: { count: 1, timeWindow: 60000 },
      metadata: {}
    };

    threatDetection.addRule(rule);
    expect(threatDetection.getRules().some((r: any) => r.id === 'custom-rule-1')).toBe(true);

    const removed = threatDetection.removeRule('custom-rule-1');
    expect(removed).toBe(true);
    expect(threatDetection.getRules().some((r: any) => r.id === 'custom-rule-1')).toBe(false);
  });

  it('should create threat for suspicious login pattern', () => {
    const threat = threatDetection.recordSecurityEvent('login_attempt', {
      userId: 'user-1',
      sessionId: 'session-1',
      location: { unusual: true },
      device: { unknown: true },
      time: { unusual: true }
    });

    expect(threat).not.toBeNull();
    expect(threat.type).toBe(ThreatType.SUSPICIOUS_LOGIN);
  });

  it('should create threat for brute force pattern', () => {
    const threat = threatDetection.recordSecurityEvent('login_attempt', {
      userId: 'user-2',
      login: { failed_count: 6, time_window: 1000 }
    });

    expect(threat).not.toBeNull();
    expect(threat.type).toBe(ThreatType.BRUTE_FORCE);
  });

  it('should return statistics', () => {
    const stats = threatDetection.getStatistics();
    expect(stats).toHaveProperty('totalThreats');
    expect(stats).toHaveProperty('totalIndicators');
  });

  it('should add patterns and retrain ML patterns', async () => {
    const pattern = {
      id: 'pattern-ml-1',
      name: 'ML Pattern',
      threatType: ThreatType.ANOMALOUS_BEHAVIOR,
      detectionMethod: 'machine_learning',
      isActive: true,
      indicators: ['ml', 'behavior']
    };

    threatDetection.addPattern(pattern);
    const patterns = threatDetection.getPatterns();
    expect(patterns.some((p: any) => p.id === 'pattern-ml-1')).toBe(true);

    const retrainResult = await threatDetection.retrainModel('pattern-ml-1');
    expect(retrainResult).toBe(true);
  });

  it('should track actions with missing metadata and cleanup old results', () => {
    const now = Date.now();
    const oldTimestamp = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();

    threatDetection.trackUserAction('user-test', {
      id: 'action-old',
      type: 'api_call',
      timestamp: oldTimestamp
    });

    threatDetection.trackUserAction('user-test', {
      id: 'action-new',
      type: 'card_lookup',
      timestamp: new Date(now).toISOString()
    });

    const beforeCleanup = threatDetection.getDetectionResultsByUser('user-test', 10);
    expect(beforeCleanup.length).toBeGreaterThan(0);

    threatDetection.cleanupOldData(1);
    const afterCleanup = threatDetection.getDetectionResultsByUser('user-test', 10);
    expect(afterCleanup.some((r: any) => r.id === 'action-old')).toBe(false);
    expect(afterCleanup.some((r: any) => r.id === 'action-new')).toBe(true);
  });
});
