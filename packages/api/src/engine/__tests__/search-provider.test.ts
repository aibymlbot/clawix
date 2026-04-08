import { describe, expect, it, vi } from 'vitest';

import { SearchProviderRegistry } from '../tools/web/search-provider.js';
import type { SearchProvider, SearchResult } from '../tools/web/search-provider.js';

const MOCK_RESULTS: readonly SearchResult[] = [
  { title: 'Result 1', url: 'https://example.com/1', snippet: 'Snippet 1' },
];

const MOCK_RESULTS_ALT: readonly SearchResult[] = [
  { title: 'Fallback Result', url: 'https://example.com/2', snippet: 'Snippet 2' },
];

function makeMockProvider(
  name: string,
  results: readonly SearchResult[] = MOCK_RESULTS,
): SearchProvider {
  return {
    name,
    search: vi.fn().mockResolvedValue(results),
  };
}

function makeFailingProvider(name: string, error: string): SearchProvider {
  return {
    name,
    search: vi.fn().mockRejectedValue(new Error(error)),
  };
}

describe('SearchProviderRegistry', () => {
  describe('fallback chain', () => {
    it('returns results from the first provider when it succeeds', async () => {
      const first = makeMockProvider('first');
      const second = makeMockProvider('second', MOCK_RESULTS_ALT);

      const registry = new SearchProviderRegistry();
      registry.addProvider(first);
      registry.addProvider(second);

      const results = await registry.search('hello', 5);

      expect(first.search).toHaveBeenCalledWith('hello', 5);
      expect(second.search).not.toHaveBeenCalled();
      expect(results).toEqual(MOCK_RESULTS);
    });

    it('falls through to the second provider when the first fails', async () => {
      const first = makeFailingProvider('first', 'rate limited');
      const second = makeMockProvider('second', MOCK_RESULTS_ALT);

      const registry = new SearchProviderRegistry();
      registry.addProvider(first);
      registry.addProvider(second);

      const results = await registry.search('hello', 5);

      expect(first.search).toHaveBeenCalledWith('hello', 5);
      expect(second.search).toHaveBeenCalledWith('hello', 5);
      expect(results).toEqual(MOCK_RESULTS_ALT);
    });

    it('throws with last error message when all providers fail', async () => {
      const first = makeFailingProvider('first', 'rate limited');
      const second = makeFailingProvider('second', 'API key invalid');

      const registry = new SearchProviderRegistry();
      registry.addProvider(first);
      registry.addProvider(second);

      await expect(registry.search('hello', 5)).rejects.toThrow(
        'All search providers failed. Last error: API key invalid',
      );
    });

    it('throws when no providers are configured', async () => {
      const registry = new SearchProviderRegistry();

      await expect(registry.search('hello', 5)).rejects.toThrow('No search providers configured');
    });
  });

  describe('concurrency semaphore', () => {
    it('limits concurrent calls to 3', async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const slowProvider: SearchProvider = {
        name: 'slow',
        search: vi.fn().mockImplementation(async () => {
          concurrentCount++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCount);
          await new Promise((resolve) => setTimeout(resolve, 50));
          concurrentCount--;
          return MOCK_RESULTS;
        }),
      };

      const registry = new SearchProviderRegistry();
      registry.addProvider(slowProvider);

      // Fire 6 concurrent searches — semaphore should cap at 3
      const promises = Array.from({ length: 6 }, (_, i) => registry.search(`query-${i}`, 1));
      await Promise.all(promises);

      expect(maxConcurrent).toBeLessThanOrEqual(3);
      expect(maxConcurrent).toBeGreaterThan(1); // verify actual concurrency happened
    });
  });
});
