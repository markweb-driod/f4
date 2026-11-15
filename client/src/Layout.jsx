import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { tokenClaims } from './api';
import { RoleBadge } from './ui';

const I = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  users: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z',
  log: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  task: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  grade: 'M12 2l3 6.5 7 .9-5.2 4.8 1.4 7L12 17.8 5.8 21.2l1.4-7L2 9.4l7-.9z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  menu: 'M3 6h18M3 12h18M3 18h18',
};
export const Icon = ({ name, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={I[name]} />
  </svg>
);

// Menu items are built from the permissions of the active role: users only see what they may use.
function menuFor(can, role) {
  const items = [{ to: '/', label: 'Dashboard', icon: 'home' }];
  if (can('/api/v1/users', 'READ')) items.push({ to: '/users', label: 'Users', icon: 'users' });
  if (can('/api/v1/roles', 'READ')) items.push({ to: '/roles', label: 'Roles & permissions', icon: 'shield' });
  if (can('/api/v1/courses', 'READ')) items.push({ to: '/courses', label: role === 'Admin' ? 'Courses' : 'My courses', icon: 'book' });
  if (can('/api/v1/assignments', 'READ') && role !== 'Admin') items.push({ to: '/assignments', label: 'Assignments', icon: 'task' });
  if (can('/api/v1/grades/submit', 'CREATE')) items.push({ to: '/grades/entry', label: 'Grade entry', icon: 'grade' });
  else if (can('/api/v1/grades', 'READ') && role === 'Student') items.push({ to: '/grades', label: 'My grades', icon: 'grade' });
  if (can('/api/v1/audit-logs', 'READ')) items.push({ to: '/audit', label: 'Audit log', icon: 'log' });
  if (can('/api/v1/profile', 'READ')) items.push({ to: '/profile', label: 'My profile', icon: 'user' });
  return items;
}

function SessionTimer() {
  const { token } = useAuth();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t); }, []);
  const exp = tokenClaims(token)?.exp;
  if (!exp) return null;
  const mins = Math.max(0, Math.round((exp * 1000 - now) / 60000));
  return <span className={`session-timer ${mins <= 5 ? 'warn' : ''}`} title="Session token lifetime. It is renewed automatically while you are active.">Session: {mins} min</span>;
}

export default function Layout({ children }) {
  const { user, can, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const items = menuFor(can, user.role);

  return (
    <div className={`shell ${open ? 'nav-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="30" height="30"><rect width="32" height="32" rx="8" fill="currentColor" /><path d="M16 7l9 4.5-9 4.5-9-4.5z" fill="#fff" /><path d="M10 14v5c0 2 3 3.5 6 3.5s6-1.5 6-3.5v-5" stroke="#fff" strokeWidth="2" fill="none" /></svg>
          </span>
          <div>
            <div className="brand-name">SecureLearn</div>
            <div className="brand-sub">RBAC e-learning</div>
          </div>
        </div>
        <nav aria-label="Main">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.to === '/'} className="nav-link">
              <Icon name={it.icon} /> <span>{it.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="who">
            <div className="who-name">{user.name}</div>
            <RoleBadge role={user.role} />
          </div>
          <button className="nav-link logout" onClick={logout}><Icon name="out" /> <span>Sign out</span></button>
        </div>
      </aside>
      <div className="scrim" onClick={() => setOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(!open)} aria-label="Open menu"><Icon name="menu" size={20} /></button>
          <div className="topbar-spacer" />
          <SessionTimer />
          <span className="topbar-user"><span className="hide-sm">{user.name} · </span><RoleBadge role={user.role} /></span>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
