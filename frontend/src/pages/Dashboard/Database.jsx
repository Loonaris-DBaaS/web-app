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
import Button from '../../components/ui/Button';

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

function DangerZoneConfirm({ dbName, onConfirm, onCancel }) {
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const canDelete = deleteText === dbName;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', color: 'var(--error)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 28 }}>report</span>
        <h4 style={{ fontSize: 'var(--text-title-md-size)', fontWeight: 700, margin: 0, color: 'var(--on-surface)' }}>
          Danger Zone
        </h4>
      </div>

      <p style={{ fontSize: 'var(--text-body-md-size)', fontWeight: 600, color: 'var(--on-surface)', margin: '0 0 4px 0' }}>
        Delete this database
      </p>
      <p style={{ fontSize: 'var(--text-body-sm-size)', color: 'var(--on-surface-variant)', margin: '0 0 var(--space-6) 0', lineHeight: 1.5 }}>
        Once you delete a database, there is no going back. Please be certain. All data
        and backups will be immediately purged.
      </p>

      <div style={{
        padding: 'var(--space-4)',
        background: 'var(--surface-container-low)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid rgba(220,38,38,0.2)',
      }}>
        <p style={{ fontSize: 'var(--text-body-sm-size)', margin: '0 0 var(--space-3) 0' }}>
          Type <strong>{dbName}</strong> to confirm deletion.
        </p>
        <input
          type="text"
          value={deleteText}
          onChange={(e) => setDeleteText(e.target.value)}
          placeholder={dbName}
          style={{
            width: '100%',
            background: 'var(--surface-container-lowest)',
            border: '1px solid var(--outline-variant)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-3) var(--space-4)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-body-md-size)',
            color: 'var(--on-surface)',
            fontWeight: 500,
            outline: 'none',
            boxSizing: 'border-box',
            marginBottom: 'var(--space-4)',
          }}
        />
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <Button text="Cancel" variant="ghost" onClick={onCancel} />
          <Button
            text={deleting ? 'Deleting…' : 'Confirm Deletion'}
            variant="danger"
            onClick={async () => {
              if (!canDelete) return;
              setDeleting(true);
              await onConfirm();
            }}
            disabled={!canDelete || deleting}
          />
        </div>
      </div>

      <span
        className="material-symbols-outlined"
        style={{
          position: 'absolute',
          bottom: '-32px',
          right: '-32px',
          fontSize: '160px',
          opacity: 0.05,
          color: 'var(--error)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
        aria-hidden="true"
      >
        delete_forever
      </span>
    </>
  );
}
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
  const [deletingDb, setDeletingDb] = useState(null); // { name, apiKey, rwConnStr, roConnStr } — shown once

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
          onDeleteRequest={(id) => {
            const db = filteredDatabases.find((d) => d.id === id);
            setDeletingDb(db || { id, name: id });
          }}
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

      {deletingDb && (
        <div
          style={overlayStyle}
          onClick={(e) => { if (e.target === e.currentTarget) setDeletingDb(null); }}
        >
          <div
            style={{
              background: 'var(--surface-container-lowest)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-modal)',
              maxWidth: 520,
              width: '100%',
              padding: 'var(--space-8)',
              position: 'relative',
              overflow: 'hidden',
              marginTop: '10vh',
            }}
          >
            <DangerZoneConfirm
              dbName={deletingDb.name}
              onConfirm={async () => {
                await handleDelete(deletingDb.id);
                setDeletingDb(null);
              }}
              onCancel={() => setDeletingDb(null)}
            />
          </div>
        </div>
      )}
    </>
  );
}
