import { useCallback, useEffect, useRef, useState } from 'react';
import { adminService, buildConnectionString } from '../../services/api';
import { PG_VERSIONS, SIZES } from '../../constants/database';
import { useAuth } from '../../hooks/useAuth';

const statusColor = {
  running: '#16a34a',
  provisioning: '#d97706',
  error: '#dc2626',
  deleting: '#6b7280',
  stopped: '#6b7280',
};

const POLL_MS = 5000;

export default function Admin() {
  const { user, logout } = useAuth();
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState('');

  // Create form
  const [form, setForm] = useState({ name: '', size: 'starter', pgVersion: '17' });
  const [creating, setCreating] = useState(false);
  // The sk_live_ key is returned exactly once on create — surface it until dismissed.
  const [created, setCreated] = useState(null); // { name, apiKey, connStr }

  const load = useCallback(async () => {
    try {
      const data = await adminService.getClusters();
      setClusters(data || []);
      setErr('');
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + auto-refresh so provisioning → running → (deleted) is visible.
  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    setErr('');
    try {
      const cluster = await adminService.createCluster(form);
      const apiKey = cluster.apiKey;
      setCreated({ name: cluster.name, apiKey, connStr: buildConnectionString(apiKey) });
      setForm({ name: '', size: 'starter', pgVersion: '17' });
      await load();
    } catch (e2) {
      setErr(e2?.response?.data?.message || e2.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete cluster "${c.name}" (${c.id})? This destroys its database.`)) return;
    setBusyId(c.id);
    try {
      await adminService.deleteCluster(c.id);
      await load();
    } catch (e) {
      alert(e?.response?.data?.message || e.message || 'Delete failed');
    } finally {
      setBusyId('');
    }
  };

  const copy = (text) => navigator.clipboard?.writeText(text);

  const th = { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #e5e7eb', fontSize: 13 };
  const td = { padding: '8px 10px', borderBottom: '1px solid #f1f5f9', fontSize: 13 };
  const input = { padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 };

  return (
    <div style={{ maxWidth: 1100, margin: '40px auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 22 }}>Admin — Clusters ({clusters.length})</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>{user?.email}</span>
          <button onClick={load} disabled={loading} style={{ padding: '6px 14px', cursor: 'pointer' }}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button onClick={logout} style={{ padding: '6px 14px', cursor: 'pointer' }}>Log out</button>
        </div>
      </div>

      {/* One-time API key + connection string after a create */}
      {created && (
        <div style={{ marginTop: 16, padding: 16, border: '1px solid #16a34a', borderRadius: 8, background: '#f0fdf4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ color: '#166534' }}>Cluster “{created.name}” is provisioning.</strong>
            <button onClick={() => setCreated(null)} style={{ cursor: 'pointer', border: 0, background: 'transparent', fontSize: 18 }}>×</button>
          </div>
          <p style={{ fontSize: 13, color: '#166534', margin: '6px 0' }}>
            Copy these now — the API key is shown <strong>only once</strong>.
          </p>
          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 12, color: '#475569' }}>API key (rw)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <code style={{ flex: 1, padding: 8, background: '#fff', border: '1px solid #d1fae5', borderRadius: 6, fontSize: 12, wordBreak: 'break-all' }}>{created.apiKey}</code>
              <button onClick={() => copy(created.apiKey)} style={{ cursor: 'pointer' }}>Copy</button>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 12, color: '#475569' }}>Connection string (once status is “running”)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <code style={{ flex: 1, padding: 8, background: '#fff', border: '1px solid #d1fae5', borderRadius: 6, fontSize: 12, wordBreak: 'break-all' }}>{created.connStr}</code>
              <button onClick={() => copy(created.connStr)} style={{ cursor: 'pointer' }}>Copy</button>
            </div>
          </div>
        </div>
      )}

      {/* Create form */}
      <form onSubmit={create} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#475569' }}>Name</label>
          <input style={input} value={form.name} placeholder="my-database"
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#475569' }}>Size</label>
          <select style={input} value={form.size} onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}>
            {SIZES.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.cpu}, {s.ram}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#475569' }}>PG version</label>
          <select style={input} value={form.pgVersion} onChange={(e) => setForm((f) => ({ ...f, pgVersion: e.target.value }))}>
            {PG_VERSIONS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <button type="submit" disabled={creating || !form.name.trim()}
          style={{ padding: '9px 18px', color: '#fff', background: '#4f46e5', border: 0, borderRadius: 6, cursor: 'pointer' }}>
          {creating ? 'Creating…' : 'Create cluster'}
        </button>
      </form>

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
