import { describe, it, expect } from 'vitest';
import { PolicyThrottlerGuard } from '../policy-throttler.guard.js';

// Access protected method via subclass
class TestableThrottlerGuard extends PolicyThrottlerGuard {
  async testGetTracker(req: Record<string, unknown>): Promise<string> {
    return this.getTracker(req);
  }
}

describe('PolicyThrottlerGuard', () => {
  // Instantiate without DI — ThrottlerGuard constructor needs options but
  // getTracker() doesn't use them, so we bypass with Object.create
  const guard = Object.create(TestableThrottlerGuard.prototype) as TestableThrottlerGuard;

  it('should return user.sub when authenticated user exists', async () => {
    const req = {
      user: { sub: 'user-123', email: 'a@b.com', role: 'admin', policyName: 'Extended' },
    };
    expect(await guard.testGetTracker(req)).toBe('user-123');
  });

  it('should return IP address when no user on request', async () => {
    const req = { ip: '192.168.1.1' };
    expect(await guard.testGetTracker(req)).toBe('192.168.1.1');
  });

  it('should return "unknown" when neither user nor IP exists', async () => {
    const req = {};
    expect(await guard.testGetTracker(req)).toBe('unknown');
  });

  it('should return IP when user exists but has no sub', async () => {
    const req = { user: { email: 'a@b.com' }, ip: '10.0.0.1' };
    expect(await guard.testGetTracker(req)).toBe('10.0.0.1');
  });
});
