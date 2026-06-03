import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

/* ─── Client node (far left) ─── */
function ClientNode({ data }) {
  return (
    <div
      style={{
        padding: '16px 24px',
        borderRadius: 16,
        border: '2px solid #1e293b',
        background: '#f8fafc',
        minWidth: 130,
        fontFamily: "'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', cursive, sans-serif",
        textAlign: 'center',
      }}
    >
      <span style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{data.label}</span>
    </div>
  );
}

/* ─── Pooler node (middle) ─── */
function PoolerNode({ data }) {
  return (
    <div
      style={{
        padding: '10px 16px',
        borderRadius: 10,
        border: '2px solid #f59e0b',
        background: '#fef3c7',
        minWidth: 120,
        fontFamily: "'Inter', system-ui, sans-serif",
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
      <span style={{ fontWeight: 700, fontSize: 12, color: '#92400e' }}>{data.label}</span>
    </div>
  );
}

/* ─── Postgres node (far right) ─── */
function DbNode({ data }) {
  const borderColor = '#16a34a'; // green border for all DB nodes
  const bgColor = data.isPrimary ? '#ede9fe' : '#f8fafc';
  const labelColor = data.isPrimary ? '#201772' : '#0f172a';

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: 12,
        border: `2px solid ${borderColor}`,
        background: bgColor,
        minWidth: 170,
        fontFamily: "'Inter', system-ui, sans-serif",
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
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
        <span style={{ fontWeight: 700, fontSize: 13, color: labelColor }}>{data.label}</span>
      </div>
      {data.cpu != null && (
        <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>
          CPU: {data.cpu}m · MEM:{' '}
          {data.mem != null ? `${(data.mem / 1024 / 1024).toFixed(0)}Mi` : 'N/A'}
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          top: 8,
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

const nodeTypes = { clientNode: ClientNode, poolerNode: PoolerNode, dbNode: DbNode };

/* ─── Inner component: calls fitView once nodes are ready ─── */
function FitViewHandler({ nodes }) {
  const { fitView } = useReactFlow();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (nodes.length > 0 && !hasFitted.current) {
      const t = setTimeout(() => {
        fitView({ padding: 0.15, duration: 300 });
        hasFitted.current = true;
      }, 80);
      return () => clearTimeout(t);
    }
  }, [nodes, fitView]);

  return null;
}

export default function DatabaseGraph({ metrics, db }) {
  const instancePods = useMemo(
    () => (metrics?.pods ?? []).filter((p) => p.role === 'primary' || p.role === 'replica'),
    [metrics],
  );

  const nodes = useMemo(() => {
    if (!instancePods.length && !db) return [];
    const result = [];

    // 1. Client (far left)
    result.push({
      id: 'client',
      type: 'clientNode',
      position: { x: 20, y: 140 },
      data: { label: 'your pg client' },
    });

    // 2. Poolers (middle)
    result.push({
      id: 'pooler-rw',
      type: 'poolerNode',
      position: { x: 240, y: 60 },
      data: { label: 'Pooler RW' },
    });
    result.push({
      id: 'pooler-ro',
      type: 'poolerNode',
      position: { x: 240, y: 220 },
      data: { label: 'Pooler RO' },
    });

    // 3. Postgres nodes (far right)
    const primaryPod = instancePods.find((p) => p.role === 'primary');
    const replicas = instancePods.filter((p) => p.role === 'replica');
    const dbStartY = 20;
    const dbSpacingY = 120;

    if (primaryPod) {
      result.push({
        id: primaryPod.name,
        type: 'dbNode',
        position: { x: 520, y: dbStartY },
        data: {
          label: 'Primary',
          isPrimary: true,
          status: primaryPod.ready ? 'healthy' : 'error',
          cpu: primaryPod.cpuMillis,
          mem: primaryPod.memoryBytes,
        },
      });
    }

    replicas.forEach((pod, i) => {
      result.push({
        id: pod.name,
        type: 'dbNode',
        position: { x: 520, y: dbStartY + (i + 1) * dbSpacingY },
        data: {
          label: `Replica ${i + 1}`,
          isPrimary: false,
          status: pod.ready ? 'healthy' : 'error',
          cpu: pod.cpuMillis,
          mem: pod.memoryBytes,
        },
      });
    });

    return result;
  }, [instancePods, db]);

  const edges = useMemo(() => {
    const result = [];
    const primaryPod = instancePods.find((p) => p.role === 'primary');
    const replicas = instancePods.filter((p) => p.role === 'replica');

    // Client → Pooler RW (writes) — black arrow
    result.push({
      id: 'client-to-rw',
      source: 'client',
      target: 'pooler-rw',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#0f172a', strokeWidth: 2.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' },
    });

    // Client → Pooler RO (reads) — black arrow
    result.push({
      id: 'client-to-ro',
      source: 'client',
      target: 'pooler-ro',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#0f172a', strokeWidth: 2.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' },
    });

    // Pooler RW → Primary — black arrow
    if (primaryPod) {
      result.push({
        id: 'rw-to-primary',
        source: 'pooler-rw',
        target: primaryPod.name,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#0f172a', strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' },
      });
    }

    // Pooler RO → Replicas — blue arrows
    replicas.forEach((pod) => {
      result.push({
        id: `ro-to-${pod.name}`,
        source: 'pooler-ro',
        target: pod.name,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
      });
    });

    // Streaming replication: Primary → Replica — blue animated arrows
    if (primaryPod) {
      replicas.forEach((pod) => {
        result.push({
          id: `stream-${primaryPod.name}-${pod.name}`,
          source: primaryPod.name,
          target: pod.name,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#3b82f6', strokeWidth: 2.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
          label: 'streaming replication',
          labelStyle: { fontSize: 10, fill: '#3b82f6', fontWeight: 600 },
          labelBgStyle: { fill: '#fff', rx: 4 },
          labelBgPadding: [4, 4],
        });
      });
    }

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
        minZoom={0.4}
        maxZoom={1.2}
      >
        <FitViewHandler nodes={internalNodes} />
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
