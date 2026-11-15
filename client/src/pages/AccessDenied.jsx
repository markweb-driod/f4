import { Link } from 'react-router-dom';
import { useAuth } from '../auth';

// Fig. 4.5: shown when a user opens a page or function outside their role.
export default function AccessDenied({ message }) {
  const { user } = useAuth();
  return (
    <div className="denied">
      <div className="denied-icon" aria-hidden="true">
        <svg viewBox="0 0 48 48" width="56" height="56"><rect x="10" y="21" width="28" height="20" rx="4" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M16 21v-6a8 8 0 0 1 16 0v6" fill="none" stroke="currentColor" strokeWidth="3" /><circle cx="24" cy="31" r="2.5" fill="currentColor" /></svg>
      </div>
      <h1>Access denied</h1>
      <p>{message || 'Your role does not have permission to open this page.'}</p>
      <p className="muted small">
        Signed in as <strong>{user?.name}</strong> with the <strong>{user?.role}</strong> role. This attempt has been recorded in the audit log.
      </p>
      <Link className="btn" to="/">Back to my dashboard</Link>
    </div>
  );
}
