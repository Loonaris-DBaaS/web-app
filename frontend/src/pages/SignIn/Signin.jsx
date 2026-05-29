import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './Signin.css';

export default function SignIn() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="signin">
      {/* Brand Header */}
      <div className="signin__brand">
        <div className="signin__brand-icon">
          <span className="material-symbols-outlined">cloud</span>
        </div>
        <h1 className="display-sm">Loonaris</h1>
      </div>

      {/* Glass Card */}
      <div className="signin__card floating">
        <div className="signin__card-header">
          <h2 className="title-lg">Sign in to your account</h2>
          <p className="body-md">Enter your details to access your databases.</p>
        </div>

        {error && (
          <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <form className="signin__form" onSubmit={handleSubmit}>
          {/* Email */}
          <div className="signin__field">
            <label htmlFor="email" className="signin__label label-md">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="name@company.com"
              className="signin__input"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </div>

          {/* Password */}
          <div className="signin__field">
            <div className="signin__field-row">
              <label htmlFor="password" className="signin__label label-md">
                Password
              </label>
              <a href="#" className="signin__forgot body-sm">
                Forgot?
              </a>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              className="signin__input"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
            />
          </div>

          {/* Submit */}
          <button type="submit" className="signin__btn-primary gradient-primary" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in to Loonaris'}
          </button>
        </form>

        {/* Divider */}
        <div className="signin__divider">
          <span className="signin__divider-line" />
          <span className="signin__divider-text label-sm">or continue with</span>
          <span className="signin__divider-line" />
        </div>

        {/* GitHub */}
        <button type="button" className="signin__btn-github">
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>
          Continue with GitHub
        </button>

        {/* Footer links */}
        <div className="signin__footer">
          <p className="body-md">
            Don't have an account?{' '}
            <Link to="/signup" className="signin__link">
              Sign Up
            </Link>
          </p>
          <div className="signin__footer-links">
            <a href="#" className="signin__footer-link label-sm">
              Privacy Policy
            </a>
            <span className="signin__dot" />
            <a href="#" className="signin__footer-link label-sm">
              Security
            </a>
            <span className="signin__dot" />
            <a href="#" className="signin__footer-link label-sm">
              Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
