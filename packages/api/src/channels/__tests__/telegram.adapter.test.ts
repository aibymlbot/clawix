import { describe, expect, it, vi } from 'vitest';

import { createTelegramAdapter } from '../telegram/telegram.adapter.js';
import type { ChannelAdapterConfig } from '@clawix/shared';

// Mock grammy
vi.mock('grammy', () => {
  return {
    Bot: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      command: vi.fn(),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      api: {
        sendMessage: vi.fn().mockResolvedValue({}),
        sendChatAction: vi.fn().mockResolvedValue({}),
        setWebhook: vi.fn().mockResolvedValue({}),
      },
    })),
  };
});

describe('createTelegramAdapter', () => {
  const config: ChannelAdapterConfig = {
    id: 'channel-1',
    type: 'telegram',
    name: 'Test Bot',
    config: { bot_token: 'test-token-123' },
  };

  it('creates adapter with correct id and type', () => {
    const adapter = createTelegramAdapter(config);

    expect(adapter.id).toBe('channel-1');
    expect(adapter.type).toBe('telegram');
  });

  it('has all required Channel methods', () => {
    const adapter = createTelegramAdapter(config);

    expect(typeof adapter.connect).toBe('function');
    expect(typeof adapter.disconnect).toBe('function');
    expect(typeof adapter.sendMessage).toBe('function');
    expect(typeof adapter.sendTyping).toBe('function');
    expect(typeof adapter.onMessage).toBe('function');
  });

  it('throws when no bot token is provided', () => {
    const noTokenConfig: ChannelAdapterConfig = {
      id: 'ch-2',
      type: 'telegram',
      name: 'No Token',
      config: {},
    };

    expect(() => createTelegramAdapter(noTokenConfig)).toThrow('bot token');
  });

  it('registers onMessage handler', () => {
    const adapter = createTelegramAdapter(config);
    const handler = vi.fn();

    adapter.onMessage(handler);
    // Should not throw
    expect(adapter).toBeDefined();
  });
});
