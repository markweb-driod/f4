import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Alert, Empty, Loaded, Modal, PageHeader, fmtDate, fmtDateTime, fmtSize, timeLeft, toLocalInput, useAction, useApi, useUploadLimit } from '../ui';
import { GradeSheet } from './Grades';

const ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.zip,.png,.jpg,.jpeg';

// ---------- Members (Admin) ----------
function Members({ course, reload }) {
  const { can } = useAuth();
  const manage = can('/api/v1/courses/members', 'UPDATE');
  const users = useApi(manage ? '/api/v1/users' : null);
  const [pick, setPick] = useState({ lecturer: '', student: '' });
  const a = useAction();
  const [msg, setMsg] = useState('');

  const lecturerIds = new Set(course.lecturers.map((l) => l.id));
  const studentIds = new Set((course.students || []).map((s) => s.id));
  const candidates = (role, taken) => (users.data || []).filter((u) => u.roles.includes(role) && !taken.has(u.id) && u.accountStatus === 'Active');

  const add = (kind) => a.run(async () => {
    const id = Number(pick[kind]);
    await api.post(`/api/v1/courses/${course.id}/${kind === 'lecturer' ? 'lecturers' : 'students'}`, { userId: id });
    setPick({ ...pick, [kind]: '' });
    setMsg(kind === 'lecturer' ? 'Lecturer assigned.' : 'Student enrolled.');
    reload();
  });
  const remove = (kind, u) => window.confirm(`Remove ${u.name} from ${course.code}?`) && a.run(async () => {
    await api.del(`/api/v1/courses/${course.id}/${kind === 'lecturer' ? 'lecturers' : 'students'}/${u.id}`);
    setMsg(`${u.name} removed.`);
    reload();
  });

  return (
    <>
      <Alert kind="success" onClose={() => setMsg('')}>{msg}</Alert>
      <Alert kind="error" onClose={() => a.setError('')}>{a.error}</Alert>
      <div className="two-col">
        <section className="card">
          <div className="card-head"><h2>Lecturers</h2></div>
          {course.lecturers.length === 0 ? <Empty>No lecturer assigned.</Empty> : (
            <ul className="people">{course.lecturers.map((l) => (
              <li key={l.id}><div><strong>{l.name}</strong><div className="muted small">{l.username}</div></div>
                {manage && <button className="btn btn-sm btn-danger-ghost" onClick={() => remove('lecturer', l)}>Remove</button>}</li>
            ))}</ul>
          )}
          {manage && (
            <div className="add-row">
              <select value={pick.lecturer} onChange={(e) => setPick({ ...pick, lecturer: e.target.value })}>
                <option value="">Choose a lecturer…</option>
                {candidates('Lecturer', lecturerIds).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <button className="btn" disabled={!pick.lecturer || a.busy} onClick={() => add('lecturer')}>Assign</button>
            </div>
          )}
        </section>
        <section className="card">
          <div className="card-head"><h2>Students ({course.students?.length || 0})</h2></div>
          {!course.students?.length ? <Empty>No students enrolled.</Empty> : (
            <ul className="people">{course.students.map((s) => (
              <li key={s.id}><div><strong>{s.name}</strong><div className="muted small">{s.username} · enrolled {fmtDate(s.enrolledAt)}</div></div>
                {manage && <button className="btn btn-sm btn-danger-ghost" onClick={() => remove('student', s)}>Remove</button>}</li>
            ))}</ul>
          )}
          {manage && (
            <div className="add-row">
              <select value={pick.student} onChange={(e) => setPick({ ...pick, student: e.target.value })}>
                <option value="">Choose a student…</option>
                {candidates('Student', studentIds).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <button className="btn" disabled={!pick.student || a.busy} onClick={() => add('student')}>Enrol</button>
            </div>
          )}
        </section>
      </div>
      {manage && <p className="muted small">Separation of duty: an account cannot be both a lecturer and a student of the same course. The database refuses such assignments.</p>}
    </>
  );
}

// ---------- Materials ----------
function Materials({ course }) {
  const q = useApi(`/api/v1/courses/${course.id}/materials`);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(null);
  const a = useAction();
  return (
    <>
      {course.canManage && <div className="tab-actions"><button className="btn btn-primary" onClick={() => setAdding(true)}>Upload material</button></div>}
      <Alert kind="error" onClose={() => a.setError('')}>{a.error}</Alert>
      <Loaded q={q}>{(items) => items.length === 0 ? <Empty>No materials have been published yet.</Empty> : (
        <ul className="material-list">
          {items.map((m) => (
            <li key={m.id} className="material">
              <div className="material-icon" aria-hidden="true">{m.originalName ? (m.originalName.split('.').pop() || 'file').slice(0, 4).toUpperCase() : 'TXT'}</div>
              <div className="grow">
                <div className="material-title">{m.title}</div>
                <div className="muted small">{m.uploadedBy || 'Unknown'} · {fmtDateTime(m.createdAt)}{m.originalName ? ` · ${m.originalName} (${fmtSize(m.fileSize)})` : ''}</div>
                {m.description && (open === m.id ? <p className="material-body">{m.description}</p> : <button className="link-btn small" onClick={() => setOpen(m.id)}>Show notes</button>)}
              </div>
              <div className="row-actions">
                {m.originalName && <button className="btn btn-sm" onClick={() => a.run(() => api.download(`/api/v1/materials/${m.id}/download`, m.originalName))}>Download</button>}
                {course.canManage && <button className="btn btn-sm btn-danger-ghost" onClick={() => window.confirm(`Delete "${m.title}"?`) && a.run(async () => { await api.del(`/api/v1/materials/${m.id}`); q.reload(); })}>Delete</button>}
              </div>
            </li>
          ))}
        </ul>
      )}</Loaded>
      {adding && <UploadMaterial course={course} onClose={() => setAdding(false)} onDone={() => { setAdding(false); q.reload(); }} />}
    </>
  );
}

// File picker that rejects files over the server's upload limit before sending them.
function FileField({ label, onFile, onError }) {
  const mb = useUploadLimit();
  return (
    <label className="field"><span>{label}{mb ? `, up to ${mb} MB` : ''}</span>
      <input type="file" accept={ACCEPT} onChange={(e) => {
        const f = e.target.files[0] || null;
        if (f && mb && f.size > mb * 1024 * 1024) {
          onError(`"${f.name}" is ${(f.size / 1048576).toFixed(1)} MB. The limit is ${mb} MB.`);
          e.target.value = '';
          onFile(null);
          return;
        }
        onError('');
        onFile(f);
      }} />
    </label>
  );
}

function UploadMaterial({ course, onClose, onDone }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const a = useAction();
  const submit = (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('title', title);
    fd.append('description', description);
    if (file) fd.append('file', file);
    a.run(async () => { await api.post(`/api/v1/courses/${course.id}/materials`, fd); onDone(); });
  };
  return (
    <Modal title={`Upload material · ${course.code}`} onClose={onClose}>
      <form onSubmit={submit}>
        <Alert kind="error">{a.error}</Alert>
        <label className="field"><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={150} /></label>
        <label className="field"><span>Notes or content</span><textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <FileField label="File (optional)" onFile={setFile} onError={a.setError} />
        <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={a.busy}>{a.busy ? 'Uploading…' : 'Publish'}</button></div>
      </form>
    </Modal>
  );
}

// ---------- Assignments ----------
function Assignments({ course }) {
  const { user } = useAuth();
  const q = useApi(`/api/v1/courses/${course.id}/assignments`);
  const [modal, setModal] = useState(null);
  const a = useAction();
  return (
    <>
      {course.canManage && <div className="tab-actions"><button className="btn btn-primary" onClick={() => setModal({ type: 'new' })}>New assignment</button></div>}
      <Alert kind="error" onClose={() => a.setError('')}>{a.error}</Alert>
      <Loaded q={q}>{(items) => items.length === 0 ? <Empty>No assignments yet.</Empty> : (
        <div className="assign-list">
          {items.map((x) => (
            <article key={x.id} className="assign">
              <div className="assign-head">
                <h3>{x.title}</h3>
                <span className={`status ${x.closed ? 'status-suspended' : 'status-active'}`}>{x.closed ? 'Closed' : timeLeft(x.dueAt)}</span>
              </div>
              <div className="muted small">Due {fmtDateTime(x.dueAt)} · Max score {x.maxScore}</div>
              {x.instructions && <p className="assign-body">{x.instructions}</p>}
              <div className="assign-foot">
                {user.role === 'Student' && (x.mySubmittedAt
                  ? <span className="ok-text">Submitted {fmtDateTime(x.mySubmittedAt)}</span>
                  : <span className="muted small">Not submitted</span>)}
                {user.role !== 'Student' && <span className="muted small">{x.submissionCount} submission(s)</span>}
                <span className="grow" />
                {user.role === 'Student' && !x.closed && <button className="btn btn-sm btn-primary" onClick={() => setModal({ type: 'submit', item: x })}>{x.mySubmittedAt ? 'Resubmit' : 'Submit'}</button>}
                {user.role === 'Student' && x.mySubmittedAt && <button className="btn btn-sm" onClick={() => setModal({ type: 'subs', item: x })}>My submission</button>}
                {course.canManage && <button className="btn btn-sm" onClick={() => setModal({ type: 'subs', item: x })}>View submissions</button>}
                {course.canManage && <button className="btn btn-sm" onClick={() => setModal({ type: 'edit', item: x })}>Edit</button>}
                {course.canManage && <button className="btn btn-sm btn-danger-ghost" onClick={() => window.confirm(`Delete "${x.title}" and all its submissions?`) && a.run(async () => { await api.del(`/api/v1/assignments/${x.id}`); q.reload(); })}>Delete</button>}
              </div>
            </article>
          ))}
        </div>
      )}</Loaded>
      {(modal?.type === 'new' || modal?.type === 'edit') && <AssignmentForm course={course} item={modal.item} onClose={() => setModal(null)} onDone={() => { setModal(null); q.reload(); }} />}
      {modal?.type === 'submit' && <SubmitForm item={modal.item} onClose={() => setModal(null)} onDone={() => { setModal(null); q.reload(); }} />}
      {modal?.type === 'subs' && <Submissions item={modal.item} onClose={() => setModal(null)} />}
    </>
  );
}

function AssignmentForm({ course, item, onClose, onDone }) {
  const [f, setF] = useState({
    title: item?.title || '', instructions: item?.instructions || '', maxScore: item?.maxScore || 100,
    dueAt: toLocalInput(item?.dueAt || Date.now() + 7 * 86400000),
  });
  const a = useAction();
  const submit = (e) => {
    e.preventDefault();
    const body = { ...f, dueAt: new Date(f.dueAt).toISOString() };
    a.run(async () => {
      if (item) await api.put(`/api/v1/assignments/${item.id}`, body);
      else await api.post(`/api/v1/courses/${course.id}/assignments`, body);
      onDone();
    });
  };
  return (
    <Modal title={item ? 'Edit assignment' : `New assignment · ${course.code}`} onClose={onClose}>
      <form onSubmit={submit}>
        <Alert kind="error">{a.error}</Alert>
        <label className="field"><span>Title</span><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required maxLength={150} /></label>
        <label className="field"><span>Instructions</span><textarea rows={5} value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} /></label>
        <div className="row-2">
          <label className="field"><span>Deadline</span><input type="datetime-local" value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })} required /></label>
          <label className="field"><span>Maximum score</span><input type="number" min={1} max={1000} value={f.maxScore} disabled={!!item} onChange={(e) => setF({ ...f, maxScore: Number(e.target.value) })} /></label>
        </div>
        <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={a.busy}>{item ? 'Save' : 'Create assignment'}</button></div>
      </form>
    </Modal>
  );
}

function SubmitForm({ item, onClose, onDone }) {
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const a = useAction();
  const submit = (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('content', content);
    if (file) fd.append('file', file);
    a.run(async () => { await api.post(`/api/v1/assignments/${item.id}/submissions`, fd); onDone(); });
  };
  return (
    <Modal title={`Submit · ${item.title}`} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="muted small">Due {fmtDateTime(item.dueAt)}. You can resubmit until the deadline; the latest submission replaces the earlier one.</p>
        <Alert kind="error">{a.error}</Alert>
        <label className="field"><span>Your answer</span><textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Type your answer, or attach a file below" /></label>
        <FileField label="Attachment (optional)" onFile={setFile} onError={a.setError} />
        <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={a.busy || (!content.trim() && !file)}>{a.busy ? 'Submitting…' : 'Submit'}</button></div>
      </form>
    </Modal>
  );
}

function Submissions({ item, onClose }) {
  const q = useApi(`/api/v1/assignments/${item.id}/submissions`);
  const a = useAction();
  return (
    <Modal title={`Submissions · ${item.title}`} onClose={onClose} wide>
      <Alert kind="error">{a.error}</Alert>
      <Loaded q={q}>{(subs) => subs.length === 0 ? <Empty>No submissions yet.</Empty> : (
        <div className="subs">
          {subs.map((s) => (
            <div key={s.id} className="sub">
              <div className="sub-head">
                <strong>{s.studentName}</strong>
                <span className={`small ${new Date(s.submittedAt) > new Date(item.dueAt) ? 'warn-text' : 'muted'}`}>{fmtDateTime(s.submittedAt)}</span>
              </div>
              {s.content && <p className="sub-body">{s.content}</p>}
              {s.originalName && <button className="btn btn-sm" onClick={() => a.run(() => api.download(`/api/v1/submissions/${s.id}/download`, s.originalName))}>Download {s.originalName} ({fmtSize(s.fileSize)})</button>}
            </div>
          ))}
        </div>
      )}</Loaded>
    </Modal>
  );
}

// ---------- Page ----------
export default function CourseDetail() {
  const { id } = useParams();
  const { user, can } = useAuth();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = useApi(`/api/v1/courses/${id}`);
  const tabs = [];
  if (can('/api/v1/materials', 'READ')) tabs.push(['materials', 'Materials']);
  if (can('/api/v1/assignments', 'READ')) tabs.push(['assignments', 'Assignments']);
  if (user.role !== 'Student') tabs.push(['people', 'People']);
  if (user.role !== 'Student' && can('/api/v1/grades', 'READ')) tabs.push(['grades', 'Grades']);
  const tab = tabs.some(([k]) => k === params.get('tab')) ? params.get('tab') : tabs[0]?.[0];
  const [editing, setEditing] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, [id]);

  return (
    <Loaded q={q}>{(course) => (
      <>
        <div className="crumbs"><Link to="/courses">{user.role === 'Admin' ? 'Courses' : 'My courses'}</Link> / {course.code}</div>
        <PageHeader title={`${course.code} · ${course.title}`}
          subtitle={`${course.creditUnits} credit units · ${course.lecturers.map((l) => l.name).join(', ') || 'No lecturer assigned'}`}
          actions={<>
            {(course.canManage || user.role === 'Admin') && can('/api/v1/courses', 'UPDATE') && <button className="btn" onClick={() => setEditing(true)}>Edit details</button>}
            {user.role === 'Admin' && can('/api/v1/courses', 'DELETE') && <button className="btn btn-danger-ghost" onClick={async () => {
              if (window.confirm(`Delete ${course.code}? All its materials, assignments, submissions and grades are deleted. This cannot be undone.`)) {
                try { await api.del(`/api/v1/courses/${course.id}`); nav('/courses'); } catch (e) { alert(e.message); }
              }
            }}>Delete course</button>}
          </>} />
        {course.description && <p className="lead">{course.description}</p>}
        <div className="tabs" role="tablist">
          {tabs.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setParams({ tab: k })}>{label}</button>
          ))}
        </div>
        <div className="tab-panel">
          {tab === 'materials' && <Materials course={course} />}
          {tab === 'assignments' && <Assignments course={course} />}
          {tab === 'people' && <Members course={course} reload={q.reload} />}
          {tab === 'grades' && <GradeSheet courseId={course.id} editable={course.canManage} />}
        </div>
        {editing && <EditCourse course={course} admin={user.role === 'Admin'} onClose={() => setEditing(false)} onDone={() => { setEditing(false); q.reload(); }} />}
      </>
    )}</Loaded>
  );
}

function EditCourse({ course, admin, onClose, onDone }) {
  const [f, setF] = useState({ code: course.code, title: course.title, creditUnits: course.creditUnits, description: course.description || '' });
  const a = useAction();
  const submit = (e) => {
    e.preventDefault();
    const body = admin ? f : { title: f.title, description: f.description };
    a.run(async () => { await api.put(`/api/v1/courses/${course.id}`, body); onDone(); });
  };
  return (
    <Modal title={`Edit ${course.code}`} onClose={onClose}>
      <form onSubmit={submit}>
        <Alert kind="error">{a.error}</Alert>
        {admin && (
          <div className="row-2">
            <label className="field"><span>Course code</span><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required maxLength={20} /></label>
            <label className="field"><span>Credit units</span><input type="number" min={1} max={12} value={f.creditUnits} onChange={(e) => setF({ ...f, creditUnits: Number(e.target.value) })} /></label>
          </div>
        )}
        <label className="field"><span>Title</span><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required maxLength={150} /></label>
        <label className="field"><span>Description</span><textarea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={a.busy}>Save</button></div>
      </form>
    </Modal>
  );
}
