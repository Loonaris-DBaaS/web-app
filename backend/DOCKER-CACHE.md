# Docker Build Caching in CI/CD — How It Works

> This document explains the Docker layer caching mechanism used in the Loonaris backend CI/CD pipeline.

---

## 1. What Is Docker Layer Caching?

A Docker image is built in **layers**. Each instruction in a `Dockerfile` (`FROM`, `RUN`, `COPY`, etc.) creates a new layer. If nothing changed since the last build, Docker can reuse the existing layer instead of rebuilding it from scratch.

**Example:**

```dockerfile
FROM node:22-alpine          # Layer 1: base image (never changes)
WORKDIR /app                 # Layer 2: directory (never changes)
COPY package*.json ./        # Layer 3: deps manifest
RUN npm ci                   # Layer 4: install dependencies (SLOW)
COPY src ./src               # Layer 5: source code
RUN npm run build            # Layer 6: compile (SLOW)
```

If you only change `src/index.ts`:
- Layers 1–3 are **cached** (identical to last build)
- Layer 4 (`npm ci`) is **cached** (`package*.json` didn't change)
- Layers 5–6 are **rebuilt** (source code changed)

Without caching, every CI run would reinstall `node_modules` and recompile from scratch.

---

## 2. How the Cache Works in GitHub Actions

Our workflow uses `docker/build-push-action@v6` with:

```yaml
- name: Build, tag, and push image to ECR
  uses: docker/build-push-action@v6
  with:
    context: ./backend
    push: true
    tags: ...
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

### 2.1 What `type=gha` Means

`gha` = **GitHub Actions cache**. It's a cache backend built into Docker Buildx that stores layer cache data in GitHub Actions' own cache infrastructure (the same system that powers `actions/cache`).

When the workflow runs:

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Actions Runner                   │
│                                                             │
│  ┌─────────────────┐      ┌─────────────────────────────┐  │
│  │ Docker Buildx   │◄────►│ GitHub Actions Cache (gha)  │  │
│  │                 │      │                             │  │
│  │ cache-from: gha │      │  - Cached layers from last   │  │
│  │ cache-to: gha   │      │    build (up to 10GB/repo)  │  │
│  └─────────────────┘      └─────────────────────────────┘  │
│                                                             │
│  Build steps:                                               │
│  1. "Can I find layer X in GHA cache?" ──► Yes? Use it.   │
│  2. "Can I find layer Y in GHA cache?" ──► No? Build it.   │
│  3. "Save newly built layers to GHA cache."                │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 `mode=max` vs `mode=min`

| Mode | What gets cached | Use case |
|---|---|---|
| `mode=min` (default) | Only layers from the final image | Smaller cache, faster export |
| `mode=max` | All layers including intermediate build stages | Maximum cache reuse, larger export |

We use `mode=max` because our `Dockerfile` has a **multi-stage build**:

```dockerfile
# ---- Build stage ----
FROM node:22-alpine AS builder
...
RUN npm ci        # <- We want this cached!
RUN npm run build

# ---- Runtime stage ----
FROM node:22-alpine AS runner
COPY --from=builder /app/dist ./dist
```

With `mode=min`, only the **runtime stage** layers would be cached. The `builder` stage (where `npm ci` and `npm run build` happen) would be rebuilt every time. `mode=max` caches **both stages**, so even the intermediate `builder` layers are reused.

---

## 3. What Gets Cached vs What Gets Rebuilt

In our `Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder       # Layer 1: base image
WORKDIR /app                          # Layer 2: directory
COPY package.json package-lock.json ./ # Layer 3: dependency manifests
RUN npm ci                            # Layer 4: install deps (~1-2 min)
COPY prisma.config.ts tsconfig.json ./ # Layer 5: build config
COPY prisma ./prisma                  # Layer 6: schema
COPY src ./src                        # Layer 7: source code
RUN npx prisma generate               # Layer 8: generate client (~10s)
RUN npm run build                     # Layer 9: compile TS (~5-10s)
RUN npm prune --omit=dev              # Layer 10: strip dev deps

FROM node:22-alpine AS runner        # Layer 11: runtime base
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules  # Layer 12
COPY --from=builder /app/dist ./dist                  # Layer 13
COPY --from=builder /app/package.json ./package.json  # Layer 14
```

### Cache invalidation rules

| If you change... | Layers rebuilt | Layers cached |
|---|---|---|
| `src/**/*.ts` (source code) | 7, 8, 9, 10, 12, 13 | 1–6, 11, 14 |
| `package.json` or `package-lock.json` | 4–14 | 1–3 |
| `prisma/schema.prisma` | 6, 7, 8, 9, 10, 12, 13 | 1–5, 11, 14 |
| `Dockerfile` or build args | ALL | None |
| Nothing (re-run same commit) | None | All |

**Typical scenario:** You edit `src/index.ts`.
- Cached: `FROM`, `WORKDIR`, `COPY package*.json`, `RUN npm ci` (saves ~1–2 min)
- Rebuilt: `COPY src`, `RUN npx prisma generate`, `RUN npm run build`, runtime `COPY` (~30–60 sec)

---

## 4. Cache Storage Limits

- **Per-repository limit:** 10 GB
- **Cache eviction:** Least Recently Used (LRU) — old caches get deleted when the repo exceeds 10 GB
- **Cache key:** Automatically managed by Buildx based on layer content hashes

> ⚠️ If you see `cache-to: type=gha` failing with "cache limit reached", the cache is full. Older caches will be evicted automatically on the next successful build.

---

## 5. Why Not Use ECR or S3 for Cache?

| Backend | Pros | Cons |
|---|---|---|
| `type=gha` (GitHub Actions) | Zero config, free, fast (same datacenter) | 10 GB limit per repo |
| `type=s3` | Unlimited size, cross-workflow | Requires S3 bucket + IAM permissions |
| `type=registry` (ECR) | No extra infra, images + cache together | Slower (network round-trip to ECR), costs storage |

For our use case, `gha` is the best balance: no extra AWS resources needed, fast because the runner and cache are in the same GitHub infrastructure, and 10 GB is plenty for a Node.js backend.

---

## 6. How to Verify Cache Is Working

In the GitHub Actions logs, look for these lines in the **"Build, tag, and push image to ECR"** step:

```
#10 importing cache manifest from gha:13739712230323873388
#10 DONE 0.1s

#11 [builder  2/10] WORKDIR /app
#11 CACHED

#12 [builder  3/10] COPY package.json package-lock.json ./
#12 CACHED

#13 [builder  4/10] RUN npm ci
#13 CACHED
```

If you see `CACHED`, the layer was pulled from cache. If you see a duration like `#13 45.2s`, it was rebuilt.

**Also check the build time:**
- First run on a new branch: ~2–3 minutes
- Second run with no dependency changes: ~30–60 seconds

---

## 7. When to Clear the Cache

The cache auto-invalidates when layer inputs change, but sometimes you need to force a clean rebuild:

1. **Corrupted cache** — a layer is cached but broken
2. **Base image update** — you want to pull the latest `node:22-alpine` security patches
3. **Debugging build issues** — suspect stale cache

**Option A:** Add `no-cache: true` temporarily in the workflow (don't commit):
```yaml
with:
  no-cache: true
```

**Option B:** Trigger a manual workflow run with cache disabled via `workflow_dispatch` input (would require adding an input to the workflow).

**Option C:** Wait for cache eviction (10 GB limit) or bump the `Dockerfile` base image tag to force all layers to rebuild.

---

## 8. Related Files

| File | Purpose |
|---|---|
| `.github/workflows/backend-deploy.yml` | CI/CD workflow with caching config |
| `backend/Dockerfile` | Multi-stage build that benefits from caching |
| `backend/CI-CD-PLAN.md` | Overall pipeline design |

---

## 9. Further Reading

- Docker docs: [Cache management](https://docs.docker.com/build/cache/)
- Docker Buildx: [GitHub Actions cache](https://docs.docker.com/build/cache/backends/gha/)
- `docker/build-push-action`: [Inputs reference](https://github.com/docker/build-push-action?tab=readme-ov-file#inputs)
