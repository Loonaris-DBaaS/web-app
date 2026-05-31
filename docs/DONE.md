# Loonaris — DONE

> What is built, deployed, and verified. Items here have been removed from [GAPS.md](./GAPS.md).
> See [PROJECT.md](./PROJECT.md) for how it all fits. Last updated 2026-05-31.

## Infrastructure & deploy
- ✅ EKS cluster (Account 2), CNPG operator installed, EBS CSI driver, **`gp3` StorageClass** created.
- ✅ **ECR repo `db-gateway`** in Account 2; gateway image built & pushed.
- ✅ **db-gateway deployed** to EKS `system-plane` with an **internet-facing NLB**.
- ✅ Backend on ECS (cross-account EKS access working); `INTERNAL_GATEWAY_SECRET` on the task.
- ✅ **Secrets Manager `loonaris/internal-db-password`** (shared internal DB password) + ECS `PROVISION_DB_PASSWORD` + `ecsTaskExecutionRole` permission.
- ✅ **Frontend deploy fixed** (`--exact-timestamps` so `index.html` isn't stale); `loonaris.tech` + `/admin` live.
- ✅ Gateway repo GitHub secrets (Account 2 creds) for ECR push.

## Control plane (provisioning)
- ✅ `GET /api/internal/routes/:keyHash` route lookup (Bearer auth), maps `running → active`.
- ✅ `createCluster`: generates `sk_live_` key (SHA-256 hashed), persists `Pooler` row, returns 202; **background provisioning** to EKS.
- ✅ Cross-account EKS auth: **in-process EKS token** via `aws4` (client-node v1.x dropped the `aws` authProvider).
- ✅ **CNPG-native `Pooler` CRs** (`pooler-rw`/`pooler-ro`) replacing edoburu pgbouncer — `auth_query` makes SCRAM work.
- ✅ **Single shared internal `cloud_user` password** (tenants never receive it).
- ✅ Pooler schema migration applied (`rw_host`/`rw_port`/`ro_host`/`ro_port`).
- ✅ Health poll matches CNPG phase `Cluster in healthy state`; timeout 10 min.

## Gateway
- ✅ **Auth-terminating proxy**: validates `sk_live_` key, opens its own SCRAM-authed connection to the pooler as `cloud_user`, splices sockets (`tunnel.go` via `pgx/pgconn`).
- ✅ Route cache + singleflight; tunnel goroutine/FD leak fixed.

## Admin
- ✅ **Admin API**: `GET /api/admin/clusters` (all tenants + owner + status), `DELETE /api/admin/clusters/:id`.
- ✅ **`/admin` dashboard** page (table + delete). ⚠️ Unauthenticated for now; see GAPS.

## Verified end-to-end (3 tenants, psql via NLB)
- ✅ RW connect + auth through the gateway (`cloud_user` / `app`).
- ✅ RW write + read; **tenant isolation** (tenant-2 can't see tenant-1's data).
- ⚠️ RO path pending `instances:2` (no replica with `instances:1`) — tracked in GAPS.

## Bugs fixed this session (chain that was blocking E2E)
1. Gateway tunnel goroutine/FD leak.
2. Stale `K8S_CLUSTER_CA` in ECS task (EKS TLS failure).
3. client-node v1.x dropped `aws` authProvider (401) → in-process token.
4. Missing `gp3` StorageClass (PVC unbound).
5. Wrong CNPG image org `cloudnativepg` → `cloudnative-pg`.
6. `app-db-credentials` must be `basic-auth` (username+password).
7. Health poll checked `Healthy` vs real `Cluster in healthy state`.
8. `applyManifests` applied Poolers as Deployments (apply loop not updated).
9. Pooler CR `spec.template` without containers invalid → omit template.
10. `getNamespacedCustomObject` has no `.body` in client-node v1.x → phase always `unknown`.
11. ECS exec role lacked `GetSecretValue` on the new secret (caused a brief outage; fixed).
12. Frontend deploy stale `index.html` (`--exact-timestamps`).
