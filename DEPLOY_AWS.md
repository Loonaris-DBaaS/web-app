# Deploy Loonaris to AWS — Simple Version

Backend on **ECS Fargate** + database on **RDS PostgreSQL**.
No custom VPC, no load balancer, no SSM — fewest clicks. Good for a demo / school project.
(Upgrade notes at the bottom for when you want HTTPS + a stable URL.)

- **Account:** 474741569968   **Region:** us-east-1   **CLI profile:** `loonaris`

```
Internet ──▶ ECS Fargate task (public IP, port 3001) ──▶ RDS PostgreSQL
```

---

## 1. Push the image to ECR

ECR → **Create repository** → name `loonaris-backend` → Create.
Open it → **View push commands** → run them from the `backend/` folder, adding `--profile loonaris`:

```bash
cd backend
aws ecr get-login-password --region us-east-1 --profile loonaris \
  | docker login --username AWS --password-stdin 474741569968.dkr.ecr.us-east-1.amazonaws.com
docker build -t loonaris-backend .
docker tag loonaris-backend:latest 474741569968.dkr.ecr.us-east-1.amazonaws.com/loonaris-backend:latest
docker push 474741569968.dkr.ecr.us-east-1.amazonaws.com/loonaris-backend:latest
```

Copy the image URI (`…/loonaris-backend:latest`).

---

## 2. Create the database (RDS)

RDS → **Create database**:
- **Standard create**, **PostgreSQL**, Template **Free tier**
- Identifier `loonaris-db`, master username `loonaris`, set a password (save it)
- Instance `db.t4g.micro`
- **Public access: Yes**
- Security group: **Create new** → `loonaris-rds-sg` (the wizard adds your current IP)
- **Additional configuration → Initial database name: `loonaris`**
- Create → wait for **Available** → copy the **endpoint**.

**Run migrations from your laptop** (one time):
```bash
cd backend
DATABASE_URL="postgresql://loonaris:<password>@<endpoint>:5432/loonaris?sslmode=require" \
  npx prisma migrate deploy
```

---

## 3. Create the ECS cluster

ECS → **Create cluster** → name `loonaris` → infrastructure **AWS Fargate** → Create.

---

## 4. Create the task definition

ECS → **Task definitions** → **Create**:
- Family `loonaris-backend`, launch type **Fargate**, **0.25 vCPU / 0.5 GB**
- Container: name `loonaris-backend`, **Image URI** from step 1, port **3001**
- **Environment variables** (plain — fine for a school project):
  - `NODE_ENV` = `production`
  - `PORT` = `3001`
  - `DATABASE_SSL` = `true`
  - `DATABASE_URL` = `postgresql://loonaris:<password>@<endpoint>:5432/loonaris`
  - `JWT_SECRET` = a long random string
  - `JWT_REFRESH_SECRET` = another long random string
  - `CORS_ORIGIN` = your frontend URL (or leave default for now)
- Logging: leave **CloudWatch** on. Execution role: leave **default / create new**.
- Create.

---

## 5. Run it (ECS service)

ECS → cluster `loonaris` → **Services** → **Create**:
- Launch type **Fargate**, task definition `loonaris-backend`, desired tasks **1**
- Networking: **default VPC**, pick a subnet, **Public IP = ON**
- Security group: **Create new** → `loonaris-ecs-sg`, inbound **TCP 3001 from `0.0.0.0/0`**
- **No load balancer**
- Create.

---

## 6. Let the task reach the database

RDS → `loonaris-db` → its security group `loonaris-rds-sg` → **Edit inbound rules** →
add **PostgreSQL 5432**, source = **`loonaris-ecs-sg`**.

---

## 7. Test

ECS → service → **Tasks** → click the running task → copy its **Public IP**:
```bash
curl http://<public-ip>:3001/health     # → {"status":"ok"}
curl http://<public-ip>:3001/docs       # Swagger UI
```

Done. ✅

---

## Going production-grade later (optional)

The simple setup has 3 known tradeoffs — fix them when you need to:

1. **The public IP changes on every redeploy + it's HTTP only.** → Add an **Application Load Balancer** + an **ACM** certificate, and point `api.loonaris.tech` at it. Gives a stable HTTPS URL.
2. **Secrets sit in the task definition.** → Move `JWT_*` and `DATABASE_URL` to **SSM Parameter Store** (SecureString) and reference them by ARN.
3. **RDS is public.** → Put it in private subnets and set **Public access = No**.

Ask me and I'll walk through any of these.

---

## Teardown (stop charges)

Delete: ECS service → ECS cluster → RDS (skip final snapshot for a throwaway). ECR repo is nearly free to leave.
