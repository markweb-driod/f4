import { useEffect } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { api } from './api';
import Layout from './Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Roles from './pages/Roles';
import Audit from './pages/Audit';
import Courses from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import Assignments from './pages/Assignments';
import Grades from './pages/Grades';
import Profile from './pages/Profile';
import AccessDenied from './pages/AccessDenied';

// Client-side guard. It only hides what the role cannot use; the server enforces every
// rule independently. When a page is opened directly by URL without permission, the
// guard still calls the protected endpoint so the server records the denied attempt.
function Guard({ resource, action = 'READ', probe, children }) {
  const { can } = useAuth();
  const allowed = can(resource, action);
  useEffect(() => {
    if (!allowed && probe) api.get(probe).catch(() => {});
  }, [allowed, probe]);
  return allowed ? children : <AccessDenied />;
}

export default function App() {
  const { session } = useAuth();
  if (!session?.token) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/users" element={<Guard resource="/api/v1/users" probe="/api/v1/users"><Users /></Guard>} />
        <Route path="/roles" element={<Guard resource="/api/v1/roles" probe="/api/v1/roles"><Roles /></Guard>} />
        <Route path="/audit" element={<Guard resource="/api/v1/audit-logs" probe="/api/v1/audit-logs"><Audit /></Guard>} />
        <Route path="/courses" element={<Guard resource="/api/v1/courses" probe="/api/v1/courses"><Courses /></Guard>} />
        <Route path="/courses/:id" element={<Guard resource="/api/v1/courses" probe="/api/v1/courses"><CourseDetail /></Guard>} />
        <Route path="/assignments" element={<Guard resource="/api/v1/assignments" probe="/api/v1/assignments"><Assignments /></Guard>} />
        <Route path="/grades" element={<Guard resource="/api/v1/grades" probe="/api/v1/grades/mine"><Grades /></Guard>} />
        <Route path="/grades/entry" element={<Guard resource="/api/v1/grades/submit" action="CREATE" probe="/api/v1/grades/course/1"><Grades entry /></Guard>} />
        <Route path="/profile" element={<Guard resource="/api/v1/profile" probe="/api/v1/profile"><Profile /></Guard>} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<div className="denied"><h1>Page not found</h1><p className="muted">That page does not exist.</p><Link className="btn" to="/">Back to my dashboard</Link></div>} />
      </Routes>
    </Layout>
  );
}
