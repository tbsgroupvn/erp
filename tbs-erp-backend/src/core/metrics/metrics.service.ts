import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: client.Registry;

  // HTTP metrics
  readonly httpRequestsTotal: client.Counter<string>;
  readonly httpRequestDuration: client.Histogram<string>;
  readonly activeConnections: client.Gauge<string>;

  // Database metrics
  readonly databaseQueryDuration: client.Histogram<string>;
  readonly dbConnectionsTotal: client.Gauge<string>;
  readonly dbConnectionsActive: client.Gauge<string>;
  readonly dbConnectionsIdle: client.Gauge<string>;
  readonly dbConnectionsIdleInTransaction: client.Gauge<string>;
  readonly dbConnectionsWaiting: client.Gauge<string>;
  readonly dbSlowQueriesTotal: client.Counter<string>;
  readonly dbSizeBytes: client.Gauge<string>;
  readonly dbTableSizeBytes: client.Gauge<string>;
  readonly dbReplicationLagBytes: client.Gauge<string>;

  // Webhook metrics
  readonly webhookDeliveriesTotal: client.Counter<string>;
  readonly webhookDeliveryDuration: client.Histogram<string>;

  // Cache metrics
  readonly cacheHitsTotal: client.Counter<string>;
  readonly cacheMissesTotal: client.Counter<string>;

  // Auth metrics
  readonly authLoginAttemptsTotal: client.Counter<string>;

  // Business metrics
  readonly approvalPendingCount: client.Gauge<string>;
  readonly ordersCreatedTotal: client.Counter<string>;

  // Performance / APM metrics
  readonly slowRequestsTotal: client.Counter<string>;
  readonly responseSize: client.Histogram<string>;

  // Memory & event loop metrics
  readonly memoryHeapUsed: client.Gauge<string>;
  readonly memoryHeapTotal: client.Gauge<string>;
  readonly memoryRss: client.Gauge<string>;
  readonly memoryExternal: client.Gauge<string>;
  readonly memoryLeakSuspected: client.Gauge<string>;
  readonly eventLoopLag: client.Gauge<string>;

  // Cache invalidation metrics
  readonly cacheInvalidationsTotal: client.Counter<string>;

  constructor() {
    this.registry = new client.Registry();

    // Set default labels
    this.registry.setDefaultLabels({
      app: 'tbs-erp-backend',
    });

    // HTTP request counter
    this.httpRequestsTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // HTTP request duration histogram
    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    // Active connections gauge
    this.activeConnections = new client.Gauge({
      name: 'active_connections',
      help: 'Number of active connections',
      registers: [this.registry],
    });

    // Database query duration histogram
    this.databaseQueryDuration = new client.Histogram({
      name: 'database_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['model', 'operation'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
      registers: [this.registry],
    });

    // Database connection pool gauges
    this.dbConnectionsTotal = new client.Gauge({
      name: 'db_connections_total',
      help: 'Total number of database connections',
      registers: [this.registry],
    });

    this.dbConnectionsActive = new client.Gauge({
      name: 'db_connections_active',
      help: 'Number of active database connections',
      registers: [this.registry],
    });

    this.dbConnectionsIdle = new client.Gauge({
      name: 'db_connections_idle',
      help: 'Number of idle database connections',
      registers: [this.registry],
    });

    this.dbConnectionsIdleInTransaction = new client.Gauge({
      name: 'db_connections_idle_in_transaction',
      help: 'Number of connections idle in transaction',
      registers: [this.registry],
    });

    this.dbConnectionsWaiting = new client.Gauge({
      name: 'db_connections_waiting',
      help: 'Number of connections waiting for locks',
      registers: [this.registry],
    });

    // Slow queries counter
    this.dbSlowQueriesTotal = new client.Counter({
      name: 'db_slow_queries_total',
      help: 'Total number of slow queries detected (>5s)',
      registers: [this.registry],
    });

    // Database size gauge
    this.dbSizeBytes = new client.Gauge({
      name: 'db_size_bytes',
      help: 'Total database size in bytes',
      registers: [this.registry],
    });

    // Per-table size gauge
    this.dbTableSizeBytes = new client.Gauge({
      name: 'db_table_size_bytes',
      help: 'Table size in bytes',
      labelNames: ['table'],
      registers: [this.registry],
    });

    // Replication lag gauge
    this.dbReplicationLagBytes = new client.Gauge({
      name: 'db_replication_lag_bytes',
      help: 'Replication lag in bytes',
      labelNames: ['client'],
      registers: [this.registry],
    });

    // Webhook delivery counter
    this.webhookDeliveriesTotal = new client.Counter({
      name: 'webhook_deliveries_total',
      help: 'Total number of webhook deliveries',
      labelNames: ['event', 'status'],
      registers: [this.registry],
    });

    // Webhook delivery duration histogram
    this.webhookDeliveryDuration = new client.Histogram({
      name: 'webhook_delivery_duration_seconds',
      help: 'Webhook delivery duration in seconds',
      labelNames: ['event'],
      buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30],
      registers: [this.registry],
    });

    // Cache hit counter
    this.cacheHitsTotal = new client.Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      registers: [this.registry],
    });

    // Cache miss counter
    this.cacheMissesTotal = new client.Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      registers: [this.registry],
    });

    // Auth login attempts counter
    this.authLoginAttemptsTotal = new client.Counter({
      name: 'auth_login_attempts_total',
      help: 'Total number of authentication login attempts',
      labelNames: ['status'],
      registers: [this.registry],
    });

    // Pending approval gauge
    this.approvalPendingCount = new client.Gauge({
      name: 'approval_pending_count',
      help: 'Number of pending approvals',
      registers: [this.registry],
    });

    // Orders created counter
    this.ordersCreatedTotal = new client.Counter({
      name: 'orders_created_total',
      help: 'Total number of orders created',
      labelNames: ['branch', 'service_type'],
      registers: [this.registry],
    });

    // ─── Performance / APM Metrics ───

    // Slow requests counter (>1000ms)
    this.slowRequestsTotal = new client.Counter({
      name: 'slow_requests_total',
      help: 'Total number of slow HTTP requests (>1000ms)',
      labelNames: ['method', 'route'],
      registers: [this.registry],
    });

    // Response size histogram
    this.responseSize = new client.Histogram({
      name: 'http_response_size_bytes',
      help: 'HTTP response size in bytes',
      labelNames: ['method', 'route'],
      buckets: [100, 1000, 10000, 100000, 500000, 1000000, 5000000],
      registers: [this.registry],
    });

    // ─── Memory & Event Loop Metrics ───

    this.memoryHeapUsed = new client.Gauge({
      name: 'app_memory_heap_used_bytes',
      help: 'V8 heap used in bytes',
      registers: [this.registry],
    });

    this.memoryHeapTotal = new client.Gauge({
      name: 'app_memory_heap_total_bytes',
      help: 'V8 heap total in bytes',
      registers: [this.registry],
    });

    this.memoryRss = new client.Gauge({
      name: 'app_memory_rss_bytes',
      help: 'Process RSS memory in bytes',
      registers: [this.registry],
    });

    this.memoryExternal = new client.Gauge({
      name: 'app_memory_external_bytes',
      help: 'V8 external memory (C++ objects) in bytes',
      registers: [this.registry],
    });

    this.memoryLeakSuspected = new client.Gauge({
      name: 'app_memory_leak_suspected',
      help: 'Whether a memory leak is suspected (0 or 1)',
      registers: [this.registry],
    });

    this.eventLoopLag = new client.Gauge({
      name: 'app_event_loop_lag_ms',
      help: 'Event loop lag in milliseconds',
      registers: [this.registry],
    });

    // ─── Cache Invalidation Metrics ───

    this.cacheInvalidationsTotal = new client.Counter({
      name: 'cache_invalidations_total',
      help: 'Total number of cache invalidation events',
      labelNames: ['event'],
      registers: [this.registry],
    });
  }

  onModuleInit() {
    // Collect default Node.js metrics (CPU, memory, event loop lag, GC, etc.)
    client.collectDefaultMetrics({
      register: this.registry,
      prefix: 'nodejs_',
    });
  }

  /**
   * Returns all metrics in Prometheus text format
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Returns the content type for the metrics response
   */
  getContentType(): string {
    return this.registry.contentType;
  }
}
