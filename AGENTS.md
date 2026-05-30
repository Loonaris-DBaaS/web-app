# Agent Context — Loonaris AWS Infrastructure

> This file is for AI agents. Read it before touching any AWS or backend code.

---

## 0. Agent Duty — Keep This File Updated

**Whenever you discover a new piece of infrastructure information** (new ARNs, IDs, changed settings, new debugging history, route changes, etc.) you **MUST** update this `AGENTS.md` immediately so the next agent has the full picture.

- Add new sections or rows to existing tables.
- Append debugging entries with dates.
- Do not leave the file stale.

---

## 1. Deployment Approach (CRITICAL — do not deviate)

- **ECR image tag is fixed (`:latest`)** and gets overwritten on every push.
- **The CI/CD pipeline registers a new task definition revision** on every deploy, pinning the image to the exact digest (`@sha256:...`) that was just pushed. This is the only reliable way to ensure ECS actually pulls the new image.
- **Why not `:latest` in the task definition?** ECS caches the `:latest` tag resolution. Even when ECR `:latest` points to a new digest, ECS may continue pulling the old cached digest. Pinning the exact digest eliminates this problem.
- **Normal deploy flow:** `docker build` → `docker push` (tags `:latest` + Git SHA) → register new task definition with exact digest → update ECS service → `force-new-deployment`
- **Never create new target groups or listener rules.**

### Automated CI/CD (GitHub Actions)

The backend deploys automatically on every push to `main` that changes `backend/**`.

**Workflow file:** `.github/workflows/backend-deploy.yml`

**What it does:**
1. Checks out the repo
2. Installs backend dependencies (`npm ci`) to get the Prisma CLI
3. Configures AWS credentials (from GitHub secrets)
4. **Runs database migrations** (`npx prisma migrate deploy`) through an SSH tunnel via the bastion host to the private RDS instance
5. Sets up Docker Buildx with GitHub Actions cache
6. Logs into ECR
7. Builds and pushes `…/ahmed-aws/loonaris:latest` **and** `…/loonaris:<git-sha>`
8. Captures the exact digest of the pushed image
9. Registers a new ECS task definition revision with the exact digest
10. Updates the ECS service to use the new task definition + `force-new-deployment`
11. Verifies running tasks actually use the pushed digest (not a cached old image)
12. Verifies `/api/health` responds with `200` and valid JSON

> **Why run migrations via bastion?** The RDS instance is private (`PubliclyAccessible: false`). GitHub Actions runners cannot connect directly. The bastion host (`i-0098c8d33fc342fb7`) is whitelisted in the RDS security group and sits in the same VPC. The workflow creates an SSH tunnel (`ssh -L 5433:rds:5432 bastion`) and runs `prisma migrate deploy` locally on the runner through that tunnel. This is cleaner than running migrations inside ECS containers because it doesn't require the Prisma CLI in the production Docker image.

**Required GitHub secrets:**
| Secret | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |
| `BASTION_SSH_KEY` | Private SSH key for the bastion host (`bastion-key.pem`) |
| `DATABASE_URL` | Production PostgreSQL connection string (includes password) |

**Required GitHub variables:**
| Variable | Value |
|---|---|
| `AWS_REGION` | `eu-west-3` |
| `ECS_CLUSTER_NAME` | `loonaris-ecs-fargate-cluster` |
| `ECS_SERVICE_NAME` | `loonaris-backend-service-p839kjg4` |
| `ALB_URL` | `http://loonaris-alb-1830888004.eu-west-3.elb.amazonaws.com` |

> See `backend/CI-CD-PLAN.md` for the full pipeline design, rollback strategy, and future improvements.

### Manual deploy (fallback)

If you ever need to deploy manually (e.g., CI is broken):

```bash
cd backend && bash local-tools/push-container-script.sh
# Get the digest of the pushed image
DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' \
  474741569968.dkr.ecr.eu-west-3.amazonaws.com/ahmed-aws/loonaris:latest | cut -d'@' -f2)
# Register new task definition with exact digest (see CI workflow for full jq logic)
# Then update service
aws ecs update-service \
  --cluster loonaris-ecs-fargate-cluster \
  --service loonaris-backend-service-p839kjg4 \
  --force-new-deployment \
  --region eu-west-3
```

**Build & push script:** `backend/local-tools/push-container-script.sh`

```bash
cd backend && bash local-tools/push-container-script.sh
```

This script:
1. Logs into ECR
2. Builds with `--provenance=false`
3. Tags as `ahmed-aws/loonaris:latest`
4. Pushes to `474741569968.dkr.ecr.eu-west-3.amazonaws.com/ahmed-aws/loonaris:latest`

---

## 2. AWS Account & Region

| Key | Value |
|---|---|
| Account ID | `474741569968` |
| Region | `eu-west-3` |
| AWS CLI profile | default (credentials in `~/.aws/credentials`) |

---

## 3. Application Load Balancer (ALB)

| Property | Value |
|---|---|
| Name | `loonaris-alb` |
| DNS Name | `loonaris-alb-1830888004.eu-west-3.elb.amazonaws.com` |
| ARN | `arn:aws:elasticloadbalancing:eu-west-3:474741569968:loadbalancer/app/loonaris-alb/488e85f638c84adb` |
| Scheme | `internet-facing` |
| Type | `application` |
| State | `active` |
| VPC | `vpc-01b6ed7fa337233e6` (`loonaris-app-vpc`) |
| Security Groups | `sg-06d96155ff3fbe810` (`loonaris-alb-sg`) |
| AZs | `eu-west-3a` (subnet-0e4e33e415b3acaac), `eu-west-3b` (subnet-0c243d223e2091acc) |

**Listeners:**
- Port `80` / HTTP → default action: forward to `loonaris-tg`
- **No listener on port 3000** (was removed after debugging)

**Security Group `loonaris-alb-sg` (`sg-06d96155ff3fbe810`):**
- Inbound: TCP 80 from `0.0.0.0/0`
- Inbound: TCP 443 from `0.0.0.0/0`

---

## 4. Target Group

| Property | Value |
|---|---|
| Name | `loonaris-tg` |
| ARN | `arn:aws:elasticloadbalancing:eu-west-3:474741569968:targetgroup/loonaris-tg/11c4c851ffe8fc7e` |
| Protocol | `HTTP` |
| Port | `3000` |
| Target Type | `ip` |
| VPC | `vpc-01b6ed7fa337233e6` |
| Health Check Protocol | `HTTP` |
| Health Check Port | `traffic-port` |
| **Health Check Path** | `/api/health` |
| Matcher | `200` |
| Healthy Threshold | `5` |
| Unhealthy Threshold | `2` |
| Interval | `30s` |
| Timeout | `5s` |

---

## 5. ECS

### Cluster
- **Name:** `loonaris-ecs-fargate-cluster`
- **ARN:** `arn:aws:ecs:eu-west-3:474741569968:cluster/loonaris-ecs-fargate-cluster`

### Service
- **Name:** `loonaris-backend-service-p839kjg4`
- **Launch Type:** `FARGATE`
- **Desired Count:** `2`
- **Platform Version:** `LATEST` (currently `1.4.0`)
- **Task Definition Family:** `loonaris-backend` (currently revision `10`)
- **Active Task Definition ARN:** `arn:aws:ecs:eu-west-3:474741569968:task-definition/loonaris-backend:10`
- **Deployment Controller:** `ECS` with circuit breaker + rollback enabled
- **Maximum Percent:** `200`
- **Minimum Healthy Percent:** `100`
- **Health Check Grace Period:** `0` seconds

**Load Balancer Config:**
- Container name: `application-backend-loonaris-container`
- Container port: `3000`
- Target group: `loonaris-tg`

**Network Configuration (awsvpc):**
- Subnets: `subnet-0190da135d58a82f5`, `subnet-0ac18267c30a9f63e`
- Security Group: `sg-04ca66f68b5555dfe` (`loonaris-ecs-sg`)
- Assign Public IP: `DISABLED`

### Task Definition (loonaris-backend)
- **Family:** `loonaris-backend`
- **Network Mode:** `awsvpc`
- **CPU:** `1024` (1 vCPU)
- **Memory:** `3072` (3 GB)
- **Ephemeral Storage:** `21` GiB
- **Compatibility:** `FARGATE`
- **Runtime Platform:** `LINUX` / `X86_64`
- **Execution Role:** `arn:aws:iam::474741569968:role/ecsTaskExecutionRole`

**Container:** `application-backend-loonaris-container`
- **Image:** `474741569968.dkr.ecr.eu-west-3.amazonaws.com/ahmed-aws/loonaris:latest`
- **Port Mapping:** `3000` (TCP, appProtocol `http`)
- **Log Driver:** `awslogs` → `/ecs/loonaris-backend`

**Environment Variables (in task definition):**
| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DATABASE_SSL` | `true` |
| `DATABASE_URL` | `postgresql://loonarispg:loonarisA123@database-loonaris-app.c3s68wa6ehdt.eu-west-3.rds.amazonaws.com:5432/loonarisdb` |
| `JWT_SECRET` | `7371GSBS_Qhgdhd` |
| `JWT_REFRESH_SECRET` | `737983783_Qhgdhd` |
| `CORS_ORIGIN` | `https://loonaris.tech,http://lonaris.tech` |

> The CI/CD pipeline registers a **new task definition revision on every deploy** with the image pinned to the exact digest (`@sha256:...`) that was just pushed. This is the correct approach — never rely on `:latest` tag resolution in ECS because Fargate caches it. If you need to deploy manually, always register a new revision with the exact digest, not `:latest`.

---

## 6. VPC & Security Groups

**VPC:** `vpc-01b6ed7fa337233e6` (`loonaris-app-vpc`)

| Security Group | ID | Inbound Rules |
|---|---|---|
| `loonaris-alb-sg` | `sg-06d96155ff3fbe810` | TCP 80 from `0.0.0.0/0`, TCP 443 from `0.0.0.0/0` |
| `loonaris-ecs-sg` | `sg-04ca66f68b5555dfe` | TCP 3000 from `sg-06d96155ff3fbe810` |
| `loonaris-rds-sg` | `sg-09ed86f323511f146` | TCP 5432 from `sg-04ca66f68b5555dfe`, `sg-0057547c8ba014373` |
| `security-group-bastion` | `sg-0057547c8ba014373` | TCP 22 from `0.0.0.0/0` |
| `default` | `sg-05cc7b2e4624b5bd6` | All traffic from self (`sg-05cc7b2e4624b5bd6`) |

**Bastion Host:**
| Property | Value |
|---|---|
| Instance ID | `i-0098c8d33fc342fb7` |
| Public IP | `13.39.112.107` |
| Key Pair | `bastion-key` |
| Security Group | `sg-0057547c8ba014373` |
| Purpose | SSH jump host for accessing private RDS from outside the VPC |

---

## 7. Backend Route Design Pattern

All API routes are mounted under `/api` via a single `apiRouter`. The root `index.ts` looks like this:

```typescript
const apiRouter = express.Router();

apiRouter.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

apiRouter.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
apiRouter.use('/auth', authRoutes);
apiRouter.use('/clusters', pgClusterRoutes);
apiRouter.use('/test', testAppRoutes);

app.use('/api', apiRouter);
```

**Public paths:**
- `/api/health` — ALB health check + liveness probe
- `/api/docs` — Swagger UI
- `/api/auth` — Auth routes
- `/api/clusters` — PostgreSQL cluster management
- `/api/test` — CRUD smoke-test

This means the ALB health check path must be `/api/health`, not `/health`.

---

## 8. Known Debugging History

**2026-05-29 — CI/CD deploys succeed but old image keeps running**

**Symptom:** GitHub Actions workflow completed successfully, pushed new image to ECR, `force-new-deployment` ran, but `/api/health` still returned the old response. ECS tasks showed digest `sha256:8d5e...` (old) even though ECR `:latest` pointed to `sha256:32f0...` (new).

**Root cause:** ECS Fargate caches the `:latest` tag resolution. Even after ECR `:latest` is overwritten with a new digest, ECS may continue pulling the old cached digest for newly scheduled tasks. This is a known ECS behavior.

**Fix applied:**
- Completely redesigned the CI/CD pipeline (`.github/workflows/backend-deploy.yml`) to:
  1. Build and push image with both `:latest` and `:<git-sha>` tags
  2. Capture the exact digest of the pushed image
  3. Register a **new task definition revision** with the image pinned to that exact digest (`@sha256:...`)
  4. Update the ECS service to use the new task definition revision
  5. Verify running tasks actually use the pushed digest
  6. Verify health endpoint returns expected content
- Added Docker layer caching via `docker/build-push-action@v6` with GitHub Actions cache (`type=gha`) for faster builds.
- Updated AGENTS.md deployment rules to reflect the new digest-based approach.

**Key lesson:** Never rely on ECS `:latest` tag resolution for CI/CD. Always pin the exact digest in the task definition.

---

**2026-05-29 — Fargate vCPU limit blocks deployments**

**Symptom:** ECS couldn't place new tasks during rolling deployment. Error: `"You've reached the limit on the number of vCPUs you can run concurrently"`.

**Root cause:** AWS account default Fargate on-demand vCPU quota was 4. Each task uses 1 vCPU. During rolling deployment, ECS temporarily needs 4 vCPUs (2 old + 2 new), which hit the limit.

**Fix applied:**
- Requested quota increase to 8 vCPUs via AWS Service Quotas.
- As a workaround, scaled service to 0 then back to 2 to force a clean deploy without needing concurrent old+new tasks.

---

**2026-05-29 — Signup / DB queries fail with TLS certificate error**

**Symptom:** `POST /api/auth/signup` returned `400` with message:
```
Error opening a TLS connection: self-signed certificate in certificate chain
```

**Root cause:** `DATABASE_URL` contained `?sslmode=require`. `pg` (node-postgres) parses `sslmode=require` from the connection string and overwrites any explicit `ssl` option passed to the `Pool` constructor. The code passed `ssl: { rejectUnauthorized: false }`, but `pg`'s `ConnectionParameters` replaces it with `ssl: true` (which `pg-connection-string` currently treats as `verify-full`). Without the RDS CA bundle in the container, certificate verification fails.

**Fix applied:**
- Updated `backend/src/lib/prisma.ts` to strip `sslmode` (and other SSL query params) from `DATABASE_URL` before creating the `pg` Pool, ensuring `DATABASE_SSL=true` is the single source of truth for SSL configuration.
- Removed `?sslmode=require` from `backend/.env.prod`.
- Rebuilt image, pushed to ECR.
- **Discovered the task definition (revision 7) had its image pinned to a digest (`@sha256:8852...`) instead of `:latest`.** This caused ECS to keep launching the old image even after `force-new-deployment`.
- Registered new task definition revision `8` with image set back to `:latest` and `DATABASE_URL` cleaned up (no `?sslmode=require`).
- Updated ECS service to use revision `8` + `force-new-deployment`.

---

**2026-05-29 — Service unreachable at ALB endpoint**

**Root causes found:**
1. ALB listener was on port `3000` instead of port `80` → `curl` on `:80` got `Connection refused`
2. Target group health check path was `/api/health`, but the deployed container only served `/health` → health checks returned `404` → ECS SIGKILL'd tasks (exit `137`) → endless replacement loop (`runningCount=4` vs `desiredCount=2`)

**Fixes applied:**
- Created ALB listener on port `80` → forwards to `loonaris-tg`
- Deleted incorrect listener on port `3000`
- Changed target group health check path to `/health` to stop the task-killing loop
- Added `app.get('/api/health', ...)` to the backend source
- Rebuilt image, pushed to ECR, updated ECS service
- Later: removed `/health`, kept only `/api/health`, reverted TG health check to `/api/health`

---

## 9. Golden Rules for Agents

1. **Deployment is always: build → push → register new task def with exact digest → `force-new-deployment`. Never rely on `:latest` tag resolution in ECS.**
2. **Never touch ALB listeners, target groups, or security groups without asking.**
3. **Health check path in the target group and the app must match exactly.**
4. **All app routes live under `/api` — keep it that way.**
5. **If ECS tasks are cycling (STOPPED with exit 137), check target group health first.**

---

## 10. Frontend Infrastructure (Nginx Reverse Proxy + S3)

Added 2026-05-30.

### Architecture

```
Internet ──▶ Nginx EC2 (SSL termination, Certbot)
              ├── /api/* ──▶ ALB (HTTP) ──▶ ECS/Fargate (Backend)
              └── /*      ──▶ /var/www/frontend (Static SPA from S3)
```

### EC2 Instance (Nginx Reverse Proxy)

| Property | Value |
|---|---|
| Instance ID | `i-090a4dd00c0ee23e5` |
| OS | Ubuntu 24.04 LTS |
| Public IP | `35.181.168.74` |
| Security Group | `sg-006944c1312d5588f` (`nginx-sg`) |
| IAM Role | `ec2-nginx-role` (instance profile `ec2-nginx-profile`) |
| SSH Key Pair | `nginx-key` |
| Domain | `loonaris.tech`, `www.loonaris.tech` |
| SSL | Let's Encrypt via Certbot (auto-renewal via `certbot.timer`) |

**Security Group Rules (`nginx-sg`):**
| Port | Source | Purpose |
|---|---|---|
| 22 | `0.0.0.0/0` | SSH |
| 80 | `0.0.0.0/0` | HTTP (redirect to HTTPS) |
| 443 | `0.0.0.0/0` | HTTPS (public traffic) |

**Installed Packages:** nginx, certbot, python3-certbot-nginx, awscli v2.

### S3 Bucket (Frontend Build Store)

| Property | Value |
|---|---|
| Bucket | `loonaris-frontend-12345` |
| ARN | `arn:aws:s3:::loonaris-frontend-12345` |
| Region | `eu-west-3` |

The EC2 role has read-only access. The bucket policy grants access to `arn:aws:iam::474741569968:role/ec2-nginx-role`.

### Nginx Reverse Proxy Behavior

- **SSL terminates on the EC2** (port 443). Certbot manages certificates.
- **HTTP → HTTPS redirect** for matching `Host` headers.
- **`/api/*`** is proxied to the ALB (`http://loonaris-alb-1830888004.eu-west-3.elb.amazonaws.com`) over plain HTTP.
- **`/*`** serves static files from `/var/www/frontend` with SPA fallback (`try_files $uri $uri/ /index.html`).

### Frontend CI/CD

**Workflow:** `.github/workflows/frontend-deploy.yml`

Triggers on `frontend/**` changes to `main`:
1. `npm ci && npm run build`
2. `aws s3 sync ./frontend/dist s3://loonaris-frontend-12345 --delete`
3. SSH to EC2: `aws s3 sync s3://... /var/www/frontend --delete && sudo nginx -s reload`
4. Verify `https://loonaris.tech/` and `https://loonaris.tech/api/health`

**Required GitHub secrets:**
| Secret | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM access key (can reuse backend secret) |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key (can reuse backend secret) |
| `EC2_HOST` | `35.181.168.74` |
| `EC2_SSH_KEY` | Private key for `nginx-key` PEM |

### DNS

`loonaris.tech` and `www.loonaris.tech` A-record → `35.181.168.74`

### Infrastructure as Code

All config files are versioned in the repo:
- `infrastructure/frontend/nginx/loonaris.conf`
- `infrastructure/frontend/iam/ec2-trust-policy.json`
- `infrastructure/frontend/iam/s3-read-policy.json`
- `infrastructure/frontend/iam/s3-bucket-policy.json`
- `infrastructure/frontend/README.md`

---

## 11. Known Debugging History — Frontend

**2026-05-30 — `https://loonaris.tech/` returns 403 Forbidden**

**Symptom:** After configuring Nginx and SSL, the root URL returned `403 Forbidden`.

**Root cause:** `/var/www/frontend/index.html` did not exist. The directory was empty because the frontend build had never been synced from S3 to the EC2.

**Fix applied:**
- Built the frontend locally (`npm run build` in `frontend/`)
- Uploaded the `dist/` folder to S3: `aws s3 sync ./frontend/dist s3://loonaris-frontend-12345 --delete`
- Synced from S3 to EC2: `aws s3 sync s3://loonaris-frontend-12345 /var/www/frontend --delete`
- Reloaded Nginx: `sudo nginx -s reload`
- Verified `https://loonaris.tech/` returns `200`

**Key lesson:** The Nginx reverse proxy config is correct, but the frontend deploy workflow must be run (or a manual sync done) to populate `/var/www/frontend` before the site will serve content.

---

---

## 13. Known Debugging History — Backend / Database

**2026-05-30 — Signup fails with `tenant.job_title does not exist`**

**Symptom:** `POST /api/auth/signup` returned `400` with Prisma error:
```
Invalid `prisma.tenant.findUnique()` invocation: The column `tenant.job_title` does not exist in the current database.
```

**Root cause:** Schema drift. The `tenant` table was created by migration `20260524134856_port_auth_and_project_model` with only these columns: `id`, `email`, `username`, `country`, `password_hash`, `photo_url`, `created_at`. However, the current `schema.prisma` also defines `jobTitle` (→ `job_title`) and `company` on the `Tenant` model. The Prisma Client was generated from the current schema and tried to query these columns, but they didn't exist in the production RDS database because no subsequent migrations had been created or applied for them.

**Fix applied:**
- Created migration `20260530103000_add_job_title_to_tenant` with: `ALTER TABLE "tenant" ADD COLUMN "job_title" TEXT;`
- Created migration `20260530103500_add_company_to_tenant` with: `ALTER TABLE "tenant" ADD COLUMN "company" TEXT;`
- Applied both migrations to production RDS via the **bastion host** (since RDS is not publicly accessible)
- Inserted migration records into `_prisma_migrations` manually so `prisma migrate deploy` tracks them
- Verified signup returns `200` and creates the user successfully

**Correct RDS access pattern (do not use the Nginx EC2):**
The bastion host (`i-0098c8d33fc342fb7`, IP `13.39.112.107`, key `bastion-key`) is the designated jump host for RDS access. Its security group (`sg-0057547c8ba014373`) is already whitelisted in the RDS security group (`sg-09ed86f323511f146`) for port `5432`.

Example:
```bash
# SSH tunnel via bastion
ssh -i /path/to/bastion-key.pem -L 5433:database-loonaris-app.c3s68wa6ehdt.eu-west-3.rds.amazonaws.com:5432 ubuntu@13.39.112.107 -f -N

# Or run psql directly on the bastion
ssh -i /path/to/bastion-key.pem ubuntu@13.39.112.107 \
  "psql 'postgresql://loonarispg:loonarisA123@database-loonaris-app.c3s68wa6ehdt.eu-west-3.rds.amazonaws.com:5432/loonarisdb' -c '...'"
```

**Key lesson:** Whenever the Prisma schema is updated with new fields on existing models, a migration MUST be created and applied to production. Use `prisma migrate dev --create-only` locally, commit the migration file, and ensure CI/CD or manual deploy applies it via `prisma migrate deploy`. Always use the **bastion host** for any production database operations — never use the Nginx EC2 for RDS access.

---

## 12. Golden Rules for Agents (Frontend)

1. **Never modify Nginx SSL config manually** — Certbot manages it. Use `sudo certbot renew --dry-run` to test.
2. **The EC2 must have the IAM instance profile attached** for S3 sync to work without long-term credentials.
3. **If you see 403 on `/`**, the frontend files are missing — run the S3 sync.
4. **If you see 404 on `/api/...`**, check the ALB target group health first.
