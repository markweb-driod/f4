import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Alert, Loaded, Modal, PageHeader, RoleBadge, useAction, useApi } from '../ui';

const ACTIONS = ['CREATE', 'READ', 'UPDATE', 'DELETE'];

// Editable role-permission matrix (Table 4.4). Changes take effect on the next request,
// with no code change, because the middleware reads the matrix from the database.
export default function Roles() {
  const { can } = useAuth();
  const q = useApi('/api/v1/roles');
  const [draft, setDraft] = useState(null);
  const [msg, setMsg] = useState('');
  const [creating, setCreating] = useState(false);
  const a = useAction();
  const editable = can('/api/v1/roles', 'UPDATE');

  useEffect(() => {
    if (q.data) setDraft(Object.fromEntries(q.data.roles.map((r) => [r.id, new Set(q.data.matrix[r.id] || [])])));
  }, [q.data]);

  const resources = useMemo(() => {
    if (!q.data) return [];
    const map = new Map();
    for (const p of q.data.permissions) {
      if (!map.has(p.resource)) map.set(p.resource, {});
      map.get(p.resource)[p.action] = p;
    }
    return [...map.entries()];
  }, [q.data]);

  const locked = (role, p) => role.name === 'Admin' && q.data.adminLocked.includes(`${p.resource}:${p.action}`);
  const dirty = (roleId) => q.data && draft && [...draft[roleId]].sort().join() !== [...(q.data.matrix[roleId] || [])].sort().join();

  function toggle(roleId, pid) {
    setDraft((d) => {
      const next = new Set(d[roleId]);
      next.has(pid) ? next.delete(pid) : next.add(pid);
      return { ...d, [roleId]: next };
    });
  }

  const save = (role) => a.run(async () => {
    await api.put(`/api/v1/roles/${role.id}/permissions`, { permissionIds: [...draft[role.id]] });
    setMsg(`Permissions for ${role.name} saved. They apply from the next request.`);
    q.reload();
  });

  return (
    <>
      <PageHeader title="Roles & permissions" subtitle="Each role receives only the operations its duties need (principle of least privilege)."
        actions={can('/api/v1/roles', 'CREATE') && <button className="btn" onClick={() => setCreating(true)}>New role</button>} />
      <Alert kind="success" onClose={() => setMsg('')}>{msg}</Alert>
      <Alert kind="error" onClose={() => a.setError('')}>{a.error}</Alert>
      <Loaded q={q}>{(data) => draft && (
        <>
          <div className="role-cards">
            {data.roles.map((r) => (
              <div key={r.id} className="role-card">
                <div className="role-card-head"><RoleBadge role={r.name} /><span className="muted small">Level {r.hierarchyLevel}</span></div>
                <p className="small">{r.description || 'No description'}</p>
                <div className="muted small">{r.userCount} user(s) · {draft[r.id].size} permission(s)</div>
                <div className="role-card-actions">
                  {editable && dirty(r.id) && <button className="btn btn-sm btn-primary" disabled={a.busy} onClick={() => save(r)}>Save changes</button>}
                  {editable && dirty(r.id) && <button className="btn btn-sm btn-ghost" onClick={() => setDraft({ ...draft, [r.id]: new Set(data.matrix[r.id] || []) })}>Undo</button>}
                  {!r.core && can('/api/v1/roles', 'DELETE') && (
                    <button className="btn btn-sm btn-danger-ghost" onClick={() => window.confirm(`Delete the ${r.name} role? Users lose it immediately.`) &&
                      a.run(async () => { await api.del(`/api/v1/roles/${r.id}`); setMsg(`${r.name} deleted.`); q.reload(); })}>Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="table-wrap card flush">
            <table className="table matrix">
              <thead>
                <tr><th>Resource</th>{data.roles.map((r) => <th key={r.id} colSpan={4} className="center">{r.name}</th>)}</tr>
                <tr className="sub"><th />{data.roles.map((r) => ACTIONS.map((x) => <th key={r.id + x} className="center" title={x}>{x[0]}</th>))}</tr>
              </thead>
              <tbody>
                {resources.map(([res, acts]) => (
                  <tr key={res}>
                    <td><code>{res}</code></td>
                    {data.roles.map((r) => ACTIONS.map((x) => {
                      const p = acts[x];
                      if (!p) return <td key={r.id + x} className="center muted">·</td>;
                      const on = draft[r.id].has(p.id);
                      const lock = locked(r, p);
                      return (
                        <td key={r.id + x} className={`center ${on ? 'cell-on' : ''}`}>
                          <input type="checkbox" aria-label={`${r.name} ${x} ${res}`} title={lock ? 'Required for administrators' : p.description}
                            checked={on} disabled={!editable || lock} onChange={() => toggle(r.id, p.id)} />
                        </td>
                      );
                    }))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">C = Create, R = Read, U = Update, D = Delete. Ownership checks still apply on top of the matrix: a lecturer acts only on assigned courses and a student only on their own work.</p>
        </>
      )}</Loaded>
      {creating && <NewRole onClose={() => setCreating(false)} onDone={(m) => { setCreating(false); setMsg(m); q.reload(); }} />}
    </>
  );
}

function NewRole({ onClose, onDone }) {
  const [f, setF] = useState({ name: '', hierarchyLevel: 1, description: '' });
  const a = useAction();
  return (
    <Modal title="New role" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); a.run(async () => { await api.post('/api/v1/roles', f); onDone(`Role ${f.name} created. Give it permissions in the matrix.`); }); }}>
        <Alert kind="error">{a.error}</Alert>
        <label className="field"><span>Role name</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={30} placeholder="e.g. Head of Department" /></label>
        <label className="field"><span>Hierarchy level</span><input type="number" min={1} max={10} value={f.hierarchyLevel} onChange={(e) => setF({ ...f, hierarchyLevel: Number(e.target.value) })} /></label>
        <label className="field"><span>Description</span><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={255} /></label>
        <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={a.busy}>Create role</button></div>
      </form>
    </Modal>
  );
}
