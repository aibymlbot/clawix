import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { JwtPayload } from '../auth/auth.types.js';

/**
 * Custom throttler guard that tracks rate limits by user ID (authenticated)
 * or IP address (unauthenticated). This ensures per-user rate limiting
 * rather than per-IP, which is more fair behind load balancers/proxies.
 */
@Injectable()
export class PolicyThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req['user'] as JwtPayload | undefined;
    if (user?.sub) return user.sub;
    return (req['ip'] as string | undefined) ?? 'unknown';
  }
}
