# Loonaris AWS Infrastructure — Current Architecture

> Last updated: 2026-05-30
> This document replaces the old `DEPLOY_AWS.md` which described the initial demo setup.

---

## Architecture Overview

```
Internet
  │
  ├──▶ https://loonaris.tech/  ──▶ Nginx EC2 (SSL termination)
  │                                  ├── /api/* ──▶ ALB (HTTP) ──▶ ECS/Fargate ──▶ RDS PostgreSQL
  │                                  └── /*      ──▶ /var/www/frontend (S3 sync)
  │
  └──▶ ssh 13.39.112.107 ──▶ Bastion Host ──▶ RDS (private subnet)
```

---

## AWS Account

| Property | Value |
|---|---|
| Account ID | `474741569968` |
| Region | `eu-west-3` |
| CLI profile | `default` |

---

## 1. Application Load Balancer (ALB)

| Property | Value |
|---|---|
| Name | `loonaris-alb` |
| DNS | `loonaris-alb-1830888004.eu-west-3.elb.amazonaws.com` |
| ARN | `arn:aws:elasticloadbalancing:eu-west-3:474741569968:loadbalancer/app/loonaris-alb/488e85f638c84adb` |
| Listener | Port 80 → forwards to `loonaris-tg` |
| Security Group | `sg-06d96155ff3fbe810` (`loonaris-alb-sg`) |

---

## 2. Target Group

| Property | Value |
|---|---|
| Name | `loonaris-tg` |
| ARN | `arn:aws:elasticloadbalancing:eu-west-3:474741569968:targetgroup/loonaris-tg/11c4c851ffe8fc7e` |
| Protocol | HTTP, Port 3000 |
| Health Check | `/api/health` → expects `200` |

---

## 3. ECS (Backend)

### Cluster
- **Name:** `loonaris-ecs-fargate-cluster`

### Service
- **Name:** `loonaris-backend-service-p839kjg4`
- **Launch Type:** FARGATE
- **Desired Count:** 2
- **Task Definition Family:** `loonaris-backend`
- **Deployment:** Circuit breaker + rollback enabled
- **Max %:** 200 / **Min Healthy %:** 100

### Task Definition
- **CPU:** 1024 (1 vCPU)
- **Memory:** 3072 (3 GB)
- **Network Mode:** awsvpc
- **Assign Public IP:** DISABLED
- **Subnets:** `subnet-0190da135d58a82f5`, `subnet-0ac18267c30a9f63e`
- **Security Group:** `sg-04ca66f68b5555dfe` (`loonaris-ecs-sg`)

**Container:** `application-backend-loonaris-container`
- **Port:** 3000 (TCP)
- **Image:** Pinned to exact digest on every deploy
- **Log Driver:** `awslogs`

---

## 4. RDS PostgreSQL

| Property | Value |
|---|---|
| Identifier | `database-loonaris-app` |
| Endpoint | `database-loonaris-app.c3s68wa6ehdt.eu-west-3.rds.amazonaws.com:5432` |
| DB Name | `loonarisdb` |
| Engine | PostgreSQL |
| Instance | `db.t4g.micro` |
| **Publicly Accessible** | **No** |
| Security Group | `sg-09ed86f323511f146` (`loonaris-rds-sg`) |

**Important:** RDS is private. It can only be accessed from:
- ECS tasks (security group `sg-04ca66f68b5555dfe`)
- Bastion host (security group `sg-0057547c8ba014373`)

---

## 5. Bastion Host (Jump Server)

| Property | Value |
|---|---|
| Instance ID | `i-0098c8d33fc342fb7` |
| OS | Ubuntu 24.04 LTS |
| Public IP | `13.39.112.107` |
| Key Pair | `bastion-key` |
| Security Group | `sg-0057547c8ba014373` |
| Purpose | SSH jump host for RDS access |

**SSH:**
```bash
ssh -i ~/.ssh/bastion-key.pem ubuntu@13.39.112.107
```

---

## 6. Frontend (Nginx Reverse Proxy + S3)

### EC2 Instance
| Property | Value |
|---|---|
| Instance ID | `i-090a4dd00c0ee23e5` |
| OS | Ubuntu 24.04 LTS |
| Public IP | `35.181.168.74` |
| Domain | `loonaris.tech`, `www.loonaris.tech` |
| SSL | Let's Encrypt (Certbot) |
| IAM Role | `ec2-nginx-role` (instance profile `ec2-nginx-profile`) |
| Key Pair | `nginx-key` |

### Nginx Behavior
- **Port 80:** Redirects to HTTPS
- **Port 443:** SSL termination
  - `/api/*` → proxied to ALB over HTTP
  - `/*` → serves static files from `/var/www/frontend`

### S3 Bucket
| Property | Value |
|---|---|
| Name | `loonaris-frontend-12345` |
| Purpose | Build artifact store (not public web server) |

**Why not serve directly from S3?**
Nginx serves static files from local disk. S3 is only a build artifact store that the EC2 syncs from. This avoids S3 latency per request and keeps S3 private.

---

## 7. Security Groups

| SG | ID | Inbound Rules |
|---|---|---|
| `loonaris-alb-sg` | `sg-06d96155ff3fbe810` | 80, 443 from `0.0.0.0/0` |
| `loonaris-ecs-sg` | `sg-04ca66f68b5555dfe` | 3000 from `sg-06d96155ff3fbe810` |
| `loonaris-rds-sg` | `sg-09ed86f323511f146` | 5432 from `sg-04ca66f68b5555dfe`, `sg-0057547c8ba014373` |
| `security-group-bastion` | `sg-0057547c8ba014373` | 22 from `0.0.0.0/0` |
| `nginx-sg` | `sg-006944c1312d5588f` | 22, 80, 443 from `0.0.0.0/0` |

---

## 8. DNS

`loonaris.tech` and `www.loonaris.tech` A-record → `35.181.168.74` (Nginx EC2)

---

## 9. ECR Repository

| Property | Value |
|---|---|
| URI | `474741569968.dkr.ecr.eu-west-3.amazonaws.com/ahmed-aws/loonaris` |
| Tags | `:latest` + `:<git-sha>` |
| Digest pinning | Every deploy registers a new task definition revision with exact digest |

---

## 10. Known Constraints

1. **Fargate vCPU quota = 4.** Each task uses 1 vCPU. Rolling deployment would need 4 vCPUs (2 old + 2 new), which hits the limit.
   - **Workaround:** CI/CD scales service to 0, updates task definition, scales back to 2.
   - **Trade-off:** ~30 seconds of downtime per deploy.

2. **RDS is private.** Cannot connect directly from GitHub Actions runners or local machines without using the bastion host.

3. **ECS caches `:latest`.** Never use `:latest` in the task definition. Always pin the exact digest.

---

## 11. Infrastructure as Code (Versioned in Repo)

| File | Purpose |
|---|---|
| `.github/workflows/backend-deploy.yml` | Backend CI/CD |
| `.github/workflows/frontend-deploy.yml` | Frontend CI/CD |
| `infrastructure/frontend/nginx/loonaris.conf` | Nginx site config |
| `infrastructure/frontend/iam/ec2-trust-policy.json` | IAM trust policy |
| `infrastructure/frontend/iam/s3-read-policy.json` | EC2 S3 read policy |
| `infrastructure/frontend/iam/s3-bucket-policy.json` | S3 bucket policy |
| `infrastructure/frontend/README.md` | Frontend infrastructure docs |
| `AGENTS.md` | Agent-focused operational knowledge |
