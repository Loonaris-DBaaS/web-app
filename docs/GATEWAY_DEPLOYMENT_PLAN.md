# DB Gateway — Go-Live Plan

> Goal: deploy `db-gateway` into the EKS cluster (Account 2), wire it to the control
> plane, and validate end-to-end with **3 tenants** connecting via a `psql` client.
> Created 2026-05-31.

## Decisions (locked)

| Topic | Decision |
|---|---|
| Provisioning request handling | **Background** — `createCluster` returns `202` with `status: provisioning`; provisioning runs detached and writes final `running`/`error` back to the DB. |
| Test tenants | Created **via the real API** (`POST /api/clusters` ×3) to exercise the full path. |
| Gateway image registry | **ECR in Account 2** (`592858827449`) — same account as EKS, so node role pulls natively. |
| TLS on the gateway | **Disabled for launch** (ship fast). Clients use `sslmode=disable`/`prefer`. |
| Network exposure | **Open to the world / unrestricted** — internet-facing NLB; **no NetworkPolicy** (none selecting the pod = all ingress/egress allowed). |
| NLB hostname | `ab571a35c49414eaab905fc43405b7fb-9f85c871b90b857f.elb.eu-west-3.amazonaws.com` |

## Verified live state (2026-05-31, not from docs)

- ✅ CNPG operator installed (`cnpg-system`), CRD `clusters.postgresql.cnpg.io` present.
- ✅ EBS CSI driver installed; 4 nodes Ready (1 system, 3 tenant).
- ✅ `INTERNAL_GATEWAY_SECRET` already in ECS task def **rev 23** (backed by Secrets Manager `loonaris/internal-gateway-secret`).
- ✅ Control-plane route lookup (`GET /api/internal/routes/:keyHash`) built; `Pooler` rows persisted on cluster create.
- ✅ Gateway tunnel goroutine/FD leak fixed (`internal/gateway/tunnel.go`).
- ❌ No ECR repo in Account 2.
- ❌ `system-plane` namespace empty — gateway not deployed.
- ❌ `provisionCluster` is **commented out** (`pgCluster.service.ts:92`); status is faked to `running`.
- ✅ Pooler migration `20260531000500_fix_schema_drift` generated (via `prisma migrate dev`) and committed; applied automatically by `backend-deploy.yml` (`prisma migrate deploy` over the bastion tunnel) on the next backend deploy. No manual/hand-written SQL.
- ❌ `db.loonaris.tech` DNS record (registrar panel).

## Phases

### Phase 1 — Gateway image → ECR (Account 2)  ·  Tasks #1, #2
1. Create private ECR repo `db-gateway` in `592858827449` / `eu-west-3`.
2. Confirm node role `AmazonEKSAutoNodeRole2` has `AmazonEC2ContainerRegistryReadOnly`.
3. Update `db-gateway/.github/workflows/docker.yml` to authenticate + push to ECR.
4. Update `db-gateway/k8s/deployment.yaml` image →
   `592858827449.dkr.ecr.eu-west-3.amazonaws.com/db-gateway:latest`.
5. Build + push the first image.

> **Needs you:** GitHub repo secrets / OIDC role for CI to push to ECR.

### Phase 2 — Deploy gateway to EKS  ·  Task #3
1. Create `system-plane` namespace.
2. Create `db-gateway-secrets` with the **real** `INTERNAL_GATEWAY_SECRET`
   (from Account 1 Secrets Manager `loonaris/internal-gateway-secret`) and
   `control-plane-url: https://loonaris.tech/api`.
3. Apply `deployment.yaml`, `service-nlb.yaml`, `networkpolicy.yaml`.
4. Confirm pod Ready; capture NLB hostname.

### Phase 3 — Re-enable background provisioning  ·  Task #4
- `pgCluster.service.ts`: re-enable `provisionCluster`, run detached, persist final
  `running`/`error` status to the `Project` row after `pollClusterHealth`.

### Phase 4 — RDS migration  ·  Task #5  (no manual work)
- Migration `20260531000500_fix_schema_drift` already committed. `backend-deploy.yml`
  runs `prisma migrate deploy` through the bastion tunnel automatically, so it applies
  on the next backend deploy (Phase 6). **Never** hand-write migration SQL — regenerate
  with `npx prisma migrate dev` if the schema changes.
- (ECS `INTERNAL_GATEWAY_SECRET` already present — no ECS change needed.)

### Phase 5 — DNS  ·  Task #6
- Add `db` CNAME → NLB hostname at the `.tech` registrar DNS panel. Verify with `dig`.

> **Needs you:** registrar DNS panel.

### Phase 6 — Deploy & test  ·  Task #7
1. Deploy backend (`backend-deploy.yml`) and gateway image.
2. Create 3 tenants via `POST /api/clusters`; wait for `running`.
3. Connect each:
   ```
   psql "postgresql://sk_live_<key>_rw@db.loonaris.tech:5432/app?sslmode=disable"
   ```
4. Validate RW vs RO routing (`_rw`/`_ro` key suffix) and tenant isolation.

## Owner split

| Done by me (have creds) | Needs you |
|---|---|
| ECR repo, image build/push, EKS deploy, K8s secret, code changes, RDS migration, tenant creation, psql test | GitHub repo secrets (CI → ECR), registrar DNS record |
