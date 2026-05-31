# Loonaris — Developer Onboarding

> Welcome. This guide explains what Loonaris is, how it works, and how to start developing. No prior context needed.

---

## What Is Loonaris?

Loonaris is a **Database-as-a-Service (DBaaS) platform** — think of it like Neon or Supabase, built from scratch. A user signs up on a website, clicks "Create Database," and gets a PostgreSQL connection string. Behind the scenes, Loonaris provisions an isolated PostgreSQL cluster on Kubernetes, gives the user an API key (`sk_live_...`), and routes their database traffic through a custom Go proxy to their dedicated instance.

There are two separate codebases in this workspace:

| Codebase | Folder | Language | What It Does |
|---|---|---|---|
| **Control Plane** | `/web-app` | TypeScript (Express + Prisma + React) | User dashboard, database provisioning, API key management |
| **DB Gateway** | `/db-gateway` | Go | TCP proxy that reads the `sk_live_...` key from PostgreSQL connections and routes them to the right database |

---

## How It Works (The Big Picture)

```text
User's app (psql, pgx, etc.)
    │
    │  connects to db.loonaris.tech:5432
    │  sends: user="sk_live_a3f9..._rw"
    ▼
┌─────────────────────────┐
│   DB Gateway (Go)       │    ← Runs on EKS (system plane)
│                         │
│  Parses the API key    │
│  SHA-256 hashes it     │
│  Looks up the route    │
│  (cache or API call)   │
└──────┬──────────────────┘
       │
       │  Cache miss → GET /api/internal/routes/{hash}
       │  (calls the Express backend to find which PgBouncer to use)
       │
       ▼
┌─────────────────────────┐
│   Express Backend (TS)  │   ← Runs on ECS Fargate
│                         │
│  Looks up the key hash │
│  Finds the Project +   │
│  Pooler record          │
│  Returns host:port      │
└─────────────────────────┘
       │
       │  Gateway now knows where to tunnel
       ▼
┌─────────────────────────┐
│   Kubernetes Cluster    │    ← EKS (tenant plane)
│                         │
│  Namespace: project-xx  │
│  ├── PgBouncer RW ────► CNPG Primary (writes)
│  └── PgBouncer RO ────► CNPG Replica (reads)
└─────────────────────────┘
```

### The Three Things That Happen When a User Creates a Database

1. **Express Backend** generates an API key (`sk_live_64hex_rw`), creates database records, and applies 7 Kubernetes manifests (namespace, secret, CNPG cluster, PgBouncer deployments + services) to EKS
2. **CloudNativePG Operator** on EKS spins up PostgreSQL pods, and the backend polls until they're healthy
3. The project status flips to `"running"`, which the gateway maps to `"active"` — now connections are accepted

---

## Project Structure Explained

```
PFA/
├── db-gateway/                    ← Go TCP proxy
│   ├── internal/gateway/          ← Core logic: key parsing, caching, tunneling
│   ├── internal/postgres/         ← PostgreSQL protocol parsing (startup packets)
│   ├── docker-compose.yml          ← Local test stack (3 tenants, 6 PgBouncers, stub API)
│   ├── k8s/                        ← Kubernetes manifests for deploying the gateway
│   └── docs/                       ← Gateway implementation docs, deployment guide
│
├── web-app/                        ← Control Plane (Express + React)
│   ├── backend/
│   │   ├── src/
│   │   │   ├── modules/auth/       ← Signup, login, profile (fully implemented)
│   │   │   ├── modules/pgCluster/  ← Cluster CRUD, provisioning, K8s API calls
│   │   │   ├── modules/internal/   ← Gateway route lookup (GET /internal/routes/:hash)
│   │   │   ├── modules/testApp/    ← Smoke test CRUD
│   │   │   ├── middleware/          ← JWT auth, shared-secret auth, validation
│   │   │   └── lib/                ← crypto, prisma, tokens
│   │   └── prisma/                 ← Database schema, migrations, seed
│   ├── frontend/                   ← React dashboard
│   ├── GATEWAY.md                  ← How the gateway ↔ backend contract works
│   ├── PROVISIONNING.md            ← How cluster provisioning works end-to-end
│   └── AGENTS.md                   ← AWS infrastructure details, debugging history
│
├── GAPS.md                         ← What's not built yet (gaps, known issues)
├── AGENTS.md                       ← Master context file for AI agents
└── ONBOARDING.md                   ← You are here
```

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 18 + Vite + React Router | SPA served from S3 via Nginx |
| Backend | Express + Prisma 7 + TypeScript | Runs on ECS Fargate |
| Database | PostgreSQL (RDS) | Stores users, projects, API keys, pooler config |
| DB Gateway | Go (stdlib only) | TCP proxy, no external deps |
| Kubernetes | EKS + CloudNativePG + PgBouncer | Per-tenant isolated PostgreSQL clusters |
| Auth | JWT (dashboard) + `sk_live_` keys (DB connections) | Two separate auth systems |

---

## Local Development Setup

### Backend

```bash
cd web-app/backend
npm install
npm run dev          # Starts on http://localhost:3001
```

Required environment variables (see `.env.example`):
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — JWT signing key
- `JWT_REFRESH_SECRET` — Refresh token key
- `INTERNAL_GATEWAY_SECRET` — Shared secret between gateway and backend

### Frontend

```bash
cd web-app/frontend
npm install
npm run dev          # Starts on http://localhost:5173
```

### DB Gateway

```bash
cd db-gateway
go build ./...
go test ./... -v -count=1

# Full local integration test (gateway + stub API + PgBouncers + PostgreSQL)
docker compose up --build
docker compose down --remove-orphans
```

### Database Migrations

```bash
cd web-app/backend

# Create a migration from schema changes (do NOT write migration SQL manually)
npx prisma migrate dev --create-only

# Apply migrations to production (via bastion SSH tunnel)
npx prisma migrate deploy
```

**Never write Prisma migration SQL files by hand.** Always use `npx prisma migrate dev --create-only` to generate them from schema changes.

---

## API Overview

### Dashboard Routes (JWT Auth)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/signup` | Register new user |
| `POST` | `/api/auth/login` | Login, get access + refresh tokens |
| `POST` | `/api/auth/refresh-token` | Refresh access token |
| `POST` | `/api/auth/logout` | Revoke refresh token |
| `GET` | `/api/auth/profile` | Get current user profile |
| `PATCH` | `/api/auth/profile` | Update profile |
| `DELETE` | `/api/auth/account` | Delete account |
| `GET` | `/api/clusters` | List user's clusters |
| `GET` | `/api/clusters/:id` | Get cluster details |
| `POST` | `/api/clusters` | Create a new cluster (returns `sk_live_` key) |
| `DELETE` | `/api/clusters/:id` | Delete a cluster |

### Gateway Internal Route (Shared Secret Auth)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/internal/routes/:keyHash` | Look up tenant route by key hash |

This endpoint uses `Authorization: Bearer <INTERNAL_GATEWAY_SECRET>` — not JWT.

### Health Check

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | ALB liveness probe |

---

## Key Concepts

### API Keys (`sk_live_...`)

When a cluster is created, the backend generates a 64-hex base key and returns the full key to the user:

```
sk_live_<64-hex-chars>_<mode>
```

Example format (not a real key):
```
sk_live_a3f9...<64 hex chars>...f8a9_rw
```

- Prefix: `sk_live_`
- Base key: 64 lowercase hex characters
- Mode suffix: `_rw` (read-write) or `_ro` (read-only)

### K8s Namespace Naming

Every project gets its own Kubernetes namespace: `project-{uuid}`. This is stored in `Project.k8sNamespace`.

### Status Mapping

The gateway only accepts connections when the project status is `"active"`. But the database stores `"running"`. The mapping happens in `internal.service.ts`:

```
Database "running"  →  API response "active"  →  Gateway accepts
Database "provisioning"  →  API response "provisioning"  →  Gateway drops
```

### Pooler Hosts

Each project's PgBouncer services follow a naming convention:

```
pooler-rw-svc.project-{id}.svc.cluster.local:5432   (read-write → Primary)
pooler-ro-svc.project-{id}.svc.cluster.local:5432   (read-only → Replica)
```

These are stored in the `Pooler` table as structured `rwHost`/`rwPort`/`roHost`/`roPort` fields (not connection strings).

---

## Important Rules

1. **Never store plaintext `sk_live_` base keys** — always SHA-256 hash before writing to the database
2. **JWT is for the dashboard only** — database connections use `sk_live_` keys parsed at the TCP layer
3. **One K8s namespace per project** — format `project-{id}`, never `tenant-` or generic names
4. **The gateway drops connections for non-`active` projects** — it sends zero bytes back
5. **Internal routes use shared Bearer secret, not JWT** — separate middleware
6. **Never write Prisma migrations by hand** — always use `npx prisma migrate dev --create-only`
7. **All routes must be under `/api`** — the ALB and Nginx only proxy `/api/*` to the backend
8. **Health check path is `/api/health`** — not `/health`

---

## Where to Go Next

| If You Want To... | Read This |
|---|---|
| Understand the gateway ↔ backend contract | `web-app/GATEWAY.md` |
| Understand cluster provisioning | `web-app/PROVISIONNING.md` |
| Understand the provisioning pipeline in detail | `web-app/backend/docs/PROVISIONING_ENGINE.md` |
| See what's not built yet | `GAPS.md` |
| Get AWS infrastructure details | `web-app/AGENTS.md` |
| Get the full AI agent context | `AGENTS.md` |
| Deploy the backend manually | `web-app/RUNBOOK.md` |
| Deploy the gateway to EKS | `db-gateway/docs/DEPLOYMENT.md` |
| Check coding standards | `web-app/CODING_STANDARDS.md` |