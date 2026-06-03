import React from 'react';
import Button from '../../../components/ui/Button';

function regionLabel(code) {
  const map = {
    'eu-west-3': 'Paris',
    'eu-west-1': 'Ireland',
    'eu-central-1': 'Frankfurt',
    'us-east-1': 'N. Virginia',
    'us-west-2': 'Oregon',
  };
  return map[code] ?? code;
}

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

function StorageHighlight({ used, total }) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  let color = '#16a34a'; // green
  if (pct > 80) color = '#dc2626'; // red
  else if (pct > 60) color = '#d97706'; // orange

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: 60,
          height: 6,
          background: '#e2e8f0',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(pct, 100)}%`,
            height: '100%',
            background: color,
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, whiteSpace: 'nowrap' }}>
        {used.toFixed(1)} / {total} GB
      </span>
    </div>
  );
}

export default function DatabasesTable({ rows, onViewDetails, onViewMetrics, onDelete }) {
  const [deletingId, setDeletingId] = React.useState(null);

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete database "${name}"? This cannot be undone and all data will be lost.`)) {
      return;
    }
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  }

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
              <th>Storage</th>
              <th>Instances</th>
              <th style={{ width: '1%', whiteSpace: 'nowrap' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-empty body-md">
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
                  <td className="body-md">{regionLabel(db.region)}</td>
                  <td>
                    <StorageHighlight used={db.storageUsedGb} total={db.provisionedStorageGb} />
                  </td>
                  <td className="body-md">{db.instances}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <Button
                        text="View"
                        variant="outlined"
                        size="sm"
                        onClick={() => onViewDetails(db.id)}
                      />
                      <Button
                        text="Metrics"
                        variant="outlined"
                        size="sm"
                        onClick={() => onViewMetrics(db.id)}
                      />
                      <button
                        type="button"
                        title="Delete database"
                        disabled={deletingId === db.id}
                        onClick={() => handleDelete(db.id, db.name)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '6px 10px',
                          border: '1px solid var(--error-container, #fee2e2)',
                          borderRadius: 'var(--radius-sm, 6px)',
                          background: 'var(--error-container, #fee2e2)',
                          color: 'var(--error, #dc2626)',
                          cursor: deletingId === db.id ? 'default' : 'pointer',
                          fontSize: '12px',
                          fontWeight: 600,
                          fontFamily: 'var(--font-sans)',
                          opacity: deletingId === db.id ? 0.6 : 1,
                        }}
                      >
                        {deletingId === db.id ? '…' : 'Delete'}
                      </button>
                    </div>
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
