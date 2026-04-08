import { describe, it, expect } from 'vitest';
import { UnprocessableEntityException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../zod-validation.pipe.js';

const testSchema = z.object({
  email: z.string().email(),
  age: z.number().int().positive(),
});

const metadata = { type: 'body' as const, metatype: Object, data: '' };

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(testSchema);

  it('should pass valid input through and return parsed data', () => {
    const input = { email: 'test@example.com', age: 25 };
    expect(pipe.transform(input, metadata)).toEqual(input);
  });

  it('should strip unknown fields', () => {
    const input = { email: 'test@example.com', age: 25, extra: 'ignored' };
    expect(pipe.transform(input, metadata)).toEqual({ email: 'test@example.com', age: 25 });
  });

  it('should throw 422 on invalid input', () => {
    const input = { email: 'not-an-email', age: -1 };
    expect(() => pipe.transform(input, metadata)).toThrow(UnprocessableEntityException);
  });

  it('should include field-level error details', () => {
    const input = { email: 'bad', age: 'not-a-number' };
    try {
      pipe.transform(input, metadata);
      expect.unreachable('Should have thrown');
    } catch (err) {
      const response = (err as UnprocessableEntityException).getResponse() as Record<
        string,
        unknown
      >;
      expect(response['statusCode']).toBe(422);
      expect(response['message']).toBe('Validation failed');
      const errors = response['errors'] as { field: string; message: string }[];
      expect(errors.length).toBeGreaterThanOrEqual(2);
      expect(errors.some((e) => e.field === 'email')).toBe(true);
      expect(errors.some((e) => e.field === 'age')).toBe(true);
    }
  });

  it('should throw on missing required fields', () => {
    expect(() => pipe.transform({}, metadata)).toThrow(UnprocessableEntityException);
  });

  it('should throw on null input', () => {
    expect(() => pipe.transform(null, metadata)).toThrow(UnprocessableEntityException);
  });
});
