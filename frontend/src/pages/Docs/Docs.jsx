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
        How to use the Loonaris platform
      </p>

      <h2 style={subHeadingStyle}>1. Create a Database</h2>
      <p style={paragraphStyle}>
        After signing in, you land on the <strong>Dashboard</strong>. Click the{' '}
        <strong>"Create Database"</strong> button to open the creation form.
      </p>

      <div style={cardStyle}>
        <h3 style={{ ...subHeadingStyle, marginTop: 0, fontSize: '1rem' }}>
          Form fields
        </h3>
        <ul style={listStyle}>
          <li>
            <strong>Database name</strong> — a friendly label (e.g. prod-db-01)
          </li>
          <li>
            <strong>PostgreSQL version</strong> — choose 14, 15, 16, or 17
          </li>
          <li>
            <strong>Region</strong> — deploy to eu-west-3 (Paris) or us-east-1 (N. Virginia)
          </li>
          <li>
            <strong>Size</strong> — from 0.5 vCPU / 1 GB RAM up to 16 vCPU / 64 GB RAM
          </li>
          <li>
            <strong>Storage</strong> — 10 GB to 500 GB, with estimated monthly price shown
          </li>
        </ul>
        <p style={{ ...paragraphStyle, marginBottom: 0 }}>
          Once you click <strong>Create</strong>, the cluster provisions and you are
          redirected to the database detail page.
        </p>
      </div>

      <h2 style={subHeadingStyle}>2. Connect with psql</h2>
      <p style={paragraphStyle}>
        Once the database is <strong>Running</strong>, copy the connection string
        from the top of the detail page. It looks like this:
      </p>
      <div style={codeBlockStyle}>
        postgresql://sk_live_xxx@db.loonaris.tech:5432/app?sslmode=disable
      </div>
      <p style={paragraphStyle}>
        Connect directly with the <code>psql</code> client:
      </p>
      <div style={codeBlockStyle}>
        psql "postgresql://sk_live_xxx@db.loonaris.tech:5432/app?sslmode=disable"
      </div>
      <p style={paragraphStyle}>
        Once connected, you can run any SQL query:
      </p>
      <div style={codeBlockStyle}>
        <div style={{ color: '#64748b' }}>-- Create a table</div>
        <div>
          <span style={{ color: '#818cf8' }}>loonaris=&gt; </span>
          <span style={{ color: '#34d399' }}>CREATE TABLE</span> users (
        </div>
        <div style={{ paddingLeft: 24 }}>id UUID PRIMARY KEY DEFAULT gen_random_uuid(),</div>
        <div style={{ paddingLeft: 24 }}>email TEXT NOT NULL UNIQUE,</div>
        <div style={{ paddingLeft: 24 }}>created_at TIMESTAMPTZ DEFAULT now()</div>
        <div>);</div>
        <br />
        <div style={{ color: '#64748b' }}>-- Insert a row</div>
        <div>
          <span style={{ color: '#818cf8' }}>loonaris=&gt; </span>
          <span style={{ color: '#34d399' }}>INSERT INTO</span> users (email)
        </div>
        <div style={{ paddingLeft: 16 }}>
          <span style={{ color: '#34d399' }}>VALUES</span> ('alice@example.com');
        </div>
        <br />
        <div style={{ color: '#64748b' }}>-- Query data</div>
        <div>
          <span style={{ color: '#818cf8' }}>loonaris=&gt; </span>
          <span style={{ color: '#34d399' }}>SELECT</span> * <span style={{ color: '#34d399' }}>FROM</span> users;
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ ...subHeadingStyle, marginTop: 0, fontSize: '1rem' }}>
          Connection details
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>Host</td>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>db.loonaris.tech</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>Port</td>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>5432</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>Database</td>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>app</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>Username</td>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>sk_live_...</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>SSL</td>
              <td style={{ padding: '8px 12px' }}>disabled (set <code>sslmode=require</code> on Pro tier)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 style={subHeadingStyle}>3. Monitor Queries &amp; Metrics</h2>
      <p style={paragraphStyle}>
        The database detail page gives you real-time insights into your cluster:
      </p>

      <div style={cardStyle}>
        <h3 style={{ ...subHeadingStyle, marginTop: 0, fontSize: '1rem' }}>
          Cluster Health
        </h3>
        <p style={{ ...paragraphStyle, marginBottom: 0 }}>
          Shows the current status (Running / Error / Provisioning), PostgreSQL
          version, region, storage used / total, and the connection string.
        </p>
      </div>

      <div style={cardStyle}>
        <h3 style={{ ...subHeadingStyle, marginTop: 0, fontSize: '1rem' }}>
          Metrics tab
        </h3>
        <p style={{ ...paragraphStyle, marginBottom: 0 }}>
          Displays live charts for <strong>CPU usage</strong>,{' '}
          <strong>memory usage</strong>, and <strong>active connections</strong>.
          Each chart shows the last 30 minutes of data. Hover over any point to
          see the exact value at that time.
        </p>
      </div>

      <div style={cardStyle}>
        <h3 style={{ ...subHeadingStyle, marginTop: 0, fontSize: '1rem' }}>
          Architecture tab
        </h3>
        <p style={{ ...paragraphStyle, marginBottom: 0 }}>
          A visual diagram of your cluster: one primary instance + optional read
          replicas, connection pooler (PgBouncer), automated backups to S3, and
          the connection gateway. Each component shows its real-time status
          (green = healthy, red = error).
        </p>
      </div>

      <div style={cardStyle}>
        <h3 style={{ ...subHeadingStyle, marginTop: 0, fontSize: '1rem' }}>
          Settings tab
        </h3>
        <p style={{ ...paragraphStyle, marginBottom: 0 }}>
          Scale compute and storage up or down, enable read replicas, change the
          plan (Free → Pro), or delete the database entirely.
        </p>
      </div>

      <h2 style={subHeadingStyle}>4. Dashboard Overview</h2>
      <p style={paragraphStyle}>
        The main Dashboard page lists all your databases in a table with:
      </p>
      <ul style={listStyle}>
        <li><strong>Name</strong> and status indicator (green / red dot)</li>
        <li><strong>Region</strong> where each cluster runs</li>
        <li><strong>PostgreSQL version</strong></li>
        <li><strong>Plan</strong> (Free or Pro)</li>
        <li><strong>Storage</strong> used vs total</li>
      </ul>
      <p style={paragraphStyle}>
        Click any database name to open its detail page and access the full set
        of metrics, architecture, and settings.
      </p>

      <h2 style={subHeadingStyle}>5. Need Help?</h2>
      <p style={paragraphStyle}>
        Use the <strong>Support</strong> page in your Dashboard sidebar, or
        email us at{' '}
        <a href="mailto:idaniahmed72@gmail.com" style={{ color: '#201772' }}>
          idaniahmed72@gmail.com
        </a>
        .
      </p>
    </div>
  );
}