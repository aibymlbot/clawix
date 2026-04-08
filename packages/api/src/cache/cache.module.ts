import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service.js';
import { RedisPubSubService } from './redis-pubsub.service.js';

@Global()
@Module({
  providers: [RedisService, RedisPubSubService],
  exports: [RedisService, RedisPubSubService],
})
export class CacheModule {}
