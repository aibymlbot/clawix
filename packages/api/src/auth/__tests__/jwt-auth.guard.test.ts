import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from '../jwt-auth.guard.js';

function createMockContext(): ExecutionContext {
  return {
    getHandler: () => vi.fn(),
    getClass: () => vi.fn(),
    switchToHttp: () => ({
      getRequest: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  it('should return true for @Public() routes without calling super', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(true);
    const superSpy = vi.spyOn(AuthGuard('jwt').prototype, 'canActivate');

    const context = createMockContext();
    expect(guard.canActivate(context)).toBe(true);
    expect(superSpy).not.toHaveBeenCalled();

    superSpy.mockRestore();
  });

  it('should delegate to super.canActivate() for non-public routes', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    const superSpy = vi.spyOn(AuthGuard('jwt').prototype, 'canActivate').mockReturnValueOnce(true);

    const context = createMockContext();
    expect(guard.canActivate(context)).toBe(true);
    expect(superSpy).toHaveBeenCalledWith(context);

    superSpy.mockRestore();
  });

  it('should delegate to super.canActivate() when IS_PUBLIC_KEY is undefined', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(undefined);
    const superSpy = vi.spyOn(AuthGuard('jwt').prototype, 'canActivate').mockReturnValueOnce(false);

    const context = createMockContext();
    expect(guard.canActivate(context)).toBe(false);
    expect(superSpy).toHaveBeenCalledWith(context);

    superSpy.mockRestore();
  });
});
