import { useState } from "react";
import ConnectionParameters from "./ConnectionParameters";
import { clusterService } from '../../services/api';
import { REGIONS, DEPLOYMENT_OPTIONS, PG_VERSIONS, SIZES } from '../../constants/database';
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

  .dbf-wrap {
    font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
    padding: 2rem;
  }

  .dbf-card {
    background: var(--surface-container-lowest, #ffffff);
    border-radius: var(--radius-xl, 1.5rem);
    box-shadow: var(--shadow-float, 0px 20px 40px rgba(25,28,29,0.05));
    max-width: 640px;
    margin: 0 auto;
    overflow: hidden;
  }

  .dbf-header {
    background: linear-gradient(135deg, var(--primary, #201772) 0%, var(--primary-container, #473ca9) 100%);
    padding: 1.75rem 2rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .dbf-header-icon {
    width: 44px; height: 44px;
    background: rgba(255,255,255,0.15);
    border-radius: var(--radius-md, 0.75rem);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .dbf-header h2 {
    color: #fff;
    font-size: 1.125rem;
    font-weight: 600;
    line-height: 1.4;
    margin: 0;
  }

  .dbf-header p {
    color: rgba(255,255,255,0.7);
    font-size: 0.8125rem;
    margin: 0.2rem 0 0;
  }

  .dbf-body { padding: 2rem; }

  .dbf-section-label {
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--on-surface-variant, #42474e);
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .dbf-section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--outline-variant, #c2c7cf);
    opacity: 0.5;
  }

  .dbf-field { margin-bottom: 1.25rem; }

  .dbf-field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .dbf-label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--on-surface, #191c1d);
    margin-bottom: 0.375rem;
  }

  .dbf-req { color: var(--error, #dc2626); margin-left: 2px; }

  .dbf-input-wrap { position: relative; }

  .dbf-prefix {
    position: absolute;
    left: 0.875rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.875rem;
    color: var(--on-surface-variant, #42474e);
    pointer-events: none;
    user-select: none;
    font-family: 'Cascadia Code', 'Fira Code', monospace;
  }

  .dbf-input {
    width: 100%;
    background: var(--surface-container-low, #f4f4f6);
    border: 1.5px solid var(--outline-variant, #c2c7cf);
    border-radius: var(--radius-sm, 0.5rem);
    padding: 0.625rem 0.875rem;
    font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
    font-size: 0.875rem;
    color: var(--on-surface, #191c1d);
    outline: none;
    transition: border-color 200ms, background 200ms, box-shadow 200ms;
    appearance: none;
    -webkit-appearance: none;
    box-sizing: border-box;
  }

  .dbf-input::placeholder { color: var(--outline, #72777f); }

  .dbf-input:focus {
    border-color: var(--primary-container, #473ca9);
    background: var(--surface-container-lowest, #ffffff);
    box-shadow: 0 0 0 3px rgba(71,60,169,0.12);
  }

  .dbf-input.mono {
    font-family: 'Cascadia Code', 'Fira Code', monospace;
    font-size: 0.8125rem;
    letter-spacing: 0.01em;
  }

  .dbf-input.has-prefix { padding-left: 3.75rem; }

  .dbf-input.invalid { border-color: var(--error, #dc2626); }

  .dbf-select-wrap { position: relative; }

  .dbf-select-wrap::after {
    content: '';
    position: absolute;
    right: 0.875rem;
    top: 50%;
    transform: translateY(-50%);
    width: 0; height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 5px solid var(--outline, #72777f);
    pointer-events: none;
  }

  .dbf-select {
    width: 100%;
    background: var(--surface-container-low, #f4f4f6);
    border: 1.5px solid var(--outline-variant, #c2c7cf);
    border-radius: var(--radius-sm, 0.5rem);
    padding: 0.625rem 0.875rem;
    font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
    font-size: 0.875rem;
    color: var(--on-surface, #191c1d);
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    box-sizing: border-box;
    transition: border-color 200ms, box-shadow 200ms;
  }

  .dbf-select:focus {
    border-color: var(--primary-container, #473ca9);
    box-shadow: 0 0 0 3px rgba(71,60,169,0.12);
  }

  .dbf-version-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.625rem;
    margin-top: 0.375rem;
  }

  .dbf-version-chip {
    background: var(--surface-container-low, #f4f4f6);
    border: 1.5px solid var(--outline-variant, #c2c7cf);
    border-radius: var(--radius-sm, 0.5rem);
    padding: 0.5rem 0;
    text-align: center;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--on-surface-variant, #42474e);
    cursor: pointer;
    transition: all 200ms;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
    box-sizing: border-box;
  }

  .dbf-version-chip:hover {
    border-color: var(--primary-container, #473ca9);
    color: var(--primary-container, #473ca9);
    background: var(--primary-fixed, #ede9fe);
  }

  .dbf-version-chip.selected {
    border-color: var(--primary-container, #473ca9);
    background: var(--primary-fixed, #ede9fe);
    color: var(--primary, #201772);
  }

  .dbf-badge {
    font-size: 0.625rem;
    font-weight: 600;
    background: var(--success-container, #dcfce7);
    color: var(--on-success-container, #14532d);
    padding: 1px 5px;
    border-radius: 9999px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .dbf-size-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.625rem;
  }

  .dbf-size-card {
    background: var(--surface-container-low, #f4f4f6);
    border: 1.5px solid var(--outline-variant, #c2c7cf);
    border-radius: var(--radius-md, 0.75rem);
    padding: 0.875rem 0.75rem;
    cursor: pointer;
    transition: all 200ms;
    text-align: left;
    font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
    box-sizing: border-box;
  }

  .dbf-size-card:hover {
    border-color: var(--primary-container, #473ca9);
    background: var(--primary-fixed, #ede9fe);
  }

  .dbf-size-card.selected {
    border-color: var(--primary-container, #473ca9);
    background: var(--primary-fixed, #ede9fe);
  }

  .dbf-size-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--on-surface, #191c1d);
  }

  .dbf-size-card.selected .dbf-size-name { color: var(--primary, #201772); }

  .dbf-size-specs {
    font-size: 0.6875rem;
    color: var(--on-surface-variant, #42474e);
    margin-top: 0.3rem;
    line-height: 1.5;
  }

  .dbf-size-price {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--primary-container, #473ca9);
    margin-top: 0.4rem;
  }

  .dbf-toggle-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.875rem 1rem;
    background: var(--surface-container-low, #f4f4f6);
    border-radius: var(--radius-md, 0.75rem);
    margin-bottom: 0.625rem;
  }

  .dbf-toggle-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--on-surface, #191c1d);
  }

  .dbf-toggle-desc {
    font-size: 0.75rem;
    color: var(--on-surface-variant, #42474e);
    margin-top: 0.2rem;
    line-height: 1.4;
  }

  .dbf-toggle-switch {
    position: relative;
    width: 36px;
    height: 20px;
    flex-shrink: 0;
    margin-top: 1px;
    display: inline-block;
  }

  .dbf-toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }

  .dbf-toggle-track {
    position: absolute;
    inset: 0;
    background: var(--outline-variant, #c2c7cf);
    border-radius: 9999px;
    cursor: pointer;
    transition: background 200ms;
  }

  .dbf-toggle-track::after {
    content: '';
    position: absolute;
    width: 14px; height: 14px;
    left: 3px; top: 3px;
    background: white;
    border-radius: 50%;
    transition: transform 200ms;
  }

  .dbf-toggle-switch input:checked + .dbf-toggle-track {
    background: var(--primary-container, #473ca9);
  }

  .dbf-toggle-switch input:checked + .dbf-toggle-track::after {
    transform: translateX(16px);
  }

  .dbf-conn-preview {
    background: var(--surface-container-high, #e8e8ec);
    border-radius: var(--radius-md, 0.75rem);
    padding: 1rem;
    margin-top: 0.375rem;
    font-family: 'Cascadia Code', 'Fira Code', monospace;
    font-size: 0.75rem;
    color: var(--on-surface-variant, #42474e);
    word-break: break-all;
    line-height: 1.6;
    border-left: 3px solid var(--primary-fixed-dim, #c4b5fd);
  }

  .dbf-conn-key { color: var(--primary-container, #473ca9); }
  .dbf-conn-val { color: var(--on-surface, #191c1d); }

  .dbf-footer {
    padding: 1.5rem 2rem;
    background: var(--surface-container-low, #f4f4f6);
    border-top: 1px solid var(--outline-variant, #c2c7cf);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .dbf-cost-label {
    font-size: 0.75rem;
    color: var(--on-surface-variant, #42474e);
    display: block;
  }

  .dbf-cost-value {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--on-surface, #191c1d);
    display: block;
  }

  .dbf-btn-group { display: flex; gap: 0.75rem; }

  .dbf-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border-radius: var(--radius-sm, 0.5rem);
    font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 200ms;
  }

  .dbf-btn-ghost {
    background: transparent;
    color: var(--on-surface-variant, #42474e);
    border: 1.5px solid var(--outline-variant, #c2c7cf);
  }

  .dbf-btn-ghost:hover {
    background: var(--surface-container, #eeeef1);
    border-color: var(--outline, #72777f);
  }

  .dbf-btn-primary {
    background: linear-gradient(135deg, var(--primary, #201772) 0%, var(--primary-container, #473ca9) 100%);
    color: #fff;
  }

  .dbf-btn-primary:hover:not(:disabled) {
    opacity: 0.92;
    transform: translateY(-1px);
  }

  .dbf-btn-primary:active:not(:disabled) { transform: translateY(0); }

  .dbf-btn-primary:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
  }

  .dbf-field-error {
    font-size: 0.75rem;
    color: var(--error, #dc2626);
    margin-top: 0.3rem;
  }

  .dbf-toast {
    position: fixed;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%) translateY(80px);
    background: var(--on-surface, #191c1d);
    color: #fff;
    padding: 0.75rem 1.25rem;
    border-radius: var(--radius-md, 0.75rem);
    font-size: 0.875rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    box-shadow: var(--shadow-modal, 0px 32px 64px rgba(25,28,29,0.08));
    transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
    z-index: 100;
    white-space: nowrap;
    pointer-events: none;
    font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
  }

  .dbf-toast.show { transform: translateX(-50%) translateY(0); }

  .dbf-toast-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--success, #16a34a);
    flex-shrink: 0;
  }
`;

function DbIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v4c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      <path d="M3 9v4c0 1.66 4.03 3 9 3s9-1.34 9-3V9" />
      <path d="M3 13v4c0 1.66 4.03 3 9 3s9-1.34 9-3v-4" />
    </svg>
  );
}

function DeployIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

export default function CreateDatabaseForm({ onSubmit, onCancel }) {
  const [dbName, setDbName] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [pgVersion, setPgVersion] = useState("17");
  const [selectedSize, setSelectedSize] = useState("pro");
  const [deploymentOption, setDeploymentOption] = useState("multi-az-cluster");
  const [readReplicas, setReadReplicas] = useState("1");
  const [backup, setBackup] = useState(true);
  const [nameError, setNameError] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success
  const [toastVisible, setToastVisible] = useState(false);

  const size = SIZES.find((s) => s.id === selectedSize);
  const baseCost = size ? size.price : 79;
  const replicasCount = Number(readReplicas);
  const deploymentMultiplier =
    deploymentOption === "multi-az-cluster"
      ? 1 + replicasCount
      : deploymentOption === "multi-az-instance"
        ? 2
        : 1;
  const deploymentOptionMap = {
  "multi-az-cluster":   "MULTI_AZ_CLUSTER",
  "multi-az-instance":  "MULTI_AZ_INSTANCE",
  "single-az-instance": "SINGLE_AZ_INSTANCE",
};
  const totalCost = baseCost * deploymentMultiplier + (backup ? 5 : 0);

  const previewName = dbName.trim() ? `db_${dbName.trim()}` : "db_my_production_db";
  const baseHost = `${previewName}.${region}.db.ourplatform.com`;
  const previewConnections =
    deploymentOption === "multi-az-cluster"
      ? [
          { key: "rw", label: "rw", value: `postgres://sk_live_••••••••@rw.${baseHost}` },
          { key: "ro", label: "ro", value: `postgres://sk_live_••••••••@ro.${baseHost}` },
          { key: "both", label: "both", value: `postgres://sk_live_••••••••@cluster.${baseHost}` },
        ]
      : [{ key: "rw", label: "rw", value: `postgres://sk_live_••••••••@rw.${baseHost}` }];

  function validateName(val) {
    if (!val.trim()) { setNameError("Database name is required."); return false; }
    if (!/^[a-z0-9_]+$/.test(val.trim())) { setNameError("Lowercase letters, numbers, and underscores only."); return false; }
    setNameError("");
    return true;
  }

  function handleNameChange(e) {
    const val = e.target.value;
    setDbName(val);
    if (nameError) validateName(val);
  }

  async function handleSubmit() {
    if (!validateName(dbName)) return;
    setStatus("loading");

    const payload = {
      name: `${dbName.trim()}`,
      region,
      pgVersion,
      size: selectedSize,
      deploymentOption:deploymentOptionMap[deploymentOption],
      readReplicas: deploymentOption === "multi-az-cluster" ? replicasCount : 0,
      backup,
      };
      try {
        await clusterService.createCluster(payload);
        setStatus("success");
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 4000);
        onSubmit?.();
      } catch (err) {
        setStatus("idle");
    }
  }

  function handleCancel() {
    setDbName("");
    setNameError("");
    setStatus("idle");
    onCancel?.();
  }

  return (
    <>
      <style>{styles}
      </style>

      <div className="dbf-wrap">
        <div className="dbf-card">

          {/* Header */}
          <div className="dbf-header">
            <div className="dbf-header-icon"><DbIcon /></div>
            <div>
              <h2>Create new database</h2>
              <p>Deploy an isolated PostgreSQL cluster on your account</p>
            </div>
          </div>

          {/* Body */}
          <div className="dbf-body">

            <div className="dbf-section-label">Basic configuration</div>

            {/* DB Name */}
            <div className="dbf-field">
              <label className="dbf-label">Database name <span className="dbf-req">*</span></label>
              <div className="dbf-input-wrap">
                <span className="dbf-prefix">db_</span>
                <input
                  type="text"
                  className={`dbf-input mono has-prefix${nameError ? " invalid" : ""}`}
                  placeholder="my_production_db"
                  value={dbName}
                  onChange={handleNameChange}
                  onBlur={() => validateName(dbName)}
                />
              </div>
              {nameError && <div className="dbf-field-error">{nameError}</div>}
            </div>

            {/* Region + PG Version */}
            <div className="dbf-field-row">
              <div>
                <label className="dbf-label">Region <span className="dbf-req">*</span></label>
                <div className="dbf-select-wrap">
                  <select className="dbf-select" value={region} onChange={(e) => setRegion(e.target.value)}>
                    {REGIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="dbf-label">PostgreSQL version</label>
                <div className="dbf-version-grid">
                  {PG_VERSIONS.map((v) => (
                    <button
                      key={v}
                      className={`dbf-version-chip${pgVersion === v ? " selected" : ""}`}
                      onClick={() => setPgVersion(v)}
                    >
                      {v}
                      {v === "18" && <span className="dbf-badge">Latest</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="dbf-section-label" style={{ marginTop: "1.75rem" }}>Compute &amp; storage</div>

            {/* Size Cards */}
            <div className="dbf-field">
              <label className="dbf-label">Instance size <span className="dbf-req">*</span></label>
              <div className="dbf-size-grid">
                {SIZES.map((s) => (
                  <button
                    key={s.id}
                    className={`dbf-size-card${selectedSize === s.id ? " selected" : ""}`}
                    onClick={() => setSelectedSize(s.id)}
                  >
                    <div className="dbf-size-name">{s.name}</div>
                    <div className="dbf-size-specs">{s.cpu}<br />{s.ram}<br />{s.storage}</div>
                    <div className="dbf-size-price">${s.price} / mo</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="dbf-section-label" style={{ marginTop: "1.75rem" }}>Availability &amp; durability</div>

            {/* Deployment options (reuse size card style) */}
            <div className="dbf-field">
              <label className="dbf-label">Deployment option <span className="dbf-req">*</span></label>
              <div className="dbf-size-grid">
                {DEPLOYMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    className={`dbf-size-card${deploymentOption === opt.id ? " selected" : ""}`}
                    onClick={() => setDeploymentOption(opt.id)}
                  >
                    <div className="dbf-size-name">{opt.name}</div>
                    <div className="dbf-size-specs">{opt.description}</div>
                    <div className="dbf-size-price">{opt.details}</div>
                  </button>
                ))}
              </div>
            </div>

            {deploymentOption === "multi-az-cluster" && (
              <div className="dbf-field">
                <label className="dbf-label">Read replicas (max 3)</label>
                <div className="dbf-select-wrap">
                  <select
                    className="dbf-select"
                    value={readReplicas}
                    onChange={(e) => setReadReplicas(e.target.value)}
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                </div>
              </div>
            )}

            <div className="dbf-section-label" style={{ marginTop: "1.75rem" }}>Backups</div>

            {/* Backup Toggle */}
            <div className="dbf-toggle-row">
              <div>
                <div className="dbf-toggle-title">Automated S3 backups</div>
                <div className="dbf-toggle-desc">Daily point-in-time backups with 30-day retention via Barman. +$5/mo.</div>
              </div>
              <label className="dbf-toggle-switch">
                <input type="checkbox" checked={backup} onChange={(e) => setBackup(e.target.checked)} />
                <span className="dbf-toggle-track" />
              </label>
            </div>

            <div className="dbf-section-label" style={{ marginTop: "1.75rem" }}>Connection string preview</div>

            {/* Connection Preview */}
            <ConnectionParameters
              title="Connection preview"
              connections={previewConnections}
              showModeTabs={false}
              description="Use these connection strings in your applications. Rotate credentials regularly and avoid exposing them in client-side code."
            />
          </div>

          {/* Footer */}
          <div className="dbf-footer">
            <div>
              <span className="dbf-cost-label">Estimated monthly cost</span>
              <span className="dbf-cost-value">${totalCost} / mo</span>
            </div>
            <div className="dbf-btn-group">
              <button className="dbf-btn dbf-btn-ghost" onClick={handleCancel}>
                Cancel
              </button>
              <button
                className="dbf-btn dbf-btn-primary"
                onClick={handleSubmit}
                disabled={status === "loading" || status === "success"}
              >
                {status === "loading" && <><SpinnerIcon /> Deploying...</>}
                {status === "success" && <><CheckIcon /> Deployed</>}
                {status === "idle" && <><DeployIcon /> Deploy database</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <div className={`dbf-toast${toastVisible ? " show" : ""}`}>
        <div className="dbf-toast-dot" />
        Provisioning started — your database will be ready in ~60s
      </div>
    </>
  );
}