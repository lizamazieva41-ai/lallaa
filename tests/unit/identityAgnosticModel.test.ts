import { IdentityAgnosticModel } from '@/security/identityAgnosticModel';
import { VerificationMethod } from '@/security/zeroTrustSimplified';

describe('IdentityAgnosticModel', () => {
  it('should create and verify a password proof', () => {
    const model = new IdentityAgnosticModel();
    const proof = model.createProof('session-1', VerificationMethod.PASSWORD, {
      password: 'strong-password'
    });

    const isValid = model.verifyProof(proof.id);
    expect(isValid).toBe(true);
  });

  it('should invalidate expired proofs', () => {
    const model = new IdentityAgnosticModel();
    const proof = model.createProof('session-2', VerificationMethod.PASSWORD, {
      password: 'strong-password'
    });

    proof.expiresAt = Date.now() - 1000;
    const isValid = model.verifyProof(proof.id);
    expect(isValid).toBe(false);
  });

  it('should register devices and analyze behavior', () => {
    const model = new IdentityAgnosticModel();
    const device = model.registerDevice('session-3', {
      userAgent: 'test-agent',
      platform: 'web'
    });

    expect(device.deviceId).toContain('device_');
    expect(device.isKnown).toBe(true);

    const pattern = model.analyzeBehavior('session-3', {
      typingSpeed: 120,
      mouseMovements: 300
    });

    expect(pattern.patternId).toContain('pattern_');
    expect(pattern.riskScore).toBeGreaterThanOrEqual(0);
  });

  it('should clean up expired proofs', () => {
    const model = new IdentityAgnosticModel();
    const proof = model.createProof('session-4', VerificationMethod.PASSWORD, {
      password: 'password123'
    });

    proof.expiresAt = Date.now() - 1000;
    model.cleanup();

    const isValid = model.verifyProof(proof.id);
    expect(isValid).toBe(false);
  });
});
