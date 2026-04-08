import { describe, expect, it } from 'vitest';

import type { ToolDefinition } from '@clawix/shared';

import { toToolDefinition, type Tool, type ToolResult, type ParamSchema } from '../tool.js';

describe('Tool types', () => {
  it('ToolResult should have output and isError', () => {
    const result: ToolResult = { output: 'hello', isError: false };
    expect(result.output).toBe('hello');
    expect(result.isError).toBe(false);
  });

  it('ParamSchema should support nested properties', () => {
    const schema: ParamSchema = {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The name', minLength: 1, maxLength: 100 },
        age: { type: 'integer', minimum: 0, maximum: 150 },
        tags: { type: 'array', items: { type: 'string' } },
        role: { type: 'string', enum: ['admin', 'user'] },
      },
      required: ['name'],
    };
    expect(schema?.properties?.['name']?.type).toBe('string');
    expect(schema.required).toEqual(['name']);
  });
});

describe('toToolDefinition', () => {
  it('converts a Tool to ToolDefinition format', () => {
    const tool: Tool = {
      name: 'test-tool',
      description: 'A test tool',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
      execute: async () => ({ output: 'result', isError: false }),
    };

    const def: ToolDefinition = toToolDefinition(tool);

    expect(def.name).toBe('test-tool');
    expect(def.description).toBe('A test tool');
    expect(def.inputSchema).toEqual(tool.parameters);
  });

  it('returns inputSchema as a Record<string, unknown>', () => {
    const tool: Tool = {
      name: 'empty-tool',
      description: 'No params',
      parameters: { type: 'object' },
      execute: async () => ({ output: '', isError: false }),
    };

    const def = toToolDefinition(tool);
    expect(def.inputSchema).toEqual({ type: 'object' });
  });
});
