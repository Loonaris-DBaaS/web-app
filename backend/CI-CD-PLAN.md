# Backend CI/CD Plan — Loonaris

> This document describes the continuous deployment pipeline for the Loonaris backend (ECS Fargate + ECR + RDS).
> Last updated: 2026-05-30

---

## 1. Goal

Every merge to `main` that touches `backend/**` automatically:

1. Runs database migrations via SSH tunnel through the bastion host
2. Builds a production Docker image
3. Pushes it to Amazon ECR (tagged with `:latest` and the Git SHA)
4. Registers a new ECS task definition revision pinning the exact image digest
5. Scales ECS service to 0, updates to new task definition, scales back to 2
6. Verifies running tasks actually use the pushed image
7. Verifies the health endpoint returns `status: ok`

No manual `docker build`, `docker push`, or AWS console clicks required.

---

## 2. Architecture Overview

```
┌──────────────┐     push to main      ┌──────────────────┐
│   GitHub     │ ────────────────────► │  GitHub Actions  │
│   (repo)     │   (backend/** changed)│  (workflow)      │
└──────────────┘                       └────────┬─────────┘
                                                 │
                    ┌─────────────────────────────┼─────────────────────────────┐
                    │                             │                             │
                    ▼                             ▼                             ▼
            ┌──────────────┐           ┌─────────────────┐           ┌──────────────────┐
            │  Checkout    │           │  Install deps   │           │  SSH tunnel via  │
            │  code        │           │  (npm ci)       │           │  bastion to RDS  │
            └──────┬───────┘           └────────┬────────┘           └────────┬─────────┘
                   │                              │                             │
                   ▼                              ▼                             ▼
            ┌──────────────┐           ┌─────────────────┐           ┌──────────────────┐
            │  Build+Push  │           │  Register New   │           │  Scale ECS to 0  │
            │  (cached)    │           │  Task Def       │           │  → update TD →   │
            └──────┬───────┘           └────────┬────────┘           │  scale to 2      │
                   │                              │                  └────────┬─────────┘
                   ▼                              ▼                             │
            ┌──────────┐                   ┌────────────┐                     │
            │   ECR    │                   │ ECS Fargate│                     │
            │ (:latest │                   │ (verified) │◄────────────────────┘
            │ + sha)   │                   └────────────┘
            └──────────┘
```

---

## 3. Trigger Strategy

The workflow runs on:

- **Push to `main`** where changed files match `backend/**`
- **Manual trigger** (`workflow_dispatch`) for on-demand deploys

Path-filtered so backend deploys don't fire when only frontend code changes.

---

## 4. Database Migrations (Bastion SSH Tunnel)

**Why not run migrations inside the ECS container?**
- The Prisma CLI is a `devDependency` — it is not included in the production Docker image.
- The RDS instance is private. GitHub Actions runners cannot connect directly.
- Running migrations as a one-off ECS task requires the Prisma CLI in the image, bloating it.

**Solution:**
The workflow creates an SSH tunnel through the bastion host:
```bash
ssh -L 5433:rds:5432 ubuntu@13.39.112.107
```
Then runs `npx prisma migrate deploy` locally on the GitHub Actions runner through `localhost:5433`.

**Required secrets:**
- `BASTION_SSH_KEY` — private key for `bastion-key.pem`
- `DATABASE_URL` — full PostgreSQL connection string

**If migrations fail, the workflow stops before building or pushing the image.** This prevents deploying code that expects a schema the database doesn't have.

---

## 5. Build & Push Flow

### 5.1 Docker Build

- Uses `docker/build-push-action@v6` with GitHub Actions cache (`type=gha`)
- Multi-stage `Dockerfile` at `backend/Dockerfile`
- Build context: `backend/` directory
- Tags pushed:
  - `:latest` (for human reference)
  - `:<git-sha>` (for traceability)
- Provenance disabled (`provenance: false`) to avoid ECR manifest list issues

### 5.2 Docker Layer Caching

Uses `docker/setup-buildx-action` + `cache-from: type=gha` / `cache-to: type=gha,mode=max`. This caches Docker layers between runs, dramatically speeding up builds.

### 5.3 ECR Push

- Repository: `474741569968.dkr.ecr.eu-west-3.amazonaws.com/ahmed-aws/loonaris`
- Region: `eu-west-3`

---

## 6. Deploy Flow (Scale-to-Zero Workaround)

### Why scale to 0?

AWS Fargate on-demand vCPU quota for this account is **4**. Each task uses **1 vCPU**. Rolling deployment would temporarily need **4 vCPUs** (2 old + 2 new), which hits the exact limit. ECS cannot place new tasks and the deployment hangs until the circuit breaker rolls it back.

**Workaround:**
1. Scale service to `0` (old tasks stop, freeing vCPUs)
2. Update service to new task definition
3. Scale service to `2` (new tasks start with guaranteed vCPU availability)

**Trade-off:** ~30 seconds of downtime during deploy. Acceptable for this project.

### Why exact digests instead of `:latest`?

ECS Fargate **caches** the `:latest` tag resolution. Even after ECR `:latest` is overwritten with a new digest, ECS may continue pulling the old cached digest. By pinning the exact digest in the task definition, we guarantee ECS pulls the image we just built.

---

## 7. Required GitHub Secrets & Variables

### Secrets (Settings → Secrets and variables → Actions)

| Secret | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |
| `BASTION_SSH_KEY` | Private SSH key for bastion host (`bastion-key.pem`) |
| `DATABASE_URL` | Production PostgreSQL connection string (includes password) |
| `EC2_HOST` | Nginx EC2 public IP (`35.181.168.74`) |
| `EC2_SSH_KEY` | Private SSH key for Nginx EC2 (`nginx-key.pem`) |

### Variables (Settings → Secrets and variables → Actions → Variables tab)

| Variable | Value |
|---|---|
| `AWS_REGION` | `eu-west-3` |
| `ECS_CLUSTER_NAME` | `loonaris-ecs-fargate-cluster` |
| `ECS_SERVICE_NAME` | `loonaris-backend-service-p839kjg4` |
| `ALB_URL` | `http://loonaris-alb-1830888004.eu-west-3.elb.amazonaws.com` |

> **IAM permissions needed:**
> - `ecr:*` (push images)
> - `ecs:DescribeTaskDefinition`, `ecs:RegisterTaskDefinition`, `ecs:DescribeServices`, `ecs:UpdateService`, `ecs:ListTasks`, `ecs:DescribeTasks`

---

## 8. Rollback Strategy

ECS circuit breaker + rollback is enabled. If new tasks fail health checks, ECS automatically rolls back to the previous stable task definition revision.

**Manual rollback:**
1. Find the previous task definition revision in the ECS console
2. Update the service to use that revision + `force-new-deployment`
3. Because every deploy registers a new revision, rolling back is one click

---

## 9. Security Notes

### AWS Credentials
The workflow uses long-term IAM access keys stored as GitHub secrets.

**Recommended upgrade:** Switch to OIDC so GitHub Actions can assume an IAM role without storing long-lived credentials.

### Secrets in Task Definition
Environment variables like `JWT_SECRET` and `DATABASE_URL` are currently stored in plain text in the ECS task definition.

**Recommended upgrade:** Move them to AWS Systems Manager Parameter Store (SecureString) and reference by ARN.

---

## 10. Related Files

| File | Purpose |
|---|---|
| `.github/workflows/backend-deploy.yml` | The actual CI/CD workflow |
| `.github/workflows/frontend-deploy.yml` | Frontend S3 + Nginx deploy |
| `backend/Dockerfile` | Multi-stage Docker build |
| `AGENTS.md` | Live infrastructure reference |
| `DEPLOY_AWS.md` | Current architecture overview |
| `infrastructure/frontend/` | Nginx config + IAM policies as code |

---

## 11. Workflow File

```
.github/workflows/backend-deploy.yml
```

This plan document lives at:

```
backend/CI-CD-PLAN.md
```
