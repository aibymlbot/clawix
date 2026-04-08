import { afterEach, describe, expect, it, vi } from 'vitest';

import { DuckDuckGoProvider } from '../tools/web/providers/duckduckgo.js';

/**
 * Sample DDG HTML fixture with 2 results:
 * - Result 1: direct URL, HTML tags in title
 * - Result 2: uddg redirect URL, HTML tags in snippet
 */
const DDG_HTML_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
  <div class="results">
    <div class="result">
      <a class="result__a" href="https://example.com/page1">Example <b>Page</b> One</a>
      <a class="result__snippet" href="#">This is the <b>first</b> snippet</a>
    </div>
    <div class="result">
      <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Ftest.org%2Fpage2&amp;rut=abc">Test Page Two</a>
      <a class="result__snippet" href="#">The <em>second</em> snippet here</a>
    </div>
  </div>
</body>
</html>
`;

/** Small body with no results (genuine no-results). */
const DDG_NO_RESULTS_SMALL = '<html><body>No results</body></html>';

/** Large body (>1KB) with no result markup — indicates markup change. */
const DDG_NO_RESULTS_LARGE = '<html><body>' + 'x'.repeat(1100) + '</body></html>';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DuckDuckGoProvider', () => {
  it('has name "duckduckgo"', () => {
    const provider = new DuckDuckGoProvider();
    expect(provider.name).toBe('duckduckgo');
  });

  it('extracts titles, URLs, and snippets from HTML', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(DDG_HTML_FIXTURE),
      }),
    );

    const provider = new DuckDuckGoProvider();
    const results = await provider.search('test query', 10);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      title: 'Example Page One',
      url: 'https://example.com/page1',
      snippet: 'This is the first snippet',
    });
    expect(results[1]).toEqual({
      title: 'Test Page Two',
      url: 'https://test.org/page2',
      snippet: 'The second snippet here',
    });
  });

  it('decodes DDG redirect URLs (uddg= parameter)', async () => {
    const html = `
      <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fdecoded.example.com%2Fpath%3Fq%3D1&amp;rut=x">Title</a>
      <a class="result__snippet" href="#">Snippet</a>
    `;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(html),
      }),
    );

    const provider = new DuckDuckGoProvider();
    const results = await provider.search('test', 5);

    expect(results[0]).toHaveProperty('url', 'https://decoded.example.com/path?q=1');
  });

  it('strips HTML tags from titles and snippets', async () => {
    const html = `
      <a class="result__a" href="https://example.com"><strong>Bold</strong> and <em>italic</em></a>
      <a class="result__snippet" href="#">Some <b>bold</b> <i>italic</i> text</a>
    `;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(html),
      }),
    );

    const provider = new DuckDuckGoProvider();
    const results = await provider.search('test', 5);

    expect(results[0]).toHaveProperty('title', 'Bold and italic');
    expect(results[0]).toHaveProperty('snippet', 'Some bold italic text');
  });

  it('limits results to requested count', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(DDG_HTML_FIXTURE),
      }),
    );

    const provider = new DuckDuckGoProvider();
    const results = await provider.search('test', 1);

    expect(results).toHaveLength(1);
    expect(results[0]).toHaveProperty('title', 'Example Page One');
  });

  it('returns empty array for genuine no-results (small body)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(DDG_NO_RESULTS_SMALL),
      }),
    );

    const provider = new DuckDuckGoProvider();
    const results = await provider.search('obscure query', 5);

    expect(results).toEqual([]);
  });

  it('throws on 200 + zero results + large body (>1KB) — markup change', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(DDG_NO_RESULTS_LARGE),
      }),
    );

    const provider = new DuckDuckGoProvider();
    await expect(provider.search('test', 5)).rejects.toThrow(
      'DuckDuckGo HTML structure may have changed',
    );
  });

  it('throws on non-200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve('Service Unavailable'),
      }),
    );

    const provider = new DuckDuckGoProvider();
    await expect(provider.search('test', 5)).rejects.toThrow('DuckDuckGo search failed: HTTP 503');
  });

  it('sends correct URL, headers, and signal', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(DDG_NO_RESULTS_SMALL),
    });
    vi.stubGlobal('fetch', mockFetch);

    const provider = new DuckDuckGoProvider();
    await provider.search('hello world', 5);

    expect(mockFetch).toHaveBeenCalledOnce();
    const call = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe('https://html.duckduckgo.com/html/?q=hello%20world');
    expect((call[1].headers as Record<string, string>)['User-Agent']).toBe('Clawix/1.0');
    expect(call[1].signal).toBeInstanceOf(AbortSignal);
  });

  it('throws on timeout (AbortSignal)', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    const provider = new DuckDuckGoProvider();
    await expect(provider.search('test', 5)).rejects.toThrow();
  });
});
