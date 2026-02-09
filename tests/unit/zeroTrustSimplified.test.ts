import { ZeroTrustContextManager, VerificationMethod, TrustLevel } from '@/security/zeroTrustSimplified';

describe('ZeroTrustContextManager', () => {
  it('should create context and allow access for low risk', () => {
    const manager = new ZeroTrustContextManager() as any;
    manager.riskAssessment.calculateRiskScore = jest.fn().mockReturnValue(10);

    const context = manager.createContext({
      userId: 'user-1',
      sessionId: 'session-1',
      method: VerificationMethod.PASSWORD,
      timestamp: Date.now()
    });

    expect(context.riskScore).toBe(10);

    const decision = manager.evaluateAccess('session-1');
    expect(decision?.allowed).toBe(true);
    expect(decision?.trustLevel).toBe(TrustLevel.VERIFIED);
  });

  it('should require MFA or deny access for high risk', () => {
    const manager = new ZeroTrustContextManager() as any;
    manager.riskAssessment.calculateRiskScore = jest.fn().mockReturnValue(90);

    manager.createContext({
      userId: 'user-2',
      sessionId: 'session-2',
      method: VerificationMethod.PASSWORD,
      timestamp: Date.now()
    });

    const decision = manager.evaluateAccess('session-2');
    expect(decision?.allowed).toBe(false);
    expect(decision?.trustLevel).toBe(TrustLevel.UNTRUSTED);
  });

  it('should update context and recalculate risk', () => {
    const manager = new ZeroTrustContextManager() as any;
    manager.riskAssessment.calculateRiskScore = jest.fn().mockReturnValue(45);

    manager.createContext({
      userId: 'user-3',
      sessionId: 'session-3',
      method: VerificationMethod.MFA,
      timestamp: Date.now()
    });

    const updated = manager.updateContext('session-3', {
      userAgent: 'test-agent'
    });

    expect(updated?.riskScore).toBe(45);
    const decision = manager.evaluateAccess('session-3');
    expect(decision?.allowed).toBe(true);
    expect(decision?.requiredActions.length).toBe(0);
  });
});
