import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardHeader from '../../components/ui/DashboardHeader';
import CreateDatabaseForm from '../../components/ui/CreateDatabaseForm';
import StorageUtilizationCard from './components/StorageUtilizationCard';
import ClusterHealthCard from './components/ClusterHealthCard';
import DatabasesTable from './components/DatabasesTable';

const databases = [
	{
		id: 'sales-prod',
		name: 'sales-production',
		status: 'Healthy',
		postgresVersion: '16.4',
		region: 'eu-west-3',
		replicas: 2,
		storageUsedGb: 342,
	},
	{
		id: 'billing-staging',
		name: 'billing-staging',
		status: 'Warning',
		postgresVersion: '15.8',
		region: 'eu-central-1',
		replicas: 1,
		storageUsedGb: 118,
	},
	{
		id: 'analytics-core',
		name: 'analytics-core',
		status: 'Healthy',
		postgresVersion: '16.2',
		region: 'us-east-1',
		replicas: 3,
		storageUsedGb: 512,
	},
	{
		id: 'support-archive',
		name: 'support-archive',
		status: 'Provisioning',
		postgresVersion: '14.12',
		region: 'eu-west-1',
		replicas: 0,
		storageUsedGb: 26,
	},
];

const totalStorageGb = 1200;

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

export default function Database() {
	const [query, setQuery] = useState('');
	const [showCreateForm, setShowCreateForm] = useState(false);
	const navigate = useNavigate();

	const filteredDatabases = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		if (!normalized) {
			return databases;
		}

		return databases.filter((db) => {
			return (
				db.name.toLowerCase().includes(normalized) ||
				db.region.toLowerCase().includes(normalized) ||
				db.postgresVersion.toLowerCase().includes(normalized)
			);
		});
	}, [query]);

	const usedStorageGb = databases.reduce((acc, db) => acc + db.storageUsedGb, 0);
	const storagePercent = Math.round((usedStorageGb / totalStorageGb) * 100);
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

				<div className="databases-stats-grid">
					<StorageUtilizationCard
						usedStorageGb={usedStorageGb}
						totalStorageGb={totalStorageGb}
						percentage={storagePercent}
					/>

					<ClusterHealthCard
						healthyClusters={healthyClusters}
						totalClusters={databases.length}
					/>
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
						onChange={(event) => setQuery(event.target.value)}
					/>
				</div>

				<DatabasesTable
					rows={filteredDatabases}
					onViewDetails={(databaseId) => navigate(`/dashboard/databases/${databaseId}`)}
				/>
			</section>

			{showCreateForm && (
				<div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) setShowCreateForm(false); }}>
					<CreateDatabaseForm
						onSubmit={() => setShowCreateForm(false)}
						onCancel={() => setShowCreateForm(false)}
					/>
				</div>
			)}
		</>
	);
}
