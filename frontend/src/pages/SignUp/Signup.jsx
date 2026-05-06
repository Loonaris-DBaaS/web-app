import { Link } from 'react-router-dom';
import './Signup.css';

export default function SignUp() {
  return (
    <div className="signup">
      {/* Free-tier badge */}
      <div className="signup__badge">
        <span
          className="material-symbols-outlined signup__badge-icon"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          auto_awesome
        </span>
        <span className="label-md">Start free — no credit card required</span>
      </div>

      {/* Glass Card */}
      <div className="signup__card floating">
        <div className="signup__card-header">
          <h1 className="headline-sm">Create your account..</h1>
          <p className="body-md">
            Join the ethereal engine and manage your PostgreSQL clusters with weightless precision.
          </p>
        </div>

        <form className="signup__form">
          <div className="signup__field">
            <label htmlFor="name" className="signup__label label-md">
              Full Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Alex Rivera"
              className="signup__input"
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
            />
          </div>

          <button type="submit" className="signup__btn-primary gradient-primary">
            Create account
          </button>
        </form>

        {/* Divider */}
        <div className="signup__divider">
          <span className="signup__divider-line" />
          <span className="signup__divider-text label-sm">or continue with</span>
          <span className="signup__divider-line" />
        </div>

        {/* GitHub */}
        <button type="button" className="signup__btn-github">
          <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>
          Continue with GitHub
        </button>

        {/* Footer */}
        <div className="signup__footer">
          <p className="body-sm">
            By signing up, you agree to our{' '}
            <a href="#" className="signup__link">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="signup__link">
              Privacy Policy
            </a>
            .
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
