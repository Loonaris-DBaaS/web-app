import Status from "./State";
//usage example:
// <InstanceContainer
//   name="Production Main"
//   version="15.3"
//   region="us-east-1"
//   usedStorage={120}
//   totalStorage={200}
//   status="RUNNING"
// />
export function InstanceContainer({ name, version, region, usedStorage, totalStorage, status }) {
  const isRunning = status === 'RUNNING';
  const storagePercentage = Math.min((usedStorage / totalStorage) * 100, 100);
 
  const actionBtn = (primary) => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '10px 0',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-label-lg-size)',
    fontWeight: 600,
    transition: 'background var(--duration-fast) var(--ease-out)',
    background: primary ? 'var(--primary)' : 'var(--surface-container-low)',
    color: primary ? 'var(--on-primary)' : 'var(--on-surface)',
  });
 
  return (
    <div style={{
      background: 'var(--surface-container-lowest)',
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--space-5)',
      boxShadow: 'var(--shadow-float)',
      minWidth: 340,
      fontFamily: 'var(--font-sans)',
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
    }}>
 
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
          <div style={{
            padding: 8,
            borderRadius: 'var(--radius-md)',
            background: isRunning ? 'var(--primary-fixed)' : 'var(--surface-container)',
            color: isRunning ? 'var(--primary)' : 'var(--on-surface-variant)',
            flexShrink: 0,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="7" ry="2"/>
              <path d="M5 5v4c0 1.1 3.1 2 7 2s7-.9 7-2V5"/>
              <path d="M5 9v4c0 1.1 3.1 2 7 2s7-.9 7-2V9"/>
              <path d="M5 13v4c0 1.1 3.1 2 7 2s7-.9 7-2v-4"/>
            </svg>
          </div>
          <div>
            <h3 style={{
              fontSize: 'var(--text-title-lg-size)',
              fontWeight: 700,
              color: 'var(--on-surface)',
              margin: 0,
              lineHeight: 'var(--text-title-lg-height)',
            }}>
              {name}
            </h3>
            <p style={{
              fontSize: 'var(--text-label-sm-size)',
              fontWeight: 600,
              color: 'var(--on-surface-variant)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              margin: 0,
            }}>
              PostgreSQL {version}
            </p>
          </div>
        </div>
        <Status status={status} />
      </div>
 
      {/* Region + Storage */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
        <span style={{ fontSize: 'var(--text-label-md-size)', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="6"/>
            <path d="M2 8h12M8 2a10 10 0 010 12M8 2a10 10 0 000 12"/>
          </svg>
          {region}
        </span>
        <span style={{ fontSize: 'var(--text-label-md-size)', fontWeight: 700, color: 'var(--on-surface)' }}>
          {usedStorage} GB / {totalStorage} GB
        </span>
      </div>
 
      {/* Progress bar */}
      <div style={{
        width: '100%', height: 5,
        background: 'var(--surface-container)',
        borderRadius: 'var(--radius-full)',
        marginBottom: 'var(--space-8)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${storagePercentage}%`,
          borderRadius: 'var(--radius-full)',
          background: isRunning ? 'var(--primary)' : 'var(--outline)',
          transition: 'width 500ms var(--ease-out)',
        }} />
      </div>
 
      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        {isRunning ? (
          <button style={actionBtn(false)}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-container)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-container-low)'}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="12" height="10" rx="1.5"/>
              <path d="M5 7h6M5 10h4"/>
            </svg>
            Connect
          </button>
        ) : (
          <button style={actionBtn(true)}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-container)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2l10 6-10 6V2z"/>
            </svg>
            Start
          </button>
        )}
 
        <button style={actionBtn(false)}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-container)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-container-low)'}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v12M2 8h12"/>
          </svg>
          Scale
        </button>
      </div>
 
    </div>
  );
};