import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clusterService } from '../../services/api';
import DashboardHeader from '../../components/ui/DashboardHeader';
import ConnectionParameters from '../../components/ui/ConnectionParameters';
import { InstanceContainer } from '../../components/ui/InstanceContainer';
import DatabaseMetricsTab from './components/DatabaseMetricsTab';
import DatabaseSettingsTab from './components/DatabaseSettingsTab';
import DatabaseTabNavigation from './components/DatabaseTabNavigation';

const styles = `
  .ddp-main {
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    flex: 1;
  }
`;

function toDb(d) {
  return {
    id:        d.id,
    name:      d.name,
    region:    d.region,
    pgVersion: d.pgVersion,
    size:      d.size,
    status:    d.status,
    instances: d.instances ?? 1,
    storage:   d.storage,
    backup:    d.backup,
    autoscale: d.autoscale,
    createdAt: d.createdAt,
  };
}

export default function DatabaseDetailPage({
  database,
  onNavigate,
  onDelete,
  onUpgrade,
  onResize,
}) {
  const { databaseId } = useParams();
  const navigate = useNavigate();
  const [db, setDb]           = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]         = useState('');
  const [actionError, setActionError] = useState('');
  const [successMsg, setSuccessMsg]   = useState('');
  const [activeTab, setActiveTab]     = useState('Connect');
  const [dbNameInput, setDbNameInput] = useState('');
  const [targetVersion, setTargetVersion] = useState('');
  const [regen, setRegen]             = useState(null); // { apiKey, rwConnectionString, roConnectionString } — shown once
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError]   = useState('');
  const [metrics, setMetrics]         = useState(null);
  const [metricsError, setMetricsError] = useState('');

  useEffect(() => {
    clusterService.getCluster(databaseId)
      .then(res => setDb(toDb(res.data)))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [databaseId]);

  useEffect(() => {
    if (db) {
      setDbNameInput(db.name);
      setTargetVersion(db.pgVersion);
    }
  }, [db]);

  // Poll metrics endpoint every 7s while mounted; feeds both Metrics and Replicas tabs
  useEffect(() => {
    if (!db) return;
    function fetchMetrics() {
      clusterService.getMetrics(db.id)
        .then((data) => { setMetrics(data); setMetricsError(''); })
        .catch((err) => setMetricsError(err.message));
    }
    fetchMetrics();
    const t = setInterval(fetchMetrics, 7000);
    return () => clearInterval(t);
  }, [db?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNavigate(page) {
    onNavigate?.(page);
  }

  async function handleDelete(id) {
    setActionError('');
    setSuccessMsg('');
    try {
      await clusterService.deleteCluster(id);
      navigate('/dashboard/databases');
    } catch (err) {
      setActionError(err.response?.data?.error ?? err.message);
    }
  }

  function handleUpgrade(id, version) {
    onUpgrade?.(id, version);
  }

  async function handleResize(id, payload) {
    setActionError('');
    setSuccessMsg('');
    try {
      const res = await clusterService.updateCluster(id, payload);
      setDb(toDb(res.data));
      setSuccessMsg('Changes applied successfully.');
    } catch (err) {
      setActionError(err.response?.data?.error ?? err.message);
    }
  }

  async function handleRegenerate() {
    if (!window.confirm('Regenerate connection strings? The current key and connection strings will stop working immediately.')) {
      return;
    }
    setRegenError('');
    setRegenLoading(true);
    try {
      const res = await clusterService.regenerateKey(db.id);
      setRegen(res.data);
    } catch (err) {
      setRegenError(err.response?.data?.error ?? err.message);
    } finally {
      setRegenLoading(false);
    }
  }

  if (loading) return <p>Loading…</p>;
  if (error)   return <p>Error: {error}</p>;
  if (!db)     return null;

  return (
    <>
      <style>{styles}</style>

      <section style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <DashboardHeader
          pageTitle={`Databases / ${db.name}`}
        />

        <main className="ddp-main">
          {successMsg && (
            <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-sm)', background: 'var(--success-container, #dcfce7)', color: 'var(--on-success-container, #166534)', fontSize: 'var(--text-body-sm-size)', fontWeight: 500 }}>
              {successMsg}
            </div>
          )}
          {actionError && (
            <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-sm)', background: 'var(--error-container)', color: 'var(--on-error-container)', fontSize: 'var(--text-body-sm-size)', fontWeight: 500 }}>
              {actionError}
            </div>
          )}
          <DatabaseTabNavigation
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          {activeTab === 'Connect' && (
            regen ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-sm)', background: 'var(--warning-container, #fef3c7)', color: 'var(--on-warning-container, #92400e)', fontSize: 'var(--text-body-sm-size)', fontWeight: 500 }}>
                  Copy these now — they are shown <strong>only once</strong> and are never stored. The previous connection strings no longer work.
                </div>
                <ConnectionParameters
                  showModeTabs={false}
                  title="Connection Strings"
                  description="Read-write accepts writes; read-only routes to replicas. Keep these secret — anyone with them can access your database."
                  connections={[
                    { key: 'rw', label: 'Read-write', value: regen.rwConnectionString },
                    { key: 'ro', label: 'Read-only',  value: regen.roConnectionString },
                  ]}
                />
                <div>
                  <button
                    onClick={handleRegenerate}
                    disabled={regenLoading}
                    style={{ padding: '8px 18px', background: 'var(--surface-container-low)', color: 'var(--on-surface)', border: '1px solid var(--outline-variant, #e2e8f0)', borderRadius: 'var(--radius-sm)', cursor: regenLoading ? 'default' : 'pointer', fontSize: 'var(--text-label-md-size)', fontWeight: 500 }}
                  >
                    {regenLoading ? 'Regenerating…' : 'Regenerate again'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                background: 'var(--surface-container-lowest)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-6)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-4)',
                alignItems: 'flex-start',
              }}>
                <h3 style={{ margin: 0, fontSize: 'var(--text-title-md-size, 18px)', color: 'var(--on-surface)' }}>Connection strings</h3>
                <p style={{ margin: 0, fontSize: 'var(--text-body-sm-size)', lineHeight: 'var(--text-body-md-height)', color: 'var(--on-surface-variant)' }}>
                  Connection strings are shown <strong>only once</strong> at creation and are never stored, so they can’t be displayed here. Regenerate to issue a fresh read-write and read-only connection string — this immediately invalidates the previous key.
                </p>
                <button
                  onClick={handleRegenerate}
                  disabled={regenLoading}
                  style={{ padding: '10px 20px', background: 'var(--primary)', color: 'var(--on-primary, #fff)', border: 0, borderRadius: 'var(--radius-sm)', cursor: regenLoading ? 'default' : 'pointer', fontSize: 'var(--text-label-md-size)', fontWeight: 600 }}
                >
                  {regenLoading ? 'Regenerating…' : 'Regenerate connection strings'}
                </button>
                {regenError && (
                  <p style={{ margin: 0, color: 'var(--error)', fontSize: 'var(--text-body-sm-size)' }}>{regenError}</p>
                )}
              </div>
            )
          )}

          {activeTab === 'Metrics' && (
            <DatabaseMetricsTab metrics={metrics} error={metricsError} />
          )}

          {activeTab === 'Replicas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {metricsError && (
                <p className="body-sm" style={{ color: 'var(--error)' }}>Failed to load replica data: {metricsError}</p>
              )}
              {!metrics && !metricsError && (
                <p className="body-sm" style={{ color: 'var(--on-surface-variant)' }}>Loading replica data…</p>
              )}
              {metrics && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                  {metrics.pods.map((pod) => (
                    <InstanceContainer
                      key={pod.name}
                      name={pod.name}
                      version={db.pgVersion}
                      region={pod.node}
                      usedStorage={
                        metrics.usedStorageGb !== null && metrics.pods.length > 0
                          ? Number((metrics.usedStorageGb / metrics.pods.length).toFixed(1))
                          : 0
                      }
                      totalStorage={
                        metrics.pods.length > 0
                          ? Number((metrics.provisionedStorageGb / metrics.pods.length).toFixed(0))
                          : metrics.provisionedStorageGb
                      }
                      status={pod.ready ? 'RUNNING' : 'STOPPED'}
                    />
                  ))}
                  {metrics.pods.length === 0 && (
                    <p className="body-sm" style={{ color: 'var(--on-surface-variant)' }}>
                      No pod data available yet — cluster may still be provisioning.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'Settings' && (
            <DatabaseSettingsTab
              database={db}
              dbNameInput={dbNameInput}
              setDbNameInput={setDbNameInput}
              targetVersion={targetVersion}
              setTargetVersion={setTargetVersion}
              onDelete={handleDelete}
              onUpgrade={handleUpgrade}
              onResize={handleResize}
            />
          )}
        </main>
      </section>
    </>
  );
}
