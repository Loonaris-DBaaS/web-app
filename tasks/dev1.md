# Agent Prompt — dev1: Honest create-database flow + enforced pod resource limits

You are a full-stack engineering agent in `Loonaris-DBaaS/web-app` (Express+Prisma backend,
React/Vite frontend, Postgres DBaaS on EKS + CloudNativePG). Do the items in order, then open a PR.
Independent of dev2 (monitoring); coordinate only on the Replicas tab (see item 5).

## Operating rules
- Branch `dev1-honest-create-flow` off `main`; commit, push, open a PR. Never push to `main`.
- Match existing controller/service/dto and component/style patterns; no new deps without flagging.
- No infra/deploy actions (no AWS/ECS; read-only kubectl only, change no cluster state).
- Never hand-write SQL: schema changes go through `prisma/schema.prisma` + `npx prisma generate` +
  a generated migration (CI runs `prisma migrate deploy`).
- Done = `cd backend && npm ci && npx tsc --noEmit` AND `cd frontend && npm ci && npm run build`
  both pass; PR describes each item + how verified; call out anything unfinished.

## Why
The UI advertises CPU/RAM specs, multiple regions, and a connection preview the backend doesn't
deliver. The CNPG pods currently have NO resource limits. Make the product honest and bound pod
resource usage.

## Work items (priority order)
1. Enforce ONE fixed resource limit for every CNPG pod (cluster has limited capacity; same for all
   plans/tenants). In `backend/src/modules/pgCluster/provisioning/provisioning.ts`, add to
   `cnpgManifest.spec`:
   `resources: {  limits: { cpu: '500m', memory: '1Gi' } }` no requests because we have limited ressources 
   (tune if needed, but it MUST fit the c5.xlarge tenant nodes — 4 vCPU/8GB — with up to 3 instances
   + 2 poolers per cluster across multiple tenants). Apply the SAME values regardless of `size`.
   Verify pods still schedule (read-only `kubectl describe pod` shows the limits).
2. Remove the marketing CPU/RAM values end-to-end:
   - Backend: drop `cpu`/`ram` from `dto/cluster.dto.ts` (`ClusterDto`) and stop setting/reading
     `desiredCpu`/`desiredRam` in `services/pgCluster.service.ts` (create + update + `toDto` +
     `inferClusterSize`) and `SIZE_SPECS` (`dto/create-cluster.dto.ts`). Keep `storage` and `price`
     (storage IS real — provisioned as the PVC size). Removing the `desiredCpu/desiredRam` columns
     from `ResourceConfig` is optional; if you do, use a Prisma migration (never hand-write SQL).
   - Frontend: remove cpu/ram spec labels from `components/ui/CreateDatabaseForm.jsx` and the
     `SIZES` cpu/ram fields in `constants/database.js`; remove the fake
     `${region}.db.ourplatform.com` connection preview (real strings already show in the post-create
     modal). Plan cards keep name + price + storage. Also clean cpu/ram out of
     `pages/Dashboard/components/DatabaseSettingsTab.jsx`.
3. Single region. Frontend: replace the multi-option region selector with the one supported region
   `eu-west-3` (display-only / read-only). Backend: validate `region` in `create` (and admin create)
   to the supported set `['eu-west-3']` — reject others with 400 (or coerce + document).
4. Remove other create-flow fakes: hidden auto-`enableAutoscale` (set from `size==='scale'`) — drop
   it or expose it honestly; ensure the deployment-option/read-replicas → `instances` mapping stays.
5. Fix the broken Replicas tab so it never crashes: `pages/Dashboard/DatabaseDetailPage.jsx` calls
   `db.instances.map()` on a number. Render based on the instance COUNT (simple cards/placeholder),
   or hide the tab. Do NOT fabricate per-instance metrics — dev2 wires real per-instance data later.
6. Docs: in `web-app/docs/GAPS.md`, update the create-flow/region/specs entries to reflect that
   specs are removed and one resource limit is enforced; note region is single (`eu-west-3`).

## Verify
- Backend `tsc --noEmit` + frontend `npm run build` pass.
- Create a DB → (read-only kubectl) the `instance-db` pods show the resources limits and are
  Running; the UI shows one region, no cpu/ram marketing, no fake connection preview; Replicas tab
  doesn't crash.
