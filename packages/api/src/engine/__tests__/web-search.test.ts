import { describe, expect, it, vi } from 'vitest';

import { createWebSearchTool } from '../tools/web/web-search.js';
import { SearchProviderRegistry } from '../tools/web/search-provider.js';

function makeRegistry(): {
  registry: SearchProviderRegistry;
  mockProvider: { name: string; search: ReturnType<typeof vi.fn> };
} {
  const registry = new SearchProviderRegistry();
  const mockProvider = {
    name: 'mock',
    search: vi.fn().mockResolvedValue([
      { title: 'First Result', url: 'https://first.com', snippet: 'First snippet' },
      { title: 'Second Result', url: 'https://second.com', snippet: 'Second snippet' },
    ]),
  };
  registry.addProvider(mockProvider);
  return { registry, mockProvider };
}

describe('web_search tool — metadata', () => {
  it('has name "web_search"', () => {
    const { registry } = makeRegistry();
    const tool = createWebSearchTool(registry);
    expect(tool.name).toBe('web_search');
  });

  it('requires query parameter', () => {
    const { registry } = makeRegistry();
    const tool = createWebSearchTool(registry);
    expect(tool.parameters.required).toContain('query');
  });

  it('has optional count parameter', () => {
    const { registry } = makeRegistry();
    const tool = createWebSearchTool(registry);
    expect(tool.parameters.properties?.['count']).toBeDefined();
    expect(tool.parameters.required).not.toContain('count');
  });
});

describe('web_search tool — execute', () => {
  it('returns formatted numbered results', async () => {
    const { registry } = makeRegistry();
    const tool = createWebSearchTool(registry);
    const result = await tool.execute({ query: 'test query' });

    expect(result.isError).toBe(false);
    expect(result.output).toContain('1. First Result');
    expect(result.output).toContain('https://first.com');
    expect(result.output).toContain('First snippet');
    expect(result.output).toContain('2. Second Result');
  });

  it('defaults count to 5 when not provided', async () => {
    const { registry, mockProvider } = makeRegistry();
    const tool = createWebSearchTool(registry);

    await tool.execute({ query: 'test' });
    expect(mockProvider.search).toHaveBeenCalledWith('test', 5);
  });

  it('passes explicit count to provider', async () => {
    const { registry, mockProvider } = makeRegistry();
    const tool = createWebSearchTool(registry);

    await tool.execute({ query: 'test', count: 3 });
    expect(mockProvider.search).toHaveBeenCalledWith('test', 3);
  });

  it('returns error result on provider failure', async () => {
    const registry = new SearchProviderRegistry();
    const failProvider = {
      name: 'fail',
      search: vi.fn().mockRejectedValue(new Error('rate limited')),
    };
    registry.addProvider(failProvider);

    const tool = createWebSearchTool(registry);
    const result = await tool.execute({ query: 'test' });

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Search failed');
    expect(result.output).toContain('rate limited');
  });

  it('handles empty results', async () => {
    const registry = new SearchProviderRegistry();
    const emptyProvider = {
      name: 'empty',
      search: vi.fn().mockResolvedValue([]),
    };
    registry.addProvider(emptyProvider);

    const tool = createWebSearchTool(registry);
    const result = await tool.execute({ query: 'obscure' });

    expect(result.isError).toBe(false);
    expect(result.output).toContain('No results found');
  });
});
