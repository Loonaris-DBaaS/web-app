const TABS = ['Connect', 'Metrics', 'Replicas', 'Settings'];

export default function DatabaseTabNavigation({ activeTab, onTabChange }) {
  return (
    <nav
      style={{
        borderBottom: '1px solid var(--outline-variant)',
        display: 'flex',
        gap: 'var(--space-2)',
        overflowX: 'auto',
      }}
      aria-label="Database detail tabs"
    >
      {TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onTabChange(tab)}
          style={{
            border: 'none',
            background: 'transparent',
            color: activeTab === tab ? 'var(--primary)' : 'var(--on-surface-variant)',
            padding: 'var(--space-3) var(--space-4)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-body-md-size)',
            lineHeight: 'var(--text-body-md-height)',
            cursor: 'pointer',
            borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
            fontWeight: activeTab === tab ? 600 : 400,
            whiteSpace: 'nowrap',
          }}
        >
          {tab}
        </button>
      ))}
    </nav>
  );
}
