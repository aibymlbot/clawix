/**
 * Types for the ContainerPoolService.
 *
 * PoolEntry is immutable — state transitions create new objects via spread.
 */

/** Configuration for the container pool, loaded from environment variables. */
export interface PoolConfig {
  readonly maxWarmContainers: number;
  readonly maxEphemeralContainers: number;
  readonly defaultIdleTimeoutSec: number;
  readonly maxIdleTimeoutSec: number;
  readonly maxContainerLifetimeSec: number;
  readonly healthCheckIntervalSec: number;
  readonly lockTimeoutMs: number;
  readonly acquireWaitTimeoutMs: number;
}

/** Default pool configuration values. */
export const DEFAULT_POOL_CONFIG: PoolConfig = {
  maxWarmContainers: 20,
  maxEphemeralContainers: 10,
  defaultIdleTimeoutSec: 300,
  maxIdleTimeoutSec: 1800,
  maxContainerLifetimeSec: 3600,
  healthCheckIntervalSec: 60,
  lockTimeoutMs: 60_000,
  acquireWaitTimeoutMs: 30_000,
};

/** Immutable pool entry — all state transitions create new objects. */
export interface PoolEntry {
  readonly containerId: string;
  readonly agentDefId: string;
  readonly sessionId: string;
  readonly startedAt: Date;
  readonly status: 'active' | 'idle';
  readonly lastUsedAt: Date;
  readonly idleTimer: ReturnType<typeof setTimeout> | null;
  readonly ephemeral: boolean;
}

/** Statistics exposed for monitoring. */
export interface PoolStats {
  readonly active: number;
  readonly idle: number;
  readonly ephemeral: number;
  readonly total: number;
}
