# TBS ERP - Kubernetes Deployment

Kubernetes deployment manifests for the TBS ERP system using Kustomize for environment-specific configuration management.

## Architecture Overview

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| Backend | `ghcr.io/tbs-logistics/tbs-erp-backend` | 3000 | NestJS API server |
| ERP Frontend | `ghcr.io/tbs-logistics/tbs-erp-frontend` | 3000 | Next.js ERP dashboard |
| CMS Frontend | `ghcr.io/tbs-logistics/tbs-cms-frontend` | 3000 | Next.js public CMS |
| PostgreSQL | `postgres:16-alpine` | 5432 | Primary database |
| Redis | `redis:7-alpine` | 6379 | Cache and session store |

## Prerequisites

Before deploying, ensure the following tools and components are available:

### Local Tools
- **kubectl** >= 1.28
- **kustomize** >= 5.0 (or use `kubectl -k`)
- **helm** (optional, for installing cluster components)

### Cluster Components
- **NGINX Ingress Controller**: Handles external traffic routing
  ```bash
  helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
  helm install ingress-nginx ingress-nginx/ingress-nginx -n ingress-nginx --create-namespace
  ```
- **cert-manager**: Automated TLS certificate management with Let's Encrypt
  ```bash
  helm repo add jetstack https://charts.jetstack.io
  helm install cert-manager jetstack/cert-manager -n cert-manager --create-namespace --set installCRDs=true
  ```
- **Metrics Server**: Required for HPA (Horizontal Pod Autoscaler) to function
  ```bash
  kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
  ```

### cert-manager ClusterIssuers

Create the Let's Encrypt issuers after installing cert-manager:

```yaml
# letsencrypt-staging (for testing)
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: devops@tbslogistics.com
    privateKeySecretRef:
      name: letsencrypt-staging-key
    solvers:
      - http01:
          ingress:
            class: nginx
---
# letsencrypt-prod (for production)
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: devops@tbslogistics.com
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
      - http01:
          ingress:
            class: nginx
```

## Directory Structure

```
k8s/
├── base/                          # Base manifests (shared across environments)
│   ├── kustomization.yaml
│   ├── namespace.yaml
│   ├── backend/
│   │   ├── deployment.yaml        # 2 replicas, rolling update
│   │   ├── service.yaml           # ClusterIP + ConfigMap
│   │   └── hpa.yaml               # CPU 70%, Memory 80%, 2-8 replicas
│   ├── erp-frontend/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── hpa.yaml
│   ├── cms-frontend/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── hpa.yaml
│   ├── postgres/
│   │   ├── statefulset.yaml       # Single instance with PVC
│   │   ├── service.yaml           # Headless service
│   │   ├── pvc.yaml               # Backup PVC
│   │   └── configmap.yaml         # DB config + tuning params
│   ├── redis/
│   │   ├── deployment.yaml
│   │   ├── service.yaml           # Service + data PVC
│   │   └── configmap.yaml
│   ├── ingress/
│   │   └── ingress.yaml           # NGINX ingress with TLS
│   └── secrets/
│       └── sealed-secret.yaml     # Secret TEMPLATE (placeholders only)
├── overlays/
│   ├── dev/                       # 1 replica, low resources, no TLS
│   ├── staging/                   # 1 replica, medium resources, staging hosts
│   └── production/                # 2+ replicas, full resources, PDB, NetworkPolicy
└── README.md
```

## Quick Start

### Development

```bash
# Preview what will be applied
kubectl kustomize k8s/overlays/dev

# Apply to cluster
kubectl apply -k k8s/overlays/dev

# Verify deployment
kubectl get all -n tbs-erp-dev
```

### Staging

```bash
# Preview
kubectl kustomize k8s/overlays/staging

# Apply
kubectl apply -k k8s/overlays/staging

# Verify
kubectl get all -n tbs-erp-staging
```

### Production

```bash
# IMPORTANT: Create secrets FIRST before applying (see Secrets Management below)

# Preview the full manifest
kubectl kustomize k8s/overlays/production > /tmp/production-manifest.yaml
# Review the output carefully before applying

# Apply
kubectl apply -k k8s/overlays/production

# Verify all resources
kubectl get all,ingress,pdb,networkpolicy -n tbs-erp
```

## Secrets Management

Secrets are stored as placeholder templates in `base/secrets/sealed-secret.yaml`. **Never commit real secrets to git.**

### Option 1: Manual Secret Creation (Simplest)

```bash
# Create the main application secret
kubectl create secret generic tbs-erp-secrets \
  --from-literal=DATABASE_URL='postgresql://tbs_user:STRONG_PASSWORD@tbs-postgres:5432/tbs_erp' \
  --from-literal=JWT_SECRET='your-jwt-secret-minimum-32-characters-long' \
  --from-literal=JWT_REFRESH_SECRET='your-jwt-refresh-secret-minimum-32-characters' \
  --from-literal=SENTRY_DSN='https://your-key@sentry.io/project-id' \
  -n tbs-erp

# Create the PostgreSQL secret
kubectl create secret generic tbs-postgres-secrets \
  --from-literal=POSTGRES_USER='tbs_user' \
  --from-literal=POSTGRES_PASSWORD='STRONG_PASSWORD' \
  -n tbs-erp

# Create the GitHub Container Registry pull secret
kubectl create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USERNAME \
  --docker-password=YOUR_GITHUB_PAT \
  -n tbs-erp
```

### Option 2: Sealed Secrets (Recommended for GitOps)

```bash
# Install Sealed Secrets controller
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm install sealed-secrets sealed-secrets/sealed-secrets -n kube-system

# Encrypt a secret
kubeseal --format yaml < my-secret.yaml > my-sealed-secret.yaml

# The sealed secret can be safely committed to git
```

### Option 3: External Secrets Operator

For cloud-native secret management (AWS Secrets Manager, HashiCorp Vault):

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets --create-namespace
```

## Scaling

### Manual Scaling

```bash
# Scale backend to 4 replicas
kubectl scale deployment tbs-backend --replicas=4 -n tbs-erp

# Scale ERP frontend
kubectl scale deployment tbs-erp-frontend --replicas=3 -n tbs-erp
```

### Automatic Scaling (HPA)

HPA is configured in production and staging. View current autoscaler status:

```bash
# Check HPA status
kubectl get hpa -n tbs-erp

# Describe HPA for details
kubectl describe hpa tbs-backend-hpa -n tbs-erp

# Watch HPA in real-time
kubectl get hpa -n tbs-erp -w
```

**HPA Configuration (Production):**

| Service | Min | Max | CPU Target | Memory Target |
|---------|-----|-----|------------|---------------|
| Backend | 2 | 8 | 70% | 80% |
| ERP Frontend | 2 | 6 | 75% | 80% |
| CMS Frontend | 2 | 6 | 75% | 80% |

**Scale-up behavior:** Up to 2 pods added per 60 seconds, with a 60-second stabilization window.
**Scale-down behavior:** 1 pod removed per 120 seconds, with a 300-second stabilization window (prevents flapping).

## Environment Differences

| Feature | Dev | Staging | Production |
|---------|-----|---------|------------|
| Replicas | 1 | 1 | 2+ (HPA managed) |
| Backend CPU limit | 500m | 1000m | 2000m |
| Backend memory limit | 512Mi | 512Mi | 1Gi |
| Frontend CPU limit | 250m | 500m | 1000m |
| PostgreSQL storage | 50Gi | 50Gi | 100Gi (SSD) |
| HPA | min 1, max 2 | min 1, max 3 | min 2, max 8 |
| TLS | No | Yes (staging issuer) | Yes (prod issuer) |
| PodDisruptionBudget | No | No | Yes |
| NetworkPolicy | No | No | Yes |
| Namespace | tbs-erp-dev | tbs-erp-staging | tbs-erp |

## Monitoring and Observability

### Check Pod Health

```bash
# List all pods and their status
kubectl get pods -n tbs-erp -o wide

# Check pod logs
kubectl logs -f deployment/tbs-backend -n tbs-erp

# Check previous container logs (after a crash)
kubectl logs deployment/tbs-backend -n tbs-erp --previous

# Stream logs from all backend pods
kubectl logs -f -l app.kubernetes.io/name=tbs-backend -n tbs-erp --all-containers
```

### Resource Usage

```bash
# View resource consumption
kubectl top pods -n tbs-erp

# View node-level resources
kubectl top nodes
```

### Debugging

```bash
# Describe a pod for events
kubectl describe pod <pod-name> -n tbs-erp

# Execute into a running container
kubectl exec -it deployment/tbs-backend -n tbs-erp -- /bin/sh

# Port-forward for local access
kubectl port-forward svc/tbs-backend 3000:3000 -n tbs-erp

# Check ingress status
kubectl describe ingress tbs-erp-ingress -n tbs-erp
```

## Troubleshooting

### Pods Stuck in Pending

```bash
# Check events for scheduling issues
kubectl describe pod <pod-name> -n tbs-erp | grep -A 10 Events

# Common causes:
# - Insufficient cluster resources: check kubectl top nodes
# - PVC not bound: check kubectl get pvc -n tbs-erp
# - Image pull failure: check imagePullSecrets
```

### Pods CrashLoopBackOff

```bash
# Check container logs
kubectl logs <pod-name> -n tbs-erp --previous

# Common causes:
# - Missing environment variables / secrets
# - Database connection failure (PostgreSQL not ready)
# - Application startup error
```

### Database Connection Issues

```bash
# Verify PostgreSQL is running
kubectl get pods -l app.kubernetes.io/name=tbs-postgres -n tbs-erp

# Check PostgreSQL logs
kubectl logs statefulset/tbs-postgres -n tbs-erp

# Test connection from backend pod
kubectl exec -it deployment/tbs-backend -n tbs-erp -- \
  sh -c 'wget -qO- http://localhost:3000/api/v1/health'
```

### Ingress Not Working

```bash
# Verify ingress controller is running
kubectl get pods -n ingress-nginx

# Check ingress resource
kubectl describe ingress tbs-erp-ingress -n tbs-erp

# Check TLS certificate status
kubectl get certificates -n tbs-erp
kubectl describe certificate tbs-erp-production-tls -n tbs-erp

# Check cert-manager logs
kubectl logs -l app=cert-manager -n cert-manager
```

### HPA Not Scaling

```bash
# Check metrics server
kubectl get apiservice v1beta1.metrics.k8s.io

# Verify metrics are available
kubectl top pods -n tbs-erp

# Check HPA conditions
kubectl describe hpa tbs-backend-hpa -n tbs-erp
```

## Rollback

```bash
# View rollout history
kubectl rollout history deployment/tbs-backend -n tbs-erp

# Rollback to previous revision
kubectl rollout undo deployment/tbs-backend -n tbs-erp

# Rollback to a specific revision
kubectl rollout undo deployment/tbs-backend --to-revision=2 -n tbs-erp

# Check rollout status
kubectl rollout status deployment/tbs-backend -n tbs-erp
```

## Database Backup (PostgreSQL)

For production, consider running backup CronJobs:

```bash
# Manual backup
kubectl exec statefulset/tbs-postgres -n tbs-erp -- \
  pg_dump -U tbs_user tbs_erp | gzip > backup-$(date +%Y%m%d).sql.gz

# Restore from backup
gunzip -c backup-20260216.sql.gz | \
  kubectl exec -i statefulset/tbs-postgres -n tbs-erp -- \
  psql -U tbs_user tbs_erp
```

For automated backups, consider using [CronJob](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/) or a dedicated PostgreSQL operator like [CloudNativePG](https://cloudnative-pg.io/).

## Production Recommendations

1. **Use a managed database**: For production workloads, consider AWS RDS, Google Cloud SQL, or Azure Database for PostgreSQL instead of running PostgreSQL in-cluster. Update `DATABASE_URL` in the secret to point to the managed instance.

2. **Use a managed Redis**: Consider AWS ElastiCache, Google Memorystore, or Azure Cache for Redis. Update `REDIS_HOST` in the backend environment configuration.

3. **Enable pod monitoring**: Install Prometheus and Grafana for comprehensive monitoring. Backend pods include Prometheus scrape annotations.

4. **Set up alerting**: Configure alerts for pod restarts, high CPU/memory usage, and failed health checks.

5. **Use GitOps**: Consider ArgoCD or Flux for automated, declarative deployments from this repository.

6. **Image tags**: Replace `:latest` with specific image tags (e.g., `:v1.2.3` or `:sha-abc123`) in production for reproducible deployments.
