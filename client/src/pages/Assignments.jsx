import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { Empty, Loaded, PageHeader, fmtDateTime, timeLeft, useApi } from '../ui';

export default function Assignments() {
  const { user } = useAuth();
  const q = useApi('/api/v1/assignments');
  const student = user.role === 'Student';
  return (
    <>
      <PageHeader title="Assignments" subtitle={student ? 'Assignments in the courses you are enrolled in.' : 'Assignments in the courses you teach.'} />
      <Loaded q={q}>{(items) => items.length === 0 ? <Empty>No assignments yet.</Empty> : (
        <div className="table-wrap card flush">
          <table className="table">
            <thead><tr><th>Assignment</th><th>Course</th><th>Deadline</th><th>Status</th>{!student && <th className="num">Submitted</th>}</tr></thead>
            <tbody>{items.map((a) => (
              <tr key={a.id}>
                <td><Link to={`/courses/${a.courseID}?tab=assignments`}><strong>{a.title}</strong></Link></td>
                <td>{a.courseCode} <span className="muted small">{a.courseTitle}</span></td>
                <td className="nowrap">{fmtDateTime(a.dueAt)}</td>
                <td>
                  {student
                    ? (a.submissionID ? <span className="status status-active">Submitted</span> : a.closed ? <span className="status status-suspended">Missed</span> : <span className="status status-pending">{timeLeft(a.dueAt)}</span>)
                    : (a.closed ? <span className="status status-suspended">Closed</span> : <span className="status status-active">{timeLeft(a.dueAt)}</span>)}
                </td>
                {!student && <td className="num">{a.submissionCount}/{a.studentCount}</td>}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}</Loaded>
    </>
  );
}
