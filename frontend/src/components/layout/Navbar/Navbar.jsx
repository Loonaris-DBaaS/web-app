import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  const navigate = useNavigate();

  const scrollTo = (id) => (e) => {
    e.preventDefault();
    if (window.location.pathname === '/') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/#' + id);
    }
  };

  return (
    <header className="header">
      <div className="inner">
        <div className="left">
          <span className="logo">Loonaris</span>
          <nav className="nav">
            <a href="#features" onClick={scrollTo('features')}>Features</a>
            <a href="#pricing" onClick={scrollTo('pricing')}>Pricing</a>
            <Link to="/docs">Docs</Link>
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
