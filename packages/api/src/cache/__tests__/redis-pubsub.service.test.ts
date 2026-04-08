import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { ExternalServiceError } from '@clawix/shared';

import { createMockRedisClient, createMockConfigService } from './mock-redis.js';
import type { MockRedisClient, MockConfigService } from './mock-redis.js';
import { RedisPubSubService } from '../redis-pubsub.service.js';
import type { PubSubMessage } from '../cache.types.js';

// Two mock clients: publisher and subscriber
const mockPublisher = createMockRedisClient();
const mockSubscriber = createMockRedisClient();
let constructorCallCount = 0;

vi.mock('ioredis', () => ({
  Redis: vi.fn(() => {
    constructorCallCount++;
    // First call = publisher, second = subscriber
    return constructorCallCount % 2 === 1 ? mockPublisher : mockSubscriber;
  }),
}));

function resetMockClient(client: MockRedisClient) {
  for (const fn of Object.values(client)) {
    if (typeof fn === 'function' && 'mockClear' in fn) {
      fn.mockClear();
    }
  }
  client.connect.mockResolvedValue(undefined);
  client.quit.mockResolvedValue('OK');
  client.on.mockReturnThis();
  client.removeAllListeners.mockReturnThis();
}

describe('RedisPubSubService', () => {
  let service: RedisPubSubService;
  let mockConfig: MockConfigService;

  beforeEach(() => {
    resetMockClient(mockPublisher);
    resetMockClient(mockSubscriber);
    constructorCallCount = 0;
    mockConfig = createMockConfigService();
    service = new RedisPubSubService(mockConfig as unknown as ConfigService);
  });

  describe('onModuleInit', () => {
    it('should connect both publisher and subscriber', async () => {
      await service.onModuleInit();

      expect(mockPublisher.connect).toHaveBeenCalledOnce();
      expect(mockSubscriber.connect).toHaveBeenCalledOnce();
    });

    it('should register message and pmessage listeners on subscriber', async () => {
      await service.onModuleInit();

      expect(mockSubscriber.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockSubscriber.on).toHaveBeenCalledWith('pmessage', expect.any(Function));
    });

    it('should throw ExternalServiceError on connection failure', async () => {
      mockPublisher.connect.mockRejectedValue(new Error('Connection refused'));

      await expect(service.onModuleInit()).rejects.toThrow(ExternalServiceError);
    });
  });

  describe('onModuleDestroy', () => {
    it('should quit both clients and clear handlers', async () => {
      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockPublisher.quit).toHaveBeenCalledOnce();
      expect(mockSubscriber.quit).toHaveBeenCalledOnce();
      expect(mockSubscriber.removeAllListeners).toHaveBeenCalledWith('message');
      expect(mockSubscriber.removeAllListeners).toHaveBeenCalledWith('pmessage');
      expect(service.getSubscriptionCount()).toBe(0);
    });
  });

  describe('publish', () => {
    it('should publish JSON envelope to channel', async () => {
      mockPublisher.publish.mockResolvedValue(2);

      const result = await service.publish('test-channel', { data: 'hello' });

      expect(result).toBe(2);
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'test-channel',
        expect.stringContaining('"payload":{"data":"hello"}'),
      );
    });

    it('should include timestamp in envelope', async () => {
      mockPublisher.publish.mockResolvedValue(1);

      await service.publish('ch', 'msg');

      const [, raw] = mockPublisher.publish.mock.calls[0] as [string, string];
      const envelope = JSON.parse(raw) as PubSubMessage<string>;
      expect(envelope.channel).toBe('ch');
      expect(envelope.timestamp).toBeDefined();
      expect(new Date(envelope.timestamp).getTime()).not.toBeNaN();
    });
  });

  describe('subscribe', () => {
    it('should call subscriber.subscribe on first handler for a channel', async () => {
      const handler = vi.fn();

      await service.subscribe('ch1', handler);

      expect(mockSubscriber.subscribe).toHaveBeenCalledWith('ch1');
      expect(service.getSubscriptionCount()).toBe(1);
    });

    it('should not call subscriber.subscribe for subsequent handlers on same channel', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      await service.subscribe('ch1', handler1);
      await service.subscribe('ch1', handler2);

      expect(mockSubscriber.subscribe).toHaveBeenCalledTimes(1);
      expect(service.getSubscriptionCount()).toBe(1);
    });
  });

  describe('unsubscribe', () => {
    it('should call subscriber.unsubscribe and remove handlers', async () => {
      await service.subscribe('ch1', vi.fn());

      await service.unsubscribe('ch1');

      expect(mockSubscriber.unsubscribe).toHaveBeenCalledWith('ch1');
      expect(service.getSubscriptionCount()).toBe(0);
    });
  });

  describe('psubscribe', () => {
    it('should call subscriber.psubscribe on first handler', async () => {
      const handler = vi.fn();

      await service.psubscribe('notifications:*', handler);

      expect(mockSubscriber.psubscribe).toHaveBeenCalledWith('notifications:*');
      expect(service.getSubscriptionCount()).toBe(1);
    });

    it('should not re-subscribe for additional handlers on same pattern', async () => {
      await service.psubscribe('n:*', vi.fn());
      await service.psubscribe('n:*', vi.fn());

      expect(mockSubscriber.psubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('punsubscribe', () => {
    it('should call subscriber.punsubscribe and remove handlers', async () => {
      await service.psubscribe('n:*', vi.fn());

      await service.punsubscribe('n:*');

      expect(mockSubscriber.punsubscribe).toHaveBeenCalledWith('n:*');
      expect(service.getSubscriptionCount()).toBe(0);
    });
  });

  describe('message dispatch', () => {
    it('should dispatch parsed messages to channel handlers', async () => {
      const handler = vi.fn();
      await service.onModuleInit();
      await service.subscribe('ch1', handler);

      // Simulate the subscriber receiving a message
      const messageCallback = mockSubscriber.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'message',
      )?.[1] as (channel: string, raw: string) => void;

      const envelope: PubSubMessage = {
        channel: 'ch1',
        payload: { data: 'test' },
        timestamp: new Date().toISOString(),
      };
      messageCallback('ch1', JSON.stringify(envelope));

      expect(handler).toHaveBeenCalledWith(envelope);
    });

    it('should not throw when handler throws (sync)', async () => {
      const handler = vi.fn().mockImplementation(() => {
        throw new Error('handler error');
      });
      await service.onModuleInit();
      await service.subscribe('ch1', handler);

      const messageCallback = mockSubscriber.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'message',
      )?.[1] as (channel: string, raw: string) => void;

      const envelope: PubSubMessage = {
        channel: 'ch1',
        payload: {},
        timestamp: new Date().toISOString(),
      };

      // Should not throw
      expect(() => {
        messageCallback('ch1', JSON.stringify(envelope));
      }).not.toThrow();
    });

    it('should skip dispatch for invalid JSON messages', async () => {
      const handler = vi.fn();
      await service.onModuleInit();
      await service.subscribe('ch1', handler);

      const messageCallback = mockSubscriber.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'message',
      )?.[1] as (channel: string, raw: string) => void;

      messageCallback('ch1', 'not-json{');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should dispatch pattern messages to pattern handlers', async () => {
      const handler = vi.fn();
      await service.onModuleInit();
      await service.psubscribe('n:*', handler);

      const pmessageCallback = mockSubscriber.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'pmessage',
      )?.[1] as (pattern: string, channel: string, raw: string) => void;

      const envelope: PubSubMessage = {
        channel: 'n:user1',
        payload: { type: 'alert' },
        timestamp: new Date().toISOString(),
      };
      pmessageCallback('n:*', 'n:user1', JSON.stringify(envelope));

      expect(handler).toHaveBeenCalledWith(envelope);
    });
  });

  describe('getSubscriptionCount', () => {
    it('should count channels and patterns separately', async () => {
      await service.subscribe('ch1', vi.fn());
      await service.subscribe('ch2', vi.fn());
      await service.psubscribe('p:*', vi.fn());

      expect(service.getSubscriptionCount()).toBe(3);
    });
  });
});
