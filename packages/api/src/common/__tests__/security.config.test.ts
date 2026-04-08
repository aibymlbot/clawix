import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('buildCorsOptions', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function importModule() {
    return import('../security.config.js');
  }

  it('should use default origin when env var is not set', async () => {
    delete process.env['CORS_ALLOWED_ORIGINS'];
    const { buildCorsOptions } = await importModule();
    const opts = buildCorsOptions();
    expect(opts.origin).toEqual(['http://localhost:3000']);
  });

  it('should parse comma-separated origins', async () => {
    process.env['CORS_ALLOWED_ORIGINS'] = 'https://app.example.com, https://admin.example.com';
    const { buildCorsOptions } = await importModule();
    const opts = buildCorsOptions();
    expect(opts.origin).toEqual(['https://app.example.com', 'https://admin.example.com']);
  });

  it('should filter empty segments', async () => {
    process.env['CORS_ALLOWED_ORIGINS'] = 'https://app.example.com,,, ';
    const { buildCorsOptions } = await importModule();
    const opts = buildCorsOptions();
    expect(opts.origin).toEqual(['https://app.example.com']);
  });

  it('should throw on wildcard with credentials', async () => {
    process.env['CORS_ALLOWED_ORIGINS'] = '*';
    const { buildCorsOptions } = await importModule();
    expect(() => buildCorsOptions()).toThrow("must not contain '*'");
  });

  it('should include required CORS fields', async () => {
    const { buildCorsOptions } = await importModule();
    const opts = buildCorsOptions();
    expect(opts.credentials).toBe(true);
    expect(opts.maxAge).toBe(86_400);
    expect(opts.methods).toContain('POST');
    expect(opts.allowedHeaders).toContain('Authorization');
    expect(opts.exposedHeaders).toContain('X-RateLimit-Remaining');
  });
});

describe('buildHelmetOptions', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function importModule() {
    return import('../security.config.js');
  }

  it('should use relaxed CSP in development', async () => {
    process.env['NODE_ENV'] = 'development';
    const { buildHelmetOptions } = await importModule();
    const opts = buildHelmetOptions();
    const directives = (opts.contentSecurityPolicy as Record<string, unknown>)[
      'directives'
    ] as Record<string, string[]>;
    expect(directives['scriptSrc']).toContain("'unsafe-inline'");
    expect(directives['styleSrc']).toContain("'unsafe-inline'");
    expect(directives['connectSrc']).toContain("'self'");
  });

  it('should use strict CSP in production', async () => {
    process.env['NODE_ENV'] = 'production';
    const { buildHelmetOptions } = await importModule();
    const opts = buildHelmetOptions();
    const directives = (opts.contentSecurityPolicy as Record<string, unknown>)[
      'directives'
    ] as Record<string, string[]>;
    expect(directives['defaultSrc']).toEqual(["'none'"]);
    expect(directives['scriptSrc']).toBeUndefined();
  });

  it('should enable COEP in production', async () => {
    process.env['NODE_ENV'] = 'production';
    const { buildHelmetOptions } = await importModule();
    const opts = buildHelmetOptions();
    expect(opts.crossOriginEmbedderPolicy).toBe(true);
  });

  it('should disable COEP in development', async () => {
    process.env['NODE_ENV'] = 'development';
    const { buildHelmetOptions } = await importModule();
    const opts = buildHelmetOptions();
    expect(opts.crossOriginEmbedderPolicy).toBe(false);
  });

  it('should always include HSTS', async () => {
    const { buildHelmetOptions } = await importModule();
    const opts = buildHelmetOptions();
    expect(opts.hsts).toEqual({
      maxAge: 31_536_000,
      includeSubDomains: true,
      preload: true,
    });
  });
});
