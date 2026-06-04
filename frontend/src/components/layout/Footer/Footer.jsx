import { Link, useNavigate } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  const navigate = useNavigate();

  const scrollToPricing = (e) => {
    e.preventDefault();
    if (window.location.pathname === '/') {
      document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/#pricing');
    }
  };

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-bottom">
          <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>© 2026 Loonaris. All rights reserved.</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Link to="/privacy" style={{ fontSize: 11, color: '#64748b', textDecoration: 'none' }}>
              Privacy Policy
            </Link>
            <span style={{ color: '#cbd5e1', fontSize: 11 }}>·</span>
            <Link to="/terms" style={{ fontSize: 11, color: '#64748b', textDecoration: 'none' }}>
              Terms of Service
            </Link>
            <span style={{ color: '#cbd5e1', fontSize: 11 }}>·</span>
            <Link to="/security" style={{ fontSize: 11, color: '#64748b', textDecoration: 'none' }}>
              Security
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
