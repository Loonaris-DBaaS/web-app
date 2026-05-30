# Tenant Provisioning Engine Lifecycle & Specification

> This document details the end-to-end automated provisioning pipeline of the Loonaris DBaaS platform. It traces the lifecycle of a resource from an external user request down to the actual physical deployment of isolated compute pods inside the EKS cluster.

---

## 1. High-Level Provisioning Flow

```text
 ┌─────────────────┐       1. POST /api/clusters       ┌─────────────────┐
 │ External Client ├──────────────────────────────►│  Express Backend │
 └─────────────────┘                               └────────┬────────┘
                                                            │
                            ┌───────────────────────────────┴───────────────────────────────┐
                            │ 2. Generate base key, compute SHA-256 hash                     │
                            │ 3. Create Project (status="provisioning") + Pooler + ApiKey   │
                            │ 4. Compile K8s manifest blueprint (7 resources)               │
                            └───────────────────────────────┬───────────────────────────────┘
                                                            │
                                                            ▼ 5. Apply Manifests via @kubernetes/client-node
                                                   ┌─────────────────┐
                                                   │   AWS EKS API   │
                                                   └────────┬────────┘
                                                            │
                            ┌───────────────────────────────┴───────────────────────────────┐
                            │ 6. CNPG Operator spins up isolated Postgres Pods               │
                            │ 7. PgBouncer Deployments target internal K8s Services           │
                            └───────────────────────────────┬───────────────────────────────┘
                                                            │
                                 ┌──────────────────────────┴──────────────────────────┐
                                 │ 8. Poll CNPG status every 5s (max 5min)             │
                                 │    phase == "Healthy" → update Project.status="running" │
                                 │    timeout → update Project.status="error"           │
                                 └──────────────────────────┬──────────────────────────┘
                                                            │
                                                            │ 9. Gateway cache miss → GET /api/internal/routes/{hash}
                                                            │    Project.status="running" → mapped to "active"
                                                            ▼
                                                   Gateway tunnels client to PgBouncer
```

---

## 2. Phase-by-Phase Execution Mechanics

### Phase 1: Ingestion & Credential Generation

When a user requests a new database environment, the **Express Backend** executes the following preparation steps (`createCluster` in `pgCluster.service.ts`):

1. **ID Allocation:** Generates a UUID cluster identifier. The Kubernetes namespace is always `project-{clusterId}`.

2. **Key Generation:** Generates a single 64-hex random base key using `crypto.randomBytes(32).toString('hex')`. The full key presented to the user is `sk_live_{baseKey}_rw` (they can also use `_ro` with the same base key).

3. **Key Hashing:** Computes `SHA256(baseKey)` and stores only the hash in `api_keys.key_hash`. The plaintext base key is **never stored** — it is returned once in the API response and then only the user knows it.

4. **Pooler Host Computation:** Computes the K8s FQDNs from the namespace:
   - `rwHost = pooler-rw-svc.project-{clusterId}.svc.cluster.local`
   - `roHost = pooler-ro-svc.project-{clusterId}.svc.cluster.local`

5. **Database Ledger:** Creates the following Prisma records in a single transaction:
   - `Project` (status=`provisioning`, k8sNamespace=`project-{clusterId}`)
   - `ResourceConfig` (CPU, RAM, storage, replicas from the selected size tier)
   - `Pooler` (rwHost, rwPort=5432, roHost, roPort=5432)
   - `ApiKey` (keyHash, prefix=`sk_live_`, duration=90)

6. **Provisioning Call:** Invokes `provisionCluster(clusterId, namespace, dto)` which applies K8s manifests and polls for health.

### Phase 2: K8s Manifest Application

The `applyManifests()` function in `provisioning.ts` uses `@kubernetes/client-node` to apply 7 manifests in order:

1. **Namespace** — `project-{id}` with label `platform.loonaris.tech/tenant: "true"`
2. **Secret** — `app-db-credentials` containing the generated database password
3. **CNPG Cluster** — `instance-db` with tolerations for tenant nodes, topology spread, and bootstrap config
4. **PgBouncer RW Deployment** — connects to `instance-db-rw.project-{id}.svc.cluster.local`
5. **PgBouncer RW Service** — `pooler-rw-svc` on port 5432
6. **PgBouncer RO Deployment** — connects to `instance-db-ro.project-{id}.svc.cluster.local`
7. **PgBouncer RO Service** — `pooler-ro-svc` on port 5432

All manifests include tolerations for `dedicated=tenant:NoSchedule` to schedule onto tenant plane nodes.

Existing resources (409 Conflict) are handled gracefully — Namespaces are skipped, Secrets and CNPG Clusters are replaced, Deployments and Services are skipped.

### Phase 3: Activation Polling

The `pollClusterHealth()` function queries the EKS API server:

```typescript
customApi.getNamespacedCustomObject({
  group: 'postgresql.cnpg.io',
  version: 'v1',
  namespace,
  plural: 'clusters',
  name: 'instance-db',
});
```

- Polls every 5 seconds
- Maximum 60 attempts (5 minutes total)
- When `status.phase === "Healthy"` → returns `"running"` → Project is updated
- On timeout → returns `"error"` → Project status remains `"error"`

### Phase 4: Gateway Routing Activation

Once the Project status is `"running"`, the gateway's cache miss lookup (`GET /api/internal/routes/{keyHash}`) returns `"status": "active"` (mapped from `"running"` by `internal.service.ts`). The gateway then tunnels the client connection to the appropriate PgBouncer.

---

## 3. The Manifest Template Blueprint

The Express control plane dynamically renders the following K8s resources for every new project:

```yaml
---
apiVersion: v1
kind: Namespace
metadata:
  name: project-abc12345
  labels:
    platform.loonaris.tech/tenant: "true"

---
apiVersion: v1
kind: Secret
metadata:
  name: app-db-credentials
  namespace: project-abc12345
type: Opaque
stringData:
  password: "<auto-generated-24-char-password>"

---
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: instance-db
  namespace: project-abc12345
spec:
  instances: 2
  imageName: ghcr.io/cloudnativepg/postgresql:16
  storage:
    size: 10Gi
    storageClass: gp3
  tolerations:
    - key: "dedicated"
      operator: "Equal"
      value: "tenant"
      effect: "NoSchedule"
  topologySpreadConstraints:
    - maxSkew: 1
      topologyKey: "topology.kubernetes.io/zone"
      whenUnsatisfiable: "DoNotSchedule"
      labelSelector:
        matchLabels:
          cnpg.io/cluster: instance-db
  bootstrap:
    initdb:
      database: app
      owner: cloud_user
      secret:
        name: app-db-credentials

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pgbouncer-rw
  namespace: project-abc12345
spec:
  replicas: 1
  selector:
    matchLabels:
      app: pgbouncer-rw
  template:
    metadata:
      labels:
        app: pgbouncer-rw
    spec:
      tolerations:
        - key: "dedicated"
          operator: "Equal"
          value: "tenant"
          effect: "NoSchedule"
      containers:
        - name: pgbouncer
          image: edoburu/pgbouncer:latest
          ports:
            - containerPort: 5432
          env:
            - name: DB_HOST
              value: "instance-db-rw.project-abc12345.svc.cluster.local"
            - name: DB_PORT
              value: "5432"
            - name: DB_USER
              value: "cloud_user"
            - name: DB_PASSWORD
              value: "<auto-generated-password>"
            - name: POOL_MODE
              value: "transaction"

---
apiVersion: v1
kind: Service
metadata:
  name: pooler-rw-svc
  namespace: project-abc12345
spec:
  ports:
    - port: 5432
      targetPort: 5432
  selector:
    app: pgbouncer-rw

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pgbouncer-ro
  namespace: project-abc12345
spec:
  replicas: 1
  selector:
    matchLabels:
      app: pgbouncer-ro
  template:
    metadata:
      labels:
        app: pgbouncer-ro
    spec:
      tolerations:
        - key: "dedicated"
          operator: "Equal"
          value: "tenant"
          effect: "NoSchedule"
      containers:
        - name: pgbouncer
          image: edoburu/pgbouncer:latest
          ports:
            - containerPort: 5432
          env:
            - name: DB_HOST
              value: "instance-db-ro.project-abc12345.svc.cluster.local"
            - name: DB_PORT
              value: "5432"
            - name: DB_USER
              value: "cloud_user"
            - name: DB_PASSWORD
              value: "<auto-generated-password>"
            - name: POOL_MODE
              value: "transaction"

---
apiVersion: v1
kind: Service
metadata:
  name: pooler-ro-svc
  namespace: project-abc12345
spec:
  ports:
    - port: 5432
      targetPort: 5432
  selector:
    app: pgbouncer-ro
```

---

## 4. Deprovisioning

`DELETE /api/clusters/:id` triggers `deprovisionCluster(namespace)`:

1. Delete the CNPG Cluster CR (`instance-db`) from the namespace
2. Delete the entire namespace (K8s cascades all child resources: Deployments, Services, Secrets, PVCs)
3. Set Project status to `"deleting"`

---

## 5. Internal Route Lookup (Gateway → Control Plane)

The gateway calls:

```
GET /api/internal/routes/:keyHash
Authorization: Bearer <INTERNAL_GATEWAY_SECRET>
```

The Express backend (`internal.service.ts`):

1. Look up `ApiKey` by `key_hash` where `revoked_at IS NULL`
2. Include the related `Project` and `Pooler`
3. Map `ProjectStatus.running` → `"active"`
4. Return the route data

See `web-app/backend/docs/PROVISIONING_ENGINE.md` for the full API contract details.

---

## 6. Isolation Matrix

- **Compute Isolation:** Kubernetes `tolerations` matching `dedicated=tenant:NoSchedule` force scheduling onto dedicated tenant node pool
- **Network Isolation:** Each project gets its own namespace (`project-{id}`)
- **Storage Isolation:** CNPG creates separate `gp3` PersistentVolumeClaims per project
- **Backup Isolation:** S3 paths are prefixed by project ID (`/tenants/project-{id}/`)

---

## 7. Implementation Source Code

| File | Purpose |
|---|---|
| `src/modules/pgCluster/services/pgCluster.service.ts` | `createCluster()` — generates keys, creates Prisma records, calls provisioning |
| `src/modules/pgCluster/provisioning/provisioning.ts` | `provisionCluster()` — builds manifests, applies via K8s API, polls health |
| `src/lib/crypto.ts` | `generateBaseKey()`, `sha256Hex()`, `formatApiKey()` — key generation utilities |
| `src/modules/internal/services/internal.service.ts` | `lookupRoute()` — queries ApiKey → Project → Pooler, maps running → active |
| `src/middleware/internalAuth.ts` | Bearer shared-secret auth for gateway |