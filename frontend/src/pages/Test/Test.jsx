import { useEffect, useRef, useState } from 'react';
import { loadTestService } from '../../services/api';
import DatabaseMetricsTab from '../../pages/Dashboard/components/DatabaseMetricsTab';

// Public, no-auth load-testing dashboard. Paste a Loonaris connection string,
// hit "Start load", and watch the live CPU / memory curves climb. The browser
// never talks to Postgres directly — the backend resolves the sk_live_ key in
// the string to the cluster, drives the write/CPU load, and reads metrics.

const PLACEHOLDER =
  'postgresql://sk_live_xxxx…_rw@<gateway-host>:5432/app?sslmode=disable';

const wrap = { maxWidth: 960, margin: '0 auto', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' };
const card = { background: 'var(--surface-container-lowest)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-float)', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' };
const input = { width: '100%', boxSizing: 'border-box', background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--text-body-sm-size)', color: 'var(--on-surface)' };
const numInput = { ...input, fontFamily: 'var(--font-sans)', width: 120 };
const btn = (bg, fg) => ({ padding: '10px 20px', background: bg, color: fg, border: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-label-md-size)', fontWeight: 600 });

export default function Test() {
  const [connectionString, setConnectionString] = useState('');
  const [concurrency, setConcurrency] = useState(8);
  const [durationSec, setDurationSec] = useState(120);

  const [metrics, setMetrics] = useState(null);
  const [metricsError, setMetricsError] = useState('');
  const [polling, setPolling] = useState(false);

  const [run, setRun] = useState(null); // { runId }
  const [loadStatus, setLoadStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pollRef = useRef(null);
  const statusRef = useRef(null);

  // Poll live metrics every 5s once we have a connection string and polling is on.
  useEffect(() => {
    if (!polling || !connectionString) return;
    let cancelled = false;
    async function tick() {
      try {
        const data = await loadTestService.getMetrics(connectionString);
        if (!cancelled) { setMetrics(data); setMetricsError(''); }
      } catch (err) {
        if (!cancelled) setMetricsError(err.response?.data?.message ?? err.message);
      }
    }
    tick();
    pollRef.current = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(pollRef.current); };
  }, [polling, connectionString]);

  // Poll load run status while a run is active.
  useEffect(() => {
    if (!run?.runId) return;
    let cancelled = false;
    async function tick() {
      try {
        const s = await loadTestService.status(run.runId);
        if (!cancelled) {
          setLoadStatus(s);
          if (!s.running) { clearInterval(statusRef.current); }
        }
      } catch {
        if (!cancelled) clearInterval(statusRef.current);
      }
    }
    tick();
    statusRef.current = setInterval(tick, 2000);
    return () => { cancelled = true; clearInterval(statusRef.current); };
  }, [run?.runId]);

  function handleConnect() {
    setError('');
    setPolling(true);
  }

  async function handleStart() {
    setError('');
    setBusy(true);
    try {
      const res = await loadTestService.start(connectionString, {
        concurrency: Number(concurrency),
        durationSec: Number(durationSec),
      });
      setRun(res);
      setPolling(true);
    } catch (err) {
      setError(err.response?.data?.message ?? err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    if (!run?.runId) return;
    try { await loadTestService.stop(run.runId); } catch { /* ignore */ }
  }

  const running = loadStatus?.running;

  return (
    <div style={wrap}>
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--text-headline-sm-size, 28px)', color: 'var(--on-surface)' }}>
          Load Test Playground
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--on-surface-variant)', fontSize: 'var(--text-body-sm-size)' }}>
          Paste a Loonaris connection string, start the load, and watch CPU &amp; memory respond in real time.
        </p>
      </div>

      <div style={card}>
        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-label-sm-size)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--on-surface-variant)', marginBottom: 'var(--space-2)' }}>
            Connection string
          </label>
          <input
            style={input}
            placeholder={PLACEHOLDER}
            value={connectionString}
            onChange={(e) => setConnectionString(e.target.value.trim())}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'var(--space-4)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-label-sm-size)', color: 'var(--on-surface-variant)', marginBottom: 'var(--space-1)' }}>Concurrency</label>
            <input type="number" min="1" max="32" style={numInput} value={concurrency} onChange={(e) => setConcurrency(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-label-sm-size)', color: 'var(--on-surface-variant)', marginBottom: 'var(--space-1)' }}>Duration (s)</label>
            <input type="number" min="5" max="900" style={numInput} value={durationSec} onChange={(e) => setDurationSec(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', marginLeft: 'auto' }}>
            <button style={btn('var(--surface-container-low)', 'var(--on-surface)')} onClick={handleConnect} disabled={!connectionString}>
              Show metrics
            </button>
            {running ? (
              <button style={btn('var(--error)', 'var(--on-error, #fff)')} onClick={handleStop}>
                Stop load
              </button>
            ) : (
              <button style={btn('var(--primary)', 'var(--on-primary, #fff)')} onClick={handleStart} disabled={!connectionString || busy}>
                {busy ? 'Starting…' : 'Start load'}
              </button>
            )}
          </div>
        </div>

        {error && <p style={{ margin: 0, color: 'var(--error)', fontSize: 'var(--text-body-sm-size)' }}>{error}</p>}

        {loadStatus && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', fontSize: 'var(--text-body-sm-size)', color: 'var(--on-surface-variant)' }}>
            <span>Status: <strong style={{ color: running ? 'var(--success)' : 'var(--on-surface)' }}>{running ? 'running' : 'finished'}</strong></span>
            <span>Rows inserted: <strong>{loadStatus.inserted.toLocaleString()}</strong></span>
            <span>~{loadStatus.insertsPerSec.toLocaleString()} rows/s</span>
            <span>Elapsed: {loadStatus.elapsedSec}s</span>
            {loadStatus.errors > 0 && <span style={{ color: 'var(--error)' }}>Errors: {loadStatus.errors}</span>}
          </div>
        )}
      </div>

      {polling && (
        <div style={card}>
          <h2 style={{ margin: 0, fontSize: 'var(--text-title-lg-size)', color: 'var(--on-surface)' }}>Live metrics</h2>
          <DatabaseMetricsTab metrics={metrics} error={metricsError} />
        </div>
      )}
    </div>
  );
}
