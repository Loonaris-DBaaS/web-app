# Loonaris

> Multi-tenant **PostgreSQL Database-as-a-Service** — sign up, spin up an isolated
> Postgres cluster in seconds, and connect to it over a single endpoint with an
> `sk_live_` API key.

<p align="left">
  <img alt="Backend" src="https://img.shields.io/badge/backend-Node%2018%20%C2%B7%20Express%20%C2%B7%20Prisma-3178c6?logo=typescript&logoColor=white">
  <img alt="Frontend" src="https://img.shields.io/badge/frontend-React%2018%20%C2%B7%20Vite-61dafb?logo=react&logoColor=black">
  <img alt="Database" src="https://img.shields.io/badge/database-PostgreSQL%2016-336791?logo=postgresql&logoColor=white">
  <img alt="Orchestration" src="https://img.shields.io/badge/runtime-AWS%20%C2%B7%20EKS%20%C2%B7%20CloudNativePG-ff9900?logo=amazonaws&logoColor=white">
</p>

This repository is the **control plane and dashboard** for the Loonaris platform.
The data-path proxy that fronts every tenant database lives in its own
repository: **[`db-gateway`](https://github.com/Loonaris-DBaaS/db-gateway)** (Go).

---

## Table of Contents

- [What is Loonaris?](#what-is-loonaris)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Available scripts](#available-scripts)
- [How it works](#how-it-works)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [License](#license)

---

## What is Loonaris?

Loonaris is a multi-tenant Database-as-a-Service. Users sign up on the dashboard,
create isolated PostgreSQL clusters, and connect to them through a single
internet-facing endpoint using an `sk_live_` API key — no database password ever
leaves the platform.

Each tenant is provisioned into its **own Kubernetes namespace** running a
[CloudNativePG](https://cloudnative-pg.io/) (CNPG) Postgres cluster and CNPG
poolers, giving every customer hard isolation at the compute, network, and
storage layers.

- **Self-service provisioning** — create, resize, and delete clusters from the dashboard.
- **Key-based connections** — the `sk_live_` key *is* the credential; tenants never see the real DB password.
- **Live metrics** — CPU, memory, and storage utilization read straight from the kubelet.
- **Read/write split** — `_rw` keys route to the primary, `_ro` keys to a replica pooler.

## Architecture

```
                         ┌─────────────────────────────┐
   Browser ──────────────►        Dashboard            │  React + Vite (Nginx / S3)
   (HTTPS)               └──────────────┬──────────────┘
                                        │ REST (JWT)
                         ┌──────────────▼──────────────┐
                         │        Control plane         │  this repo · backend/
                         │   Express · Prisma · TS      │  ECS Fargate (Account 1)
                         └───────┬──────────────┬───────┘
                  Prisma         │              │  K8s API (cross-account EKS token)
              ┌─────────▼──────┐ │              │ ┌──────────────────────────────┐
              │  Control-plane │ │              └─►          EKS cluster          │
              │   Postgres     │ │                │  CNPG Clusters + Poolers      │
              │   (RDS)        │ │                │  one namespace per tenant     │
              └────────────────┘ │                └──────────────┬───────────────┘
                                 │  GET /api/internal/routes/:hash│
                         ┌───────▼──────────┐                    │
   psql sk_live_..._rw ──►    db-gateway    ├────────────────────┘
   (NLB :5432)           │  Go TCP proxy    │  routes _rw → primary pooler,
                         │  (separate repo) │         _ro → replica pooler
                         └──────────────────┘
```

| Component | Path / repo | Tech | Runs on |
|---|---|---|---|
| **Dashboard** | [`frontend/`](frontend) | React 18 + Vite | Nginx / S3 + CloudFront |
| **Control plane** (API + provisioning) | [`backend/`](backend) | TypeScript · Express · Prisma | ECS Fargate |
| **Control-plane DB** | managed | PostgreSQL 16 | RDS |
| **DB Gateway** | [`Loonaris-DBaaS/db-gateway`](https://github.com/Loonaris-DBaaS/db-gateway) | Go | EKS (`system-plane`) |
| **Tenant databases** | provisioned per tenant | CNPG Postgres + Poolers | EKS (`tenant-ng`) |

> The data path (`db-gateway`) is a deliberately separate repo: it is a small,
> security-sensitive Go service with its own release cadence. This repo owns the
> **control plane** — everything that authenticates users, provisions clusters,
> and serves the dashboard.

## Repository layout

```
web-app/
├── backend/                 # Control plane — Express + Prisma API
│   ├── src/
│   │   ├── modules/         # Feature modules (vertical slices)
│   │   │   ├── auth/        #   signup / login, JWT, API-key issuance
│   │   │   ├── pgCluster/   #   cluster CRUD + Kubernetes provisioning engine
│   │   │   ├── internal/    #   /internal/routes lookup used by db-gateway
│   │   │   ├── admin/       #   admin-only operations
│   │   │   ├── loadTest/    #   load-testing endpoints
│   │   │   └── testApp/     #   demo app for end-to-end checks
│   │   ├── config/          # env, OpenAPI/Swagger
│   │   ├── lib/             # shared helpers (Prisma client, K8s client, …)
│   │   └── middleware/      # auth, error handling
│   └── prisma/              # schema, migrations, seed
├── frontend/                # Dashboard — React + Vite SPA
│   └── src/
│       ├── pages/           # routed views (Dashboard, Auth, Admin, …)
│       ├── components/      # reusable UI
│       ├── services/        # axios API clients
│       └── hooks/           # auth + data hooks
├── infrastructure/          # IAM policies, Nginx config
├── .github/workflows/       # backend-deploy.yml, frontend-deploy.yml
└── docs/                    # architecture, infra, and runbook docs
```

## Tech stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, React Router, Vite, Axios |
| **Backend** | Node 18, Express, TypeScript, Prisma ORM, JWT, bcrypt |
| **Database** | PostgreSQL 16 (control plane on RDS; tenant DBs via CloudNativePG) |
| **Orchestration** | AWS EKS, CloudNativePG operator, `@kubernetes/client-node` |
| **Infra / AWS** | ECS Fargate, RDS, NLB/ALB, S3 + CloudFront, Secrets Manager |
| **CI/CD** | GitHub Actions (`backend-deploy.yml`, `frontend-deploy.yml`) |

## Getting started

### Prerequisites

- **Node.js 18+** and npm
- **Docker** (for the local Postgres / pgAdmin stack)

### 1. Install dependencies

```bash
npm run install:all      # installs backend + frontend
```

### 2. Start a local database

```bash
docker compose up -d     # Postgres on :5436, pgAdmin on :5050
```

Create `backend/.env` (see `backend/` for the full list of variables):

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5436/postgres"
JWT_SECRET="dev-secret-change-me"
```

### 3. Apply the schema and seed

```bash
npm run db:migrate       # apply migrations
npm run db:seed          # optional: seed demo data
```

### 4. Run the app

```bash
npm run dev              # backend + frontend together (concurrently)
```

- Dashboard → http://localhost:5173
- API → http://localhost:3001
- API docs (Swagger) → http://localhost:3001/api/docs

> **Provisioning real clusters** requires AWS + EKS credentials. Local
> development runs the control plane and dashboard against the local Postgres.

## Available scripts

Run from the repo root (`web-app/`):

| Script | Description |
|---|---|
| `npm run dev` | Run backend and frontend together |
| `npm run build` | Build backend then frontend for production |
| `npm start` | Start the built backend |
| `npm run format` | Prettier-format both packages |
| `npm run db:migrate` | Create/apply a Prisma migration (dev) |
| `npm run db:migrate:deploy` | Apply migrations non-interactively (CI/CD) |
| `npm run db:seed` | Seed the database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Drop, re-create, migrate and seed |

## How it works

**Connection flow** — a tenant connects with their key as the Postgres `user`,
no password:

```
psql user=sk_live_<hash>_rw  sslmode=disable
  → NLB (:5432, eu-west-3)
  → db-gateway pod
       • parse key → GET /api/internal/routes/<hash> (control plane)
       • status must be "active" (cluster running)
       • auth-terminating: accept the client, open its own SCRAM-authenticated
         connection to the pooler as the shared internal user, splice sockets
  → pooler-rw / pooler-ro  (CNPG Pooler)
  → tenant Postgres
```

The `sk_live_` key is the only credential a tenant ever holds. A single internal
DB password (stored in Secrets Manager) is shared by every tenant's database
user and is held only by the gateway — tenants never see it.

**Provisioning flow** — `POST /api/clusters` creates a `Project`
(`status=provisioning`), generates the `sk_live_` key (only the SHA-256 hash is
stored), and returns `202`. A background task applies the Kubernetes manifests
(Namespace, credentials Secret, CNPG `Cluster`, RW/RO `Pooler`s) to EKS, then
polls CNPG until the cluster is healthy and flips `status` to `running`.

See [`docs/PROJECT.md`](docs/PROJECT.md) and
[`docs/PROVISIONING_ENGINE.md`](docs/PROVISIONING_ENGINE.md) for the verified,
end-to-end details.

## Deployment

Both packages deploy via GitHub Actions:

- **Backend** — [`backend-deploy.yml`](.github/workflows/backend-deploy.yml)
  builds the Docker image, pushes to ECR, runs `prisma migrate deploy`, and
  rolls the ECS Fargate service. **Database migrations run in CI/CD — never
  hand-write SQL against production.**
- **Frontend** — [`frontend-deploy.yml`](.github/workflows/frontend-deploy.yml)
  builds the Vite bundle and publishes the static assets.

<img width="1845" height="1269" alt="image" src="https://github.com/user-attachments/assets/cef1a532-fd44-44e5-a8d8-64cd14cd6600" />

Infrastructure specifics (AWS accounts, EKS access, DNS, secrets) are documented
in [`docs/INFRASTRUCTURE.md`](docs/INFRASTRUCTURE.md), which is the single source
of truth. Always verify against live AWS/`kubectl` state before acting on a doc.

## License

Proprietary — © Loonaris. All rights reserved.

---

<sub>Data-path proxy: <a href="https://github.com/Loonaris-DBaaS/db-gateway">Loonaris-DBaaS/db-gateway</a> · Part of the Loonaris DBaaS platform.</sub>
