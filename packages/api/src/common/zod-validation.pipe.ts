import {
  type ArgumentMetadata,
  Injectable,
  type PipeTransform,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ZodSchema, ZodError } from 'zod';

/**
 * NestJS pipe that validates input against a Zod schema.
 * Returns 422 Unprocessable Entity with structured error details on failure.
 *
 * Usage:
 *   @Post()
 *   create(@Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput) { ... }
 *
 *   @Get()
 *   list(@Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput) { ... }
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: 'Validation failed',
        errors: this.formatErrors(result.error),
      });
    }

    return result.data;
  }

  private formatErrors(error: ZodError): readonly { field: string; message: string }[] {
    return error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
  }
}
