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

export default function Security() {
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

      <h1 style={headingStyle}>Security</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 40 }}>
        Last updated: June 3, 2026
      </p>

      <p style={paragraphStyle}>
        At Loonaris, security is foundational to everything we build. We employ multiple layers of protection to ensure your data remains safe, confidential, and available.
      </p>

      <div style={cardStyle}>
        <h2 style={{ ...subHeadingStyle, marginTop: 0 }}>Infrastructure Security</h2>
        <ul style={listStyle}>
          <li>All clusters run in isolated Kubernetes namespaces</li>
          <li>Network policies restrict inter-pod communication</li>
          <li>Private subnets — databases are never exposed to the public internet</li>
          <li>DDoS protection at the edge (ALB + AWS Shield)</li>
          <li>Regular OS and dependency patching</li>
        </ul>
      </div>

      <div style={cardStyle}>
        <h2 style={{ ...subHeadingStyle, marginTop: 0 }}>Data Protection</h2>
        <ul style={listStyle}>
          <li>Encryption at rest using AES-256</li>
          <li>TLS 1.3 for all data in transit</li>
          <li>Automated daily backups with point-in-time recovery</li>
          <li>Backups stored in encrypted S3 buckets with 30-day retention</li>
          <li>Connection pooling via PgBouncer with TLS termination</li>
        </ul>
      </div>

      <div style={cardStyle}>
        <h2 style={{ ...subHeadingStyle, marginTop: 0 }}>Access Control</h2>
        <ul style={listStyle}>
          <li>API keys are cryptographically generated and never stored in plaintext</li>
          <li>JWT-based authentication with short-lived access tokens</li>
          <li>Role-based access control (RBAC) for admin operations</li>
          <li>Audit logging for all destructive actions</li>
          <li>2FA support for admin panel access</li>
        </ul>
      </div>

      <div style={cardStyle}>
        <h2 style={{ ...subHeadingStyle, marginTop: 0 }}>Compliance</h2>
        <ul style={listStyle}>
          <li>GDPR compliant — data residency in EU (Paris region)</li>
          <li>SOC 2 Type II preparation in progress</li>
          <li>Right to data portability and deletion</li>
          <li>Data Processing Agreements available upon request</li>
        </ul>
      </div>

      <h2 style={subHeadingStyle}>Reporting Vulnerabilities</h2>
      <p style={paragraphStyle}>
        We encourage responsible disclosure. If you believe you have discovered a security vulnerability, please report it to{' '}
        <a href="mailto:security@loonaris.tech" style={{ color: '#201772' }}>
          security@loonaris.tech
        </a>
        . We will investigate promptly and keep you informed.
      </p>

      <h2 style={subHeadingStyle}>Security Certifications</h2>
      <p style={paragraphStyle}>
        We are actively pursuing SOC 2 Type II certification and ISO 27001 compliance. If you need a copy of our security questionnaire or compliance documents, please contact us.
      </p>

      <h2 style={subHeadingStyle}>Contact</h2>
      <p style={paragraphStyle}>
        For security-related inquiries, email{' '}
        <a href="mailto:security@loonaris.tech" style={{ color: '#201772' }}>
          security@loonaris.tech
        </a>
        .
      </p>
    </div>
  );
}
