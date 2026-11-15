import { useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Alert, Loaded, Modal, PageHeader, RoleBadge, fmtDateTime, useAction, useApi } from '../ui';

const PW_HINT = 'At least 8 characters with upper and lower case letters, a number and a symbol.';

function RolePicker({ all, value, onChange }) {
  return (
    <div className="checks">
      {all.map((r) => (
        <label key={r} className="check">
          <input type="checkbox" checked={value.includes(r)} onChange={(e) => onChange(e.target.checked ? [...value, r] : value.filter((x) => x !== r))} />
          <span>{r}</span>
        </label>
      ))}
    </div>
  );
}

function CreateUser({ roles, onDone, onClose }) {
  const [f, setF] = useState({ fullName: '', username: '', password: '', roles: ['Student'] });
  const a = useAction();
  const submit = (e) => { e.preventDefault(); a.run(async () => { await api.post('/api/v1/users', f); onDone(`Account created for ${f.fullName}.`); }); };
  return (
    <Modal title="Create user account" onClose={onClose}>
      <form onSubmit={submit}>
        <Alert kind="error">{a.error}</Alert>
        <label className="field"><span>Full name</span><input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} required maxLength={100} /></label>
        <label className="field"><span>Username (institutional email)</span><input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required maxLength={50} /></label>
        <label className="field"><span>Initial password</span><input type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /><small className="muted">{PW_HINT}</small></label>
        <div className="field"><span>Roles</span><RolePicker all={roles} value={f.roles} onChange={(r) => setF({ ...f, roles: r })} /></div>
        <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={a.busy}>Create account</button></div>
      </form>
    </Modal>
  );
}

function EditUser({ user, roles, self, onDone, onClose }) {
  const [name, setName] = useState(user.name);
  const [status, setStatus] = useState(user.accountStatus);
  const [userRoles, setUserRoles] = useState(user.roles);
  const [pw, setPw] = useState('');
  const a = useAction();
  const save = (e) => {
    e.preventDefault();
    a.run(async () => {
      await api.put(`/api/v1/users/${user.id}`, { fullName: name, accountStatus: status });
      if (userRoles.join() !== user.roles.join()) await api.put(`/api/v1/users/${user.id}/roles`, { roles: userRoles });
      if (pw) await api.post(`/api/v1/users/${user.id}/reset-password`, { password: pw });
      onDone(`Saved changes to ${name}.`);
    });
  };
  return (
    <Modal title={`Edit ${user.name}`} onClose={onClose}>
      <form onSubmit={save}>
        <Alert kind="error">{a.error}</Alert>
        <p className="muted small">{user.username}</p>
        <label className="field"><span>Full name</span><input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} /></label>
        <label className="field"><span>Account status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={self}>
            <option>Active</option><option>Suspended</option>
          </select>
          <small className="muted">Suspending an account ends its current sessions at once.</small>
        </label>
        <div className="field"><span>Roles</span><RolePicker all={roles} value={userRoles} onChange={setUserRoles} />
          <small className="muted">A user holding several roles picks one at sign-in. Separation of duty stops them being lecturer and student of the same course.</small></div>
        <label className="field"><span>Reset password (optional)</span><input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Leave blank to keep the current password" /><small className="muted">{PW_HINT}</small></label>
        <div className="modal-actions">
          {user.locked && <button type="button" className="btn" onClick={() => a.run(async () => { await api.post(`/api/v1/users/${user.id}/unlock`); onDone(`${user.name} unlocked.`); })}>Unlock account</button>}
          <span className="grow" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={a.busy}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Users() {
  const { user: me, can } = useAuth();
  const q = useApi('/api/v1/users');
  const rolesQ = useApi(can('/api/v1/roles', 'READ') ? '/api/v1/roles' : null);
  const roleNames = rolesQ.data?.roles.map((r) => r.name) || ['Admin', 'Lecturer', 'Student'];
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState({ text: '', role: '' });
  const del = useAction();

  const done = (m) => { setModal(null); setMsg(m); q.reload(); };
  const rows = useMemo(() => (q.data || []).filter((u) => {
    const t = filter.text.toLowerCase();
    return (!t || u.name.toLowerCase().includes(t) || u.username.includes(t)) && (!filter.role || u.roles.includes(filter.role));
  }), [q.data, filter]);

  return (
    <>
      <PageHeader title="Users" subtitle="Create accounts, assign roles and suspend access."
        actions={can('/api/v1/users', 'CREATE') && <button className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>New user</button>} />
      <Alert kind="success" onClose={() => setMsg('')}>{msg}</Alert>
      <Alert kind="error" onClose={() => del.setError('')}>{del.error}</Alert>
      <div className="toolbar">
        <input type="search" placeholder="Search name or username" value={filter.text} onChange={(e) => setFilter({ ...filter, text: e.target.value })} />
        <select value={filter.role} onChange={(e) => setFilter({ ...filter, role: e.target.value })}>
          <option value="">All roles</option>{roleNames.map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>
      <Loaded q={q}>{() => (
        <div className="table-wrap card flush">
          <table className="table">
            <thead><tr><th>Name</th><th>Username</th><th>Roles</th><th>Status</th><th>Last sign-in</th><th /></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong>{u.id === me.id && <span className="muted small"> (you)</span>}</td>
                  <td className="muted">{u.username}</td>
                  <td><div className="badges">{u.roles.map((r) => <RoleBadge key={r} role={r} />)}</div></td>
                  <td>
                    <span className={`status status-${u.accountStatus.toLowerCase()}`}>{u.accountStatus}</span>
                    {u.locked && <span className="status status-locked">Locked</span>}
                  </td>
                  <td className="muted small">{fmtDateTime(u.lastLoginAt)}</td>
                  <td className="row-actions">
                    {can('/api/v1/users', 'UPDATE') && <button className="btn btn-sm" onClick={() => setModal({ type: 'edit', user: u })}>Edit</button>}
                    {can('/api/v1/users', 'DELETE') && u.id !== me.id && (
                      <button className="btn btn-sm btn-danger-ghost" disabled={del.busy} onClick={() => {
                        if (window.confirm(`Delete ${u.name}? Their submissions and grades are deleted too. This cannot be undone.`)) {
                          del.run(async () => { await api.del(`/api/v1/users/${u.id}`); setMsg(`${u.name} deleted.`); q.reload(); });
                        }
                      }}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="empty">No users match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}</Loaded>
      {modal?.type === 'create' && <CreateUser roles={roleNames} onDone={done} onClose={() => setModal(null)} />}
      {modal?.type === 'edit' && <EditUser user={modal.user} roles={roleNames} self={modal.user.id === me.id} onDone={done} onClose={() => setModal(null)} />}
    </>
  );
}
