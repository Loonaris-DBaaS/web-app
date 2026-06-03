# Provisioning Engine Design

> Internal documentation for the Loonaris DBaaS provisioning pipeline, API key lifecycle, and the gateway routing contract.

---

## 1. Tenant → Project → Namespace Model

A **Tenant** represents a registered user. A tenant can own multiple **Projects**, each corresponding to an isolated PostgreSQL cluster.

```
Tenant (user)
  └── Project 1 (namespace: project-uuid1)
      ├── CNPG Cluster (instance-db)
      ├── PgBouncer RW (pooler-rw-svc.project-uuid1.svc.cluster.local:5432)
      ├── PgBouncer RO (pooler-ro-svc.project-uuid1.svc.cluster.local:5432)
      ├── ApiKey (one per project, sk_live_ format)
      ├── ResourceConfig (CPU, RAM, storage, replicas)
      └── Pooler (host/port for RW and RO)
  └── Project 2 (namespace: project-uuid2)
      └── ...
```

**Key rule:** One Kubernetes namespace per project. Format: `project-{id}` (never `tenant-`).

---

## 2. API Key Lifecycle

### Key Format

```
sk_live_{64_hex_characters}_{mode}
```

- **Prefix:** `sk_live_` — identifies this as a Loonaris live key
- **Base key:** 64 lowercase hex characters (`crypto.randomBytes(32).toString('hex')`)
- **Mode suffix:** `_rw` (read-write) or `_ro` (read-only)

### Key Generation Flow

When a project is created (`createCluster`):

1. Generate a single 64-hex random base key: `generateBaseKey()` → `crypto.randomBytes(32).toString('hex')`
2. Compute the SHA-256 hash: `sha256Hex(baseKey)` → stored in `api_keys.key_hash`
3. Store in database:
   - `key_hash` = SHA-256 of the base key
   - `prefix` = `"sk_live_"`
   - `project_id` = the project ID
4. Return the full key to the user: `sk_live_{baseKey}_rw`
   - The user can also use `sk_live_{baseKey}_ro` — same base key, different mode suffix
5. **Never store the plaintext base key** — only its SHA-256 hash

### Key Lookup (Gateway → Control Plane)

```
1. Client connects with user="sk_live_a3f9...64hex_rw"
2. Gateway parses: baseKey="a3f9...64hex", mode="rw"
3. Gateway computes: keyHash = SHA256(baseKey)
4. Gateway calls: GET /api/internal/routes/{keyHash}
5. Backend looks up ApiKey WHERE key_hash = keyHash AND revoked_at IS NULL
6. Backend joins Project + Pooler to build the route response
```

### Key Revocation

Setting `revoked_at` on the `ApiKey` row causes the internal route endpoint to return 404, and the gateway drops the connection. The cache TTL (60s) means revoked keys may still work for up to 60 seconds.

---

## 3. Pooler Model (Host/Port)

The `Pooler` model stores structured K8s FQDNs, not connection strings:

| Field     | Example                                            | Purpose                   |
| --------- | -------------------------------------------------- | ------------------------- |
| `rw_host` | `pooler-rw-svc.project-abc12345.svc.cluster.local` | PgBouncer RW Service FQDN |
| `rw_port` | `5432`                                             | PgBouncer RW port         |
| `ro_host` | `pooler-ro-svc.project-abc12345.svc.cluster.local` | PgBouncer RO Service FQDN |
| `ro_port` | `5432`                                             | PgBouncer RO port         |

These FQDNs are computed at project creation time from the namespace:

```
rwHost = `pooler-rw-svc.${namespace}.svc.cluster.local`
roHost = `pooler-ro-svc.${namespace}.svc.cluster.local`
```

The pooler is a 1:1 relation with Project (`projectId` is `@unique`).

---

## 4. Internal Routes API Contract

```
GET /api/internal/routes/:keyHash
Authorization: Bearer <INTERNAL_GATEWAY_SECRET>
```

### Response 200 OK

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

### Status Mapping

| Prisma `ProjectStatus` | Gateway `status` | Gateway behavior                       |
| ---------------------- | ---------------- | -------------------------------------- |
| `running`              | `"active"`       | Accept connection, tunnel to PgBouncer |
| `provisioning`         | `"provisioning"` | Drop connection                        |
| `stopped`              | `"stopped"`      | Drop connection                        |
| `error`                | `"error"`        | Drop connection                        |
| `deleting`             | `"deleting"`     | Drop connection                        |

### Response 404 Not Found

Key hash does not exist or `revoked_at IS NOT NULL`.

### Response 401 Unauthorized

Missing or invalid `Authorization: Bearer` header.

---

## 5. Provisioning Phases

### Phase 1: Ingestion & Credential Generation

When `POST /api/clusters` is called:

1. Generate `clusterId` (UUID) and `namespace = project-{clusterId}`
2. Generate base key, compute SHA-256 hash
3. Compute PgBouncer FQDNs from namespace
4. Create Prisma record: Project (status=`provisioning`), ResourceConfig, Pooler, ApiKey
5. Call `provisionCluster(clusterId, namespace, dto)` which applies K8s manifests

### Phase 2: K8s Manifest Application

The `applyManifests()` function applies 7 manifests in order:

1. **Namespace** — `project-{id}` with tenant label
2. **Secret** — Database credentials
3. **CNPG Cluster** — PostgreSQL cluster with tolerations and topology spread
4. **PgBouncer RW Deployment** — Targets `instance-db-rw` CNPG service
5. **PgBouncer RW Service** — `pooler-rw-svc`
6. **PgBouncer RO Deployment** — Targets `instance-db-ro` CNPG service
7. **PgBouncer RO Service** — `pooler-ro-svc`

### Phase 3: Activation Polling

After applying manifests, `pollClusterHealth()` polls the CNPG cluster status every 5 seconds:

```
GET /apis/postgresql.cnpg.io/v1/namespaces/{ns}/clusters/instance-db
→ status.phase == "Healthy" → return "running"
→ otherwise → wait 5s, retry (max 60 attempts = 5 minutes)
→ timeout → return "error"
```

Once the project status is updated to `running`, the gateway will accept connections (mapped to `"active"` via the internal routes API).

### Deprovisioning

`DELETE /api/clusters/:id` triggers:

1. Delete CNPG Cluster CR
2. Delete the entire namespace (cascades all resources)
3. Set project status to `deleting`

---

## 6. Source Code Map

| File                                                      | Purpose                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/middleware/internalAuth.ts`                          | Bearer token auth for gateway (shared secret, not JWT)             |
| `src/modules/internal/routes.ts`                          | Express router: `GET /routes/:keyHash`                             |
| `src/modules/internal/controllers/internal.controller.ts` | Validates keyHash format, calls service                            |
| `src/modules/internal/services/internal.service.ts`       | Queries ApiKey → Project → Pooler, maps `running` → `active`       |
| `src/lib/crypto.ts`                                       | `generateBaseKey()`, `sha256Hex()`, `formatApiKey()`               |
| `src/modules/pgCluster/services/pgCluster.service.ts`     | Creates project, generates keys, creates Pooler/ApiKey records     |
| `src/modules/pgCluster/provisioning/provisioning.ts`      | K8s manifest generation, apply, activation polling, deprovisioning |

---

## 7. Environment Variables

| Variable                  | Required      | Purpose                                           |
| ------------------------- | ------------- | ------------------------------------------------- |
| `INTERNAL_GATEWAY_SECRET` | Yes           | Shared secret between gateway and Express backend |
| `KUBECONFIG`              | In production | Path to kubeconfig for EKS cluster access         |
| `DATABASE_URL`            | Yes           | PostgreSQL connection string                      |
| `JWT_SECRET`              | Yes           | JWT signing key for dashboard auth                |

---

## 8. Critical Rules

1. **Never store plaintext base keys** — always SHA-256 hash before writing to `api_keys`
2. **One namespace per project** — format `project-{uuid}`, not `tenant-`
3. **`ProjectStatus.running` maps to `"active"`** in the gateway response — no other status is accepted
4. **Internal routes use Bearer secret auth, not JWT** — separate middleware
5. **Never write Prisma migration SQL manually** — always use `npx prisma migrate dev --create-only`
6. **PgBouncer hosts follow the pattern** `pooler-{rw|ro}-svc.project-{id}.svc.cluster.local`
7. **Deprovisioning deletes the entire namespace** — K8s cascades all child resources
