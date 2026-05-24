# Loonaris — AI Agent Entry Point

## Read these first

| File | Purpose |
|---|---|
| `PROJECT_KNOWLEDGE.md` | Architecture, system design, Go/Node patterns, build phases, security rules — read before touching any code |
| `CODING_STANDARDS.md` | Naming conventions, directory structure, formatting, import order |

## Quick orientation

- **What we build:** Multi-tenant managed PostgreSQL platform (like Neon/Supabase, built from scratch)
- **Control plane:** `backend/` — TypeScript + Express + Prisma 7 + PostgreSQL
- **Dashboard:** `frontend/` — React 18 + Vite + React Router 6
- **DB Gateway:** Go TCP proxy (separate repo, not in this directory)
- **Infra target:** AWS EKS + CloudNativePG + PgBouncer

## Current state (as of 2026-05-24)

### Working
- `GET|POST|PUT|DELETE /test` — full CRUD smoke-test, no auth, wired to Prisma
- `GET|POST|DELETE /clusters` — cluster management, requires JWT `authenticate` middleware
- `GET /docs` — Swagger UI

### Explicitly stubbed (empty files — do not be surprised)
- `backend/src/modules/auth/**` — controllers and services are empty; auth routes are NOT mounted in `index.ts`
- `frontend/src/hooks/useAuth.js` — empty
- `frontend/src/app/router/ProtectedRoute.jsx` — empty
- `frontend/src/services/auth.service.js` — empty
- `frontend/src/features/Dashboard/Database.jsx` — renders hardcoded mock data (not wired to `/clusters`)
- `backend/src/modules/pgCluster/provisioning/provisioning.ts` — stubs, TODO: call Kubernetes API

### Critical rules (do not violate)
1. **Never store API keys in plaintext** — always SHA-256 hash before writing to DB
2. **JWT for dashboard only, never for DB TCP connections** — DB connections use `sk_live_` API keys
3. **One Kubernetes namespace per tenant** — never share CNPG clusters between tenants
4. **Use RS256 for JWT** — not HS256 (asymmetric: private key signs, public key verifies)
5. **`tenantId` must be in JWT claims** — the pgCluster controller reads `req.user.tenantId`

## Local dev setup

```bash
# Start the database
docker compose up -d

# Backend
cd backend && npm install && npm run dev   # http://localhost:3001

# Frontend
cd frontend && npm install && npm run dev  # http://localhost:5173
```
