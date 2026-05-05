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
| DB Gateway language | Go (team lead is a complete beginner) |
| Control Plane language | Node.js + Express |
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

---

## 2. Full System Architecture

```
External App (psql / ORM)
        │
        ▼
  ┌─────────────────────────────────┐
  │     DB Gateway (Go service)     │  ← Our core product
  │  - TCP server (port 5432)       │
  │  - Reads PostgreSQL startup     │
  │    packet                       │
  │  - Extracts API key from        │
  │    username field               │
  │  - Looks up tenant in registry  │
  │  - Routes to correct PgBouncer  │
  └──────────────┬──────────────────┘
                 │ routes per tenant
        ┌────────┴────────┐
        ▼                 ▼
  PgBouncer-T1      PgBouncer-T2      (one per tenant, ClusterIP)
        │                 │
        ▼                 ▼
  CNPG Cluster-T1   CNPG Cluster-T2   (isolated PostgreSQL clusters)
```

### Control Plane (separate system — Node.js + Express)
```
Browser / Dashboard
        │
        ▼
  REST API (Express / Node.js)
        │
  JWT Auth (user login)
        │
  ┌─────────────────────┐
  │  Tenant Registry DB │  ← stores: tenants, API keys, cluster mappings
  └─────────────────────┘
```

---

## 3. The Two Identity Systems (CRITICAL — never confuse these)

### 3A. Web Console Identity → JWT

- Used when: a human logs into the dashboard
- Flow: `POST /login` → validate credentials → return JWT
- JWT is used for: creating databases, managing billing, inviting team members, viewing metrics
- JWT is **NEVER** used for database TCP connections
- Stored in: browser (httpOnly cookie or localStorage)
- Validated by: the REST API / control plane

### 3B. Database Connection Identity → API Key

- Used when: an external application connects to `db.ourplatform.com:5432`
- Format: `postgres://sk_live_abc123@db.ourplatform.com/mydb`
- The API key (`sk_live_abc123`) is in the **PostgreSQL username field**
- Flow:
  1. Client sends PostgreSQL startup packet
  2. DB Gateway reads the startup packet
  3. Extracts `sk_live_abc123` from the `user` field
  4. Looks up the key in the tenant registry
  5. Gets back: `{ tenant_id, pgbouncer_host, pgbouncer_port }`
  6. Opens a TCP connection to that PgBouncer
  7. Tunnels the stream bidirectionally
- API keys are **statically generated** — no expiry by default, can be revoked
- Prefix conventions: `sk_live_` for production, `sk_test_` for sandbox

---

## 4. Component Breakdown

### 4A. DB Gateway (our core product — Go)

**What it is:** A custom TCP proxy that understands just enough of the PostgreSQL wire protocol to extract the API key and make a routing decision.

**What it is NOT:** A PostgreSQL server. It does not execute SQL. It does not handle auth challenges. It simply reads the first packet, makes a decision, then blindly tunnels bytes.

**Key responsibilities:**
- Listen on port 5432 (TCP)
- Accept incoming connections
- Read the PostgreSQL startup packet (first ~100–200 bytes)
- Parse the key-value parameters inside it (user, database, application_name, etc.)
- Validate the API key against the registry
- Look up PgBouncer address for this tenant
- Establish TCP connection to PgBouncer
- Tunnel data in both directions using `io.Copy` in goroutines
- Handle errors and disconnections cleanly

**What it does NOT do:**
- Does not terminate TLS on its own (TLS termination handled upstream or added later)
- Does not execute SQL
- Does not manage PostgreSQL auth handshake (delegated to PgBouncer/CNPG)

### 4B. PgBouncer (one per tenant)

**What it is:** A lightweight connection pooler for PostgreSQL.

**Why we need it:**
- PostgreSQL can handle ~100–300 connections per cluster
- Our tenants may have hundreds of app servers opening connections
- PgBouncer pools idle connections and reuses them

**Deployment:**
- One PgBouncer Deployment per tenant in Kubernetes
- Exposed as ClusterIP service (not public — only accessible inside the cluster)
- Configured in **transaction pooling mode** (best for web apps / ORMs)
- Config is stored in a Kubernetes ConfigMap per tenant

**Key config values per tenant:**
```ini
[databases]
tenant_db = host=<cnpg-rw-service> port=5432 dbname=<dbname>

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
```

### 4C. CloudNativePG (CNPG) — one cluster per tenant

**What it is:** A Kubernetes operator that manages PostgreSQL clusters as native Kubernetes resources.

**Why we use it:**
- Declarative cluster management (YAML → Postgres cluster)
- Automatic failover (primary crashes → replica promoted automatically)
- Backup integration (S3/EBS snapshots)
- Native Kubernetes service integration

**Key services created per cluster:**
| Service | Purpose |
|---|---|
| `<cluster>-rw` | Points to primary (read + write) |
| `<cluster>-ro` | Points to replicas (read only) |
| `<cluster>-r` | Points to any instance |

**PgBouncer connects to `<cluster>-rw`** for all tenant traffic.

**Per-tenant isolation:**
- Each tenant gets their own CNPG `Cluster` resource
- Each cluster lives in its own Kubernetes Namespace (e.g., `tenant-abc123`)
- No shared PostgreSQL instances between tenants (hard isolation)

### 4D. Tenant Registry

**What it is:** A PostgreSQL database (our own internal DB — not a tenant DB) that stores platform metadata.

**Key tables:**

```sql
-- Tenants
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- API keys for database connections
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  key_hash TEXT UNIQUE NOT NULL,  -- store SHA-256 hash, never plaintext
  prefix TEXT NOT NULL,           -- e.g. "sk_live_abc" for display
  created_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

-- Cluster routing table
CREATE TABLE tenant_clusters (
  tenant_id UUID REFERENCES tenants(id),
  pgbouncer_host TEXT NOT NULL,   -- Kubernetes service DNS
  pgbouncer_port INT DEFAULT 5432,
  namespace TEXT NOT NULL,
  status TEXT DEFAULT 'active'    -- active, provisioning, suspended
);
```

**API key lookup flow in the gateway:**
1. Extract raw key from startup packet (`sk_live_abc123`)
2. Hash it: `SHA256("sk_live_abc123")` → `deadbeef...`
3. Query: `SELECT tenant_id FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL`
4. Query: `SELECT pgbouncer_host, pgbouncer_port FROM tenant_clusters WHERE tenant_id = $1`
5. Connect and route

**Caching:** The registry lookup result is cached in-memory (e.g., in a `sync.Map` with TTL) to avoid hitting the DB on every new connection.

---

## 5. Go Patterns to Follow (beginner-safe)

Since the lead developer is new to Go, we use simple, explicit patterns. No premature abstractions.

### Project Structure

```
dbgateway/
├── cmd/
│   └── gateway/
│       └── main.go          ← entry point
├── internal/
│   ├── gateway/
│   │   ├── server.go        ← TCP server, accept loop
│   │   ├── handler.go       ← per-connection logic
│   │   └── tunnel.go        ← bidirectional io.Copy
│   ├── protocol/
│   │   └── startup.go       ← PostgreSQL startup packet parser
│   ├── registry/
│   │   ├── lookup.go        ← API key → tenant lookup
│   │   └── cache.go         ← in-memory cache
│   └── config/
│       └── config.go        ← env var loading
├── go.mod
└── go.sum
```

### TCP Server Pattern (use this, don't invent another)

```go
// internal/gateway/server.go
package gateway

import (
    "log"
    "net"
)

type Server struct {
    addr     string
    registry *registry.Registry
}

func (s *Server) Run() error {
    ln, err := net.Listen("tcp", s.addr)
    if err != nil {
        return err
    }
    log.Printf("Gateway listening on %s", s.addr)

    for {
        conn, err := ln.Accept()
        if err != nil {
            log.Printf("accept error: %v", err)
            continue
        }
        go s.handleConnection(conn)  // each connection = one goroutine
    }
}
```

### Bidirectional Tunnel Pattern

```go
// internal/gateway/tunnel.go
package gateway

import (
    "io"
    "net"
)

func tunnel(client, backend net.Conn) {
    defer client.Close()
    defer backend.Close()

    done := make(chan struct{}, 2)

    go func() {
        io.Copy(backend, client)
        done <- struct{}{}
    }()

    go func() {
        io.Copy(client, backend)
        done <- struct{}{}
    }()

    <-done // wait for either direction to finish, then close both
}
```

### Error Handling Rule

Always check errors. Never use `_` to ignore them except in deferred `Close()` calls.

```go
// WRONG
data, _ := io.ReadAll(conn)

// RIGHT
data, err := io.ReadAll(conn)
if err != nil {
    log.Printf("read error: %v", err)
    return
}
```

### Config Loading Pattern

Load all config from environment variables using a single struct:

```go
// internal/config/config.go
package config

import "os"

type Config struct {
    ListenAddr  string
    RegistryDSN string
    LogLevel    string
}

func Load() Config {
    return Config{
        ListenAddr:  getEnv("LISTEN_ADDR", ":5432"),
        RegistryDSN: getEnv("REGISTRY_DSN", ""),
        LogLevel:    getEnv("LOG_LEVEL", "info"),
    }
}

func getEnv(key, fallback string) string {
    if v := os.Getenv(key); v != "" {
        return v
    }
    return fallback
}
```

### Dependency Injection Rule

Pass dependencies explicitly. No global variables except logger and config.

```go
// WRONG
var globalRegistry *Registry

// RIGHT
type Handler struct {
    registry *Registry
    logger   *log.Logger
}
```

---

## 5B. Express / Node.js Patterns to Follow (Control Plane)

### Project Structure

```
control-plane/
├── src/
│   ├── app.js                 ← Express app setup, middleware
│   ├── server.js              ← entry point (listen)
│   ├── routes/
│   │   ├── auth.js            ← /auth/register, /auth/login, /auth/refresh
│   │   ├── databases.js       ← /databases CRUD + provisioning
│   │   └── apiKeys.js         ← /api-keys create + revoke
│   ├── middleware/
│   │   ├── auth.js            ← JWT validation middleware
│   │   └── errorHandler.js    ← global error handler
│   ├── services/
│   │   ├── provisioner.js     ← calls Kubernetes API to create CNPG + PgBouncer
│   │   ├── apiKeyService.js   ← generate, hash, store keys
│   │   └── jwtService.js      ← sign, verify tokens
│   ├── db/
│   │   └── pool.js            ← pg Pool singleton
│   └── config.js              ← env var loading
├── package.json
└── .env.example
```

### JWT Pattern (RS256)

```js
// services/jwtService.js
const jwt = require('jsonwebtoken');
const fs = require('fs');

const privateKey = fs.readFileSync(process.env.JWT_PRIVATE_KEY_PATH);
const publicKey = fs.readFileSync(process.env.JWT_PUBLIC_KEY_PATH);

function signAccessToken(payload) {
  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: '15m',
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, publicKey, { algorithms: ['RS256'] });
}

module.exports = { signAccessToken, verifyAccessToken };
```

### Auth Middleware Pattern

```js
// middleware/auth.js
const { verifyAccessToken } = require('../services/jwtService');

module.exports = function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    const token = authHeader.slice(7);
    req.user = verifyAccessToken(token);  // { sub, tenant_id, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
```

### DB Pool Pattern (pg)

```js
// db/pool.js
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.REGISTRY_DSN });

module.exports = pool;

// Usage in a route:
// const pool = require('../db/pool');
// const { rows } = await pool.query('SELECT * FROM tenants WHERE id = $1', [id]);
```

### API Key Generation Pattern

```js
// services/apiKeyService.js
const crypto = require('crypto');

function generateApiKey() {
  const raw = crypto.randomBytes(32).toString('hex');
  return `sk_live_${raw}`;
}

function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

module.exports = { generateApiKey, hashApiKey };

// On creation:
// 1. const key = generateApiKey()       → return to user ONCE
// 2. const hash = hashApiKey(key)       → store this in DB
// Never store the raw key.
```

### Error Handling Rule

Always use async/await with try/catch, or a wrapper. Never let unhandled promise rejections crash the server.

```js
// Wrap async route handlers
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Usage
router.post('/databases', requireAuth, asyncHandler(async (req, res) => {
  const db = await provisionDatabase(req.user.tenant_id);
  res.status(201).json(db);
}));

// Global error handler in app.js
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});
```

### Key packages

```json
{
  "dependencies": {
    "express": "^4.18.x",
    "pg": "^8.x",
    "jsonwebtoken": "^9.x",
    "bcrypt": "^5.x",
    "@kubernetes/client-node": "^0.20.x",
    "helmet": "^7.x",
    "express-rate-limit": "^7.x",
    "cookie-parser": "^1.x",
    "dotenv": "^16.x"
  }
}
```



When a PostgreSQL client connects, the very first thing it sends is a **startup message**.

### Binary format:
```
[4 bytes]  total message length (int32, big-endian)
[4 bytes]  protocol version (int32) — always 196608 (= 3.0)
[N bytes]  key=value pairs separated by \0
[1 byte]   final \0 terminator
```

### Example key-value pairs:
```
user=sk_live_abc123\0
database=mydb\0
application_name=myapp\0
\0
```

### Parser (Go):
```go
// internal/protocol/startup.go
package protocol

import (
    "encoding/binary"
    "fmt"
    "io"
    "net"
)

type StartupMessage struct {
    Parameters map[string]string
    Raw        []byte  // keep a copy to forward to PgBouncer
}

func ReadStartupMessage(conn net.Conn) (*StartupMessage, error) {
    // Read 4-byte length
    var length int32
    if err := binary.Read(conn, binary.BigEndian, &length); err != nil {
        return nil, fmt.Errorf("read length: %w", err)
    }

    // Read the rest of the message
    body := make([]byte, length-4)
    if _, err := io.ReadFull(conn, body); err != nil {
        return nil, fmt.Errorf("read body: %w", err)
    }

    // Skip protocol version (first 4 bytes of body)
    params := parseKeyValues(body[4:])

    // Reconstruct raw bytes for forwarding
    raw := make([]byte, length)
    binary.BigEndian.PutUint32(raw, uint32(length))
    copy(raw[4:], body)

    return &StartupMessage{Parameters: params, Raw: raw}, nil
}

func parseKeyValues(data []byte) map[string]string {
    params := make(map[string]string)
    pairs := splitNull(data)
    for i := 0; i+1 < len(pairs); i += 2 {
        if pairs[i] != "" {
            params[pairs[i]] = pairs[i+1]
        }
    }
    return params
}
```

**After parsing:**
- `msg.Parameters["user"]` → `"sk_live_abc123"` — this is our API key
- `msg.Parameters["database"]` → `"mydb"`
- Forward `msg.Raw` verbatim to PgBouncer (don't re-serialize)

---

## 6B. TLS / SSLRequest Handling (CRITICAL — read before writing the handler)

### The problem

PostgreSQL has its own TLS negotiation that happens **before** the startup packet. If a client connects with `sslmode=require` or `sslmode=prefer`, it sends an SSLRequest message first. If your Gateway ignores it or responds with garbage, the connection fails — the startup packet is never sent.

### SSLRequest format

```
[4 bytes] message length = 8 (int32, big-endian)
[4 bytes] SSL request code = 80877103 (int32, big-endian)
```

Total: exactly 8 bytes. This arrives before anything else.

### Server response: one single byte

```
'S'  → yes, I support TLS — client will do TLS handshake next
'N'  → no TLS — client falls back to plain TCP (only works with sslmode=prefer, not sslmode=require)
```

### Detection logic (must run BEFORE startup packet parsing)

```go
// Read first 4 bytes to get message length
var msgLen int32
binary.Read(conn, binary.BigEndian, &msgLen)

if msgLen == 8 {
    // Could be SSLRequest — read next 4 bytes to check code
    var code int32
    binary.Read(conn, binary.BigEndian, &code)

    if code == 80877103 {
        // It IS an SSLRequest
        // → MVP: reject with 'N'
        conn.Write([]byte{'N'})
        // → now read the real startup packet normally
    }
} else {
    // Not an SSLRequest — msgLen is the startup packet length
    // handle normally
}
```

### Option A — Reject SSL, respond 'N' (MVP / dev)

Client must use `sslmode=disable` or `sslmode=prefer`.  
Breaks clients using `sslmode=require`.  
Simple to implement — no certificates needed.

### Option B — Handle TLS in the Gateway (production)

Gateway responds `'S'`, performs TLS handshake using Go's `crypto/tls`, then reads the startup packet from the decrypted stream.

```go
import "crypto/tls"

tlsCert, _ := tls.LoadX509KeyPair("cert.pem", "key.pem")
tlsConfig := &tls.Config{Certificates: []tls.Certificate{tlsCert}}

conn.Write([]byte{'S'})                      // tell client: yes, SSL
tlsConn := tls.Server(conn, tlsConfig)       // wrap the connection
if err := tlsConn.Handshake(); err != nil {
    log.Printf("TLS handshake failed: %v", err)
    conn.Close()
    return
}
// from here, read startup packet from tlsConn (decrypted)
```

### Phase plan for this project

| Phase | Approach | Client sslmode |
|---|---|---|
| MVP / dev | Respond `'N'`, skip TLS | `sslmode=disable` in test clients |
| Production | Handle TLS in Gateway (Option B) | `sslmode=require` works for all clients |

### Key rule

> SSLRequest detection **must happen before** startup packet parsing. It is a separate pre-handshake step. The startup packet parser must never be called on a raw connection without first handling a possible SSLRequest.

---

## 7. Kubernetes / EKS Architecture

### Namespace Strategy

Each tenant gets their own namespace:
```
platform-system        ← DB Gateway, Registry DB, Control Plane API
tenant-<tenant_id>     ← PgBouncer + CNPG Cluster for that tenant
```

### Network Policy

- DB Gateway lives in `platform-system`
- It can reach all `tenant-*` namespaces via ClusterIP services
- Tenant namespaces are isolated from each other (NetworkPolicy)
- CNPG clusters are NOT reachable from outside the cluster

### EKS-specific notes

- Use **AWS Load Balancer Controller** for exposing the gateway (NLB, not ALB — ALB is HTTP only)
- Use **NLB (Network Load Balancer)** with `aws-load-balancer-type: nlb` annotation for TCP passthrough
- Use **EBS CSI driver** for CNPG persistent volumes
- Use **IRSA (IAM Roles for Service Accounts)** for S3 backup access — never hardcode AWS credentials
- Use **AWS Secrets Manager** for storing tenant DB passwords — access via the external-secrets operator

### DB Gateway Service (EKS)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: db-gateway
  namespace: platform-system
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
    service.beta.kubernetes.io/aws-load-balancer-scheme: "internet-facing"
spec:
  type: LoadBalancer
  selector:
    app: db-gateway
  ports:
    - port: 5432
      targetPort: 5432
      protocol: TCP
```

### CloudNativePG Cluster (per tenant)

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: cluster-tenant-abc123
  namespace: tenant-abc123
spec:
  instances: 2          # 1 primary + 1 replica
  primaryUpdateStrategy: unsupervised

  storage:
    size: 10Gi
    storageClass: gp3

  bootstrap:
    initdb:
      database: tenant_db
      owner: app_user

  backup:
    barmanObjectStore:
      destinationPath: s3://our-backups/tenant-abc123
      s3Credentials:
        inheritFromIAMRole: true
```

### PgBouncer Deployment (per tenant)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pgbouncer
  namespace: tenant-abc123
spec:
  replicas: 1
  selector:
    matchLabels:
      app: pgbouncer
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
  namespace: tenant-abc123
spec:
  type: ClusterIP
  selector:
    app: pgbouncer
  ports:
    - port: 5432
      targetPort: 5432
```

### How the DB Gateway finds PgBouncer (DNS)

Inside Kubernetes, services are addressable by:
```
<service-name>.<namespace>.svc.cluster.local
```

So PgBouncer for tenant `abc123` is reachable at:
```
pgbouncer.tenant-abc123.svc.cluster.local:5432
```

This is what we store in `tenant_clusters.pgbouncer_host`.

---

## 8. Security Design

### 8A. API Key Security

- **Never store plaintext API keys** — only store `SHA-256(key)` in the database
- Display key to user only once (on creation) — cannot be retrieved again
- Key format: `sk_live_` prefix + 32 random bytes (base58 encoded) = ~44 chars total
- Generation in Go:
  ```go
  import "crypto/rand"
  import "encoding/hex"

  func GenerateAPIKey() string {
      b := make([]byte, 32)
      rand.Read(b)
      return "sk_live_" + hex.EncodeToString(b)
  }
  ```

### 8B. JWT (Control Plane / Dashboard)

- Algorithm: **RS256** (asymmetric — private key signs, public key verifies)
- Avoid HS256 (symmetric secret shared between services is a risk)
- Claims: `{ sub: user_id, tenant_id, role, exp, iat }`
- Short expiry: 15 minutes access token + 7-day refresh token
- Refresh token stored as httpOnly cookie
- Validated by middleware on every control plane API call

### 8C. TLS

- TLS terminates at the **NLB → Gateway level** (not inside each service)
- Use **AWS ACM** for certificate management (auto-renewed)
- For PostgreSQL connections: clients should connect with `sslmode=require`
- Internal cluster traffic (Gateway → PgBouncer → CNPG) uses cluster-internal TLS (CNPG handles this automatically)

### 8D. Tenant Isolation Layers

| Layer | Isolation mechanism |
|---|---|
| Network | Kubernetes NetworkPolicy (deny cross-tenant) |
| PostgreSQL | Separate CNPG clusters per tenant |
| Pooling | Separate PgBouncer per tenant |
| Compute | Separate pods/namespaces |
| Credentials | Per-tenant DB passwords in Secrets Manager |

### 8E. Rate Limiting

- Applied at the DB Gateway level per API key
- Use a token bucket: N connections per second per key
- Simple in-memory implementation first (single gateway replica)
- Later: Redis-backed rate limiter (when scaling to multiple gateway replicas)

### 8F. Secrets Management on EKS

- Use **AWS Secrets Manager** + **External Secrets Operator**
- Never put secrets in ConfigMaps
- Never hardcode credentials in container images
- DB Gateway reads `REGISTRY_DSN` from a Kubernetes Secret (injected by External Secrets Operator from AWS Secrets Manager)

---

## 9. Phase-by-Phase Build Plan

### Phase 1 — TCP Tunnel (Week 1)
**Goal:** A working TCP proxy in Go.

Tasks:
- [ ] Set up Go project (`go mod init`)
- [ ] Write TCP server that accepts connections
- [ ] Forward all bytes to a hardcoded backend
- [ ] Bidirectional tunnel with `io.Copy`
- [ ] Test with `psql` through the proxy

Done when: `psql -h localhost -p 5432 -U postgres` reaches a real PostgreSQL and works.

---

### Phase 2 — Protocol Parsing (Week 1–2)
**Goal:** Read and understand the startup packet.

Tasks:
- [ ] Implement startup packet reader
- [ ] Extract `user` and `database` fields
- [ ] Log them without modifying the stream
- [ ] Forward the raw startup packet to backend unchanged

Done when: Gateway logs `"connection from user=sk_live_abc123 db=mydb"` correctly.

---

### Phase 3 — Tenant Routing (Week 2)
**Goal:** Route connections to different backends based on API key.

Tasks:
- [ ] Set up the tenant registry DB (internal PostgreSQL)
- [ ] Create `api_keys` and `tenant_clusters` tables
- [ ] Implement key lookup (hash → query → result)
- [ ] Implement in-memory cache with TTL
- [ ] Route to correct backend dynamically

Done when: Two different API keys route to two different backends.

---

### Phase 4 — PgBouncer + CNPG Integration (Week 3)
**Goal:** Real database behind the gateway.

Tasks:
- [ ] Set up local Kubernetes (minikube or k3d for dev)
- [ ] Install CloudNativePG operator
- [ ] Create a CNPG cluster for one test tenant
- [ ] Deploy PgBouncer for that tenant
- [ ] Wire Gateway → PgBouncer → CNPG
- [ ] Run `psql` end-to-end through the full stack

Done when: Full stack works locally with a real PostgreSQL query.

---

### Phase 5 — Security Hardening (Week 4)
**Goal:** Safe for real users.

Tasks:
- [ ] API key hashing (never store plaintext)
- [ ] TLS on gateway (use cert-manager or ACM)
- [ ] Rate limiting per key
- [ ] Revocation support
- [ ] Secrets stored in AWS Secrets Manager

Done when: Security review passes. No plaintext secrets anywhere.

---

### Phase 6 — EKS Production Deployment (Week 4–5)
**Goal:** Running on AWS.

Tasks:
- [ ] Set up EKS cluster (eksctl or Terraform)
- [ ] Install AWS Load Balancer Controller
- [ ] Deploy DB Gateway with NLB
- [ ] Set up IRSA for S3 backups
- [ ] Set up External Secrets Operator
- [ ] Deploy monitoring (Prometheus + Grafana)
- [ ] Tenant provisioning automation (API call → CNPG + PgBouncer deployed)

Done when: A real external app can connect, query, and disconnect successfully.

---

### Phase 7 — Control Plane / Dashboard (parallel track — Express)
**Goal:** Tenant self-service UI.

Stack: **Node.js + Express** (REST API) + React or Next.js (frontend)

Tasks:
- [ ] Express app scaffold (`express`, `pg`, `jsonwebtoken`, `bcrypt`)
- [ ] `POST /auth/register` — create tenant account
- [ ] `POST /auth/login` — return JWT access token + refresh token (httpOnly cookie)
- [ ] `POST /databases` — trigger Kubernetes provisioning (CNPG + PgBouncer)
- [ ] `POST /api-keys` — generate + return key once, store hash only
- [ ] `DELETE /api-keys/:id` — revoke key
- [ ] `GET /databases/:id/connection-string` — return connection URL
- [ ] JWT middleware on all protected routes
- [ ] Kubernetes client integration (calls k8s API to create namespace + CNPG Cluster + PgBouncer)
- [ ] Stripe integration for billing
- [ ] Simple dashboard UI

---

## 10. Mistakes to Avoid

### Architecture mistakes

| Mistake | Why it's wrong | What to do instead |
|---|---|---|
| Using SNI routing for DB connections | PostgreSQL doesn't send SNI in startup packet | Use a custom TCP gateway that reads the startup packet |
| Using NGINX as a database proxy | NGINX doesn't understand PostgreSQL protocol | Use our custom Go gateway or pgbouncer with careful config |
| Sharing one PgBouncer for all tenants | Cross-tenant credential leakage risk, noisy neighbor | One PgBouncer per tenant |
| Exposing CNPG clusters directly to internet | PostgreSQL not designed to be internet-facing | Always put behind Gateway + PgBouncer |
| Storing API keys in plaintext | Catastrophic if DB is compromised | Always SHA-256 hash before storing |
| Using JWT for database connections | JWT is stateful + complex for TCP routing | Use simple static API keys for DB routing |
| Putting all tenants in one Kubernetes namespace | Hard to isolate, hard to apply network policy | One namespace per tenant |

### Go beginner mistakes

| Mistake | Correct pattern |
|---|---|
| `go func() { ... }()` without error handling | Always have a way to capture panics/errors from goroutines |
| Not closing connections in defer | `defer conn.Close()` at the start of every handler |
| Forgetting to call `io.ReadFull` (using `Read` instead) | `io.ReadFull` guarantees all bytes are read; `Read` may return partial data |
| Ignoring the second return value of `io.Copy` | Log or handle the error |
| Using `log.Fatal` inside goroutines | It calls `os.Exit` — use `log.Printf` + `return` inside goroutines |
| Global mutable state | Pass dependencies as struct fields |

### EKS / Kubernetes mistakes

| Mistake | Correct pattern |
|---|---|
| Using ALB for TCP/PostgreSQL | ALB is HTTP only — use NLB for TCP |
| Hardcoding AWS credentials | Use IRSA (IAM Roles for Service Accounts) |
| Storing secrets in ConfigMaps | Use Kubernetes Secrets + External Secrets Operator |
| Giving pods overly broad IAM roles | Least-privilege IRSA role per service |
| Not setting resource limits on pods | Always set `requests` and `limits` in pod specs |
| Deploying CNPG clusters without backups configured | Always configure S3 backup from day 1 |

---

## 11. Key DNS and Networking Facts (EKS)

```
# Internal cluster DNS pattern
<service>.<namespace>.svc.cluster.local

# DB Gateway → PgBouncer (cross-namespace)
pgbouncer.tenant-abc123.svc.cluster.local:5432

# PgBouncer → CNPG primary
cluster-tenant-abc123-rw.tenant-abc123.svc.cluster.local:5432

# External DNS (NLB)
db.ourplatform.com → NLB → DB Gateway pod (port 5432)
```

---

## 12. Technology Versions (pin these)

| Component | Version |
|---|---|
| Go | 1.22+ |
| CloudNativePG operator | 1.23.x |
| PgBouncer | 1.22.x |
| PostgreSQL | 16.x |
| Kubernetes | 1.29+ (EKS managed) |
| AWS Load Balancer Controller | 2.7.x |
| External Secrets Operator | 0.9.x |

---

## 13. Glossary

| Term | Meaning in this project |
|---|---|
| DB Gateway | Our custom Go TCP proxy — the core product |
| Tenant | A customer who has signed up for our platform |
| API Key | A static token (`sk_live_...`) used to authenticate database connections |
| Tenant Registry | Our internal PostgreSQL DB storing tenants, keys, and cluster routing |
| CNPG | CloudNativePG — the Kubernetes operator managing PostgreSQL clusters |
| PgBouncer | Connection pooler sitting between Gateway and CNPG |
| Startup Packet | The first message a PostgreSQL client sends — contains user, database, etc. |
| ClusterIP | A Kubernetes service type only accessible inside the cluster |
| NLB | AWS Network Load Balancer — handles TCP passthrough (used for PostgreSQL) |
| IRSA | IAM Roles for Service Accounts — AWS way to give pods IAM permissions safely |
| Control Plane | Our dashboard + REST API for managing tenants (separate from the DB Gateway) |
