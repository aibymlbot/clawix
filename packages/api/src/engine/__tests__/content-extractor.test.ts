import { describe, expect, it } from 'vitest';

import { extractContent } from '../tools/web/content-extractor.js';

describe('extractContent', () => {
  describe('HTML extraction', () => {
    it('extracts article content as markdown', () => {
      const html = `
        <html><head><title>Test Article</title></head>
        <body>
          <article>
            <h1>Hello World</h1>
            <p>This is a <strong>test</strong> article with <a href="https://example.com">a link</a>.</p>
          </article>
        </body></html>
      `;
      const result = extractContent(html, 'text/html');
      expect(result.title).toBe('Test Article');
      expect(result.content).toContain('Hello World');
      expect(result.content).toContain('**test**');
      expect(result.content).toContain('[a link](https://example.com');
    });

    it('strips script and style tags', () => {
      const html = `
        <html><head><title>Page</title></head>
        <body>
          <article>
            <p>Visible content</p>
            <script>alert('xss')</script>
            <style>.hidden { display: none; }</style>
          </article>
        </body></html>
      `;
      const result = extractContent(html, 'text/html');
      expect(result.content).toContain('Visible content');
      expect(result.content).not.toContain('alert');
      expect(result.content).not.toContain('display: none');
    });

    it('falls back to tag stripping when readability fails', () => {
      const html = '<html><body><div>Just a div</div></body></html>';
      const result = extractContent(html, 'text/html');
      expect(result.content).toContain('Just a div');
      expect(result.content).not.toContain('<div>');
    });

    it('truncates content to maxChars', () => {
      const html = `
        <html><head><title>Long</title></head>
        <body><article><p>${'x'.repeat(1000)}</p></article></body></html>
      `;
      const result = extractContent(html, 'text/html', 100);
      expect(result.content.length).toBeLessThanOrEqual(100);
    });
  });

  describe('JSON extraction', () => {
    it('pretty-prints JSON content', () => {
      const json = '{"key":"value","nested":{"a":1}}';
      const result = extractContent(json, 'application/json');
      expect(result.content).toBe(JSON.stringify(JSON.parse(json), null, 2));
      expect(result.title).toBeNull();
    });

    it('handles invalid JSON gracefully', () => {
      const result = extractContent('not json {', 'application/json');
      expect(result.content).toBe('not json {');
    });
  });

  describe('plain text extraction', () => {
    it('passes through plain text', () => {
      const text = 'Hello, this is plain text.';
      const result = extractContent(text, 'text/plain');
      expect(result.content).toBe(text);
      expect(result.title).toBeNull();
    });

    it('truncates plain text to maxChars', () => {
      const text = 'x'.repeat(200);
      const result = extractContent(text, 'text/plain', 50);
      expect(result.content.length).toBe(50);
    });
  });

  describe('unknown content types', () => {
    it('passes through as plain text', () => {
      const data = 'binary-ish content';
      const result = extractContent(data, 'application/xml');
      expect(result.content).toBe(data);
    });
  });
});
