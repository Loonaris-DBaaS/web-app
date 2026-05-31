# Loonaris Documentation

> **Single source of truth lives here** (`web-app/docs/`). Root-level docs were
> consolidated into this folder. Start with [PROJECT.md](./PROJECT.md).

Loonaris is a multi-tenant Database-as-a-Service: users create isolated
PostgreSQL clusters from a dashboard and connect with `sk_live_` API keys
through a Go TCP gateway. Two subprojects (separate git repos): **control plane**
(`web-app`, TS/Express/Prisma/React) and **db-gateway** (`db-gateway`, Go).

## Read in this order

| # | Doc | What it covers |
|---|---|---|
| 1 | [PROJECT.md](./PROJECT.md) | **What we have today** — architecture, components, live state, how it all fits. Start here. |
| 2 | [AGENTS.md](./AGENTS.md) | Master agent context: subsystems, data flows, source map, conventions, critical rules. |
| 3 | [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) | AWS/EKS/ECS/RDS reference: accounts, IDs, endpoints, IAM, quick commands. |
| 4 | [GAPS.md](./GAPS.md) | Honest list of what's built / not built / pending. |
| 5 | [SESSION_STATUS.md](./SESSION_STATUS.md) | Latest working session: the pooler+auth redesign, bugs fixed, current state. |

## Reference / deep dives

| Doc | What it covers |
|---|---|
| [GATEWAY_DEPLOYMENT_PLAN.md](./GATEWAY_DEPLOYMENT_PLAN.md) | Gateway go-live plan (ECR, deploy, decisions). |
| [PROVISIONNING.md](../PROVISIONNING.md) | Tenant lifecycle spec (CNPG, poolers, activation). |
| [KEY_HASHING.md](./KEY_HASHING.md) | `sk_live_` key format + SHA-256 hashing. |
| [guide_cluster.md](./guide_cluster.md) | EKS cluster setup guide. |
| [ONBOARDING.md](./ONBOARDING.md) | New developer onboarding. |
| [RUNBOOK.md](../RUNBOOK.md) | Ops: deploy, rollback, SSH, migrations, common issues. |
| [../README.md](../README.md) | Backend/web-app readme. |
| db-gateway: [README](../../db-gateway/README.md), [GATEWAY_IMPL](../../db-gateway/docs/GATEWAY_IMPL.md), [DEPLOYMENT](../../db-gateway/docs/DEPLOYMENT.md) | Gateway code, impl, deploy. |

## Conventions
- Never store `sk_live_` plaintext keys — SHA-256 hash before writing.
- One K8s namespace per tenant (`project-{id}`).
- Never hand-write Prisma migrations — `npx prisma migrate dev`; CI runs `migrate deploy`.
- Deploy = build → push → register task def with exact digest → force-new-deployment.
