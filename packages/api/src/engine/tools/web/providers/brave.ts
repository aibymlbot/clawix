/**
 * Brave Web Search API provider.
 *
 * Calls the Brave Search API with API key authentication.
 * Implements the SearchProvider interface for use in the fallback chain.
 *
 * Never logs request headers — the API key would be exposed.
 */
import { createLogger } from '@clawix/shared';
import type { SearchProvider, SearchResult } from '../search-provider.js';

const logger = createLogger('engine:tools:web:brave');

/** Timeout for Brave Search requests in milliseconds. */
const REQUEST_TIMEOUT_MS = 10_000;

const BASE_URL = 'https://api.search.brave.com/res/v1/web/search';

/** Shape of the Brave Web Search API response (only fields we use). */
interface BraveWebSearchResponse {
  readonly web?: {
    readonly results?: readonly {
      readonly title: string;
      readonly url: string;
      readonly description: string;
    }[];
  };
}

export class BraveSearchProvider implements SearchProvider {
  readonly name = 'brave';

  private readonly apiKey: string;
  private readonly maxResults: number;

  constructor(apiKey: string, maxResults = 5) {
    this.apiKey = apiKey;
    this.maxResults = maxResults;
  }

  async search(query: string, count: number): Promise<readonly SearchResult[]> {
    const clampedCount = Math.min(count, this.maxResults);
    logger.info({ query, count: clampedCount }, 'Brave search');

    const url = `${BASE_URL}?q=${encodeURIComponent(query)}&count=${clampedCount}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': this.apiKey,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      this.handleHttpError(response.status);
    }

    const data = (await response.json()) as BraveWebSearchResponse;
    const rawResults = data.web?.results ?? [];
    const limited = rawResults.slice(0, clampedCount);

    const results: readonly SearchResult[] = limited.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
    }));

    logger.info({ query, resultCount: results.length }, 'Brave search completed');
    return results;
  }

  /** Throw a descriptive error based on the HTTP status code. */
  private handleHttpError(status: number): never {
    if (status === 401 || status === 403) {
      logger.error({ status }, 'Brave API authentication failed');
      throw new Error('BRAVE_API_KEY may be invalid or expired');
    }

    if (status === 429) {
      logger.warn({ status }, 'Brave API rate limited');
      throw new Error('Brave search rate limited (429)');
    }

    logger.warn({ status }, 'Brave search request failed');
    throw new Error(`Brave search failed: HTTP ${status}`);
  }
}
