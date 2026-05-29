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
- **The task definition must reference `:latest`**, not a pinned digest (`@sha256:...`). If it ever gets pinned, `force-new-deployment` will keep pulling the old digest even after a new push.
- **Normal deploy flow:** `docker build` → `docker push` (overwrites `:latest` in ECR) → `force-new-deployment`
- **You only need to register a new task definition revision** if:
  - The image reference got pinned to a digest (fix it back to `:latest`)
  - Environment variables, CPU, memory, or other task-level config needs to change
- **Never create new target groups or listener rules.**

### Automated CI/CD (GitHub Actions)

The backend deploys automatically on every push to `main` that changes `backend/**`.

**Workflow file:** `.github/workflows/backend-deploy.yml`

**What it does:**
1. Checks out the repo
2. Configures AWS credentials (from GitHub secrets)
3. Logs into ECR
4. Builds and pushes `…/ahmed-aws/loonaris:latest`
5. Forces a new ECS deployment
6. Waits for the service to reach steady state
7. Verifies `/api/health` responds with `200`

**Required GitHub secrets:**
| Secret | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |

> See `backend/CI-CD-PLAN.md` for the full pipeline design, rollback strategy, and future improvements.

### Manual deploy (fallback)

If you ever need to deploy manually (e.g., CI is broken):

```bash
cd backend && bash local-tools/push-container-script.sh
aws ecs update-service \
  --cluster loonaris-ecs-fargate-cluster \
  --service loonaris-backend-service-p839kjg4 \
  --force-new-deployment \
  --region eu-west-3
```

> If the task definition image is pinned to a digest, re-register the task definition with `:latest` first, then run `force-new-deployment`.

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
- **Task Definition Family:** `loonaris-backend` (currently revision `8`)
- **Active Task Definition ARN:** `arn:aws:ecs:eu-west-3:474741569968:task-definition/loonaris-backend:8`
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

> The task definition image must reference `:latest`, not a pinned digest. If it ever gets pinned to a digest (e.g. `@sha256:...`), `force-new-deployment` will reuse the old image even if ECR `latest` is overwritten. Re-register the task definition with `:latest` if that happens.

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

1. **Deployment is always: build → push → `force-new-deployment`. Only register a new task definition if the image got pinned to a digest or task-level config changed.**
2. **Never touch ALB listeners, target groups, or security groups without asking.**
3. **Health check path in the target group and the app must match exactly.**
4. **All app routes live under `/api` — keep it that way.**
5. **If ECS tasks are cycling (STOPPED with exit 137), check target group health first.**
