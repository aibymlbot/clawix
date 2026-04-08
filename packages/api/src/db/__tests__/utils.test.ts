import { describe, it, expect } from 'vitest';
import { ConflictError, NotFoundError } from '@clawix/shared';

import { buildPaginationArgs, buildPaginatedResponse, handlePrismaError } from '../utils.js';

describe('buildPaginationArgs', () => {
  it('should compute skip and take for page 1', () => {
    const result = buildPaginationArgs({ page: 1, limit: 20 });

    expect(result).toEqual({ skip: 0, take: 20 });
  });

  it('should compute skip for page 3 with limit 10', () => {
    const result = buildPaginationArgs({ page: 3, limit: 10 });

    expect(result).toEqual({ skip: 20, take: 10 });
  });

  it('should handle limit of 1', () => {
    const result = buildPaginationArgs({ page: 5, limit: 1 });

    expect(result).toEqual({ skip: 4, take: 1 });
  });
});

describe('buildPaginatedResponse', () => {
  it('should build response with correct meta', () => {
    const data = [{ id: '1' }, { id: '2' }];
    const result = buildPaginatedResponse(data, 50, { page: 1, limit: 20 });

    expect(result).toEqual({
      data,
      meta: {
        total: 50,
        page: 1,
        limit: 20,
        totalPages: 3,
      },
    });
  });

  it('should calculate totalPages correctly when total is exact multiple of limit', () => {
    const result = buildPaginatedResponse([], 40, { page: 1, limit: 20 });

    expect(result.meta.totalPages).toBe(2);
  });

  it('should return totalPages 0 when total is 0', () => {
    const result = buildPaginatedResponse([], 0, { page: 1, limit: 20 });

    expect(result.meta.totalPages).toBe(0);
  });

  it('should return totalPages 1 when total equals limit', () => {
    const result = buildPaginatedResponse([{ id: '1' }], 1, { page: 1, limit: 1 });

    expect(result.meta.totalPages).toBe(1);
  });

  it('should preserve the original data array reference', () => {
    const data = [{ id: '1' }];
    const result = buildPaginatedResponse(data, 1, { page: 1, limit: 10 });

    expect(result.data).toBe(data);
  });
});

describe('handlePrismaError', () => {
  it('should throw ConflictError for P2002 unique constraint violation', () => {
    const prismaError = { code: 'P2002', meta: { target: ['email'] } };

    expect(() => handlePrismaError(prismaError, 'User')).toThrow(ConflictError);
    expect(() => handlePrismaError(prismaError, 'User')).toThrow(
      'User with duplicate email already exists',
    );
  });

  it('should join multiple target fields in ConflictError message', () => {
    const prismaError = { code: 'P2002', meta: { target: ['provider', 'model'] } };

    expect(() => handlePrismaError(prismaError, 'Config')).toThrow(
      'Config with duplicate provider, model already exists',
    );
  });

  it('should use "unknown field" when target is not an array', () => {
    const prismaError = { code: 'P2002', meta: {} };

    expect(() => handlePrismaError(prismaError, 'User')).toThrow(
      'User with duplicate unknown field already exists',
    );
  });

  it('should use "unknown field" when meta is undefined', () => {
    const prismaError = { code: 'P2002' };

    expect(() => handlePrismaError(prismaError, 'Policy')).toThrow(
      'Policy with duplicate unknown field already exists',
    );
  });

  it('should throw NotFoundError for P2025 record not found', () => {
    const prismaError = { code: 'P2025' };

    expect(() => handlePrismaError(prismaError, 'Agent')).toThrow(NotFoundError);
  });

  it('should re-throw non-Prisma errors as-is', () => {
    const genericError = new Error('database connection lost');

    expect(() => handlePrismaError(genericError, 'User')).toThrow('database connection lost');
  });

  it('should re-throw unrecognized Prisma error codes', () => {
    const prismaError = { code: 'P2003' };

    try {
      handlePrismaError(prismaError, 'User');
      expect.fail('should have thrown');
    } catch (thrown) {
      expect(thrown).toBe(prismaError);
    }
  });

  it('should re-throw null errors', () => {
    expect(() => handlePrismaError(null, 'User')).toThrow();
  });

  it('should re-throw string errors', () => {
    expect(() => handlePrismaError('some error', 'User')).toThrow('some error');
  });

  it('should not treat objects without code starting with P as Prisma errors', () => {
    const notPrisma = { code: 'ECONNREFUSED' };

    try {
      handlePrismaError(notPrisma, 'User');
      expect.fail('should have thrown');
    } catch (thrown) {
      expect(thrown).toBe(notPrisma);
    }
  });
});
