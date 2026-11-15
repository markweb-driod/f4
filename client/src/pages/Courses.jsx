import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Alert, Loaded, Modal, PageHeader, useAction, useApi } from '../ui';
import { CourseCards } from './Dashboard';

function CourseForm({ onClose, onDone }) {
  const [f, setF] = useState({ code: '', title: '', creditUnits: 3, description: '' });
  const a = useAction();
  return (
    <Modal title="New course" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); a.run(async () => { await api.post('/api/v1/courses', f); onDone(`${f.code.toUpperCase()} created. Open it to assign a lecturer and enrol students.`); }); }}>
        <Alert kind="error">{a.error}</Alert>
        <div className="row-2">
          <label className="field"><span>Course code</span><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required maxLength={20} placeholder="CMP 401" /></label>
          <label className="field"><span>Credit units</span><input type="number" min={1} max={12} value={f.creditUnits} onChange={(e) => setF({ ...f, creditUnits: Number(e.target.value) })} /></label>
        </div>
        <label className="field"><span>Title</span><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required maxLength={150} /></label>
        <label className="field"><span>Description</span><textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={a.busy}>Create course</button></div>
      </form>
    </Modal>
  );
}

export default function Courses() {
  const { user, can } = useAuth();
  const q = useApi('/api/v1/courses');
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');
  const admin = user.role === 'Admin';

  return (
    <>
      <PageHeader title={admin ? 'Courses' : 'My courses'}
        subtitle={admin ? 'Create courses, assign lecturers and enrol students.' : user.role === 'Lecturer' ? 'Courses assigned to you.' : 'Courses you are enrolled in.'}
        actions={can('/api/v1/courses', 'CREATE') && <button className="btn btn-primary" onClick={() => setCreating(true)}>New course</button>} />
      <Alert kind="success" onClose={() => setMsg('')}>{msg}</Alert>
      <Loaded q={q}>{(courses) => admin ? (
        <div className="table-wrap card flush">
          <table className="table">
            <thead><tr><th>Code</th><th>Title</th><th>Lecturer(s)</th><th className="num">Units</th><th className="num">Students</th><th className="num">Materials</th><th className="num">Assignments</th></tr></thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id}>
                  <td><Link to={`/courses/${c.id}`}><strong>{c.code}</strong></Link></td>
                  <td>{c.title}</td>
                  <td>{c.lecturers || <span className="muted">Unassigned</span>}</td>
                  <td className="num">{c.creditUnits}</td>
                  <td className="num">{c.studentCount}</td>
                  <td className="num">{c.materialCount}</td>
                  <td className="num">{c.assignmentCount}</td>
                </tr>
              ))}
              {courses.length === 0 && <tr><td colSpan={7} className="empty">No courses yet.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : <CourseCards courses={courses} role={user.role} />}</Loaded>
      {creating && <CourseForm onClose={() => setCreating(false)} onDone={(m) => { setCreating(false); setMsg(m); q.reload(); }} />}
    </>
  );
}
