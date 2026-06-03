import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

const STATUS_COLORS = {
  running: '#16a34a',
  provisioning: '#d97706',
  error: '#dc2626',
  stopped: '#6b7280',
  deleting: '#6b7280',
  healthy: '#16a34a',
};

function DbNode({ data }) {
  const borderColor = STATUS_COLORS[data.status] || '#6b7280';
  const bgColor = data.isPrimary ? '#ede9fe' : '#f4f4f6';
  const labelColor = data.isPrimary ? '#201772' : '#42474e';

  return (
    <div
      style={{
        padding: '12px 18px',
        borderRadius: 12,
        border: `2px solid ${borderColor}`,
        background: bgColor,
        minWidth: 140,
        fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 4,
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={labelColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v4c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
          <path d="M3 9v4c0 1.66 4.03 3 9 3s9-1.34 9-3V9" />
        </svg>
        <span style={{ fontWeight: 600, fontSize: 13, color: labelColor }}>{data.label}</span>
      </div>
      {data.cpu != null && (
        <div style={{ fontSize: 11, color: '#72777f', lineHeight: 1.6 }}>
          CPU: {data.cpu}m · MEM:{' '}
          {data.mem != null ? `${(data.mem / 1024 / 1024).toFixed(0)}Mi` : 'N/A'}
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          top: 6,
          right: 8,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: borderColor,
          boxShadow: `0 0 6px ${borderColor}80`,
        }}
      />
    </div>
  );
}

function PoolerNode({ data }) {
  const bgColor = '#fef3c7';
  const borderColor = '#d97706';

  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 10,
        border: `2px solid ${borderColor}`,
        background: bgColor,
        minWidth: 120,
        fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#92400e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
      <span style={{ fontWeight: 600, fontSize: 12, color: '#92400e' }}>{data.label}</span>
    </div>
  );
}

const nodeTypes = { dbNode: DbNode, poolerNode: PoolerNode };

const ANIMATED_EDGE_STYLE = {
  stroke: '#473ca9',
  strokeWidth: 2,
  animated: true,
  markerEnd: { type: MarkerType.ArrowClosed, color: '#473ca9' },
};

export default function DatabaseGraph({ metrics, db }) {
  const instancePods = useMemo(
    () => (metrics?.pods ?? []).filter((p) => p.role === 'primary' || p.role === 'replica'),
    [metrics],
  );

  const nodes = useMemo(() => {
    if (!instancePods.length && !db) return [];
    const result = [];
    const startY = 80;
    const spacingY = 120;

    instancePods.forEach((pod, i) => {
      result.push({
        id: pod.name,
        type: 'dbNode',
        position: { x: 280, y: startY + i * spacingY },
        data: {
          label: pod.role === 'primary' ? 'Primary' : `Replica ${i}`,
          isPrimary: pod.role === 'primary',
          status: pod.ready ? 'healthy' : 'error',
          cpu: pod.cpuMillis,
          mem: pod.memoryBytes,
        },
      });
    });

    result.push({
      id: 'pooler-rw',
      type: 'poolerNode',
      position: { x: 30, y: 80 },
      data: { label: 'Pooler RW' },
    });

    result.push({
      id: 'pooler-ro',
      type: 'poolerNode',
      position: { x: 30, y: 220 },
      data: { label: 'Pooler RO' },
    });

    result.push({
      id: 'client',
      type: 'dbNode',
      position: { x: 530, y: 80 + (instancePods.length > 1 ? 60 : 0) },
      data: {
        label: 'Your App',
        isPrimary: false,
        status: 'running',
      },
    });

    return result;
  }, [instancePods, db]);

  const edges = useMemo(() => {
    const result = [];
    const primaryPod = instancePods.find((p) => p.role === 'primary');

    if (primaryPod) {
      result.push({
        id: 'rw-to-primary',
        source: 'pooler-rw',
        target: primaryPod.name,
        ...ANIMATED_EDGE_STYLE,
        label: 'writes',
        labelStyle: { fontSize: 10, fill: '#473ca9' },
      });
    }

    instancePods
      .filter((p) => p.role === 'replica')
      .forEach((pod) => {
        result.push({
          id: `ro-to-${pod.name}`,
          source: 'pooler-ro',
          target: pod.name,
          ...ANIMATED_EDGE_STYLE,
          label: 'reads',
          labelStyle: { fontSize: 10, fill: '#473ca9' },
        });
      });

    if (primaryPod) {
      result.push({
        id: 'primary-to-replica-sync',
        source: primaryPod.name,
        target: 'pooler-ro',
        strokeDasharray: '5 5',
        style: { stroke: '#c2c7cf', strokeWidth: 1.5 },
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#c2c7cf' },
        label: 'sync',
        labelStyle: { fontSize: 10, fill: '#c2c7cf' },
      });
    }

    result.push({
      id: 'client-to-rw',
      source: 'client',
      target: 'pooler-rw',
      ...ANIMATED_EDGE_STYLE,
      style: { ...ANIMATED_EDGE_STYLE.style, stroke: '#201772' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#201772' },
    });

    result.push({
      id: 'client-to-ro',
      source: 'client',
      target: 'pooler-ro',
      ...ANIMATED_EDGE_STYLE,
      style: { ...ANIMATED_EDGE_STYLE.style, stroke: '#201772' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#201772' },
    });

    return result;
  }, [instancePods]);

  const [internalNodes, setInternalNodes, onNodesChange] = useNodesState(nodes);
  const [internalEdges, setInternalEdges, onEdgesChange] = useEdgesState(edges);

  if (!metrics && !db) {
    return (
      <div
        style={{
          padding: 'var(--space-8)',
          textAlign: 'center',
          color: 'var(--on-surface-variant)',
        }}
      >
        Loading cluster topology...
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: 420,
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        border: '1px solid var(--outline-variant)',
      }}
    >
      <ReactFlow
        nodes={internalNodes}
        edges={internalEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.5}
        maxZoom={1.5}
        defaultEdgeOptions={ANIMATED_EDGE_STYLE}
      >
        <Background color="#e2e8f0" gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          style={{ background: 'var(--surface-container-lowest)' }}
        />
      </ReactFlow>
    </div>
  );
}
