import { describe, expect, it } from 'vitest';

import {
  AppError,
  AuthError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  TokenBudgetExceededError,
  ValidationError,
} from '../errors/index.js';

describe('AppError', () => {
  it('should create an error with correct properties', () => {
    const error = new AppError('test error', 500, 'TEST_ERROR');

    expect(error.message).toBe('test error');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('TEST_ERROR');
    expect(error.isOperational).toBe(true);
    expect(error.name).toBe('AppError');
    expect(error).toBeInstanceOf(Error);
  });

  it('should allow non-operational errors', () => {
    const error = new AppError('fatal', 500, 'FATAL', false);

    expect(error.isOperational).toBe(false);
  });
});

describe('ValidationError', () => {
  it('should create a 422 error with details', () => {
    const details = ['field1 is required', 'field2 must be a number'];
    const error = new ValidationError('Invalid input', details);

    expect(error.statusCode).toBe(422);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual(details);
    expect(error).toBeInstanceOf(AppError);
  });

  it('should default to empty details', () => {
    const error = new ValidationError('Invalid');

    expect(error.details).toEqual([]);
  });
});

describe('AuthError', () => {
  it('should create a 401 error', () => {
    const error = new AuthError();

    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('AUTH_ERROR');
    expect(error.message).toBe('Authentication required');
  });

  it('should accept custom message', () => {
    const error = new AuthError('Token expired');

    expect(error.message).toBe('Token expired');
  });
});

describe('ForbiddenError', () => {
  it('should create a 403 error', () => {
    const error = new ForbiddenError();

    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });
});

describe('NotFoundError', () => {
  it('should create a 404 error with resource info', () => {
    const error = new NotFoundError('Agent', 'abc123');

    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Agent with id 'abc123' not found");
  });
});

describe('ConflictError', () => {
  it('should create a 409 error', () => {
    const error = new ConflictError('Slug already exists');

    expect(error.statusCode).toBe(409);
    expect(error.message).toBe('Slug already exists');
  });
});

describe('RateLimitError', () => {
  it('should create a 429 error', () => {
    const error = new RateLimitError();

    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('RATE_LIMIT');
  });
});

describe('TokenBudgetExceededError', () => {
  it('should create a 402 error with tenant id', () => {
    const error = new TokenBudgetExceededError('tenant-1');

    expect(error.statusCode).toBe(402);
    expect(error.message).toContain('tenant-1');
  });
});
