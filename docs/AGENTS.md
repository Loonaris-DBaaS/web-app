# Loonaris Platform — Agent Context

> This file is the single entry point for any AI agent working in this monorepo.
> Read it FIRST before touching any code. It maps every subsystem, every doc, and every convention.

> ⚠️ **Current state (2026-05-31): see [PROJECT.md](./PROJECT.md) first.** Since this
> file was written the system changed materially — read [PROJECT.md](./PROJECT.md)
> for the truth and treat the sections below as background. Key deltas:
> - **Gateway is an auth-terminating proxy** (not a blind TCP tunnel): it validates
>   the `sk_live_` key, then opens its OWN SCRAM-authenticated connection to the
>   pooler as a single shared internal `cloud_user` (tenants hold no DB password).
> - **Poolers are CNPG-native `Pooler` CRs** named `pooler-rw` / `pooler-ro`
>   (service FQDN `pooler-rw.<ns>.svc.cluster.local`), replacing edoburu pgbouncer.
> - **No `db.loonaris.tech`** — connect to the NLB hostname directly.
> - **CNPG health phase string is** `Cluster in healthy state` (not `Healthy`).
> - **Node groups use nodeSelector, NO taints**; tenant nodes are `max-pods=11` so
>   tenants currently run `instances:1`.
> - **Admin API** `/api/admin/clusters` (+ `/admin` dashboard), unauthenticated for now.

---

## 0. Agent Duty — Keep This File Updated

**Whenever you discover a new piece of infrastructure, bug, or architectural change** you MUST update this file so the next agent has the full picture.

---

## 1. What We Build

**Loonaris** is a multi-tenant Database-as-a-Service (DBaaS) platform — like Neon or Supabase, built from scratch. Users create isolated PostgreSQL clusters through a web dashboard, and connect to them using `sk_live_` API keys through a Go TCP gateway.

### The Two Subprojects

| Subproject | Path | Language | Purpose |
|---|---|---|---|
| **Control Plane** | `/web-app` | TypeScript (Express + Prisma + React) | User auth, project CRUD, cluster provisioning, billing |
| **DB Gateway** | `/db-gateway` | Go | TCP proxy that routes `sk_live_` keys to tenant PgBouncers |

Both subprojects have their **own** git repositories inside this workspace but share the same GitHub organization (`Loonaris-DBaaS`).

---

## 2. Architecture (Production)

```text
Internet
  │
  ├──▶ https://loonaris.tech/  ──▶ Nginx EC2 (SSL termination)
  │                                  ├── /api/* ──▶ ALB ──▶ ECS Fargate (Express Backend)
  │                                  └── /*      ──► S3 (frontend static files)
  │
  └──▶ db.loonaris.tech:5432 ──▶ AWS NLB ──▶ EKS (DB Gateway Pod)
                                            │
                                            ├── Cache HIT → tunnel to PgBouncer
                                            └── Cache MISS → https://loonaris.tech/api/internal/routes/{hash}
                                                                  │
                                                                  └──► Express Backend (ECS)
                                                            Returns: PgBouncer host/port + status
                                            │
                                            └──► pooler-rw-svc.project-{id}.svc.cluster.local:5432  (writes → CNPG Primary)
                                            └──► pooler-ro-svc.project-{id}.svc.cluster.local:5432  (reads  → CNPG Replica)
```

### Node Groups (EKS)

| Node Group | Taint | Runs |
|---|---|---|
| System Plane | none (uses nodeSelector `role=system`) | db-gateway pod, CNPG operator, EKS add-ons |
| Tenant Plane | none (uses nodeSelector `role=tenant`) | CNPG pods, PgBouncer RW, PgBouncer RO |

---

## 3. Documentation Map — Read These First

Every doc in this repo is listed below. Read the ones relevant to your task BEFORE writing code.

### Root Level (`/`)

| File | What It Covers | When to Read |
|---|---|---|
| `ONBOARDING.md` | New developer guide: what Loonaris is, how it works, local dev setup, key concepts | First time in this repo |
| `GAPS.md` | What's not built yet: API gaps, deployment gaps, GitOps, security, testing | Before planning new features |
| `AGENTS.md` | Master context file: architecture, data flows, source map, known bugs (this file) | Before any code changes |
| `docs/KEY_HASHING.md` | DB connection key format, SHA-256 hashing rationale, creation flow, verification flow, security properties, implementation status | Before touching API key generation, hashing, or gateway key parsing |

### DB Gateway (`/db-gateway`)

| File | What It Covers | When to Read |
|---|---|---|
| `README.md` | Project overview, quick start, env vars, testing | First touch of db-gateway |
| `docs/GATEWAY_IMPL.md` | Implementation plan: file structure, key parsing, cache, API, test strategy | Before modifying gateway code |
| `docs/DEPLOYMENT.md` | EKS deployment, K8s manifests, GitOps/CI-CD, env vars, architecture diagram, security checklist | Before deploying or configuring |
| `k8s/*.yaml` | Kubernetes manifests: Deployment, Services, NetworkPolicy, Secrets, Namespace | Before modifying K8s config |
| `docker-compose.yml` | Local test stack: gateway + stub-api + 6 PgBouncers + PostgreSQL | Before running local integration tests |
| `docker/stub-api/` | Node.js mock control plane that returns fixture route data for 3 tenants | Before testing gateway locally |
| `.github/workflows/docker.yml` | CI/CD: test → build → push → GitOps manifest update → ArgoCD | Before modifying CI/CD |

### Web App / Control Plane (`/web-app`)

| File | What It Covers | When to Read |
|---|---|---|
| `AGENTS.md` | AWS infrastructure details: ECR, ECS, ALB, RDS, VPC, security groups, CI/CD, deployment approach, debugging history | Before touching AWS or backend code |
| `CLAUDE.md` | Quick orientation, current state, stubbed modules, critical rules | First touch of web-app |
| `CODING_STANDARDS.md` | Naming conventions, directory structure, import order, formatting rules | Before writing any code |
| `GATEWAY.md` | Architectural spec for the DB Gateway: key format, routing data path, API contract | Before modifying gateway-related backend code |
| `PROVISIONNING.md` | Tenant lifecycle spec: CNPG manifest blueprint, PgBouncer configs, activation loop | Before modifying provisioning code |
| `RUNBOOK.md` | Operations: deploy, rollback, SSH, migrations, common issues | Before deploying or debugging production |
| `DEPLOY_AWS.md` | AWS infrastructure architecture: VPC, subnets, ECS, ALB, RDS | Before modifying infra |
| `backend/CI-CD-PLAN.md` | CI/CD pipeline design for the backend | Before modifying deployment workflows |
| `backend/docs/PROVISIONING_ENGINE.md` | Provisioning pipeline, API key lifecycle, K8s manifest templates, activation loop, internal API contract | Before modifying provisioning, keys, or internal routes |

---

## 4. Key Data Flows

### 4.1. DB Gateway Connection Flow

```text
1. Client connects to db.loonaris.tech:5432
2. Gateway reads PostgreSQL startup packet
3. Extracts user field (e.g., "sk_live_a3f9...64hex_rw")
4. ParseTenantKey → SHA256(baseKey) = keyHash, mode = "rw" or "ro"
5. lookupRoute(keyHash)
   a. Cache HIT (≤60s) → use cached TenantRoute
   b. Cache MISS → GET https://loonaris.tech/api/internal/routes/{keyHash}
6. If status ≠ "active" → drop connection silently
7. mode=="rw" → tunnel to pooler-rw-svc.project-{id}.svc.cluster.local:5432
   mode=="ro" → tunnel to pooler-ro-svc.project-{id}.svc.cluster.local:5432
8. Bidirectional io.Copy until either side closes
```

### 4.2. Express Backend API → Gateway Contract

The Express backend must expose:

```
GET /api/internal/routes/:keyHash
Authorization: Bearer <INTERNAL_GATEWAY_SECRET>
```

Response (`200 OK`):
```json
{
  "tenant_id": "project-abc12345",
  "pgbouncer_rw_host": "pooler-rw-svc.project-abc12345.svc.cluster.local",
  "pgbouncer_rw_port": 5432,
  "pgbouncer_ro_host": "pooler-ro-svc.project-abc12345.svc.cluster.local",
  "pgbouncer_ro_port": 5432,
  "status": "active"
}
```

**Critical:** Prisma `ProjectStatus.running` must be mapped to `"active"` in the gateway response.

### 4.3. Tenant Provisioning Flow

```text
POST /api/clusters (auth: JWT)
  → Express creates project record (status="provisioning")
  → Express generates sk_live_[64hex]_rw and sk_live_[64hex]_ro keys
  → Express hashes base keys with SHA256, stores in api_keys table
  → Express applies K8s manifests: Namespace, Secret, CNPG Cluster, PgBouncer Deployments, Services
  → Express polls CNPG cluster status until phase="Healthy"
  → Express updates project status to "running" (which maps to "active" for the gateway)
```

---

## 5. Source Code Map

### 5.1. DB Gateway (`/db-gateway`)

```
internal/
├── gateway/
│   ├── server.go        — TCP listener, Config struct, graceful shutdown, signal handling
│   ├── session.go        — Per-connection handler: SSL/GSSENC, key parsing, read deadline
│   ├── tunnel.go         — RW/RO route selection, backend dial with timeout, bidirectional pipe
│   ├── key.go            — ParseTenantKey() regex + SHA256 hashing
│   ├── cache.go          — sync.Map with 60s TTL, lookupRoute()
│   ├── api.go            — fetchRouteFromControlPlane() with 5s timeout, Bearer auth
│   ├── singleflight.go  — Deduplication for concurrent cache misses (thundering herd fix)
│   ├── key_test.go       — Key format, SHA256, E2E hash verification tests
│   ├── cache_test.go     — Cache miss, hit, TTL expiry, 404 tests
│   ├── api_test.go       — HTTP client tests with httptest
│   └── singleflight_test.go — Concurrent singleflight dedup test
├── postgres/
│   ├── startup.go        — PostgreSQL startup packet parser, SSL/GSSENC rejection
│   └── startup_test.go   — With/without SSL, GSSENC, unknown code, raw preservation tests
main.go                    — Entry point, env vars (PORT, CONTROL_PLANE_URL, INTERNAL_GATEWAY_SECRET)
```

**Environment Variables:**

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5432` | TCP listen port |
| `CONTROL_PLANE_URL` | `https://loonaris.tech/api` | Express backend URL for route lookups |
| `INTERNAL_GATEWAY_SECRET` | — | Bearer token shared with Express backend |

**Run tests:** `cd db-gateway && go test ./... -v -count=1`
**Run locally:** `cd db-gateway && docker compose up --build`

### 5.2. Web App Backend (`/web-app/backend`)

```
src/
├── config/openapi.ts      — Swagger/OpenAPI spec
├── index.ts                — Express app: mounts /api/health, /api/auth, /api/clusters, /api/internal, /api/test
├── lib/
│   ├── prisma.ts           — Prisma client singleton (handles SSL config)
│   ├── tokens.ts           — JWT access/refresh token generation & verification
│   └── crypto.ts           — generateBaseKey(), sha256Hex(), formatApiKey()
├── middleware/
│   ├── authenticate.ts      — JWT Bearer auth middleware
│   ├── internalAuth.ts      — Bearer shared-secret auth for gateway internal routes
│   └── validate.ts          — Request validation middleware
├── modules/
│   ├── auth/               — Signup, signin, refresh, me (JWT-based)
│   ├── internal/           — Gateway route lookup (GET /internal/routes/:keyHash)
│   │   ├── controllers/    — Validates keyHash, calls service
│   │   ├── services/       — Lookup: ApiKey → Project → Pooler, maps running → active
│   │   └── routes.ts       — Express router for /internal
│   ├── pgCluster/
│   │   ├── controllers/    — CRUD endpoints for cluster management
│   │   ├── dto/             — Request/response DTOs
│   │   ├── provisioning/   — K8s manifest compilation, apply via @kubernetes/client-node, activation polling
│   │   ├── services/       — Business logic: creates project, generates keys, creates Pooler/ApiKey records
│   │   └── routes.ts        — Express router for /clusters
│   └── testApp/             — Smoke test CRUD
└── generated/prisma/        — Prisma generated client
```

**Implemented:** `provisioning/provisioning.ts` now generates 7 K8s manifests (Namespace, Secret, CNPG Cluster, PgBouncer RW/RO Deployments + Services), applies them via `@kubernetes/client-node`, and polls CNPG cluster health until `phase=Healthy`. The `internal/` route for the gateway (`GET /api/internal/routes/:keyHash`) is now implemented with `internalAuth` middleware.

### 5.3. Web App Frontend (`/web-app/frontend`)

```
src/
├── app/router/          — React Router configuration
├── components/ui/       — Reusable UI primitives
├── features/            — Dashboard, Landing, SignIn, SignUp
├── services/            — API service layer
└── styles/              — Global CSS
```

### 5.4. Prisma Schema (`/web-app/backend/prisma/schema.prisma`)

Key models and their relationships:

```text
Tenant ──┬── RefreshToken (auth sessions)
          └── Project ──┬── ResourceConfig (CPU, RAM, storage, replicas)
                         ├── Pooler (rw/ro host links)
                         └── ApiKey (key_hash, prefix, revoked_at)
```

**Critical fields:**
- `ApiKey.keyHash` — SHA256 of the base key (not the full `sk_live_...` string)
- `Project.k8sNamespace` — format `project-{id}` (fixed — was `tenant-...`)
- `Project.status` — `provisioning | running | stopped | error | deleting` (mapped to `"active"` for gateway via `internal.service.ts`)
- `Pooler.rwHost` / `Pooler.rwPort` / `Pooler.roHost` / `Pooler.roPort` — structured K8s FQDNs (fixed — was connection strings)

---

## 6. Known Gaps & Bugs

These are the known mismatches between the spec and the current code. Check these BEFORE starting work.

| # | Area | Gap | Status | File/Line |
|---|---|---|---|---|
| 1 | Express | `GET /api/internal/routes/:keyHash` endpoint | **Fixed** — implemented with `internalAuth` middleware | `web-app/backend/src/modules/internal/` |
| 2 | Express | `Project.k8sNamespace` generates `tenant-...` instead of `project-{id}` | **Fixed** — now `project-{clusterId}` | `web-app/backend/src/modules/pgCluster/services/pgCluster.service.ts:40` |
| 3 | Express | `ProjectStatus.running` must map to `"active"` for gateway | **Fixed** — mapping in `internal.service.ts` | `web-app/backend/src/modules/internal/services/internal.service.ts` |
| 4 | Express | `provisioning.ts` is a stub — no K8s API calls | **Fixed** — real K8s manifest generation + apply + activation polling | `web-app/backend/src/modules/pgCluster/provisioning/provisioning.ts` |
| 5 | Express | No activation polling loop (CNPG status check) | **Fixed** — polls every 5s for up to 5min | `web-app/backend/src/modules/pgCluster/provisioning/provisioning.ts` |
| 6 | Express | `Pooler` model stores connection strings, gateway needs host+port | **Fixed** — schema changed to `rwHost`/`rwPort`/`roHost`/`roPort` | `web-app/backend/prisma/schema.prisma` |
| 7 | Express | API key generation (`sk_live_` format) not implemented in createCluster | **Fixed** — generates base key, hashes with SHA256, stores in ApiKey | `web-app/backend/src/modules/pgCluster/services/pgCluster.service.ts:42-45` |
| 8 | Express | Bearer auth middleware for `/internal` routes (shared secret) not implemented | **Fixed** — `internalAuth.ts` validates against `INTERNAL_GATEWAY_SECRET` env var | `web-app/backend/src/middleware/internalAuth.ts` |
| 9 | Gateway | Default secret in main.go should be empty/required in production | Security hardening | `db-gateway/main.go:15` |
| 10 | Schema | Pooler schema migration not yet applied to production DB | **Pending** — migration must be created via `npx prisma migrate dev --create-only` and deployed | `web-app/backend/prisma/schema.prisma` |
| 11 | Deps | `@kubernetes/client-node` added — needs kubeconfig in production ECS task | **Pending** — ECS task needs IAM role + kubeconfig for EKS access | `web-app/backend/package.json` |

---

## 7. Test Tenant Keys (Local Docker)

For local integration testing via `docker compose up --build`:

| Tenant | RW Key | RO Key | SHA256 Hash |
|---|---|---|---|
| test1 | `sk_live_aaa...<truncated>...rw` | `sk_live_aaa...<truncated>...ro` | `ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb` |
| test2 | `sk_live_bbb...<truncated>...rw` | `sk_live_bbb...<truncated>...ro` | `a0fab1377f49a759b57f63318262ebe89fabfc990e8e93ceac2984561482b9d4` |
| test3 | `sk_live_ccc...<truncated>...rw` | `sk_live_ccc...<truncated>...ro` | `52b6419d27bd7f547cee3b92f8c17a908b8a49601ecbec161e5030de1dfe9e0a` |

Gateway port: `35432` (mapped from internal 5432 in docker-compose)
PostgreSQL port: `25432`

```bash
# Test RW (tenant 1)
psql "host=localhost port=35432 user=sk_live_aaa...rw dbname=app_test1"

# Test RO (tenant 1)
psql "host=localhost port=35432 user=sk_live_aaa...ro dbname=app_test1"
```

---

## 8. AWS Infrastructure Quick Reference

### EKS Cluster (Account 592858827449, profile: `ahmed-loonaris`)

| Service | Detail |
|---|---|
| Region | `eu-west-3` |
| EKS Cluster | `loonaris-eks` (K8s 1.35, AL2023) |
| VPC | `vpc-0d09d93701e88a49d` (loonaris-app-vpc, 10.0.0.0/16) |
| Private subnets | `subnet-0725acfd553347c73` (eu-west-3a), `subnet-065aa704f43466ec7` (eu-west-3b) |
| Public subnets | `subnet-0357d6d0f35412ce9` (eu-west-3a), `subnet-0d2da20103fa50a8b` (eu-west-3b) |
| NAT Gateway | `nat-0fe22e5d155ef1cc6` (in public subnet eu-west-3a) |
| system-ng | 1× c5.large (2 vCPU, 4 GB), taint `dedicated=system:NoSchedule` |
| tenant-ng | 3× t2.small (1 vCPU, 2 GB), taint `dedicated=tenant:NoSchedule` |
| VPC CNI | Prefix delegation enabled (ENABLE_PREFIX_DELEGATION=true) |
| Node role | `arn:aws:iam::592858827449:role/AmazonEKSAutoNodeRole2` |
| Cluster role | `arn:aws:iam::592858827449:role/AmazonEKSClusterRole` |

### Other AWS Infrastructure (Account 474741569968, profile: `default`)

| Service | Detail |
|---|---|
| ECR | `474741569968.dkr.ecr.eu-west-3.amazonaws.com/ahmed-aws/loonaris` |
| ECS Cluster | `loonaris-ecs-fargate-cluster` |
| ECS Service | `loonaris-backend-service-p839kjg4` |
| ALB | `loonaris-alb-1830888004.eu-west-3.elb.amazonaws.com` |
| Nginx EC2 | `35.181.168.74` (loonaris.tech SSL termination) |
| Bastion | `13.39.112.107` (SSH jump host for private RDS access) |
| RDS | `database-loonaris-app.c3s68wa6ehdt.eu-west-3.rds.amazonaws.com:5432` |
| VPC | `vpc-01b6ed7fa337233e6` (loonaris-app-vpc) |

**See `/web-app/AGENTS.md` for full AWS infrastructure details, debugging history, and deployment procedures.**

---

## 9. Commands Cheat Sheet

```bash
# === DB Gateway ===
cd db-gateway

# Build & test
go build ./...
go test ./... -v -count=1
go vet ./...

# Local integration test (3 tenants, 6 PgBouncers, stub API)
docker compose up --build
docker compose down --remove-orphans

# === Web App Backend ===
cd web-app/backend

# Install & run locally
npm install && npm run dev

# Database migrations (via bastion)
npx prisma migrate dev --create-only   # create migration
npx prisma migrate deploy               # apply to production

# === Web App Frontend ===
cd web-app/frontend
npm install && npm run dev

# === Deploy Backend ===
# Automated via GitHub Actions on push to main (see web-app/AGENTS.md)
# Manual: cd backend && bash local-tools/push-container-script.sh

# === Deploy Frontend ===
# Automated via GitHub Actions on push to main (see web-app/AGENTS.md)
```

---

## 10. Critical Rules (Do Not Violate)

1. **Never store `sk_live_` plaintext base keys in the database** — always SHA-256 hash before writing
2. **JWT for dashboard only, never for DB connections** — DB uses `sk_live_` API keys parsed at the TCP layer
3. **One Kubernetes namespace per tenant** — format `project-{id}`, never generic names
4. **Gateway always rejects non-`active` tenants** — status `"provisioning"`, `"stopped"`, `"error"` = dropped connection
5. **Express `/api/internal/routes` auth uses shared Bearer secret, NOT JWT** — separate middleware
6. **PgBouncer RW connects to CNPG Primary, RO connects to CNPG Replica** — never mix these
7. **Deployment is always: build → push → register new task def with exact digest → force-new-deployment** — never rely on `:latest` tag resolution in ECS
8. **Health check path is `/api/health`** — not `/health`
9. **All app routes live under `/api`** — keep it that way
10. **Never write Prisma migration SQL files manually** — always use `npx prisma migrate dev --create-only` to generate them from schema changes