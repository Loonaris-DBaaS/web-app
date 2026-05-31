# Loonaris DBaaS — Session Status

> Live state, what was done, and what's pending. Updated 2026-05-31.
> Companion to `GATEWAY_DEPLOYMENT_PLAN.md` and the approved redesign plan.

## TL;DR

We deployed the `db-gateway` to EKS, redesigned the tenant pooler + auth model
(CNPG-native Poolers + a single internal DB password + an auth-terminating
gateway), and fixed a long chain of latent bugs in the provisioning path. The
full pipeline (signup → create cluster → CNPG provision → pooler → gateway) now
works; we are validating the final end-to-end `psql` test.

---

## Architecture (current, as running)

```
psql client  --(user = sk_live_<hash>_rw, no DB password, sslmode=disable)-->
  NLB (internet-facing, eu-west-3, Account 2)
  --> db-gateway pod (system-plane ns, EKS Account 2)
        parse key -> GET https://loonaris.tech/api/internal/routes/<hash>
                     (control plane returns pooler host/port + status)
        accept client (the key IS the credential) -> AuthenticationOk
        open OWN authenticated conn to the pooler as cloud_user
        using the shared internal password (SCRAM) -> bridge bytes
  --> pooler-rw / pooler-ro  (CNPG-native Pooler, tenant ns)
  --> instance-db-rw / -ro   (CNPG Postgres, scram-sha-256)
```

Control plane (provisioning) runs in **ECS (Account 1)** and talks to **EKS
(Account 2)** cross-account via an IAM user access key + in-process EKS token.

---

## What's deployed right now

| Component | State |
|---|---|
| **db-gateway** | EKS `system-plane`, 1/1 Running, image `592858827449.dkr.ecr.eu-west-3.amazonaws.com/db-gateway:latest` (auth-terminating proxy) |
| **NLB** | `ab571a35c49414eaab905fc43405b7fb-9f85c871b90b857f.elb.eu-west-3.amazonaws.com:5432` (internet-facing) |
| **Backend (ECS)** | service on task def **rev 35**, `desired=1 running=1` (image `ahmed-aws/loonaris:pooler-fix5`) |
| **CNPG operator** | installed (`cnpg-system`) |
| **gp3 StorageClass** | created (`ebs.csi.aws.com`, WaitForFirstConsumer, encrypted) |
| **No NetworkPolicy** | unrestricted, per decision |
| **TLS** | disabled on the gateway, per decision |

---

## What was done this session

### Infra / deploy
- Created ECR repo `db-gateway` in **Account 2**; node role already had ECR pull.
- Built/pushed the gateway image; deployed gateway + internet-facing NLB to EKS.
- Added gateway repo GitHub secrets (Account 2 creds) so its CI can push to ECR.
- Created Secrets Manager **`loonaris/internal-db-password`** (the shared internal DB password).
- Added `PROVISION_DB_PASSWORD` to the ECS task def (and granted the
  `ecsTaskExecutionRole` read access to that secret — see incident below).
- Created the **`gp3` StorageClass** (was missing on the recreated cluster).

### Redesign (approved): pooler + auth
- Replaced hand-rolled `edoburu/pgbouncer` with **CNPG-native `Pooler` CRs**
  (`pooler-rw`/`pooler-ro`) — CNPG wires up `auth_query`, so scram auth works.
- Introduced a **single internal DB password** shared by every tenant's
  `cloud_user`; tenants authenticate only with their `sk_live` API key.
- Gateway became an **auth-terminating proxy**: validates the key, opens its own
  authenticated connection to the pooler (`pgx/pgconn`, SCRAM), then bridges
  (`internal/gateway/tunnel.go`).

### Bugs fixed (all were blocking the e2e path)
1. Gateway tunnel goroutine/FD leak.
2. Stale `K8S_CLUSTER_CA` in ECS task → EKS TLS `certificate signature failure`.
3. `@kubernetes/client-node` v1.x dropped the `aws` authProvider → EKS 401;
   now mint the EKS token in-process with `aws4`.
4. Missing `gp3` StorageClass → PVCs unbound.
5. Wrong CNPG image org `cloudnativepg` → `cloudnative-pg` (ImagePullBackOff).
6. `app-db-credentials` must be `basic-auth` (username+password) for CNPG initdb.
7. Health poll checked `phase === 'Healthy'`; CNPG uses `Cluster in healthy state`.
8. `applyManifests` applied Poolers as Deployments (forgot to update the apply loop).
9. Pooler CR `spec.template` without containers is invalid → omit template.
10. **`getNamespacedCustomObject` returns the object directly in client-node v1.x**
    (no `.body`); poll read `resp.body.status.phase` → always `unknown` → every
    cluster timed out to `error`. Now reads the object directly.
- Provisioning poll timeout raised 5 min → 10 min.
- `instances: 2` → **`instances: 1`** (temporary; see max-pods below).

### Production incident (resolved)
- Adding `PROVISION_DB_PASSWORD` to the task def broke task startup: the
  `ecsTaskExecutionRole` policy was scoped to specific secret ARNs and didn't
  include the new one → `AccessDenied` → API down. Fixed by adding
  `loonaris/internal-db-password*` to the role's inline policy and redeploying.

---

## Known constraints / why some choices are temporary

- **Tenant nodes capped at `max-pods=11`.** `ENABLE_PREFIX_DELEGATION=true` is set
  on the VPC CNI, but the kubelet `--max-pods` was never raised at bootstrap, so
  the 3× `t2.small` tenant nodes only hold 11 pods each. This is why a 2nd CNPG
  instance couldn't schedule → we run `instances: 1` for now.
- **Fargate vCPU quota = 4.** The backend runs at `desired=1` (instead of 2) to
  avoid hitting the limit during deploys. Quota increase is pending.
- **Provisioning poll is in-memory** in the single ECS task that handled the POST.
  No durable reconciler — if that task restarts mid-provision, the tenant can get
  stuck at `provisioning`. (Bit us repeatedly during today's redeploys.)

## End-to-end test result (PASSED)

3 tenants (`db-1/2/3`) provisioned to `running` in ~36s, then via `psql` over the NLB:
- ✅ RW connect + auth through the gateway (`cloud_user` / `app`) — auth-terminating proxy works.
- ✅ RW write + read (`insert/select 111`).
- ✅ Tenant isolation — tenant-2 cannot see tenant-1's table.
- ⚠️ RO key path fails *only* because `instances:1` → no read replica → `instance-db-ro`
  has no endpoints. Expected; resolves when we return to `instances:2`.

## What we're waiting for / next
- **Pending (user tasks):**
  - DNS: add `db.loonaris.tech` CNAME → the NLB hostname (registrar panel).
- **Pending (follow-up infra):**
  - New tenant node group with a launch template setting `--max-pods ~110`
    (can't modify the existing managed node group in place), then revert to
    `instances: 2` for HA.
  - Raise Fargate vCPU quota and return backend to `desired=2`.
  - Durable provisioning reconciler (replace the in-memory poll) — e.g. a CNPG
    watch or periodic re-sync of DB status from live cluster state.
  - Commit the manually-built backend image changes through the normal CI
    (`backend-deploy.yml`); the latest code is committed locally but the running
    image was built/pushed manually as `ahmed-aws/loonaris:pooler-fix5`.

## Key references
- Gateway code: `db-gateway/internal/gateway/tunnel.go`, `.../session.go`
- Provisioning: `web-app/backend/src/modules/pgCluster/provisioning/provisioning.ts`
- Route lookup: `web-app/backend/src/modules/internal/services/internal.service.ts`
- Shared password secret: Secrets Manager `loonaris/internal-db-password`
- Gateway secret (in EKS): `db-gateway-secrets` (key `backend-db-password`)
