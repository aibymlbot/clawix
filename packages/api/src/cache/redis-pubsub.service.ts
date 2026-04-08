import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { createLogger, ExternalServiceError } from '@clawix/shared';
import { REDIS_CONNECT_TIMEOUT_MS } from './cache.constants.js';
import type { PubSubMessage, SubscriptionHandler } from './cache.types.js';

const logger = createLogger('redis-pubsub');

@Injectable()
export class RedisPubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly handlers = new Map<string, Set<SubscriptionHandler>>();
  private readonly patternHandlers = new Map<string, Set<SubscriptionHandler>>();

  constructor(@Inject(ConfigService) configService: ConfigService) {
    const url = configService.getOrThrow<string>('REDIS_URL');
    const options = { lazyConnect: true, maxRetriesPerRequest: 3 };
    this.publisher = new Redis(url, options);
    this.subscriber = new Redis(url, options);
  }

  async onModuleInit(): Promise<void> {
    logger.info('Connecting pub/sub clients...');
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Redis pub/sub connection timed out'));
      }, REDIS_CONNECT_TIMEOUT_MS);
    });

    try {
      await Promise.race([
        Promise.all([this.publisher.connect(), this.subscriber.connect()]),
        timeout,
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: error }, 'Failed to connect pub/sub clients');
      throw new ExternalServiceError('redis-pubsub', message);
    }

    this.subscriber.on('message', (channel: string, raw: string) => {
      this.dispatchMessage(channel, raw);
    });

    this.subscriber.on('pmessage', (_pattern: string, channel: string, raw: string) => {
      this.dispatchPatternMessage(_pattern, channel, raw);
    });

    logger.info('Redis pub/sub connected');
  }

  async onModuleDestroy(): Promise<void> {
    logger.info('Disconnecting pub/sub clients...');
    this.handlers.clear();
    this.patternHandlers.clear();
    this.subscriber.removeAllListeners('message');
    this.subscriber.removeAllListeners('pmessage');
    await Promise.all([this.publisher.quit(), this.subscriber.quit()]);
    logger.info('Redis pub/sub disconnected');
  }

  /** Publish a message to a channel. Returns the number of receivers. */
  async publish(channel: string, payload: unknown): Promise<number> {
    const envelope: PubSubMessage = {
      channel,
      payload,
      timestamp: new Date().toISOString(),
    };
    return this.publisher.publish(channel, JSON.stringify(envelope));
  }

  /** Subscribe to a channel with a typed handler. */
  async subscribe<T>(channel: string, handler: SubscriptionHandler<T>): Promise<void> {
    const existing = this.handlers.get(channel);
    if (existing) {
      existing.add(handler as SubscriptionHandler);
    } else {
      this.handlers.set(channel, new Set([handler as SubscriptionHandler]));
      await this.subscriber.subscribe(channel);
    }
  }

  /** Unsubscribe all handlers from a channel. */
  async unsubscribe(channel: string): Promise<void> {
    this.handlers.delete(channel);
    await this.subscriber.unsubscribe(channel);
  }

  /** Subscribe to channels matching a glob pattern. */
  async psubscribe<T>(pattern: string, handler: SubscriptionHandler<T>): Promise<void> {
    const existing = this.patternHandlers.get(pattern);
    if (existing) {
      existing.add(handler as SubscriptionHandler);
    } else {
      this.patternHandlers.set(pattern, new Set([handler as SubscriptionHandler]));
      await this.subscriber.psubscribe(pattern);
    }
  }

  /** Unsubscribe all handlers from a pattern. */
  async punsubscribe(pattern: string): Promise<void> {
    this.patternHandlers.delete(pattern);
    await this.subscriber.punsubscribe(pattern);
  }

  /** Returns the number of active channel subscriptions. */
  getSubscriptionCount(): number {
    return this.handlers.size + this.patternHandlers.size;
  }

  private dispatchMessage(channel: string, raw: string): void {
    const channelHandlers = this.handlers.get(channel);
    if (!channelHandlers || channelHandlers.size === 0) {
      return;
    }

    let message: PubSubMessage;
    try {
      message = JSON.parse(raw) as PubSubMessage;
    } catch {
      logger.warn({ channel }, 'Failed to parse pub/sub message as JSON');
      return;
    }

    for (const handler of channelHandlers) {
      try {
        const result = handler(message);
        if (result instanceof Promise) {
          result.catch((err: unknown) => {
            logger.error({ err, channel }, 'Pub/sub handler error (async)');
          });
        }
      } catch (err) {
        logger.error({ err, channel }, 'Pub/sub handler error (sync)');
      }
    }
  }

  private dispatchPatternMessage(pattern: string, channel: string, raw: string): void {
    const pHandlers = this.patternHandlers.get(pattern);
    if (!pHandlers || pHandlers.size === 0) {
      return;
    }

    let message: PubSubMessage;
    try {
      message = JSON.parse(raw) as PubSubMessage;
    } catch {
      logger.warn({ pattern, channel }, 'Failed to parse pub/sub pattern message as JSON');
      return;
    }

    for (const handler of pHandlers) {
      try {
        const result = handler(message);
        if (result instanceof Promise) {
          result.catch((err: unknown) => {
            logger.error({ err, pattern, channel }, 'Pattern handler error (async)');
          });
        }
      } catch (err) {
        logger.error({ err, pattern, channel }, 'Pattern handler error (sync)');
      }
    }
  }
}
