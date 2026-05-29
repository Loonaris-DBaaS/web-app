import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './Signin.css';

export default function SignIn() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="signin">
      <div className="signin__brand">
        <div className="signin__brand-icon">
          <span className="material-symbols-outlined">cloud</span>
        </div>
        <h1 className="display-sm">Loonaris</h1>
      </div>

      <div className="signin__card floating">
        <div className="signin__card-header">
          <h2 className="title-lg">Sign in to your account</h2>
          <p className="body-md">Enter your details to access your databases.</p>
        </div>

        <form className="signin__form" onSubmit={handleSubmit}>
          {error && <p className="signin__error body-sm">{error}</p>}

          <div className="signin__field">
            <label htmlFor="email" className="signin__label label-md">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="name@company.com"
              className="signin__input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="signin__field">
            <div className="signin__field-row">
              <label htmlFor="password" className="signin__label label-md">
                Password
              </label>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="signin__input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="signin__btn-primary gradient-primary" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in to Loonaris'}
          </button>
        </form>

        <div className="signin__footer">
          <p className="body-md">
            Don't have an account?{' '}
            <Link to="/signup" className="signin__link">
              Sign Up
            </Link>
          </p>
          <div className="signin__footer-links">
            <a href="#" className="signin__footer-link label-sm">Privacy Policy</a>
            <span className="signin__dot" />
            <a href="#" className="signin__footer-link label-sm">Security</a>
            <span className="signin__dot" />
            <a href="#" className="signin__footer-link label-sm">Support</a>
          </div>
        </div>
      </div>
    </div>
  );
}
