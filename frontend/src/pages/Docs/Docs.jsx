import { Link } from 'react-router-dom';

const containerStyle = {
  maxWidth: 800,
  margin: '0 auto',
  padding: '64px 24px',
  fontFamily: "'Inter', system-ui, sans-serif",
  lineHeight: 1.7,
  color: '#334155',
};

const headingStyle = {
  fontSize: '2rem',
  fontWeight: 700,
  color: '#0f172a',
  marginBottom: 8,
};

const subHeadingStyle = {
  fontSize: '1.25rem',
  fontWeight: 600,
  color: '#0f172a',
  marginTop: 32,
  marginBottom: 12,
};

const paragraphStyle = {
  marginBottom: 16,
  fontSize: '0.95rem',
};

const listStyle = {
  marginBottom: 16,
  paddingLeft: 20,
};

const cardStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: '24px',
  marginBottom: 24,
};

const codeBlockStyle = {
  background: '#1e2022',
  color: '#e2e8f0',
  borderRadius: 10,
  padding: '20px 24px',
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontSize: '0.85rem',
  lineHeight: 1.6,
  overflowX: 'auto',
  marginBottom: 24,
};

const endpointStyle = {
  background: '#f1f0ff',
  borderLeft: '3px solid #3525cd',
  padding: '12px 16px',
  borderRadius: '0 8px 8px 0',
  marginBottom: 16,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontSize: '0.85rem',
  color: '#3525cd',
};

export default function Docs() {
  return (
    <div style={containerStyle}>
      <div style={{ marginBottom: 40 }}>
        <Link
          to="/"
          style={{
            fontSize: 14,
            color: '#64748b',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>←</span> Back to home
        </Link>
      </div>

      <h1 style={headingStyle}>Documentation</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 40 }}>
        Loonaris API &amp; Platform Reference
      </p>

      <h2 style={subHeadingStyle}>Getting Started</h2>
      <p style={paragraphStyle}>
        Loonaris provides a managed PostgreSQL platform. Create a database in seconds, connect using a standard connection string, and scale on demand.
      </p>

      <h3 style={{ ...subHeadingStyle, fontSize: '1.05rem' }}>1. Create an Account</h3>
      <p style={paragraphStyle}>
        Sign up at{' '}
        <Link to="/signup" style={{ color: '#201772' }}>
          loonaris.tech/signup
        </Link>{' '}
        and verify your email. You start on the Free tier — no credit card required.
      </p>

      <h3 style={{ ...subHeadingStyle, fontSize: '1.05rem' }}>2. Create a Database</h3>
      <p style={paragraphStyle}>
        From the Dashboard, click <strong>Create Database</strong>, choose a region and plan, and your instance is provisioned within seconds.
      </p>

      <h3 style={{ ...subHeadingStyle, fontSize: '1.05rem' }}>3. Connect</h3>
      <p style={paragraphStyle}>
        Use the connection string provided in your database dashboard:
      </p>
      <div style={codeBlockStyle}>
        <div>
          <span style={{ color: '#818cf8' }}>loonaris</span>{' '}
          <span style={{ color: '#64748b' }}>db</span>{' '}
          <span style={{ color: '#34d399' }}>connect</span>{' '}
          <span style={{ color: '#a5b4fc' }}>--conn-string</span>
        </div>
        <br />
        <div style={{ color: '#64748b' }}>
          postgresql://sk_live_xxx@db.loonaris.tech:5432/app?sslmode=disable
        </div>
      </div>
      <p style={paragraphStyle}>
        That's it. Your PostgreSQL instance is ready to accept connections.
      </p>

      <div style={cardStyle}>
        <h2 style={{ ...subHeadingStyle, marginTop: 0 }}>Quick Reference</h2>
        <ul style={listStyle}>
          <li>Default database name: <code>app</code></li>
          <li>Connection port: <code>5432</code></li>
          <li>SSL: available on Pro tier (custom domains)</li>
          <li>Connection pooling: built-in via PgBouncer on port <code>5432</code></li>
          <li>Read replicas: Pro tier only, up to 5 per database</li>
        </ul>
      </div>

      <h2 style={subHeadingStyle}>REST API</h2>
      <p style={paragraphStyle}>
        All Loonaris resources can be managed programmatically via our REST API. Authenticate using your API key from the Dashboard Settings page.
      </p>

      <h3 style={{ ...subHeadingStyle, fontSize: '1.05rem' }}>Base URL</h3>
      <div style={codeBlockStyle}>https://api.loonaris.tech/v1</div>

      <h3 style={{ ...subHeadingStyle, fontSize: '1.05rem' }}>Authentication</h3>
      <p style={paragraphStyle}>
        Include your API key in the <code>Authorization</code> header:
      </p>
      <div style={codeBlockStyle}>
        Authorization: Bearer sk_live_your_api_key_here
      </div>

      <h3 style={{ ...subHeadingStyle, fontSize: '1.05rem' }}>Endpoints</h3>

      <div style={endpointStyle}>POST /v1/databases</div>
      <p style={paragraphStyle}>
        Create a new database instance. Accepts <code>name</code>, <code>region</code>, <code>plan</code>, and <code>version</code> parameters.
      </p>
      <div style={codeBlockStyle}>
        {`{
  "name": "prod-db-01",
  "region": "eu-west-3",
  "plan": "pro",
  "version": "15.4"
}`}
      </div>

      <div style={endpointStyle}>GET /v1/databases</div>
      <p style={paragraphStyle}>List all databases in your account.</p>

      <div style={endpointStyle}>GET /v1/databases/:id</div>
      <p style={paragraphStyle}>
        Retrieve details for a specific database, including connection info and health status.
      </p>

      <div style={endpointStyle}>PATCH /v1/databases/:id</div>
      <p style={paragraphStyle}>
        Update database configuration — scale compute, add read replicas, or change the plan.
      </p>

      <div style={endpointStyle}>DELETE /v1/databases/:id</div>
      <p style={paragraphStyle}>
        Permanently delete a database and all its data. This action is irreversible.
      </p>

      <div style={cardStyle}>
        <h2 style={{ ...subHeadingStyle, marginTop: 0 }}>Response Format</h2>
        <p style={{ ...paragraphStyle, marginBottom: 0 }}>
          All API responses return JSON. Successful responses include a <code>data</code> object. Errors return a <code>error</code> object with <code>code</code> and <code>message</code> fields. Standard HTTP status codes are used (200, 201, 400, 401, 404, 429, 500).
        </p>
      </div>

      <div style={cardStyle}>
        <h2 style={{ ...subHeadingStyle, marginTop: 0 }}>Rate Limits</h2>
        <ul style={listStyle}>
          <li>Free tier: 60 requests / minute</li>
          <li>Pro tier: 300 requests / minute</li>
          <li>Rate limit headers: <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code>, <code>X-RateLimit-Reset</code></li>
        </ul>
      </div>

      <h2 style={subHeadingStyle}>CLI Reference</h2>
      <p style={paragraphStyle}>
        The Loonaris CLI lets you manage databases from your terminal.
      </p>

      <h3 style={{ ...subHeadingStyle, fontSize: '1.05rem' }}>Install</h3>
      <div style={codeBlockStyle}>npm install -g @loonaris/cli</div>

      <h3 style={{ ...subHeadingStyle, fontSize: '1.05rem' }}>Authenticate</h3>
      <div style={codeBlockStyle}>loonaris login --api-key sk_live_xxx</div>

      <h3 style={{ ...subHeadingStyle, fontSize: '1.05rem' }}>Common Commands</h3>
      <div style={codeBlockStyle}>
        <div>
          <span style={{ color: '#818cf8' }}>loonaris</span>{' '}
          <span style={{ color: '#64748b' }}>db</span>{' '}
          <span style={{ color: '#34d399' }}>create</span> --name prod-db --region eu-west-3
        </div>
        <div>
          <span style={{ color: '#818cf8' }}>loonaris</span>{' '}
          <span style={{ color: '#64748b' }}>db</span>{' '}
          <span style={{ color: '#34d399' }}>list</span>
        </div>
        <div>
          <span style={{ color: '#818cf8' }}>loonaris</span>{' '}
          <span style={{ color: '#64748b' }}>db</span>{' '}
          <span style={{ color: '#34d399' }}>scale</span> prod-db --plan pro
        </div>
        <div>
          <span style={{ color: '#818cf8' }}>loonaris</span>{' '}
          <span style={{ color: '#64748b' }}>db</span>{' '}
          <span style={{ color: '#34d399' }}>replica</span> add prod-db --region us-east-1
        </div>
        <div>
          <span style={{ color: '#818cf8' }}>loonaris</span>{' '}
          <span style={{ color: '#64748b' }}>db</span>{' '}
          <span style={{ color: '#34d399' }}>connect</span> prod-db
        </div>
      </div>

      <h2 style={subHeadingStyle}>Regions</h2>
      <p style={paragraphStyle}>
        Loonaris currently supports the following regions:
      </p>
      <div style={cardStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#64748b' }}>Region</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#64748b' }}>Code</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#64748b' }}>Location</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '8px 12px', fontSize: '0.9rem' }}>EU West</td>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.85rem' }}>eu-west-3</td>
              <td style={{ padding: '8px 12px', fontSize: '0.9rem' }}>Paris, France</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px', fontSize: '0.9rem' }}>US East</td>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.85rem' }}>us-east-1</td>
              <td style={{ padding: '8px 12px', fontSize: '0.9rem' }}>N. Virginia, USA</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 style={subHeadingStyle}>Support</h2>
      <p style={paragraphStyle}>
        Need help? Reach out to us at{' '}
        <a href="mailto:support@loonaris.tech" style={{ color: '#201772' }}>
          support@loonaris.tech
        </a>{' '}
        or use the Support page in your Dashboard.
      </p>
    </div>
  );
}