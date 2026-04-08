/** Options for cache set operations. */
export interface CacheSetOptions {
  /** Time-to-live in seconds. If omitted, key persists indefinitely. */
  readonly ttlSeconds?: number;
}

/** Typed envelope for pub/sub messages. */
export interface PubSubMessage<T = unknown> {
  readonly channel: string;
  readonly payload: T;
  readonly timestamp: string;
}

/** Callback type for pub/sub subscriptions. */
export type SubscriptionHandler<T = unknown> = (message: PubSubMessage<T>) => void | Promise<void>;
