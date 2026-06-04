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
        <div className="footer-grid">
          <div className="footer-brand">
            <span className="footer-logo">Loonaris</span>
            
          </div>

          <div>
            <h4 className="footer-group-title">Product</h4>
            <ul className="footer-link-list">
              <li><Link to="/dashboard/databases">Dashboard</Link></li>
              <li><a href="#pricing" onClick={scrollToPricing}>Pricing</a></li>
            </ul>
          </div>

          <div>
            <h4 className="footer-group-title">Company</h4>
            <ul className="footer-link-list">
              <li><a href="#">About</a></li>
              <li><a href="#">Blog</a></li>
              <li><a href="#">Careers</a></li>
            </ul>
          </div>

          <div>
            <h4 className="footer-group-title">Support</h4>
            <ul className="footer-link-list">
              <li><Link to="/docs">Documentation</Link></li>
              <li><a href="#">API Status</a></li>
              <li><a href="#">Contact Us</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="label-md">© 2026 Loonaris Inc. All rights reserved.</p>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <Link to="/privacy" style={{ fontSize: 13, color: '#64748b', textDecoration: 'none' }}>
              Privacy Policy
            </Link>
            <Link to="/terms" style={{ fontSize: 13, color: '#64748b', textDecoration: 'none' }}>
              Terms of Service
            </Link>
            <Link to="/security" style={{ fontSize: 13, color: '#64748b', textDecoration: 'none' }}>
              Security
            </Link>
          </div>
          <div className="footer-socials">
            <a href="#">
              <span className="material-symbols-outlined">public</span>
            </a>
            <a href="#">
              <span className="material-symbols-outlined">alternate_email</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
