import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './Signup.css';

export default function SignUp() {
  const { signup, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signup({ username: form.username, email: form.email, password: form.password });
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="signup">
      <div className="signup__badge">
        <span
          className="material-symbols-outlined signup__badge-icon"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          auto_awesome
        </span>
        <span className="label-md">Start free — no credit card required</span>
      </div>

      <div className="signup__card floating">
        <div className="signup__card-header">
          <h1 className="headline-sm">Create your account</h1>
          <p className="body-md">
            Join the ethereal engine and manage your PostgreSQL clusters with weightless precision.
          </p>
        </div>

        <form className="signup__form" onSubmit={handleSubmit}>
          {error && <p className="signup__error body-sm">{error}</p>}

          <div className="signup__field">
            <label htmlFor="username" className="signup__label label-md">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              placeholder="alex_rivera"
              className="signup__input"
              value={form.username}
              onChange={handleChange}
            />
          </div>

          <div className="signup__field">
            <label htmlFor="email" className="signup__label label-md">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="alex@example.com"
              className="signup__input"
              value={form.email}
              onChange={handleChange}
            />
          </div>

          <div className="signup__field">
            <label htmlFor="password" className="signup__label label-md">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••••••"
              className="signup__input"
              value={form.password}
              onChange={handleChange}
            />
          </div>

          <button type="submit" className="signup__btn-primary gradient-primary" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="signup__footer">
          <p className="body-sm">
            By signing up, you agree to our{' '}
            <a href="#" className="signup__link">Terms of Service</a>{' '}
            and{' '}
            <a href="#" className="signup__link">Privacy Policy</a>.
          </p>
          <p className="body-md">
            Already have an account?{' '}
            <Link to="/signin" className="signup__link signup__link--bold">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
