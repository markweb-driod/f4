import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loaded, PageHeader, RoleBadge, fmtDateTime, useApi } from '../ui';

// Fig. 4.6: audit log viewer with filters for user, resource, decision and date.
export default function Audit() {
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState({
    user: params.get('user') || '', resource: params.get('resource') || '', decision: params.get('decision') || '',
    from: params.get('from') || '', to: params.get('to') || '',
  });
  const page = Number(params.get('page') || 1);

  const url = useMemo(() => {
    const p = new URLSearchParams();
    for (const k of ['user', 'resource', 'decision']) if (params.get(k)) p.set(k, params.get(k));
    if (params.get('from')) p.set('from', new Date(`${params.get('from')}T00:00:00`).toISOString());
    if (params.get('to')) p.set('to', new Date(`${params.get('to')}T23:59:59`).toISOString());
    p.set('page', String(page));
    p.set('limit', '25');
    return `/api/v1/audit-logs?${p}`;
  }, [params, page]);
  const q = useApi(url);

  const apply = (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    Object.entries(form).forEach(([k, v]) => v && p.set(k, v));
    setParams(p);
  };
  const go = (n) => { const p = new URLSearchParams(params); p.set('page', String(n)); setParams(p); };

  return (
    <>
      <PageHeader title="Audit log" subtitle="Every access decision made by the RBAC middleware, newest first. Records cannot be edited or deleted by the application." />
      <form className="toolbar filters" onSubmit={apply}>
        <input type="search" placeholder="User or ID" value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} />
        <input type="search" placeholder="Resource contains…" value={form.resource} onChange={(e) => setForm({ ...form, resource: e.target.value })} />
        <select value={form.decision} onChange={(e) => setForm({ ...form, decision: e.target.value })}>
          <option value="">All decisions</option><option value="ALLOWED">Allowed</option><option value="DENIED">Denied</option>
        </select>
        <label className="inline">From <input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></label>
        <label className="inline">To <input type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} /></label>
        <button className="btn btn-primary">Filter</button>
        <button type="button" className="btn btn-ghost" onClick={() => { setForm({ user: '', resource: '', decision: '', from: '', to: '' }); setParams({}); }}>Clear</button>
      </form>
      <Loaded q={q}>{(d) => (
        <>
          <div className="table-wrap card flush">
            <table className="table compact">
              <thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Resource</th><th>Decision</th><th>Reason</th><th>IP</th></tr></thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.id} className={r.decision === 'DENIED' ? 'row-denied' : ''}>
                    <td className="nowrap small">{fmtDateTime(r.createdAt)}</td>
                    <td>{r.username || <span className="muted">anonymous</span>}</td>
                    <td>{r.roleName ? <RoleBadge role={r.roleName} /> : <span className="muted">—</span>}</td>
                    <td><code>{r.action}</code></td>
                    <td className="mono small">{r.resource}</td>
                    <td><span className={`status ${r.decision === 'DENIED' ? 'status-suspended' : 'status-active'}`}>{r.decision}</span></td>
                    <td className="small">{r.reason || ''}</td>
                    <td className="mono small muted">{r.ipAddress}</td>
                  </tr>
                ))}
                {d.rows.length === 0 && <tr><td colSpan={8} className="empty">No entries match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <span className="muted small">{d.total} entries · page {d.page} of {Math.max(1, Math.ceil(d.total / d.limit))}</span>
            <button className="btn btn-sm" disabled={d.page <= 1} onClick={() => go(d.page - 1)}>Previous</button>
            <button className="btn btn-sm" disabled={d.page * d.limit >= d.total} onClick={() => go(d.page + 1)}>Next</button>
          </div>
        </>
      )}</Loaded>
    </>
  );
}
