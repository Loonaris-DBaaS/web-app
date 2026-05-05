import Button from './Button';

function StatusPill({ status }) {
  const normalized = status.toLowerCase();
  const statusClass =
    normalized === 'healthy'
      ? 'is-healthy'
      : normalized === 'warning'
        ? 'is-warning'
        : 'is-neutral';

  return <span className={`status-pill ${statusClass}`}>{status}</span>;
}

export default function DatabasesTable({ rows, onViewDetails }) {
  return (
    <section className="table-card" aria-label="User databases list">
      <div className="table-wrap">
        <table className="databases-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Postgres version</th>
              <th>Region</th>
              <th>Replicas</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-empty body-md">
                  No database found for this search.
                </td>
              </tr>
            ) : (
              rows.map((db) => (
                <tr key={db.id}>
                  <td className="title-sm">{db.name}</td>
                  <td>
                    <StatusPill status={db.status} />
                  </td>
                  <td className="body-md">{db.postgresVersion}</td>
                  <td className="body-md">{db.region}</td>
                  <td className="body-md">{db.replicas}</td>
                  <td>
                    <Button
                      text="View details"
                      variant="outlined"
                      size="sm"
                      onClick={() => onViewDetails(db.id)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
