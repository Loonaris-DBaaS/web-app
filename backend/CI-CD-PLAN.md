# Backend CI/CD Plan — Loonaris

> This document describes the continuous deployment pipeline for the Loonaris backend (ECS Fargate + ECR).

---

## 1. Goal

Every merge to `main` that touches `backend/**` automatically:

1. Builds a production Docker image
2. Pushes it to Amazon ECR (overwriting `:latest`)
3. Forces a new ECS deployment so Fargate pulls the fresh image

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
                       ┌──────────────┐  ┌─────────────┐  ┌─────────────┐
                       │   Checkout   │─►│ Build image │─►│ Push to ECR │
                       └──────────────┘  └─────────────┘  └──────┬──────┘
                                                                  │
                                                                  ▼
                                                            ┌─────────────┐
                                                            │ Force ECS   │
                                                            │ deployment  │
                                                            └──────┬──────┘
                                                                   │
                                                                   ▼
                                                            ┌─────────────┐
                                                            │ ECS Fargate │
                                                            │ (new tasks) │
                                                            └─────────────┘
```

---

## 3. Trigger Strategy

The workflow runs on:

- **Push to `main`** where changed files match `backend/**`
- **Manual trigger** (`workflow_dispatch`) for on-demand deploys

Why path-filtered? The repo also contains a frontend deployed to Azure via a separate workflow (`main_dbaas.yml`). We don't want backend deploys to fire when only frontend code changes.

---

## 4. Build & Push Flow

### 4.1 Docker Build

- Uses the multi-stage `Dockerfile` at `backend/Dockerfile`
- Build context: `backend/` directory
- Image tag: `:latest` (overwritten on every successful build)
- Provenance disabled (`--provenance=false`) to avoid ECR manifest list issues

### 4.2 ECR Push

- Repository: `474741569968.dkr.ecr.eu-west-3.amazonaws.com/ahmed-aws/loonaris`
- Tag: `latest`
- Region: `eu-west-3`

### 4.3 Why `:latest`?

The ECS task definition references `:latest`, not a pinned digest. This means `force-new-deployment` always resolves the tag at pull time and gets the newest image. No task-definition revision churn for routine code changes.

> ⚠️ If the task definition ever gets accidentally pinned to a digest (e.g. `@sha256:...`), the pipeline will keep redeploying the old image. See section 7.

---

## 5. Deploy Flow

After the image is in ECR, the pipeline runs:

```bash
aws ecs update-service \
  --cluster loonaris-ecs-fargate-cluster \
  --service loonaris-backend-service-p839kjg4 \
  --force-new-deployment \
  --region eu-west-3
```

ECS then:
1. Starts new tasks (up to `max 200%` of desired count)
2. New tasks pull `:latest` from ECR
3. Health checks pass (`/api/health`)
4. Old tasks are drained and stopped
5. Service reaches steady state

---

## 6. Required GitHub Secrets

Configure these in **Settings → Secrets and variables → Actions**:

| Secret | Description | Example |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | IAM user access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret | `wJalrXUtnFEMI...` |
| `AWS_REGION` | AWS region (can also be hardcoded) | `eu-west-3` |

> **IAM permissions needed:**
> - `ecr:GetAuthorizationToken`
> - `ecr:BatchCheckLayerAvailability`
> - `ecr:GetDownloadUrlForLayer`
> - `ecr:BatchGetImage`
> - `ecr:InitiateLayerUpload`
> - `ecr:UploadLayerPart`
> - `ecr:CompleteLayerUpload`
> - `ecr:PutImage`
> - `ecs:DescribeServices`
> - `ecs:UpdateService`

---

## 7. Image Tag Strategy & Task Definition Safety

### Normal deploy
Build → Push `:latest` → `force-new-deployment` → done.

### When the task definition gets pinned to a digest
If someone (or a tool) edits the task definition and it ends up with:

```
image: .../loonaris@sha256:abc123...
```

instead of:

```
image: .../loonaris:latest
```

then `force-new-deployment` will **always redeploy the same old image**, even if ECR `:latest` was overwritten.

**Fix:** Register a new task definition revision with image set back to `:latest`, then update the service to use it.

**The CI pipeline does NOT automatically fix this.** It assumes the task definition is already correct. If you notice deploys not taking effect, check the task definition image field first.

---

## 8. Rollback Strategy

ECS circuit breaker + rollback is already enabled on the service. If the new tasks fail health checks repeatedly, ECS automatically rolls back to the previous stable deployment.

For manual rollback:
1. Find the last known-good image digest in ECR
2. Tag it as `:latest` locally and push: `docker tag <digest> ...:latest && docker push ...:latest`
3. Run `force-new-deployment`

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
| 5 | Tag every image with the Git SHA in addition to `:latest` | Low | Medium — easier rollbacks and traceability |
| 6 | Add Slack / Discord webhook notification on success/failure | Low | Medium — team visibility |
| 7 | Switch to OIDC for AWS auth | Medium | High — no long-lived secrets |

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
