import { useRouteError, Link } from 'react-router-dom';

export default function ErrorPage() {
  const error = useRouteError();
  const message = error?.statusText || error?.message || 'An unexpected error occurred.';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Something went wrong</h1>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>{message}</p>
      <Link
        to="/"
        style={{
          padding: '0.75rem 1.5rem',
          background: 'linear-gradient(135deg, #201772, #473ca9)',
          color: '#fff',
          borderRadius: '0.75rem',
          textDecoration: 'none',
          fontWeight: 600,
        }}
      >
        Back to Home
      </Link>
    </div>
  );
}
