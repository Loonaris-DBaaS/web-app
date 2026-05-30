# Frontend Infrastructure — Nginx Reverse Proxy + S3

> All frontend infrastructure is defined as code in this directory.
> Last updated: 2026-05-30

---

## Architecture

```
Internet ──▶ Nginx EC2 (SSL termination, Certbot)
              ├── /api/* ──▶ ALB (HTTP) ──▶ ECS/Fargate (Backend)
              └── /*      ──▶ /var/www/frontend (Static SPA from S3)
```

- **SSL terminates at the Nginx EC2** (port 443).
- **Nginx → ALB is plain HTTP** (internal, no SSL needed between them).
- **Static files** are synced from S3 to the EC2 on every deploy.

---

## Components

### 1. EC2 Instance (Nginx Reverse Proxy)

| Property | Value |
|---|---|
| Instance ID | `i-090a4dd00c0ee23e5` |
| OS | Ubuntu 24.04 LTS |
| Public IP | `35.181.168.74` |
| Security Group | `sg-006944c1312d5588f` (`nginx-sg`) |
| IAM Role | `ec2-nginx-role` (via instance profile `ec2-nginx-profile`) |
| SSH Key Pair | `nginx-key` |
| Domain | `loonaris.tech`, `www.loonaris.tech` |
| SSL Cert | Let's Encrypt via Certbot (auto-renewal enabled) |

**Security Group Rules (`nginx-sg`):**
| Port | Protocol | Source | Purpose |
|---|---|---|---|
| 22 | TCP | `0.0.0.0/0` | SSH |
| 80 | TCP | `0.0.0.0/0` | HTTP (Certbot + redirect) |
| 443 | TCP | `0.0.0.0/0` | HTTPS (public traffic) |

**Installed Packages:**
- `nginx`
- `certbot` + `python3-certbot-nginx`
- `awscli` v2

**Directories:**
- `/var/www/frontend` — Static build files synced from S3
- `/etc/nginx/sites-available/loonaris` — Nginx site config

### 2. S3 Bucket (Frontend Build Artifact Store)

| Property | Value |
|---|---|
| Bucket Name | `loonaris-frontend-12345` |
| ARN | `arn:aws:s3:::loonaris-frontend-12345` |
| Region | `eu-west-3` |
| Purpose | Stores the Vite build output (`dist/`) |

**Bucket Policy:**
See `iam/s3-bucket-policy.json`. Allows read-only access from the EC2 IAM role.

**Why S3 → EC2 sync instead of serving directly from S3?**

S3 is used as a **build artifact store**, not as the live web server. Nginx serves static files from the local disk (`/var/www/frontend`). This design choice was made for the following reasons:

1. **Performance:** Nginx reads from local disk (`sendfile`), avoiding S3 latency on every user request.
2. **Cost:** No S3 egress charges for every CSS/JS/image load served to users.
3. **SPA Routing:** `try_files` fallback to `index.html` works natively with Nginx, which is harder to implement correctly when proxying to S3.
4. **Security:** The S3 bucket can remain private — no public website endpoint or CloudFront distribution is needed.
5. **Unified Entry Point:** Nginx is the single point of termination for SSL, static files, and API proxying.

The alternative (Nginx proxying `/*` directly to S3) would simplify CI/CD by removing the SSH step, but it would add latency, increase costs, and weaken the unified architecture. The current approach is the standard pattern for this setup.

### 3. ALB (Backend Target)

| Property | Value |
|---|---|
| DNS Name | `loonaris-alb-1830888004.eu-west-3.elb.amazonaws.com` |
| Protocol | HTTP (port 80) from Nginx |
| Target | ECS Fargate tasks on port 3000 |

Nginx proxies `/api/*` to this ALB. The ALB handles health checks at `/api/health`.

---

## Nginx Configuration

The main site config is at `nginx/loonaris.conf`.

**Key behaviors:**
- **HTTP (80):** Redirects all traffic to HTTPS
- **HTTPS (443):**
  - Serves static files from `/var/www/frontend`
  - `try_files` ensures React Router SPA works (falls back to `index.html`)
  - Proxies `/api/*` to the ALB over HTTP
  - Adds standard proxy headers (`X-Forwarded-For`, `X-Forwarded-Proto`, etc.)

**SSL:** Managed by Certbot. Auto-renewal via systemd timer (`certbot.timer`).

---

## IAM Policies

### EC2 Role Trust Policy
See `iam/ec2-trust-policy.json`

### EC2 S3 Read Policy (inline)
See `iam/s3-read-policy.json`

### S3 Bucket Policy
See `iam/s3-bucket-policy.json`

---

## Deployment Flow

1. **GitHub Actions** triggers on `frontend/**` changes pushed to `main`
2. **Build:** `npm ci && npm run build` in `frontend/`
3. **Upload to S3:** `aws s3 sync ./frontend/dist s3://loonaris-frontend-12345 --delete`
4. **Sync to EC2:** SSH into the Nginx EC2 and run `aws s3 sync s3://... /var/www/frontend --delete`
5. **Reload Nginx:** `sudo nginx -s reload`
6. **Verify:** curl `https://loonaris.tech/` and `https://loonaris.tech/api/health`

**Workflow file:** `.github/workflows/frontend-deploy.yml`

---

## GitHub Secrets Required

| Secret | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM access key for S3 upload |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key for S3 upload |
| `EC2_HOST` | Nginx EC2 public IP (`35.181.168.74`) |
| `EC2_SSH_KEY` | Private SSH key (PEM) for `nginx-key` pair |

> Note: `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` can be the same as the backend workflow.

---

## DNS

Domain `loonaris.tech` (and `www.loonaris.tech`) must have an **A record** pointing to the EC2 public IP (`35.181.168.74`).

---

## Manual Operations

### SSH into the Nginx EC2
```bash
ssh -i /path/to/nginx-key.pem ubuntu@35.181.168.74
```

### Sync frontend manually from S3
```bash
aws s3 sync s3://loonaris-frontend-12345 /var/www/frontend --delete
sudo nginx -s reload
```

### Check Certbot auto-renewal
```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

### Check Nginx status
```bash
sudo systemctl status nginx
sudo nginx -t
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `404` on IP access | Certbot config uses `server_name` matching | Access via `loonaris.tech`, not IP |
| `403` on HTTPS root | `/var/www/frontend/index.html` missing | Run S3 sync or deploy workflow |
| API returns `502` | ECS tasks unhealthy | Check ALB target group health |
| Cert expired | Auto-renew failed | `sudo certbot renew --force-renewal` |
| SSH fails | Too many auth failures | Use `IdentitiesOnly=yes` flag |

---

## Certbot Details

- **Email:** `admin@loonaris.tech`
- **Domains:** `loonaris.tech`, `www.loonaris.tech`
- **Certificate path:** `/etc/letsencrypt/live/loonaris.tech/`
- **Auto-renewal:** Enabled via `certbot.timer` systemd timer
- **Plugin:** `python3-certbot-nginx` (modifies Nginx config automatically)
