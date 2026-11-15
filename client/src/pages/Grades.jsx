import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Alert, Empty, Loaded, PageHeader, Stat, fmtDateTime, useAction, useApi } from '../ui';

const POINTS = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };
const letterOf = (s) => (s === '' || s == null || Number.isNaN(Number(s)) ? '' : s >= 70 ? 'A' : s >= 60 ? 'B' : s >= 50 ? 'C' : s >= 45 ? 'D' : s >= 40 ? 'E' : 'F');

// Grade sheet for one course. Editable for the assigned lecturer; read-only for Admin.
export function GradeSheet({ courseId, editable }) {
  const q = useApi(`/api/v1/grades/course/${courseId}`);
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState('');
  const a = useAction();

  useEffect(() => {
    if (q.data) setRows(q.data.map((r) => ({ ...r, input: r.score ?? '', remarksInput: r.remarks || '' })));
  }, [q.data]);

  const changed = rows.filter((r) => r.input !== '' && (Number(r.input) !== r.score || (r.remarksInput || '') !== (r.remarks || '')));
  const graded = rows.filter((r) => r.score !== null);
  const released = graded.length > 0 && graded.every((r) => r.released);

  const save = () => a.run(async () => {
    await api.post('/api/v1/grades/submit-bulk', {
      courseId, entries: changed.map((r) => ({ studentId: r.studentId, score: Number(r.input), remarks: r.remarksInput })),
    });
    setMsg(`${changed.length} grade(s) saved.${released ? '' : ' Students will see them once you release grades.'}`);
    q.reload();
  });
  const release = (on) => a.run(async () => {
    await api.put('/api/v1/grades/release', { courseId, released: on });
    setMsg(on ? 'Grades released. Students can now see their results.' : 'Grades withheld from students.');
    q.reload();
  });
  const set = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <>
      <Alert kind="success" onClose={() => setMsg('')}>{msg}</Alert>
      <Alert kind="error" onClose={() => a.setError('')}>{a.error}</Alert>
      <Loaded q={q}>{() => rows.length === 0 ? <Empty>No students are enrolled in this course.</Empty> : (
        <>
          <div className="grade-bar">
            <span className={`status ${released ? 'status-active' : 'status-pending'}`}>{released ? 'Released to students' : 'Not released'}</span>
            <span className="muted small">{graded.length} of {rows.length} graded</span>
            <span className="grow" />
            {editable && <button className="btn" disabled={a.busy || graded.length === 0} onClick={() => release(!released)}>{released ? 'Withhold grades' : 'Release grades'}</button>}
            {editable && <button className="btn btn-primary" disabled={a.busy || changed.length === 0} onClick={save}>Save {changed.length || ''} change{changed.length === 1 ? '' : 's'}</button>}
          </div>
          <div className="table-wrap card flush">
            <table className="table">
              <thead><tr><th>Student</th><th className="num">Score (0–100)</th><th className="center">Grade</th><th>Remarks</th><th>Last updated</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.studentId}>
                    <td><strong>{r.studentName}</strong><div className="muted small">{r.username}</div></td>
                    <td className="num">
                      {editable ? <input className="score-input" type="number" min={0} max={100} step="0.5" value={r.input} aria-label={`Score for ${r.studentName}`} onChange={(e) => set(i, { input: e.target.value })} /> : (r.score ?? '—')}
                    </td>
                    <td className="center"><span className={`grade grade-${letterOf(editable ? r.input : r.score) || 'none'}`}>{letterOf(editable ? r.input : r.score) || '—'}</span></td>
                    <td>{editable ? <input value={r.remarksInput} maxLength={255} aria-label={`Remarks for ${r.studentName}`} onChange={(e) => set(i, { remarksInput: e.target.value })} /> : (r.remarks || '')}</td>
                    <td className="muted small">{fmtDateTime(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editable && <p className="muted small">Grades are written through a database stored procedure that re-checks you are the course lecturer. Scale: A 70–100, B 60–69, C 50–59, D 45–49, E 40–44, F below 40.</p>}
        </>
      )}</Loaded>
    </>
  );
}

function MyGrades() {
  const q = useApi('/api/v1/grades/mine');
  return (
    <Loaded q={q}>{(grades) => {
      const units = grades.reduce((s, g) => s + g.creditUnits, 0);
      const gpa = units ? grades.reduce((s, g) => s + POINTS[g.letter] * g.creditUnits, 0) / units : null;
      return (
        <>
          <div className="stats">
            <Stat label="Released results" value={grades.length} />
            <Stat label="Credit units" value={units} />
            <Stat label="GPA (5-point scale)" value={gpa === null ? '—' : gpa.toFixed(2)} />
          </div>
          {grades.length === 0 ? <Empty>No grades have been released to you yet.</Empty> : (
            <div className="table-wrap card flush">
              <table className="table">
                <thead><tr><th>Course</th><th className="num">Units</th><th className="num">Score</th><th className="center">Grade</th><th>Remarks</th></tr></thead>
                <tbody>{grades.map((g) => (
                  <tr key={g.courseId}>
                    <td><strong>{g.courseCode}</strong> <span className="muted">{g.courseTitle}</span></td>
                    <td className="num">{g.creditUnits}</td>
                    <td className="num">{g.score}</td>
                    <td className="center"><span className={`grade grade-${g.letter}`}>{g.letter}</span></td>
                    <td>{g.remarks || ''}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <p className="muted small">Only grades your lecturers have released are shown. Other students' results are never visible to you.</p>
        </>
      );
    }}</Loaded>
  );
}

function GradeEntry() {
  const courses = useApi('/api/v1/courses');
  const [params, setParams] = useSearchParams();
  const selected = Number(params.get('course')) || courses.data?.[0]?.id;
  return (
    <Loaded q={courses}>{(list) => list.length === 0 ? <Empty>No courses are assigned to you.</Empty> : (
      <>
        <div className="toolbar">
          <label className="inline">Course
            <select value={selected} onChange={(e) => setParams({ course: e.target.value })}>
              {list.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}
            </select>
          </label>
        </div>
        {selected && <GradeSheet key={selected} courseId={selected} editable />}
      </>
    )}</Loaded>
  );
}

export default function Grades({ entry }) {
  const { user } = useAuth();
  if (entry) return (<><PageHeader title="Grade entry" subtitle="Record scores for your courses and release them to students." /><GradeEntry /></>);
  return (<><PageHeader title={user.role === 'Student' ? 'My grades' : 'Grades'} subtitle="Your released course results." /><MyGrades /></>);
}
