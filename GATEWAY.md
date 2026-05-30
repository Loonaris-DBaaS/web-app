# DB Gateway Architecture & Control Plane Contract

> This document defines the routing data path, API contract, and key format that connects the Go TCP gateway to the Express control plane.

---

## 1. High-Level Architecture

```text
  Client (psql, pgx, etc.)
       │
       │  connects to db.loonaris.tech:5432
       ▼
  ┌─────────────────────────┐
  │   DB Gateway (Go)       │  EKS — System Plane Node
  │                         │
  │  1. Reads PG startup    │
  │  2. Extracts API key   │
  │  3. SHA-256 hashes it  │
  │  4. Looks up route     │
  └──────┬──────────┬───────┘
         │          │
    Cache HIT    Cache MISS
         │          │
         │          ▼
         │   GET /api/internal/routes/{hash}
         │   Authorization: Bearer <INTERNAL_GATEWAY_SECRET>
         │   ──────────────────────────────────────
         │   Express Backend (ECS Fargate)
         │   Queries: ApiKey → Project → Pooler
         │   Maps: ProjectStatus.running → "active"
         │   Returns: { tenant_id, pgbouncer_rw_host, ... }
         │
         ▼
  Route found, status == "active"
         │
         │  net.Dial("tcp", host:port) inside EKS
         ▼
  ┌─────────────────────────────────────────────┐
  │  Namespace: project-{id}                    │  EKS — Tenant Plane Nodes
  │                                             │
  │  PgBouncer RW ──► CNPG Primary (writes)    │
  │  PgBouncer RO ──► CNPG Replica  (reads)    │
  └─────────────────────────────────────────────┘
```

---

## 2. API Key Format

Every project gets one base key. The client chooses read-write or read-only by appending the mode suffix.

```text
sk_live_<64-hex-characters>_<mode>
```

Format breakdown: prefix (`sk_live_`) + base key (64 hex chars) + mode suffix (`_rw` or `_ro`).

- **Prefix:** `sk_live_`
- **Base Key:** 64 lowercase hex characters, generated with `crypto.randomBytes(32).toString('hex')`
- **Mode suffix:** `_rw` (read-write → Primary) or `_ro` (read-only → Replica)

### Security

The base key is **never stored in plaintext**. Only its SHA-256 hex hash (`crypto.createHash('sha256').update(baseKey).digest('hex')`) is saved to the `api_keys.key_hash` column.

The same base key works for both modes: `sk_live_{baseKey}_rw` and `sk_live_{baseKey}_ro`. The gateway splits the key and routes accordingly.

---

## 3. Gateway Routing Flow (Step by Step)

```
1. Client connects to db.loonaris.tech:5432
2. Gateway reads PostgreSQL startup packet (handles SSLRequest and GSSENCRequest)
3. Extracts the "user" field → e.g. "sk_live_a3f9..._rw"
4. ParseTenantKey() validates format, splits into baseKey + mode, computes SHA-256
5. lookupRoute(keyHash)
   a. Cache HIT (entry fresh within 60s) → use cached TenantRoute
   b. Cache MISS → GET https://loonaris.tech/api/internal/routes/{keyHash}
6. If status ≠ "active" → drop connection silently (zero bytes returned)
7. mode=="rw" → tunnel to pooler-rw-svc.project-{id}.svc.cluster.local:5432
   mode=="ro" → tunnel to pooler-ro-svc.project-{id}.svc.cluster.local:5432
8. Bidirectional io.Copy until either side closes
```

---

## 4. Control Plane API Contract

### Endpoint

```
GET /api/internal/routes/:keyHash
Authorization: Bearer <INTERNAL_GATEWAY_SECRET>
Accept: application/json
```

Authentication is via a **shared Bearer secret** (`INTERNAL_GATEWAY_SECRET` env var), NOT JWT. This is a machine-to-machine endpoint used exclusively by the gateway.

### 200 OK — Active Route

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

### 400 Bad Request — Invalid key hash format

```json
{ "error": "Invalid key hash format" }
```

### 401 Unauthorized — Missing or wrong Bearer token

```json
{ "error": "Unauthorized" }
```

### 404 Not Found — Key not found or revoked

```json
{ "error": "Route not found" }
```

### Status Mapping

The Prisma enum `ProjectStatus` uses database values that differ from what the gateway expects:

| Prisma `ProjectStatus` | Gateway `status` | Gateway behavior |
|---|---|---|
| `running` | `"active"` | Accept connection, tunnel to PgBouncer |
| `provisioning` | `"provisioning"` | Drop connection silently |
| `stopped` | `"stopped"` | Drop connection silently |
| `error` | `"error"` | Drop connection silently |
| `deleting` | `"deleting"` | Drop connection silently |

This mapping is implemented in `internal.service.ts`.

---

## 5. Database Lookup (Internal Service)

When the gateway calls `/api/internal/routes/:keyHash`, the Express backend:

```sql
SELECT api_keys.key_hash, api_keys.revoked_at,
       projects.k8s_namespace, projects.status,
       poolers.rw_host, poolers.rw_port, poolers.ro_host, poolers.ro_port
FROM api_keys
JOIN projects ON api_keys.project_id = projects.id
JOIN poolers ON poolers.project_id = projects.id
WHERE api_keys.key_hash = $1
  AND api_keys.revoked_at IS NULL
```

- If `revoked_at IS NOT NULL` → return 404
- If no record found → return 404
- Map `projects.status = "running"` → `"active"` in the response

---

## 6. Gateway Implementation Details

### Source Code (`db-gateway/internal/gateway/`)

| File | Purpose |
|---|---|
| `key.go` | `ParseTenantKey()` — regex validation + SHA-256 hashing |
| `cache.go` | `TenantRoute` struct, `sync.Map` with 60s TTL, `lookupRoute()` |
| `api.go` | `fetchRouteFromControlPlane()` — HTTP client with 5s timeout, Bearer auth |
| `singleflight.go` | Deduplication for concurrent cache misses (thundering herd protection) |
| `server.go` | TCP listener, `Config` struct, graceful shutdown |
| `session.go` | Per-connection handler: SSL/GSSENC rejection, key parsing, 30s read deadline |
| `tunnel.go` | RW/RO route selection, `net.DialTimeout` 10s, bidirectional `io.Copy` |

### Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5432` | TCP listen port |
| `CONTROL_PLANE_URL` | `https://loonaris.tech/api` | Express backend base URL |
| `INTERNAL_GATEWAY_SECRET` | _(none)_ | Bearer token shared with Express backend |

### Cache Behavior

- TTL: 60 seconds per entry
- Storage: `sync.Map` (lock-free concurrent reads)
- Dedup: `singleflight` groups concurrent misses for the same keyHash
- On 404 from control plane: cache miss returns error, connection dropped

---

## 7. Local Integration Test (Docker)

The `docker-compose.yml` in `db-gateway/` spins up:
- The Go gateway on port `35432`
- A stub API server returning fixture routes for 3 tenants
- 6 PgBouncer instances (3 RW + 3 RO)
- 1 PostgreSQL server with 3 databases

```bash
cd db-gateway
docker compose up --build
psql "host=localhost port=35432 user=sk_live_aaa..._rw dbname=app_test1"
```

See `db-gateway/docker/stub-api/routes.json` for the test fixture data.