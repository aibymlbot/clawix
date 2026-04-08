import { describe, it, expect, vi } from 'vitest';

// Mock the logger
vi.mock('@clawix/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@clawix/shared')>();
  return {
    ...actual,
    createLogger: vi.fn().mockReturnValue({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  };
});

import {
  mapFinishReason,
  mapToolChoice,
  parseToolCalls,
  toOpenAIMessage,
  toOpenAITool,
} from '../openai-utils.js';

describe('openai-utils', () => {
  describe('mapFinishReason', () => {
    it('maps "tool_calls" to "tool_use"', () => {
      expect(mapFinishReason('tool_calls')).toBe('tool_use');
    });

    it('maps "length" to "max_tokens"', () => {
      expect(mapFinishReason('length')).toBe('max_tokens');
    });

    it('maps "stop" to "stop"', () => {
      expect(mapFinishReason('stop')).toBe('stop');
    });

    it('maps "content_filter" to "error"', () => {
      expect(mapFinishReason('content_filter')).toBe('error');
    });

    it('maps null to "stop"', () => {
      expect(mapFinishReason(null)).toBe('stop');
    });

    it('maps undefined to "stop"', () => {
      expect(mapFinishReason(undefined)).toBe('stop');
    });

    it('maps unknown reasons to "stop"', () => {
      expect(mapFinishReason('some_future_reason')).toBe('stop');
    });
  });

  describe('toOpenAIMessage', () => {
    it('converts user messages', () => {
      expect(toOpenAIMessage({ role: 'user', content: 'Hello' })).toEqual({
        role: 'user',
        content: 'Hello',
      });
    });

    it('converts system messages', () => {
      expect(toOpenAIMessage({ role: 'system', content: 'Be helpful' })).toEqual({
        role: 'system',
        content: 'Be helpful',
      });
    });

    it('converts tool result messages', () => {
      expect(
        toOpenAIMessage({ role: 'tool', content: '{"result":1}', toolCallId: 'call_1' }),
      ).toEqual({
        role: 'tool',
        tool_call_id: 'call_1',
        content: '{"result":1}',
      });
    });

    it('converts assistant messages with tool calls', () => {
      const result = toOpenAIMessage({
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'c1', name: 'fn', arguments: { x: 1 } }],
      });

      expect(result).toEqual({
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'c1',
            type: 'function',
            function: { name: 'fn', arguments: '{"x":1}' },
          },
        ],
      });
    });
  });

  describe('toOpenAITool', () => {
    it('converts a ToolDefinition to OpenAI format', () => {
      expect(
        toOpenAITool({
          name: 'search',
          description: 'Search',
          inputSchema: { type: 'object' },
        }),
      ).toEqual({
        type: 'function',
        function: {
          name: 'search',
          description: 'Search',
          parameters: { type: 'object' },
        },
      });
    });
  });

  describe('parseToolCalls', () => {
    it('returns empty array for null/undefined', () => {
      expect(parseToolCalls(null)).toEqual([]);
      expect(parseToolCalls(undefined)).toEqual([]);
    });

    it('returns empty array for empty list', () => {
      expect(parseToolCalls([])).toEqual([]);
    });

    it('parses valid tool calls', () => {
      const result = parseToolCalls([
        {
          id: 'c1',
          type: 'function',
          function: { name: 'fn', arguments: '{"a":1}' },
        },
      ]);

      expect(result).toEqual([{ id: 'c1', name: 'fn', arguments: { a: 1 } }]);
    });

    it('filters out tool calls with malformed JSON and keeps valid ones', () => {
      const result = parseToolCalls([
        {
          id: 'good',
          type: 'function',
          function: { name: 'valid', arguments: '{"ok":true}' },
        },
        {
          id: 'bad',
          type: 'function',
          function: { name: 'broken', arguments: '{invalid' },
        },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: 'good', name: 'valid', arguments: { ok: true } });
    });

    it('returns empty array when all tool calls have malformed JSON', () => {
      const result = parseToolCalls([
        {
          id: 'bad1',
          type: 'function',
          function: { name: 'a', arguments: 'nope' },
        },
      ]);

      expect(result).toEqual([]);
    });
  });

  describe('mapToolChoice', () => {
    it('returns undefined when toolChoice is undefined', () => {
      expect(mapToolChoice(undefined)).toBeUndefined();
    });

    it('passes through "auto"', () => {
      expect(mapToolChoice('auto')).toBe('auto');
    });

    it('passes through "none"', () => {
      expect(mapToolChoice('none')).toBe('none');
    });

    it('maps { name } to function object', () => {
      expect(mapToolChoice({ name: 'get_weather' })).toEqual({
        type: 'function',
        function: { name: 'get_weather' },
      });
    });
  });
});
