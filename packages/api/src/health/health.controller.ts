import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { Public } from '../auth/public.decorator.js';
import { PrismaHealthIndicator } from './prisma.health-indicator.js';
import { RedisHealthIndicator } from './redis.health-indicator.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
  ) {}

  /** Liveness probe — confirms the process is running. No dependency checks. */
  @Public()
  @SkipThrottle()
  @Get('live')
  @HealthCheck()
  live() {
    return this.healthCheckService.check([]);
  }

  /** Readiness probe — verifies database and Redis connectivity. */
  @Public()
  @SkipThrottle()
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.healthCheckService.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.redisHealth.isHealthy('redis'),
    ]);
  }

  /** Backward-compatible health endpoint. Same as readiness probe. */
  @Public()
  @SkipThrottle()
  @Get()
  @HealthCheck()
  health() {
    return this.ready();
  }
}
