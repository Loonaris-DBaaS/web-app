import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { clusterService, buildConnectionString } from '../../services/api';
import DashboardHeader from '../../components/ui/DashboardHeader';
import CreateDatabaseForm from '../../components/ui/CreateDatabaseForm';
import ConnectionStringModal from '../../components/ui/ConnectionStringModal';
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
  const [createdKey, setCreatedKey] = useState(null);
  const [spikeNotice, setSpikeNotice] = useState(false);
  const [spikeExiting, setSpikeExiting] = useState(false);

  // Auto-hide spike notice after 9 seconds with smooth exit animation.
  useEffect(() => {
    if (!spikeNotice) {
      setSpikeExiting(false);
      return;
    }
    const autoHide = setTimeout(() => {
      setSpikeExiting(true);
      setTimeout(() => setSpikeNotice(false), 400); // let slide-up animation finish
    }, 9000);
    return () => clearTimeout(autoHide);
  }, [spikeNotice]);

  function dismissSpike() {
    setSpikeExiting(true);
    setTimeout(() => setSpikeNotice(false), 400);
  }

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
  const storagePercent =
    totalStorageGb > 0 ? Math.round((usedStorageGb / totalStorageGb) * 100) : 0;
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

        {/* Spike notice — shown after closing the create form */}
        {spikeNotice && (
          <div className={`dash-spike-notice${spikeExiting ? ' is-exiting' : ''}`}>
            <span className="material-symbols-outlined">network_check</span>
            <span>
              Lots of folks are spinning up databases right now — we&apos;re having a spike!
              Yours might take a little longer than usual. Hang tight!
            </span>
            <button
              type="button"
              className="dash-spike-notice__close"
              onClick={dismissSpike}
              aria-label="Dismiss notice"
            >
              close
            </button>
          </div>
        )}

        <div className="databases-stats-grid">
          <StorageUtilizationCard
            usedStorageGb={usedStorageGb}
            totalStorageGb={totalStorageGb}
            percentage={storagePercent}
          />
          <ClusterHealthCard healthyClusters={healthyClusters} totalClusters={databases.length} />
        </div>

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
          onViewSettings={(id) => navigate(`/dashboard/databases/${id}`, { state: { initialTab: 'Settings' } })}
          onDeleteRequest={(id) => navigate(`/dashboard/databases/${id}`, { state: { initialTab: 'Settings', scrollToDanger: true } })}
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
              setSpikeNotice(true);
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