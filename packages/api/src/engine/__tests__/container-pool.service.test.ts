/**
 * Tests for ContainerPoolService.
 *
 * Mocks ContainerRunner to isolate pool logic from Docker.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentDefinition } from '@clawix/shared';
import type { IContainerRunner } from '../container-runner.js';

// ------------------------------------------------------------------ //
//  Module mocks — must be hoisted before imports                      //
// ------------------------------------------------------------------ //

vi.mock('@clawix/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@clawix/shared')>();
  return {
    ...actual,
    createLogger: vi.fn().mockReturnValue({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  };
});

vi.mock('../container-runner.js', () => ({
  ContainerRunner: class ContainerRunner {},
  cleanupOrphanContainers: vi.fn().mockResolvedValue(undefined),
}));

// ------------------------------------------------------------------ //
//  Imports after mocks                                                //
// ------------------------------------------------------------------ //

import { ContainerPoolService } from '../container-pool.service.js';
import type { PoolConfig } from '../container-pool.types.js';
import { DEFAULT_POOL_CONFIG } from '../container-pool.types.js';

// ------------------------------------------------------------------ //
//  Helpers                                                            //
// ------------------------------------------------------------------ //

function makeAgentDef(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'agent-1',
    name: 'Test Agent',
    description: null,
    systemPrompt: 'You are a test agent.',
    role: 'primary',
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    apiBaseUrl: null,
    skillIds: [],
    maxTokensPerRun: 4096,
    containerConfig: {
      image: 'clawix-agent:latest',
      cpuLimit: '0.5',
      memoryLimit: '512m',
      timeoutSeconds: 300,
      readOnlyRootfs: true,
      allowedMounts: [],
      idleTimeoutSeconds: 300,
    },
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function buildMockRunner(): IContainerRunner & {
  start: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
} {
  let counter = 0;
  return {
    start: vi.fn().mockImplementation(async () => `container-${++counter}`),
    exec: vi.fn().mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' }),
    stop: vi.fn().mockResolvedValue(undefined),
  };
}

// ------------------------------------------------------------------ //
//  Tests                                                              //
// ------------------------------------------------------------------ //

describe('ContainerPoolService', () => {
  let pool: ContainerPoolService;
  let runner: ReturnType<typeof buildMockRunner>;
  const config: PoolConfig = { ...DEFAULT_POOL_CONFIG, healthCheckIntervalSec: 0 };

  beforeEach(() => {
    vi.useFakeTimers();
    runner = buildMockRunner();
    pool = new ContainerPoolService(runner, config);
  });

  afterEach(async () => {
    await pool.drainAll();
    vi.useRealTimers();
  });

  it('uses default config values', () => {
    expect(DEFAULT_POOL_CONFIG.maxWarmContainers).toBe(20);
    expect(DEFAULT_POOL_CONFIG.defaultIdleTimeoutSec).toBe(300);
  });

  // ---------------------------------------------------------------- //
  //  acquire()                                                        //
  // ---------------------------------------------------------------- //

  describe('acquire()', () => {
    it('starts a new container on first acquire for a session', async () => {
      const containerId = await pool.acquire(makeAgentDef(), 'session-1');

      expect(containerId).toBe('container-1');
      expect(runner.start).toHaveBeenCalledOnce();
      expect(runner.start).toHaveBeenCalledWith(expect.objectContaining({ id: 'agent-1' }), [], {
        disableAutoStop: true,
      });
    });

    it('returns warm container on second acquire for same session', async () => {
      const id1 = await pool.acquire(makeAgentDef(), 'session-1');
      pool.release('session-1');
      const id2 = await pool.acquire(makeAgentDef(), 'session-1');

      expect(id1).toBe(id2);
      expect(runner.start).toHaveBeenCalledOnce(); // only one start
    });

    it('starts different containers for different sessions', async () => {
      const id1 = await pool.acquire(makeAgentDef(), 'session-1');
      const id2 = await pool.acquire(makeAgentDef(), 'session-2');

      expect(id1).not.toBe(id2);
      expect(runner.start).toHaveBeenCalledTimes(2);
    });

    it('runs health check before returning warm container', async () => {
      await pool.acquire(makeAgentDef(), 'session-1');
      pool.release('session-1');

      // exec is used for health check: docker exec {id} true
      runner.exec.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
      await pool.acquire(makeAgentDef(), 'session-1');

      expect(runner.exec).toHaveBeenCalledWith('container-1', ['true'], expect.any(Object));
    });

    it('replaces dead container transparently on health check failure', async () => {
      await pool.acquire(makeAgentDef(), 'session-1');
      pool.release('session-1');

      // Health check fails
      runner.exec.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'not found' });
      const id2 = await pool.acquire(makeAgentDef(), 'session-1');

      expect(id2).toBe('container-2'); // new container started
      expect(runner.stop).toHaveBeenCalledWith('container-1'); // old one cleaned up
    });
  });

  // ---------------------------------------------------------------- //
  //  release()                                                        //
  // ---------------------------------------------------------------- //

  describe('release()', () => {
    it('keeps container alive after release (does not stop)', async () => {
      await pool.acquire(makeAgentDef(), 'session-1');
      pool.release('session-1');

      expect(runner.stop).not.toHaveBeenCalled();
    });

    it('stops container after idle timeout expires', async () => {
      await pool.acquire(makeAgentDef(), 'session-1');
      pool.release('session-1');

      await vi.advanceTimersByTimeAsync(300_001); // default 300s idle timeout

      expect(runner.stop).toHaveBeenCalledWith('container-1');
    });

    it('resets idle timer on re-acquire and re-release', async () => {
      await pool.acquire(makeAgentDef(), 'session-1');
      pool.release('session-1');

      // Advance 200s (less than 300s idle timeout)
      await vi.advanceTimersByTimeAsync(200_000);
      expect(runner.stop).not.toHaveBeenCalled();

      // Re-acquire and re-release resets the timer
      await pool.acquire(makeAgentDef(), 'session-1');
      pool.release('session-1');

      // Advance another 200s — still within new 300s window
      await vi.advanceTimersByTimeAsync(200_000);
      expect(runner.stop).not.toHaveBeenCalled();

      // Advance past the 300s mark from second release
      await vi.advanceTimersByTimeAsync(101_000);
      expect(runner.stop).toHaveBeenCalledWith('container-1');
    });

    it('uses agent-specific idleTimeoutSeconds', async () => {
      const agentDef = makeAgentDef({
        containerConfig: {
          image: 'clawix-agent:latest',
          cpuLimit: '0.5',
          memoryLimit: '512m',
          timeoutSeconds: 300,
          readOnlyRootfs: true,
          allowedMounts: [],
          idleTimeoutSeconds: 60, // 1 minute
        },
      });

      await pool.acquire(agentDef, 'session-1');
      pool.release('session-1');

      await vi.advanceTimersByTimeAsync(59_000);
      expect(runner.stop).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(2_000);
      expect(runner.stop).toHaveBeenCalledWith('container-1');
    });

    it('stops immediately when idleTimeoutSeconds is 0', async () => {
      const agentDef = makeAgentDef({
        containerConfig: {
          image: 'clawix-agent:latest',
          cpuLimit: '0.5',
          memoryLimit: '512m',
          timeoutSeconds: 300,
          readOnlyRootfs: true,
          allowedMounts: [],
          idleTimeoutSeconds: 0,
        },
      });

      await pool.acquire(agentDef, 'session-1');
      pool.release('session-1');

      // With timeout 0, should stop immediately (next tick)
      await vi.advanceTimersByTimeAsync(1);
      expect(runner.stop).toHaveBeenCalledWith('container-1');
    });
  });

  // ---------------------------------------------------------------- //
  //  stats()                                                          //
  // ---------------------------------------------------------------- //

  describe('stats()', () => {
    it('reports active, idle, ephemeral, and total counts', async () => {
      await pool.acquire(makeAgentDef(), 'session-1');
      await pool.acquire(makeAgentDef(), 'session-2');
      pool.release('session-2');

      const s = pool.stats();
      expect(s.active).toBe(1);
      expect(s.idle).toBe(1);
      expect(s.total).toBe(2);
    });
  });

  // ---------------------------------------------------------------- //
  //  evict()                                                          //
  // ---------------------------------------------------------------- //

  describe('evict()', () => {
    it('stops container immediately and removes from pool', async () => {
      await pool.acquire(makeAgentDef(), 'session-1');
      await pool.evict('session-1');

      expect(runner.stop).toHaveBeenCalledWith('container-1');
      expect(pool.stats().total).toBe(0);
    });

    it('is a no-op for unknown sessions', async () => {
      await pool.evict('nonexistent');
      expect(runner.stop).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------- //
  //  drainAll()                                                       //
  // ---------------------------------------------------------------- //

  describe('drainAll()', () => {
    it('stops all containers and empties the pool', async () => {
      await pool.acquire(makeAgentDef(), 'session-1');
      await pool.acquire(makeAgentDef(), 'session-2');
      pool.release('session-2');

      await pool.drainAll();

      expect(runner.stop).toHaveBeenCalledTimes(2);
      expect(pool.stats().total).toBe(0);
    });
  });

  // ---------------------------------------------------------------- //
  //  LRU eviction                                                     //
  // ---------------------------------------------------------------- //

  describe('LRU eviction', () => {
    it('evicts oldest idle container when pool is full', async () => {
      const smallConfig = {
        ...DEFAULT_POOL_CONFIG,
        maxWarmContainers: 2,
        healthCheckIntervalSec: 0,
      };
      const smallPool = new ContainerPoolService(runner, smallConfig);

      await smallPool.acquire(makeAgentDef(), 'session-1');
      smallPool.release('session-1');
      await smallPool.acquire(makeAgentDef(), 'session-2');
      smallPool.release('session-2');

      // Pool is full (2/2). Acquiring a third should evict session-1 (oldest idle).
      await smallPool.acquire(makeAgentDef(), 'session-3');

      expect(runner.stop).toHaveBeenCalledWith('container-1');
      expect(smallPool.stats().total).toBe(2); // session-2 (idle) + session-3 (active)

      await smallPool.drainAll();
    });
  });

  // ---------------------------------------------------------------- //
  //  ephemeral containers                                             //
  // ---------------------------------------------------------------- //

  describe('ephemeral containers', () => {
    it('marks container as ephemeral when pool is full with active containers', async () => {
      const smallConfig = {
        ...DEFAULT_POOL_CONFIG,
        maxWarmContainers: 1,
        maxEphemeralContainers: 1,
        healthCheckIntervalSec: 0,
      };
      const smallPool = new ContainerPoolService(runner, smallConfig);

      await smallPool.acquire(makeAgentDef(), 'session-1'); // fills pool
      await smallPool.acquire(makeAgentDef(), 'session-2'); // ephemeral

      const s = smallPool.stats();
      expect(s.ephemeral).toBeGreaterThanOrEqual(1);

      // Release ephemeral — should stop immediately
      smallPool.release('session-2');
      await vi.advanceTimersByTimeAsync(1);
      expect(runner.stop).toHaveBeenCalledWith('container-2');

      await smallPool.drainAll();
    });

    it('throws when both pool and ephemeral are full with no idle entries', async () => {
      const tinyConfig = {
        ...DEFAULT_POOL_CONFIG,
        maxWarmContainers: 1,
        maxEphemeralContainers: 1,
        healthCheckIntervalSec: 0,
      };
      const tinyPool = new ContainerPoolService(runner, tinyConfig);

      await tinyPool.acquire(makeAgentDef(), 'session-1'); // fills pool
      await tinyPool.acquire(makeAgentDef(), 'session-2'); // fills ephemeral

      await expect(tinyPool.acquire(makeAgentDef(), 'session-3')).rejects.toThrow(/pool is full/i);

      await tinyPool.drainAll();
    });
  });

  // ---------------------------------------------------------------- //
  //  max container lifetime                                           //
  // ---------------------------------------------------------------- //

  describe('max container lifetime', () => {
    it('recycles container that exceeded max lifetime on acquire', async () => {
      const shortLifeConfig = {
        ...DEFAULT_POOL_CONFIG,
        maxContainerLifetimeSec: 10,
        healthCheckIntervalSec: 0,
      };
      const shortPool = new ContainerPoolService(runner, shortLifeConfig);

      await shortPool.acquire(makeAgentDef(), 'session-1');
      shortPool.release('session-1');

      // Advance past max lifetime
      await vi.advanceTimersByTimeAsync(11_000);
      // Clear the idle timeout stop call
      runner.stop.mockClear();

      // Re-acquire — should detect expired lifetime and start fresh
      const id = await shortPool.acquire(makeAgentDef(), 'session-1');
      expect(id).not.toBe('container-1');
      expect(runner.start).toHaveBeenCalledTimes(2);

      await shortPool.drainAll();
    });
  });
});
