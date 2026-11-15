import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { Empty, Loaded, PageHeader, Stat, fmtDateTime, timeLeft, useApi } from '../ui';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function CourseCards({ courses, role }) {
  if (!courses.length) return <Empty>{role === 'Student' ? 'You are not enrolled in any course yet.' : 'No courses are assigned to you yet.'}</Empty>;
  return (
    <div className="course-grid">
      {courses.map((c) => (
        <Link key={c.id} to={`/courses/${c.id}`} className="course-card">
          <div className="course-code">{c.code}</div>
          <div className="course-title">{c.title}</div>
          <div className="course-meta">{c.lecturers || 'No lecturer assigned'}</div>
          <div className="course-foot">
            <span>{c.materialCount} materials</span>
            <span>{c.assignmentCount} assignments</span>
            {role !== 'Student' && <span>{c.studentCount} students</span>}
          </div>
        </Link>
      ))}
    </div>
  );
}

function AdminDashboard() {
  const users = useApi('/api/v1/users');
  const courses = useApi('/api/v1/courses');
  const summary = useApi('/api/v1/audit-logs/summary');
  const denied = useApi('/api/v1/audit-logs?decision=DENIED&limit=8');
  const u = users.data || [];
  return (
    <>
      <div className="stats">
        <Stat label="User accounts" value={u.length || '—'} hint={`${u.filter((x) => x.accountStatus !== 'Active').length} suspended · ${u.filter((x) => x.locked).length} locked`} />
        <Stat label="Courses" value={courses.data?.length ?? '—'} hint="Across all departments" />
        <Stat label="Denied requests (24 h)" value={summary.data?.denied24h ?? '—'} tone={summary.data?.denied24h ? 'warn' : undefined} hint={`${summary.data?.failedLogins24h ?? 0} failed sign-ins`} />
        <Stat label="Logged decisions" value={summary.data?.total ?? '—'} hint={`${summary.data?.denied ?? 0} denied in total`} />
      </div>
      <div className="two-col">
        <section className="card">
          <div className="card-head"><h2>Recent denied attempts</h2><Link to="/audit?decision=DENIED">Open audit log</Link></div>
          <Loaded q={denied}>{(d) => (d.rows.length === 0 ? <Empty>No denied attempts recorded.</Empty> : (
            <ul className="event-list">
              {d.rows.map((r) => (
                <li key={r.id}>
                  <span className="dot dot-denied" />
                  <div>
                    <div><strong>{r.username || 'anonymous'}</strong> {r.roleName ? `(${r.roleName})` : ''} · <code>{r.action}</code> {r.resource}</div>
                    <div className="muted small">{r.reason} · {fmtDateTime(r.createdAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          ))}</Loaded>
        </section>
        <section className="card">
          <div className="card-head"><h2>Most denied users (7 days)</h2></div>
          {summary.data?.topDenied?.length ? (
            <table className="table compact">
              <thead><tr><th>User</th><th className="num">Denials</th></tr></thead>
              <tbody>{summary.data.topDenied.map((t) => <tr key={t.username}><td>{t.username}</td><td className="num">{t.denials}</td></tr>)}</tbody>
            </table>
          ) : <Empty>Nothing to investigate.</Empty>}
          <div className="quick-links">
            <Link className="btn" to="/users">Manage users</Link>
            <Link className="btn" to="/courses">Manage courses</Link>
            <Link className="btn" to="/roles">Edit permissions</Link>
          </div>
        </section>
      </div>
    </>
  );
}

function LecturerDashboard() {
  const courses = useApi('/api/v1/courses');
  const assignments = useApi('/api/v1/assignments');
  const open = (assignments.data || []).filter((a) => !a.closed);
  return (
    <>
      <div className="stats">
        <Stat label="Assigned courses" value={courses.data?.length ?? '—'} />
        <Stat label="Students taught" value={courses.data ? courses.data.reduce((s, c) => s + c.studentCount, 0) : '—'} />
        <Stat label="Open assignments" value={assignments.data ? open.length : '—'} />
        <Stat label="Submissions received" value={assignments.data ? assignments.data.reduce((s, a) => s + Number(a.submissionCount || 0), 0) : '—'} />
      </div>
      <section className="section">
        <h2>My courses</h2>
        <Loaded q={courses}>{(c) => <CourseCards courses={c} role="Lecturer" />}</Loaded>
      </section>
      <section className="card">
        <div className="card-head"><h2>Open assignments</h2><Link to="/assignments">All assignments</Link></div>
        {open.length === 0 ? <Empty>No open assignments.</Empty> : (
          <table className="table">
            <thead><tr><th>Assignment</th><th>Course</th><th>Deadline</th><th className="num">Submitted</th></tr></thead>
            <tbody>{open.map((a) => (
              <tr key={a.id}><td><Link to={`/courses/${a.courseID}?tab=assignments`}>{a.title}</Link></td><td>{a.courseCode}</td><td>{fmtDateTime(a.dueAt)} <span className="muted small">({timeLeft(a.dueAt)})</span></td><td className="num">{a.submissionCount}/{a.studentCount}</td></tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </>
  );
}

function StudentDashboard() {
  const courses = useApi('/api/v1/courses');
  const assignments = useApi('/api/v1/assignments');
  const grades = useApi('/api/v1/grades/mine');
  const pending = (assignments.data || []).filter((a) => !a.closed && !a.submissionID);
  return (
    <>
      <div className="stats">
        <Stat label="Enrolled courses" value={courses.data?.length ?? '—'} />
        <Stat label="Pending assignments" value={assignments.data ? pending.length : '—'} tone={pending.length ? 'warn' : undefined} />
        <Stat label="Submitted" value={assignments.data ? assignments.data.filter((a) => a.submissionID).length : '—'} />
        <Stat label="Released grades" value={grades.data?.length ?? '—'} />
      </div>
      <section className="card">
        <div className="card-head"><h2>Due soon</h2><Link to="/assignments">All assignments</Link></div>
        {pending.length === 0 ? <Empty>You are all caught up.</Empty> : (
          <ul className="event-list">
            {pending.map((a) => (
              <li key={a.id}>
                <span className="dot dot-warn" />
                <div className="grow">
                  <div><Link to={`/courses/${a.courseID}?tab=assignments`}><strong>{a.title}</strong></Link> · {a.courseCode}</div>
                  <div className="muted small">Due {fmtDateTime(a.dueAt)} · {timeLeft(a.dueAt)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="section">
        <h2>My courses</h2>
        <Loaded q={courses}>{(c) => <CourseCards courses={c} role="Student" />}</Loaded>
      </section>
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const sub = {
    Admin: 'System overview, security activity and administration.',
    Lecturer: 'Your courses, open assignments and submissions.',
    Student: 'Your courses, deadlines and results.',
  }[user.role];
  return (
    <>
      <PageHeader title={`${greeting()}, ${user.name.replace(/\s*\(.*\)$/, '')}`} subtitle={sub} />
      {user.role === 'Admin' && <AdminDashboard />}
      {user.role === 'Lecturer' && <LecturerDashboard />}
      {user.role === 'Student' && <StudentDashboard />}
      {!['Admin', 'Lecturer', 'Student'].includes(user.role) && <Empty>Your role has no dashboard. Use the menu to open the pages available to you.</Empty>}
    </>
  );
}
