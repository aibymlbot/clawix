import { Injectable } from '@nestjs/common';
import { createLogger } from '@clawix/shared';
import { RedisService } from '../cache/redis.service.js';

const logger = createLogger('throttler');
const THROTTLE_PREFIX = 'throttle:';

/**
 * Lua script for atomic increment + conditional expire.
 * Returns [totalHits, ttl]. If the key is new (hits === 1),
 * sets TTL atomically — no race condition possible.
 */
const INCREMENT_SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return {hits, redis.call('TTL', KEYS[1])}
`;

/**
 * Redis-backed throttler storage for @nestjs/throttler.
 *
 * Note: Does not explicitly `implements ThrottlerStorage` because
 * @nestjs/throttler v6 exports ThrottlerStorage as a unique symbol
 * (injection token), not a TypeScript interface. Structural typing
 * ensures compatibility at compile time.
 */
@Injectable()
export class RedisThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    const client = this.redis.getClient();
    const prefixedKey = `${THROTTLE_PREFIX}${key}`;
    const blockKey = `${prefixedKey}:blocked`;
    const ttlSeconds = Math.ceil(ttl / 1000);
    const blockSeconds = Math.ceil(blockDuration / 1000);

    const blocked = await client.exists(blockKey);
    if (blocked) {
      const timeToBlockExpire = await client.ttl(blockKey);
      const totalHits = parseInt((await client.get(prefixedKey)) ?? '0', 10);
      return { totalHits, timeToExpire: ttlSeconds, isBlocked: true, timeToBlockExpire };
    }

    // Atomic increment + conditional expire via Lua script
    const result = (await client.eval(INCREMENT_SCRIPT, 1, prefixedKey, ttlSeconds)) as [
      number,
      number,
    ];
    const totalHits = result[0];
    const timeToExpire = result[1];

    if (totalHits > limit && blockSeconds > 0) {
      await client.setex(blockKey, blockSeconds, '1');
      logger.warn(
        { key: prefixedKey, totalHits, limit, blockSeconds },
        'Rate limit exceeded, blocking',
      );
      return { totalHits, timeToExpire, isBlocked: true, timeToBlockExpire: blockSeconds };
    }

    return { totalHits, timeToExpire, isBlocked: false, timeToBlockExpire: 0 };
  }
}
