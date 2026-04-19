import { Link } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  return (
    <header className="header">
      <div className="inner">
        <div className="left">
          <span className="logo">Loonaris</span>
          <nav className="nav">
            <a href="#">Features</a>
            <a href="#">Pricing</a>
            <a href="#">Docs</a>
          </nav>
        </div>
        <div className="actions">
          <Link className="signIn" to="/signin">
            Sign In
          </Link>
          <Link className="cta" to="/signup">
            Start for free
          </Link>
        </div>
      </div>
    </header>
  );
}
