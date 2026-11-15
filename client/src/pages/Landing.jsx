import { Link } from 'react-router-dom';

const FEATURES = [
  {
    title: 'Role-based access control',
    body: 'Every request is re-checked against the RBAC96 model — users, roles and permissions, not hard-coded checks.',
  },
  {
    title: 'Separation of duty',
    body: 'A lecturer on a course cannot also be enrolled as its student, and grades can only move through controlled stored procedures.',
  },
  {
    title: 'Database-level isolation',
    body: "The app's own database account has read-only access to grades. Writes happen only through audited stored procedures.",
  },
  {
    title: 'Full audit trail',
    body: 'Every allow and deny decision, sign-in and sign-out is logged — filterable by user, resource, decision and date.',
  },
];

const ROLES = [
  { role: 'Admin', blurb: 'Manage users, roles, permissions, courses and the audit log.' },
  { role: 'Lecturer', blurb: 'Teach assigned courses: post materials, set assignments, record and release grades.' },
  { role: 'Student', blurb: 'Study enrolled courses, submit work and view released grades.' },
];

const DEMO_ACCOUNTS = [
  { role: 'Admin', username: 'admin@nsuk.edu.ng', password: 'Admin@12345' },
  { role: 'Lecturer', username: 'n.ajumobi@nsuk.edu.ng', password: 'Lecturer@123' },
  { role: 'Student', username: 'peace.o@student.nsuk.edu.ng', password: 'Student@123' },
  { role: 'Student + Lecturer', username: 'ta.john@nsuk.edu.ng', password: 'Assist@123' },
];

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-brand">
          <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><rect width="32" height="32" rx="8" fill="currentColor" /><path d="M16 7l9 4.5-9 4.5-9-4.5z" fill="#0b524b" /><path d="M10 14v5c0 2 3 3.5 6 3.5s6-1.5 6-3.5v-5" stroke="#0b524b" strokeWidth="2" fill="none" /></svg>
          <span>SecureLearn</span>
        </div>
        <nav className="landing-nav-links">
          <a href="#features">Security model</a>
          <a href="#roles">Roles</a>
          <a href="#demo">Demo accounts</a>
        </nav>
        <Link className="btn btn-primary" to="/login">Sign in</Link>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-glow" aria-hidden="true" />
        <span className="landing-eyebrow">B.Sc. project · Nasarawa State University, Keffi</span>
        <h1>Secure e-learning, built on role-based access control</h1>
        <p className="landing-lead">
          SecureLearn gives students, lecturers and administrators exactly the tools their duties
          require — nothing more — with every decision enforced server-side and recorded to an
          audit log.
        </p>
        <div className="landing-cta">
          <Link className="btn btn-primary btn-lg" to="/login">Sign in to SecureLearn</Link>
          <a className="btn btn-ghost btn-lg" href="#demo">Explore with a demo account</a>
        </div>
      </section>

      <section id="features" className="landing-section">
        <h2 className="landing-section-title">How the security model works</h2>
        <div className="landing-grid">
          {FEATURES.map((f) => (
            <div className="landing-card" key={f.title}>
              <h3>{f.title}</h3>
              <p className="muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="roles" className="landing-section landing-section-alt">
        <h2 className="landing-section-title">One system, three roles</h2>
        <div className="landing-grid landing-grid-3">
          {ROLES.map((r) => (
            <div className="landing-role" key={r.role}>
              <span className={`badge role-${r.role.split(' ')[0].toLowerCase()}`}>{r.role}</span>
              <p className="muted">{r.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="demo" className="landing-section">
        <h2 className="landing-section-title">Try it with a demo account</h2>
        <p className="muted landing-demo-note">
          This deployment is seeded with demo data for evaluation. These are development test
          values — change them before any real use.
        </p>
        <div className="landing-demo-grid">
          {DEMO_ACCOUNTS.map((d) => (
            <div className="landing-demo-card" key={d.username}>
              <span className={`badge role-${d.role.split(' ')[0].toLowerCase()}`}>{d.role}</span>
              <div className="landing-demo-field">
                <span className="muted small">Username</span>
                <code>{d.username}</code>
              </div>
              <div className="landing-demo-field">
                <span className="muted small">Password</span>
                <code>{d.password}</code>
              </div>
              <Link className="btn btn-sm" to={{ pathname: '/login' }} state={{ prefill: d }}>Use this account</Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <p className="muted small">
          Design and Implementation of a Secure E-Learning System Using Role-Based Access Control
          for Tertiary Institutions.
        </p>
      </footer>
    </div>
  );
}
