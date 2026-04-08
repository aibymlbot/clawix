import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AppError, ValidationError, createLogger } from '@clawix/shared';

const logger = createLogger('exception-filter');

interface FieldError {
  readonly field: string;
  readonly message: string;
}

interface ErrorResponse {
  readonly statusCode: number;
  readonly code: string;
  readonly message: string;
  readonly details?: readonly string[];
  readonly errors?: readonly FieldError[];
}

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const response = this.buildResponse(exception);

    logger.error(
      {
        err: exception,
        method: request.method,
        url: request.url,
        statusCode: response.statusCode,
        code: response.code,
      },
      response.message,
    );

    await reply.status(response.statusCode).send(response);
  }

  private buildResponse(exception: unknown): ErrorResponse {
    if (exception instanceof AppError) {
      if (!exception.isOperational) {
        return {
          statusCode: 500,
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        };
      }

      const response: ErrorResponse = {
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
      };

      if (exception instanceof ValidationError && exception.details.length > 0) {
        return { ...response, details: exception.details };
      }

      return response;
    }

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      const errors = this.extractFieldErrors(exceptionResponse);

      return {
        statusCode: exception.getStatus(),
        code: 'HTTP_EXCEPTION',
        message: exception.message,
        ...(errors.length > 0 ? { errors } : {}),
      };
    }

    return {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    };
  }

  private extractFieldErrors(response: unknown): readonly FieldError[] {
    if (typeof response !== 'object' || response === null) return [];
    const raw = (response as Record<string, unknown>)['errors'];
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (item): item is FieldError =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>)['field'] === 'string' &&
        typeof (item as Record<string, unknown>)['message'] === 'string',
    );
  }
}
