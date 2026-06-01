# Load testing & the `/test` dashboard

Two ways to put a Loonaris cluster under load and watch CPU / memory respond:

1. **`/test` dashboard** — public web page, paste a connection string, click start.
2. **`scripts/load-test`** — `pgbench` from a shell, for CI / terminal use.

Both drive the same workload: each transaction inserts 500 rows **and** runs a
hash-aggregate + sort, so a handful of clients pegs the primary at its `500m`
CPU pod limit within seconds. Writes only hit the primary; replicas stay cool
because they just apply WAL.

---

## 1. The `/test` dashboard

Open **`/test`** (no login required). Paste a full connection string, e.g.

```
postgresql://sk_live_<64-hex>_rw@<gateway-host>:5432/app?sslmode=disable
```

- **Show metrics** — starts polling live CPU / memory curves for that cluster.
- **Start load** — runs the workload (set *Concurrency* 1–32 and *Duration* 5–900s).
- **Stop load** — ends an in-flight run early.

The browser never connects to Postgres directly. It calls the backend, which:

- extracts the `sk_live_` key from the string and resolves it to the cluster's
  namespace (`ApiKey.keyHash → Project.k8sNamespace`),
- opens a small `pg` pool and drives the load server-side,
- reads CPU / memory from metrics-server (same source as the main dashboard).

### Endpoints (`/api/load-test`, unauthenticated)

| Method | Path                       | Body / params                                   |
| ------ | -------------------------- | ----------------------------------------------- |
| POST   | `/metrics`                 | `{ connectionString }` → live cluster metrics   |
| POST   | `/start`                   | `{ connectionString, concurrency?, durationSec? }` → `{ runId }` |
| GET    | `/:runId`                  | run status (`inserted`, `insertsPerSec`, …)     |
| POST   | `/:runId/stop`             | stop a run                                      |

### Safety

Possession of a valid `sk_live_` connection string is the only credential. To
stop the endpoint being abused as an open SSRF proxy, the load runner only
connects to **allow-listed hosts**: the public gateway NLB by default, override
with `LOAD_TEST_ALLOWED_HOSTS` (comma-separated). Keys that don't resolve to a
real project, or hosts outside the list, are rejected before any connection is
opened. Run state is in-memory (single process) — fine for demo/dev, not HA.

---

## 2. `scripts/load-test` (pgbench)

```bash
# from web-app/
./scripts/load-test/run.sh '<connection-string>' [clients] [duration_seconds]

# example: 12 clients, 4 minutes
./scripts/load-test/run.sh \
  'postgresql://sk_live_..._rw@<gateway-host>:5432/app?sslmode=disable' 12 240
```

Requires `psql` + `pgbench` (`apt install postgresql-client`). The script
ensures the `load_test` table exists, then runs `load.sql` under pgbench.

### What "loaded" looks like

`kubectl top pods -n <namespace>` during a 12-client run (vs. idle):

| Pod           | Role    | Idle CPU | Loaded CPU       | Idle Mem | Loaded Mem |
| ------------- | ------- | -------- | ---------------- | -------- | ---------- |
| instance-db-1 | primary | ~49m     | **500m** (capped)| ~107Mi   | ~289Mi     |
| instance-db-2 | replica | ~25m     | ~27m             | ~111Mi   | ~111Mi     |

The primary saturates its `resources.limits.cpu: 500m`, so on the dashboard the
CPU curve climbs and then flatlines at the cap — that's the pod limit, not a
metrics glitch.

> **Note:** metrics-server reports CPU in nanocores (`49038340n`). The backend
> parser (`parseCpuToMillis`) handles `n`/`u`/`m`/cores; without that fix the UI
> renders absurd values like `49038340.00 cores`.
