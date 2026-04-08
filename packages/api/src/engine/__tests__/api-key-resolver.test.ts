import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveApiKey } from '../providers/api-key-resolver.js';

describe('resolveApiKey', () => {
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('resolves anthropic key from ANTHROPIC_API_KEY', () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test';
    expect(resolveApiKey('anthropic')).toBe('sk-ant-test');
  });

  it('resolves openai key from OPENAI_API_KEY', () => {
    process.env['OPENAI_API_KEY'] = 'sk-openai-test';
    expect(resolveApiKey('openai')).toBe('sk-openai-test');
  });

  it('resolves custom provider key from uppercased env var', () => {
    process.env['MISTRAL_API_KEY'] = 'sk-mistral-test';
    expect(resolveApiKey('mistral')).toBe('sk-mistral-test');
  });

  it('throws when env var is not set', () => {
    delete process.env['ANTHROPIC_API_KEY'];
    expect(() => resolveApiKey('anthropic')).toThrow('Missing API key');
    expect(() => resolveApiKey('anthropic')).toThrow('ANTHROPIC_API_KEY');
  });

  it('throws with provider name and env var in error message', () => {
    delete process.env['OPENAI_API_KEY'];
    expect(() => resolveApiKey('openai')).toThrow('provider "openai"');
    expect(() => resolveApiKey('openai')).toThrow('OPENAI_API_KEY');
  });
});
