# Loonaris — What's Missing

> Honest assessment of everything that is not yet built, not yet deployed, or not yet wired up. Updated 2026-05-31.

---

## 0. Status

**What's already built/deployed/verified lives in [DONE.md](./DONE.md)** (gateway deployed,
auth-terminating proxy, CNPG poolers, shared password, provisioning E2E, admin API, etc.).
This file tracks only what's **still missing**.

### Priorities — focus on the BASICS

**In scope (the core database loop):**
1. Tenant dashboard wiring — show the `sk_live_` key once after create, display the connection string, and poll status `provisioning → running`.
2. Verify create/list/delete flow works through the real API (not mock data).
3. Infra basics: bigger-`max-pods` tenant node group → `instances:2` so the RO path works; durable provisioning status (replace the in-memory poll).

**Explicitly OUT OF SCOPE for now (do not invest):** billing/payments, usage metering, email verification, password reset.

---

## 1. API Gaps

### 1.1. Cluster CRUD — Missing Endpoints & Features

| Gap | Detail | Status |
|---|---|---|
| `POST /api/clusters` returns `apiKey` but frontend doesn't display it | The newly generated `sk_live_` key is returned in the create response but the frontend has no UI to show it or copy it | **Not built** |
| `PATCH /api/clusters/:id` (update cluster) | No endpoint to resize, change tier, or update config after creation | **Not built** |
| `POST /api/clusters/:id/start` and `POST /api/clusters/:id/stop` | No way to start/stop a cluster (would need K8s scaling to 0 and back) | **Not built** |
| `POST /api/clusters/:id/api-keys` (rotate keys) | No endpoint to generate new API keys or revoke old ones. The `ApiKey` model has `revoked_at` but no controller uses it | **Not built** |
| `GET /api/clusters/:id/api-keys` (list keys) | No way for the user to see their key prefixes or revoke them | **Not built** |
| Cluster status polling from frontend | After `POST /api/clusters` returns 202, the frontend has no polling mechanism to show provisioning progress → running | **Not built** |
| Connection string display | Frontend should show `psql` or JDBC connection strings using the `sk_live_` key. No component generates or displays these | **Not built** |

### 1.2. Auth — Partial

| Gap | Detail | Status |
|---|---|---|
| Email verification | Signup creates a user immediately, no email confirmation flow | **Deferred (out of scope)** — not a priority |
| Password reset | No forgot-password or reset-password endpoint | **Deferred** — not a priority |
| Token refresh flow | `POST /auth/refresh-token` exists in routes but may not be fully tested end-to-end | **Needs testing** |

### 1.3. Billing & Metering — OUT OF SCOPE (deferred)

> **Not a priority.** Billing and usage metering are explicitly deferred — we're focusing on the basics (create/connect/manage a database). Do not invest here yet.

| Gap | Detail | Status |
|---|---|---|
| Billing integration | No Stripe or payment integration. `Project.estimatedPrice` is computed but nothing charges the user | **Deferred (out of scope)** |
| Usage metering | `Project.cpuUsage`, `ramUsage`, `storageUsage` fields exist in the schema but nothing populates them | **Deferred (out of scope)** |

---

## 2. Frontend Gaps

| Gap | Detail | Status |
|---|---|---|
| Cluster creation form | Wired to `POST /api/clusters`. **dev1:** removed fake per-plan CPU/RAM specs (one fixed pod limit now), removed the fake `*.db.ourplatform.com` connection preview, and the region is display-only **`eu-west-3`** (only supported region; backend rejects others with 400). Plan cards show name + price + storage only. | **Honest** |
| Cluster detail page | `DatabaseDetailPage.jsx` and `DatabaseMetricsTab.jsx` show UI but metrics data is likely hardcoded/mock | **Mock data** |
| API key display | After cluster creation, the frontend must show the `sk_live_` key to the user **once** (it won't be shown again) | **Not built** |
| Connection parameters UI | `ConnectionParameters.jsx` component exists but likely not connected to real data | **Needs verification** |
| Cluster status real-time updates | No WebSocket or polling to show provisioning → running transitions | **Not built** |
| Billing/settings pages | `Billing.jsx` and `SettingsPage.jsx` exist but are likely stubs | **Stubs** |

---

## 3. Deployment & Infra Gaps

> EKS, CNPG, EBS CSI, NLB, gateway deploy, ECR, secrets, and the Pooler migration are **done** — see [DONE.md](./DONE.md). Remaining:

| Gap | Detail | Status / Priority |
|---|---|---|
| Tenant node `max-pods` | Tenant `t2.small` nodes are capped at `max-pods=11` despite prefix delegation (kubelet `--max-pods` not raised). Forces `instances:1` (RO path has no replica). Fix: new tenant node group with a launch template (`--max-pods ~110`), then set provisioning back to `instances:2`. Managed node groups can't add a launch template in place → create a new node group + migrate | **Basics** |
| Durable provisioning status | The CNPG health poll is **in-memory** in the ECS task that handled the POST — a task restart strands a tenant in `provisioning`. Replace with a CNPG watch or a periodic re-sync of `Project.status` from live cluster state | **Basics** |
| Fargate vCPU quota | Quota = 4; backend runs lean during deploys. Increase requested | **Nice to have** |
| GitOps / ArgoCD | Not set up. We deploy via GitHub Actions (`backend-deploy.yml`, `frontend-deploy.yml`, gateway `docker.yml`→ECR). ArgoCD + a `k8s-manifests` repo are optional future work | **Optional** |

---

## 5. Cluster Creation Runtime Gaps

| Gap | Detail | Status |
|---|---|---|
| CNPG pod resource limits | **dev1:** every `instance-db` pod now sets `resources.limits` = `cpu 500m / memory 1Gi` (no requests), identical for all plans/tenants, so no tenant can starve the shared tenant nodes. Previously pods had NO limits. | **Fixed** |
| `provisionCluster()` now uses `KubeConfig.loadFromOptions()` with AWS auth provider | The `@kubernetes/client-node` client authenticates via Account 2 IAM user credentials from env vars. No kubeconfig file needed. | **Fixed** |
| No error handling for partial K8s applies | If the Namespace is created but CNPG apply fails, the namespace is left orphaned. No rollback/cleanup mechanism | **Not built** |
| No timeout on K8s API calls | The `@kubernetes/client-node` client uses default timeouts. Slow EKS API responses could hang the request | **Not configured** |
| Provisioning is synchronous | `createCluster()` blocks for up to 5 minutes while polling CNPG health. This will hold the HTTP connection open and may trigger ALB timeouts. Should be made async with a status polling endpoint | **Architectural issue** |
| Generated passwords stored in plain K8s Secrets | The database password is generated in the Express backend and passed to K8s Secrets as `stringData`. Should use Sealed Secrets or external secrets management | **Security concern** |
| No project cleanup on provisioning failure | If provisioning fails, the Project record stays in `"error"` status but K8s resources may be partially created. No cleanup job or reconciliation loop exists | **Not built** |

---

## 6. Security Gaps

| Gap | Detail | Status |
|---|---|---|
| Gateway has no TLS | The gateway rejects SSL requests (`'N'` response). All DB traffic is unencrypted inside the EKS VPC. For production, SSL passthrough or TLS termination should be considered | **MVP only** |
| No rate limiting on `/api/internal/routes` | The gateway endpoint has no rate limiting. A malicious or buggy gateway could DDoS the backend | **Not built** |
| No network policies in K8s | The provisioning docs explicitly skip NetworkPolicies, relying on namespace isolation only. Tenant-to-tenant network access within EKS is not blocked | **Skipped by design** (may revisit) |
| K8s Secrets are base64-encoded, not encrypted | The `app-db-credentials` Secret is stored as plain `stringData` in etcd. Should use Sealed Secrets, AWS Secrets Manager, or encryption at rest | **Not hardened** |
| `INTERNAL_GATEWAY_SECRET` is a shared static secret | No key rotation mechanism exists. If the secret leaks, it must be manually rotated in both the gateway K8s Secret and the ECS task environment | **No rotation** |

---

## 7. Database & Schema Gaps

| Gap | Detail | Status |
|---|---|---|
| Pooler schema migration | New columns `rw_host`, `rw_port`, `ro_host`, `ro_port` replace old `rw_pooler_link`, `ro_pooler_link`. Migration `20260531000500_fix_schema_drift` created (via `prisma migrate dev`) and committed; applied by CI/CD `prisma migrate deploy` on next backend deploy | **Created — applies via CI/CD** |
| Seed data uses old format | `prisma/seed.ts` updated in code but not re-run against production. Old seed data still has connection-string format | **Needs re-seed** |
| No indexing strategy | `api_keys.key_hash` has a unique index (good for lookups), but no composite indexes exist for common query patterns (e.g., `ApiKey` + `Project` + `Pooler` join) | **Performance concern** |
| No connection pooling in backend | The Express backend uses a single Prisma client. Under high load from gateway route lookups, connection pooling via PgBouncer or Prisma connection limits should be considered | **Not configured** |

---

## 8. Monitoring & Observability Gaps

| Gap | Detail | Status |
|---|---|---|
| No logging pipeline | No ELK, CloudWatch Logs, or Loki integration. Gateway and backend logs go to stdout only | **Not built** |
| No metrics | No Prometheus, Grafana, or CloudWatch metrics. No visibility into gateway cache hit rates, connection counts, or provisioning latency | **Not built** |
| No alerting | No PagerDuty, Slack, or SNS alerts for provisioning failures, gateway errors, or EKS node issues | **Not built** |
| No distributed tracing | No OpenTelemetry or X-Ray. Cannot trace a request from frontend → backend → EKS API → CNPG | **Not built** |

---

## 9. Testing Gaps

| Gap | Detail | Status |
|---|---|---|
| No backend unit tests | The Express backend has no test files (`*.test.ts`, `*.spec.ts`) for any module (auth, clusters, internal, provisioning) | **Not built** |
| No backend integration tests | No test harness for the internal routes endpoint, key generation, or provisioning flow | **Not built** |
| No E2E tests | No Playwright, Cypress, or similar tests for the frontend | **Not built** |
| Gateway tests pass locally | All 19 Go tests pass. Docker compose e2e verified with 3 tenants × 2 modes | **Working** |
| Provisioning code untested against real EKS | `provisionCluster()` has never been run against a real EKS cluster. Only the TypeScript compiles — no integration test exists | **Untested** |

---

## 10. Documentation Gaps

| Gap | Detail | Status |
|---|---|---|
| No API reference documentation | Swagger/OpenAPI spec exists (`config/openapi.ts`) but may not cover the new `/api/internal` routes | **Needs update** |
| No runbook for EKS provisioning | No step-by-step guide for creating the EKS cluster, installing CNPG operator, or setting up node groups | **Not written** |
| No disaster recovery plan | No documentation for what happens if RDS goes down, EKS goes down, or the gateway crashes mid-connection | **Not written** |