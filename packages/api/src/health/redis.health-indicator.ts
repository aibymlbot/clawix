import { Injectable } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import { createLogger } from '@clawix/shared';
import { RedisService } from '../cache/redis.service.js';

const logger = createLogger('health:redis');

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly redisService: RedisService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      const isAlive = await this.redisService.ping();
      if (isAlive) {
        return indicator.up();
      }
      logger.warn('Redis ping returned false');
      return indicator.down({ message: 'Redis ping failed' });
    } catch (error) {
      logger.warn({ err: error }, 'Redis health check failed');
      return indicator.down({
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
