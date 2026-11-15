import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Alert, RoleBadge } from '../ui';

const ROLE_HELP = {
  Admin: 'Manage users, roles, courses and audit logs',
  Lecturer: 'Teach your assigned courses and record grades',
  Student: 'Study your enrolled courses and submit work',
};

// Fig. 4.1: login page. Errors stay general so usernames cannot be discovered.
export default function Login() {
  const { login, notice, setNotice } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e, role) {
    e?.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await login(username, password, role);
      if (r.chooseRole) setRoles(r.roles);
      // Always land on the dashboard, never on a page left over from a previous session.
      else navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      setRoles(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-intro">
        <div className="login-brand">
          <svg viewBox="0 0 32 32" width="40" height="40" aria-hidden="true"><rect width="32" height="32" rx="8" fill="currentColor" /><path d="M16 7l9 4.5-9 4.5-9-4.5z" fill="#134e4a" /><path d="M10 14v5c0 2 3 3.5 6 3.5s6-1.5 6-3.5v-5" stroke="#134e4a" strokeWidth="2" fill="none" /></svg>
          <span>SecureLearn</span>
        </div>
        <h1>Secure e-learning for tertiary institutions</h1>
        <p>Every request is checked against your role. Students, lecturers and administrators each see only the tools their duties require.</p>
        <ul className="login-points">
          <li>Role-based access control on every API call</li>
          <li>Signed 30-minute session tokens</li>
          <li>Every access decision recorded in an audit log</li>
        </ul>
      </section>

      <section className="login-card-wrap">
        <div className="login-card">
          {!roles ? (
            <form onSubmit={submit} noValidate>
              <h2>Sign in</h2>
              <p className="muted">Use your institutional email and password.</p>
              <Alert kind="info" onClose={() => setNotice('')}>{notice}</Alert>
              <Alert kind="error">{error}</Alert>
              <label className="field">
                <span>Username</span>
                <input type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="name@nsuk.edu.ng" required autoFocus />
              </label>
              <label className="field">
                <span>Password</span>
                <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </label>
              <button className="btn btn-primary btn-block" disabled={busy || !username || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
              <p className="muted small login-foot">After 5 failed attempts the account is locked for 15 minutes.</p>
            </form>
          ) : (
            <div>
              <h2>Choose a role</h2>
              <p className="muted">Your account holds more than one role. Pick the one to activate for this session. You can sign out and switch later.</p>
              <Alert kind="error">{error}</Alert>
              <div className="role-choices">
                {roles.map((r) => (
                  <button key={r} className="role-choice" disabled={busy} onClick={() => submit(null, r)}>
                    <RoleBadge role={r} />
                    <span>{ROLE_HELP[r] || `Continue as ${r}`}</span>
                  </button>
                ))}
              </div>
              <button className="btn btn-ghost" onClick={() => { setRoles(null); setPassword(''); }}>Back</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
