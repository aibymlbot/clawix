import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { Controller, Get } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service.js';
import { JwtStrategy } from '../auth/jwt.strategy.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Public } from '../auth/public.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../cache/redis.service.js';
import { AppExceptionFilter } from '../filters/app-exception.filter.js';
import type { JwtPayload } from '../auth/auth.types.js';

const TEST_SECRET = 'test-jwt-secret-for-guards';

@Controller('test-guards')
class TestGuardsController {
  @Public()
  @Get('public')
  getPublic() {
    return { message: 'public' };
  }

  @Get('protected')
  getProtected() {
    return { message: 'protected' };
  }

  @Roles('admin')
  @Get('admin-only')
  getAdminOnly() {
    return { message: 'admin' };
  }

  @Roles('admin')
  @Get('admin-elevated')
  getAdminElevated() {
    return { message: 'elevated' };
  }
}

function signToken(jwtService: JwtService, payload: JwtPayload, opts?: { expiresIn?: number }) {
  return jwtService.sign(payload, {
    secret: TEST_SECRET,
    expiresIn: opts?.expiresIn ?? 300,
  });
}

describe('Guards Integration', () => {
  let app: NestFastifyApplication;
  let jwtService: JwtService;

  const adminPayload: JwtPayload = {
    sub: 'user-1',
    email: 'admin@test.com',
    role: 'admin',
    policyName: 'Extended',
  };

  const viewerPayload: JwtPayload = {
    sub: 'user-2',
    email: 'viewer@test.com',
    role: 'viewer',
    policyName: 'Standard',
  };

  beforeAll(async () => {
    const mockPrisma = {
      user: {
        findUnique: ({ where }: { where: { id?: string } }) => {
          if (where.id === 'user-1' || where.id === 'user-2') {
            return Promise.resolve({ id: where.id, isActive: true });
          }
          if (where.id === 'user-inactive') {
            return Promise.resolve({ id: where.id, isActive: false });
          }
          return Promise.resolve(null);
        },
      },
    };

    const mockRedis = {
      get: () => Promise.resolve(null),
      set: () => Promise.resolve(),
      del: () => Promise.resolve(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ JWT_SECRET: TEST_SECRET })],
        }),
        PassportModule,
        JwtModule.register({}),
      ],
      controllers: [TestGuardsController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        AuthService,
        JwtStrategy,
        { provide: APP_FILTER, useClass: AppExceptionFilter },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app?.close();
  });

  // --- Public endpoint ---

  it('public endpoint accessible without token → 200', async () => {
    const result = await app.inject({ method: 'GET', url: '/test-guards/public' });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.payload)).toEqual({ message: 'public' });
  });

  // --- Protected endpoint (no @Roles) ---

  it('protected endpoint without token → 401', async () => {
    const result = await app.inject({ method: 'GET', url: '/test-guards/protected' });
    expect(result.statusCode).toBe(401);
  });

  it('protected endpoint with valid JWT → 200', async () => {
    const token = signToken(jwtService, viewerPayload);
    const result = await app.inject({
      method: 'GET',
      url: '/test-guards/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.payload)).toEqual({ message: 'protected' });
  });

  it('protected endpoint with expired JWT → 401', async () => {
    const token = signToken(jwtService, viewerPayload, { expiresIn: 0 });
    const result = await app.inject({
      method: 'GET',
      url: '/test-guards/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(result.statusCode).toBe(401);
  });

  it('protected endpoint with malformed token → 401', async () => {
    const result = await app.inject({
      method: 'GET',
      url: '/test-guards/protected',
      headers: { authorization: 'Bearer not-a-real-jwt' },
    });
    expect(result.statusCode).toBe(401);
  });

  // --- @Roles('admin') endpoint ---

  it('@Roles("admin") with admin JWT → 200', async () => {
    const token = signToken(jwtService, adminPayload);
    const result = await app.inject({
      method: 'GET',
      url: '/test-guards/admin-only',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.payload)).toEqual({ message: 'admin' });
  });

  it('@Roles("admin") with viewer JWT → 403', async () => {
    const token = signToken(jwtService, viewerPayload);
    const result = await app.inject({
      method: 'GET',
      url: '/test-guards/admin-only',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(result.statusCode).toBe(403);
  });

  it('@Roles("admin") without token → 401', async () => {
    const result = await app.inject({ method: 'GET', url: '/test-guards/admin-only' });
    expect(result.statusCode).toBe(401);
  });

  // --- @Roles('admin') elevated endpoint ---

  it('@Roles("admin") elevated with admin JWT → 200', async () => {
    const token = signToken(jwtService, adminPayload);
    const result = await app.inject({
      method: 'GET',
      url: '/test-guards/admin-elevated',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(result.statusCode).toBe(200);
  });

  it('@Roles("admin") elevated with viewer JWT → 403', async () => {
    const token = signToken(jwtService, viewerPayload);
    const result = await app.inject({
      method: 'GET',
      url: '/test-guards/admin-elevated',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(result.statusCode).toBe(403);
  });

  // --- Inactive user ---

  it('protected endpoint with token for inactive user → 401', async () => {
    const token = signToken(jwtService, {
      sub: 'user-inactive',
      email: 'gone@test.com',
      role: 'admin',
      policyName: 'Extended',
    });
    const result = await app.inject({
      method: 'GET',
      url: '/test-guards/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(result.statusCode).toBe(401);
  });
});
