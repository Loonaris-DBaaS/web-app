import { useState } from 'react';
import Button from '../../../components/ui/Button';
import { REGIONS, DEPLOYMENT_OPTIONS, SIZE_DEFAULTS, DEPLOYMENT_OPTION_MAP } from '../../../constants/database';


const TARGET_VERSIONS = [
  { value: '14', label: 'PostgreSQL 15.2 (Current)'     },
  { value: '15', label: 'PostgreSQL 16.1 (Recommended)' },
  { value: '16', label: 'PostgreSQL 17.0 (Stable)'      },
  { value: '17', label: 'PostgreSQL 18.0 (Latest)'      },
];

const card = {
  background: 'var(--surface-container-lowest)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-float)',
  padding: 'var(--space-8)',
  border: '1px solid rgba(0,0,0,0.05)',
};

const inputStyle = {
  width: '100%',
  background: 'var(--surface-container-low)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  padding: 'var(--space-3) var(--space-4)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-body-md-size)',
  color: 'var(--on-surface)',
  fontWeight: 500,
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.625rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--on-surface-variant)',
  marginBottom: 'var(--space-3)',
};

function SectionHeader({ icon, title, description }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
      <div style={{
        padding: 'var(--space-3)',
        background: 'var(--primary-fixed)',
        color: 'var(--primary)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div>
        <h4 style={{ fontSize: 'var(--text-title-md-size)', fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>{title}</h4>
        <p style={{ fontSize: 'var(--text-body-sm-size)', color: 'var(--on-surface-variant)', margin: 0 }}>{description}</p>
      </div>
    </div>
  );
}

export default function DatabaseSettingsTab({
  database,
  dbNameInput,
  setDbNameInput,
  targetVersion,
  setTargetVersion,
  onResize,
  onUpgrade,
  onDelete,
}) {
  const sizeDefaults = SIZE_DEFAULTS[database.size] || SIZE_DEFAULTS.pro;

  const [cpu, setCpu]                       = useState(sizeDefaults.cpu);
  const [ram, setRam]                       = useState(sizeDefaults.ram);
  const [storage, setStorage]               = useState(sizeDefaults.storage);
  const [region, setRegion]                 = useState(database.region || 'us-east-1');
  const [deploymentOption, setDeployment]   = useState(database.ha ? 'multi-az-cluster' : 'single-az-instance');
  const [readReplicas, setReadReplicas]     = useState(String(database.readReplicas ?? 1));
  const [backup, setBackup]                 = useState(database.backup ?? true);
  const [maxConnections, setMaxConnections] = useState(100);
  const [autoscale, setAutoscale]           = useState(database.autoscale ?? false);
  const [deleteText, setDeleteText]         = useState('');

  const canDelete = deleteText === database.name;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '900px' }}>

      {/* ── Modify Database ─────────────────────────────────────────────── */}
      <article style={card}>
        <SectionHeader
          icon="storage"
          title="Modify Database"
          description="Scale your instance size and manage connection parameters."
        />

        {/* Region + DB Name */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          <div>
            <label style={labelStyle} htmlFor="mod-region">Region</label>
            <select
              id="mod-region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              style={{
                ...inputStyle,
                appearance: 'none',
                cursor: 'pointer',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2342474e' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                paddingRight: '36px',
              }}
            >
              {REGIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="ddp-db-name">Database Name</label>
            <input
              id="ddp-db-name"
              type="text"
              value={dbNameInput}
              onChange={(e) => setDbNameInput(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* CPU / RAM / Storage / Max Connections */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <div>
            <label style={labelStyle} htmlFor="mod-cpu">vCPU</label>
            <input id="mod-cpu" type="number" min="1" max="64" value={cpu} onChange={(e) => setCpu(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="mod-ram">RAM (GB)</label>
            <input id="mod-ram" type="number" min="1" max="512" value={ram} onChange={(e) => setRam(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="mod-storage">Storage (GB)</label>
            <input id="mod-storage" type="number" min="10" max="65536" step="10" value={storage} onChange={(e) => setStorage(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="ddp-max-conn">Max Connections</label>
            <input id="ddp-max-conn" type="number" min="10" value={maxConnections} onChange={(e) => setMaxConnections(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Storage Autoscale */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <span style={labelStyle}>Storage Autoscale</span>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-4)',
            background: 'var(--surface-container-low)',
            borderRadius: 'var(--radius-sm)',
          }}>
            <span style={{ fontSize: 'var(--text-body-sm-size)', fontWeight: 500 }}>Enable automatic disk growth</span>
            <button
              type="button"
              onClick={() => setAutoscale((v) => !v)}
              style={{
                position: 'relative',
                display: 'inline-flex',
                height: '24px',
                width: '44px',
                alignItems: 'center',
                borderRadius: 'var(--radius-full)',
                background: autoscale ? 'var(--primary)' : 'var(--outline-variant)',
                border: 'none',
                cursor: 'pointer',
                transition: 'background var(--duration-base) var(--ease-out)',
                flexShrink: 0,
              }}
              aria-checked={autoscale}
              role="switch"
            >
              <span style={{
                display: 'inline-block',
                height: '16px',
                width: '16px',
                borderRadius: '50%',
                background: '#fff',
                transform: autoscale ? 'translateX(24px)' : 'translateX(4px)',
                transition: 'transform var(--duration-base) var(--ease-out)',
              }} />
            </button>
          </div>
        </div>

        {/* Deployment Option */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <span style={labelStyle}>Deployment Option</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
            {DEPLOYMENT_OPTIONS.map((opt) => {
              const active = deploymentOption === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDeployment(opt.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: 'var(--space-3)',
                    border: `2px solid ${active ? 'var(--primary-container)' : 'var(--outline-variant)'}`,
                    borderRadius: 'var(--radius-md)',
                    background: active ? 'var(--primary-fixed)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all var(--duration-fast) var(--ease-out)',
                    textAlign: 'left',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: active ? 'var(--primary)' : 'var(--on-surface)', marginBottom: '2px' }}>{opt.name}</span>
                  <span style={{ fontSize: '0.625rem', color: 'var(--on-surface-variant)', lineHeight: 1.5, marginBottom: '4px' }}>{opt.description}</span>
                  <span style={{ fontSize: '0.625rem', fontWeight: 600, color: active ? 'var(--primary-container)' : 'var(--outline)' }}>{opt.details}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Read Replicas — only for multi-az-cluster */}
        {deploymentOption === 'multi-az-cluster' && (
          <div style={{ marginBottom: 'var(--space-6)', maxWidth: '220px' }}>
            <label style={labelStyle} htmlFor="mod-replicas">Read Replicas (max 3)</label>
            <select
              id="mod-replicas"
              value={readReplicas}
              onChange={(e) => setReadReplicas(e.target.value)}
              style={{
                ...inputStyle,
                appearance: 'none',
                cursor: 'pointer',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2342474e' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                paddingRight: '36px',
              }}
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </div>
        )}

        {/* Backup toggle */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <span style={labelStyle}>Backups</span>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-4)',
            background: 'var(--surface-container-low)',
            borderRadius: 'var(--radius-sm)',
          }}>
            <div>
              <p style={{ fontSize: 'var(--text-body-sm-size)', fontWeight: 600, margin: '0 0 2px 0', color: 'var(--on-surface)' }}>Automated S3 Backups</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', margin: 0 }}>Daily point-in-time backups with 30-day retention via Barman. +$5/mo.</p>
            </div>
            <button
              type="button"
              onClick={() => setBackup((v) => !v)}
              style={{
                position: 'relative',
                display: 'inline-flex',
                height: '24px',
                width: '44px',
                alignItems: 'center',
                borderRadius: 'var(--radius-full)',
                background: backup ? 'var(--primary)' : 'var(--outline-variant)',
                border: 'none',
                cursor: 'pointer',
                transition: 'background var(--duration-base) var(--ease-out)',
                flexShrink: 0,
              }}
              aria-checked={backup}
              role="switch"
            >
              <span style={{
                display: 'inline-block',
                height: '16px',
                width: '16px',
                borderRadius: '50%',
                background: '#fff',
                transform: backup ? 'translateX(24px)' : 'translateX(4px)',
                transition: 'transform var(--duration-base) var(--ease-out)',
              }} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            text="Apply Changes"
            variant="primary"
            onClick={() => onResize(database.id, { cpu, ram, storage, region, deploymentOption: DEPLOYMENT_OPTION_MAP[deploymentOption], readReplicas: deploymentOption === 'multi-az-cluster' ? Number(readReplicas) : 0, backup, autoscale, maxConnections, name: dbNameInput })}
          />
        </div>
      </article>

      {/* ── Upgrade PG Version ──────────────────────────────────────────── */}
      <article style={card}>
        <SectionHeader
          icon="system_update"
          title="Upgrade PG Version"
          description="Safely upgrade your PostgreSQL engine version."
        />

        <div style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div>
            <label style={labelStyle} htmlFor="ddp-target-version">Target Version</label>
            <select
              id="ddp-target-version"
              value={targetVersion}
              onChange={(e) => setTargetVersion(e.target.value)}
              style={{
                ...inputStyle,
                appearance: 'none',
                cursor: 'pointer',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2342474e' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                paddingRight: '36px',
              }}
            >
              {TARGET_VERSIONS.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-4)',
            padding: 'var(--space-4)',
            background: 'var(--warning-container)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid #fde68a',
          }}>
            <span
              className="material-symbols-outlined"
              style={{ color: 'var(--warning)', marginTop: '2px', fontSize: '20px', flexShrink: 0 }}
            >
              warning
            </span>
            <div>
              <p style={{ fontSize: 'var(--text-body-sm-size)', fontWeight: 700, color: '#92400e', margin: '0 0 4px 0' }}>
                Rolling Restart Required
              </p>
              <p style={{ fontSize: '0.7rem', color: 'var(--on-warning-container)', lineHeight: '1.5', margin: 0 }}>
                Upgrading major versions will trigger a rolling restart. Your instance may experience
                up to 60 seconds of read-only state during the switchover.
              </p>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-8)' }}>
          <Button
            text="Schedule Upgrade"
            variant="outlined"
            onClick={() => onUpgrade(database.id, targetVersion)}
          />
        </div>
      </article>

      {/* ── Danger Zone ─────────────────────────────────────────────────── */}
      <article style={{
        background: 'var(--error-container)',
        border: '1px solid rgba(220,38,38,0.15)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-8)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', color: 'var(--error)' }}>
            <span className="material-symbols-outlined">report</span>
            <h4 style={{ fontSize: 'var(--text-title-md-size)', fontWeight: 700, margin: 0 }}>Danger Zone</h4>
          </div>

          {deleteText === '' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-6)',
              }}>
                <div>
                  <p style={{ fontSize: 'var(--text-body-md-size)', fontWeight: 600, color: 'var(--on-surface)', margin: '0 0 4px 0' }}>
                    Delete this database
                  </p>
                  <p style={{ fontSize: 'var(--text-body-sm-size)', color: 'var(--on-surface-variant)', maxWidth: '420px', margin: 0 }}>
                    Once you delete a database, there is no going back. Please be certain.
                    All data and backups will be immediately purged.
                  </p>
                </div>
                <Button
                  text="Delete Database"
                  variant="danger"
                  onClick={() => setDeleteText(' ')}
                />
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              padding: 'var(--space-4)',
              background: 'var(--surface-container-lowest)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(220,38,38,0.2)',
              maxWidth: '480px',
            }}>
              <p style={{ fontSize: 'var(--text-body-sm-size)', margin: 0 }}>
                Type <strong>{database.name}</strong> to confirm deletion.
              </p>
              <input
                type="text"
                value={deleteText.trim() === '' ? '' : deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder={database.name}
                style={{ ...inputStyle, background: 'var(--surface-container-low)' }}
              />
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button text="Cancel" variant="ghost" onClick={() => setDeleteText('')} />
                <Button
                  text="Confirm Deletion"
                  variant="danger"
                  onClick={() => { if (canDelete) onDelete(database.id); }}
                  disabled={!canDelete}
                />
              </div>
            </div>
          )}
        </div>

        {/* Decorative background icons */}
        <span
          className="material-symbols-outlined"
          style={{ position: 'absolute', bottom: '-32px', right: '-32px', fontSize: '160px', opacity: 0.05, color: 'var(--error)', pointerEvents: 'none', userSelect: 'none' }}
          aria-hidden="true"
        >
          delete_forever
        </span>
        <span
          className="material-symbols-outlined"
          style={{ position: 'absolute', bottom: '-48px', right: '96px', fontSize: '192px', opacity: 0.05, color: 'var(--error)', pointerEvents: 'none', userSelect: 'none' }}
          aria-hidden="true"
        >
          database
        </span>
      </article>

    </div>
  );
}
