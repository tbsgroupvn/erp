/**
 * Per-integration timeout configuration.
 *
 * Each external system has its own timeout settings based on observed latency
 * and SLA requirements. Defaults are conservative; adjust after production profiling.
 */
export interface IntegrationTimeoutConfig {
  /** Connection timeout in ms */
  connectTimeoutMs: number;
  /** Response timeout in ms */
  responseTimeoutMs: number;
  /** Total request timeout (connect + response + transfer) in ms */
  totalTimeoutMs: number;
  /** Circuit breaker failure threshold */
  circuitBreakerThreshold: number;
  /** Circuit breaker reset timeout in ms */
  circuitBreakerResetMs: number;
}

export const INTEGRATION_TIMEOUTS: Record<string, IntegrationTimeoutConfig> = {
  // Vietnam Customs (ECUS) - slow government API
  ECUS: {
    connectTimeoutMs: 10_000,
    responseTimeoutMs: 60_000,
    totalTimeoutMs: 90_000,
    circuitBreakerThreshold: 3,
    circuitBreakerResetMs: 120_000,
  },

  // Banking APIs (VCB, Techcombank)
  BANKING: {
    connectTimeoutMs: 5_000,
    responseTimeoutMs: 30_000,
    totalTimeoutMs: 45_000,
    circuitBreakerThreshold: 5,
    circuitBreakerResetMs: 60_000,
  },

  // Shipping providers (GHTK, GHN, Viettel Post)
  SHIPPING: {
    connectTimeoutMs: 5_000,
    responseTimeoutMs: 15_000,
    totalTimeoutMs: 25_000,
    circuitBreakerThreshold: 5,
    circuitBreakerResetMs: 30_000,
  },

  // Accounting software (MISA)
  ACCOUNTING: {
    connectTimeoutMs: 5_000,
    responseTimeoutMs: 30_000,
    totalTimeoutMs: 45_000,
    circuitBreakerThreshold: 5,
    circuitBreakerResetMs: 60_000,
  },

  // Lark Suite (messaging/notifications)
  LARKSUITE: {
    connectTimeoutMs: 3_000,
    responseTimeoutMs: 10_000,
    totalTimeoutMs: 15_000,
    circuitBreakerThreshold: 10,
    circuitBreakerResetMs: 30_000,
  },

  // Default for unknown integrations
  DEFAULT: {
    connectTimeoutMs: 5_000,
    responseTimeoutMs: 30_000,
    totalTimeoutMs: 45_000,
    circuitBreakerThreshold: 5,
    circuitBreakerResetMs: 60_000,
  },
};

/**
 * Get timeout config for a specific integration, falling back to DEFAULT.
 */
export function getIntegrationTimeout(integration: string): IntegrationTimeoutConfig {
  return INTEGRATION_TIMEOUTS[integration.toUpperCase()] ?? INTEGRATION_TIMEOUTS.DEFAULT;
}
