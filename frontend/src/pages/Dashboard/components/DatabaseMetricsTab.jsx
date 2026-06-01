import { useEffect, useRef, useState } from 'react';

function formatCpu(millis) {
  if (millis === null || millis === undefined) return 'N/A';
  if (millis >= 1000) return `${(millis / 1000).toFixed(2)} cores`;
  return `${Math.round(millis)}m`;
}

function formatMemory(bytes) {
  if (bytes === null || bytes === undefined) return 'N/A';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MiB`;
  if (bytes >= 1024)      return `${(bytes / 1024).toFixed(0)} KiB`;
  return `${bytes} B`;
}

const MAX_SAMPLES = 30; // ~3.5 min of history at a 7s poll interval

// Lightweight inline-SVG line chart — no chart library, draws a single
// smoothed-ish polyline scaled to the min/max of the samples it's given.
function Sparkline({ values, color, height = 40 }) {
  const width = 220;
  if (!values || values.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 'var(--text-label-sm-size)', color: 'var(--on-surface-variant)' }}>
          collecting…
        </span>
      </div>
    );
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const pad = 4;
  const usableH = height - pad * 2;

  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = pad + usableH - ((v - min) / span) * usableH;
    return [x, y];
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const gradId = `spark-${color.replace(/[^a-z]/gi, '')}`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const podCard = {
  background: 'var(--surface-container-lowest)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-float)',
  padding: 'var(--space-5)',
};

export default function DatabaseMetricsTab({ metrics, error }) {
  // Keep a rolling client-side history per pod so we can draw curves. The
  // metrics endpoint only returns the latest sample, so we accumulate here.
  const [history, setHistory] = useState({});
  const lastTs = useRef(null);

  useEffect(() => {
    if (!metrics || metrics.timestamp === lastTs.current) return;
    lastTs.current = metrics.timestamp;
    const pods = (metrics.pods ?? []).filter((p) => p.role === 'primary' || p.role === 'replica');

    setHistory((prev) => {
      const next = {};
      for (const pod of pods) {
        const prevSamples = prev[pod.name] ?? [];
        next[pod.name] = [
          ...prevSamples,
          { cpu: pod.cpuMillis ?? 0, mem: pod.memoryBytes ?? 0 },
        ].slice(-MAX_SAMPLES);
      }
      return next;
    });
  }, [metrics]);

  if (error) {
    return (
      <p className="body-sm" style={{ color: 'var(--error)' }}>
        Failed to load metrics: {error}
      </p>
    );
  }

  if (!metrics) {
    return <p className="body-sm" style={{ color: 'var(--on-surface-variant)' }}>Loading metrics…</p>;
  }

  const isHealthy = metrics.phase === 'Cluster in healthy state';
  // Only show real Postgres instances — hide poolers (pgbouncer) and any pod
  // whose role we couldn't determine.
  const instancePods = (metrics.pods ?? []).filter((p) => p.role === 'primary' || p.role === 'replica');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* Status + replica summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-4)' }}>
        <article style={podCard}>
          <p className="label-md">Cluster status</p>
          <p className="display-sm" style={{ marginTop: 'var(--space-2)', color: isHealthy ? 'var(--success)' : 'var(--on-surface)' }}>
            {isHealthy ? 'Healthy' : metrics.phase}
          </p>
        </article>

        <article style={podCard}>
          <p className="label-md">Replicas</p>
          <p className="display-sm" style={{ marginTop: 'var(--space-2)', color: 'var(--on-surface)' }}>
            {metrics.readyInstances} / {metrics.instances} ready
          </p>
        </article>
      </div>

      {/* Per-pod CPU & memory with live curves */}
      {instancePods.length > 0 && (
        <div>
          <p className="label-md" style={{ marginBottom: 'var(--space-3)' }}>Instance resources</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-4)' }}>
            {instancePods.map((pod, i) => {
              const samples = history[pod.name] ?? [];
              return (
                <article key={pod.name} style={podCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                    <p className="label-md">Instance {i + 1}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span style={{
                        fontSize: 'var(--text-label-sm-size)',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        background: pod.role === 'primary' ? 'var(--primary-container)' : 'var(--surface-container)',
                        color: pod.role === 'primary' ? 'var(--on-primary-container)' : 'var(--on-surface-variant)',
                      }}>
                        {pod.role === 'primary' ? 'Primary' : 'Replica'}
                      </span>
                      <span style={{ fontSize: 'var(--text-label-sm-size)', color: pod.ready ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
                        {pod.ready ? '● Ready' : '○ Not ready'}
                      </span>
                    </div>
                  </div>

                  {/* CPU */}
                  <div style={{ marginBottom: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <p style={{ fontSize: 'var(--text-label-sm-size)', color: 'var(--on-surface-variant)' }}>CPU</p>
                      <p style={{ fontSize: 'var(--text-title-md-size)', fontWeight: 700, color: 'var(--on-surface)' }}>{formatCpu(pod.cpuMillis)}</p>
                    </div>
                    <Sparkline values={samples.map((s) => s.cpu)} color="var(--primary)" />
                  </div>

                  {/* Memory */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <p style={{ fontSize: 'var(--text-label-sm-size)', color: 'var(--on-surface-variant)' }}>Memory</p>
                      <p style={{ fontSize: 'var(--text-title-md-size)', fontWeight: 700, color: 'var(--on-surface)' }}>{formatMemory(pod.memoryBytes)}</p>
                    </div>
                    <Sparkline values={samples.map((s) => s.mem)} color="var(--success)" />
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* Storage */}
      <article style={podCard}>
        <p className="label-md">Storage</p>
        <p className="display-sm" style={{ marginTop: 'var(--space-2)', color: 'var(--on-surface)' }}>
          {metrics.usedStorageGb !== null && metrics.usedStorageGb !== undefined
            ? `${metrics.usedStorageGb.toFixed(1)} GiB used`
            : 'Usage N/A'}{' '}
          / {(metrics.provisionedStorageGb ?? 0).toFixed(0)} GiB provisioned
        </p>
        {(metrics.usedStorageGb === null || metrics.usedStorageGb === undefined) && (
          <p style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-label-sm-size)', color: 'var(--on-surface-variant)' }}>
            Kubelet stats unavailable — used storage cannot be determined
          </p>
        )}
      </article>

      {/* Coming soon */}
      <div style={{ borderRadius: 'var(--radius-md)', background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)', padding: 'var(--space-3) var(--space-4)', color: 'var(--on-surface-variant)' }}>
        <p className="body-sm">
          <strong>Connections &amp; QPS</strong> — coming soon (requires the CNPG Prometheus exporter)
        </p>
      </div>

      {/* Last updated */}
      <div style={{ borderRadius: 'var(--radius-md)', background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)', padding: 'var(--space-3) var(--space-4)', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--on-surface-variant)' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: 'var(--radius-full)', background: 'var(--success)', animation: 'pulse-green 1.2s ease-in-out infinite' }} />
        <span className="body-sm">
          Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
