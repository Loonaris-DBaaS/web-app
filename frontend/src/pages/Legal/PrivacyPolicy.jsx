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

export default function PrivacyPolicy() {
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

      <h1 style={headingStyle}>Privacy Policy</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 40 }}>
        Last updated: June 3, 2026
      </p>

      <p style={paragraphStyle}>
        Loonaris (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our managed PostgreSQL platform.
      </p>

      <h2 style={subHeadingStyle}>1. Information We Collect</h2>
      <p style={paragraphStyle}>
        We collect information that you provide directly to us, such as:
      </p>
      <ul style={listStyle}>
        <li>Account information (name, email, company)</li>
        <li>Billing and payment information</li>
        <li>Database configuration and usage data</li>
        <li>Support inquiries and communications</li>
      </ul>

      <h2 style={subHeadingStyle}>2. How We Use Your Information</h2>
      <p style={paragraphStyle}>
        We use the information we collect to:
      </p>
      <ul style={listStyle}>
        <li>Provide, maintain, and improve our services</li>
        <li>Process transactions and send related information</li>
        <li>Send technical notices, updates, and security alerts</li>
        <li>Respond to your comments, questions, and requests</li>
        <li>Monitor and analyze trends, usage, and activities</li>
      </ul>

      <h2 style={subHeadingStyle}>3. Data Security</h2>
      <p style={paragraphStyle}>
        We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. This includes encryption at rest and in transit, access controls, and regular security audits.
      </p>

      <h2 style={subHeadingStyle}>4. Data Retention</h2>
      <p style={paragraphStyle}>
        We retain your personal data for as long as necessary to fulfill the purposes for which we collected it, including for the purposes of satisfying any legal, accounting, or reporting requirements.
      </p>

      <h2 style={subHeadingStyle}>5. Your Rights</h2>
      <p style={paragraphStyle}>
        Depending on your location, you may have rights regarding your personal data, including the right to access, correct, delete, or restrict processing of your data. Contact us at privacy@loonaris.tech to exercise these rights.
      </p>

      <h2 style={subHeadingStyle}>6. Changes to This Policy</h2>
      <p style={paragraphStyle}>
        We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &ldquo;Last updated&rdquo; date.
      </p>

      <h2 style={subHeadingStyle}>7. Contact Us</h2>
      <p style={paragraphStyle}>
        If you have any questions about this Privacy Policy, please contact us at{' '}
        <a href="mailto:privacy@loonaris.tech" style={{ color: '#201772' }}>
          privacy@loonaris.tech
        </a>
        .
      </p>
    </div>
  );
}
