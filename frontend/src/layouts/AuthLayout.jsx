import { Outlet } from 'react-router-dom';
import '../styles/global.css';
import './AuthLayout.css';

export default function AuthLayout() {
  return (
    <div className="auth-layout">
      <div className="auth-layout__blob auth-layout__blob--top" />
      <div className="auth-layout__blob auth-layout__blob--bottom" />

      <main className="auth-layout__main">
        <Outlet />
      </main>

      <footer className="auth-layout__footer">
        <p className="label-sm">© 2026 Loonaris Inc.</p>
      </footer>
    </div>
  );
}
