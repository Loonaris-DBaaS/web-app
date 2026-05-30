# Loonaris Operations Runbook

> Operational procedures for the Loonaris AWS infrastructure.
> Last updated: 2026-05-30

---

## Table of Contents

1. [Emergency Contacts / Quick Reference](#1-emergency-contacts--quick-reference)
2. [How to Deploy the Backend](#2-how-to-deploy-the-backend)
3. [How to Deploy the Frontend](#3-how-to-deploy-the-frontend)
4. [How to Run Database Migrations](#4-how-to-run-database-migrations)
5. [How to Rollback a Bad Deploy](#5-how-to-rollback-a-bad-deploy)
6. [How to SSH into Instances](#6-how-to-ssh-into-instances)
7. [Common Issues & Fixes](#7-common-issues--fixes)
8. [Verifying the System is Healthy](#8-verifying-the-system-is-healthy)

---

## 1. Emergency Contacts / Quick Reference

| Resource | Value |
|---|---|
| Domain | `https://loonaris.tech` |
| Health Check | `https://loonaris.tech/api/health` |
| AWS Region | `eu-west-3` |
| AWS Account | `474741569968` |

**Instances:**
| Role | Public IP | Key | User |
|---|---|---|---|
| Nginx (frontend + reverse proxy) | `35.181.168.74` | `nginx-key.pem` | `ubuntu` |
| Bastion (RDS jump host) | `13.39.112.107` | `bastion-key.pem` | `ubuntu` |

**SSH keys location (local):**
- `/home/ahmed/ingenieur/PFA/nginx-key.pem`
- `/home/ahmed/ingenieur/PFA/bastion-key.pem`

---

## 2. How to Deploy the Backend

### Automatic (Preferred)

Push to `main` with changes to `backend/**`:

```bash
git add backend/
git commit -m "your change"
git push origin main
```

The `.github/workflows/backend-deploy.yml` runs automatically:
1. Migrations via bastion SSH tunnel
2. Docker build + push to ECR
3. Register new ECS task definition with exact digest
4. Scale ECS service to 0 → update task def → scale to 2
5. Verify health endpoint

Monitor at: `https://github.com/Loonaris-DBaaS/web-app/actions`

### Manual (Fallback)

If CI/CD is broken:

```bash
cd backend && bash local-tools/push-container-script.sh

# Get the digest of the pushed image
DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' \
  474741569968.dkr.ecr.eu-west-3.amazonaws.com/ahmed-aws/loonaris:latest | cut -d'@' -f2)

# Register new task definition with exact digest
# (see CI workflow for full jq logic)

# Update service
aws ecs update-service \
  --cluster loonaris-ecs-fargate-cluster \
  --service loonaris-backend-service-p839kjg4 \
  --force-new-deployment \
  --region eu-west-3
```

---

## 3. How to Deploy the Frontend

### Automatic (Preferred)

Push to `main` with changes to `frontend/**`:

```bash
git add frontend/
git commit -m "your change"
git push origin main
```

The `.github/workflows/frontend-deploy.yml` runs automatically:
1. `npm ci && npm run build`
2. `aws s3 sync ./frontend/dist s3://loonaris-frontend-12345 --delete`
3. SSH to Nginx EC2: `aws s3 sync s3://... /var/www/frontend --delete`
4. `sudo nginx -s reload`
5. Verify `https://loonaris.tech/`

### Manual (Fallback)

```bash
cd frontend && npm run build

# Upload to S3
aws s3 sync ./dist s3://loonaris-frontend-12345 --delete --region eu-west-3

# Sync to EC2
ssh -i /home/ahmed/ingenieur/PFA/nginx-key.pem -o IdentitiesOnly=yes ubuntu@35.181.168.74 \
  "aws s3 sync s3://loonaris-frontend-12345 /var/www/frontend --delete && sudo nginx -s reload"

# Verify
curl -s -o /dev/null -w "%{http_code}" https://loonaris.tech/
```

---

## 4. How to Run Database Migrations

### Via CI/CD (Preferred)

Migrations run automatically on every backend deploy via the bastion SSH tunnel. The workflow:
1. Creates `ssh -L 5433:rds:5432 ubuntu@13.39.112.107`
2. Runs `npx prisma migrate deploy` through `localhost:5433`

### Manual (Emergency / One-off)

**Option A: SSH tunnel from your machine**

```bash
# Start tunnel in background
ssh -i ~/.ssh/bastion-key.pem -f -N \
  -L 5433:database-loonaris-app.c3s68wa6ehdt.eu-west-3.rds.amazonaws.com:5432 \
  ubuntu@13.39.112.107

# Run migrations locally
cd backend
DATABASE_URL="postgresql://loonarispg:loonarisA123@localhost:5433/loonarisdb" \
  npx prisma migrate deploy

# Kill tunnel
pkill -f "ssh.*5433.*bastion"
```

**Option B: Run psql directly on the bastion**

```bash
ssh -i ~/.ssh/bastion-key.pem ubuntu@13.39.112.107 \
  "psql 'postgresql://loonarispg:loonarisA123@database-loonaris-app.c3s68wa6ehdt.eu-west-3.rds.amazonaws.com:5432/loonarisdb' -c 'YOUR_SQL_HERE'"
```

**Important:** After running raw SQL manually, insert a record into `_prisma_migrations` so Prisma tracks it:

```sql
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
VALUES (gen_random_uuid(), 'manual', now(), 'YYYYmmddHHMMSS_migration_name', now(), 1);
```

---

## 5. How to Rollback a Bad Deploy

### Backend Rollback

```bash
# List task definition revisions
aws ecs list-task-definitions --family-prefix loonaris-backend --region eu-west-3 --sort DESC

# Pick the previous good revision (e.g., :10)
aws ecs update-service \
  --cluster loonaris-ecs-fargate-cluster \
  --service loonaris-backend-service-p839kjg4 \
  --task-definition loonaris-backend:10 \
  --force-new-deployment \
  --region eu-west-3
```

### Frontend Rollback

S3 versioning is not enabled. To rollback:
1. `git checkout <previous-commit>`
2. `cd frontend && npm run build`
3. Re-sync to S3 and EC2 (see Section 3)

---

## 6. How to SSH into Instances

### Nginx EC2 (Frontend / Reverse Proxy)

```bash
ssh -i /home/ahmed/ingenieur/PFA/nginx-key.pem \
  -o StrictHostKeyChecking=no \
  -o IdentitiesOnly=yes \
  ubuntu@35.181.168.74
```

**On the EC2:**
```bash
# Check Nginx status
sudo systemctl status nginx
sudo nginx -t

# Sync frontend from S3
aws s3 sync s3://loonaris-frontend-12345 /var/www/frontend --delete
sudo nginx -s reload

# Check SSL cert expiry
sudo certbot certificates

# Test SSL renewal
sudo certbot renew --dry-run
```

### Bastion Host (RDS Access)

```bash
ssh -i /home/ahmed/ingenieur/PFA/bastion-key.pem \
  -o StrictHostKeyChecking=no \
  -o IdentitiesOnly=yes \
  ubuntu@13.39.112.107
```

**On the bastion:**
```bash
# Connect to RDS directly
psql 'postgresql://loonarispg:loonarisA123@database-loonaris-app.c3s68wa6ehdt.eu-west-3.rds.amazonaws.com:5432/loonarisdb'
```

---

## 7. Common Issues & Fixes

### Issue: `403 Forbidden` on `https://loonaris.tech/`

**Cause:** `/var/www/frontend/index.html` is missing. The directory is empty.

**Fix:**
```bash
ssh -i nginx-key.pem ubuntu@35.181.168.74 \
  "aws s3 sync s3://loonaris-frontend-12345 /var/www/frontend --delete && sudo nginx -s reload"
```

---

### Issue: `404` on `/api/...`

**Cause:** ECS tasks are unhealthy or the ALB target group has no healthy targets.

**Fix:**
```bash
# Check ECS service status
aws ecs describe-services \
  --cluster loonaris-ecs-fargate-cluster \
  --services loonaris-backend-service-p839kjg4 \
  --region eu-west-3 \
  --query 'services[0].events[:3]'

# Check target group health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:eu-west-3:474741569968:targetgroup/loonaris-tg/11c4c851ffe8fc7e \
  --region eu-west-3
```

---

### Issue: `You've reached the limit on the number of vCPUs`

**Cause:** AWS Fargate quota is 4 vCPUs. Rolling deployment needs 4 (2 old + 2 new).

**Fix:** Already handled in CI/CD by scaling to 0 then back to 2.
If doing manually:
```bash
aws ecs update-service --cluster loonaris-ecs-fargate-cluster \
  --service loonaris-backend-service-p839kjg4 --desired-count 0 --region eu-west-3
# Wait for tasks to stop
aws ecs update-service --cluster loonaris-ecs-fargate-cluster \
  --service loonaris-backend-service-p839kjg4 --desired-count 2 --force-new-deployment --region eu-west-3
```

---

### Issue: Signup/DB queries fail with `column X does not exist`

**Cause:** Schema drift. The Prisma schema has fields that don't exist in the production database.

**Fix:** Create a migration and apply it (see Section 4).

```bash
cd backend
npx prisma migrate dev --create-only --name add_missing_column
# Commit the migration file
# Push to main — CI/CD will apply it automatically
```

---

### Issue: `self-signed certificate in certificate chain` (DB TLS)

**Cause:** `DATABASE_URL` contains `?sslmode=require` which overrides the `rejectUnauthorized: false` setting.

**Fix:** Remove `?sslmode=require` from the connection string. The code already handles SSL via `DATABASE_SSL=true`.

---

### Issue: ECS tasks keep cycling (STOPPED with exit 137)

**Cause:** Target group health check is failing. ECS SIGKILLs the task.

**Fix:**
1. Check target group health check path matches the app: `/api/health`
2. Verify the app actually serves `/api/health`
3. Check CloudWatch logs: `/ecs/loonaris-backend`

---

## 8. Verifying the System is Healthy

Run these checks after every deploy:

```bash
# 1. Frontend is reachable
curl -s -o /dev/null -w "%{http_code}" https://loonaris.tech/
# Expected: 200

# 2. API health check
curl -s https://loonaris.tech/api/health
# Expected: {"status":"ok",...}

# 3. API docs reachable
curl -s -o /dev/null -w "%{http_code}" https://loonaris.tech/api/docs
# Expected: 200

# 4. ECS tasks running with correct task definition
aws ecs describe-services --cluster loonaris-ecs-fargate-cluster \
  --services loonaris-backend-service-p839kjg4 --region eu-west-3 \
  --query 'services[0].{Running:runningCount,Desired:desiredCount,TaskDef:taskDefinition}'
# Expected: Running=2, Desired=2

# 5. SSL certificate valid
echo | openssl s_client -servername loonaris.tech -connect loonaris.tech:443 2>/dev/null | openssl x509 -noout -dates
# Verify notBefore < today < notAfter
```

---

## Golden Rules

1. **Never rely on ECS `:latest` tag resolution.** Always register a new task definition with the exact digest.
2. **Never touch ALB listeners, target groups, or security groups without asking.**
3. **Health check path in the target group and the app must match exactly.**
4. **All app routes live under `/api`.**
5. **If ECS tasks are cycling (STOPPED with exit 137), check target group health first.**
6. **Never modify Nginx SSL config manually.** Certbot manages it.
7. **Always use the bastion host for production database operations.** Never use the Nginx EC2 for RDS access.
8. **If you see 403 on `/`**, the frontend files are missing — run the S3 sync.
9. **Whenever Prisma schema changes, create a migration.** `prisma migrate dev --create-only`
