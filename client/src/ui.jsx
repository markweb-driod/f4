import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import AccessDenied from './pages/AccessDenied';

// Loads JSON from the API and tracks loading / error / 403 state.
export function useApi(url) {
  const [state, setState] = useState({ data: null, error: null, status: 0, loading: !!url });
  const load = useCallback(async () => {
    if (!url) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await api.get(url);
      setState({ data, error: null, status: 200, loading: false });
    } catch (e) {
      setState({ data: null, error: e.message, status: e.status || 0, loading: false });
    }
  }, [url]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

// Renders children once data has loaded; shows the access-denied screen on 403.
export function Loaded({ q, children }) {
  if (q.loading && !q.data) return <div className="loading"><span className="spinner" /> Loading…</div>;
  if (q.status === 403) return <AccessDenied message={q.error} />;
  if (q.error) return <Alert kind="error">{q.error}</Alert>;
  return children(q.data);
}

export function Alert({ kind = 'info', children, onClose }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onClose && <button className="alert-close" onClick={onClose} aria-label="Dismiss">×</button>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

export function Stat({ label, value, hint, tone }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export function RoleBadge({ role }) {
  return <span className={`badge role-${String(role).toLowerCase()}`}>{role}</span>;
}

// Submit handler helper: runs an async action, tracks busy + error.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = useCallback(async (fn) => {
    setBusy(true);
    setError('');
    try { return await fn(); } catch (e) { setError(e.message); return undefined; } finally { setBusy(false); }
  }, []);
  return { busy, error, setError, run };
}

const dtf = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const df = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
export const fmtDateTime = (v) => (v ? dtf.format(new Date(v)) : '—');
export const fmtDate = (v) => (v ? df.format(new Date(v)) : '—');

export function timeLeft(due) {
  const ms = new Date(due).getTime() - Date.now();
  if (ms <= 0) return 'Closed';
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))} min left`;
  if (h < 48) return `${h} h left`;
  return `${Math.floor(h / 24)} days left`;
}

export const fmtSize = (n) => (n == null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

// Value for <input type="datetime-local"> in local time.
export function toLocalInput(d) {
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
