/**
 * Search provider interface and ordered fallback registry.
 *
 * Pluggable search backend — providers are tried in chain order.
 * The first provider to succeed wins; failures fall through to the
 * next provider. Includes a concurrency semaphore to prevent
 * rate-limiting from upstream search services.
 */
import { createLogger } from '@clawix/shared';

const logger = createLogger('engine:tools:web:search-provider');

/** Maximum concurrent search requests. */
const MAX_CONCURRENT_SEARCHES = 3;

/** A single search result. */
export interface SearchResult {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
}

/** Interface for pluggable search backends. */
export interface SearchProvider {
  readonly name: string;
  search(query: string, count: number): Promise<readonly SearchResult[]>;
}

/**
 * Ordered fallback registry for search providers.
 *
 * Providers are tried in the order they were added. The first
 * successful response is returned. If all providers fail, an error
 * is thrown with the last failure message.
 *
 * A counting semaphore limits concurrent search attempts to
 * {@link MAX_CONCURRENT_SEARCHES}.
 *
 * Not decorated with @Injectable() — instantiated via useFactory in EngineModule
 * to configure providers from env vars at startup.
 */
export class SearchProviderRegistry {
  private readonly chain: SearchProvider[] = [];

  // ── Concurrency semaphore ──────────────────────────────────────────
  private inFlight = 0;
  private readonly waitQueue: (() => void)[] = [];

  /** Append a search provider to the end of the fallback chain. */
  addProvider(provider: SearchProvider): void {
    this.chain.push(provider);
    logger.info({ provider: provider.name }, 'Search provider added to chain');
  }

  /**
   * Execute a search, trying each provider in chain order.
   *
   * On the first successful response, returns results immediately.
   * If a provider throws, logs a warning and tries the next one.
   * If all providers fail, throws with the last error message.
   * If no providers are configured, throws immediately.
   */
  async search(query: string, count: number): Promise<readonly SearchResult[]> {
    if (this.chain.length === 0) {
      throw new Error('No search providers configured');
    }

    // Acquire semaphore before trying the chain
    await this.acquire();

    try {
      return await this.tryChain(query, count);
    } finally {
      this.release();
    }
  }

  // ── Chain execution ────────────────────────────────────────────────

  private async tryChain(query: string, count: number): Promise<readonly SearchResult[]> {
    let lastError: Error | undefined;

    for (const provider of this.chain) {
      try {
        const results = await provider.search(query, count);
        return results;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        logger.warn(
          { provider: provider.name, error: lastError.message },
          'Search provider failed, trying next',
        );
      }
    }

    throw new Error(`All search providers failed. Last error: ${lastError?.message ?? 'unknown'}`);
  }

  // ── Semaphore internals ────────────────────────────────────────────

  private async acquire(): Promise<void> {
    if (this.inFlight < MAX_CONCURRENT_SEARCHES) {
      this.inFlight++;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(() => {
        this.inFlight++;
        resolve();
      });
    });
  }

  private release(): void {
    this.inFlight--;
    const next = this.waitQueue.shift();
    if (next) {
      next();
    }
  }
}
