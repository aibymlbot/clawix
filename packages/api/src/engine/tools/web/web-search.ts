/**
 * Web search tool — searches the web via the configured search provider.
 *
 * Executes on the host (not in the container). The LLM reasoning loop
 * calls this tool and receives formatted search results.
 */
import { createLogger } from '@clawix/shared';

import type { Tool, ToolResult } from '../../tool.js';
import type { SearchProviderRegistry } from './search-provider.js';

const logger = createLogger('engine:tools:web:search');

const DEFAULT_COUNT = 5;

/**
 * Create a web_search tool that dispatches queries to the active search provider.
 */
export function createWebSearchTool(searchProviderRegistry: SearchProviderRegistry): Tool {
  return {
    name: 'web_search',
    description:
      'Search the web for current information. Returns titles, URLs, and snippets from search results.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        count: {
          type: 'integer',
          description: 'Number of results to return (1-10, default 5)',
          minimum: 1,
          maximum: 10,
        },
      },
      required: ['query'],
    },

    async execute(params: Record<string, unknown>): Promise<ToolResult> {
      const query = params['query'] as string;
      const count = params['count'] !== undefined ? (params['count'] as number) : DEFAULT_COUNT;

      logger.info({ query, count }, 'web_search invoked');

      try {
        const results = await searchProviderRegistry.search(query, count);

        if (results.length === 0) {
          return { output: `No results found for "${query}".`, isError: false };
        }

        const formatted = results
          .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
          .join('\n\n');

        const header = `Found ${results.length} result${results.length === 1 ? '' : 's'} for "${query}":\n\n`;

        return { output: header + formatted, isError: false };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ query, error: message }, 'web_search failed');
        return { output: `Search failed: ${message}`, isError: true };
      }
    },
  };
}
