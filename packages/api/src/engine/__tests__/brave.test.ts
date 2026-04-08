import { afterEach, describe, expect, it, vi } from 'vitest';

import { BraveSearchProvider } from '../tools/web/providers/brave.js';

/**
 * Brave Web Search API response fixture with 3 results.
 */
const BRAVE_RESPONSE_FIXTURE = {
  web: {
    results: [
      {
        title: 'Example Page One',
        url: 'https://example.com/page1',
        description: 'First result description',
      },
      {
        title: 'Example Page Two',
        url: 'https://example.com/page2',
        description: 'Second result description',
      },
      {
        title: 'Example Page Three',
        url: 'https://example.com/page3',
        description: 'Third result description',
      },
    ],
  },
};

/** Response with no web results field. */
const BRAVE_EMPTY_RESPONSE = {};

/** Response with web field but no results array. */
const BRAVE_NO_RESULTS_RESPONSE = { web: {} };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BraveSearchProvider', () => {
  it('has name "brave"', () => {
    const provider = new BraveSearchProvider('test-api-key');
    expect(provider.name).toBe('brave');
  });

  it('parses successful response into SearchResult[]', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(BRAVE_RESPONSE_FIXTURE),
      }),
    );

    const provider = new BraveSearchProvider('test-api-key');
    const results = await provider.search('test query', 10);

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({
      title: 'Example Page One',
      url: 'https://example.com/page1',
      snippet: 'First result description',
    });
    expect(results[1]).toEqual({
      title: 'Example Page Two',
      url: 'https://example.com/page2',
      snippet: 'Second result description',
    });
    expect(results[2]).toEqual({
      title: 'Example Page Three',
      url: 'https://example.com/page3',
      snippet: 'Third result description',
    });
  });

  it('limits results to requested count', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(BRAVE_RESPONSE_FIXTURE),
      }),
    );

    const provider = new BraveSearchProvider('test-api-key');
    const results = await provider.search('test query', 2);

    expect(results).toHaveLength(2);
    expect(results[0]).toHaveProperty('title', 'Example Page One');
    expect(results[1]).toHaveProperty('title', 'Example Page Two');
  });

  it('returns empty array when no web results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(BRAVE_EMPTY_RESPONSE),
      }),
    );

    const provider = new BraveSearchProvider('test-api-key');
    const results = await provider.search('obscure query', 5);

    expect(results).toEqual([]);
  });

  it('returns empty array when web.results is undefined', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(BRAVE_NO_RESULTS_RESPONSE),
      }),
    );

    const provider = new BraveSearchProvider('test-api-key');
    const results = await provider.search('test', 5);

    expect(results).toEqual([]);
  });

  it('throws on 401 with auth error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      }),
    );

    const provider = new BraveSearchProvider('test-api-key');
    await expect(provider.search('test', 5)).rejects.toThrow(
      'BRAVE_API_KEY may be invalid or expired',
    );
  });

  it('throws on 403 with auth error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({}),
      }),
    );

    const provider = new BraveSearchProvider('test-api-key');
    await expect(provider.search('test', 5)).rejects.toThrow(
      'BRAVE_API_KEY may be invalid or expired',
    );
  });

  it('throws on 429 rate limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({}),
      }),
    );

    const provider = new BraveSearchProvider('test-api-key');
    await expect(provider.search('test', 5)).rejects.toThrow('Brave search rate limited (429)');
  });

  it('throws on 5xx server error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.resolve({}),
      }),
    );

    const provider = new BraveSearchProvider('test-api-key');
    await expect(provider.search('test', 5)).rejects.toThrow('Brave search failed: HTTP 502');
  });

  it('sends correct URL, headers, and signal', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(BRAVE_EMPTY_RESPONSE),
    });
    vi.stubGlobal('fetch', mockFetch);

    const provider = new BraveSearchProvider('my-secret-key', 3);
    await provider.search('hello world', 5);

    expect(mockFetch).toHaveBeenCalledOnce();
    const call = mockFetch.mock.calls[0] as [string, RequestInit];

    // count should be clamped to maxResults (3)
    expect(call[0]).toBe('https://api.search.brave.com/res/v1/web/search?q=hello%20world&count=3');
    const headers = call[1].headers as Record<string, string>;
    expect(headers['Accept']).toBe('application/json');
    expect(headers['X-Subscription-Token']).toBe('my-secret-key');
    expect(call[1].signal).toBeInstanceOf(AbortSignal);
  });

  it('uses maxResults from constructor to clamp count', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(BRAVE_RESPONSE_FIXTURE),
    });
    vi.stubGlobal('fetch', mockFetch);

    const provider = new BraveSearchProvider('test-key', 2);
    const results = await provider.search('test', 10);

    // Results clamped to maxResults=2
    expect(results).toHaveLength(2);

    // URL count param should be clamped
    const call = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toContain('count=2');
  });

  it('throws on malformed JSON response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      }),
    );

    const provider = new BraveSearchProvider('test-api-key');
    await expect(provider.search('test', 5)).rejects.toThrow();
  });

  it('throws on timeout (AbortSignal)', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    const provider = new BraveSearchProvider('test-api-key');
    await expect(provider.search('test', 5)).rejects.toThrow();
  });
});
