export default function DashboardFooter({
  // usage example:
  // <DashboardFooter
  //   companyName="Loonaris Cloud"
  //   year={2024}
  //   links={[
  //     { label: 'Privacy Policy', href: '/privacy' },
  //     { label: 'Terms of Service', href: '/terms' },
  //     { label: 'Security', href: '/security' },
  //   ]}
  // /> 
  companyName = 'Loonaris',
  year = new Date().getFullYear(),
  links = [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
    { label: 'Security', href: '#' },
  ],
}) {
  return (
    <footer style={{
      width: '100%',
      padding: 'var(--space-10) var(--space-8)',
      background: 'var(--surface-container-lowest)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>

      {/* Links */}
      <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
        {links.map(({ label, href }) => (
          <a key={label} href={href} style={{
            fontSize: 'var(--text-label-sm-size)',
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--on-surface-variant)',
            textDecoration: 'none',
            opacity: 0.8,
            transition: `color var(--duration-fast) var(--ease-out), opacity var(--duration-fast)`,
          }}
            onMouseEnter={e => { e.target.style.color = 'var(--primary)'; e.target.style.opacity = 1; }}
            onMouseLeave={e => { e.target.style.color = 'var(--on-surface-variant)'; e.target.style.opacity = 0.8; }}
          >
            {label}
          </a>
        ))}
      </div>

      {/* Copyright */}
      <p style={{
        fontSize: '0.625rem',
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: 'var(--on-surface-variant)',
        opacity: 0.5,
        margin: 0,
      }}>
        © {year} {companyName}. All rights reserved.
      </p>

    </footer>
  );
}