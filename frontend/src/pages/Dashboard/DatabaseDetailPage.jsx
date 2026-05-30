import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clusterService } from '../../services/api';
import { DEPLOYMENT_OPTION_MAP } from '../../constants/database';
import DashboardHeader from '../../components/ui/DashboardHeader';
import { InstanceContainer } from '../../components/ui/InstanceContainer';
import ConnectionParameters from '../../components/ui/ConnectionParameters';
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
    id:           d.id,
    name:         d.name,
    region:       d.region,
    pgVersion:    d.pgVersion,
    size:         d.size,
    status:       d.status,
    ha:           d.deploymentOption === 'MULTI_AZ_CLUSTER',
    backup:       d.backup,
    autoscale:    d.autoscale,
    readReplicas: d.readReplicas,
    createdAt:    d.createdAt,
    instances:    d.instances ?? [],
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
      const res = await clusterService.updateCluster(id, {
        ...payload,
        deploymentOption: DEPLOYMENT_OPTION_MAP[payload.deploymentOption] ?? payload.deploymentOption,
      });
      setDb(toDb(res.data));
      setSuccessMsg('Changes applied successfully.');
    } catch (err) {
      setActionError(err.response?.data?.error ?? err.message);
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
            <ConnectionParameters
            connectionString="postgres://root:••••••••••••@db.loonaris.io:5432/production_main"
            mode="Standard"
            modes={['Standard', 'URI', 'JDBC']}
            onModeChange={(m) => console.log(m)}
            />
          )}

          {activeTab === 'Metrics' && <DatabaseMetricsTab />}

          {activeTab === 'Replicas' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
              {db.instances.map((inst) => (
                <InstanceContainer
                  key={inst.id}
                  name={inst.name}
                  version={inst.version}
                  region={inst.region}
                  usedStorage={inst.usedStorage}
                  totalStorage={inst.totalStorage}
                  status={inst.status}
                />
              ))}
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
