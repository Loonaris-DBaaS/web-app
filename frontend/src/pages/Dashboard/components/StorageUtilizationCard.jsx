export default function StorageUtilizationCard({
  usedStorageGb,
  totalStorageGb,
  percentage,
}) {
  return (
    <article className="dashboard-card">
      <div className="dashboard-card__header">
        <p className="label-md">Storage utilization</p>
        <span className="title-sm">{percentage}%</span>
      </div>

      <div
        className="progress-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        aria-label="Storage utilization"
      >
        <span className="progress-bar__fill" style={{ width: `${percentage}%` }} />
      </div>

      <p className="body-sm dashboard-card__meta">
        {Number(usedStorageGb ?? 0).toFixed(2)} GiB used of {totalStorageGb} GiB
      </p>
    </article>
  );
}
