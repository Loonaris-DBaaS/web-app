import { useEffect, useRef, useState } from 'react';
import { CpuMemoryChart } from '../../../components/ui/MetricsCharts';

function formatCpu(millis) {
  if (millis === null || millis === undefined) return 'N/A';
  if (millis >= 1000) return `${(millis / 1000).toFixed(2)} cores`;
  return `${Math.round(millis)}m`;
}

function formatMemory(bytes) {
  if (bytes === null || bytes === undefined) return 'N/A';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KiB`;
  return `${bytes} B`;
}

const MAX_SAMPLES = 30;

const podCard = {
  background: 'var(--surface-container-lowest)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-float)',
  padding: 'var(--space-5)',
};

export default function DatabaseMetricsTab({ metrics, error }) {
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
    return (
      <p className="body-sm" style={{ color: 'var(--on-surface-variant)' }}>
        Loading metrics...
      </p>
    );
  }

  const isHealthy = metrics.phase === 'Cluster in healthy state';
  const instancePods = (metrics.pods ?? []).filter(
    (p) => p.role === 'primary' || p.role === 'replica',
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Status + replica summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <article style={podCard}>
          <p className="label-md">Cluster status</p>
          <p
            className="display-sm"
            style={{
              marginTop: 'var(--space-2)',
              color: isHealthy ? 'var(--success)' : 'var(--on-surface)',
            }}
          >
            {isHealthy ? 'Healthy' : metrics.phase}
          </p>
        </article>

        <article style={podCard}>
          <p className="label-md">Replicas</p>
          <p
            className="display-sm"
            style={{ marginTop: 'var(--space-2)', color: 'var(--on-surface)' }}
          >
            {metrics.readyInstances} / {metrics.instances} ready
          </p>
        </article>
      </div>

      {/* Per-pod CPU & memory with Recharts */}
      {instancePods.length > 0 && (
        <div>
          <p className="label-md" style={{ marginBottom: 'var(--space-3)' }}>
            Instance resources
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 'var(--space-4)',
            }}
          >
            {instancePods.map((pod, i) => (
              <article key={pod.name} style={podCard}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--space-4)',
                  }}
                >
                  <p className="label-md">Instance {i + 1}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span
                      style={{
                        fontSize: 'var(--text-label-sm-size)',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        background:
                          pod.role === 'primary'
                            ? 'var(--primary-container)'
                            : 'var(--surface-container)',
                        color:
                          pod.role === 'primary'
                            ? 'var(--on-primary-container)'
                            : 'var(--on-surface-variant)',
                      }}
                    >
                      {pod.role === 'primary' ? 'Primary' : 'Replica'}
                    </span>
                    <span
                      style={{
                        fontSize: 'var(--text-label-sm-size)',
                        color: pod.ready ? 'var(--success)' : 'var(--error)',
                        fontWeight: 600,
                      }}
                    >
                      {pod.ready ? '● Ready' : '○ Not ready'}
                    </span>
                  </div>
                </div>

                {/* CPU & Memory quick stats */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 'var(--space-3)',
                    marginBottom: 'var(--space-3)',
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontSize: 'var(--text-label-sm-size)',
                        color: 'var(--on-surface-variant)',
                        margin: 0,
                      }}
                    >
                      CPU
                    </p>
                    <p
                      style={{
                        fontSize: 'var(--text-title-md-size)',
                        fontWeight: 700,
                        color: 'var(--on-surface)',
                        margin: 0,
                      }}
                    >
                      {formatCpu(pod.cpuMillis)}
                    </p>
                  </div>
                  <div>
                    <p
                      style={{
                        fontSize: 'var(--text-label-sm-size)',
                        color: 'var(--on-surface-variant)',
                        margin: 0,
                      }}
                    >
                      Memory
                    </p>
                    <p
                      style={{
                        fontSize: 'var(--text-title-md-size)',
                        fontWeight: 700,
                        color: 'var(--on-surface)',
                        margin: 0,
                      }}
                    >
                      {formatMemory(pod.memoryBytes)}
                    </p>
                  </div>
                </div>

                {/* Recharts chart */}
                <CpuMemoryChart history={history} podName={pod.name} />
              </article>
            ))}
          </div>
        </div>
      )}

      {/* Storage */}
      <article style={podCard}>
        <p className="label-md">Storage</p>
        <p
          className="display-sm"
          style={{ marginTop: 'var(--space-2)', color: 'var(--on-surface)' }}
        >
          {metrics.usedStorageGb !== null && metrics.usedStorageGb !== undefined
            ? `${metrics.usedStorageGb.toFixed(1)} GiB used`
            : 'Usage N/A'}{' '}
          /{' '}
          {metrics.planStorageGb != null
            ? `${metrics.planStorageGb.toFixed(0)} GiB`
            : `${(metrics.provisionedStorageGb ?? 0).toFixed(0)} GiB`}{' '}
          provisioned
        </p>
        {(metrics.usedStorageGb === null || metrics.usedStorageGb === undefined) && (
          <p
            style={{
              marginTop: 'var(--space-1)',
              fontSize: 'var(--text-label-sm-size)',
              color: 'var(--on-surface-variant)',
            }}
          >
            Kubelet stats unavailable — used storage cannot be determined
          </p>
        )}
      </article>

      {/* Coming soon */}
      <div
        style={{
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface-container-low)',
          border: '1px solid var(--outline-variant)',
          padding: 'var(--space-3) var(--space-4)',
          color: 'var(--on-surface-variant)',
        }}
      >
        <p className="body-sm">
          <strong>Connections &amp; QPS</strong> — coming soon (requires the CNPG Prometheus
          exporter)
        </p>
      </div>

      {/* Last updated */}
      <div
        style={{
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface-container-low)',
          border: '1px solid var(--outline-variant)',
          padding: 'var(--space-3) var(--space-4)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          color: 'var(--on-surface-variant)',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--success)',
            animation: 'pulse-green 1.2s ease-in-out infinite',
          }}
        />
        <span className="body-sm">
          Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
