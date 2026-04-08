import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ArgumentsHost } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  AppError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
} from '@clawix/shared';
import { AppExceptionFilter } from '../app-exception.filter.js';

function createMockHost(request?: Partial<FastifyRequest>) {
  const mockReply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as FastifyReply;

  const mockRequest = {
    method: 'GET',
    url: '/test',
    id: 'req-123',
    ...request,
  } as unknown as FastifyRequest;

  const mockHttpCtx = {
    getResponse: vi.fn().mockReturnValue(mockReply),
    getRequest: vi.fn().mockReturnValue(mockRequest),
  };

  const mockHost = {
    switchToHttp: vi.fn().mockReturnValue(mockHttpCtx),
  } as unknown as ArgumentsHost;

  return { mockHost, mockReply, mockRequest };
}

describe('AppExceptionFilter', () => {
  let filter: AppExceptionFilter;

  beforeEach(() => {
    filter = new AppExceptionFilter();
  });

  it('should handle AppError (ValidationError) with correct status and body', async () => {
    const error = new ValidationError('Invalid input', ['field is required']);
    const { mockHost, mockReply } = createMockHost();

    await filter.catch(error, mockHost);

    expect(mockReply.status).toHaveBeenCalledWith(422);
    expect(mockReply.send).toHaveBeenCalledWith({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'Invalid input',
      details: ['field is required'],
    });
  });

  it('should handle AuthError with 401', async () => {
    const error = new AuthError();
    const { mockHost, mockReply } = createMockHost();

    await filter.catch(error, mockHost);

    expect(mockReply.status).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalledWith({
      statusCode: 401,
      code: 'AUTH_ERROR',
      message: 'Authentication required',
    });
  });

  it('should handle ForbiddenError with 403', async () => {
    const error = new ForbiddenError();
    const { mockHost, mockReply } = createMockHost();

    await filter.catch(error, mockHost);

    expect(mockReply.status).toHaveBeenCalledWith(403);
    expect(mockReply.send).toHaveBeenCalledWith({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'Insufficient permissions',
    });
  });

  it('should handle NotFoundError with 404', async () => {
    const error = new NotFoundError('User', '123');
    const { mockHost, mockReply } = createMockHost();

    await filter.catch(error, mockHost);

    expect(mockReply.status).toHaveBeenCalledWith(404);
    expect(mockReply.send).toHaveBeenCalledWith({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: "User with id '123' not found",
    });
  });

  it('should handle RateLimitError with 429', async () => {
    const error = new RateLimitError();
    const { mockHost, mockReply } = createMockHost();

    await filter.catch(error, mockHost);

    expect(mockReply.status).toHaveBeenCalledWith(429);
    expect(mockReply.send).toHaveBeenCalledWith({
      statusCode: 429,
      code: 'RATE_LIMIT',
      message: 'Rate limit exceeded',
    });
  });

  it('should handle NestJS HttpException', async () => {
    const error = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
    const { mockHost, mockReply } = createMockHost();

    await filter.catch(error, mockHost);

    expect(mockReply.status).toHaveBeenCalledWith(400);
    expect(mockReply.send).toHaveBeenCalledWith({
      statusCode: 400,
      code: 'HTTP_EXCEPTION',
      message: 'Bad Request',
    });
  });

  it('should handle unknown errors as 500 Internal Server Error', async () => {
    const error = new Error('something broke');
    const { mockHost, mockReply } = createMockHost();

    await filter.catch(error, mockHost);

    expect(mockReply.status).toHaveBeenCalledWith(500);
    expect(mockReply.send).toHaveBeenCalledWith({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });

  it('should not leak error details for non-operational errors', async () => {
    const error = new AppError('db connection failed', 500, 'DB_ERROR', false);
    const { mockHost, mockReply } = createMockHost();

    await filter.catch(error, mockHost);

    expect(mockReply.status).toHaveBeenCalledWith(500);
    expect(mockReply.send).toHaveBeenCalledWith({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });
});
