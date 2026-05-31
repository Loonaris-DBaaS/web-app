function formatCpu(millis) {
  if (millis === null || millis === undefined) return 'n/a';
  if (millis >= 1000) return `${(millis / 1000).toFixed(2)} cores`;
  return `${millis}m`;
}

function formatMemory(bytes) {
  if (bytes === null || bytes === undefined) return 'n/a';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MiB`;
  if (bytes >= 1024)      return `${(bytes / 1024).toFixed(0)} KiB`;
  return `${bytes} B`;
}

export default function DatabaseMetricsTab({ metrics, error }) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* Status + replica summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-4)' }}>
        <article style={{ background: 'var(--surface-container-lowest)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-float)', padding: 'var(--space-5)' }}>
          <p className="label-md">Cluster status</p>
          <p className="display-sm" style={{ marginTop: 'var(--space-2)', color: isHealthy ? 'var(--success)' : 'var(--on-surface)' }}>
            {isHealthy ? 'Healthy' : metrics.phase}
          </p>
        </article>

        <article style={{ background: 'var(--surface-container-lowest)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-float)', padding: 'var(--space-5)' }}>
          <p className="label-md">Replicas</p>
          <p className="display-sm" style={{ marginTop: 'var(--space-2)', color: 'var(--on-surface)' }}>
            {metrics.readyInstances} / {metrics.instances} ready
          </p>
        </article>
      </div>

      {/* Per-pod CPU & memory */}
      {metrics.pods.length > 0 && (
        <div>
          <p className="label-md" style={{ marginBottom: 'var(--space-3)' }}>Pod resources</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-4)' }}>
            {metrics.pods.map((pod) => (
              <article key={pod.name} style={{ background: 'var(--surface-container-lowest)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-float)', padding: 'var(--space-5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <p className="label-md" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{pod.name}</p>
                  <span style={{
                    fontSize: 'var(--text-label-sm-size)',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: pod.role === 'primary' ? 'var(--primary-container)' : 'var(--surface-container)',
                    color: pod.role === 'primary' ? 'var(--on-primary-container)' : 'var(--on-surface-variant)',
                  }}>
                    {pod.role}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
                  <div>
                    <p style={{ fontSize: 'var(--text-label-sm-size)', color: 'var(--on-surface-variant)' }}>CPU</p>
                    <p style={{ fontSize: 'var(--text-title-md-size)', fontWeight: 700, color: 'var(--on-surface)' }}>{formatCpu(pod.cpuMillis)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 'var(--text-label-sm-size)', color: 'var(--on-surface-variant)' }}>Memory</p>
                    <p style={{ fontSize: 'var(--text-title-md-size)', fontWeight: 700, color: 'var(--on-surface)' }}>{formatMemory(pod.memoryBytes)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 'var(--text-label-sm-size)', color: 'var(--on-surface-variant)' }}>Node</p>
                    <p style={{ fontSize: 'var(--text-label-md-size)', color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{pod.node}</p>
                  </div>
                </div>
                <div style={{ marginTop: 'var(--space-2)' }}>
                  <span style={{
                    fontSize: 'var(--text-label-sm-size)',
                    color: pod.ready ? 'var(--success)' : 'var(--error)',
                    fontWeight: 600,
                  }}>
                    {pod.ready ? '● Ready' : '○ Not ready'}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* Storage */}
      <article style={{ background: 'var(--surface-container-lowest)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-float)', padding: 'var(--space-5)' }}>
        <p className="label-md">Storage</p>
        <p className="display-sm" style={{ marginTop: 'var(--space-2)', color: 'var(--on-surface)' }}>
          {metrics.usedStorageGb !== null
            ? `${metrics.usedStorageGb.toFixed(1)} GiB used`
            : 'usage n/a'}{' '}
          / {metrics.provisionedStorageGb.toFixed(0)} GiB provisioned
        </p>
        {metrics.usedStorageGb === null && (
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
