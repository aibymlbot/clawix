/**
 * ContainerPoolService — manages a pool of warm Docker containers
 * keyed by session ID. Primary agents reuse warm containers between
 * messages; sub-agents bypass the pool.
 *
 * Pool entries are immutable — every state transition replaces the
 * entry in the map with a new object.
 */
import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { createLogger } from '@clawix/shared';
import type { AgentDefinition } from '@clawix/shared';

import { ContainerRunner, cleanupOrphanContainers } from './container-runner.js';
import type { IContainerRunner, StartOptions } from './container-runner.js';
import type { PoolConfig, PoolEntry, PoolStats } from './container-pool.types.js';
import { DEFAULT_POOL_CONFIG } from './container-pool.types.js';

const logger = createLogger('engine:container-pool');

const HEALTH_CHECK_TIMEOUT_MS = 5_000;

@Injectable()
export class ContainerPoolService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Map<string, PoolEntry>();
  private readonly locks = new Map<string, { promise: Promise<void>; resolve: () => void }>();
  private readonly config: PoolConfig;
  private readonly runner: IContainerRunner;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Tracks the idleTimeoutSeconds for each session so that release()
   * can start the correct idle timer without needing the AgentDefinition.
   */
  private readonly sessionIdleTimeouts = new Map<string, number>();

  constructor(
    @Inject(ContainerRunner) runner: IContainerRunner,
    @Optional() @Inject('POOL_CONFIG') config: Partial<PoolConfig> = {},
  ) {
    this.runner = runner;
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };

    if (this.config.healthCheckIntervalSec > 0) {
      this.healthCheckInterval = setInterval(() => {
        void this.runHealthCheck();
      }, this.config.healthCheckIntervalSec * 1000);
      this.healthCheckInterval.unref();
    }
  }

  async onModuleInit(): Promise<void> {
    logger.info('Cleaning up orphan containers from previous runs');
    await cleanupOrphanContainers();
  }

  async onModuleDestroy(): Promise<void> {
    await this.drainAll();
  }

  // ---------------------------------------------------------------- //
  //  acquire()                                                        //
  // ---------------------------------------------------------------- //

  async acquire(
    agentDef: AgentDefinition,
    sessionId: string,
    startOptions: Pick<StartOptions, 'workspaceHostPath' | 'skillMounts'> = {},
  ): Promise<string> {
    await this.acquireLock(sessionId);

    try {
      const idleTimeout = Math.min(
        agentDef.containerConfig.idleTimeoutSeconds ?? this.config.defaultIdleTimeoutSec,
        this.config.maxIdleTimeoutSec,
      );
      this.sessionIdleTimeouts.set(sessionId, idleTimeout);

      const existing = this.pool.get(sessionId);

      // Existing warm container — health check then reuse
      if (existing !== undefined) {
        // Clear idle timer
        if (existing.idleTimer !== null) {
          clearTimeout(existing.idleTimer);
        }

        // Check max lifetime
        const lifetimeMs = Date.now() - existing.startedAt.getTime();
        if (lifetimeMs > this.config.maxContainerLifetimeSec * 1000) {
          logger.info(
            { sessionId, containerId: existing.containerId },
            'Container exceeded max lifetime — recycling',
          );
          await this.stopAndRemove(sessionId, existing.containerId);
          return await this.startFresh(agentDef, sessionId, startOptions);
        }

        // Health check
        const alive = await this.isAlive(existing.containerId);
        if (!alive) {
          logger.warn(
            { sessionId, containerId: existing.containerId },
            'Warm container failed health check — replacing',
          );
          await this.stopAndRemove(sessionId, existing.containerId);
          return await this.startFresh(agentDef, sessionId, startOptions);
        }

        // Reuse — replace entry immutably
        const updated: PoolEntry = {
          ...existing,
          status: 'active',
          lastUsedAt: new Date(),
          idleTimer: null,
        };
        this.pool.set(sessionId, updated);

        logger.info(
          { sessionId, containerId: existing.containerId, action: 'reuse' },
          'Acquired warm container',
        );
        return existing.containerId;
      }

      // No existing container — need a new one
      return await this.startFresh(agentDef, sessionId, startOptions);
    } catch (err) {
      // Release lock on error so the session isn't permanently locked
      this.releaseLock(sessionId);
      throw err;
    }
  }

  // ---------------------------------------------------------------- //
  //  release()                                                        //
  // ---------------------------------------------------------------- //

  release(sessionId: string): void {
    const entry = this.pool.get(sessionId);
    if (entry === undefined) {
      this.releaseLock(sessionId);
      return;
    }

    // Ephemeral containers or idleTimeout=0: stop immediately
    const idleTimeout =
      this.sessionIdleTimeouts.get(sessionId) ?? this.config.defaultIdleTimeoutSec;
    if (entry.ephemeral || idleTimeout === 0) {
      logger.info(
        {
          sessionId,
          containerId: entry.containerId,
          reason: entry.ephemeral ? 'ephemeral' : 'zero-timeout',
        },
        'Stopping container on release',
      );
      void this.stopAndRemove(sessionId, entry.containerId);
      this.releaseLock(sessionId);
      return;
    }

    // Start idle timer
    const timer = setTimeout(() => {
      logger.info(
        { sessionId, containerId: entry.containerId },
        'Idle timeout expired — stopping container',
      );
      void this.stopAndRemove(sessionId, entry.containerId);
    }, idleTimeout * 1000);

    timer.unref();

    const updated: PoolEntry = {
      ...entry,
      status: 'idle',
      lastUsedAt: new Date(),
      idleTimer: timer,
    };
    this.pool.set(sessionId, updated);

    logger.info(
      { sessionId, containerId: entry.containerId, action: 'release', idleTimeout },
      'Released container to pool',
    );
    this.releaseLock(sessionId);
  }

  // ---------------------------------------------------------------- //
  //  evict()                                                          //
  // ---------------------------------------------------------------- //

  async evict(sessionId: string): Promise<void> {
    const entry = this.pool.get(sessionId);
    if (entry === undefined) return;

    if (entry.idleTimer !== null) {
      clearTimeout(entry.idleTimer);
    }

    logger.info(
      { sessionId, containerId: entry.containerId, action: 'evict' },
      'Evicting container',
    );
    await this.stopAndRemove(sessionId, entry.containerId);

    // Release the session lock so subsequent acquire() calls can proceed.
    this.releaseLock(sessionId);
  }

  // ---------------------------------------------------------------- //
  //  drainAll()                                                       //
  // ---------------------------------------------------------------- //

  async drainAll(): Promise<void> {
    if (this.healthCheckInterval !== null) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    const entries = [...this.pool.entries()];
    this.pool.clear();
    this.sessionIdleTimeouts.clear();

    await Promise.all(
      entries.map(async ([, entry]) => {
        if (entry.idleTimer !== null) clearTimeout(entry.idleTimer);
        await this.runner.stop(entry.containerId).catch((err: unknown) => {
          logger.warn(
            { containerId: entry.containerId, err },
            'Failed to stop container during drain',
          );
        });
      }),
    );

    // Release all locks
    for (const [key, lock] of this.locks) {
      this.locks.delete(key);
      lock.resolve();
    }

    logger.info({ drained: entries.length }, 'Pool drained');
  }

  // ---------------------------------------------------------------- //
  //  stats()                                                          //
  // ---------------------------------------------------------------- //

  stats(): PoolStats {
    let active = 0;
    let idle = 0;
    let ephemeral = 0;

    for (const entry of this.pool.values()) {
      if (entry.ephemeral) ephemeral++;
      else if (entry.status === 'active') active++;
      else idle++;
    }

    return { active, idle, ephemeral, total: this.pool.size };
  }

  // ---------------------------------------------------------------- //
  //  Private helpers                                                  //
  // ---------------------------------------------------------------- //

  private async startFresh(
    agentDef: AgentDefinition,
    sessionId: string,
    startOptions: Pick<StartOptions, 'workspaceHostPath' | 'skillMounts'> = {},
  ): Promise<string> {
    // Check pool capacity
    const nonEphemeralCount = [...this.pool.values()].filter((e) => !e.ephemeral).length;
    const ephemeralCount = [...this.pool.values()].filter((e) => e.ephemeral).length;
    let isEphemeral = false;

    if (nonEphemeralCount >= this.config.maxWarmContainers) {
      // Pool is full — try LRU eviction of idle containers
      const evicted = await this.evictLRU();
      if (!evicted) {
        // No idle containers to evict — fall back to ephemeral
        isEphemeral = true;
        if (ephemeralCount >= this.config.maxEphemeralContainers) {
          throw new Error('Container pool is full — no slots available. Please try again.');
        }
        logger.warn(
          { sessionId, poolSize: this.pool.size },
          'Pool full — starting ephemeral container',
        );
      }
    }

    const containerId = await this.runner.start(agentDef, [], {
      disableAutoStop: true,
      workspaceHostPath: startOptions.workspaceHostPath,
      skillMounts: startOptions.skillMounts,
    });

    const entry: PoolEntry = {
      containerId,
      agentDefId: agentDef.id,
      sessionId,
      startedAt: new Date(),
      status: 'active',
      lastUsedAt: new Date(),
      idleTimer: null,
      ephemeral: isEphemeral,
    };
    this.pool.set(sessionId, entry);

    logger.info(
      { sessionId, containerId, action: 'start', ephemeral: isEphemeral },
      'Started new container',
    );
    return containerId;
  }

  private async stopAndRemove(sessionId: string, containerId: string): Promise<void> {
    this.pool.delete(sessionId);
    this.sessionIdleTimeouts.delete(sessionId);
    await this.runner.stop(containerId).catch((err: unknown) => {
      logger.warn({ containerId, err }, 'Failed to stop container');
    });
  }

  private async isAlive(containerId: string): Promise<boolean> {
    try {
      const result = await this.runner.exec(containerId, ['true'], {
        timeout: HEALTH_CHECK_TIMEOUT_MS,
      });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  private async evictLRU(): Promise<boolean> {
    let oldest: { sessionId: string; entry: PoolEntry } | null = null;

    for (const [sessionId, entry] of this.pool) {
      if (entry.status !== 'idle') continue;
      if (oldest === null || entry.lastUsedAt < oldest.entry.lastUsedAt) {
        oldest = { sessionId, entry };
      }
    }

    if (oldest === null) return false;

    if (oldest.entry.idleTimer !== null) {
      clearTimeout(oldest.entry.idleTimer);
    }

    logger.info(
      { sessionId: oldest.sessionId, containerId: oldest.entry.containerId },
      'LRU evicting idle container',
    );
    await this.stopAndRemove(oldest.sessionId, oldest.entry.containerId);
    return true;
  }

  // ---------------------------------------------------------------- //
  //  Per-session lock                                                 //
  // ---------------------------------------------------------------- //

  private async acquireLock(sessionId: string): Promise<void> {
    const deadline = Date.now() + this.config.lockTimeoutMs;

    while (this.locks.has(sessionId)) {
      if (Date.now() > deadline) {
        logger.warn({ sessionId }, 'Lock timeout — forcibly acquiring');
        this.releaseLock(sessionId);
        break;
      }
      const lock = this.locks.get(sessionId);
      if (lock !== undefined) {
        await lock.promise;
      }
    }

    // No await between the while-exit and set() — single-threaded safety.
    let resolve: (() => void) | undefined;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    this.locks.set(sessionId, { promise, resolve: resolve as () => void });
  }

  private releaseLock(sessionId: string): void {
    const lock = this.locks.get(sessionId);
    if (lock) {
      this.locks.delete(sessionId);
      lock.resolve();
    }
  }

  // ---------------------------------------------------------------- //
  //  Periodic health check                                            //
  // ---------------------------------------------------------------- //

  private async runHealthCheck(): Promise<void> {
    for (const [sessionId, entry] of this.pool) {
      if (entry.status !== 'idle') continue;

      // Check max lifetime
      const lifetimeMs = Date.now() - entry.startedAt.getTime();
      if (lifetimeMs > this.config.maxContainerLifetimeSec * 1000) {
        logger.info(
          { sessionId, containerId: entry.containerId },
          'Health check: max lifetime exceeded',
        );
        if (entry.idleTimer !== null) clearTimeout(entry.idleTimer);
        await this.stopAndRemove(sessionId, entry.containerId);
        continue;
      }

      // Check liveness
      const alive = await this.isAlive(entry.containerId);
      if (!alive) {
        logger.warn({ sessionId, containerId: entry.containerId }, 'Health check: container dead');
        if (entry.idleTimer !== null) clearTimeout(entry.idleTimer);
        await this.stopAndRemove(sessionId, entry.containerId);
      }
    }
  }
}
