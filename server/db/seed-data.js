// Demo data: roles (Table 4.3), permissions and the role-permission matrix (Table 4.4),
// plus a realistic set of accounts, courses, materials, assignments, submissions, grades
// and audit history so every dashboard has something to show.
//
// All passwords here are DEVELOPMENT TEST VALUES. Change or delete these accounts before
// any real deployment (see SETUP_GUIDE.md, "Before real use").
//
// Times are given in hours relative to the moment the database is set up
// (negative = in the past), so the demo always looks current.

const ROLES = [
  { roleName: 'Admin', hierarchyLevel: 3, description: 'Manages users, roles, courses and system settings; views audit logs' },
  { roleName: 'Lecturer', hierarchyLevel: 2, description: 'Manages assigned courses, uploads materials, creates assignments and records grades' },
  { roleName: 'Student', hierarchyLevel: 1, description: 'Views enrolled courses and materials, submits assignments and views own released grades' },
];

// [resourceEndpoint, allowedAction, description]
const PERMISSIONS = [
  ['/api/v1/users', 'CREATE', 'Create user accounts'],
  ['/api/v1/users', 'READ', 'List and view user accounts'],
  ['/api/v1/users', 'UPDATE', 'Edit accounts, status and role assignments'],
  ['/api/v1/users', 'DELETE', 'Delete user accounts'],
  ['/api/v1/profile', 'READ', 'View own profile'],
  ['/api/v1/profile/password', 'UPDATE', 'Change own password'],
  ['/api/v1/roles', 'CREATE', 'Create roles'],
  ['/api/v1/roles', 'READ', 'View roles and the permission matrix'],
  ['/api/v1/roles', 'UPDATE', 'Change role permissions'],
  ['/api/v1/roles', 'DELETE', 'Delete roles'],
  ['/api/v1/courses', 'CREATE', 'Create courses'],
  ['/api/v1/courses', 'READ', 'View courses (scoped by ownership)'],
  ['/api/v1/courses', 'UPDATE', 'Edit course details (scoped by ownership)'],
  ['/api/v1/courses', 'DELETE', 'Delete courses'],
  ['/api/v1/courses/members', 'UPDATE', 'Assign lecturers and enrol students'],
  ['/api/v1/materials', 'CREATE', 'Upload course materials'],
  ['/api/v1/materials', 'READ', 'View and download course materials'],
  ['/api/v1/materials', 'UPDATE', 'Edit course materials'],
  ['/api/v1/materials', 'DELETE', 'Delete course materials'],
  ['/api/v1/assignments', 'CREATE', 'Create assignments'],
  ['/api/v1/assignments', 'READ', 'View assignments'],
  ['/api/v1/assignments', 'UPDATE', 'Edit assignments'],
  ['/api/v1/assignments', 'DELETE', 'Delete assignments'],
  ['/api/v1/submissions', 'CREATE', 'Submit assignments'],
  ['/api/v1/submissions', 'READ', 'View assignment submissions (scoped)'],
  ['/api/v1/grades/submit', 'CREATE', 'Record grades'],
  ['/api/v1/grades', 'READ', 'View grades (scoped)'],
  ['/api/v1/grades', 'UPDATE', 'Release / withhold grades'],
  ['/api/v1/audit-logs', 'READ', 'View the access audit log'],
];

// Role-permission matrix, Table 4.4 (Principle of Least Privilege).
const MATRIX = {
  Admin: [
    '/api/v1/users:CREATE', '/api/v1/users:READ', '/api/v1/users:UPDATE', '/api/v1/users:DELETE',
    '/api/v1/profile:READ', '/api/v1/profile/password:UPDATE',
    '/api/v1/roles:CREATE', '/api/v1/roles:READ', '/api/v1/roles:UPDATE', '/api/v1/roles:DELETE',
    '/api/v1/courses:CREATE', '/api/v1/courses:READ', '/api/v1/courses:UPDATE', '/api/v1/courses:DELETE',
    '/api/v1/courses/members:UPDATE',
    '/api/v1/materials:READ', '/api/v1/assignments:READ', '/api/v1/grades:READ',
    '/api/v1/audit-logs:READ',
  ],
  Lecturer: [
    '/api/v1/profile:READ', '/api/v1/profile/password:UPDATE',
    '/api/v1/courses:READ', '/api/v1/courses:UPDATE',
    '/api/v1/materials:CREATE', '/api/v1/materials:READ', '/api/v1/materials:UPDATE', '/api/v1/materials:DELETE',
    '/api/v1/assignments:CREATE', '/api/v1/assignments:READ', '/api/v1/assignments:UPDATE', '/api/v1/assignments:DELETE',
    '/api/v1/submissions:READ',
    '/api/v1/grades/submit:CREATE', '/api/v1/grades:READ', '/api/v1/grades:UPDATE',
  ],
  Student: [
    '/api/v1/profile:READ', '/api/v1/profile/password:UPDATE',
    '/api/v1/courses:READ', '/api/v1/materials:READ', '/api/v1/assignments:READ',
    '/api/v1/submissions:CREATE', '/api/v1/submissions:READ',
    '/api/v1/grades:READ',
  ],
};

const ADMIN_PW = 'Admin@12345';
const LECT_PW = 'Lecturer@123';
const STUD_PW = 'Student@123';

const USERS = [
  // Administrators
  { username: 'admin@nsuk.edu.ng', fullName: 'System Administrator', password: ADMIN_PW, roles: ['Admin'], lastLoginHours: -2 },
  { username: 'f.bello@nsuk.edu.ng', fullName: 'Fatima Bello (ICT Officer)', password: ADMIN_PW, roles: ['Admin'], lastLoginHours: -30 },

  // Lecturers
  { username: 'n.ajumobi@nsuk.edu.ng', fullName: 'Dr. N. Ajumobi', password: LECT_PW, roles: ['Lecturer'], lastLoginHours: -5 },
  { username: 'b.ajayi@nsuk.edu.ng', fullName: 'Dr. B. Ajayi', password: LECT_PW, roles: ['Lecturer'], lastLoginHours: -20 },
  { username: 'a.usman@nsuk.edu.ng', fullName: 'Dr. Aisha Usman', password: LECT_PW, roles: ['Lecturer'], lastLoginHours: -48 },
  { username: 'e.nwosu@nsuk.edu.ng', fullName: 'Mr. Emeka Nwosu', password: LECT_PW, roles: ['Lecturer'], lastLoginHours: -9 },
  { username: 't.adeyemi@nsuk.edu.ng', fullName: 'Dr. Tunde Adeyemi', password: LECT_PW, roles: ['Lecturer'], lastLoginHours: -72 },

  // Graduate assistant: holds both roles (role activation at sign-in), but Separation of
  // Duty stops them being Lecturer and Student of the same course.
  { username: 'ta.john@nsuk.edu.ng', fullName: 'John Okafor (Graduate Assistant)', password: 'Assist@123', roles: ['Student', 'Lecturer'], lastLoginHours: -26 },

  // Students
  { username: 'peace.o@student.nsuk.edu.ng', fullName: 'Peace Ogechi', password: STUD_PW, roles: ['Student'], lastLoginHours: -3 },
  { username: 'musa.a@student.nsuk.edu.ng', fullName: 'Musa Abdullahi', password: STUD_PW, roles: ['Student'], lastLoginHours: -12 },
  { username: 'grace.e@student.nsuk.edu.ng', fullName: 'Grace Eze', password: STUD_PW, roles: ['Student'], lastLoginHours: -7 },
  { username: 'chinedu.o@student.nsuk.edu.ng', fullName: 'Chinedu Obi', password: STUD_PW, roles: ['Student'], lastLoginHours: -15 },
  { username: 'aminat.y@student.nsuk.edu.ng', fullName: 'Aminat Yusuf', password: STUD_PW, roles: ['Student'], lastLoginHours: -40 },
  { username: 'ibrahim.s@student.nsuk.edu.ng', fullName: 'Ibrahim Sani', password: STUD_PW, roles: ['Student'], lastLoginHours: -22 },
  { username: 'blessing.n@student.nsuk.edu.ng', fullName: 'Blessing Nnamdi', password: STUD_PW, roles: ['Student'], lastLoginHours: -60 },
  { username: 'halima.m@student.nsuk.edu.ng', fullName: 'Halima Mohammed', password: STUD_PW, roles: ['Student'], lastLoginHours: -18 },
  { username: 'emmanuel.d@student.nsuk.edu.ng', fullName: 'Emmanuel Danjuma', password: STUD_PW, roles: ['Student'], lastLoginHours: -33 },
  { username: 'zainab.a@student.nsuk.edu.ng', fullName: 'Zainab Aliyu', password: STUD_PW, roles: ['Student'], lastLoginHours: -11 },
  { username: 'kelechi.u@student.nsuk.edu.ng', fullName: 'Kelechi Uche', password: STUD_PW, roles: ['Student'], lastLoginHours: -50 },
  { username: 'ruth.j@student.nsuk.edu.ng', fullName: 'Ruth Joseph', password: STUD_PW, roles: ['Student'], lastLoginHours: -27 },
  { username: 'yusuf.g@student.nsuk.edu.ng', fullName: 'Yusuf Garba', password: STUD_PW, roles: ['Student'], lastLoginHours: -36 },
  { username: 'esther.b@student.nsuk.edu.ng', fullName: 'Esther Bassey', password: STUD_PW, roles: ['Student'], lastLoginHours: -14 },
  // Suspended account, to demonstrate FT-03.
  { username: 'david.p@student.nsuk.edu.ng', fullName: 'David Peter', password: STUD_PW, roles: ['Student'], status: 'Suspended', lastLoginHours: -400 },
];

const S = (n) => `${n}@student.nsuk.edu.ng`;

// grades: { student: [score, remarks] }, released: whether students can see them.
const COURSES = [
  {
    courseCode: 'CMP 401', title: 'Information Security', creditUnits: 3,
    description: 'Principles of information security: the CIA triad, access control models (IBAC, RBAC, ABAC), authentication, cryptography and security auditing.',
    lecturers: ['n.ajumobi@nsuk.edu.ng'],
    students: [S('peace.o'), S('musa.a'), S('grace.e'), S('chinedu.o'), S('aminat.y'), S('ibrahim.s'), S('blessing.n'), S('halima.m')],
    materials: [
      { title: 'Course outline and reading list', hours: -24 * 40, body: 'Weeks 1-3: security goals and threat models.\nWeeks 4-6: access control (ACLs, RBAC96, ABAC).\nWeeks 7-9: authentication, passwords and tokens.\nWeeks 10-12: cryptography basics and secure protocols.\nWeek 13: revision.\n\nCore reading: Sandhu et al. (1996) "Role-based access control models"; Saltzer & Schroeder (1975).' },
      { title: 'Lecture 3: Role-Based Access Control (RBAC96)', hours: -24 * 20, body: 'RBAC0 links users to roles and roles to permissions. RBAC1 adds role hierarchies (senior roles inherit junior permissions). RBAC2 adds constraints such as Separation of Duty. RBAC3 combines both.\n\nKey idea: permissions are never assigned to people directly, only to roles.' },
      { title: 'Lecture 5: Password storage and session tokens', hours: -24 * 6, body: 'Never store plain-text passwords. Use a slow, salted hash such as bcrypt with a cost factor of 10-12.\n\nSigned JSON Web Tokens (JWT) carry a user identity and role. The server verifies the signature on every request, so a changed role claim is rejected.' },
    ],
    assignments: [
      { title: 'Assignment 1: Threat model of the university portal', hours: -24 * 9, maxScore: 100, instructions: 'Identify five assets of the student portal, the threats to each, and one control for each threat. 2 pages maximum.',
        submissions: { 'peace.o': 'Assets: student records, exam scripts, grade book, payment data, credentials. Main threat to the grade book is privilege escalation; control: RBAC with server-side checks.', 'musa.a': 'I chose the exam question bank as the most critical asset. Threats: insider leakage, weak passwords. Controls: least privilege and audit logging.', 'grace.e': 'See attached reasoning: confidentiality of records, integrity of grades and availability during registration.', 'chinedu.o': 'Threat model table with STRIDE categories for each asset.', 'ibrahim.s': 'Assets and threats listed; controls include MFA and encryption at rest.', 'halima.m': 'Five assets analysed with likelihood and impact ratings.' } },
      { title: 'Assignment 2: Design an RBAC matrix', hours: 24 * 10, maxScore: 100, instructions: 'Design a role-permission matrix for a hospital records system with at least four roles. Justify each permission using the principle of least privilege.',
        submissions: { 'grace.e': 'Roles: Doctor, Nurse, Records Officer, Patient. Draft matrix attached below; Separation of Duty between Records Officer and Auditor.' } },
    ],
    // In progress: no grades yet.
  },
  {
    courseCode: 'CMP 405', title: 'Software Engineering II', creditUnits: 3,
    description: 'Agile methods, object-oriented analysis and design (OOAD), UML modelling, software testing and quality assurance.',
    lecturers: ['b.ajayi@nsuk.edu.ng'],
    students: [S('peace.o'), S('musa.a'), 'ta.john@nsuk.edu.ng', S('emmanuel.d'), S('zainab.a'), S('kelechi.u'), S('ruth.j')],
    materials: [
      { title: 'Agile iterative development', hours: -24 * 35, body: 'Each iteration delivers a working increment that is tested before the next begins. Ceremonies: planning, daily stand-up, review and retrospective.' },
      { title: 'UML: use case, class and sequence diagrams', hours: -24 * 18, body: 'Use case diagrams show actors and system boundaries. Class diagrams show structure. Sequence diagrams show the order of messages, e.g. login -> token check -> permission lookup -> response.' },
    ],
    assignments: [
      { title: 'Group project: Sprint 1 report', hours: -24 * 14, maxScore: 100, instructions: 'Submit your sprint backlog, burndown chart and retrospective notes.',
        submissions: { 'peace.o': 'Sprint 1 completed 8 of 10 stories; authentication and role middleware done.', 'musa.a': 'Burndown attached; velocity 21 points.', 'emmanuel.d': 'Backlog and retro notes.', 'zainab.a': 'Sprint 1 report with test results.', 'kelechi.u': 'Report attached.', 'ruth.j': 'Retrospective: improve code review turnaround.' } },
      { title: 'Unit testing exercise', hours: 24 * 5, maxScore: 50, instructions: 'Write five unit tests for a password-policy function. Include at least two failing cases.', submissions: {} },
    ],
    grades: { released: true, scores: { 'peace.o': [74, 'Excellent sprint leadership'], 'musa.a': [66, 'Good'], 'ta.john': [71, 'Very good'], 'emmanuel.d': [58, 'Fair'], 'zainab.a': [63, 'Good'], 'kelechi.u': [47, 'Needs improvement on testing'], 'ruth.j': [69, 'Good'] } },
  },
  {
    courseCode: 'CMP 311', title: 'Database Management Systems', creditUnits: 2,
    description: 'Relational modelling, normalisation, SQL, transactions, stored procedures and database security.',
    lecturers: ['n.ajumobi@nsuk.edu.ng', 'ta.john@nsuk.edu.ng'],
    students: [S('grace.e'), S('yusuf.g'), S('esther.b'), S('halima.m'), S('ibrahim.s')],
    materials: [
      { title: 'Normalisation (1NF to BCNF)', hours: -24 * 25, body: 'A table is in 3NF when every non-key attribute depends on the key, the whole key and nothing but the key.' },
      { title: 'Stored procedures and privileges', hours: -24 * 4, body: 'GRANT EXECUTE on a procedure lets an account change data only through that procedure, which can enforce business rules such as "only the course lecturer may record grades".' },
    ],
    assignments: [
      { title: 'SQL practical 1', hours: -24 * 6, maxScore: 100, instructions: 'Write queries for the ten questions in the practical sheet discussed in class.',
        submissions: { 'grace.e': 'SELECT ... JOIN answers for Q1-Q10.', 'yusuf.g': 'All ten queries attempted.', 'esther.b': 'Q1-Q8 completed.', 'halima.m': 'Queries with explanations.' } },
    ],
    grades: { released: true, scores: { 'grace.e': [82, 'Outstanding'], 'yusuf.g': [61, 'Good'], 'esther.b': [55, 'Fair'], 'halima.m': [72, 'Very good'], 'ibrahim.s': [38, 'Did not submit practicals'] } },
  },
  {
    courseCode: 'CMP 307', title: 'Computer Networks', creditUnits: 3,
    description: 'Network models, TCP/IP, routing, transport protocols and network security basics.',
    lecturers: ['a.usman@nsuk.edu.ng'],
    students: [S('chinedu.o'), S('aminat.y'), S('blessing.n'), S('emmanuel.d'), S('zainab.a'), S('peace.o')],
    materials: [
      { title: 'The TCP/IP model', hours: -24 * 30, body: 'Four layers: link, internet, transport and application. HTTPS runs HTTP over TLS at the application layer.' },
      { title: 'Subnetting worksheet', hours: -24 * 12, body: 'Practise dividing 192.168.10.0/24 into eight equal subnets; list network address, broadcast address and usable hosts for each.' },
    ],
    assignments: [
      { title: 'Subnetting test', hours: -24 * 3, maxScore: 100, instructions: 'Answer all questions on the worksheet.',
        submissions: { 'chinedu.o': 'Eight /27 subnets listed.', 'aminat.y': 'Answers attached.', 'blessing.n': 'All questions done.', 'peace.o': 'Worked answers with host ranges.' } },
    ],
    // Recorded but not yet released: lecturers see them, students do not.
    grades: { released: false, scores: { 'chinedu.o': [64, ''], 'aminat.y': [77, ''], 'blessing.n': [52, ''], 'emmanuel.d': [44, ''], 'zainab.a': [68, ''], 'peace.o': [71, ''] } },
  },
  {
    courseCode: 'CMP 321', title: 'Operating Systems', creditUnits: 3,
    description: 'Processes, threads, scheduling, memory management, file systems and protection.',
    lecturers: ['e.nwosu@nsuk.edu.ng'],
    students: [S('kelechi.u'), S('ruth.j'), S('yusuf.g'), S('esther.b'), S('musa.a')],
    materials: [
      { title: 'CPU scheduling algorithms', hours: -24 * 15, body: 'FCFS, SJF, Priority and Round Robin. Compare average waiting time on the example in class.' },
    ],
    assignments: [
      { title: 'Scheduling simulation', hours: 24 * 7, maxScore: 100, instructions: 'Simulate Round Robin with quantum 4 on the given process set and report average waiting time.', submissions: { 'ruth.j': 'Average waiting time = 7.5 ms (Gantt chart in answer).' } },
    ],
  },
  {
    courseCode: 'CMP 499', title: 'Final Year Project', creditUnits: 6,
    description: 'Independent project: proposal, literature review, design, implementation and defence.',
    lecturers: ['t.adeyemi@nsuk.edu.ng'],
    students: [S('peace.o'), S('musa.a'), S('grace.e'), S('chinedu.o')],
    materials: [
      { title: 'Project report template and timeline', hours: -24 * 50, body: 'Chapter 1 Introduction, Chapter 2 Literature Review, Chapter 3 Methodology, Chapter 4 Implementation and Results, Chapter 5 Summary and Conclusion.\n\nChapter 4 draft due in week 10; final defence in week 14.' },
    ],
    assignments: [
      { title: 'Chapter 4 draft', hours: 24 * 14, maxScore: 100, instructions: 'Upload the draft of Chapter 4 (implementation, testing and results).', submissions: {} },
    ],
  },
];

// Historical audit entries so the audit viewer and admin dashboard show real-looking activity.
// [username|null, roleName|null, resource, action, decision, reason, ip, hoursAgo]
const AUDIT = [
  ['admin@nsuk.edu.ng', 'Admin', '/api/v1/auth/login', 'LOGIN', 'ALLOWED', 'Login successful', '10.0.0.5', 50],
  ['peace.o@student.nsuk.edu.ng', 'Student', 'POST /api/v1/grades/submit', 'CREATE', 'DENIED', 'Role Student lacks CREATE on /api/v1/grades/submit', '10.0.0.23', 46],
  [null, null, '/api/v1/auth/login', 'LOGIN', 'DENIED', 'Unknown username', '41.203.72.11', 40],
  [null, null, '/api/v1/auth/login', 'LOGIN', 'DENIED', 'Unknown username', '41.203.72.11', 40],
  ['musa.a@student.nsuk.edu.ng', null, '/api/v1/auth/login', 'LOGIN', 'DENIED', 'Wrong password (1)', '10.0.0.31', 30],
  ['musa.a@student.nsuk.edu.ng', 'Student', '/api/v1/auth/login', 'LOGIN', 'ALLOWED', 'Login successful', '10.0.0.31', 30],
  ['musa.a@student.nsuk.edu.ng', 'Student', 'GET /api/v1/grades/student/11', 'READ', 'DENIED', 'Ownership check failed: grades of student 11', '10.0.0.31', 29],
  ['b.ajayi@nsuk.edu.ng', 'Lecturer', 'GET /api/v1/users', 'READ', 'DENIED', 'Role Lecturer lacks READ on /api/v1/users', '10.0.0.12', 20],
  ['b.ajayi@nsuk.edu.ng', 'Lecturer', 'POST /api/v1/grades/submit-bulk', 'CREATE', 'ALLOWED', null, '10.0.0.12', 19],
  [null, null, '/api/v1/courses', 'READ', 'DENIED', 'Invalid token signature', '10.0.0.44', 16],
  ['david.p@student.nsuk.edu.ng', null, '/api/v1/auth/login', 'LOGIN', 'DENIED', 'Account Suspended', '10.0.0.52', 8],
  ['grace.e@student.nsuk.edu.ng', 'Student', 'POST /api/v1/assignments/2/submissions', 'CREATE', 'ALLOWED', null, '10.0.0.27', 6],
];

module.exports = { ROLES, PERMISSIONS, MATRIX, USERS, COURSES, AUDIT };
