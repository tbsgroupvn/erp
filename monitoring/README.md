# TBS ERP - Monitoring Stack

Prometheus + Grafana + exporters as a separate Docker Compose overlay
that attaches to the existing dev network.

## Prerequisites

The core dev stack must be running before starting monitoring:

```bash
# Windows
.\start.ps1

# or directly
docker compose -p tbs-dev -f docker-compose.dev.yml up -d
```

## Quick Start

```bash
docker compose -f docker-compose.monitoring.yml up -d
```

## Access

| Service    | URL                          | Credentials   |
|------------|------------------------------|---------------|
| Prometheus | http://localhost:9090        | none          |
| Grafana    | http://localhost:3003        | admin / admin |

## Stop

```bash
docker compose -f docker-compose.monitoring.yml down
```

To also remove the persistent volumes (wipes all metrics history):

```bash
docker compose -f docker-compose.monitoring.yml down -v
```

## Architecture

```
Prometheus (9090)
  scrapes ->  backend:3000/api/v1/metrics   (NestJS prom-client)
  scrapes ->  node-exporter:9100            (host OS metrics)
  scrapes ->  postgres-exporter:9187        (PostgreSQL stats)
  scrapes ->  redis-exporter:9121           (Redis stats)

Grafana (3003)
  reads  ->  Prometheus (auto-provisioned datasource)
  loads  ->  monitoring/grafana/dashboards/*.json (auto-provisioned)
```

## Network

All monitoring containers join the external Docker network `tbs-dev_tbs_dev`,
which is created by the dev compose stack (`docker compose -p tbs-dev`).
This allows Prometheus to reach `backend`, `postgres`, and `redis` containers
by their service names without exposing additional ports.

If you started the dev stack without `--project-name tbs-dev`, the network
name will differ. Check the actual name with:

```bash
docker network ls | grep tbs
```

Then update the `networks.tbs_dev.name` value in `docker-compose.monitoring.yml`.

## Metrics Endpoint

The NestJS backend exposes Prometheus metrics at:

```
GET /api/v1/metrics   (public, no auth required, @SkipThrottle)
GET /api/v1/metrics/jobs  (BullMQ job queue stats as JSON)
```

Access from host (when dev stack is running):

```bash
curl http://localhost:3001/api/v1/metrics
```

## Exporters

| Exporter           | Image                                        | Port  |
|--------------------|----------------------------------------------|-------|
| node-exporter      | prom/node-exporter:v1.7.0                    | 9100  |
| postgres-exporter  | prometheuscommunity/postgres-exporter:v0.15.0| 9187  |
| redis-exporter     | oliver006/redis_exporter:v1.58.0             | 9121  |

Exporter ports are not published to the host - they are only reachable by
Prometheus on the internal `tbs-dev_tbs_dev` Docker network.

## Dashboards

Pre-built dashboards are in `monitoring/grafana/dashboards/`:
- `tbs-erp-dashboard.json` - HTTP, DB, cache, business metrics
- `tbs-security-dashboard.json` - auth failures, rate limits

Grafana loads them automatically via the dashboard provisioner in
`monitoring/grafana/provisioning/dashboards/dashboards.yml`.

Changes made in the Grafana UI are persisted to the `tbs_dev_grafana_data`
Docker volume (not written back to the JSON files on disk).

## Alert Rules

Prometheus alert rules are defined in `monitoring/prometheus/alerts.yml`:
- Service availability (any target down > 1m)
- HTTP 5xx error rate > 5%
- p95 latency > 2s
- Node.js memory > 85% of 1 GB
- Event loop lag > 500ms
- PostgreSQL connection count > 80
- Redis memory > 90%
- Business alerts (login failure rate, pending approvals)

## Environment Variables

Override defaults via `.env` in the project root:

| Variable               | Default         | Description                     |
|------------------------|-----------------|---------------------------------|
| PROMETHEUS_PORT        | 9090            | Host port for Prometheus UI     |
| GRAFANA_PORT           | 3003            | Host port for Grafana UI        |
| GRAFANA_ADMIN_PASSWORD | admin           | Grafana admin password          |
| POSTGRES_USER          | tbs_user        | Used by postgres-exporter DSN   |
| POSTGRES_PASSWORD      | tbs_password    | Used by postgres-exporter DSN   |
| POSTGRES_DB            | tbs_erp         | Used by postgres-exporter DSN   |
| REDIS_PASSWORD         | dev_redis_pass  | Used by redis-exporter auth     |
