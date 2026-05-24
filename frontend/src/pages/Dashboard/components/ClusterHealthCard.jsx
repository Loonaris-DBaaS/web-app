export default function ClusterHealthCard({ healthyClusters, totalClusters }) {
  const ratio = `${healthyClusters}/${totalClusters}`;
  const isHealthy = healthyClusters === totalClusters;

  return (
    <article className="dashboard-card">
      <div className="dashboard-card__header">
        <p className="label-md">Cluster health</p>
        <span className={`health-badge ${isHealthy ? 'is-healthy' : 'is-warning'}`}>
          {isHealthy ? 'Stable' : 'Attention'}
        </span>
      </div>

      <p className="display-sm dashboard-card__value">{ratio}</p>
      <p className="body-sm dashboard-card__meta">Healthy clusters across your account</p>
    </article>
  );
}
