import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { clusterService, buildConnectionString } from '../../services/api';
import DashboardHeader from '../../components/ui/DashboardHeader';
import CreateDatabaseForm from '../../components/ui/CreateDatabaseForm';
import ConnectionStringModal from '../../components/ui/ConnectionStringModal';
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

  async function handleDelete(id) {
    try {
      await clusterService.deleteCluster(id);
      setSuccessMsg('Database deleted.');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchDatabases();
    } catch (err) {
      setFetchError(err.response?.data?.message || err.message || 'Delete failed');
      setTimeout(() => setFetchError(''), 5000);
    }
  }

  return (
    <>
      <section className="databases-page">
        <DashboardHeader
          pageTitle="Databases"
          pageDescription="Manage your PostgreSQL clusters and track health in one place."
          buttonText="Create database"
          buttonOnClick={() => setShowCreateForm(true)}
        />

        {fetchError && (
          <p className="body-sm" style={{ color: 'var(--error)', marginBottom: 'var(--space-4)' }}>
            {fetchError}
          </p>
        )}
        {successMsg && (
          <p
            className="body-sm"
            style={{ color: 'var(--primary)', marginBottom: 'var(--space-4)', fontWeight: 600 }}
          >
            {successMsg}
          </p>
        )}

        <div className="databases-search-wrap">
          <label htmlFor="database-search" className="label-md">
            Search databases
          </label>
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
          onViewMetrics={(id) => navigate(`/dashboard/databases/${id}`, { state: { initialTab: 'Metrics' } })}
          onDelete={handleDelete}
        />
      </section>

      {showCreateForm && (
        <div
          style={overlayStyle}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateForm(false);
          }}
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
        <ConnectionStringModal
          apiKey={createdKey.apiKey}
          rwConnectionString={createdKey.rwConnStr}
          roConnectionString={createdKey.roConnStr}
          onClose={() => setCreatedKey(null)}
        />
      )}
    </>
  );
}
