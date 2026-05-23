import { useState } from 'react';
import { useParams } from 'react-router-dom';
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

export default function DatabaseDetailPage({
  database,
  onNavigate,
  onDelete,
  onUpgrade,
  onResize,
}) {
  const { databaseId } = useParams();
  
  const db = database || {
    id: databaseId || 'db_1',
    name: 'db_payments',
    region: 'us-east-1',
    pgVersion: '16',
    size: 'pro',
    status: 'active',
    ha: true,
    backup: true,
    createdAt: '2026-03-01T10:00:00Z',
  };

  const instances = db.instances || [
    { id: 'inst_1', name: 'Production Main', version: '16.2', region: 'us-east-1', usedStorage: 20, totalStorage: 100, status: 'RUNNING' },
    { id: 'inst_2', name: 'Replica EU',      version: '16.2', region: 'eu-west-1',  usedStorage: 18, totalStorage: 100, status: 'RUNNING' },
    { id: 'inst_3', name: 'Replica Asia',    version: '16.2', region: 'ap-south-1', usedStorage: 5,  totalStorage: 100, status: 'STOPPED' },
  ];

  const [activeTab, setActiveTab] = useState('Connect');
  const [selectedSize, setSelectedSize] = useState(db.size);
  const [dbNameInput, setDbNameInput] = useState(db.name);
  const [targetVersion, setTargetVersion] = useState(db.pgVersion);

  function handleNavigate(page) {
    onNavigate?.(page);
  }

  function handleDelete(id) {
    onDelete?.(id);
  }

  function handleUpgrade(id, version) {
    onUpgrade?.(id, version);
  }

  function handleResize(id, size) {
    onResize?.(id, size);
  }

  return (
    <>
      <style>{styles}</style>

      <section style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <DashboardHeader
          pageTitle={`Databases / ${db.name}`}
        />

        <main className="ddp-main">
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
              {instances.map((inst) => (
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
              selectedSize={selectedSize}
              setSelectedSize={setSelectedSize}
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
