# Loonaris DB Connection Key — Hashing & Verification Workflow

---

## Key Format

```
sk_live_<64_hex_chars>_<mode>
        │              │
        baseKey         rw | ro
```

- `baseKey`: 256-bit random value (`crypto.randomBytes(32).toString('hex')`)
- `mode`: `rw` (read-write) or `ro` (read-only)

## Why Plain SHA-256 (No Secret / Pepper / HMAC)

The `baseKey` is **32 bytes of cryptographic randomness** (2^256 entropy). This makes it immune to:

- **Brute-force** — 2^256 is infeasible even with unlimited compute
- **Rainbow tables** — keyspace is too large to precompute
- **Reversal** — SHA-256 is one-way, and the input has too much entropy to guess

A secret pepper would add no meaningful security while creating operational problems:

- Pepper must exist in **both** backend (Node.js) and gateway (Go) env vars
- Rotating the pepper invalidates **all** existing keys simultaneously
- Increases attack surface (compromise of either service exposes the pepper)

**Conclusion: Plain SHA-256 is correct. The 256-bit random base key IS the security boundary.**

---

## Creation Flow

```
1. baseKey = crypto.randomBytes(32).toString('hex')   // 64 hex chars
2. keyHash = SHA256(baseKey)                            // irreversible hash for DB
3. prefix  = "sk_live_" + baseKey.slice(0, 8) + "..."   // for dashboard display
4. Store in DB:  ApiKey { keyHash, prefix, projectId, mode }
5. Return to user ONCE:  "sk_live_{baseKey}_rw" / "sk_live_{baseKey}_ro"
   → Plaintext is NEVER stored anywhere after this response
```

## DB Schema (`api_keys` table)

| Column | Value | Note |
|---|---|---|
| `key_hash` | `SHA256(baseKey)` | Unique index, used for lookup |
| `prefix` | `sk_live_a3f9...` | Dashboard display only |
| `project_id` | UUID | Links to Project/Pooler |
| `revoked_at` | nullable | For key revocation |
| plaintext | `NULL` | **Never stored** |

### Prisma Model

```prisma
model ApiKey {
  id        String    @id @default(uuid())
  keyHash   String    @unique @map("key_hash")
  prefix    String
  duration  Int
  createdAt DateTime  @default(now()) @map("created_at")
  revokedAt DateTime? @map("revoked_at")

  projectId String  @map("project_id")
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@map("api_keys")
}
```

---

## Verification Flow (Gateway Connection)

```
Client connects → db.loonaris.tech:5432
       │
       ▼
Gateway reads PostgreSQL startup packet
  user field = "sk_live_a3f9...64hex_rw"
       │
       ▼
Gateway ParseTenantKey():
  regex: ^sk_live_([a-f0-9]{64})_(rw|ro)$
  baseKey = captured group 1
  mode    = captured group 2
  keyHash = SHA256(baseKey)           // same function backend used
       │
       ▼
Gateway lookupRoute(keyHash):
  Cache HIT (≤60s) → use cached route
  Cache MISS → GET /api/internal/routes/{keyHash}
               Authorization: Bearer <INTERNAL_GATEWAY_SECRET>
       │
       ▼
Backend /api/internal/routes/:keyHash:
  1. internalAuth middleware validates Bearer shared secret
  2. Find ApiKey WHERE keyHash = :keyHash
  3. Load ApiKey → Project → Pooler
  4. Map Project.status:  "running" → "active"
  5. Return:
     {
       "tenant_id": "project-abc12345",
       "pgbouncer_rw_host": "pooler-rw-svc.project-abc12345.svc.cluster.local",
       "pgbouncer_rw_port": 5432,
       "pgbouncer_ro_host": "pooler-ro-svc.project-abc12345.svc.cluster.local",
       "pgbouncer_ro_port": 5432,
       "status": "active"
     }
       │
       ▼
Gateway:
  status != "active" → drop connection silently
  mode == "rw"  → tunnel to pgbouncer_rw_host:5432
  mode == "ro"  → tunnel to pgbouncer_ro_host:5432
       │
       ▼
Bidirectional io.Copy until either side closes
```

---

## Security Properties

| Property | Mechanism |
|---|---|
| Plaintext never stored | Only SHA-256 hash goes in DB |
| Irreversible | SHA-256 + 256-bit entropy = no feasible reversal |
| Key shown once | Returned only at creation; never recoverable |
| Revocable | Set `revoked_at` → gateway rejects via status check |
| Mode separation | RW and RO are separate keys with separate K8s routes |
| Shared secret auth | Gateway ↔ Backend uses Bearer token, not JWT |

---

## Implementation Status

| Component | Status |
|---|---|
| `crypto.ts` (hash/generate) | **Not built** |
| `ApiKey` creation in cluster service | **Not built** |
| `internal/` module (gateway endpoint) | **Not built** |
| `internalAuth.ts` middleware | **Not built** |
| Gateway `key.go` (parse + SHA256) | **Not built** |
| Gateway `cache.go`, `api.go` | **Not built** |
| Prisma `ApiKey` model | **Defined** in schema |
| Gateway `tunnel.go` | **Stub** — hardcoded map |