import { Pool } from 'pg';
import prisma from '@/lib/prisma';
import { sha256Hex } from '@/lib/crypto';
import { getClusterLiveMetrics, ClusterLiveMetrics } from '../pgCluster/provisioning/provisioning';

// ── Connection-string handling ─────────────────────────────────────────────
// The public /test dashboard accepts a full connection string. The username is
// the API key (`sk_live_<64-hex>_rw|ro`). We never store the string; we only
// derive the base key to resolve which project (namespace) it belongs to, and
// hand the raw string to `pg` to drive load.

const KEY_RE = /sk_live_([a-f0-9]{64})_(?:rw|ro)/;

// Hosts the load runner is allowed to connect to. Defaults to the public
// gateway NLB so the endpoint can't be abused as an open SSRF proxy to
// arbitrary hosts. Override with LOAD_TEST_ALLOWED_HOSTS (comma-separated).
const ALLOWED_HOSTS = (
  process.env.LOAD_TEST_ALLOWED_HOSTS ??
  'ab571a35c49414eaab905fc43405b7fb-9f85c871b90b857f.elb.eu-west-3.amazonaws.com'
)
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

function parseConnectionString(connectionString: string): { baseKey: string; host: string } {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('Invalid connection string');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('Connection string must be a postgres:// URL');
  }
  const match = KEY_RE.exec(decodeURIComponent(url.username));
  if (!match) {
    throw new Error('Connection string does not contain a valid sk_live_ API key');
  }
  if (ALLOWED_HOSTS.length > 0 && !ALLOWED_HOSTS.includes(url.hostname)) {
    throw new Error('Host is not in the allowed list for load testing');
  }
  return { baseKey: match[1] as string, host: url.hostname };
}

async function resolveNamespace(baseKey: string): Promise<string> {
  const keyHash = sha256Hex(baseKey);
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { project: true },
  });
  if (!apiKey || apiKey.revokedAt) {
    throw new Error('API key not found or revoked');
  }
  return apiKey.project.k8sNamespace;
}

// ── Live metrics for the pasted string ─────────────────────────────────────
export async function metricsForConnectionString(
  connectionString: string,
): Promise<ClusterLiveMetrics | null> {
  const { baseKey } = parseConnectionString(connectionString);
  const namespace = await resolveNamespace(baseKey);
  return getClusterLiveMetrics(namespace);
}

// ── Load runner ────────────────────────────────────────────────────────────
// Each run owns a small pg Pool and fires a write-heavy + CPU/RAM-heavy query
// in a tight loop across `concurrency` workers until it is stopped or the
// duration elapses. State lives in-memory only (single-process dev/demo use).

interface LoadRun {
  id: string;
  pool: Pool;
  running: boolean;
  inserted: number;
  errors: number;
  startedAt: number;
  endsAt: number;
  lastError: string | null;
}

const runs = new Map<string, LoadRun>();

const LOAD_QUERY = `
  WITH ins AS (
    INSERT INTO load_test (k, payload)
    SELECT (random()*100000)::int, repeat(md5(random()::text), 8)
    FROM generate_series(1, 500)
    RETURNING 1
  )
  SELECT count(*) AS n FROM (
    SELECT (random()*1000000)::int AS x FROM generate_series(1, 30000)
  ) s, ins
  GROUP BY x % 1000
`;

async function ensureTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS load_test (
      id bigserial PRIMARY KEY,
      ts timestamptz DEFAULT now(),
      k int,
      payload text
    )
  `);
}

async function worker(run: LoadRun): Promise<void> {
  while (run.running && Date.now() < run.endsAt) {
    try {
      await run.pool.query(LOAD_QUERY);
      run.inserted += 500;
    } catch (err) {
      run.errors += 1;
      run.lastError = (err as Error).message;
      // Brief backoff so a persistent error doesn't spin the CPU locally.
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  run.running = false;
}

export async function startLoad(
  connectionString: string,
  opts: { concurrency?: number; durationSec?: number },
): Promise<{ runId: string }> {
  parseConnectionString(connectionString); // validate before doing anything

  const concurrency = Math.min(Math.max(opts.concurrency ?? 8, 1), 32);
  const durationSec = Math.min(Math.max(opts.durationSec ?? 120, 5), 900);

  const pool = new Pool({ connectionString, max: concurrency, ssl: false });
  await ensureTable(pool);

  const id = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const run: LoadRun = {
    id,
    pool,
    running: true,
    inserted: 0,
    errors: 0,
    startedAt: Date.now(),
    endsAt: Date.now() + durationSec * 1000,
    lastError: null,
  };
  runs.set(id, run);

  // Fire workers; clean the pool up when they all settle.
  Promise.all(Array.from({ length: concurrency }, () => worker(run)))
    .catch(() => {})
    .finally(() => {
      run.running = false;
      run.pool.end().catch(() => {});
      // Keep the final status around briefly, then drop it.
      setTimeout(() => runs.delete(id), 60_000);
    });

  return { runId: id };
}

export function loadStatus(runId: string) {
  const run = runs.get(runId);
  if (!run) return null;
  const elapsedSec = (Date.now() - run.startedAt) / 1000;
  return {
    runId: run.id,
    running: run.running,
    inserted: run.inserted,
    errors: run.errors,
    lastError: run.lastError,
    elapsedSec: Math.round(elapsedSec),
    insertsPerSec: elapsedSec > 0 ? Math.round(run.inserted / elapsedSec) : 0,
  };
}

export function stopLoad(runId: string): boolean {
  const run = runs.get(runId);
  if (!run) return false;
  run.running = false;
  return true;
}
