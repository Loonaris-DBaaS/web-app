# Database Design

## Entity-Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                            tenant                                   │
├──────────────────┬──────────────────┬───────────────────────────────┤
│ id (PK)          │ UUID             │ a1b2c3d4-e5f6-...             │
│ email (UQ)       │ VARCHAR          │ alice@example.com             │
│ username (UQ)    │ VARCHAR          │ alice                          │
│ country          │ VARCHAR NULL      │ FR                             │
│ job_title        │ VARCHAR NULL      │ DevOps Engineer                │
│ company          │ VARCHAR NULL      │ Acme Corp                      │
│ password_hash    │ VARCHAR          │ $2a$10$xYz...                 │
│ photo_url        │ VARCHAR NULL      │ https://img.io/alice.jpg       │
│ created_at       │ TIMESTAMP        │ 2026-05-30T10:00:00Z           │
└────────┬─────────┴──────────────────┴───────────────────────────────┘
         │ 1
         │
         ├─── 1:N ──→ refresh_tokens
         │
         ├─── 1:N ──→ projects
         │
         │


┌─────────────────────────────────────────────────────────────────────┐
│                        refresh_tokens                               │
├──────────────────┬──────────────────┬───────────────────────────────┤
│ id (PK)          │ UUID             │ r1t2u3v4-w5x6-...             │
│ token (UQ)       │ VARCHAR          │ a8f3b2c1d4e5f6...             │
│ expires_at       │ TIMESTAMP        │ 2026-06-06T10:00:00Z          │
│ revoked_at       │ TIMESTAMP NULL    │ NULL                           │
│ created_at       │ TIMESTAMP        │ 2026-05-30T10:00:00Z          │
│ tenant_id (FK)   │ UUID             │ a1b2c3d4-e5f6-...             │
└─────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                            projects                                  │
├─────────────────────┬──────────────────┬────────────────────────────┤
│ id (PK)             │ UUID             │ p7q8r9s0-t1u2-...          │
│ name                │ VARCHAR          │ Alice Production DB         │
│ k8s_namespace (UQ)  │ VARCHAR          │ project-p7q8r9s0-...       │
│ pg_version          │ VARCHAR          │ 16                          │
│ region              │ VARCHAR          │ eu-west-1                   │
│ deployment_option   │ ENUM             │ MULTI_AZ_CLUSTER            │
│ estimated_price     │ FLOAT DEFAULT 0  │ 120.5                       │
│ price               │ FLOAT DEFAULT 0  │ 0                           │
│ cpu_usage           │ FLOAT DEFAULT 0  │ 0                           │
│ ram_usage           │ FLOAT DEFAULT 0  │ 0                           │
│ storage_usage       │ FLOAT DEFAULT 0  │ 0                           │
│ status              │ ENUM DEFAULT     │ running                     │
│                     │  'provisioning'  │                             │
│ created_at          │ TIMESTAMP        │ 2026-05-30T10:05:00Z       │
│ updated_at          │ TIMESTAMP        │ 2026-05-30T10:05:00Z       │
│ tenant_id (FK)      │ UUID             │ a1b2c3d4-e5f6-...          │
└────────┬────────────┴──────────────────┴────────────────────────────┘
         │ 1
         │
         ├─── 1:1 ──→ resource_configs
         │
         ├─── 1:1 ──→ poolers
         │
         └─── 1:N ──→ api_keys


┌─────────────────────────────────────────────────────────────────────┐
│                       resource_configs                               │
├──────────────────┬──────────────────┬───────────────────────────────┤
│ id (PK)          │ UUID             │ rc1a2b3c-d4e5-...             │
│ desired_replicas │ INT              │ 3                              │
│ enable_backup    │ BOOL DEFAULT false│ true                          │
│ enable_autoscale │ BOOL DEFAULT false│ false                         │
│ enable_pitr      │ BOOL DEFAULT false│ false                         │
│ desired_storage  │ VARCHAR          │ 100Gi                          │
│ desired_ram      │ VARCHAR          │ 8Gi                            │
│ desired_cpu      │ VARCHAR          │ 4                              │
│ created_at       │ TIMESTAMP        │ 2026-05-30T10:05:00Z          │
│ updated_at       │ TIMESTAMP        │ 2026-05-30T10:05:00Z          │
│ project_id (UQ,  │ UUID             │ p7q8r9s0-t1u2-...             │
│   FK)            │                  │                                │
└─────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                           poolers                                    │
├──────────────────┬──────────────────┬───────────────────────────────┤
│ id (PK)          │ UUID             │ pl1m2n3o-p4q5-...             │
│ rw_host          │ VARCHAR          │ pooler-rw-svc.project-p7q8...│
│ rw_port          │ INT DEFAULT 5432 │ 5432                           │
│ ro_host          │ VARCHAR          │ pooler-ro-svc.project-p7q8...│
│ ro_port          │ INT DEFAULT 5432 │ 5432                           │
│ project_id (UQ,  │ UUID             │ p7q8r9s0-t1u2-...             │
│   FK)            │                  │                                │
└─────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                           api_keys                                   │
├──────────────────┬──────────────────┬───────────────────────────────┤
│ id (PK)          │ UUID             │ ak1f2g3h-i4j5-...             │
│ key_hash (UQ)    │ VARCHAR          │ sha256(a8f3b2c1d4e5...)       │
│ prefix           │ VARCHAR          │ sk_live_                       │
│ duration         │ INT              │ 90                             │
│ created_at       │ TIMESTAMP        │ 2026-05-30T10:05:00Z          │
│ revoked_at       │ TIMESTAMP NULL    │ NULL                           │
│ project_id (FK)  │ UUID             │ p7q8r9s0-t1u2-...             │
└─────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                           test_apps                                  │
├──────────────────┬──────────────────┬───────────────────────────────┤
│ id (PK)          │ AUTO INT         │ 1                              │
│ name             │ VARCHAR          │ smoke-test                     │
└─────────────────────────────────────────────────────────────────────┘
   (standalone, no FK)
```

## Enums

| Enum | Values |
|------|--------|
| `DeploymentOption` | `MULTI_AZ_CLUSTER`, `MULTI_AZ_INSTANCE`, `SINGLE_AZ_INSTANCE` |
| `ProjectStatus` | `provisioning`, `running`, `stopped`, `error`, `deleting` |

## Relationships

| Parent | Child | Cardinality | On Delete |
|--------|-------|-------------|-----------|
| `tenant` | `refresh_tokens` | 1:N | CASCADE |
| `tenant` | `projects` | 1:N | CASCADE |
| `projects` | `resource_configs` | 1:1 | CASCADE |
| `projects` | `poolers` | 1:1 | CASCADE |
| `projects` | `api_keys` | 1:N | CASCADE |

## Filled Example (from seed data)

### tenant

| id | email | username | country | job_title | company | password_hash | photo_url | created_at |
|----|-------|----------|---------|-----------|---------|---------------|-----------|------------|
| `a1b2c3d4-e5f6-...` | `alice@example.com` | `alice` | `FR` | `NULL` | `NULL` | `$2a$10$xYz...` | `NULL` | `2026-05-30T10:00:00Z` |
| `b2c3d4e5-f6g7-...` | `bob@example.com` | `bob` | `US` | `NULL` | `NULL` | `$2a$10$AbC...` | `NULL` | `2026-05-30T10:00:01Z` |
| `c3d4e5f6-g7h8-...` | `carol@example.com` | `carol` | `DE` | `NULL` | `NULL` | `$2a$10$DeF...` | `NULL` | `2026-05-30T10:00:02Z` |

### refresh_tokens

| id | token | expires_at | revoked_at | created_at | tenant_id |
|----|-------|------------|------------|------------|-----------|
| `r1t2u3v4-...` | `a8f3b2c1d4e5f6...` | `2026-06-06T10:00:00Z` | `NULL` | `2026-05-30T10:00:00Z` | `a1b2c3d4-e5f6-...` |

### projects

| id | name | k8s_namespace | pg_version | region | deployment_option | estimated_price | price | cpu_usage | ram_usage | storage_usage | status | tenant_id |
|----|------|---------------|------------|--------|-------------------|-----------------|-------|-----------|-----------|---------------|--------|-----------|
| `p7q8r9s0-...` | `Alice Production DB` | `project-p7q8r9s0-...` | `16` | `eu-west-1` | `MULTI_AZ_CLUSTER` | `120.5` | `0` | `0` | `0` | `0` | `running` | `a1b2c3d4-e5f6-...` |
| `q8r9s0t1-...` | `Bob Staging DB` | `project-q8r9s0t1-...` | `16` | `us-east-1` | `SINGLE_AZ_INSTANCE` | `45.0` | `0` | `0` | `0` | `0` | `running` | `b2c3d4e5-f6g7-...` |
| `r9s0t1u2-...` | `Carol Analytics DB` | `project-r9s0t1u2-...` | `16` | `eu-central-1` | `MULTI_AZ_INSTANCE` | `80.0` | `0` | `0` | `0` | `0` | `running` | `c3d4e5f6-g7h8-...` |

### resource_configs

| id | desired_replicas | enable_backup | enable_autoscale | enable_pitr | desired_storage | desired_ram | desired_cpu | project_id |
|----|-----------------|---------------|------------------|-------------|-----------------|-------------|-------------|------------|
| `rc1a2b3c-...` | `3` | `true` | `false` | `false` | `100Gi` | `8Gi` | `4` | `p7q8r9s0-...` |
| `sd2e3f4g-...` | `1` | `true` | `false` | `false` | `20Gi` | `2Gi` | `1` | `q8r9s0t1-...` |

### poolers

| id | rw_host | rw_port | ro_host | ro_port | project_id |
|----|---------|---------|---------|---------|------------|
| `pl1m2n3o-...` | `pooler-rw-svc.project-p7q8r9s0-....svc.cluster.local` | `5432` | `pooler-ro-svc.project-p7q8r9s0-....svc.cluster.local` | `5432` | `p7q8r9s0-...` |
| `qm2n3o4p-...` | `pooler-rw-svc.project-q8r9s0t1-....svc.cluster.local` | `5432` | `pooler-ro-svc.project-q8r9s0t1-....svc.cluster.local` | `5432` | `q8r9s0t1-...` |

### api_keys

| id | key_hash | prefix | duration | created_at | revoked_at | project_id |
|----|----------|--------|----------|------------|------------|------------|
| `ak1f2g3h-...` | `sha256(a8f3b2c1...)` | `sk_live_` | `90` | `2026-05-30T10:05:00Z` | `NULL` | `p7q8r9s0-...` |

### test_apps

| id | name |
|----|------|
| `1` | `smoke-test` |