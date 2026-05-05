# Deploying to Azure

This guide deploys the web-app to Azure on the cheapest viable tier.

## Target architecture

| Component | Azure service | SKU (cheapest sane choice) |
|---|---|---|
| Frontend (React / Vite SPA) | App Service (Linux, Node 20 LTS) | **F1 Free** plan |
| Backend (Express) | Linux Virtual Machine | **Standard_B1s** (1 vCPU, 1 GB) |
| Database (PostgreSQL) | Azure Database for PostgreSQL Flexible Server | **Burstable B1ms** (1 vCPU, 2 GB) |

Approximate monthly cost (East US, pay-as-you-go, April 2026): ~$0 (App Service F1) + ~$8 (B1s VM) + ~$13 (B1ms Postgres) + ~$3 static IP = **~$24/month**. The B1s VM and B1ms Postgres are both eligible for the 12-month Azure free tier on a new account.

```
Browser
   │
   ▼
[ App Service (frontend, F1) ]   ──▶  static React build (dist/)
   │  /api/* fetch
   ▼
[ Azure VM (backend, B1s) ]      ──▶  node src/index.js (pm2)
   │  pg
   ▼
[ Azure DB for PostgreSQL Flexible Server (B1ms) ]
```

---

## 0. Prerequisites

```bash
# Install az CLI: https://learn.microsoft.com/cli/azure/install-azure-cli
az login
az account set --subscription "<your-subscription-id>"
```

Pick a region close to your users. The examples below use `westeurope` — change `LOC` to suit.

```bash
RG=dbaas-rg
LOC=westeurope
PG_NAME=dbaas-pg-$RANDOM           # must be globally unique
PG_ADMIN=pgadmin
PG_PASSWORD='ChangeMe!Strong#1'    # 8–128 chars, mixed case, digit, symbol
VM_NAME=dbaas-backend
APP_NAME=dbaas-frontend-$RANDOM    # must be globally unique

az group create -n $RG -l $LOC
```

---

## 1. PostgreSQL Flexible Server

Cheapest production-capable SKU is `Standard_B1ms` (Burstable). Public access is enabled so the VM and your laptop can reach it; tighten with firewall rules.

```bash
az postgres flexible-server create \
  --resource-group $RG \
  --name $PG_NAME \
  --location $LOC \
  --tier Burstable \
  --sku-name Standard_B1ms \
  --storage-size 32 \
  --version 16 \
  --admin-user $PG_ADMIN \
  --admin-password "$PG_PASSWORD" \
  --public-access 0.0.0.0 \
  --yes
```

`--public-access 0.0.0.0` opens it to all Azure services. Replace with your IP for stricter access:

```bash
# Allow your current IP only
MYIP=$(curl -s ifconfig.me)
az postgres flexible-server firewall-rule create \
  -g $RG --name $PG_NAME --rule-name laptop \
  --start-ip-address $MYIP --end-ip-address $MYIP

# Allow other Azure services (the VM will hit it from inside Azure)
az postgres flexible-server firewall-rule create \
  -g $RG --name $PG_NAME --rule-name azure-services \
  --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
```

Create the application database:

```bash
az postgres flexible-server db create \
  -g $RG --server-name $PG_NAME --database-name appdb
```

Connection details for the backend `.env`:

```
PGHOST=$PG_NAME.postgres.database.azure.com
PGPORT=5432
PGDATABASE=appdb
PGUSER=$PG_ADMIN
PGPASSWORD=$PG_PASSWORD
PGSSLMODE=require
```

> **Note:** Azure Postgres requires SSL. The current [backend/src/db.js](backend/src/db.js) doesn't pass `ssl` to the `pg` Pool — add `ssl: { rejectUnauthorized: false }` (or wire it through `PGSSLMODE`) before deploying, otherwise connections will fail.

---

## 2. Backend VM (Standard_B1s)

```bash
az vm create \
  --resource-group $RG \
  --name $VM_NAME \
  --image Ubuntu2204 \
  --size Standard_B1s \
  --admin-username azureuser \
  --generate-ssh-keys \
  --public-ip-sku Standard

# Open port 3001 (the Express port)
az vm open-port -g $RG -n $VM_NAME --port 3001 --priority 1010

# Capture the public IP for later
VM_IP=$(az vm show -d -g $RG -n $VM_NAME --query publicIps -o tsv)
echo "Backend public IP: $VM_IP"
```

SSH in and install the runtime:

```bash
ssh azureuser@$VM_IP

# --- on the VM ---
sudo apt update && sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

git clone <your-repo-url> web-app
cd web-app/backend
npm ci --omit=dev

cat > .env <<EOF
PORT=3001
JWT_SECRET=$(openssl rand -hex 32)
PGHOST=<your-pg>.postgres.database.azure.com
PGPORT=5432
PGDATABASE=appdb
PGUSER=pgadmin
PGPASSWORD='<your-pg-password>'
PGSSLMODE=require
EOF

pm2 start src/index.js --name backend
pm2 save
pm2 startup systemd -u azureuser --hp /home/azureuser   # then run the printed command with sudo
```

Verify from your laptop:

```bash
curl http://$VM_IP:3001/auth/signup -X POST \
  -H 'Content-Type: application/json' \
  -d '{"email":"a@b.c","password":"x"}'
```

> The current backend hardcodes `app.use(cors({ origin: 'http://localhost:3000' }))` in [backend/src/index.js:12](backend/src/index.js#L12). Update it to read the App Service URL from `process.env.CORS_ORIGIN` and add it to `.env` before deploying.

---

## 3. Frontend on App Service (F1 Free)

The frontend is a Vite SPA — App Service can serve the static build directly via the Node runtime.

Build locally with the backend URL baked in:

```bash
cd frontend
echo "VITE_API_URL=http://$VM_IP:3001" > .env.production
npm ci
npm run build
```

> If [frontend/src](frontend/src) doesn't already read `VITE_API_URL`, replace any hardcoded `http://localhost:3001` references with `import.meta.env.VITE_API_URL` first.

Create the plan and web app:

```bash
az appservice plan create \
  -g $RG -n dbaas-plan \
  --is-linux --sku F1

az webapp create \
  -g $RG --plan dbaas-plan \
  -n $APP_NAME \
  --runtime "NODE:20-lts"
```

Serve `dist/` with a tiny `serve` startup. Add a `server.json` next to the build (or use the `serve` package):

```bash
# from frontend/
cd dist
npm init -y >/dev/null
npm install --save serve
cat > package.json <<'EOF'
{
  "name": "frontend-static",
  "scripts": { "start": "serve -s . -l 8080" },
  "dependencies": { "serve": "^14.2.0" }
}
EOF
zip -r ../deploy.zip .
cd ..

az webapp deploy \
  -g $RG -n $APP_NAME \
  --src-path deploy.zip --type zip

az webapp config set \
  -g $RG -n $APP_NAME \
  --startup-file "npm start"
```

The App Service URL prints as:

```bash
az webapp show -g $RG -n $APP_NAME --query defaultHostName -o tsv
# e.g. dbaas-frontend-12345.azurewebsites.net
```

Then back-fill the backend's CORS allowlist with `https://<that-hostname>` and `pm2 restart backend`.

---

## 4. HTTPS for the backend (optional, recommended)

The frontend is served over HTTPS by App Service, so browsers will block plain `http://` calls to the VM (mixed content). Cheapest fixes, in increasing effort:

1. **Caddy on the VM** — free auto-HTTPS via Let's Encrypt. Point a subdomain (e.g. `api.yourdomain.com`) at `$VM_IP`, then on the VM:
   ```bash
   sudo apt install -y caddy
   sudo tee /etc/caddy/Caddyfile <<'EOF'
   api.yourdomain.com {
     reverse_proxy localhost:3001
   }
   EOF
   sudo systemctl restart caddy
   ```
   Update `VITE_API_URL=https://api.yourdomain.com` and rebuild.

2. **Application Gateway** — managed, but adds ~$20/month. Skip on the cheapest tier.

---

## 5. Updating the app

**Backend:**
```bash
ssh azureuser@$VM_IP
cd web-app && git pull && cd backend && npm ci --omit=dev && pm2 restart backend
```

**Frontend:**
```bash
cd frontend
npm run build
cd dist && zip -r ../deploy.zip . && cd ..
az webapp deploy -g $RG -n $APP_NAME --src-path deploy.zip --type zip
```

---

## 6. Tear-down

```bash
az group delete -n $RG --yes --no-wait
```

Deletes everything in this guide in one shot.

---

## Cheapest-tier caveats

- **F1 App Service**: 60 CPU minutes/day, no custom domains with SSL, no "always on". Fine for a low-traffic dashboard; upgrade to **B1 (~$13/mo)** when you need a custom domain + TLS.
- **B1s VM**: burstable credits — sustained CPU >10% will throttle. Fine for ~10 req/s of Express; upgrade to **B2s** if Postgres pool churn or bcrypt rounds saturate it.
- **B1ms Postgres**: 2 GB RAM, 32 GB storage minimum. Backups are 7 days by default — bump retention with `--backup-retention 14` when it matters.
- **Public Postgres**: convenient but exposed. Once the backend is stable, switch to **VNet integration** (private endpoint) — costs the same and removes the firewall management burden.
