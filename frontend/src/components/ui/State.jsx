const State = ({ status }) => {
  // usage example:
  // <State status="RUNNING" />
  const isRunning = status === 'RUNNING';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--text-label-sm-size)',
        fontWeight: 700,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        background: isRunning ? 'var(--success-container)' : 'var(--surface-container)',
        color: isRunning ? 'var(--on-success-container)' : 'var(--on-surface-variant)',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 'var(--radius-full)',
          background: isRunning ? 'var(--success)' : 'var(--outline)',
          flexShrink: 0,
        }}
      />
      {status}
    </div>
  );
};
export default State;
