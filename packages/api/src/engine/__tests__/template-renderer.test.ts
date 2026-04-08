import { describe, it, expect } from 'vitest';

import { renderTemplate } from '../template-renderer.js';

describe('renderTemplate', () => {
  it('should replace a single variable', () => {
    const result = renderTemplate('Hello {{ name }}!', { name: 'Alice' });
    expect(result).toBe('Hello Alice!');
  });

  it('should replace dot-notation variables as flat key lookup', () => {
    const result = renderTemplate('Hi {{ user.name }}', { 'user.name': 'Bob' });
    expect(result).toBe('Hi Bob');
  });

  it('should replace missing variables with empty string', () => {
    const result = renderTemplate('Hello {{ missing }}!', {});
    expect(result).toBe('Hello !');
  });

  it('should handle multiple variables', () => {
    const result = renderTemplate('{{ greeting }} {{ user.name }}', {
      greeting: 'Hi',
      'user.name': 'Carol',
    });
    expect(result).toBe('Hi Carol');
  });

  it('should handle templates with no variables', () => {
    const result = renderTemplate('No vars here', { name: 'unused' });
    expect(result).toBe('No vars here');
  });

  it('should handle whitespace variations in delimiters', () => {
    const result = renderTemplate('{{name}} and {{  name  }}', { name: 'X' });
    expect(result).toBe('X and X');
  });
});
