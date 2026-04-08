import { describe, expect, it } from 'vitest';

import { createLogger, rootLogger } from '../logger.js';

describe('createLogger', () => {
  it('should create a named logger', () => {
    const logger = createLogger('test-service');

    expect(logger).toBeDefined();
  });

  it('should create a logger with context', () => {
    const logger = createLogger('test-service', {
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    expect(logger).toBeDefined();
  });
});

describe('rootLogger', () => {
  it('should be a valid logger instance', () => {
    expect(rootLogger).toBeDefined();
    expect(typeof rootLogger.info).toBe('function');
    expect(typeof rootLogger.error).toBe('function');
    expect(typeof rootLogger.warn).toBe('function');
    expect(typeof rootLogger.debug).toBe('function');
  });
});
