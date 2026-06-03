import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const COLORS = {
  cpu: '#473ca9',
  memory: '#16a34a',
  storage: '#d97706',
};

function formatCpu(val) {
  if (val >= 1000) return `${(val / 1000).toFixed(1)} cores`;
  return `${Math.round(val)}m`;
}

function formatMemory(bytes) {
  if (bytes === null || bytes === undefined) return 'N/A';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MiB`;
  return `${(bytes / 1024).toFixed(0)} KiB`;
}

function formatStorage(gb) {
  if (gb === null || gb === undefined) return 'N/A';
  return `${gb.toFixed(1)} GB`;
}

function CustomTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--surface-container-lowest, #ffffff)',
        border: '1px solid var(--outline-variant, #c2c7cf)',
        borderRadius: 8,
        padding: '8px 12px',
        fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
        fontSize: 12,
        boxShadow: 'var(--shadow-float, 0px 20px 40px rgba(25,28,29,0.05))',
      }}
    >
      <div style={{ color: 'var(--on-surface-variant, #42474e)', marginBottom: 4 }}>{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ color: entry.color, fontWeight: 600 }}>
          {entry.name}:{' '}
          {typeof entry.value === 'number'
            ? entry.dataKey === 'cpu'
              ? formatCpu(entry.value)
              : entry.dataKey === 'memory'
                ? formatMemory(entry.value)
                : formatStorage(entry.value)
            : entry.value}
        </div>
      ))}
    </div>
  );
}

export function CpuMemoryChart({ history, podName }) {
  const data = useMemo(() => {
    if (!history?.[podName]) return [];
    return history[podName].map((s, i) => ({
      time: `+${i * 7}s`,
      cpu: s.cpu || 0,
      memory: s.mem || 0,
    }));
  }, [history, podName]);

  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.cpu} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.cpu} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.memory} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.memory} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="time" fontSize={11} tick={{ fill: '#72777f' }} />
          <YAxis
            yAxisId="cpu"
            orientation="left"
            fontSize={11}
            tick={{ fill: '#72777f' }}
            tickFormatter={(v) => formatCpu(v)}
            width={60}
          />
          <YAxis
            yAxisId="memory"
            orientation="right"
            fontSize={11}
            tick={{ fill: '#72777f' }}
            tickFormatter={(v) => formatMemory(v)}
            width={70}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend fontSize={12} />
          <Area
            yAxisId="cpu"
            type="monotone"
            dataKey="cpu"
            name="CPU"
            stroke={COLORS.cpu}
            fill="url(#cpuGrad)"
            strokeWidth={2}
            dot={false}
          />
          <Area
            yAxisId="memory"
            type="monotone"
            dataKey="memory"
            name="Memory"
            stroke={COLORS.memory}
            fill="url(#memGrad)"
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StorageChart({ metrics }) {
  const usedGb = metrics?.usedStorageGb ?? 0;
  const totalGb = metrics?.planStorageGb ?? metrics?.provisionedStorageGb ?? 0;
  const data = [{ name: 'Storage', used: usedGb, total: totalGb }];

  return (
    <div style={{ width: '100%', height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="storeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.storage} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.storage} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" fontSize={11} tick={{ fill: '#72777f' }} />
          <YAxis
            fontSize={11}
            tick={{ fill: '#72777f' }}
            tickFormatter={(v) => `${v} GB`}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="used"
            name="Used"
            stroke={COLORS.storage}
            fill="url(#storeGrad)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="total"
            name="Total"
            stroke="#c2c7cf"
            fill="none"
            strokeWidth={1}
            strokeDasharray="5 5"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MetricsSummaryCards({ databases }) {
  const total = databases?.length ?? 0;
  const healthy =
    databases?.filter((d) => d.status === 'Healthy' || d.status === 'running').length ?? 0;
  const totalStorage = databases?.reduce((a, d) => a + (d.provisionedStorageGb ?? 0), 0) ?? 0;

  const cards = [
    { label: 'Total Clusters', value: total, color: 'var(--primary)' },
    { label: 'Healthy', value: healthy, color: 'var(--success)' },
    { label: 'Total Storage', value: `${totalStorage.toFixed(0)} GB`, color: 'var(--on-surface)' },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cards.length}, 1fr)`,
        gap: 'var(--space-4)',
      }}
    >
      {cards.map((c) => (
        <div key={c.label} className="dashboard-card" style={{ padding: 'var(--space-5)' }}>
          <div className="label-md">{c.label}</div>
          <div className="display-sm" style={{ marginTop: 'var(--space-2)', color: c.color }}>
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}
