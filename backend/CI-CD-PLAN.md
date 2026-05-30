# Backend CI/CD Plan — Loonaris

> This document describes the continuous deployment pipeline for the Loonaris backend (ECS Fargate + ECR).

---

## 1. Goal

Every merge to `main` that touches `backend/**` automatically:

1. Builds a production Docker image
2. Pushes it to Amazon ECR (tagged with `:latest` and the Git SHA)
3. Registers a new ECS task definition revision pinning the exact image digest
4. Updates the ECS service to use the new revision
5. Verifies running tasks actually use the pushed image

No manual `docker build`, `docker push`, or `aws ecs` commands required.

---

## 2. Architecture Overview

```
┌──────────────┐     push to main      ┌──────────────────┐
│   GitHub     │ ────────────────────► │  GitHub Actions  │
│   (repo)     │   (backend/** changed)│  (workflow)      │
└──────────────┘                       └────────┬─────────┘
                                                │
                                                ▼
              ┌──────────┐  ┌────────────┐  ┌────────────┐  ┌─────────────────┐
              │ Checkout │─►│ Build+Push │─►│ Register   │─►│ Update Service  │
              └──────────┘  │ (cached)   │  │ New TD     │  │ + Force Deploy  │
                            └─────┬──────┘  └────────────┘  └────────┬────────┘
                                  │                                    │
                                  ▼                                    ▼
                            ┌──────────┐                        ┌────────────┐
                            │   ECR    │                        │ ECS Fargate│
                            │ (:latest │                        │ (verified) │
                            │ + sha)   │                        └────────────┘
                            └──────────┘
```

---

## 3. Trigger Strategy

The workflow runs on:

- **Push to `main`** where changed files match `backend/**`
- **Manual trigger** (`workflow_dispatch`) for on-demand deploys

Why path-filtered? The repo also contains a frontend deployed to Azure via a separate workflow. We don't want backend deploys to fire when only frontend code changes.

---

## 4. Build & Push Flow

### 4.1 Docker Build

- Uses `docker/build-push-action@v6` with GitHub Actions cache (`type=gha`)
- Multi-stage `Dockerfile` at `backend/Dockerfile`
- Build context: `backend/` directory
- Tags pushed:
  - `:latest` (for human reference)
  - `:<git-sha>` (for traceability and rollback)
- Provenance disabled (`provenance: false`) to avoid ECR manifest list issues

### 4.2 Docker Layer Caching

The workflow uses `docker/setup-buildx-action` + `cache-from: type=gha` / `cache-to: type=gha,mode=max`. This caches Docker layers between GitHub Actions runs, dramatically speeding up builds when only application code changes (not base images or dependencies).

### 4.3 ECR Push

- Repository: `474741569968.dkr.ecr.eu-west-3.amazonaws.com/ahmed-aws/loonaris`
- Tags: `latest` + `<git-sha>`
- Region: `eu-west-3`

---

## 5. Deploy Flow

After the image is in ECR, the pipeline:

1. **Captures the exact digest** of the pushed image
2. **Registers a new task definition revision** with the image field set to the exact digest (`@sha256:...`)
3. **Updates the ECS service** to use the new task definition revision
4. **Forces a new deployment**
5. **Polls running tasks** until at least the desired count of tasks are using the pushed digest
6. **Verifies the health endpoint** returns valid JSON with `status: ok`

### Why exact digests instead of `:latest`?

ECS Fargate **caches** the `:latest` tag resolution. Even after ECR `:latest` is overwritten with a new digest, ECS may continue pulling the old cached digest for newly scheduled tasks. This is a documented ECS behavior.

By pinning the exact digest in the task definition, we guarantee ECS pulls the image we just built — no cache surprises.

---

## 6. Required GitHub Secrets & Variables

### Secrets (Settings → Secrets and variables → Actions)

| Secret | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |

### Variables (Settings → Secrets and variables → Actions → Variables tab)

| Variable | Value | Used for |
|---|---|---|
| `AWS_REGION` | `eu-west-3` | All AWS CLI calls |
| `ECS_CLUSTER_NAME` | `loonaris-ecs-fargate-cluster` | ECS cluster |
| `ECS_SERVICE_NAME` | `loonaris-backend-service-p839kjg4` | ECS service |
| `ALB_URL` | `http://loonaris-alb-...` | Health check verification |

> **IAM permissions needed:**
> - `ecr:GetAuthorizationToken`
> - `ecr:BatchCheckLayerAvailability`
> - `ecr:GetDownloadUrlForLayer`
> - `ecr:BatchGetImage`
> - `ecr:InitiateLayerUpload`
> - `ecr:UploadLayerPart`
> - `ecr:CompleteLayerUpload`
> - `ecr:PutImage`
> - `ecs:DescribeTaskDefinition`
> - `ecs:RegisterTaskDefinition`
> - `ecs:DescribeServices`
> - `ecs:UpdateService`

---

## 7. Image Tag Strategy

### Normal deploy
Build → Push `:latest` + `:<git-sha>` → Register new TD with exact digest → Update service → done.

### Manual rollback
1. Find the last known-good image digest in ECR
2. Tag it as `:latest` locally and push (optional, for reference)
3. Register a task definition revision with that exact digest
4. Update the ECS service to use that revision

---

## 8. Rollback Strategy

ECS circuit breaker + rollback is enabled on the service. If new tasks fail health checks, ECS automatically rolls back to the previous stable task definition revision.

For manual rollback:
1. Find the previous task definition revision in the ECS console
2. Update the service to use that revision
3. `force-new-deployment`

Because every deploy registers a new revision, rolling back is as simple as pointing the service at the previous revision.

---

## 9. Security Notes

### AWS Credentials
The workflow uses long-term IAM access keys stored as GitHub secrets.

**Recommended upgrade:** Switch to OIDC (OpenID Connect) so GitHub Actions can assume an IAM role without storing long-lived credentials:

1. Create an OIDC identity provider in IAM for `token.actions.githubusercontent.com`
2. Create a role with the required ECR + ECS permissions
3. Add a trust policy allowing only this repo's `main` branch
4. Use `aws-actions/configure-aws-credentials@v4` with `role-to-assume`

### Image Scanning
Enable Amazon ECR basic scanning on the repository. The pipeline will not block on scan findings (to keep deploys fast), but you should review scan results in the ECR console.

---

## 10. Future Improvements

| # | Improvement | Effort | Impact |
|---|---|---|---|
| 1 | Add `npm run test` step before build | Low | High — catch regressions before deploy |
| 2 | Add `npm run lint` step | Low | Medium — enforce code style |
| 3 | Run database migrations (`prisma migrate deploy`) as a pre-deploy step | Medium | High — schema changes need care |
| 4 | Add a staging environment (separate ECS service + DB) | Medium | High — test before prod |
| 5 | Add Slack / Discord webhook notification on success/failure | Low | Medium — team visibility |
| 6 | Switch to OIDC for AWS auth | Medium | High — no long-lived secrets |
| 7 | Add SSM Parameter Store for secrets instead of hardcoded env vars in TD | Medium | High — better security |

---

## 11. Workflow File Location

The actual GitHub Actions workflow lives at:

```
.github/workflows/backend-deploy.yml
```

This plan document lives at:

```
backend/CI-CD-PLAN.md
```

---

## 12. Related Files

| File | Purpose |
|---|---|
| `backend/Dockerfile` | Multi-stage Docker build (builder + runner) |
| `backend/local-tools/push-container-script.sh` | Manual build/push script (used before CI) |
| `AGENTS.md` | Live AWS infrastructure documentation |
| `.github/workflows/main_dbaas.yml` | Frontend Azure deploy workflow (separate) |
