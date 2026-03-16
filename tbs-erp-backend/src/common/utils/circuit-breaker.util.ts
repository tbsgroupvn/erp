import { Logger, ServiceUnavailableException } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  halfOpenMaxCalls?: number;
  name?: string;
}

/**
 * Circuit Breaker pattern implementation for external service calls.
 *
 * States:
 *  - CLOSED   : Normal operation. Failures are counted.
 *  - OPEN     : After `failureThreshold` consecutive failures the circuit opens.
 *               All calls are immediately rejected with ServiceUnavailableException.
 *  - HALF_OPEN: After `resetTimeoutMs` the circuit allows up to `halfOpenMaxCalls`
 *               test calls. A success closes the circuit; a failure re-opens it.
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenCalls = 0;
  private readonly logger: Logger;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxCalls: number;
  private readonly name: string;

  constructor(options?: CircuitBreakerOptions) {
    this.failureThreshold = options?.failureThreshold ?? 5;
    this.resetTimeoutMs = options?.resetTimeoutMs ?? 60000;
    this.halfOpenMaxCalls = options?.halfOpenMaxCalls ?? 3;
    this.name = options?.name ?? 'default';
    this.logger = new Logger(`CircuitBreaker:${this.name}`);
  }

  /**
   * Execute a function through the circuit breaker.
   * Throws ServiceUnavailableException when the circuit is OPEN.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenCalls = 0;
        this.logger.log('Circuit transitioning to HALF_OPEN');
      } else {
        throw new ServiceUnavailableException(
          `Circuit breaker "${this.name}" is OPEN. Service temporarily unavailable.`,
        );
      }
    }

    if (this.state === CircuitState.HALF_OPEN && this.halfOpenCalls >= this.halfOpenMaxCalls) {
      throw new ServiceUnavailableException(
        `Circuit breaker "${this.name}" is HALF_OPEN. Max test calls reached.`,
      );
    }

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenCalls++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.logger.log('Circuit transitioning to CLOSED');
    }
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.logger.warn('Circuit re-opened from HALF_OPEN state');
      return;
    }

    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.logger.warn(
        `Circuit OPENED after ${this.failureCount} failures. Will reset in ${this.resetTimeoutMs}ms`,
      );
    }
  }

  /** Returns the current circuit state. */
  getState(): CircuitState {
    return this.state;
  }

  /** Returns the current consecutive failure count. */
  getFailureCount(): number {
    return this.failureCount;
  }
}

/**
 * Redis-backed Circuit Breaker that persists state across process restarts.
 *
 * Stores circuit state and failure count in Redis keys:
 *   - circuit:{name}:state  -> 'CLOSED' | 'OPEN' | 'HALF_OPEN'
 *   - circuit:{name}:failures -> number
 *   - circuit:{name}:lastFailure -> timestamp ms
 *
 * Falls back to in-memory behavior if Redis is unavailable.
 */
export class RedisCircuitBreaker extends CircuitBreaker {
  private readonly redisPrefix: string;
  private redis: any; // IoRedis instance

  constructor(options?: CircuitBreakerOptions & { redis?: any }) {
    super(options);
    this.redisPrefix = `circuit:${options?.name ?? 'default'}`;
    this.redis = options?.redis ?? null;
  }

  /**
   * Set the Redis client (allows lazy injection).
   */
  setRedis(redis: any): void {
    this.redis = redis;
  }

  /**
   * Execute with Redis state sync.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.redis) {
      await this.loadStateFromRedis();
    }

    try {
      const result = await super.execute(fn);
      if (this.redis) {
        await this.saveStateToRedis();
      }
      return result;
    } catch (error) {
      if (this.redis) {
        await this.saveStateToRedis();
      }
      throw error;
    }
  }

  private async loadStateFromRedis(): Promise<void> {
    try {
      const [state, failures, lastFailure] = await this.redis.mget(
        `${this.redisPrefix}:state`,
        `${this.redisPrefix}:failures`,
        `${this.redisPrefix}:lastFailure`,
      );

      if (state && Object.values(CircuitState).includes(state as CircuitState)) {
        (this as any).state = state as CircuitState;
      }
      if (failures !== null) {
        (this as any).failureCount = parseInt(failures, 10) || 0;
      }
      if (lastFailure !== null) {
        (this as any).lastFailureTime = parseInt(lastFailure, 10) || 0;
      }
    } catch {
      // Redis unavailable — fall back to in-memory state
    }
  }

  private async saveStateToRedis(): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      pipeline.set(`${this.redisPrefix}:state`, this.getState(), 'EX', 86400);
      pipeline.set(`${this.redisPrefix}:failures`, String(this.getFailureCount()), 'EX', 86400);
      pipeline.set(
        `${this.redisPrefix}:lastFailure`,
        String((this as any).lastFailureTime || 0),
        'EX',
        86400,
      );
      await pipeline.exec();
    } catch {
      // Redis unavailable — state only in memory
    }
  }
}
