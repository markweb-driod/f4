import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Alert, RoleBadge } from '../ui';

const ROLE_HELP = {
  Admin: 'Manage users, roles, courses and audit logs',
  Lecturer: 'Teach your assigned courses and record grades',
  Student: 'Study your enrolled courses and submit work',
};

const DEMO_ACCOUNTS = [
  { role: 'Admin', username: 'admin@nsuk.edu.ng', password: 'Admin@12345' },
  { role: 'Lecturer', username: 'n.ajumobi@nsuk.edu.ng', password: 'Lecturer@123' },
  { role: 'Student', username: 'peace.o@student.nsuk.edu.ng', password: 'Student@123' },
  { role: 'Student', username: 'ta.john@nsuk.edu.ng', password: 'Assist@123', label: 'Student + Lecturer' },
];

// Fig. 4.1: login page. Errors stay general so usernames cannot be discovered.
export default function Login() {
  const { login, notice, setNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state?.prefill;
  const [username, setUsername] = useState(prefill?.username || '');
  const [password, setPassword] = useState(prefill?.password || '');
  const [roles, setRoles] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [justFilled, setJustFilled] = useState(false);
  const cardRef = useRef(null);

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

  function fillDemo(d) {
    setUsername(d.username);
    setPassword(d.password);
    setError('');
    setRoles(null);
    setJustFilled(true);
    setTimeout(() => setJustFilled(false), 1200);
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <div className="login-page">
      <section className="login-intro">
        <div className="login-intro-glow" aria-hidden="true" />
        <Link className="login-brand" to="/">
          <svg viewBox="0 0 32 32" width="40" height="40" aria-hidden="true"><rect width="32" height="32" rx="8" fill="currentColor" /><path d="M16 7l9 4.5-9 4.5-9-4.5z" fill="#134e4a" /><path d="M10 14v5c0 2 3 3.5 6 3.5s6-1.5 6-3.5v-5" stroke="#134e4a" strokeWidth="2" fill="none" /></svg>
          <span>SecureLearn</span>
        </Link>
        <h1>Secure e-learning for tertiary institutions</h1>
        <p>Every request is checked against your role. Students, lecturers and administrators each see only the tools their duties require.</p>
        <ul className="login-points">
          <li>Role-based access control on every API call</li>
          <li>Signed 30-minute session tokens</li>
          <li>Every access decision recorded in an audit log</li>
        </ul>

        <div className="login-demo-box">
          <span className="muted small">Demo accounts — tap to auto-fill</span>
          <div className="login-demo-list">
            {DEMO_ACCOUNTS.map((d) => (
              <button key={d.username} type="button" className="login-demo-row" onClick={() => fillDemo(d)}>
                <RoleBadge role={d.role} />
                {d.label && <span className="muted small">{d.label}</span>}
                <span className="login-demo-row-creds">
                  <span className="mono">{d.username}</span>
                  <span className="mono muted">{d.password}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="login-card-wrap">
        <div className="login-card" ref={cardRef}>
          {!roles ? (
            <form onSubmit={submit} noValidate>
              <h2>Sign in</h2>
              <p className="muted">Use your institutional email and password.</p>
              <Alert kind="info" onClose={() => setNotice('')}>{notice}</Alert>
              <Alert kind="error">{error}</Alert>
              {justFilled && <Alert kind="success">Demo credentials filled in — click Sign in.</Alert>}
              <label className="field">
                <span>Username</span>
                <input type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="name@nsuk.edu.ng" required autoFocus className={justFilled ? 'field-flash' : ''} />
              </label>
              <label className="field">
                <span>Password</span>
                <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className={justFilled ? 'field-flash' : ''} />
              </label>
              <button className="btn btn-primary btn-block" disabled={busy || !username || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
              <p className="muted small login-foot">After 5 failed attempts the account is locked for 15 minutes.</p>
              <p className="muted small login-foot"><Link to="/">← Back to home</Link></p>
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
