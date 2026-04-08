/**
 * Content extraction pipeline — converts fetched web content to readable markdown.
 *
 * HTML:  jsdom → @mozilla/readability → turndown → markdown
 * JSON:  JSON.stringify(data, null, 2)
 * Other: pass through as plain text
 */
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';

const DEFAULT_MAX_CHARS = 50_000;

/** Result of content extraction. */
export interface ExtractedContent {
  readonly title: string | null;
  readonly content: string;
}

/**
 * Extract readable content from a fetched response body.
 *
 * @param body        - Raw response body as string.
 * @param contentType - MIME type (e.g. 'text/html', 'application/json').
 * @param maxChars    - Maximum characters to return (default 50,000).
 */
export function extractContent(
  body: string,
  contentType: string,
  maxChars: number = DEFAULT_MAX_CHARS,
): ExtractedContent {
  const type = (contentType.split(';')[0] ?? contentType).trim().toLowerCase();

  if (type === 'text/html' || type === 'application/xhtml+xml') {
    return extractHtml(body, maxChars);
  }

  if (type === 'application/json' || type.endsWith('+json')) {
    return extractJson(body, maxChars);
  }

  // Plain text and everything else: pass through
  return {
    title: null,
    content: truncate(body, maxChars),
  };
}

// ------------------------------------------------------------------ //
//  HTML extraction                                                     //
// ------------------------------------------------------------------ //

function extractHtml(html: string, maxChars: number): ExtractedContent {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const title = doc.title || null;

  // Try readability first (article-quality extraction)
  const reader = new Readability(doc);
  const article = reader.parse();

  if (article?.content) {
    const turndown = new TurndownService({ headingStyle: 'atx' });
    const markdown = turndown.turndown(article.content);
    return {
      title: article.title ?? title,
      content: truncate(markdown, maxChars),
    };
  }

  // Fallback: strip HTML tags
  const stripped = stripHtmlTags(html);
  return {
    title,
    content: truncate(stripped, maxChars),
  };
}

/** Remove HTML tags and collapse whitespace. */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ------------------------------------------------------------------ //
//  JSON extraction                                                     //
// ------------------------------------------------------------------ //

function extractJson(body: string, maxChars: number): ExtractedContent {
  try {
    const parsed: unknown = JSON.parse(body);
    const pretty = JSON.stringify(parsed, null, 2);
    return { title: null, content: truncate(pretty, maxChars) };
  } catch {
    // Invalid JSON — return as-is
    return { title: null, content: truncate(body, maxChars) };
  }
}

// ------------------------------------------------------------------ //
//  Utilities                                                           //
// ------------------------------------------------------------------ //

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}
