import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { Body, Controller, Post } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { APP_FILTER } from '@nestjs/core';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { Public } from '../auth/public.decorator.js';
import { AppExceptionFilter } from '../filters/app-exception.filter.js';

const testSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.number().int().min(0, 'Age must be non-negative'),
  email: z.string().email('Invalid email'),
});

type TestInput = z.infer<typeof testSchema>;

@Controller('test-validation')
class TestValidationController {
  @Public()
  @Post()
  create(@Body(new ZodValidationPipe(testSchema)) body: TestInput) {
    return { received: body };
  }
}

describe('Validation Pipe Integration', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TestValidationController],
      providers: [{ provide: APP_FILTER, useClass: AppExceptionFilter }],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('valid body passes through → 201 with parsed data', async () => {
    const result = await app.inject({
      method: 'POST',
      url: '/test-validation',
      payload: { name: 'Alice', age: 30, email: 'alice@example.com', extra: 'stripped' },
    });

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.payload);
    // Zod strips unknown fields
    expect(body.received).toEqual({ name: 'Alice', age: 30, email: 'alice@example.com' });
    expect(body.received).not.toHaveProperty('extra');
  });

  it('missing required field → 422 with field-level error', async () => {
    const result = await app.inject({
      method: 'POST',
      url: '/test-validation',
      payload: { age: 25, email: 'bob@example.com' },
    });

    expect(result.statusCode).toBe(422);
    const body = JSON.parse(result.payload);
    expect(body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name' })]),
    );
  });

  it('invalid field type → 422', async () => {
    const result = await app.inject({
      method: 'POST',
      url: '/test-validation',
      payload: { name: 'Charlie', age: 'not-a-number', email: 'c@example.com' },
    });

    expect(result.statusCode).toBe(422);
    const body = JSON.parse(result.payload);
    expect(body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'age' })]),
    );
  });

  it('empty body → 422 with multiple field errors', async () => {
    const result = await app.inject({
      method: 'POST',
      url: '/test-validation',
      payload: {},
    });

    expect(result.statusCode).toBe(422);
    const body = JSON.parse(result.payload);
    expect(body.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('invalid email format → 422', async () => {
    const result = await app.inject({
      method: 'POST',
      url: '/test-validation',
      payload: { name: 'Dave', age: 20, email: 'not-an-email' },
    });

    expect(result.statusCode).toBe(422);
    const body = JSON.parse(result.payload);
    expect(body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'email', message: 'Invalid email' }),
      ]),
    );
  });
});
