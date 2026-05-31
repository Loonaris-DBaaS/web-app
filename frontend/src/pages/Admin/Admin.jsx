import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';

// Simple, unauthenticated admin view (testing convenience): lists every
// tenant's cluster and lets you delete any of them via /api/admin/clusters.
const statusColor = {
  running: '#16a34a',
  provisioning: '#d97706',
  error: '#dc2626',
  deleting: '#6b7280',
  stopped: '#6b7280',
};

export default function Admin() {
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const { data } = await api.get('/api/admin/clusters');
      setClusters(data.data || []);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (c) => {
    if (!window.confirm(`Delete cluster "${c.name}" (${c.id})? This destroys its database.`)) return;
    setBusyId(c.id);
    try {
      await api.delete(`/api/admin/clusters/${c.id}`);
      await load();
    } catch (e) {
      alert(e?.response?.data?.message || e.message || 'Delete failed');
    } finally {
      setBusyId('');
    }
  };

  const th = { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #e5e7eb', fontSize: 13 };
  const td = { padding: '8px 10px', borderBottom: '1px solid #f1f5f9', fontSize: 13 };

  return (
    <div style={{ maxWidth: 1100, margin: '40px auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 22 }}>Admin — Clusters ({clusters.length})</h1>
        <button onClick={load} disabled={loading} style={{ padding: '6px 14px', cursor: 'pointer' }}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {err && <p style={{ color: '#dc2626' }}>{err}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
        <thead>
          <tr>
            <th style={th}>Name</th>
            <th style={th}>Status</th>
            <th style={th}>Owner</th>
            <th style={th}>Namespace</th>
            <th style={th}>ID</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {clusters.map((c) => (
            <tr key={c.id}>
              <td style={td}>{c.name}</td>
              <td style={{ ...td, color: statusColor[c.status] || '#111', fontWeight: 600 }}>{c.status}</td>
              <td style={td}>{c.tenant?.email}</td>
              <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{c.k8sNamespace}</td>
              <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{c.id}</td>
              <td style={td}>
                <button
                  onClick={() => remove(c)}
                  disabled={busyId === c.id}
                  style={{ padding: '4px 10px', color: '#fff', background: '#dc2626', border: 0, borderRadius: 4, cursor: 'pointer' }}
                >
                  {busyId === c.id ? '…' : 'Delete'}
                </button>
              </td>
            </tr>
          ))}
          {!loading && clusters.length === 0 && (
            <tr><td style={td} colSpan={6}>No clusters.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
