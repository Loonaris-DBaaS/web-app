# Agent Prompt — dev2: Real CNPG cluster monitoring via polling

You are a full-stack engineering agent in `Loonaris-DBaaS/web-app` (Express+Prisma backend,
React/Vite frontend, Postgres DBaaS on EKS + CloudNativePG). Do the items in order, then open a PR.
Independent of dev1; coordinate only on the Replicas tab (dev1 makes it non-crashing; you fill real
per-instance data).

## Operating rules
- Branch `dev2-cnpg-monitoring` off `main`; commit, push, open a PR. Never push to `main`.
- Match existing patterns; reuse the k8s client path, don't reinvent it. No new deps without flagging.
- No infra/deploy actions (read-only kubectl only, change no cluster state).
- Never hand-write SQL: schema changes via `prisma` + generated migration (CI runs migrate deploy).
- Done = backend `tsc --noEmit` AND frontend `npm run build` pass; PR describes each item + how
  verified; call out anything unfinished. Use REAL data only — no hardcoded/mock values.

## Why
`frontend/.../components/DatabaseMetricsTab.jsx` shows 100% fake metrics and there is no metrics API.
metrics-server is installed and the backend already polls the CNPG CR — build a real metrics endpoint
and have the UI poll it.

## Work items (priority order)
1. Backend metrics endpoint `GET /api/clusters/:id/metrics` (tenant-scoped, `authenticate`), wired in
   `backend/src/modules/pgCluster/routes.ts` + controller + a new service function. Reuse
   `getK8sClient()` from `provisioning/provisioning.ts` (extend it to also expose a metrics client).
   Return REAL data:
   - Status + replica health: from the CNPG `Cluster` CR `status` (phase, instances, readyInstances,
     and per-instance role primary/replica + healthy) — same `customApi.getNamespacedCustomObject`
     pattern as `getClusterStatus()`.
   - Pod CPU/memory: list pods labeled `cnpg.io/cluster=instance-db` in the namespace, then read
     per-pod usage via the metrics-server (`@kubernetes/client-node` `Metrics.getPodMetrics(namespace)`
     or `metrics.k8s.io` PodMetrics). Return per-instance cpu/mem.
   - Storage usage: provisioned (PVC capacity) is real now; for used bytes use the kubelet Summary API
     volume stats keyed by PVC name (best-effort — if unavailable, return used=null and say so). Also
     persist the rolled-up used into `Project.storageUsage` so the dashboard card stops being 0.
2. Frontend service: add `clusterService.getMetrics(id)` in `frontend/src/services/api.js`.
3. Replace fake metrics: rewrite `pages/Dashboard/components/DatabaseMetricsTab.jsx` to fetch from the
   endpoint and POLL every 5–10s while mounted (cleanup on unmount). Show only real metrics: status,
   ready/total replicas, per-pod CPU & memory, storage used/total. Remove the fake
   connections/QPS cards (or clearly mark "coming soon" — they need the CNPG Prometheus exporter,
   out of scope).
4. Replicas tab real data: in `DatabaseDetailPage.jsx`, populate per-instance cards (role, ready, node,
   cpu/mem) from the metrics endpoint. (dev1 makes the tab non-crashing first; you replace placeholders
   with real values — additive, coordinate via PR.)
5. Dashboard storage card: drive `pages/Dashboard/components/StorageUtilizationCard` from real
   per-cluster storage (sum used/provisioned across the tenant's clusters) and remove the hardcoded
   `TOTAL_STORAGE_GB = 1200` in `pages/Dashboard/Database.jsx`.
6. Docs: in `web-app/docs/GAPS.md`, update Section 8 (monitoring) — note real status/replica/pod-metric/
   storage polling now exists; what remains (connections/QPS via exporter, alerting, tracing).

## Verify
- Backend `tsc --noEmit` + frontend `npm run build` pass.
- Open a running DB's Metrics tab → values are real and refresh on the poll interval; cross-check with
  read-only `kubectl get cluster -n <ns> -o yaml` and `kubectl top pods -n <ns>`. Storage card and
  Replicas tab show real numbers (not 1200 / not crashing).
