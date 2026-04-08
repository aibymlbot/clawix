import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from '../roles.guard.js';

function createMockContext(user?: { sub: string; email: string; role: string }): ExecutionContext {
  return {
    getHandler: () => vi.fn(),
    getClass: () => vi.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should allow access when no @Roles() decorator is set', () => {
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(undefined) // IS_PUBLIC_KEY
      .mockReturnValueOnce(undefined); // ROLES_KEY

    const context = createMockContext({ sub: 'u1', email: 'a@b.com', role: 'viewer' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when @Roles() is empty array', () => {
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(undefined) // IS_PUBLIC_KEY
      .mockReturnValueOnce([]); // ROLES_KEY

    const context = createMockContext({ sub: 'u1', email: 'a@b.com', role: 'viewer' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user role matches a required role', () => {
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(undefined) // IS_PUBLIC_KEY
      .mockReturnValueOnce(['admin']); // ROLES_KEY

    const context = createMockContext({ sub: 'u1', email: 'a@b.com', role: 'admin' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException when user role does not match', () => {
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(undefined) // IS_PUBLIC_KEY
      .mockReturnValueOnce(['admin']); // ROLES_KEY

    const context = createMockContext({ sub: 'u1', email: 'a@b.com', role: 'viewer' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when request.user is undefined', () => {
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(undefined) // IS_PUBLIC_KEY
      .mockReturnValueOnce(['admin']); // ROLES_KEY

    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow('No user context');
  });

  it('should skip role check and allow access for @Public() routes', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(true); // IS_PUBLIC_KEY

    const context = createMockContext(undefined);
    expect(guard.canActivate(context)).toBe(true);
  });
});
