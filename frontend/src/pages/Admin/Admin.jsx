import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminService, buildConnectionString, GATEWAY_HOST } from '../../services/api';
import { PG_VERSIONS, SIZES } from '../../constants/database';

const statusColor = {
  running: '#16a34a',
  provisioning: '#d97706',
  error: '#dc2626',
  deleting: '#6b7280',
  stopped: '#6b7280',
};

const POLL_MS = 5000;
const TOKEN_KEY = 'adminToken';

// CNPG resource names are deterministic (see provisioning.ts buildManifests):
// one Cluster `instance-db` and two Poolers per namespace.
const k8s = (ns) => ({
  namespace: ns,
  cnpgCluster: 'instance-db',
  poolerRw: 'pooler-rw',
  poolerRo: 'pooler-ro',
  rwHost: `pooler-rw.${ns}.svc.cluster.local`,
  roHost: `pooler-ro.${ns}.svc.cluster.local`,
});

export default function Admin() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem(TOKEN_KEY));

  // Login form (hardcoded platform admin)
  const [creds, setCreds] = useState({ email: '', password: '' });
  const [loginErr, setLoginErr] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Dashboard
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState('');
  const [form, setForm] = useState({ name: '', size: 'starter', pgVersion: '17' });
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null); // { name, apiKey, connStr } — shown once

  // UI state
  const [selected, setSelected] = useState(() => new Set());
  const [expanded, setExpanded] = useState(() => new Set());
  const [groupByUser, setGroupByUser] = useState(true);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [tab, setTab] = useState('clusters');

  // Users tab
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersErr, setUsersErr] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');

  // Stats tab
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsErr, setStatsErr] = useState('');

  const doLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginErr('');
    try {
      const { accessToken } = await adminService.login(creds.email, creds.password);
      localStorage.setItem(TOKEN_KEY, accessToken);
      setAuthed(true);
    } catch (e2) {
      setLoginErr(e2?.response?.data?.message || 'Login failed');
    } finally {
      setLoggingIn(false);
    }
  };

  const adminLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setAuthed(false);
    setClusters([]);
    setSelected(new Set());
  };

  const load = useCallback(async () => {
    try {
      const data = await adminService.getClusters();
      setClusters(data || []);
      setErr('');
    } catch (e) {
      if (e?.response?.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        setAuthed(false);
        return;
      }
      setErr(e?.response?.data?.message || e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersErr('');
    try {
      const data = await adminService.getUsers();
      setUsers(data || []);
    } catch (e) {
      if (e?.response?.status === 401) { adminLogout(); return; }
      setUsersErr(e?.response?.data?.message || e.message || 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsErr('');
    try {
      const data = await adminService.getStats();
      setStats(data);
    } catch (e) {
      if (e?.response?.status === 401) { adminLogout(); return; }
      setStatsErr(e?.response?.data?.message || e.message || 'Failed to load stats');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Load + auto-refresh clusters while authed and on clusters tab.
  useEffect(() => {
    if (!authed) return undefined;
    if (tab === 'clusters') {
      load();
      const t = setInterval(load, POLL_MS);
      return () => clearInterval(t);
    }
  }, [authed, load, tab]);

  // Load users when switching to users tab.
  useEffect(() => {
    if (authed && tab === 'users') loadUsers();
  }, [authed, tab, loadUsers]);

  // Load stats when switching to stats tab.
  useEffect(() => {
    if (authed && tab === 'stats') loadStats();
  }, [authed, tab, loadStats]);

  // Drop selections/expansions for clusters that no longer exist.
  useEffect(() => {
    const ids = new Set(clusters.map((c) => c.id));
    setSelected((prev) => new Set([...prev].filter((id) => ids.has(id))));
    setExpanded((prev) => new Set([...prev].filter((id) => ids.has(id))));
  }, [clusters]);

  const create = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    setErr('');
    try {
      const cluster = await adminService.createCluster(form);
      setCreated({
        name: cluster.name,
        apiKey: cluster.apiKey,
        connStr: buildConnectionString(cluster.apiKey),
      });
      setForm({ name: '', size: 'starter', pgVersion: '17' });
      await load();
    } catch (e2) {
      if (e2?.response?.status === 401) {
        adminLogout();
        return;
      }
      setErr(e2?.response?.data?.message || e2.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete cluster "${c.name}" (${c.id})? This destroys its database.`))
      return;
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

  // --- filtering / grouping -----------------------------------------------
  const filtered = useMemo(
    () => (statusFilter === 'all' ? clusters : clusters.filter((c) => c.status === statusFilter)),
    [clusters, statusFilter],
  );

  const groups = useMemo(() => {
    const byOwner = new Map();
    for (const c of filtered) {
      const key = c.tenant?.id || c.tenantId || 'unknown';
      if (!byOwner.has(key)) {
        byOwner.set(key, {
          tenantId: key,
          email: c.tenant?.email || '—',
          username: c.tenant?.username || '—',
          clusters: [],
        });
      }
      byOwner.get(key).clusters.push(c);
    }
    return [...byOwner.values()].sort((a, b) => a.email.localeCompare(b.email));
  }, [filtered]);

  // --- selection helpers ---------------------------------------------------
  const visibleIds = useMemo(() => filtered.map((c) => c.id), [filtered]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0 && !allSelected;

  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });

  const toggleGroup = (ids, on) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const toggleExpand = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const bulkDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const names = clusters.filter((c) => ids.includes(c.id)).map((c) => c.name);
    if (
      !window.confirm(
        `Delete ${ids.length} cluster(s)? This destroys their databases.\n\n${names.join(', ')}`,
      )
    )
      return;
    setBulkBusy(true);
    const failed = [];
    for (const id of ids) {
      try {
        await adminService.deleteCluster(id);
      } catch {
        failed.push(id);
      }
    }
    setSelected(new Set(failed));
    setBulkBusy(false);
    await load();
    if (failed.length) alert(`${failed.length} deletion(s) failed.`);
  };

  const input = { padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 };

  // --- Login screen ---
  if (!authed) {
    return (
      <div
        style={{
          maxWidth: 360,
          margin: '80px auto',
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
        }}
      >
        <h1 style={{ fontSize: 20, marginTop: 0 }}>Platform Admin</h1>
        <form onSubmit={doLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            style={input}
            type="email"
            placeholder="Email"
            value={creds.email}
            onChange={(e) => setCreds((c) => ({ ...c, email: e.target.value }))}
          />
          <input
            style={input}
            type="password"
            placeholder="Password"
            value={creds.password}
            onChange={(e) => setCreds((c) => ({ ...c, password: e.target.value }))}
          />
          {loginErr && <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{loginErr}</p>}
          <button
            type="submit"
            disabled={loggingIn}
            style={{
              padding: '10px',
              color: '#fff',
              background: '#4f46e5',
              border: 0,
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {loggingIn ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    );
  }

  const th = {
    textAlign: 'left',
    padding: '8px 10px',
    borderBottom: '2px solid #e5e7eb',
    fontSize: 13,
    color: '#475569',
  };
  const td = {
    padding: '8px 10px',
    borderBottom: '1px solid #f1f5f9',
    fontSize: 13,
    verticalAlign: 'top',
  };
  const mono = { fontFamily: 'monospace', fontSize: 11 };

  const statusCounts = clusters.reduce(
    (acc, c) => ((acc[c.status] = (acc[c.status] || 0) + 1), acc),
    {},
  );
  const owners = new Set(clusters.map((c) => c.tenant?.id || c.tenantId)).size;

  const StatusBadge = ({ status }) => (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: statusColor[status] || '#111',
        background: `${statusColor[status] || '#111'}1a`,
      }}
    >
      {status}
    </span>
  );

  const CopyField = ({ label, value }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <code
          style={{
            ...mono,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 4,
            padding: '3px 6px',
            wordBreak: 'break-all',
          }}
        >
          {value}
        </code>
        <button
          onClick={() => copy(value)}
          style={{ fontSize: 11, padding: '2px 6px', cursor: 'pointer' }}
        >
          Copy
        </button>
      </div>
    </div>
  );

  const DetailPanel = ({ c }) => {
    const m = k8s(c.k8sNamespace);
    return (
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 14,
          margin: '4px 0',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <strong
            style={{
              fontSize: 12,
              color: '#334155',
              textTransform: 'uppercase',
              letterSpacing: 0.4,
            }}
          >
            Owner
          </strong>
          <div style={{ fontSize: 13 }}>{c.tenant?.username || '—'}</div>
          <div style={{ fontSize: 13, color: '#475569' }}>{c.tenant?.email || '—'}</div>
          <CopyField label="Tenant ID" value={c.tenant?.id || c.tenantId} />

          <strong
            style={{
              fontSize: 12,
              color: '#334155',
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              marginTop: 8,
            }}
          >
            Configuration
          </strong>
          <div style={{ fontSize: 13, color: '#475569' }}>
            Size <b>{c.size}</b> · PG <b>{c.pgVersion}</b> · {c.instances} instance(s) · {c.region}
          </div>
          <div style={{ fontSize: 13, color: '#475569' }}>
            {c.cpu} vCPU · {c.ram} RAM · {c.storage} disk
          </div>
          <div style={{ fontSize: 13, color: '#475569' }}>
            Backup {c.backup ? 'on' : 'off'} · Autoscale {c.autoscale ? 'on' : 'off'}
            {' · '}Storage {c.storageUsedGb}/{c.provisionedStorageGb} GB
          </div>
          <div style={{ fontSize: 13, color: '#475569' }}>
            ${c.estimatedPrice}/mo · created {new Date(c.createdAt).toLocaleString()}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <strong
            style={{
              fontSize: 12,
              color: '#334155',
              textTransform: 'uppercase',
              letterSpacing: 0.4,
            }}
          >
            Kubernetes
          </strong>
          <CopyField label="Namespace" value={m.namespace} />
          <CopyField label="CNPG Cluster" value={m.cnpgCluster} />
          <CopyField label="Poolers" value={`${m.poolerRw}, ${m.poolerRo}`} />
          <CopyField label="RW service" value={m.rwHost} />
          <CopyField label="RO service" value={m.roHost} />
          <span style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>kubectl</span>
          <code
            style={{
              ...mono,
              background: '#0f172a',
              color: '#e2e8f0',
              borderRadius: 4,
              padding: '6px 8px',
              wordBreak: 'break-all',
            }}
          >
            kubectl -n {m.namespace} get cluster,pooler,pods
          </code>
          <span style={{ fontSize: 11, color: '#64748b' }}>Public endpoint (gateway)</span>
          <code
            style={{
              ...mono,
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: 4,
              padding: '3px 6px',
            }}
          >
            {GATEWAY_HOST}:5432
          </code>
        </div>
      </div>
    );
  };

  const ClusterRow = ({ c }) => {
    const isOpen = expanded.has(c.id);
    return (
      <>
        <tr style={selected.has(c.id) ? { background: '#eef2ff' } : undefined}>
          <td style={td}>
            <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} />
          </td>
          <td style={td}>
            <button
              onClick={() => toggleExpand(c.id)}
              title="Details"
              style={{
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 12,
                color: '#475569',
                marginRight: 6,
              }}
            >
              {isOpen ? '▾' : '▸'}
            </button>
            <b>{c.name}</b>
          </td>
          <td style={td}>
            <StatusBadge status={c.status} />
          </td>
          {!groupByUser && (
            <td style={td}>
              <div>{c.tenant?.username}</div>
              <div style={{ color: '#64748b', fontSize: 12 }}>{c.tenant?.email}</div>
            </td>
          )}
          <td style={{ ...td, color: '#475569' }}>
            {c.size} · PG{c.pgVersion} · {c.region}
          </td>
          <td style={{ ...td, ...mono }}>{c.k8sNamespace}</td>
          <td style={td}>
            <button
              onClick={() => remove(c)}
              disabled={busyId === c.id}
              style={{
                padding: '4px 10px',
                color: '#fff',
                background: '#dc2626',
                border: 0,
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {busyId === c.id ? '…' : 'Delete'}
            </button>
          </td>
        </tr>
        {isOpen && (
          <tr>
            <td style={{ padding: '0 10px' }} colSpan={groupByUser ? 6 : 7}>
              <DetailPanel c={c} />
            </td>
          </tr>
        )}
      </>
    );
  };

  const colSpanAll = groupByUser ? 6 : 7;

const tabActive = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 16px', border: 0, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff', background: '#4f46e5', borderRadius: '6px 6px 0 0' };
const tabInactive = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 16px', border: 0, fontSize: 14, fontWeight: 500, cursor: 'pointer', color: '#475569', background: 'transparent', borderRadius: '6px 6px 0 0' };

  // --- Dashboard ---
  return (
    <div
      style={{
        maxWidth: 1200,
        margin: '40px auto',
        padding: '0 16px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 22 }}>Admin</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => { if (tab === 'clusters') load(); else if (tab === 'users') loadUsers(); else if (tab === 'stats') loadStats(); }}
            style={{ padding: '6px 14px', cursor: 'pointer' }}>
            Refresh
          </button>
          <button onClick={adminLogout} style={{ padding: '6px 14px', cursor: 'pointer' }}>
            Log out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginTop: 16, borderBottom: '2px solid #e5e7eb' }}>
        <button onClick={() => setTab('clusters')} style={tab === 'clusters' ? tabActive : tabInactive}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>database</span>
          Clusters
        </button>
        <button onClick={() => setTab('users')} style={tab === 'users' ? tabActive : tabInactive}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>people</span>
          Users
        </button>
        <button onClick={() => setTab('stats')} style={tab === 'stats' ? tabActive : tabInactive}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>bar_chart</span>
          Stats
        </button>
      </div>

      {tab === 'clusters' && (<> 

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
        {[
          { label: 'Clusters', val: clusters.length },
          { label: 'Owners', val: owners },
          { label: 'Running', val: statusCounts.running || 0, color: statusColor.running },
          {
            label: 'Provisioning',
            val: statusCounts.provisioning || 0,
            color: statusColor.provisioning,
          },
          { label: 'Error', val: statusCounts.error || 0, color: statusColor.error },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '8px 14px',
              minWidth: 90,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color || '#111' }}>{s.val}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {created && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            border: '1px solid #16a34a',
            borderRadius: 8,
            background: '#f0fdf4',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ color: '#166534' }}>Cluster “{created.name}” is provisioning.</strong>
            <button
              onClick={() => setCreated(null)}
              style={{ cursor: 'pointer', border: 0, background: 'transparent', fontSize: 18 }}
            >
              ×
            </button>
          </div>
          <p style={{ fontSize: 13, color: '#166534', margin: '6px 0' }}>
            Copy these now — the API key is shown <strong>only once</strong>.
          </p>
          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 12, color: '#475569' }}>API key (rw)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <code
                style={{
                  flex: 1,
                  padding: 8,
                  background: '#fff',
                  border: '1px solid #d1fae5',
                  borderRadius: 6,
                  fontSize: 12,
                  wordBreak: 'break-all',
                }}
              >
                {created.apiKey}
              </code>
              <button onClick={() => copy(created.apiKey)} style={{ cursor: 'pointer' }}>
                Copy
              </button>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 12, color: '#475569' }}>
              Connection string (once status is “running”)
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <code
                style={{
                  flex: 1,
                  padding: 8,
                  background: '#fff',
                  border: '1px solid #d1fae5',
                  borderRadius: 6,
                  fontSize: 12,
                  wordBreak: 'break-all',
                }}
              >
                {created.connStr}
              </code>
              <button onClick={() => copy(created.connStr)} style={{ cursor: 'pointer' }}>
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={create}
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
          marginTop: 20,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#475569' }}>Name</label>
          <input
            style={input}
            value={form.name}
            placeholder="my-database"
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#475569' }}>Size</label>
          <select
            style={input}
            value={form.size}
            onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}
          >
            {SIZES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.cpu}, {s.ram}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#475569' }}>PG version</label>
          <select
            style={input}
            value={form.pgVersion}
            onChange={(e) => setForm((f) => ({ ...f, pgVersion: e.target.value }))}
          >
            {PG_VERSIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={creating || !form.name.trim()}
          style={{
            padding: '9px 18px',
            color: '#fff',
            background: '#4f46e5',
            border: 0,
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          {creating ? 'Creating…' : 'Create cluster'}
        </button>
      </form>

      {err && <p style={{ color: '#dc2626' }}>{err}</p>}

      {/* Toolbar: grouping, filter, bulk actions */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, flexWrap: 'wrap' }}
      >
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569' }}
        >
          <input
            type="checkbox"
            checked={groupByUser}
            onChange={(e) => setGroupByUser(e.target.checked)}
          />
          Group by user
        </label>
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569' }}
        >
          Status
          <select
            style={{ ...input, padding: '4px 8px', fontSize: 13 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">all</option>
            {['running', 'provisioning', 'error', 'deleting', 'stopped'].map((s) => (
              <option key={s} value={s}>
                {s} ({statusCounts[s] || 0})
              </option>
            ))}
          </select>
        </label>
        <div style={{ flex: 1 }} />
        {selected.size > 0 && (
          <>
            <span style={{ fontSize: 13, color: '#475569' }}>{selected.size} selected</span>
            <button
              onClick={() => setSelected(new Set())}
              style={{ padding: '6px 12px', cursor: 'pointer' }}
            >
              Clear
            </button>
            <button
              onClick={bulkDelete}
              disabled={bulkBusy}
              style={{
                padding: '6px 14px',
                color: '#fff',
                background: '#dc2626',
                border: 0,
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              {bulkBusy ? 'Deleting…' : `Delete ${selected.size} selected`}
            </button>
          </>
        )}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 36 }}>
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => el && (el.indeterminate = someSelected)}
                onChange={toggleAllVisible}
                title="Select all"
              />
            </th>
            <th style={th}>Name</th>
            <th style={th}>Status</th>
            {!groupByUser && <th style={th}>Owner</th>}
            <th style={th}>Config</th>
            <th style={th}>Namespace</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {!loading && filtered.length === 0 && (
            <tr>
              <td style={td} colSpan={colSpanAll}>
                No clusters.
              </td>
            </tr>
          )}

          {groupByUser
            ? groups.map((g) => {
                const ids = g.clusters.map((c) => c.id);
                const allG = ids.every((id) => selected.has(id));
                const someG = ids.some((id) => selected.has(id)) && !allG;
                return (
                  <>
                    <tr key={`g-${g.tenantId}`} style={{ background: '#f8fafc' }}>
                      <td style={{ ...td, borderBottom: '2px solid #e5e7eb' }}>
                        <input
                          type="checkbox"
                          checked={allG}
                          ref={(el) => el && (el.indeterminate = someG)}
                          onChange={(e) => toggleGroup(ids, e.target.checked)}
                        />
                      </td>
                      <td
                        style={{ ...td, borderBottom: '2px solid #e5e7eb' }}
                        colSpan={colSpanAll - 1}
                      >
                        <b>{g.username}</b>
                        <span style={{ color: '#64748b' }}> · {g.email}</span>
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>
                          {' '}
                          · {g.clusters.length} cluster(s)
                        </span>
                        <span style={{ ...mono, color: '#94a3b8', marginLeft: 8 }}>
                          {g.tenantId}
                        </span>
                      </td>
                    </tr>
                    {g.clusters.map((c) => (
                      <ClusterRow key={c.id} c={c} />
                    ))}
                  </>
                );
              })
            : filtered.map((c) => <ClusterRow key={c.id} c={c} />)}
        </tbody>
      </table>
      </>)}

      {tab === 'users' && (
        <div style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 18, margin: '0 0 12px 0' }}>All Users ({users.length})</h2>
          {usersLoading && <p style={{ color: '#64748b', fontSize: 14 }}>Loading users…</p>}
          {usersErr && <p style={{ color: '#dc2626', fontSize: 14 }}>{usersErr}</p>}
          {!usersLoading && !usersErr && users.length === 0 && (
            <p style={{ color: '#64748b', fontSize: 14 }}>No users found.</p>
          )}
          {!usersLoading && users.length > 0 && (() => {
            const sorted = [...users].sort((a, b) => {
              let va = a[sortField], vb = b[sortField];
              if (sortField === 'createdAt') { va = new Date(va); vb = new Date(vb); }
              if (typeof va === 'string') va = va.toLowerCase();
              if (typeof vb === 'string') vb = vb.toLowerCase();
              if (va == null) va = '';
              if (vb == null) vb = '';
              if (va < vb) return sortDir === 'asc' ? -1 : 1;
              if (va > vb) return sortDir === 'asc' ? 1 : -1;
              return 0;
            });
            const toggleSort = (field) => {
              if (sortField === field) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); }
              else { setSortField(field); setSortDir('asc'); }
            };
            const thStyle = {
              textAlign: 'left',
              padding: '8px 10px',
              borderBottom: '2px solid #e5e7eb',
              color: '#475569',
              cursor: 'pointer',
              userSelect: 'none',
            };
            const arrow = (field) => sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
            return (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={thStyle} onClick={() => toggleSort('email')}>Email{arrow('email')}</th>
                  <th style={thStyle} onClick={() => toggleSort('username')}>Username{arrow('username')}</th>
                  <th style={thStyle} onClick={() => toggleSort('clusterCount')}>Clusters{arrow('clusterCount')}</th>
                  <th style={thStyle} onClick={() => toggleSort('isAdmin')}>Admin{arrow('isAdmin')}</th>
                  <th style={thStyle} onClick={() => toggleSort('createdAt')}>Created{arrow('createdAt')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((u) => (
                  <tr key={u.id}>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>{u.email}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>{u.username}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>{u.clusterCount}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: u.isAdmin ? '#16a34a' : '#64748b', background: u.isAdmin ? '#f0fdf4' : '#f1f5f9' }}>
                        {u.isAdmin ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(u.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            );
          })()}
        </div>
      )}

      {tab === 'stats' && (
        <div style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 18, margin: '0 0 16px 0' }}>Platform Stats</h2>
          {statsLoading && <p style={{ color: '#64748b', fontSize: 14 }}>Loading stats…</p>}
          {statsErr && <p style={{ color: '#dc2626', fontSize: 14 }}>{statsErr}</p>}
          {!statsLoading && !statsErr && stats && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '20px 24px', minWidth: 160, textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: '#4f46e5' }}>{stats.totalUsers}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Total Accounts</div>
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '20px 24px', minWidth: 160, textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: '#16a34a' }}>{stats.runningClusters}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Running Clusters</div>
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '20px 24px', minWidth: 160, textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: '#d97706' }}>{stats.totalClusters}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Total Clusters</div>
              </div>
            </div>
          )}
          {!statsLoading && !statsErr && !stats && (
            <p style={{ color: '#64748b', fontSize: 14 }}>No stats available.</p>
          )}
        </div>
      )}
    </div>
  );
}
