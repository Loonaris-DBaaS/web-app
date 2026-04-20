import React from 'react';

/**
 * Button
 * Props: text, onClick, variant, size, width, icon, disabled, loading
 * variant: 'primary'(default) | 'secondary' | 'outlined' | 'ghost' | 'danger'
 * size:    'sm' | 'md'(default) | 'lg'
 */
export default function Button({
  text = 'Button',
  onClick,
  variant = 'primary',
  size = 'md',
  width = 'auto',
  icon,
  disabled = false,
  loading = false,
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    border: 'none',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.45 : 1,
    transition: 'background 120ms, transform 120ms',
    outline: 'none',
    width,
  };

  const sizes = {
    sm: { padding: '0.5rem 0.875rem', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)' },
    md: { padding: '0.625rem 1.25rem', fontSize: '0.875rem', borderRadius: 'var(--radius-md)' },
    lg: { padding: '0.875rem 1.75rem', fontSize: '1rem',    borderRadius: 'var(--radius-md)' },
  };

  const variants = {
    primary:   { background: 'var(--primary)',                color: 'var(--on-primary)' },
    secondary: { background: 'var(--surface-container-high)', color: 'var(--on-surface)' },
    outlined:  { background: 'transparent', border: '1.5px solid var(--outline-variant)', color: 'var(--primary)' },
    ghost:     { background: 'transparent', color: 'var(--primary)' },
    danger:    { background: 'var(--error)', color: '#fff' },
  };

  const style = { ...base, ...sizes[size], ...variants[variant] };

  return (
    <button style={style} onClick={onClick} disabled={disabled || loading}>
      {loading
        ? <span style={{ width: '1em', height: '1em', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'currentColor', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
        : icon && <span style={{ display: 'flex', width: '1em', height: '1em' }}>{icon}</span>
      }
      {text}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}