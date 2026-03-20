# Thiết kế Hệ thống Observability — TBS ERP

> Tài liệu này định nghĩa chiến lược observability toàn diện cho TBS ERP, một hệ thống thương mại xuyên biên giới Việt-Trung chạy trên NestJS + Next.js + PostgreSQL + Redis + BullMQ trong Docker.
>
> Ngày soạn: 2026-03-20
> Stack: NestJS (prom-client), Prometheus 2.50, Grafana 10.3, ELK 8.12, OpenTelemetry

---

## Mục lục

1. [SLOs — Service Level Objectives](#1-slos--service-level-objectives)
2. [Alerting Rules — Quy tắc cảnh báo](#2-alerting-rules--quy-tắc-cảnh-báo)
3. [Dashboard Design — Thiết kế Dashboard](#3-dashboard-design--thiết-kế-dashboard)
4. [Logging Strategy — Chiến lược Logging](#4-logging-strategy--chiến-lược-logging)
5. [Metrics Collection — Thu thập Metrics](#5-metrics-collection--thu-thập-metrics)
6. [Recommended Stack — Stack đề xuất](#6-recommended-stack--stack-đề-xuất)
7. [Runbook — Sổ tay xử lý sự cố](#7-runbook--sổ-tay-xử-lý-sự-cố)

---

## 1. SLOs — Service Level Objectives

### 1.1 Tổng quan Error Budget

SLO được thiết kế theo mô hình **Google SRE** — mỗi SLO có:
- **SLI** (Service Level Indicator): metric đo lường thực tế
- **SLO** (Service Level Objective): mục tiêu đặt ra
- **Error Budget**: ngân sách lỗi cho phép trong 30 ngày

| SLO | Target | Error Budget (30d) | Window |
|-----|--------|--------------------|--------|
| API Availability | 99.5% | 3h 36m | Rolling 30d |
| API Latency P95 | < 500ms | 5% requests | Rolling 5m |
| API Latency P99 | < 2s (list) | 1% requests | Rolling 5m |
| Order Processing SLA | 99% | 1% đơn hàng | Rolling 24h |
| BullMQ Job Completion | 99% | 1% jobs | Rolling 1h |
| HTTP 5xx Error Rate | < 1% | 1% requests | Rolling 5m |
| DB Query P95 | < 500ms | 5% queries | Rolling 5m |

### 1.2 API Availability SLO

**SLI Definition:**
```
sli = (requests thành công) / (tổng requests)
    = sum(rate(http_requests_total{status_code!~"5.."}[5m]))
      / sum(rate(http_requests_total[5m]))
```

**Target:** 99.5% uptime
**Cho phép downtime:** 3 giờ 36 phút / tháng
**Error Budget burn rate alert:**
- Fast burn (2h window): nếu burn rate > 14.4x thì cảnh báo Critical
- Slow burn (6h window): nếu burn rate > 6x thì cảnh báo Warning

**Exclusions:**
- Maintenance window đã thông báo trước (max 2h/tháng)
- Downtime do dependency bên ngoài (carrier API, ngân hàng)

### 1.3 API Latency SLO

**SLI Definition:**
```
# P95 < 500ms cho tất cả endpoints
sli_p95 = histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)
)

# P99 < 2s cho list endpoints (GET /api/v1/orders, /api/v1/customers, ...)
sli_p99_list = histogram_quantile(0.99,
  sum(rate(http_request_duration_seconds_bucket{
    route=~"/api/v1/(orders|customers|containers|reports).*",
    method="GET"
  }[5m])) by (le)
)
```

**Ngưỡng phân loại theo endpoint:**

| Loại endpoint | P95 target | P99 target |
|--------------|-----------|-----------|
| Auth (login, refresh) | < 200ms | < 500ms |
| CRUD đơn lẻ (GET by ID) | < 300ms | < 800ms |
| List có pagination | < 500ms | < 2s |
| Dashboard / Aggregate | < 800ms | < 3s |
| Report generation | < 5s | < 30s |
| Export Excel | < 10s | < 60s |

### 1.4 Order Processing SLA

**SLI Definition** — đo % đơn hàng chuyển trạng thái đúng hạn theo `SLAMonitorService`:

```
sli_order_sla = 1 - (
  count(orders với SLA BREACHED)
  / count(tổng orders active)
)
```

**SLA per trạng thái FSM** (đã cấu hình trong `SLAMonitorService.getSLAConfig()`):

| Trạng thái | SLA mặc định | Cảnh báo tại |
|-----------|-------------|-------------|
| CONSULTING (sale contact) | 2 giờ | 1.5 giờ |
| QUOTATION (báo giá) | 4 giờ | 3 giờ |
| PENDING_DEPOSIT | 3 ngày | 2 ngày |
| SOURCING | 7 ngày | 5 ngày |
| WAREHOUSE_CN / WAREHOUSE_VN | 24 giờ | 18 giờ |
| PACKING | 48 giờ | 36 giờ |
| IN_TRANSIT | 15 ngày | 12 ngày |
| CUSTOMS | 5 ngày | 4 ngày |
| DELIVERING | 3 ngày | 2 ngày |
| SETTLEMENT | 7 ngày | 5 ngày |

**Target:** 99% đơn hàng không vi phạm SLA
**Error Budget:** 1% đơn hàng được phép vi phạm trong 24h rolling

### 1.5 BullMQ Job Completion SLO

**7 queues cần theo dõi:**
- `order-events` (concurrency: 3)
- `notification-events` (concurrency: 5)
- `finance-events` (concurrency: 2) — critical, ảnh hưởng kế toán
- `warehouse-events` (concurrency: 3)
- `integration-events` (concurrency: 2)
- `report-jobs` (concurrency: 1)
- `batch-jobs` (concurrency: 2)

**SLI Definition:**
```
sli_job = (jobs completed trong 5 phút) / (tổng jobs processed)
```

**Target:** 99% jobs hoàn thành trong 5 phút
**Timeout mặc định:** 300,000ms (5 phút) — đã cấu hình trong `QueueModule`
**Retry policy:** 3 lần, exponential backoff (1s base)

**Error Budget vi phạm:**
- DLQ (Dead Letter Queue) > 10 jobs trong bất kỳ queue nào = Warning
- DLQ > 50 jobs trong `finance-events` = Critical

### 1.6 HTTP 5xx Error Rate SLO

**SLI Definition:**
```
sli_error = 1 - (
  sum(rate(http_requests_total{status_code=~"5.."}[5m]))
  / sum(rate(http_requests_total[5m]))
)
```

**Target:** < 1% requests trả về 5xx
**Error Budget:** Nếu error rate liên tục > 1% trong 5 phút = alert ngay
**Phân biệt:**
- 500 Internal Server Error: lỗi application
- 502/503/504 Gateway: lỗi infrastructure
- 429 Too Many Requests: không tính vào 5xx SLO

### 1.7 Database Query P95 SLO

**SLI Definition:**
```
sli_db = histogram_quantile(0.95,
  sum(rate(database_query_duration_seconds_bucket[5m])) by (le, model, operation)
)
```

**Target:** P95 < 500ms cho mọi model/operation
**Slow query threshold:** > 5s (đã cấu hình trong `MetricsService.dbSlowQueriesTotal`)
**Đặc biệt chú ý:**
- `Order` + `findMany` với filter phức tạp
- `ARAgingSnapshot` queries (phân tích tuổi công nợ)
- `GeneralLedger` aggregate queries

---

## 2. Alerting Rules — Quy tắc cảnh báo

### 2.1 Phân loại Severity

| Severity | Kênh | Response time | On-call |
|---------|------|--------------|---------|
| **Critical** | PagerDuty + Slack #alerts-critical | 15 phút | Kỹ thuật trực |
| **Warning** | Slack #alerts-warning | 1 giờ | Kỹ thuật ngày |
| **Info** | Slack #alerts-info | Best effort | Không cần |

### 2.2 Alert Rules YAML — Prometheus

File này bổ sung vào `monitoring/prometheus/alerts.yml`:

```yaml
# ============================================================
# TBS ERP — Complete Prometheus Alert Rules
# File: monitoring/prometheus/alerts.yml
# ============================================================

groups:

  # ──────────────────────────────────────────────────────────
  # GROUP 1: SLO Burn Rate Alerts (Multi-window)
  # Dựa trên Google SRE burn rate model
  # ──────────────────────────────────────────────────────────
  - name: slo_burn_rate
    rules:

      # API Availability — Fast burn (2h window, 14.4x rate)
      - alert: SLOAvailabilityBurnRateCritical
        expr: |
          (
            sum(rate(http_requests_total{status_code=~"5.."}[2h]))
            / sum(rate(http_requests_total[2h]))
          ) > 0.072
        for: 2m
        labels:
          severity: critical
          slo: api_availability
        annotations:
          summary: "SLO Availability: burn rate nguy hiểm (fast burn)"
          description: |
            Error rate hiện tại {{ $value | humanizePercentage }} sẽ tiêu hết
            error budget 30 ngày chỉ trong ~2 giờ. Cần xử lý ngay.
          runbook_url: "https://wiki.tbs.vn/runbooks/slo-availability"

      # API Availability — Slow burn (6h window, 6x rate)
      - alert: SLOAvailabilityBurnRateWarning
        expr: |
          (
            sum(rate(http_requests_total{status_code=~"5.."}[6h]))
            / sum(rate(http_requests_total[6h]))
          ) > 0.03
        for: 15m
        labels:
          severity: warning
          slo: api_availability
        annotations:
          summary: "SLO Availability: burn rate elevated (slow burn)"
          description: |
            Error rate {{ $value | humanizePercentage }} trong 6h qua.
            Error budget đang bị tiêu thụ nhanh hơn bình thường.

      # Latency P95 SLO burn rate
      - alert: SLOLatencyP95Breach
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
          ) > 0.5
        for: 5m
        labels:
          severity: warning
          slo: api_latency
        annotations:
          summary: "SLO Latency: P95 vượt 500ms"
          description: "P95 latency hiện tại {{ $value }}s. SLO target: 500ms."

      # Latency P99 SLO — list endpoints
      - alert: SLOLatencyP99ListBreach
        expr: |
          histogram_quantile(0.99,
            sum(rate(http_request_duration_seconds_bucket{
              route=~"/api/v1/(orders|customers|containers|reports).*"
            }[5m])) by (le)
          ) > 2.0
        for: 5m
        labels:
          severity: warning
          slo: api_latency_list
        annotations:
          summary: "SLO Latency: P99 list endpoints vượt 2s"
          description: "P99 latency cho list endpoints hiện tại {{ $value }}s."

  # ──────────────────────────────────────────────────────────
  # GROUP 2: Critical Infrastructure
  # ──────────────────────────────────────────────────────────
  - name: infrastructure_critical
    rules:

      # API hoàn toàn không phản hồi
      - alert: APIDown
        expr: up{job="tbs-erp-backend"} == 0
        for: 1m
        labels:
          severity: critical
          channel: pagerduty
        annotations:
          summary: "CRITICAL: TBS ERP Backend down"
          description: |
            Backend service không phản hồi đã {{ $value }} giây.
            Tất cả user không thể đăng nhập hay thao tác.
          runbook_url: "https://wiki.tbs.vn/runbooks/api-down"

      # Database hoàn toàn không kết nối được
      - alert: DatabaseDown
        expr: pg_up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
          channel: pagerduty
        annotations:
          summary: "CRITICAL: PostgreSQL unreachable"
          description: "PostgreSQL không thể kết nối. Toàn bộ business operations bị chặn."
          runbook_url: "https://wiki.tbs.vn/runbooks/db-down"

      # Connection pool cạn kiệt (> 90% max_connections)
      - alert: DatabaseConnectionPoolExhausted
        expr: |
          pg_stat_activity_count{job="postgres"}
          / pg_settings_max_connections{job="postgres"} > 0.9
        for: 2m
        labels:
          severity: critical
          channel: pagerduty
        annotations:
          summary: "CRITICAL: DB connection pool gần cạn kiệt"
          description: |
            {{ $value | humanizePercentage }} connection pool đã được dùng.
            ({{ humanize pg_stat_activity_count }} / {{ humanize pg_settings_max_connections }})
            Nguy cơ từ chối kết nối mới.
          runbook_url: "https://wiki.tbs.vn/runbooks/db-pool-exhausted"

      # Redis down — ảnh hưởng cache, session, BullMQ
      - alert: RedisDown
        expr: redis_up{job="redis"} == 0
        for: 1m
        labels:
          severity: critical
          channel: pagerduty
        annotations:
          summary: "CRITICAL: Redis unreachable"
          description: |
            Redis không phản hồi. Ảnh hưởng: cache, session JWT, BullMQ queues,
            rate limiting — toàn bộ background jobs bị dừng.
          runbook_url: "https://wiki.tbs.vn/runbooks/redis-down"

      # 5xx error rate vượt 5% (SLO breach severe)
      - alert: HighErrorRate5xx
        expr: |
          (
            sum(rate(http_requests_total{status_code=~"5.."}[5m]))
            / sum(rate(http_requests_total[5m]))
          ) > 0.05
        for: 3m
        labels:
          severity: critical
          channel: pagerduty
        annotations:
          summary: "CRITICAL: Error rate 5xx vượt 5%"
          description: |
            {{ $value | humanizePercentage }} requests đang trả về 5xx trong 5 phút qua.
            SLO target: < 1%. Cần điều tra ngay.

      # Disk usage > 90%
      - alert: DiskCritical
        expr: |
          (
            (node_filesystem_size_bytes{mountpoint="/"} - node_filesystem_avail_bytes{mountpoint="/"})
            / node_filesystem_size_bytes{mountpoint="/"}
          ) > 0.90
        for: 5m
        labels:
          severity: critical
          channel: pagerduty
        annotations:
          summary: "CRITICAL: Disk usage > 90%"
          description: |
            Disk trên {{ $labels.instance }} đã dùng {{ $value | humanizePercentage }}.
            Nguy cơ PostgreSQL WAL corruption nếu disk đầy.

  # ──────────────────────────────────────────────────────────
  # GROUP 3: Warning Alerts
  # ──────────────────────────────────────────────────────────
  - name: warnings
    rules:

      # Error rate > 1% (SLO breach bắt đầu)
      - alert: ErrorRateAboveSLO
        expr: |
          (
            sum(rate(http_requests_total{status_code=~"5.."}[5m]))
            / sum(rate(http_requests_total[5m]))
          ) > 0.01
        for: 5m
        labels:
          severity: warning
          channel: slack
        annotations:
          summary: "Warning: Error rate vượt 1% SLO target"
          description: |
            5xx error rate: {{ $value | humanizePercentage }} trong 5 phút.
            Error budget đang bị tiêu thụ.

      # Latency P95 > 1s (degraded)
      - alert: LatencyDegraded
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
          ) > 1.0
        for: 5m
        labels:
          severity: warning
          channel: slack
        annotations:
          summary: "Warning: API latency P95 > 1s"
          description: "P95 latency {{ $value }}s. User experience đang bị ảnh hưởng."

      # BullMQ DLQ > 10 jobs
      - alert: BullMQDLQHigh
        expr: |
          sum(bullmq_queue_failed_jobs_total) by (queue) > 10
        for: 10m
        labels:
          severity: warning
          channel: slack
        annotations:
          summary: "Warning: BullMQ DLQ có {{ $value }} jobs thất bại - queue {{ $labels.queue }}"
          description: |
            Queue {{ $labels.queue }} có {{ $value }} jobs trong DLQ.
            Kiểm tra logs để tìm nguyên nhân lỗi.
          runbook_url: "https://wiki.tbs.vn/runbooks/bullmq-dlq"

      # BullMQ finance-events DLQ > 5 (ngưỡng thấp hơn vì critical)
      - alert: FinanceQueueDLQCritical
        expr: |
          bullmq_queue_failed_jobs_total{queue="finance-events"} > 5
        for: 5m
        labels:
          severity: critical
          channel: pagerduty
        annotations:
          summary: "CRITICAL: finance-events DLQ có {{ $value }} jobs"
          description: |
            Finance queue có jobs thất bại. Phân bổ chi phí vận hành bị gián đoạn.
            Cần xem xét ngay để tránh sai lệch kế toán.

      # SLA breach — đơn hàng vi phạm SLA
      - alert: OrderSLABreachHigh
        expr: |
          sum(tbs_order_sla_breach_total) > 10
        for: 30m
        labels:
          severity: warning
          channel: slack
        annotations:
          summary: "Warning: {{ $value }} đơn hàng vi phạm SLA"
          description: |
            Số đơn hàng vi phạm SLA: {{ $value }}.
            SLO target: < 1% đơn hàng active.

      # Redis memory > 80%
      - alert: RedisMemoryHigh
        expr: |
          redis_memory_used_bytes / redis_memory_max_bytes > 0.80
        for: 10m
        labels:
          severity: warning
          channel: slack
        annotations:
          summary: "Warning: Redis memory usage > 80%"
          description: |
            Redis đang dùng {{ $value | humanizePercentage }} memory.
            Nguy cơ eviction keys — ảnh hưởng cache hit rate.

      # Slow queries tăng bất thường
      - alert: SlowQueriesSpike
        expr: |
          rate(db_slow_queries_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
          channel: slack
        annotations:
          summary: "Warning: Slow queries tăng bất thường"
          description: |
            {{ $value | humanize }} slow queries/giây trong 5 phút qua.
            Kiểm tra explain plan và indexes.

      # High 4xx rate (có thể là tấn công hoặc bug client)
      - alert: High4xxRate
        expr: |
          (
            sum(rate(http_requests_total{status_code=~"4.."}[5m]))
            / sum(rate(http_requests_total[5m]))
          ) > 0.25
        for: 10m
        labels:
          severity: warning
          channel: slack
        annotations:
          summary: "Warning: 4xx rate > 25%"
          description: |
            {{ $value | humanizePercentage }} requests đang trả về 4xx.
            Có thể là bug client hoặc brute force attack.

      # Login failure rate > 50% (brute force)
      - alert: BruteForceLoginSuspected
        expr: |
          (
            sum(rate(auth_login_attempts_total{status="failure"}[15m]))
            / sum(rate(auth_login_attempts_total[15m]))
          ) > 0.5
        for: 10m
        labels:
          severity: warning
          channel: slack
        annotations:
          summary: "Warning: Login failure rate > 50% — nghi ngờ brute force"
          description: |
            {{ $value | humanizePercentage }} login attempts thất bại trong 15 phút.
            Xem xét block IP và thông báo security team.

      # Memory leak suspected
      - alert: MemoryLeakSuspected
        expr: app_memory_leak_suspected{job="tbs-erp-backend"} == 1
        for: 5m
        labels:
          severity: warning
          channel: slack
        annotations:
          summary: "Warning: Nghi ngờ memory leak trong backend"
          description: |
            Backend memory tăng liên tục. Heap used: {{ $value }}MB.
            Xem xét restart và điều tra memory profile.

      # Event loop lag > 200ms
      - alert: EventLoopLagHigh
        expr: app_event_loop_lag_ms{job="tbs-erp-backend"} > 200
        for: 5m
        labels:
          severity: warning
          channel: slack
        annotations:
          summary: "Warning: Event loop lag > 200ms"
          description: |
            Node.js event loop lag {{ $value }}ms. API responses sẽ bị chậm.
            Tìm blocking operation trong code.

      # Backend restart nhiều lần
      - alert: BackendRestartLoop
        expr: changes(process_start_time_seconds{job="tbs-erp-backend"}[30m]) > 3
        for: 5m
        labels:
          severity: warning
          channel: slack
        annotations:
          summary: "Warning: Backend restart {{ $value }} lần trong 30 phút"
          description: "Backend đang crash loop. Kiểm tra logs ngay."

      # Disk > 80% (warning trước khi critical)
      - alert: DiskWarning
        expr: |
          (
            (node_filesystem_size_bytes{mountpoint="/"} - node_filesystem_avail_bytes{mountpoint="/"})
            / node_filesystem_size_bytes{mountpoint="/"}
          ) > 0.80
        for: 10m
        labels:
          severity: warning
          channel: slack
        annotations:
          summary: "Warning: Disk usage > 80%"
          description: "Disk {{ $labels.instance }}: {{ $value | humanizePercentage }}"

  # ──────────────────────────────────────────────────────────
  # GROUP 4: Info Alerts (Deployment, Config, Migration)
  # ──────────────────────────────────────────────────────────
  - name: info_events
    rules:

      # Backend vừa restart (deployment hoặc crash)
      - alert: BackendRestarted
        expr: changes(process_start_time_seconds{job="tbs-erp-backend"}[5m]) > 0
        labels:
          severity: info
          channel: slack_info
        annotations:
          summary: "Info: Backend service đã restart"
          description: "Backend process vừa khởi động lại. Kiểm tra nếu không có deployment."

      # Không có đơn hàng mới trong 2 giờ (trong giờ hành chính)
      - alert: NoOrdersCreated
        expr: |
          (
            sum(rate(orders_created_total[2h])) == 0
          )
          and on() (hour() >= 8 and hour() <= 18)
        for: 30m
        labels:
          severity: info
          channel: slack_info
        annotations:
          summary: "Info: Không có đơn hàng mới trong 2 giờ (giờ hành chính)"
          description: "Kiểm tra xem có vấn đề với sales pipeline không."

      # Số approval pending cao
      - alert: PendingApprovalHigh
        expr: approval_pending_count > 50
        for: 1h
        labels:
          severity: info
          channel: slack_info
        annotations:
          summary: "Info: {{ $value }} approvals đang chờ xử lý"
          description: "Số lượng pending approval cao. CFO/COO cần review."
```

### 2.3 Routing Configuration (Grafana Alerting / Alertmanager)

```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'slack-warning'
  routes:
    - matchers:
        - severity = critical
        - channel = pagerduty
      receiver: 'pagerduty-critical'
      continue: true
    - matchers:
        - severity = critical
      receiver: 'slack-critical'
    - matchers:
        - severity = warning
      receiver: 'slack-warning'
    - matchers:
        - severity = info
      receiver: 'slack-info'

receivers:
  - name: 'pagerduty-critical'
    pagerduty_configs:
      - service_key: '${PAGERDUTY_SERVICE_KEY}'
        description: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        severity: 'critical'

  - name: 'slack-critical'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts-critical'
        title: ':red_circle: CRITICAL - {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'slack-warning'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts-warning'
        title: ':warning: WARNING - {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'slack-info'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts-info'
        title: ':information_source: INFO - {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

inhibit_rules:
  # Khi APIDown thì suppress mọi latency/error alerts
  - source_matchers:
      - alertname = APIDown
    target_matchers:
      - severity =~ warning|info
    equal: ['job']

  # Khi DatabaseDown thì suppress DB query alerts
  - source_matchers:
      - alertname = DatabaseDown
    target_matchers:
      - alertname =~ HighDatabaseQueryDuration|SlowQueriesSpike|DatabaseConnectionPoolExhausted
```

---

## 3. Dashboard Design — Thiết kế Dashboard

### 3.1 Kiến trúc Dashboard

Theo nguyên tắc **Hierarchy Drill-Down**:
```
Executive Overview
    └── Operations Dashboard
            ├── Engineering Dashboard
            │       ├── API Performance
            │       ├── Database Health
            │       ├── Queue Monitor (BullMQ)
            │       └── Infrastructure
            └── Business Dashboard
                    ├── Finance Dashboard
                    └── SLA Compliance
```

### 3.2 Dashboard 1: Executive (CEO, COO, CFO)

**Persona:** Ban lãnh đạo, xem trên màn hình lớn hoặc mobile
**Refresh:** 5 phút
**Default range:** 7 ngày

**Panels (tối đa 8, cognitive load thấp):**

| # | Panel | Visualization | Metric |
|---|-------|--------------|--------|
| 1 | Doanh thu 7 ngày | Time series + trend | `sum(orders_revenue_vnd_total)` |
| 2 | Tổng đơn hàng mới hôm nay | Stat | `sum(increase(orders_created_total[1d]))` |
| 3 | SLA Compliance % | Gauge (green/red) | `(active_orders - sla_breached) / active_orders * 100` |
| 4 | API Availability SLO | Gauge | `(1 - error_rate) * 100` target 99.5% |
| 5 | Công nợ phải thu (AR) | Stat | `sum(ar_balance_vnd)` |
| 6 | Pipeline trạng thái đơn | Bar chart stacked | `orders_by_status` gauge |
| 7 | Top 5 Sales theo doanh thu | Table | `orders_revenue by sale_id` |
| 8 | Alert active count | Stat (red if > 0) | Grafana alerting API |

### 3.3 Dashboard 2: Operations (LOGISTICS_MANAGER, XNK_MANAGER, WAREHOUSE_MANAGER)

**Persona:** Đội vận hành, theo dõi luồng hàng hóa
**Refresh:** 1 phút
**Default range:** 24 giờ

**Panels:**

| # | Panel | Visualization | Metric |
|---|-------|--------------|--------|
| 1 | Container pipeline | Sankey / Flow | Containers by status (PLANNING→COMPLETED) |
| 2 | Hàng tại kho TQ | Stat | `packages_in_warehouse_cn` |
| 3 | Hàng tại kho VN | Stat | `packages_in_warehouse_vn` |
| 4 | Đơn hàng DELIVERING | Table | Orders in DELIVERING with aging |
| 5 | SLA breaches hôm nay | Table (red rows) | `tbs_order_sla_breach_total by type` |
| 6 | Containers in transit | Map / Timeline | `container_status{status="IN_TRANSIT"}` |
| 7 | Thông quan pending | Stat | `customs_declarations_by_status` |
| 8 | Throughput kho VN (packages/h) | Time series | `rate(warehouse_vn_packages_processed[1h])` |

### 3.4 Dashboard 3: Engineering (Kỹ thuật, DevOps)

**Persona:** Kỹ thuật, SRE
**Refresh:** 30 giây
**Default range:** 1 giờ (incident: 15 phút)

**Layout (theo Golden Signals):**

```
Row 1: Golden Signals Overview
  [Traffic RPS] [Error Rate %] [P95 Latency] [P99 Latency] [Active Connections]

Row 2: HTTP Details
  [Request Rate by Route]  [Error Rate by Route]  [Latency Heatmap]

Row 3: Database
  [Query Duration P95 by Model]  [Active Connections]  [Slow Query Rate]  [Replication Lag]

Row 4: Redis
  [Memory Usage %]  [Hit Rate %]  [Connected Clients]  [Command Rate]

Row 5: BullMQ Queues
  [Queue Depth by Queue]  [Job Completion Rate]  [DLQ Size]  [P95 Duration by Queue]

Row 6: Node.js Runtime
  [Heap Used]  [Event Loop Lag]  [GC Duration]  [External Memory]

Row 7: Infrastructure
  [CPU %]  [Memory RSS]  [Disk I/O]  [Network I/O]
```

**Grafana Dashboard JSON — Engineering Dashboard (snippet):**

```json
{
  "__inputs": [
    {
      "name": "DS_PROMETHEUS",
      "label": "Prometheus",
      "description": "",
      "type": "datasource",
      "pluginId": "prometheus",
      "pluginName": "Prometheus"
    }
  ],
  "title": "TBS ERP — Engineering Dashboard",
  "uid": "tbs-engineering",
  "description": "Golden Signals, Database, Redis, BullMQ, Node.js runtime",
  "tags": ["tbs-erp", "engineering", "slo"],
  "timezone": "Asia/Ho_Chi_Minh",
  "refresh": "30s",
  "time": { "from": "now-1h", "to": "now" },
  "graphTooltip": 1,
  "templating": {
    "list": [
      {
        "name": "interval",
        "type": "interval",
        "current": { "text": "1m", "value": "1m" },
        "options": ["1m", "5m", "10m", "30m", "1h"]
      }
    ]
  },
  "panels": [
    {
      "id": 1,
      "title": "Request Rate (RPS)",
      "type": "timeseries",
      "gridPos": { "h": 6, "w": 8, "x": 0, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "fieldConfig": {
        "defaults": {
          "unit": "reqps",
          "color": { "mode": "palette-classic" },
          "custom": { "lineWidth": 2, "fillOpacity": 10 }
        }
      },
      "options": {
        "tooltip": { "mode": "multi" },
        "legend": { "displayMode": "table", "placement": "bottom" }
      },
      "targets": [
        {
          "expr": "sum(rate(http_requests_total[${interval}])) by (method)",
          "legendFormat": "{{ method }}"
        }
      ]
    },
    {
      "id": 2,
      "title": "HTTP 5xx Error Rate",
      "type": "timeseries",
      "gridPos": { "h": 6, "w": 8, "x": 8, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "fieldConfig": {
        "defaults": {
          "unit": "percentunit",
          "min": 0,
          "max": 1,
          "color": { "mode": "thresholds" },
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "green", "value": null },
              { "color": "yellow", "value": 0.005 },
              { "color": "red", "value": 0.01 }
            ]
          },
          "custom": {
            "lineWidth": 2,
            "fillOpacity": 20,
            "thresholdsStyle": { "mode": "line+area" }
          }
        }
      },
      "targets": [
        {
          "expr": "sum(rate(http_requests_total{status_code=~\"5..\"}[${interval}])) / sum(rate(http_requests_total[${interval}]))",
          "legendFormat": "5xx Error Rate"
        }
      ]
    },
    {
      "id": 3,
      "title": "API Latency (P50 / P95 / P99)",
      "type": "timeseries",
      "gridPos": { "h": 6, "w": 8, "x": 16, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "fieldConfig": {
        "defaults": {
          "unit": "s",
          "custom": { "lineWidth": 2 }
        }
      },
      "targets": [
        {
          "expr": "histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket[${interval}])) by (le))",
          "legendFormat": "P50"
        },
        {
          "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[${interval}])) by (le))",
          "legendFormat": "P95"
        },
        {
          "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[${interval}])) by (le))",
          "legendFormat": "P99"
        }
      ]
    },
    {
      "id": 10,
      "title": "DB Query Duration P95 by Model",
      "type": "timeseries",
      "gridPos": { "h": 7, "w": 12, "x": 0, "y": 12 },
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "fieldConfig": {
        "defaults": {
          "unit": "s",
          "custom": {
            "lineWidth": 1,
            "fillOpacity": 5
          }
        },
        "overrides": [
          {
            "matcher": { "id": "byName", "options": "P95 SLO (0.5s)" },
            "properties": [
              { "id": "color", "value": { "fixedColor": "red", "mode": "fixed" } },
              { "id": "custom.lineStyle", "value": { "fill": "dash", "dash": [10, 5] } },
              { "id": "custom.lineWidth", "value": 2 }
            ]
          }
        ]
      },
      "targets": [
        {
          "expr": "histogram_quantile(0.95, sum(rate(database_query_duration_seconds_bucket[${interval}])) by (le, model))",
          "legendFormat": "{{ model }}"
        },
        {
          "expr": "vector(0.5)",
          "legendFormat": "P95 SLO (0.5s)"
        }
      ]
    },
    {
      "id": 11,
      "title": "DB Connection Pool",
      "type": "timeseries",
      "gridPos": { "h": 7, "w": 12, "x": 12, "y": 12 },
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "fieldConfig": {
        "defaults": { "unit": "short" }
      },
      "targets": [
        {
          "expr": "db_connections_active",
          "legendFormat": "Active"
        },
        {
          "expr": "db_connections_idle",
          "legendFormat": "Idle"
        },
        {
          "expr": "db_connections_waiting",
          "legendFormat": "Waiting"
        },
        {
          "expr": "db_connections_idle_in_transaction",
          "legendFormat": "Idle in Transaction"
        }
      ]
    },
    {
      "id": 20,
      "title": "BullMQ Queue Depth",
      "type": "bargauge",
      "gridPos": { "h": 6, "w": 12, "x": 0, "y": 24 },
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "fieldConfig": {
        "defaults": {
          "unit": "short",
          "thresholds": {
            "steps": [
              { "color": "green", "value": null },
              { "color": "yellow", "value": 50 },
              { "color": "red", "value": 100 }
            ]
          }
        }
      },
      "options": {
        "orientation": "horizontal",
        "reduceOptions": { "calcs": ["lastNotNull"] }
      },
      "targets": [
        {
          "expr": "bullmq_queue_waiting_jobs_total",
          "legendFormat": "{{ queue }}"
        }
      ]
    },
    {
      "id": 21,
      "title": "BullMQ DLQ Size",
      "type": "stat",
      "gridPos": { "h": 6, "w": 12, "x": 12, "y": 24 },
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "fieldConfig": {
        "defaults": {
          "unit": "short",
          "color": { "mode": "thresholds" },
          "thresholds": {
            "steps": [
              { "color": "green", "value": null },
              { "color": "yellow", "value": 5 },
              { "color": "red", "value": 10 }
            ]
          }
        }
      },
      "options": {
        "reduceOptions": { "calcs": ["lastNotNull"] },
        "orientation": "auto",
        "textMode": "auto",
        "colorMode": "background"
      },
      "targets": [
        {
          "expr": "bullmq_queue_failed_jobs_total",
          "legendFormat": "{{ queue }} DLQ"
        }
      ]
    },
    {
      "id": 30,
      "title": "Node.js Heap Memory",
      "type": "timeseries",
      "gridPos": { "h": 6, "w": 8, "x": 0, "y": 30 },
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "fieldConfig": {
        "defaults": {
          "unit": "bytes",
          "custom": { "lineWidth": 2 }
        }
      },
      "targets": [
        {
          "expr": "app_memory_heap_used_bytes{job=\"tbs-erp-backend\"}",
          "legendFormat": "Heap Used"
        },
        {
          "expr": "app_memory_heap_total_bytes{job=\"tbs-erp-backend\"}",
          "legendFormat": "Heap Total"
        },
        {
          "expr": "app_memory_rss_bytes{job=\"tbs-erp-backend\"}",
          "legendFormat": "RSS"
        }
      ]
    },
    {
      "id": 31,
      "title": "Event Loop Lag",
      "type": "timeseries",
      "gridPos": { "h": 6, "w": 8, "x": 8, "y": 30 },
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "fieldConfig": {
        "defaults": {
          "unit": "ms",
          "thresholds": {
            "steps": [
              { "color": "green", "value": null },
              { "color": "yellow", "value": 100 },
              { "color": "red", "value": 500 }
            ]
          },
          "custom": {
            "lineWidth": 2,
            "thresholdsStyle": { "mode": "line" }
          }
        }
      },
      "targets": [
        {
          "expr": "app_event_loop_lag_ms{job=\"tbs-erp-backend\"}",
          "legendFormat": "Event Loop Lag"
        }
      ]
    },
    {
      "id": 32,
      "title": "Cache Hit Rate",
      "type": "gauge",
      "gridPos": { "h": 6, "w": 8, "x": 16, "y": 30 },
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "fieldConfig": {
        "defaults": {
          "unit": "percentunit",
          "min": 0,
          "max": 1,
          "thresholds": {
            "steps": [
              { "color": "red", "value": null },
              { "color": "yellow", "value": 0.7 },
              { "color": "green", "value": 0.9 }
            ]
          }
        }
      },
      "options": {
        "reduceOptions": { "calcs": ["lastNotNull"] },
        "showThresholdMarkers": true
      },
      "targets": [
        {
          "expr": "rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))",
          "legendFormat": "Cache Hit Rate"
        }
      ]
    }
  ],
  "schemaVersion": 38
}
```

### 3.5 Dashboard 4: Finance (CFO, CHIEF_ACCOUNTANT, ACCOUNTANT_AR)

**Persona:** Kế toán, theo dõi dòng tiền và công nợ
**Refresh:** 10 phút
**Default range:** 30 ngày

**Panels:**

| # | Panel | Visualization | Nguồn |
|---|-------|--------------|-------|
| 1 | Dòng tiền thu/chi | Time series | `finance_cashflow_total` |
| 2 | AR aging (< 30d / 30-60d / 60-90d / > 90d) | Bar chart stacked | AR Aging materialized view |
| 3 | AP (công nợ phải trả) | Stat | `ap_balance_vnd` |
| 4 | Commission pipeline | Bar chart | `commission_pending_vnd by sale_id` |
| 5 | Phiếu thu/chi pending approval | Table | `payment_vouchers_pending` |
| 6 | Tỷ lệ thu tiền đúng hạn | Gauge | `collected_on_time / total_due` |
| 7 | Debt netting summary | Stat | `debt_netting_balance_vnd` |
| 8 | General ledger errors | Stat (0 = green) | `general_ledger_errors_total` |

### 3.6 Dashboard 5: SLA Compliance (COO, SALES_DIRECTOR, CSKH)

**Persona:** Quản lý vận hành, theo dõi SLA
**Refresh:** 5 phút
**Default range:** 24 giờ

**Panels:**

| # | Panel | Visualization | Metric |
|---|-------|--------------|--------|
| 1 | SLA Compliance % | Big stat (green/red) | `(orders_ok / orders_total) * 100` |
| 2 | Breaches by type | Horizontal bar | `sla_breaches by type` |
| 3 | Average time per stage | Heatmap | `order_stage_duration_seconds` |
| 4 | Orders at risk (> 80% SLA) | Table with links | SLAMonitorService data |
| 5 | CSKH response time P95 | Time series | `cskh_response_time_seconds` |
| 6 | Complaint resolution rate | Gauge | `complaints_resolved / complaints_total` |

---

## 4. Logging Strategy — Chiến lược Logging

### 4.1 Cấu trúc Log JSON (đã triển khai)

Mọi log từ backend phải tuân theo schema sau (ElkLoggerService):

```json
{
  "timestamp": "2026-03-20T09:30:00.000Z",
  "level": "info",
  "service": "tbs-erp-backend",
  "environment": "production",
  "requestId": "req-550e8400-e29b-41d4-a716-446655440000",
  "userId": "usr-123",
  "userRole": "SALE",
  "method": "POST",
  "path": "/api/v1/orders",
  "statusCode": 201,
  "durationMs": 145,
  "message": "Order created successfully",
  "context": "OrderService",
  "module": "order",
  "data": {
    "orderId": "ord-abc123",
    "orderCode": "TBS-2026-00001",
    "customerId": "cust-xyz",
    "totalVnd": 15000000
  }
}
```

**Fields bắt buộc:**
- `timestamp` — ISO 8601 UTC
- `level` — error | warn | info | debug
- `service` — luôn là `tbs-erp-backend`
- `requestId` — từ `RequestIdMiddleware` (X-Request-ID header)
- `message` — mô tả ngắn gọn

**Fields business-critical:**
- `userId` / `userRole` — ai thực hiện
- `module` — module NestJS (order, finance, warehouse, ...)
- `orderId` / `orderCode` — liên kết về Order (theo nguyên tắc ORDER-CENTRIC)

### 4.2 Log Levels — Khi nào dùng gì

| Level | Khi nào | Ví dụ |
|-------|---------|-------|
| **ERROR** | Exception không xử lý được, job thất bại, DB error, external API fail | `PaymentVoucher creation failed: insufficient balance` |
| **WARN** | Degradation, retry, SLA breach, validation fail từ client | `SLA BREACHED: order TBS-00001 in CONSULTING > 2h`, `Redis cache miss rate > 50%` |
| **INFO** | Business events thành công, FSM transition, user action | `Order TBS-00001 transitioned SOURCING -> WAREHOUSE_CN by user-456` |
| **DEBUG** | Chi tiết kỹ thuật — chỉ bật trong development | `Prisma query: SELECT * FROM "Order" WHERE id = $1 (2ms)` |

**Quy tắc quan trọng:**
- KHÔNG log PII (CMND, số điện thoại, địa chỉ) ở level INFO trở lên
- KHÔNG log JWT token, password, refresh token ở bất kỳ level nào
- MỌI FSM transition phải log ở INFO với orderId, fromStatus, toStatus, userId
- MỌI thao tác tài chính (tạo phiếu, approve, reject) phải log ở INFO

### 4.3 Correlation ID Flow

```
Client Request
    ↓
Nginx (thêm X-Request-ID nếu chưa có)
    ↓
RequestIdMiddleware (NestJS) → đặt vào AsyncLocalStorage
    ↓
ElkLoggerService → tự động đính kèm requestId vào mọi log
    ↓
BullMQ Jobs → propagate requestId vào job data
    ↓
Job Processors → log với requestId gốc
    ↓
Logstash → index vào Elasticsearch với field "requestId"
```

**Kibana query để trace một request:**
```
requestId: "req-550e8400-e29b-41d4-a716-446655440000"
```

### 4.4 Log Retention và Sampling

| Môi trường | Retention | Sampling |
|-----------|-----------|---------|
| Production | 30 ngày hot (ES), 1 năm cold (S3/GCS) | DEBUG: 1%, INFO+: 100% |
| Staging | 7 ngày | DEBUG: 10%, INFO+: 100% |
| Development | 1 ngày (local) | 100% tất cả |

**Volume estimation (production):**
- ~10,000 requests/ngày × 1KB/log = ~10MB/ngày application logs
- ~100,000 background jobs/ngày × 0.5KB = ~50MB/ngày job logs
- Nginx access logs: ~20MB/ngày
- **Tổng:** ~80MB/ngày → 2.4GB/tháng (trước compression)

### 4.5 Log Aggregation Pipeline (ELK)

```
NestJS (Winston TCP → Logstash :5000)
           ↓
    Logstash Pipeline
    ├── Grok/JSON parse
    ├── Enrich: GeoIP, user agent
    ├── Filter: drop health checks
    └── Route by level
           ↓
    Elasticsearch (index: tbs-erp-{YYYY.MM.DD})
           ↓
    Kibana (Discover, Dashboards, Alerting)
```

**Logstash filter quan trọng** (`monitoring/logstash/pipeline/backend.conf`):

```ruby
filter {
  # Parse JSON log
  json { source => "message" }

  # Drop health check noise
  if [path] == "/api/v1/health" or [path] == "/api/metrics" {
    drop {}
  }

  # Tag business events
  if [module] in ["order", "finance", "warehouse", "customs"] {
    mutate { add_tag => ["business_event"] }
  }

  # Tag security events
  if [context] == "AuthService" or [context] == "RbacGuard" {
    mutate { add_tag => ["security_event"] }
  }

  # Duration categorize
  if [durationMs] >= 1000 {
    mutate { add_tag => ["slow_request"] }
  }
}
```

---

## 5. Metrics Collection — Thu thập Metrics

### 5.1 Application Metrics (đã có trong MetricsService)

Tất cả metrics được expose tại `/api/metrics` (Prometheus text format).

**HTTP Metrics:**

| Metric | Type | Labels | Mục đích |
|--------|------|--------|---------|
| `http_requests_total` | Counter | method, route, status_code | Traffic và error rate |
| `http_request_duration_seconds` | Histogram | method, route | Latency SLO |
| `active_connections` | Gauge | - | Connection saturation |
| `slow_requests_total` | Counter | method, route | Requests > 1000ms |
| `http_response_size_bytes` | Histogram | method, route | Bandwidth usage |

**Database Metrics:**

| Metric | Type | Labels | Mục đích |
|--------|------|--------|---------|
| `database_query_duration_seconds` | Histogram | model, operation | DB latency SLO |
| `db_connections_active` | Gauge | - | Pool utilization |
| `db_connections_waiting` | Gauge | - | Pool exhaustion warning |
| `db_slow_queries_total` | Counter | - | Slow query detection |
| `db_replication_lag_bytes` | Gauge | client | Replication health |

**Business Metrics:**

| Metric | Type | Labels | Mục đích |
|--------|------|--------|---------|
| `orders_created_total` | Counter | branch, service_type | Business volume |
| `approval_pending_count` | Gauge | - | Approval bottleneck |
| `auth_login_attempts_total` | Counter | status | Security monitoring |
| `cache_hits_total` / `cache_misses_total` | Counter | - | Cache efficiency |

### 5.2 Business Metrics cần bổ sung (chưa có)

Cần thêm vào `MetricsService` để đủ coverage cho SLO:

```typescript
// Thêm vào MetricsService
readonly orderSLABreachTotal: client.Counter<string>;
readonly orderStatusTransitionTotal: client.Counter<string>;
readonly depositCollectedTotal: client.Counter<string>;
readonly bullmqJobDurationSeconds: client.Histogram<string>;
readonly bullmqQueueDepth: client.Gauge<string>;
readonly bullmqDLQSize: client.Gauge<string>;
readonly arBalanceVnd: client.Gauge<string>;
readonly cashflowInVnd: client.Counter<string>;
readonly cashflowOutVnd: client.Counter<string>;
readonly commissionPendingVnd: client.Gauge<string>;
```

**Prometheus metric definitions:**

```typescript
// Order SLA breach counter
this.orderSLABreachTotal = new client.Counter({
  name: 'tbs_order_sla_breach_total',
  help: 'Total order SLA breaches detected by SLAMonitorService',
  labelNames: ['type', 'status'],
  registers: [this.registry],
});

// FSM transition counter
this.orderStatusTransitionTotal = new client.Counter({
  name: 'tbs_order_status_transition_total',
  help: 'Total order FSM state transitions',
  labelNames: ['from_status', 'to_status', 'branch'],
  registers: [this.registry],
});

// BullMQ queue depth gauge
this.bullmqQueueDepth = new client.Gauge({
  name: 'bullmq_queue_waiting_jobs_total',
  help: 'Current number of waiting jobs per queue',
  labelNames: ['queue'],
  registers: [this.registry],
});

// BullMQ DLQ size
this.bullmqDLQSize = new client.Gauge({
  name: 'bullmq_queue_failed_jobs_total',
  help: 'Current number of failed jobs in DLQ per queue',
  labelNames: ['queue'],
  registers: [this.registry],
});
```

### 5.3 Infrastructure Metrics (via Exporters)

**PostgreSQL Exporter** (`postgres-exporter:9187`):

| Metric | Cảnh báo tại |
|--------|-------------|
| `pg_up` | 0 = Critical |
| `pg_stat_activity_count` | > 80 = Warning, > 90% max = Critical |
| `pg_stat_database_tup_fetched` | Trend tracking |
| `pg_stat_bgwriter_checkpoint_write_time_seconds` | Checkpoint performance |
| `pg_replication_lag` | > 10s = Warning |

**Redis Exporter** (`redis-exporter:9121`):

| Metric | Cảnh báo tại |
|--------|-------------|
| `redis_up` | 0 = Critical |
| `redis_memory_used_bytes` | > 80% max = Warning |
| `redis_connected_clients` | > 100 = Warning |
| `redis_rejected_connections_total` | > 0 = Critical |
| `redis_keyspace_hits_total` | Hit rate < 70% = Warning |

**Nginx Exporter** (`nginx-exporter:9113`):

| Metric | Mục đích |
|--------|---------|
| `nginx_connections_active` | Load monitoring |
| `nginx_http_requests_total` | Traffic volume |
| `nginx_connections_waiting` | Keepalive connections |

### 5.4 Prometheus Scrape Config bổ sung

Bổ sung vào `monitoring/prometheus/prometheus.yml`:

```yaml
scrape_configs:
  # ─── BullMQ metrics (nếu dùng bull-board metrics endpoint) ───
  - job_name: 'bullmq'
    static_configs:
      - targets: ['backend:3000']
        labels:
          service: 'bullmq'
    metrics_path: '/api/metrics'
    params:
      # Filter chỉ BullMQ metrics
      match[]: ['bullmq_*']
    scrape_interval: 30s

  # ─── Node Exporter (host metrics) ───
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
        labels:
          service: 'host'
    scrape_interval: 15s
```

### 5.5 Metric Retention Strategy

```yaml
# prometheus.yml — storage config
command:
  - '--storage.tsdb.retention.time=15d'    # Hot storage 15 ngày
  - '--storage.tsdb.retention.size=10GB'   # Max 10GB
  - '--storage.tsdb.wal-compression'       # Nén WAL
```

**Tiered retention (khuyến nghị với Thanos hoặc Grafana Mimir):**
- 0-15 ngày: Prometheus local (full resolution, 15s)
- 15-90 ngày: Thanos object storage (downsampled 5m)
- 90 ngày - 1 năm: Thanos (downsampled 1h)

---

## 6. Recommended Stack — Stack đề xuất

### 6.1 Stack hiện tại (đã có trong docker-compose.yml)

| Component | Version | Port | Mục đích |
|-----------|---------|------|---------|
| Prometheus | 2.50.0 | 9090 | Metric collection và alerting |
| Grafana | 10.3.0 | 3003 | Visualization, dashboards |
| Elasticsearch | 8.12.0 | 9200 | Log indexing và search |
| Logstash | 8.12.0 | 5000 | Log shipping pipeline |
| Kibana | 8.12.0 | 5601 | Log analysis UI |
| postgres-exporter | 0.15.0 | 9187 | PostgreSQL metrics |
| redis-exporter | 1.56.0 | 9121 | Redis metrics |
| nginx-exporter | 1.1.0 | 9113 | Nginx metrics |

### 6.2 Stack cần bổ sung

**Distributed Tracing — OpenTelemetry + Jaeger:**

Lý do cần: Khi một request qua NestJS → BullMQ → FinanceEventProcessor, hiện tại không thể trace end-to-end.

```yaml
# Bổ sung vào docker-compose.yml
jaeger:
  image: jaegertracing/all-in-one:1.53
  container_name: tbs_erp_jaeger
  restart: unless-stopped
  ports:
    - '16686:16686'   # Jaeger UI
    - '4317:4317'     # OTLP gRPC
    - '4318:4318'     # OTLP HTTP
  environment:
    COLLECTOR_OTLP_ENABLED: 'true'
    SPAN_STORAGE_TYPE: badger
    BADGER_EPHEMERAL: 'false'
    BADGER_DIRECTORY_VALUE: /badger/data
    BADGER_DIRECTORY_KEY: /badger/key
  volumes:
    - jaeger_data:/badger
  networks:
    - tbs_network
```

**NestJS OpenTelemetry setup:**

```typescript
// src/telemetry.ts — khởi tạo TRƯỚC khi import NestJS
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PrismaInstrumentation } from '@prisma/instrumentation';

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'tbs-erp-backend',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV,
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTLP_ENDPOINT || 'http://jaeger:4318/v1/traces',
  }),
  instrumentations: [
    new HttpInstrumentation(),
    new NestInstrumentation(),
    new PrismaInstrumentation(),
  ],
  // Head-based sampling: 100% errors, 10% normal traffic
  sampler: new ParentBasedSampler({
    root: new TraceIdRatioBased(
      process.env.NODE_ENV === 'production' ? 0.1 : 1.0
    ),
  }),
});

sdk.start();
```

**Uptime Monitoring — Uptime Kuma:**

```yaml
uptime-kuma:
  image: louislam/uptime-kuma:1
  container_name: tbs_erp_uptime_kuma
  restart: unless-stopped
  ports:
    - '3004:3001'
  volumes:
    - uptime_kuma_data:/app/data
  networks:
    - tbs_network
```

**Monitors cần thiết lập trong Uptime Kuma:**

| Monitor | URL | Interval | Alert |
|---------|-----|---------|-------|
| API Health | `https://api.tbs.vn/api/v1/health` | 60s | Slack + PagerDuty |
| Frontend ERP | `https://erp.tbs.vn` | 60s | Slack |
| Grafana | `https://grafana.tbs.vn/api/health` | 5m | Slack |
| Kibana | `https://kibana.tbs.vn/api/status` | 5m | Slack |

### 6.3 Kiến trúc Observability Stack Tổng quan

```
┌─────────────────────────────────────────────────────────┐
│                    TBS ERP Services                      │
│  NestJS Backend ──────────────────────────────────────  │
│     │ prom-client (/api/metrics)                        │
│     │ Winston TCP (→ Logstash)                          │
│     │ OTLP (→ Jaeger)                                   │
│     │ Sentry SDK (errors)                               │
└─────┼───────────────────────────────────────────────────┘
      │
      ├──────────────────────────────────────────────────────
      │                    METRICS PLANE
      │  Prometheus (scrape :15s) ──► Grafana (dashboards)
      │       │                           │
      │  postgres-exporter                └──► PagerDuty / Slack
      │  redis-exporter                        (Grafana Alerting)
      │  nginx-exporter
      │
      ├──────────────────────────────────────────────────────
      │                     LOGS PLANE
      │  Logstash (parse+enrich) ──► Elasticsearch ──► Kibana
      │
      ├──────────────────────────────────────────────────────
      │                    TRACES PLANE
      │  OTLP/HTTP ──► Jaeger ──► Jaeger UI
      │
      └──────────────────────────────────────────────────────
                         ERROR TRACKING
         Sentry (unhandled exceptions, performance)
```

### 6.4 Packages cần cài thêm (Backend)

```json
{
  "dependencies": {
    "@opentelemetry/sdk-node": "^0.48.0",
    "@opentelemetry/exporter-trace-otlp-http": "^0.48.0",
    "@opentelemetry/instrumentation-http": "^0.48.0",
    "@opentelemetry/instrumentation-nestjs-core": "^0.34.0",
    "@prisma/instrumentation": "^5.10.0"
  }
}
```

---

## 7. Runbook — Sổ tay xử lý sự cố

### 7.1 Runbook: API Down

**Alert:** `APIDown` — severity: critical
**SLO ảnh hưởng:** API Availability (toàn bộ error budget bị tiêu thụ)

**Bước điều tra:**
1. Kiểm tra container: `docker ps | grep tbs_erp_backend`
2. Xem logs: `docker logs tbs_erp_backend --tail 100`
3. Kiểm tra dependencies: `docker ps | grep -E "postgres|redis"`
4. Thử curl: `curl -sf http://localhost:3001/api/v1/health`
5. Kiểm tra disk: `df -h /` (nếu full → backend không ghi được logs → crash)

**Giải pháp thường gặp:**
- Container crashed → `docker compose restart backend`
- OOM killed → tăng memory limit trong docker-compose.yml
- DB connection fail → kiểm tra PostgreSQL, restart nếu cần
- Port conflict → `docker compose down && docker compose up -d`

**Escalation:** Nếu > 10 phút không khắc phục → escalate lên Tech Lead

---

### 7.2 Runbook: Database Connection Pool Exhausted

**Alert:** `DatabaseConnectionPoolExhausted`
**SLO ảnh hưởng:** Mọi database operations fail

**Bước điều tra:**
1. Kiểm tra connections: Grafana → Engineering Dashboard → DB Connection Pool
2. Query pg_stat_activity:
   ```sql
   SELECT state, count(*), wait_event_type, wait_event
   FROM pg_stat_activity
   WHERE datname = 'tbs_erp'
   GROUP BY state, wait_event_type, wait_event
   ORDER BY count(*) DESC;
   ```
3. Tìm idle in transaction lâu:
   ```sql
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
   FROM pg_stat_activity
   WHERE state = 'idle in transaction'
   AND (now() - query_start) > interval '5 minutes';
   ```
4. Kill connections idle quá lâu: `SELECT pg_terminate_backend(pid) WHERE ...`
5. Kiểm tra `DATABASE_CONNECTION_LIMIT` trong `.env`

---

### 7.3 Runbook: BullMQ DLQ High (finance-events)

**Alert:** `FinanceQueueDLQCritical`
**SLO ảnh hưởng:** Phân bổ chi phí vận hành bị gián đoạn

**Bước điều tra:**
1. Mở Bull Board: `http://localhost:3001/api/admin/queues`
2. Xem failed jobs trong queue `finance-events`
3. Kiểm tra error message của jobs thất bại
4. Tìm pattern: tất cả fail cùng lý do?

**Nguyên nhân thường gặp:**
- `Database constraint violation`: dữ liệu không nhất quán → cần manual fix
- `Redis connection timeout`: Redis bị overload → kiểm tra Redis metrics
- `Insufficient operation cost`: thiếu chi phí vận hành để phân bổ → thông báo ACCOUNTANT_COST

**Replay jobs (sau khi fix):**
```bash
# Qua Bull Board UI: chọn jobs → Retry
# Hoặc qua Redis CLI:
redis-cli -a $REDIS_PASSWORD
> LRANGE bull:finance-events:failed 0 -1
```

---

### 7.4 Runbook: SLA Breach Cao Bất thường

**Alert:** `OrderSLABreachHigh` (> 10 đơn vi phạm)

**Bước điều tra:**
1. Dashboard SLA Compliance → xem breach by type
2. Phần lớn là loại gì? (SOURCING? CUSTOMS? DELIVERING?)
3. Nếu SOURCING: liên hệ đội mua hàng Trung Quốc
4. Nếu CUSTOMS: kiểm tra `customs-declaration` module có lỗi không
5. Nếu DELIVERING: kiểm tra DRIVER assignments

**API để xem overdue SLAs:**
```
GET /api/v1/orders/sla/overdue
Authorization: Bearer {token}  [role: COO, SALES_DIRECTOR]
```

---

### 7.5 MTTD và MTTR Targets

| Sự cố | MTTD target | MTTR target |
|-------|------------|------------|
| API Down | < 2 phút | < 15 phút |
| DB Down | < 2 phút | < 30 phút |
| Redis Down | < 2 phút | < 15 phút |
| BullMQ DLQ spike | < 10 phút | < 60 phút |
| High error rate | < 5 phút | < 30 phút |
| SLA breach surge | < 30 phút | < 4 giờ |

---

## Phụ lục A: Tóm tắt Ports và URLs

| Service | Port | URL |
|---------|------|-----|
| Prometheus | 9090 | `http://localhost:9090` |
| Grafana | 3003 | `http://localhost:3003` |
| Kibana | 5601 | `http://localhost:5601` |
| Jaeger UI | 16686 | `http://localhost:16686` |
| Uptime Kuma | 3004 | `http://localhost:3004` |
| Bull Board | - | `http://localhost:3001/api/admin/queues` |
| Elasticsearch | 9200 | `http://localhost:9200` |

## Phụ lục B: Checklist triển khai Observability

- [ ] Prometheus scrape config đã bao gồm tất cả exporters
- [ ] Alert rules đã load vào Prometheus (`alerts.yml`)
- [ ] Alertmanager routing tới Slack và PagerDuty
- [ ] Grafana datasource Prometheus đã cấu hình
- [ ] 4 dashboards đã import (Executive, Operations, Engineering, Finance)
- [ ] ELK pipeline test: log từ backend vào Elasticsearch
- [ ] Kibana index pattern `tbs-erp-*` đã tạo
- [ ] OpenTelemetry SDK tích hợp backend
- [ ] Jaeger traces hiển thị đúng span hierarchy
- [ ] Uptime Kuma monitors cho tất cả public endpoints
- [ ] `tbs_order_sla_breach_total` metric được emit từ SLAMonitorService
- [ ] `bullmq_queue_waiting_jobs_total` và `bullmq_queue_failed_jobs_total` được emit
- [ ] Business metrics mới đã thêm vào MetricsService
- [ ] Log retention policy đã cấu hình trong ILM (Elasticsearch)
- [ ] Runbooks đã publish lên internal wiki
