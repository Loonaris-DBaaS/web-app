# DBaaS Platform — Project Knowledge File
> This file is the single source of truth for this project.  
> Claude must read this before answering any question about architecture, code, or decisions.

---

## 0. Project Identity

| Field | Value |
|---|---|
| Product type | Multi-tenant PostgreSQL DBaaS (startup) |
| Primary builder | Solo lead (~70% of work), team of 4 total |
| Deployment target | AWS EKS (Elastic Kubernetes Service) |
| This repo | Control Plane — Node.js + Express (TypeScript) + React frontend |
| DB Gateway | Separate repo — Go TCP proxy (not in this directory) |
| Current phase | Pre-MVP / planning + foundation |

---

## 1. What We Are Building

A **managed PostgreSQL platform** similar in concept to Supabase or Neon, but built from scratch.

External developers connect to our platform with a standard PostgreSQL connection URL:

```
postgres://sk_live_abc123@db.ourplatform.com/mydb
```

Behind this single public endpoint, our platform:
1. Authenticates the connection using the API key embedded in the username field
2. Resolves which tenant owns that key
3. Routes the TCP stream to the correct PgBouncer instance
4. PgBouncer pools connections to an isolated CloudNativePG cluster

**This repo is the Control Plane only.** It handles the web dashboard, REST API, tenant management, and Kubernetes provisioning. The DB Gateway (TCP proxy) lives in a separate Go repository.

---

## 2. Full System Architecture

```
External App (psql / ORM)
        │
        ▼
  DB Gateway (Go — separate repo)
  - Reads the PostgreSQL startup packet
  - Extracts API key from the username field
  - Looks it up in the Tenant Registry
  - Routes the TCP stream to the right PgBouncer
        │
        ▼
  PgBouncer (one per tenant, Kubernetes ClusterIP)
        │
        ▼
  CloudNativePG Cluster (one per tenant, isolated)
```

### This repo — Control Plane

```
Browser / Dashboard (React)
        │
        ▼
  REST API (Express / TypeScript)
        │
  JWT Auth (RS256)
        │
  ┌─────────────────────┐
  │  Tenant Registry DB │  ← stores: users, clusters, API keys, routing info
  └─────────────────────┘
        │
  Kubernetes API (provisioning)
  └─ creates CNPG Cluster + PgBouncer per tenant on demand
```

---

## 3. The Two Identity Systems (CRITICAL — never confuse these)

### 3A. Web Console Identity → JWT

- Used when: a human logs into the dashboard
- Flow: `POST /auth/login` → validate credentials → return JWT (RS256)
- JWT claims: `{ sub: user_id, tenantId, role, exp, iat }`
- Used for: creating databases, managing billing, revoking API keys, viewing metrics
- **Never used for database TCP connections**
- Access token: 15-minute expiry; refresh token: 7-day httpOnly cookie

### 3B. Database Connection Identity → API Key

- Used when: an external application connects to `db.ourplatform.com:5432`
- Format: `postgres://sk_live_abc123@db.ourplatform.com/mydb`
- The API key is in the **PostgreSQL username field** — the DB Gateway reads it
- API keys are **statically generated**, never expire by default, can be revoked
- Prefix conventions: `sk_live_` for production, `sk_test_` for sandbox
- **This repo generates and stores keys; the DB Gateway looks them up**

---

## 4. Component Overview

### 4A. DB Gateway (Go — separate repo)

A custom TCP proxy that reads just enough of the PostgreSQL wire protocol to extract the API key from the startup packet and route the connection to the right PgBouncer. It does not execute SQL. Details, patterns, and Go code belong in that repo.

**What the control plane needs to know:**
- The gateway queries the Tenant Registry DB to resolve `API key → pgbouncer_host`
- It caches results in-memory; revocation takes effect on next cache expiry
- Connection URL the gateway stores: `pgbouncer.<namespace>.svc.cluster.local:5432`

### 4B. PgBouncer (one per tenant)

A lightweight connection pooler. Sits between the DB Gateway and the CNPG cluster. Deployed as one Kubernetes Deployment per tenant namespace. The control plane is responsible for creating the PgBouncer Deployment + Service + ConfigMap when a new cluster is provisioned.

Key config per tenant:
```ini
[databases]
tenant_db = host=<cnpg-rw-service> port=5432 dbname=<dbname>

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
```

### 4C. CloudNativePG (CNPG) — one cluster per tenant

A Kubernetes operator that manages PostgreSQL clusters as native Kubernetes resources. The control plane provisions a `Cluster` CR per tenant via the Kubernetes API.

Key services CNPG creates per cluster:

| Service | Purpose |
|---|---|
| `<cluster>-rw` | Primary (read + write) |
| `<cluster>-ro` | Replicas (read only) |

**Per-tenant isolation:** each tenant gets their own CNPG `Cluster` resource in their own Kubernetes namespace (`tenant-<tenant_id>`). No shared PostgreSQL instances.

### 4D. Tenant Registry

Our internal PostgreSQL database (not a tenant DB) — the source of truth for the platform.

Key tables:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,     -- bcrypt
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  key_hash TEXT UNIQUE NOT NULL,   -- SHA-256, never plaintext
  prefix TEXT NOT NULL,            -- e.g. "sk_live_abc" for display
  created_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  pg_version TEXT NOT NULL,
  size TEXT NOT NULL,
  deployment_option TEXT NOT NULL,
  read_replicas INT DEFAULT 1,
  backup BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'provisioning',  -- provisioning | running | stopped | error | deleting
  external_id TEXT,                    -- Kubernetes resource name
  pgbouncer_host TEXT,                 -- set after provisioning completes
  pgbouncer_port INT DEFAULT 5432,
  namespace TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

> **Note:** The current Prisma schema is a simplified version of the above. `pgbouncer_host`, `pgbouncer_port`, `namespace`, and the separate `tenants` table will be added as the provisioning module is implemented.

---

## 5. Control Plane — Express / TypeScript Patterns

### Project Structure

```
backend/src/
├── index.ts                 ← Express app setup, global error handler, server listen
├── db.ts                    ← Prisma client singleton
├── openapi.ts               ← OpenAPI spec object
├── middleware/
│   └── authenticate.ts      ← JWT validation (RS256)
├── modules/                 ← One sub-folder per domain
│   ├── auth/
│   │   ├── controllers/     ← login, signup, profile
│   │   └── services/        ← business logic, bcrypt, JWT signing
│   └── pgCluster/
│       ├── controllers/     ← HTTP handlers
│       ├── services/        ← DB queries via Prisma
│       ├── dto/             ← request/response shapes
│       └── provisioning/    ← Kubernetes API calls (CNPG + PgBouncer)
└── types/
    └── express.d.ts         ← extends Request with req.user
```

### JWT Pattern (RS256)

```ts
import jwt from 'jsonwebtoken';
import fs from 'fs';

const privateKey = fs.readFileSync(process.env.JWT_PRIVATE_KEY_PATH!);
const publicKey  = fs.readFileSync(process.env.JWT_PUBLIC_KEY_PATH!);

export function signAccessToken(payload: object) {
  return jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: '15m' });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, publicKey, { algorithms: ['RS256'] });
}
```

> **Current state:** `authenticate.ts` uses HS256 with a `JWT_SECRET`. This must be migrated to RS256 before any production auth work.

### API Key Generation Pattern

```ts
import crypto from 'crypto';

export function generateApiKey(): string {
  return 'sk_live_' + crypto.randomBytes(32).toString('hex');
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// On creation:
// 1. const key = generateApiKey()    → return to user ONCE, never store
// 2. const hash = hashApiKey(key)    → store this in DB
```

### Error Handling Rule

All async route handlers must use `next(err)` — never swallow exceptions.

```ts
export async function index(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clusters = await service.listClusters(req.user!.tenantId);
    res.json(clusters);
  } catch (err) {
    next(err);  // reaches global error handler in index.ts
  }
}
```

### asyncHandler wrapper (preferred over manual try/catch)

```ts
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

router.get('/', authenticate, asyncHandler(index));
```

### Key packages

```json
{
  "dependencies": {
    "express": "^4.x",
    "pg": "^8.x",
    "jsonwebtoken": "^9.x",
    "bcryptjs": "^2.x",
    "@prisma/client": "^7.x",
    "@kubernetes/client-node": "^0.20.x",
    "helmet": "^7.x",
    "express-rate-limit": "^7.x",
    "dotenv": "^16.x"
  }
}
```

---

## 6. Kubernetes / EKS Architecture

### Namespace Strategy

```
platform-system        ← Control Plane API, DB Gateway, Registry DB
tenant-<tenant_id>     ← PgBouncer + CNPG Cluster for that tenant
```

### How provisioning works (control plane responsibility)

When a user creates a new cluster via `POST /clusters`, the control plane must:
1. Create a Kubernetes namespace `tenant-<tenant_id>`
2. Apply a CNPG `Cluster` CR in that namespace
3. Apply a PgBouncer `Deployment` + `Service` + `ConfigMap` in that namespace
4. Watch the CNPG `Cluster` status until it transitions to `Ready`
5. Write `pgbouncer_host`, `pgbouncer_port`, `namespace` back to the `clusters` table
6. Update cluster status to `running`

All of this happens via `@kubernetes/client-node`. The provisioning stub is in `src/modules/pgCluster/provisioning/provisioning.ts`.

### CloudNativePG Cluster manifest (per tenant)

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: cluster-<tenant_id>
  namespace: tenant-<tenant_id>
spec:
  instances: 2
  storage:
    size: 10Gi
    storageClass: gp3
  bootstrap:
    initdb:
      database: tenant_db
      owner: app_user
  backup:
    barmanObjectStore:
      destinationPath: s3://our-backups/<tenant_id>
      s3Credentials:
        inheritFromIAMRole: true
```

### PgBouncer manifest (per tenant)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pgbouncer
  namespace: tenant-<tenant_id>
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: pgbouncer
          image: pgbouncer/pgbouncer:1.22.1
          ports:
            - containerPort: 5432
          volumeMounts:
            - name: config
              mountPath: /etc/pgbouncer
      volumes:
        - name: config
          configMap:
            name: pgbouncer-config
---
apiVersion: v1
kind: Service
metadata:
  name: pgbouncer
  namespace: tenant-<tenant_id>
spec:
  type: ClusterIP
  ports:
    - port: 5432
```

### EKS-specific notes

- Use **NLB** (not ALB) for the DB Gateway service — ALB is HTTP only, NLB handles raw TCP
- Use **IRSA** for S3 backup access — never hardcode AWS credentials
- Use **External Secrets Operator** for injecting AWS Secrets Manager values into pods
- Use **EBS CSI driver** for CNPG persistent volumes (`gp3` storage class)

---

## 7. Security Design

### API Key Security

- **Never store plaintext API keys** — only store `SHA-256(key)` in the database
- Display key to user only once (on creation) — cannot be retrieved again
- Key format: `sk_live_` prefix + 32 random bytes hex-encoded

### JWT (Control Plane / Dashboard)

- Algorithm: **RS256** (asymmetric — private key signs, public key verifies)
- Claims: `{ sub: user_id, tenantId, role, exp, iat }`
- Access token: 15 min; refresh token: 7-day httpOnly cookie

### Tenant Isolation Layers

| Layer | Isolation mechanism |
|---|---|
| Network | Kubernetes NetworkPolicy (deny cross-tenant) |
| PostgreSQL | Separate CNPG clusters per tenant |
| Pooling | Separate PgBouncer per tenant |
| Compute | Separate pods/namespaces |
| Credentials | Per-tenant DB passwords in AWS Secrets Manager |

### Secrets Management

- Use **AWS Secrets Manager** + **External Secrets Operator** — never put secrets in ConfigMaps
- DB Gateway reads `REGISTRY_DSN` from a Kubernetes Secret (managed by External Secrets Operator)

---

## 8. Control Plane Build Plan

### Phase A — Auth (current focus)
- `POST /auth/signup` — create user + tenant, bcrypt password
- `POST /auth/login` — return JWT access token + httpOnly refresh token cookie
- `POST /auth/refresh` — rotate access token
- JWT middleware migrated to RS256
- `ProtectedRoute` + `useAuth` hook wired in the frontend

### Phase B — Cluster lifecycle
- `POST /clusters` — call Kubernetes API to create CNPG Cluster + PgBouncer
- Poll CNPG status until `Ready`, update DB record
- `DELETE /clusters/:id` — delete Kubernetes resources + mark record as `deleting`
- Frontend `Database.jsx` wired to real API (replace mock data)

### Phase C — API Keys
- `POST /api-keys` — generate key, return once, store hash only
- `DELETE /api-keys/:id` — revoke (set `revoked_at`)
- Show key prefix + creation date in dashboard (never show full key again)

### Phase D — Security hardening
- `helmet` + `express-rate-limit` added to Express
- Rate limiting per API key at the DB Gateway level
- TLS on the DB Gateway (respond `'S'` to SSLRequest, handle handshake)
- Full secrets in AWS Secrets Manager, no `.env` in production

### Phase E — Billing + metrics
- Stripe integration for subscription management
- Prometheus metrics from CNPG clusters surfaced in the dashboard

---

## 9. Mistakes to Avoid

| Mistake | Why it's wrong | What to do instead |
|---|---|---|
| Storing API keys in plaintext | Catastrophic if DB is compromised | Always SHA-256 hash before storing |
| Using JWT for database connections | JWT is for the dashboard only | Use static API keys for DB routing |
| Sharing one PgBouncer for all tenants | Cross-tenant credential leakage risk | One PgBouncer per tenant |
| Exposing CNPG clusters directly to internet | PostgreSQL not designed to be internet-facing | Always put behind Gateway + PgBouncer |
| Putting all tenants in one Kubernetes namespace | Hard to isolate, hard to apply NetworkPolicy | One namespace per tenant |
| Using ALB for TCP/PostgreSQL | ALB is HTTP only | Use NLB for TCP |
| Hardcoding AWS credentials | Security risk | Use IRSA (IAM Roles for Service Accounts) |
| Storing secrets in ConfigMaps | ConfigMaps are not encrypted at rest | Use Kubernetes Secrets + External Secrets Operator |

---

## 10. Key DNS and Networking Facts (EKS)

```
# Internal cluster DNS pattern
<service>.<namespace>.svc.cluster.local

# Control Plane → PgBouncer (cross-namespace)
pgbouncer.tenant-abc123.svc.cluster.local:5432

# PgBouncer → CNPG primary
cluster-tenant-abc123-rw.tenant-abc123.svc.cluster.local:5432
```

---

## 11. Technology Versions (pin these)

| Component | Version |
|---|---|
| Node.js | 20.x |
| TypeScript | 6.x |
| Prisma | 7.x |
| React | 18.x |
| CloudNativePG operator | 1.23.x |
| PgBouncer | 1.22.x |
| PostgreSQL | 16.x |
| Kubernetes | 1.29+ (EKS managed) |
| AWS Load Balancer Controller | 2.7.x |
| External Secrets Operator | 0.9.x |

---

## 12. Glossary

| Term | Meaning in this project |
|---|---|
| DB Gateway | The Go TCP proxy (separate repo) — reads PostgreSQL startup packets and routes to PgBouncer |
| Control Plane | This repo — the REST API and React dashboard for tenant self-service |
| Tenant | A customer who has signed up for our platform |
| API Key | A static token (`sk_live_...`) used to authenticate database TCP connections |
| Tenant Registry | Our internal PostgreSQL DB storing users, keys, and cluster routing info |
| CNPG | CloudNativePG — Kubernetes operator managing PostgreSQL clusters |
| PgBouncer | Connection pooler sitting between the DB Gateway and CNPG |
| ClusterIP | Kubernetes service type only accessible inside the cluster |
| NLB | AWS Network Load Balancer — handles TCP passthrough (used for the DB Gateway) |
| IRSA | IAM Roles for Service Accounts — AWS way to give pods IAM permissions safely |
