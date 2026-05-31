import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { clusterService, buildConnectionString } from '../../services/api';
import DashboardHeader from '../../components/ui/DashboardHeader';
import CreateDatabaseForm from '../../components/ui/CreateDatabaseForm';
import StorageUtilizationCard from './components/StorageUtilizationCard';
import ClusterHealthCard from './components/ClusterHealthCard';
import DatabasesTable from './components/DatabasesTable';

const STATUS_MAP = {
  running: 'Healthy',
  error: 'Warning',
  provisioning: 'Provisioning',
  stopped: 'Stopped',
  deleting: 'Deleting',
};

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.45)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  zIndex: 200,
  padding: '3rem var(--space-6)',
  overflowY: 'auto',
};

function toRow(project) {
  return {
    id: project.id,
    name: project.name,
    status: STATUS_MAP[project.status] ?? project.status,
    postgresVersion: project.pgVersion,
    region: project.region,
    instances: project.instances ?? 1,
    storageUsedGb: project.storageUsedGb ?? 0,
    provisionedStorageGb: project.provisionedStorageGb ?? 0,
  };
}

export default function Database() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [databases, setDatabases] = useState([]);
  const [query, setQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [createdKey, setCreatedKey] = useState(null); // { name, apiKey, rwConnStr, roConnStr } — shown once

  function fetchDatabases() {
    clusterService
      .getClusters()
      .then((data) => setDatabases((data ?? []).map(toRow)))
      .catch((err) => setFetchError(err.message));
  }

  // Initial load + poll so provisioning → running transitions appear live.
  useEffect(() => {
    fetchDatabases();
    const t = setInterval(fetchDatabases, 5000);
    return () => clearInterval(t);
  }, []);

  const filteredDatabases = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return databases;
    return databases.filter(
      (db) =>
        db.name.toLowerCase().includes(normalized) ||
        db.region.toLowerCase().includes(normalized) ||
        db.postgresVersion.toLowerCase().includes(normalized),
    );
  }, [query, databases]);

  const usedStorageGb = databases.reduce((acc, db) => acc + (db.storageUsedGb ?? 0), 0);
  const totalStorageGb = databases.reduce((acc, db) => acc + (db.provisionedStorageGb ?? 0), 0);
  const storagePercent = totalStorageGb > 0 ? Math.round((usedStorageGb / totalStorageGb) * 100) : 0;
  const healthyClusters = databases.filter((db) => db.status === 'Healthy').length;

  return (
    <>
      <section className="databases-page">
        <DashboardHeader
          pageTitle="Databases"
          pageDescription="Manage your PostgreSQL clusters and track health in one place."
          buttonText="Create database"
          buttonOnClick={() => setShowCreateForm(true)}
        />

        {fetchError  && <p className="body-sm" style={{ color: 'var(--error)',   marginBottom: 'var(--space-4)' }}>{fetchError}</p>}
        {successMsg  && <p className="body-sm" style={{ color: 'var(--primary)', marginBottom: 'var(--space-4)', fontWeight: 600 }}>{successMsg}</p>}

        <div className="databases-stats-grid">
          <StorageUtilizationCard
            usedStorageGb={usedStorageGb}
            totalStorageGb={totalStorageGb}
            percentage={storagePercent}
          />
          <ClusterHealthCard healthyClusters={healthyClusters} totalClusters={databases.length} />
        </div>

        <div className="databases-search-wrap">
          <label htmlFor="database-search" className="label-md">Search databases</label>
          <input
            id="database-search"
            type="text"
            className="databases-search-input"
            placeholder="Search by name, region, or Postgres version"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <DatabasesTable
          rows={filteredDatabases}
          onViewDetails={(id) => navigate(`/dashboard/databases/${id}`)}
        />
      </section>

      {showCreateForm && (
        <div
          style={overlayStyle}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreateForm(false); }}
        >
          <CreateDatabaseForm
            onSubmit={(cluster) => {
              setShowCreateForm(false);
              fetchDatabases();
              if (cluster?.apiKey) {
                setCreatedKey({
                  name: cluster.name,
                  apiKey: cluster.apiKey,
                  rwConnStr: cluster.rwConnectionString ?? buildConnectionString(cluster.apiKey),
                  roConnStr: cluster.roConnectionString ?? '',
                });
              } else {
                setSuccessMsg('Database created — provisioning in progress.');
                setTimeout(() => setSuccessMsg(''), 5000);
              }
            }}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      {createdKey && (
        <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) setCreatedKey(null); }}>
          <div style={{ maxWidth: 560, width: '100%', background: '#fff', borderRadius: 12, padding: 24, fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 18, margin: 0 }}>Database “{createdKey.name}” created</h2>
              <button onClick={() => setCreatedKey(null)} style={{ border: 0, background: 'transparent', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            <p style={{ fontSize: 13, color: '#b45309', margin: '8px 0 16px' }}>
              Copy these now — they are shown <strong>only once</strong> and cannot be retrieved later.
            </p>
            <label style={{ fontSize: 12, color: '#475569' }}>API key (read-write)</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <code style={{ flex: 1, padding: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, wordBreak: 'break-all' }}>{createdKey.apiKey}</code>
              <button onClick={() => navigator.clipboard?.writeText(createdKey.apiKey)} style={{ cursor: 'pointer' }}>Copy</button>
            </div>
            <label style={{ fontSize: 12, color: '#475569' }}>Read-write connection string (works once status is “running”)</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <code style={{ flex: 1, padding: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, wordBreak: 'break-all' }}>{createdKey.rwConnStr}</code>
              <button onClick={() => navigator.clipboard?.writeText(createdKey.rwConnStr)} style={{ cursor: 'pointer' }}>Copy</button>
            </div>
            {createdKey.roConnStr && (
              <>
                <label style={{ fontSize: 12, color: '#475569' }}>Read-only connection string</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <code style={{ flex: 1, padding: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, wordBreak: 'break-all' }}>{createdKey.roConnStr}</code>
                  <button onClick={() => navigator.clipboard?.writeText(createdKey.roConnStr)} style={{ cursor: 'pointer' }}>Copy</button>
                </div>
              </>
            )}
            <div style={{ textAlign: 'right', marginTop: 20 }}>
              <button onClick={() => setCreatedKey(null)} style={{ padding: '8px 18px', background: '#4f46e5', color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer' }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
