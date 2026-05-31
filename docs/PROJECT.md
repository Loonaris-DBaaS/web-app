# Loonaris — What We Have

> Current, accurate project overview. Updated 2026-05-31. For the doc index see [README.md](./README.md).

## 1. What Loonaris is

A multi-tenant **Database-as-a-Service**. Users sign up on the dashboard, create
isolated PostgreSQL clusters, and connect to them with an `sk_live_` API key
through a single internet-facing endpoint. Each tenant gets its own Kubernetes
namespace with a CloudNativePG (CNPG) Postgres cluster and CNPG poolers.

## 2. Components

| Component | Repo / path | Tech | Where it runs |
|---|---|---|---|
| **Control plane** (API + provisioning) | `web-app/backend` | TS, Express, Prisma | ECS Fargate, Account 1 |
| **Dashboard** | `web-app/frontend` | React + Vite | Nginx EC2 (`/var/www/frontend`), Account 1 |
| **DB Gateway** | `db-gateway` | Go | EKS `system-plane`, Account 2 |
| **Tenant DBs** | provisioned per tenant | CNPG Postgres + CNPG Poolers | EKS `tenant-ng`, Account 2 |

## 3. How a connection flows (end-to-end, verified)

```
psql  user=sk_live_<hash>_rw  (no DB password)  sslmode=disable
  → NLB (internet-facing, eu-west-3)            ← connect via the NLB hostname directly (no DNS alias)
  → db-gateway pod
       • parse key → GET /api/internal/routes/<hash> (control plane) → {pooler host/port, status}
       • status must be "active" (Project.status == running)
       • AUTH-TERMINATING: accept the client (the key IS the credential),
         then open its OWN authenticated connection to the pooler as the
         shared internal user (SCRAM), and splice the sockets
  → pooler-rw / pooler-ro  (CNPG-native Pooler, auth_query)
  → instance-db Postgres (scram-sha-256)
```

**Auth model:** tenants only ever hold their `sk_live_` key. There is a single
**internal DB password** (Secrets Manager `loonaris/internal-db-password`) shared
by every tenant's `cloud_user`; tenants never see it. The gateway holds it and
authenticates to the pooler on the tenant's behalf.

## 4. How a tenant is provisioned

```
POST /api/clusters (JWT)
  → create Project (status=provisioning), generate sk_live_ key (store SHA-256 hash),
    persist Pooler row (pooler-rw/ro hostnames), return 202
  → background: apply K8s manifests to EKS (cross-account, in-process EKS token):
       Namespace, app-db-credentials Secret (basic-auth, shared password),
       CNPG Cluster (instances=1), Pooler CRs (pooler-rw type rw, pooler-ro type ro)
  → poll CNPG .status.phase until "Cluster in healthy state" → set Project.status=running
```

## 5. Live state (2026-05-31)

| Item | State |
|---|---|
| db-gateway | EKS `system-plane`, image in Account 2 ECR; reachable via internet-facing NLB |
| NLB host | `ab571a35c49414eaab905fc43405b7fb-9f85c871b90b857f.elb.eu-west-3.amazonaws.com:5432` |
| Backend | ECS service, task def rev 36 (admin API + redesign), `desired=2` |
| Dashboard | live at `loonaris.tech`; admin page at `loonaris.tech/admin` |
| CNPG operator + gp3 StorageClass | installed |
| E2E test | ✅ 3 tenants: RW connect/write + isolation verified; RO pending `instances:2` |

## 6. APIs

- **Tenant** (JWT): `POST/GET/PATCH/DELETE /api/clusters`, `/api/auth/*`.
- **Internal** (Bearer `INTERNAL_GATEWAY_SECRET`): `GET /api/internal/routes/:keyHash` (gateway route lookup).
- **Admin** (⚠️ unauthenticated for now — testing): `GET /api/admin/clusters` (all tenants), `DELETE /api/admin/clusters/:id`. Backed by the `/admin` dashboard page.

## 7. Decisions in effect

- **No `db.loonaris.tech` CNAME** — clients connect to the NLB hostname directly.
- **TLS disabled** on the gateway (ship fast); clients use `sslmode=disable`/`prefer`.
- **No NetworkPolicy** — gateway is unrestricted/internet-facing.
- **`instances: 1`** per tenant (temporary — see constraints).
- **Single shared internal DB password** (gateway-held; tenants never receive it).
- **Admin API unauthenticated** for now (add `isAdmin`+JWT before exposing).

## 8. Known constraints (and the fix)

- **Tenant nodes capped at `max-pods=11`** despite prefix delegation (kubelet
  `--max-pods` never raised). → forces `instances:1`; RO path has no replica.
  Fix = new tenant node group with a launch template (`--max-pods ~110`), then
  back to `instances:2`. See [GAPS.md](./GAPS.md).
- **Fargate vCPU quota = 4** → backend kept lean on deploys (quota increase pending).
- **Provisioning poll is in-memory** in the ECS task that handled the POST — no
  durable reconciler; a task restart mid-provision can strand a tenant in
  `provisioning`. Replace with a CNPG watch / periodic re-sync.

## 9. Where to look in code
- Gateway proxy/auth: `db-gateway/internal/gateway/tunnel.go`, `session.go`, `api.go`, `cache.go`.
- Provisioning: `web-app/backend/src/modules/pgCluster/provisioning/provisioning.ts`.
- Cluster service: `web-app/backend/src/modules/pgCluster/services/pgCluster.service.ts`.
- Route lookup: `web-app/backend/src/modules/internal/services/internal.service.ts`.
- Admin: `web-app/backend/src/modules/admin/`, `web-app/frontend/src/pages/Admin/Admin.jsx`.
