export default function DatabaseMetricsTab() {
  const metrics = [
    {
      id: 'connections',
      label: 'Active Connections',
      value: '42 / 100 max',
      trend: '5% vs last hour',
      direction: 'up',
      points: '0,22 12,16 24,18 36,14 48,15 60,10 72,12 84,8 100,10',
    },
    {
      id: 'qps',
      label: 'Queries / sec',
      value: '284',
      trend: '3% vs last hour',
      direction: 'up',
      points: '0,20 14,21 28,17 42,18 56,15 70,13 84,14 100,11',
    },
    {
      id: 'cpu',
      label: 'CPU Usage',
      value: '34%',
      trend: '2% vs last hour',
      direction: 'down',
      points: '0,10 16,12 32,14 48,11 64,16 80,15 100,18',
    },
    {
      id: 'storage',
      label: 'Storage Used',
      value: '6.2 GB / 10 GB',
      trend: '8% vs last day',
      direction: 'up',
      points: '0,24 16,23 32,22 48,19 64,18 80,17 100,15',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {metrics.map((metric) => (
          <article
            key={metric.id}
            style={{
              background: 'var(--surface-container-lowest)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-float)',
              padding: 'var(--space-5)',
            }}
          >
            <p className="label-md">{metric.label}</p>
            <p className="display-sm" style={{ marginTop: 'var(--space-2)', color: 'var(--on-surface)' }}>
              {metric.value}
            </p>
            <svg
              viewBox="0 0 100 30"
              style={{
                width: '100%',
                height: '40px',
                marginTop: 'var(--space-3)',
              }}
              aria-hidden="true"
            >
              <polyline
                points={metric.points}
                style={{
                  fill: 'none',
                  stroke: 'var(--primary-container)',
                  strokeWidth: 2,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                }}
              />
            </svg>
            <p
              style={{
                marginTop: 'var(--space-2)',
                fontSize: 'var(--text-label-md-size)',
                lineHeight: 'var(--text-label-md-height)',
                fontWeight: 600,
                color: metric.direction === 'up' ? 'var(--success)' : 'var(--error)',
                margin: 'var(--space-2) 0 0 0',
              }}
            >
              {metric.direction === 'up' ? '↑' : '↓'} {metric.trend}
            </p>
          </article>
        ))}
      </div>

      <div
        style={{
          marginTop: 'var(--space-4)',
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
        <span className="body-sm">Last updated: just now</span>
      </div>
    </div>
  );
}
