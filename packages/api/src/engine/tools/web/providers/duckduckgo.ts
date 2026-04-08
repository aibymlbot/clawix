/**
 * DuckDuckGo search provider — scrapes html.duckduckgo.com directly.
 *
 * No API key required. Uses the HTML-only endpoint with regex extraction.
 * Ported from PicoClaw's Go implementation (pkg/tools/web.go).
 */
import { createLogger } from '@clawix/shared';
import type { SearchProvider, SearchResult } from '../search-provider.js';

const logger = createLogger('engine:tools:web:duckduckgo');

/** Timeout for DuckDuckGo requests in milliseconds. */
const REQUEST_TIMEOUT_MS = 10_000;

/** Minimum body size (bytes) to consider a zero-result response a markup change. */
const MARKUP_CHANGE_THRESHOLD = 1024;

const USER_AGENT = 'Clawix/1.0';
const BASE_URL = 'https://html.duckduckgo.com/html/';

/** Matches result links: captures href (group 1) and inner HTML (group 2). */
const RE_LINK = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

/** Matches result snippets: captures inner HTML (group 1). */
const RE_SNIPPET = /<a class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;

/** Matches any HTML tag for stripping. */
const RE_TAG = /<[^>]+>/g;

/** Strip HTML tags from a string and trim whitespace. */
function stripTags(html: string): string {
  return html.replace(RE_TAG, '').trim();
}

/** Decode a DDG redirect URL, extracting the real URL from the uddg= parameter. */
function decodeRedirectUrl(href: string): string {
  if (!href.includes('uddg=')) {
    return href;
  }

  // DDG uses &amp; in HTML attributes — decode HTML entities first
  const decoded = href.replace(/&amp;/g, '&');

  try {
    const url = new URL(decoded);
    const uddg = url.searchParams.get('uddg');
    return uddg ?? href;
  } catch {
    // Fallback: try manual extraction
    const match = /uddg=([^&]+)/.exec(decoded);
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return href;
      }
    }
    return href;
  }
}

export class DuckDuckGoProvider implements SearchProvider {
  readonly name = 'duckduckgo';

  async search(query: string, count: number): Promise<readonly SearchResult[]> {
    logger.info({ query, count }, 'DuckDuckGo search');

    const url = `${BASE_URL}?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo search failed: HTTP ${response.status}`);
    }

    const body = await response.text();
    const results = this.extractResults(body, count);

    logger.info({ query, resultCount: results.length }, 'DuckDuckGo search completed');
    return results;
  }

  private extractResults(body: string, count: number): readonly SearchResult[] {
    // Extract all link matches
    const linkMatches: RegExpExecArray[] = [];
    let match: RegExpExecArray | null;

    // Reset regex lastIndex before use
    RE_LINK.lastIndex = 0;
    while ((match = RE_LINK.exec(body)) !== null) {
      linkMatches.push(match);
    }

    // Extract all snippet matches
    const snippetMatches: RegExpExecArray[] = [];
    RE_SNIPPET.lastIndex = 0;
    while ((match = RE_SNIPPET.exec(body)) !== null) {
      snippetMatches.push(match);
    }

    if (linkMatches.length === 0) {
      // Zero results: check if it's a markup change or genuine no-results
      if (body.length > MARKUP_CHANGE_THRESHOLD) {
        throw new Error('DuckDuckGo HTML structure may have changed');
      }
      return [];
    }

    const maxItems = Math.min(linkMatches.length, count);
    const results: SearchResult[] = [];

    for (let i = 0; i < maxItems; i++) {
      const linkMatch = linkMatches[i];
      const hrefRaw = linkMatch?.[1] ?? '';
      const titleRaw = linkMatch?.[2] ?? '';
      const href = decodeRedirectUrl(hrefRaw);
      const title = stripTags(titleRaw);
      const snippetRaw = snippetMatches[i]?.[1] ?? '';
      const snippet = stripTags(snippetRaw);

      results.push({ title, url: href, snippet });
    }

    return results;
  }
}
