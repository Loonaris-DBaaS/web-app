import { useState } from 'react';
//usage example:
// <ConnectionParameters
//   connectionString="postgres://root:••••••••••••@db.loonaris.io:5432/production_main"
//   mode="Standard"
//   modes={['Standard','URI','JDBC']}
//   onModeChange={(m) => console.log(m)}
// />
export default function ConnectionParameters({
  connectionString = 'postgres://root:••••••••••••@db.loonaris.io:5432/production_main',
  connections,
  mode = 'Standard',
  modes = ['Standard', 'URI', 'JDBC'],
  onModeChange,
  title = 'Connection Parameters',
  description = 'Use this connection string to connect your application. Keep your credentials secure and never share them in public repositories.',
  showModeTabs = true,
}) {
  const initialConnections =
    Array.isArray(connections) && connections.length
      ? connections
      : [{ key: 'connection', label: 'Connection', value: connectionString }];

  const [copiedKey, setCopiedKey] = useState('');
  const [activeMode, setActiveMode] = useState(mode);

  const handleCopy = async (value, key) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 2000);
    } catch {
      setCopiedKey('');
    }
  };

  const handleMode = (selectedMode) => {
    setActiveMode(selectedMode);
    onModeChange?.(selectedMode);
  };

  return (
    <div
      style={{
        background: 'var(--surface-container-lowest)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            border: '2px solid var(--primary)',
            borderRadius: 'var(--radius-xs)',
            padding: '5px 12px',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-label-sm-size)',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--on-surface)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {title}
          </span>
        </div>

        {showModeTabs && (
          <div
            style={{
              display: 'flex',
              background: 'var(--surface-container-low)',
              borderRadius: 'var(--radius-full)',
              padding: '3px',
              gap: 2,
            }}
          >
            {modes.map((m) => (
              <button
                key={m}
                onClick={() => handleMode(m)}
                style={{
                  padding: '4px 14px',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-label-md-size)',
                  fontWeight: 500,
                  transition: 'background 150ms, color 150ms',
                  background: activeMode === m ? 'var(--primary-fixed)' : 'transparent',
                  color: activeMode === m ? 'var(--primary)' : 'var(--on-surface-variant)',
                }}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {initialConnections.map((entry) => {
        const entryKey = entry.key || entry.label || entry.value;
        const copied = copiedKey === entryKey;
        return (
          <div
            key={entryKey}
            style={{
              background: 'var(--surface-container-low)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-4)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-body-sm-size)',
                color: 'var(--on-surface)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                letterSpacing: '0.01em',
              }}
            >
              {entry.label ? `${entry.label}: ` : ''}
              {entry.value}
            </span>

            <button
              onClick={() => handleCopy(entry.value, entryKey)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: copied ? 'var(--success)' : 'var(--primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-label-md-size)',
                fontWeight: 500,
                flexShrink: 0,
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                transition: 'color 150ms, background 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--primary-fixed)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
              }}
            >
              {copied ? (
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 8l4 4 8-8" />
                </svg>
              ) : (
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="5" y="5" width="9" height="9" rx="1.5" />
                  <path d="M3 11H2a1 1 0 01-1-1V2a1 1 0 011-1h8a1 1 0 011 1v1" />
                </svg>
              )}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        );
      })}

      <p
        style={{
          fontSize: 'var(--text-body-sm-size)',
          lineHeight: 'var(--text-body-md-height)',
          color: 'var(--on-surface-variant)',
          margin: 0,
        }}
      >
        {description}
      </p>
    </div>
  );
}
