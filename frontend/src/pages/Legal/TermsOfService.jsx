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

export default function TermsOfService() {
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

      <h1 style={headingStyle}>Terms of Service</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 40 }}>
        Last updated: June 3, 2026
      </p>

      <p style={paragraphStyle}>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the Loonaris platform and services (&ldquo;Services&rdquo;). By accessing or using our Services, you agree to be bound by these Terms.
      </p>

      <h2 style={subHeadingStyle}>1. Acceptance of Terms</h2>
      <p style={paragraphStyle}>
        By creating an account, accessing, or using Loonaris, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you do not agree, you may not use the Services.
      </p>

      <h2 style={subHeadingStyle}>2. Account Registration</h2>
      <p style={paragraphStyle}>
        To use certain features of the Services, you must register for an account. You agree to:
      </p>
      <ul style={listStyle}>
        <li>Provide accurate, current, and complete information</li>
        <li>Maintain the security of your account credentials</li>
        <li>Promptly notify us of any unauthorized use</li>
        <li>Accept responsibility for all activities under your account</li>
      </ul>

      <h2 style={subHeadingStyle}>3. Service Description</h2>
      <p style={paragraphStyle}>
        Loonaris provides managed PostgreSQL database hosting, including automated provisioning, backups, scaling, and monitoring. We do not guarantee 100% uptime but strive to maintain high availability.
      </p>

      <h2 style={subHeadingStyle}>4. Acceptable Use</h2>
      <p style={paragraphStyle}>
        You agree not to use the Services to:
      </p>
      <ul style={listStyle}>
        <li>Violate any applicable laws or regulations</li>
        <li>Infringe upon intellectual property rights</li>
        <li>Transmit malware, viruses, or harmful code</li>
        <li>Engage in unauthorized access or data extraction</li>
        <li>Overload or disrupt our infrastructure</li>
      </ul>

      <h2 style={subHeadingStyle}>5. Data Ownership</h2>
      <p style={paragraphStyle}>
        You retain all rights to your data. We claim no ownership over the data you store in your databases. You grant us only the limited rights necessary to provide and improve the Services.
      </p>

      <h2 style={subHeadingStyle}>6. Termination</h2>
      <p style={paragraphStyle}>
        We may suspend or terminate your access to the Services at any time for violations of these Terms or for any other reason with reasonable notice. You may delete your account at any time through the dashboard.
      </p>

      <h2 style={subHeadingStyle}>7. Limitation of Liability</h2>
      <p style={paragraphStyle}>
        To the maximum extent permitted by law, Loonaris shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or relating to your use of the Services.
      </p>

      <h2 style={subHeadingStyle}>8. Governing Law</h2>
      <p style={paragraphStyle}>
        These Terms shall be governed by and construed in accordance with the laws of France, without regard to its conflict of law provisions.
      </p>

      <h2 style={subHeadingStyle}>9. Changes to Terms</h2>
      <p style={paragraphStyle}>
        We may modify these Terms at any time. We will provide notice of significant changes via email or through the platform. Continued use after changes constitutes acceptance.
      </p>

      <h2 style={subHeadingStyle}>10. Contact</h2>
      <p style={paragraphStyle}>
        For questions about these Terms, contact us at{' '}
        <a href="mailto:idaniahmed72@gmail.com" style={{ color: '#201772' }}>
          idaniahmed72@gmail.com
        </a>
        .
      </p>
    </div>
  );
}
