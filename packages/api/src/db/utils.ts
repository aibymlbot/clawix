import { ConflictError, NotFoundError } from '@clawix/shared';

import type { PaginatedResponse, PaginationInput } from '@clawix/shared';

export function buildPaginationArgs(input: PaginationInput): {
  readonly skip: number;
  readonly take: number;
} {
  return {
    skip: (input.page - 1) * input.limit,
    take: input.limit,
  };
}

export function buildPaginatedResponse<T>(
  data: readonly T[],
  total: number,
  input: PaginationInput,
): PaginatedResponse<T> {
  return {
    data,
    meta: {
      total,
      page: input.page,
      limit: input.limit,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}

export function handlePrismaError(error: unknown, resource: string): never {
  if (isPrismaError(error)) {
    switch (error.code) {
      case 'P2002': {
        const target = Array.isArray(error.meta?.target)
          ? (error.meta.target as string[]).join(', ')
          : 'unknown field';
        throw new ConflictError(`${resource} with duplicate ${target} already exists`);
      }
      case 'P2025':
        throw new NotFoundError(resource, 'unknown');
    }
  }
  throw error;
}

interface PrismaError {
  readonly code: string;
  readonly meta?: { readonly target?: unknown };
}

function isPrismaError(error: unknown): error is PrismaError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as PrismaError).code === 'string' &&
    (error as PrismaError).code.startsWith('P')
  );
}
