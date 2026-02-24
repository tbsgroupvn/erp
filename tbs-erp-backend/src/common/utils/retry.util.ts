import { Logger } from '@nestjs/common';

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryableErrors?: Array<new (...args: any[]) => Error>;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableErrors: [],
};

/**
 * Execute a function with exponential backoff retry logic.
 *
 * - Retries up to `maxRetries` times on failure.
 * - Delay doubles on each attempt: baseDelayMs * 2^attempt + jitter.
 * - Delay is capped at `maxDelayMs`.
 * - If `retryableErrors` is provided, only those error types trigger a retry;
 *   all other errors are re-thrown immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
  logger?: Logger,
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === opts.maxRetries;
      const isRetryable =
        opts.retryableErrors.length === 0 ||
        opts.retryableErrors.some((errClass) => error instanceof errClass);

      if (isLastAttempt || !isRetryable) {
        throw error;
      }

      const delay = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
        opts.maxDelayMs,
      );

      logger?.warn(
        `Attempt ${attempt + 1}/${opts.maxRetries} failed: ${error.message}. Retrying in ${Math.round(delay)}ms...`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Unreachable');
}
