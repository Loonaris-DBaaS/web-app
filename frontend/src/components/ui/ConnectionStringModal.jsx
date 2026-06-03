import { useState, useCallback } from 'react';

const GATEWAY_HOST =
  typeof import.meta !== 'undefined'
    ? import.meta.env?.VITE_GATEWAY_HOST ||
      'ab571a35c49414eaab905fc43405b7fb-9f85c871b90b857f.elb.eu-west-3.amazonaws.com'
    : 'ab571a35c49414eaab905fc43405b7fb-9f85c871b90b857f.elb.eu-west-3.amazonaws.com';

const MASK = '•••••••••••••••••••••••••••••••••';

function maskKey(key) {
  if (!key) return '';
  const parts = key.split('_');
  if (parts.length < 4) return key;
  const prefix = parts.slice(0, 2).join('_');
  const suffix = parts[parts.length - 1];
  return `${prefix}_${MASK}_${suffix}`;
}

const FORMAT_TABS = [
  { id: 'uri', label: 'URI' },
  { id: 'jdbc', label: 'JDBC' },
  { id: 'node', label: 'Node.js' },
  { id: 'prisma', label: 'Prisma' },
  { id: 'django', label: 'Django' },
];

function buildConnectionString(apiKey) {
  return `postgresql://${apiKey}@${GATEWAY_HOST}:5432/app?sslmode=disable`;
}

function getFormats(apiKey) {
  const host = GATEWAY_HOST;
  const port = 5432;
  const db = 'app';
  const maskedKey = maskKey(apiKey);
  const roKey = apiKey?.replace?.(/_rw$/, '_ro') || apiKey;
  const maskedRo = maskKey(roKey);

  return {
    uri: {
      rw: buildConnectionString(maskedKey),
      ro: buildConnectionString(maskedRo),
    },
    jdbc: {
      rw: `jdbc:postgresql://${host}:${port}/${db}?user=${maskedKey}&ssl=false`,
      ro: `jdbc:postgresql://${host}:${port}/${db}?user=${maskedRo}&ssl=false`,
    },
    node: {
      rw: `const { Client } = require('pg');\nconst client = new Client({\n  host: '${host}',\n  port: ${port},\n  database: '${db}',\n  user: '${maskedKey}',\n  ssl: false,\n});`,
      ro: `const { Client } = require('pg');\nconst client = new Client({\n  host: '${host}',\n  port: ${port},\n  database: '${db}',\n  user: '${maskedRo}',\n  ssl: false,\n});`,
    },
    prisma: {
      rw: `datasource db {\n  provider = "postgresql"\n  url      = "${buildConnectionString(maskedKey)}"\n}`,
      ro: `datasource db {\n  provider = "postgresql"\n  url      = "${buildConnectionString(maskedRo)}"\n}`,
    },
    django: {
      rw: `DATABASES = {\n  'default': {\n    'ENGINE': 'django.db.backends.postgresql',\n    'HOST': '${host}',\n    'PORT': '${port}',\n    'NAME': '${db}',\n    'USER': '${maskedKey}',\n    'OPTIONS': { 'sslmode': 'disable' },\n  }\n}`,
      ro: `DATABASES = {\n  'default': {\n    'ENGINE': 'django.db.backends.postgresql',\n    'HOST': '${host}',\n    'PORT': '${port}',\n    'NAME': '${db}',\n    'USER': '${maskedRo}',\n    'OPTIONS': { 'sslmode': 'disable' },\n  }\n}`,
    },
  };
}

/* ─── single row: label · value · actions ─── */
function Row({ label, value, fieldId, onCopy, copied }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#475569',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {label}
        </span>
        <button
          onClick={() => onCopy(value, fieldId)}
          style={{
            fontSize: 12,
            fontWeight: 500,
            padding: '3px 10px',
            borderRadius: 6,
            border: '1px solid #e2e8f0',
            background: copied === fieldId ? '#dcfce7' : '#fff',
            color: copied === fieldId ? '#14532d' : '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {copied === fieldId ? (
            <>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 8l4 4 8-8" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="5" width="9" height="9" rx="1.5" />
                <path d="M3 11H2a1 1 0 01-1-1V2a1 1 0 011-1h8a1 1 0 011 1v1" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: '10px 12px',
          background: '#0f172a',
          color: '#cbd5e1',
          borderRadius: 8,
          fontSize: 11,
          fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', ui-monospace, monospace",
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          lineHeight: 1.6,
          border: '1px solid #1e293b',
        }}
      >
        {value}
      </pre>
    </div>
  );
}

export default function ConnectionStringModal({
  apiKey,
  rwConnectionString,
  roConnectionString,
  isPreview = false,
  onRegenerate,
  onClose,
}) {
  const [activeFormat, setActiveFormat] = useState('uri');
  const [copiedField, setCopiedField] = useState('');

  const hasRealKey = !isPreview;
  const rwKey = apiKey;
  const roKey = apiKey?.replace?.(/_rw$/, '_ro');

  /* If user has the real key, show real formats; else masked */
  const realFormats = {
    uri: {
      rw: buildConnectionString(rwKey),
      ro: buildConnectionString(roKey || rwKey),
    },
    jdbc: {
      rw: `jdbc:postgresql://${GATEWAY_HOST}:5432/app?user=${rwKey}&ssl=false`,
      ro: `jdbc:postgresql://${GATEWAY_HOST}:5432/app?user=${roKey || rwKey}&ssl=false`,
    },
    node: {
      rw: `const { Client } = require('pg');\nconst client = new Client({\n  host: '${GATEWAY_HOST}',\n  port: 5432,\n  database: 'app',\n  user: '${rwKey}',\n  ssl: false,\n});`,
      ro: `const { Client } = require('pg');\nconst client = new Client({\n  host: '${GATEWAY_HOST}',\n  port: 5432,\n  database: 'app',\n  user: '${roKey || rwKey}',\n  ssl: false,\n});`,
    },
    prisma: {
      rw: `datasource db {\n  provider = "postgresql"\n  url      = "${buildConnectionString(rwKey)}"\n}`,
      ro: `datasource db {\n  provider = "postgresql"\n  url      = "${buildConnectionString(roKey || rwKey)}"\n}`,
    },
    django: {
      rw: `DATABASES = {\n  'default': {\n    'ENGINE': 'django.db.backends.postgresql',\n    'HOST': '${GATEWAY_HOST}',\n    'PORT': '5432',\n    'NAME': 'app',\n    'USER': '${rwKey}',\n    'OPTIONS': { 'sslmode': 'disable' },\n  }\n}`,
      ro: `DATABASES = {\n  'default': {\n    'ENGINE': 'django.db.backends.postgresql',\n    'HOST': '${GATEWAY_HOST}',\n    'PORT': '5432',\n    'NAME': 'app',\n    'USER': '${roKey || rwKey}',\n    'OPTIONS': { 'sslmode': 'disable' },\n  }\n}`,
    },
  };

  const formats = hasRealKey ? realFormats : getFormats(apiKey);

  const copyToClipboard = useCallback(async (text, fieldId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(''), 2000);
    } catch {}
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
        padding: '2rem',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 20,
          maxWidth: 600,
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
      >
        {/* ── Header ── */}
        <div style={{ padding: '24px 28px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>
                Connection Strings
              </h2>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                Use these to connect your application to the database
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: 0,
                borderRadius: 8,
                color: '#64748b',
                width: 32,
                height: 32,
                cursor: 'pointer',
                fontSize: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Format Tabs ── */}
        <div style={{ padding: '16px 28px 0' }}>
          <div style={{ display: 'flex', gap: 2, background: '#f8fafc', borderRadius: 10, padding: 3 }}>
            {FORMAT_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFormat(tab.id)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  background: activeFormat === tab.id ? '#fff' : 'transparent',
                  color: activeFormat === tab.id ? '#201772' : '#64748b',
                  boxShadow: activeFormat === tab.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Connection strings ── */}
        <div style={{ padding: '16px 28px 24px' }}>
          <Row
            label="Read-write"
            value={formats[activeFormat]?.rw || ''}
            fieldId={`${activeFormat}-rw`}
            onCopy={copyToClipboard}
            copied={copiedField}
          />
          <Row
            label="Read-only"
            value={formats[activeFormat]?.ro || ''}
            fieldId={`${activeFormat}-ro`}
            onCopy={copyToClipboard}
            copied={copiedField}
          />
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            padding: '16px 28px',
            background: '#f8fafc',
            borderRadius: '0 0 20px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {isPreview ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>Need the real key?</span>
              <button
                onClick={() => {
                  onClose?.();
                  onRegenerate?.();
                }}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#201772',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}
              >
                Regenerate credentials →
              </button>
            </div>
          ) : (
            <span style={{ fontSize: 13, color: '#94a3b8' }}>
              Key last rotated: just now
            </span>
          )}

          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              background: '#201772',
              color: '#fff',
              border: 0,
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
