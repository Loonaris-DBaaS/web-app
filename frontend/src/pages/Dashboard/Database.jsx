import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { clusterService } from '../../services/api';
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

const TOTAL_STORAGE_GB = 1200;

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
    replicas: project.resourceConfig?.desiredReplicas ?? 0,
    storageUsedGb: project.storageUsage ?? 0,
  };
}

export default function Database() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [databases, setDatabases] = useState([]);
  const [query, setQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    clusterService
      .getClusters()
      .then((data) => setDatabases((data ?? []).map(toRow)))
      .catch((err) => setFetchError(err.message));
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

  const usedStorageGb = databases.reduce((acc, db) => acc + db.storageUsedGb, 0);
  const storagePercent = Math.round((usedStorageGb / TOTAL_STORAGE_GB) * 100);
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

        {fetchError && <p className="body-sm" style={{ color: 'var(--error)', marginBottom: 'var(--space-4)' }}>{fetchError}</p>}

        <div className="databases-stats-grid">
          <StorageUtilizationCard
            usedStorageGb={usedStorageGb}
            totalStorageGb={TOTAL_STORAGE_GB}
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
            onSubmit={() => setShowCreateForm(false)}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}
    </>
  );
}
