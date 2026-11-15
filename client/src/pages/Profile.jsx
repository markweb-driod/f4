import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Alert, Loaded, PageHeader, RoleBadge, fmtDateTime, useAction, useApi } from '../ui';

export default function Profile() {
  const { can, endSession } = useAuth();
  const q = useApi('/api/v1/profile');
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const a = useAction();
  const mismatch = f.confirm && f.newPassword !== f.confirm;

  const change = (e) => {
    e.preventDefault();
    if (mismatch) return;
    a.run(async () => {
      const r = await api.put('/api/v1/profile/password', { currentPassword: f.currentPassword, newPassword: f.newPassword });
      // Changing the password revokes every session, including this one.
      endSession(r.message);
    });
  };

  return (
    <>
      <PageHeader title="My profile" />
      <div className="two-col">
        <section className="card">
          <div className="card-head"><h2>Account</h2></div>
          <Loaded q={q}>{(p) => (
            <dl className="details">
              <dt>Name</dt><dd>{p.name}</dd>
              <dt>Username</dt><dd>{p.username}</dd>
              <dt>Active role</dt><dd><RoleBadge role={p.activeRole} /></dd>
              <dt>Assigned roles</dt><dd className="badges">{p.roles.map((r) => <RoleBadge key={r} role={r} />)}</dd>
              <dt>Status</dt><dd>{p.accountStatus}</dd>
              <dt>Last sign-in</dt><dd>{fmtDateTime(p.lastLoginAt)}</dd>
              <dt>Member since</dt><dd>{fmtDateTime(p.createdAt)}</dd>
            </dl>
          )}</Loaded>
        </section>
        {can('/api/v1/profile/password', 'UPDATE') && (
          <section className="card">
            <div className="card-head"><h2>Change password</h2></div>
            <form onSubmit={change}>
              <Alert kind="error">{a.error}</Alert>
              <label className="field"><span>Current password</span><input type="password" autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} required /></label>
              <label className="field"><span>New password</span><input type="password" autoComplete="new-password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} required />
                <small className="muted">At least 8 characters with upper and lower case letters, a number and a symbol.</small></label>
              <label className="field"><span>Confirm new password</span><input type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required />
                {mismatch && <small className="warn-text">Passwords do not match.</small>}</label>
              <button className="btn btn-primary" disabled={a.busy || mismatch}>Change password</button>
              <p className="muted small">You will be signed out of every device after changing your password.</p>
            </form>
          </section>
        )}
      </div>
    </>
  );
}
