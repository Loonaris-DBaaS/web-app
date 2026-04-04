import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleProvisionDB() {
    setStatus('');
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/db/provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setStatus('Request sent successfully.');
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/signin');
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Dashboard</h1>
          <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
        <p style={styles.welcome}>Welcome, <strong>{user?.email}</strong></p>
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Database</h2>
          <p style={styles.sectionDesc}>
            Provision a PostgreSQL database with read replicas for your account.
          </p>
          <button
            style={styles.provisionBtn}
            onClick={handleProvisionDB}
            disabled={loading}
          >
            {loading ? 'Provisioning...' : 'Get Database (with Read Replicas)'}
          </button>
          {status && <p style={styles.status}>{status}</p>}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' },
  card: { background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', width: '100%', maxWidth: '480px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  title: { margin: 0, fontSize: '1.5rem' },
  logoutBtn: { padding: '0.4rem 0.9rem', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '0.875rem' },
  welcome: { color: '#6b7280', marginBottom: '1.5rem' },
  section: { borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' },
  sectionTitle: { margin: '0 0 0.5rem', fontSize: '1.1rem' },
  sectionDesc: { color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' },
  provisionBtn: { padding: '0.75rem 1.25rem', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '1rem', cursor: 'pointer' },
  status: { marginTop: '1rem', fontSize: '0.875rem', color: '#374151' },
};
