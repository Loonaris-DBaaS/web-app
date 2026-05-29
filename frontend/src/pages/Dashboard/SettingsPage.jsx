import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';

const REGION_OPTIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'EU (Ireland)' },
  { value: 'eu-central-1', label: 'EU (Frankfurt)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
];

const TIMEZONE_OPTIONS = [
  'UTC',
  'UTC+1',
  'UTC+2',
  'US/Eastern',
  'US/Pacific',
  'Asia/Singapore',
];

const DATE_FORMAT_OPTIONS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

const SETTINGS_TABS = ['Profile', 'Security', 'General', 'Notifications', 'Danger Zone'];

const styles = `
  .sp-page {
    --sp-tabs-width: 12.5rem;
    --sp-avatar-size: 5rem;
    background: var(--surface);
    color: var(--on-surface);
    font-family: var(--font-sans);
  }

  .sp-header {
    height: var(--topbar-height);
    background: var(--surface-container-lowest);
    border-bottom: 1px solid var(--outline-variant);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--space-8);
  }

  .sp-breadcrumb {
    font-size: var(--text-title-lg-size);
    line-height: var(--text-title-lg-height);
    font-weight: 600;
    color: var(--on-surface);
  }

  .sp-header-right {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .sp-icon-btn {
    width: var(--space-10);
    height: var(--space-10);
    border-radius: var(--radius-full);
    border: 1px solid var(--outline-variant);
    background: var(--surface-container-lowest);
    color: var(--on-surface-variant);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background var(--duration-base), color var(--duration-base);
  }

  .sp-icon-btn:hover {
    background: var(--surface-container-low);
    color: var(--on-surface);
  }

  .sp-tenant-avatar {
    width: var(--space-10);
    height: var(--space-10);
    border-radius: var(--radius-full);
    background: var(--primary-fixed);
    color: var(--primary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: var(--text-label-lg-size);
    font-weight: 700;
  }

  .sp-body {
    padding: var(--space-6) var(--space-8);
    display: grid;
    grid-template-columns: var(--sp-tabs-width) minmax(0, 1fr);
    gap: var(--space-6);
    align-items: start;
  }

  .sp-vertical-nav {
    background: var(--surface-container-lowest);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-float);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .sp-vertical-tab {
    position: relative;
    border: none;
    background: transparent;
    color: var(--on-surface-variant);
    text-align: left;
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-4) var(--space-3) var(--space-5);
    font-size: var(--text-label-lg-size);
    line-height: var(--text-label-lg-height);
    font-weight: 600;
    cursor: pointer;
    font-family: var(--font-sans);
    transition: background var(--duration-base), color var(--duration-base);
  }

  .sp-vertical-tab:hover {
    background: var(--surface-container-low);
    color: var(--on-surface);
  }

  .sp-vertical-tab.is-active {
    background: var(--primary-fixed);
    color: var(--primary);
  }

  .sp-vertical-tab.is-active::before {
    content: '';
    position: absolute;
    left: var(--space-2);
    top: var(--space-2);
    bottom: var(--space-2);
    width: var(--nav-pill-width);
    border-radius: var(--radius-full);
    background: var(--primary);
  }

  .sp-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .sp-card {
    background: var(--surface-container-lowest);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-float);
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .sp-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-4);
  }

  .sp-card-title {
    margin: 0;
    font-size: var(--text-title-lg-size);
    line-height: var(--text-title-lg-height);
    font-weight: 600;
    color: var(--on-surface);
  }

  .sp-card-subtitle {
    margin: 0;
    font-size: var(--text-body-md-size);
    line-height: var(--text-body-md-height);
    color: var(--on-surface-variant);
  }

  .sp-divider {
    border-top: 1px solid var(--outline-variant);
    opacity: 0.5;
  }

  .sp-section-label {
    font-size: var(--text-label-sm-size);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--on-surface-variant);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }

  .sp-section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--outline-variant);
    opacity: 0.5;
  }

  .sp-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .sp-field-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
  }

  .sp-label {
    font-size: var(--text-label-lg-size);
    line-height: var(--text-label-lg-height);
    font-weight: 500;
    color: var(--on-surface);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .sp-req {
    color: var(--error);
  }

  .sp-input,
  .sp-select {
    width: 100%;
    background: var(--surface-container-low);
    border: 1.5px solid var(--outline-variant);
    border-radius: var(--radius-sm);
    padding: var(--space-3) var(--space-4);
    font-family: var(--font-sans);
    font-size: var(--text-body-md-size);
    color: var(--on-surface);
    outline: none;
    box-sizing: border-box;
    transition: border-color var(--duration-base), box-shadow var(--duration-base), background var(--duration-base);
  }

  .sp-input[readonly] {
    color: var(--on-surface-variant);
    cursor: not-allowed;
  }

  .sp-input:focus,
  .sp-select:focus {
    border-color: var(--primary-container);
    background: var(--surface-container-lowest);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-container) 25%, transparent);
  }

  .sp-input.is-invalid {
    border-color: var(--error);
  }

  .sp-select-wrap {
    position: relative;
  }

  .sp-select-wrap::after {
    content: '';
    position: absolute;
    right: var(--space-4);
    top: 50%;
    transform: translateY(-50%);
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 5px solid var(--outline);
    pointer-events: none;
  }

  .sp-select {
    appearance: none;
    cursor: pointer;
  }

  .sp-input-wrap {
    position: relative;
  }

  .sp-input-action {
    position: absolute;
    right: var(--space-3);
    top: 50%;
    transform: translateY(-50%);
    border: none;
    background: transparent;
    color: var(--on-surface-variant);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .sp-help,
  .sp-error,
  .sp-success {
    font-size: var(--text-body-sm-size);
    line-height: var(--text-body-sm-height);
  }

  .sp-help {
    color: var(--on-surface-variant);
  }

  .sp-error {
    color: var(--error);
  }

  .sp-success {
    color: var(--success);
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .sp-success-dot {
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--success);
    flex-shrink: 0;
  }

  .sp-btn-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: center;
  }

  .sp-btn {
    border: none;
    border-radius: var(--radius-sm);
    padding: var(--space-3) var(--space-5);
    font-family: var(--font-sans);
    font-size: var(--text-label-lg-size);
    line-height: var(--text-label-lg-height);
    font-weight: 600;
    cursor: pointer;
    transition: opacity var(--duration-base), transform var(--duration-base), background var(--duration-base), color var(--duration-base);
  }

  .sp-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .sp-btn-primary {
    background: linear-gradient(135deg, var(--primary), var(--primary-container));
    color: var(--on-primary);
  }

  .sp-btn-primary:hover:not(:disabled) {
    opacity: 0.92;
    transform: translateY(-1px);
  }

  .sp-btn-ghost {
    background: transparent;
    border: 1.5px solid var(--outline-variant);
    color: var(--on-surface-variant);
  }

  .sp-btn-ghost:hover:not(:disabled) {
    background: var(--surface-container-low);
    color: var(--on-surface);
  }

  .sp-btn-danger {
    background: var(--error-container);
    color: var(--on-error-container);
  }

  .sp-btn-danger:hover:not(:disabled) {
    opacity: 0.92;
  }

  .sp-btn-ghost-danger {
    background: transparent;
    border: 1.5px solid var(--error);
    color: var(--error);
  }

  .sp-btn-ghost-danger:hover:not(:disabled) {
    background: var(--error-container);
    color: var(--on-error-container);
  }

  .sp-avatar-wrap {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    align-items: flex-start;
  }

  .sp-avatar {
    width: var(--sp-avatar-size);
    height: var(--sp-avatar-size);
    border-radius: var(--radius-full);
    background: var(--primary-fixed);
    color: var(--primary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: var(--text-title-lg-size);
    overflow: hidden;
  }

  .sp-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .sp-password-strength {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .sp-strength-bar {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .sp-strength-segment {
    height: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--surface-container-high);
  }

  .sp-strength-segment.is-active[data-tone='error'] {
    background: var(--error);
  }

  .sp-strength-segment.is-active[data-tone='warning'] {
    background: var(--warning);
  }

  .sp-strength-segment.is-active[data-tone='success'] {
    background: var(--success);
  }

  .sp-toggle-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4);
    background: var(--surface-container-low);
    border-radius: var(--radius-md);
  }

  .sp-toggle-title {
    font-size: var(--text-body-md-size);
    line-height: var(--text-body-md-height);
    font-weight: 500;
    color: var(--on-surface);
  }

  .sp-toggle-desc {
    margin: var(--space-1) 0 0;
    font-size: var(--text-body-sm-size);
    line-height: var(--text-body-sm-height);
    color: var(--on-surface-variant);
  }

  .sp-toggle-switch {
    position: relative;
    width: 2.25rem;
    height: 1.25rem;
    flex-shrink: 0;
    display: inline-block;
  }

  .sp-toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }

  .sp-toggle-track {
    position: absolute;
    inset: 0;
    background: var(--outline-variant);
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: background var(--duration-base);
  }

  .sp-toggle-track::after {
    content: '';
    position: absolute;
    width: 0.875rem;
    height: 0.875rem;
    left: 0.1875rem;
    top: 0.1875rem;
    background: var(--surface-bright);
    border-radius: var(--radius-full);
    transition: transform var(--duration-base);
  }

  .sp-toggle-switch input:checked + .sp-toggle-track {
    background: var(--primary-container);
  }

  .sp-toggle-switch input:checked + .sp-toggle-track::after {
    transform: translateX(1rem);
  }

  .sp-session-list,
  .sp-danger-list,
  .sp-notif-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .sp-session-row,
  .sp-danger-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .sp-session-meta,
  .sp-danger-meta {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .sp-session-device {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-body-md-size);
    line-height: var(--text-body-md-height);
    font-weight: 600;
  }

  .sp-mono {
    font-family: var(--font-mono);
  }

  .sp-pill {
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-full);
    background: var(--primary-fixed);
    color: var(--primary);
    font-size: var(--text-label-sm-size);
    font-weight: 600;
  }

  .sp-appearance-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
  }

  .sp-appearance-card {
    background: var(--surface-container-low);
    border: 1.5px solid var(--outline-variant);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    cursor: pointer;
    text-align: left;
    font-family: var(--font-sans);
    color: var(--on-surface-variant);
  }

  .sp-appearance-card.is-selected {
    border-color: var(--primary-container);
    background: var(--primary-fixed);
    color: var(--primary);
  }

  .sp-theme-preview {
    border-radius: var(--radius-sm);
    height: var(--space-6);
    display: grid;
    grid-template-columns: 1fr 1fr;
    overflow: hidden;
  }

  .sp-theme-preview .sp-left,
  .sp-theme-preview .sp-right {
    height: 100%;
  }

  .sp-theme-preview-light .sp-left {
    background: var(--surface-container-lowest);
  }

  .sp-theme-preview-light .sp-right {
    background: var(--surface-container-low);
  }

  .sp-theme-preview-dark .sp-left {
    background: var(--on-surface);
  }

  .sp-theme-preview-dark .sp-right {
    background: var(--on-surface-variant);
  }

  .sp-theme-preview-system .sp-left {
    background: var(--surface-container-lowest);
  }

  .sp-theme-preview-system .sp-right {
    background: var(--on-surface);
  }

  .sp-danger-card {
    background: var(--surface-container-lowest);
    border-radius: var(--radius-xl);
    padding: var(--space-6);
    border-left: 4px solid var(--error);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .sp-subtle-inline {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-body-sm-size);
    line-height: var(--text-body-sm-height);
    color: var(--on-surface-variant);
  }

  @media (max-width: 1024px) {
    .sp-body {
      grid-template-columns: 1fr;
    }

    .sp-vertical-nav {
      overflow-x: auto;
      flex-direction: row;
      white-space: nowrap;
    }

    .sp-vertical-tab {
      min-width: max-content;
    }

    .sp-vertical-tab.is-active::before {
      left: var(--space-2);
      right: var(--space-2);
      top: auto;
      bottom: var(--space-1);
      width: auto;
      height: var(--nav-pill-width);
    }

    .sp-field-row,
    .sp-appearance-grid {
      grid-template-columns: 1fr;
    }
  }
`;

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M10 17a2 2 0 1 0 4 0" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V8a5 5 0 0 1 10 0v3" />
    </svg>
  );
}

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18.4 18.4 0 0 1-4.2 5" />
      <path d="M6.7 6.7C4.2 8.2 2.5 12 2.5 12s3.5 7 9.5 7c1.3 0 2.4-.2 3.5-.6" />
    </svg>
  );
}

function DeviceDesktopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </svg>
  );
}

function DeviceMobileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function getPasswordScore(password) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  return checks.filter(Boolean).length;
}

function getStrengthLabel(score) {
  if (score <= 1) return 'Weak';
  if (score === 2) return 'Fair';
  if (score === 3) return 'Good';
  return 'Strong';
}

function getStrengthTone(index) {
  if (index === 0) return 'error';
  if (index === 1 || index === 2) return 'warning';
  return 'success';
}

function ProfileTab({ user, onSaveProfile }) {
  const [fullName, setFullName] = useState(user.fullName);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [country, setCountry] = useState(user.country || '');
  const [jobTitle, setJobTitle] = useState(user.jobTitle);
  const [company, setCompany] = useState(user.company);
  const [avatarPreview, setAvatarPreview] = useState(user.avatarUrl || '');
  const [avatarError, setAvatarError] = useState('');
  const [errors, setErrors] = useState({ fullName: '', displayName: '' });
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!saved) return undefined;
    const timeout = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(timeout);
  }, [saved]);

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Image must be 2 MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(String(reader.result || ''));
      setAvatarError('');
    };
    reader.readAsDataURL(file);
  }

  function handleRemovePhoto() {
    setAvatarPreview('');
    setAvatarError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleSave() {
    const nextErrors = {
      fullName: fullName.trim() ? '' : 'Full name is required.',
      displayName: displayName.trim() ? '' : 'Display name is required.',
    };
    setErrors(nextErrors);
    if (nextErrors.fullName || nextErrors.displayName) return;

    setSaving(true);
    setSaveError('');
    try {
      await onSaveProfile?.({
        fullName: fullName.trim(),
        displayName: displayName.trim(),
        country: country.trim(),
        email: user.email,
        jobTitle: jobTitle.trim(),
        company: company.trim(),
        avatarUrl: avatarPreview || null,
      });
      setSaved(true);
    } catch (err) {
      setSaveError(err.message ?? 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sp-content">
      <section className="sp-card">
        <div className="sp-card-header">
          <h3 className="sp-card-title">Avatar</h3>
        </div>
        <div className="sp-divider" />
        <div className="sp-avatar-wrap">
          <div className="sp-avatar">
            {avatarPreview ? <img src={avatarPreview} alt="Avatar preview" /> : getInitials(user.fullName || user.displayName || 'U')}
          </div>
          <div className="sp-btn-row">
            <button className="sp-btn sp-btn-primary" type="button" onClick={handleUploadClick}>
              Upload photo
            </button>
            {avatarPreview && (
              <button className="sp-btn sp-btn-ghost" type="button" onClick={handleRemovePhoto}>
                Remove photo
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} hidden />
          <p className="sp-help">Max 2 MB. JPG, PNG, or WebP.</p>
          {avatarError && <p className="sp-error">{avatarError}</p>}
        </div>
      </section>

      <section className="sp-card">
        <div className="sp-card-header">
          <div>
            <h3 className="sp-card-title">Profile information</h3>
            <p className="sp-card-subtitle">Update your personal and company information.</p>
          </div>
        </div>
        <div className="sp-divider" />

        <div>
          <div className="sp-section-label">Identity</div>
          <div className="sp-field-row">
            <div className="sp-field">
              <label className="sp-label" htmlFor="sp-full-name">Full name <span className="sp-req">*</span></label>
              <input id="sp-full-name" className={`sp-input${errors.fullName ? ' is-invalid' : ''}`} value={fullName} onChange={(e) => setFullName(e.target.value)} />
              {errors.fullName && <span className="sp-error">{errors.fullName}</span>}
            </div>
            <div className="sp-field">
              <label className="sp-label" htmlFor="sp-display-name">Display name <span className="sp-req">*</span></label>
              <input id="sp-display-name" className={`sp-input${errors.displayName ? ' is-invalid' : ''}`} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              {errors.displayName && <span className="sp-error">{errors.displayName}</span>}
            </div>
          </div>
        </div>

        <div>
          <div className="sp-section-label">Contact</div>
          <div className="sp-field-row">
            <div className="sp-field">
              <label className="sp-label" htmlFor="sp-email">Email</label>
              <div className="sp-input-wrap">
                <input
                  id="sp-email"
                  className="sp-input"
                  value={user.email}
                  readOnly
                  title="Contact support to change email"
                />
                <span className="sp-input-action" title="Contact support to change email" aria-hidden="true">
                  <LockIcon />
                </span>
              </div>
            </div>
            <div className="sp-field">
              <label className="sp-label" htmlFor="sp-job-title">Job title</label>
              <input id="sp-job-title" className="sp-input" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </div>
          </div>
          <div className="sp-field-row" style={{ marginTop: 'var(--space-4)' }}>
            <div className="sp-field">
              <label className="sp-label" htmlFor="sp-country">Country</label>
              <input id="sp-country" className="sp-input" placeholder="Tunisia" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
            <div className="sp-field">
              <label className="sp-label" htmlFor="sp-company">Company name</label>
              <input id="sp-company" className="sp-input" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="sp-btn-row">
          <button className="sp-btn sp-btn-primary" type="button" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {saved && <span className="sp-success"><span className="sp-success-dot" />Profile updated</span>}
          {saveError && <span className="sp-error">{saveError}</span>}
        </div>
      </section>
    </div>
  );
}

function SecurityTab({ onChangePassword }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [revokeState, setRevokeState] = useState({ sess2: false, sess3: false });

  const score = getPasswordScore(newPassword);
  const strengthLabel = getStrengthLabel(score);

  const sessions = [
    { id: 'sess1', device: 'MacBook Pro', type: 'desktop', location: 'Tunis, TN', lastActive: '2 minutes ago', isCurrent: true },
    { id: 'sess2', device: 'iPhone 15', type: 'mobile', location: 'Paris, FR', lastActive: 'Yesterday', isCurrent: false },
    { id: 'sess3', device: 'Windows Laptop', type: 'desktop', location: 'Berlin, DE', lastActive: '3 days ago', isCurrent: false },
  ];

  function handlePasswordUpdate() {
    if (newPassword !== confirmPassword) {
      setConfirmError('Passwords do not match.');
      return;
    }

    setConfirmError('');
    onChangePassword?.({ currentPassword, newPassword, confirmPassword });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  function handleRevoke(id) {
    setRevokeState((prev) => ({ ...prev, [id]: true }));
  }

  function handleRevokeAll() {
    setRevokeState({ sess2: true, sess3: true });
  }

  return (
    <div className="sp-content">
      <section className="sp-card">
        <div className="sp-card-header">
          <h3 className="sp-card-title">Change password</h3>
        </div>
        <div className="sp-divider" />
        <div className="sp-field">
          <label className="sp-label" htmlFor="sp-current-password">Current password</label>
          <div className="sp-input-wrap">
            <input id="sp-current-password" className="sp-input" type={showCurrent ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            <button className="sp-input-action" type="button" onClick={() => setShowCurrent((v) => !v)} aria-label="Toggle current password visibility">
              <EyeIcon open={showCurrent} />
            </button>
          </div>
        </div>

        <div className="sp-field">
          <label className="sp-label" htmlFor="sp-new-password">New password</label>
          <div className="sp-input-wrap">
            <input id="sp-new-password" className="sp-input" type={showNew ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <button className="sp-input-action" type="button" onClick={() => setShowNew((v) => !v)} aria-label="Toggle new password visibility">
              <EyeIcon open={showNew} />
            </button>
          </div>
          <div className="sp-password-strength">
            <div className="sp-strength-bar">
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={`sp-strength-segment${score > index ? ' is-active' : ''}`}
                  data-tone={getStrengthTone(index)}
                />
              ))}
            </div>
            <span className="sp-help">{strengthLabel}</span>
          </div>
        </div>

        <div className="sp-field">
          <label className="sp-label" htmlFor="sp-confirm-password">Confirm new password</label>
          <div className="sp-input-wrap">
            <input id="sp-confirm-password" className={`sp-input${confirmError ? ' is-invalid' : ''}`} type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            <button className="sp-input-action" type="button" onClick={() => setShowConfirm((v) => !v)} aria-label="Toggle confirm password visibility">
              <EyeIcon open={showConfirm} />
            </button>
          </div>
          {confirmError && <span className="sp-error">{confirmError}</span>}
        </div>

        <div className="sp-btn-row">
          <button className="sp-btn sp-btn-primary" type="button" onClick={handlePasswordUpdate}>Update password</button>
        </div>
      </section>

      <section className="sp-card">
        <div className="sp-card-header">
          <h3 className="sp-card-title">Active sessions</h3>
        </div>
        <div className="sp-divider" />
        <div className="sp-session-list">
          {sessions.map((session) => {
            const revoked = revokeState[session.id];
            return (
              <div key={session.id}>
                <div className="sp-session-row">
                  <div className="sp-session-meta">
                    <div className="sp-session-device">
                      {session.type === 'desktop' ? <DeviceDesktopIcon /> : <DeviceMobileIcon />}
                      <span>{session.device}</span>
                      {session.isCurrent && <span className="sp-pill">This device</span>}
                    </div>
                    <span className="sp-help">{session.location}</span>
                    <span className="sp-help">Last active: {session.lastActive}</span>
                  </div>
                  {!session.isCurrent && (
                    <button className="sp-btn sp-btn-ghost" type="button" onClick={() => handleRevoke(session.id)} disabled={revoked}>
                      {revoked ? 'Revoked' : 'Revoke'}
                    </button>
                  )}
                </div>
                <div className="sp-divider" style={{ marginTop: 'var(--space-3)' }} />
              </div>
            );
          })}
        </div>
        <div className="sp-btn-row">
          <button className="sp-btn sp-btn-ghost-danger" type="button" onClick={handleRevokeAll}>Revoke all other sessions</button>
        </div>
      </section>
    </div>
  );
}

function GeneralTab({ onSaveGeneral }) {
  const [defaultRegion, setDefaultRegion] = useState('us-east-1');
  const [theme, setTheme] = useState('system');
  const [timezone, setTimezone] = useState('UTC');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');

  function saveRegion() {
    onSaveGeneral?.({ defaultRegion });
  }

  function saveAppearance() {
    onSaveGeneral?.({ theme });
  }

  function saveDateTime() {
    onSaveGeneral?.({ timezone, dateFormat });
  }

  return (
    <div className="sp-content">
      <section className="sp-card">
        <div className="sp-card-header">
          <h3 className="sp-card-title">Region preference</h3>
        </div>
        <div className="sp-divider" />
        <div className="sp-field">
          <label className="sp-label" htmlFor="sp-default-region">Default region for new databases</label>
          <div className="sp-select-wrap">
            <select id="sp-default-region" className="sp-select" value={defaultRegion} onChange={(e) => setDefaultRegion(e.target.value)}>
              {REGION_OPTIONS.map((region) => (
                <option key={region.value} value={region.value}>{region.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="sp-btn-row">
          <button className="sp-btn sp-btn-primary" type="button" onClick={saveRegion}>Save</button>
        </div>
      </section>

      <section className="sp-card">
        <div className="sp-card-header">
          <h3 className="sp-card-title">Appearance</h3>
        </div>
        <div className="sp-divider" />
        <div className="sp-appearance-grid">
          <button className={`sp-appearance-card${theme === 'light' ? ' is-selected' : ''}`} type="button" onClick={() => setTheme('light')}>
            <span className="sp-theme-preview sp-theme-preview-light">
              <span className="sp-left" />
              <span className="sp-right" />
            </span>
            <span>Light</span>
          </button>
          <button className={`sp-appearance-card${theme === 'dark' ? ' is-selected' : ''}`} type="button" onClick={() => setTheme('dark')}>
            <span className="sp-theme-preview sp-theme-preview-dark">
              <span className="sp-left" />
              <span className="sp-right" />
            </span>
            <span>Dark</span>
          </button>
          <button className={`sp-appearance-card${theme === 'system' ? ' is-selected' : ''}`} type="button" onClick={() => setTheme('system')}>
            <span className="sp-theme-preview sp-theme-preview-system">
              <span className="sp-left" />
              <span className="sp-right" />
            </span>
            <span>System</span>
          </button>
        </div>
        <div className="sp-btn-row">
          <button className="sp-btn sp-btn-primary" type="button" onClick={saveAppearance}>Save</button>
        </div>
      </section>

      <section className="sp-card">
        <div className="sp-card-header">
          <h3 className="sp-card-title">Date & time</h3>
        </div>
        <div className="sp-divider" />
        <div className="sp-field-row">
          <div className="sp-field">
            <label className="sp-label" htmlFor="sp-timezone">Timezone</label>
            <div className="sp-select-wrap">
              <select id="sp-timezone" className="sp-select" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="sp-field">
            <label className="sp-label" htmlFor="sp-date-format">Date format</label>
            <div className="sp-select-wrap">
              <select id="sp-date-format" className="sp-select" value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
                {DATE_FORMAT_OPTIONS.map((fmt) => (
                  <option key={fmt} value={fmt}>{fmt}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="sp-btn-row">
          <button className="sp-btn sp-btn-primary" type="button" onClick={saveDateTime}>Save</button>
        </div>
      </section>
    </div>
  );
}

function NotificationsTab({ onSaveNotifications }) {
  const [prefs, setPrefs] = useState({
    backupCompleted: true,
    backupFailed: true,
    highConnectionUsage: true,
    databaseSuspended: true,
    newLoginDetected: true,
    billingThreshold: false,
  });

  const rows = [
    {
      key: 'backupCompleted',
      title: 'Backup completed',
      description: 'When a scheduled backup finishes successfully',
    },
    {
      key: 'backupFailed',
      title: 'Backup failed',
      description: 'When a backup job fails - always recommended',
    },
    {
      key: 'highConnectionUsage',
      title: 'High connection usage',
      description: 'When active connections exceed 80% of the limit',
    },
    {
      key: 'databaseSuspended',
      title: 'Database suspended',
      description: 'When a database is suspended due to billing or policy',
    },
    {
      key: 'newLoginDetected',
      title: 'New login detected',
      description: 'When a new session is started from an unrecognized location',
    },
    {
      key: 'billingThreshold',
      title: 'Billing threshold',
      description: 'When estimated monthly cost exceeds a set amount',
    },
  ];

  function togglePref(key) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function savePreferences() {
    onSaveNotifications?.(prefs);
  }

  return (
    <section className="sp-card">
      <div className="sp-card-header">
        <h3 className="sp-card-title">Notification preferences</h3>
      </div>
      <div className="sp-divider" />
      <div className="sp-notif-list">
        {rows.map((row) => (
          <div key={row.key} className="sp-toggle-row">
            <div>
              <div className="sp-toggle-title">{row.title}</div>
              <p className="sp-toggle-desc">{row.description}</p>
            </div>
            <label className="sp-toggle-switch">
              <input type="checkbox" checked={prefs[row.key]} onChange={() => togglePref(row.key)} />
              <span className="sp-toggle-track" />
            </label>
          </div>
        ))}
      </div>
      <div className="sp-btn-row">
        <button className="sp-btn sp-btn-primary" type="button" onClick={savePreferences}>Save preferences</button>
      </div>
    </section>
  );
}

function DangerZoneTab({ user, onDeleteAccount }) {
  const [exportRequested, setExportRequested] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferEmail, setTransferEmail] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState('');

  const canDelete = deleteEmailInput.trim() === user.email;

  function handleRequestExport() {
    setExportRequested(true);
  }

  function handleTransferOwnership() {
    setShowTransfer(true);
  }

  function handleConfirmTransfer() {
    if (!transferEmail.trim()) return;
    setTransferEmail('');
    setShowTransfer(false);
  }

  function handleDeleteClick() {
    setShowDeleteConfirm(true);
  }

  function handleConfirmDelete() {
    if (!canDelete) return;
    onDeleteAccount?.();
  }

  return (
    <section className="sp-danger-card">
      <div className="sp-card-header">
        <h3 className="sp-card-title">Danger zone</h3>
      </div>

      <div className="sp-danger-list">
        <div>
          <div className="sp-danger-row">
            <div className="sp-danger-meta">
              <strong>Export account data</strong>
              <span className="sp-help">Download a full export of your databases, API keys, and billing history as a JSON file.</span>
            </div>
            <button className="sp-btn sp-btn-ghost" type="button" onClick={handleRequestExport}>Request export</button>
          </div>
          {exportRequested && <p className="sp-success"><span className="sp-success-dot" />Export requested - you'll receive an email when it's ready.</p>}
        </div>

        <div className="sp-divider" />

        <div>
          <div className="sp-danger-row">
            <div className="sp-danger-meta">
              <strong>Transfer account ownership</strong>
              <span className="sp-help">Transfer this account to another user. You will lose admin access.</span>
            </div>
            <button className="sp-btn sp-btn-ghost" type="button" onClick={handleTransferOwnership}>Transfer ownership</button>
          </div>
          {showTransfer && (
            <div className="sp-field-row" style={{ marginTop: 'var(--space-3)' }}>
              <div className="sp-field">
                <label className="sp-label" htmlFor="sp-transfer-email">New owner email</label>
                <input id="sp-transfer-email" className="sp-input sp-mono" type="email" value={transferEmail} onChange={(e) => setTransferEmail(e.target.value)} />
              </div>
              <div className="sp-btn-row" style={{ alignItems: 'flex-end' }}>
                <button className="sp-btn sp-btn-primary" type="button" onClick={handleConfirmTransfer}>Confirm transfer</button>
              </div>
            </div>
          )}
        </div>

        <div className="sp-divider" />

        <div>
          <div className="sp-danger-row">
            <div className="sp-danger-meta">
              <strong>Delete account</strong>
              <span className="sp-help">Permanently delete your account and all associated databases. This cannot be undone.</span>
            </div>
            <button className="sp-btn sp-btn-danger" type="button" onClick={handleDeleteClick}>Delete account</button>
          </div>
          {showDeleteConfirm && (
            <div className="sp-field" style={{ marginTop: 'var(--space-3)' }}>
              <label className="sp-label" htmlFor="sp-delete-confirm">Type your email to confirm deletion</label>
              <input id="sp-delete-confirm" className="sp-input sp-mono" value={deleteEmailInput} onChange={(e) => setDeleteEmailInput(e.target.value)} />
              <div className="sp-btn-row">
                <button className="sp-btn sp-btn-danger" type="button" disabled={!canDelete} onClick={handleConfirmDelete}>Confirm deletion</button>
                <span className="sp-subtle-inline">Expected: <span className="sp-mono">{user.email}</span></span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Profile');

  async function handleLogout() {
    await logout();
    navigate('/signin');
  }

  async function handleSaveProfile(fields) {
    await updateProfile({
      username: fields.displayName || fields.fullName || undefined,
      country:  fields.country  ?? undefined,
      jobTitle: fields.jobTitle ?? undefined,
      company:  fields.company  ?? undefined,
      photoUrl: fields.avatarUrl ?? undefined,
    });
  }

  async function handleDeleteAccount() {
    await logout();
    navigate('/signin');
  }

  const safeUser = user
    ? {
        id: user.id,
        fullName: user.username,
        displayName: user.username,
        email: user.email,
        jobTitle: user.jobTitle ?? '',
        company: user.company ?? '',
        avatarUrl: user.photoUrl ?? null,
        country: user.country ?? '',
        plan: 'free',
        createdAt: user.createdAt ?? new Date().toISOString(),
      }
    : {
        id: '',
        fullName: '',
        displayName: '',
        email: '',
        jobTitle: '',
        company: '',
        avatarUrl: null,
        plan: 'free',
        createdAt: new Date().toISOString(),
      };

  const initials = getInitials(safeUser.fullName || safeUser.displayName || 'U');

  function renderTab() {
    if (activeTab === 'Profile') {
      return <ProfileTab user={safeUser} onSaveProfile={handleSaveProfile} />;
    }
    if (activeTab === 'Security') {
      return <SecurityTab onChangePassword={() => {}} />;
    }
    if (activeTab === 'General') {
      return <GeneralTab onSaveGeneral={() => {}} />;
    }
    if (activeTab === 'Notifications') {
      return <NotificationsTab onSaveNotifications={() => {}} />;
    }
    return <DangerZoneTab user={safeUser} onDeleteAccount={handleDeleteAccount} />;
  }

  return (
    <section className="sp-page">
      <style>{styles}</style>

      <div className="sp-body">
        <nav className="sp-vertical-nav" aria-label="Settings sections">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`sp-vertical-tab${activeTab === tab ? ' is-active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>

        <div className="sp-content">
          {renderTab()}
        </div>
      </div>
    </section>
  );
}
