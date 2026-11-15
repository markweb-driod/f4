# SecureLearn: Secure E-Learning System Using Role-Based Access Control

Implementation of the B.Sc. project *Design and Implementation of a Secure E-Learning System Using Role-Based Access Control for Tertiary Institutions* (Nwaonuma Peace Ogechi, Dept. of Computer Science, Nasarawa State University, Keffi).

Stack (Chapter 4, Table 4.2): **Node.js + Express**, **MySQL / MariaDB**, **React**, **bcrypt** (pure-JavaScript `bcryptjs`), **jsonwebtoken**, **helmet**, **express-rate-limit**, **Jest + Supertest**. No Docker is needed: everything runs directly on Windows, macOS or Linux.

```
F4/
├── setup.bat / start.bat   Windows: double-click to install / run
├── setup.js                One-step installer (all platforms: npm run setup)
├── SETUP_GUIDE.md          Full installation guide, demo tour, troubleshooting
├── server/                 Express API
│   ├── db/
│   │   ├── schema.js        tables + stored procedures
│   │   ├── seed-data.js     demo data (users, courses, materials, assignments, grades, audit history)
│   │   ├── setup.js         creates the database (npm run db:setup / db:reset)
│   │   └── rbac_elearning.sql  the same database as one file, for phpMyAdmin import
│   ├── src/
│   │   ├── middleware/authorize.js   RBAC security gatekeeper (Section 4.4.3)
│   │   ├── routes/         auth, users, roles, courses, materials, assignments, grades, audit
│   │   └── services/       tokens (JWT), audit log, ownership checks, uploads
│   └── tests/              unit, functional (FT-01…FT-11) and security (ST-01…ST-12) tests
└── client/                 React front end (Vite)
```

## Quick start

**See [SETUP_GUIDE.md](SETUP_GUIDE.md) for step-by-step instructions.** In short:

1. Install [Node.js LTS](https://nodejs.org) and [XAMPP](https://www.apachefriends.org) (or MySQL 8 / MariaDB).
2. Start MySQL in the XAMPP Control Panel.
3. Run the setup: on Windows double-click `setup.bat`, elsewhere run `npm run setup`.
4. Start the server: on Windows double-click `start.bat`, elsewhere run `npm start`.
5. Open http://localhost:4000 and sign in with a demo account.

| Command (from the F4 folder) | What it does |
|---|---|
| `npm run setup` | Installs packages, writes `server/.env`, creates the database with demo data, builds the web interface |
| `npm start` | Starts the system on port 4000 |
| `npm run db:reset` | Wipes the database and reloads the demo data |
| `npm test` | Runs the 41 automated tests against a separate test database |
| `npm run db:export` | Regenerates `server/db/rbac_elearning.sql` from the demo data |
| `npm run dev:server` + `npm run dev:client` | Development mode with hot reload at http://localhost:5173 |

## Demo data

The demo database contains 23 accounts, 6 courses, 11 materials, 8 assignments (some open, some closed), 22 submissions, 18 grades (released in two courses, recorded but not released in one) and a short audit history. The full account list is in [SETUP_GUIDE.md](SETUP_GUIDE.md#7-demo-accounts). All passwords are development test values; change them before any real use.

| Role | Username | Password |
|---|---|---|
| Admin | admin@nsuk.edu.ng | Admin@12345 |
| Lecturer | n.ajumobi@nsuk.edu.ng | Lecturer@123 |
| Student | peace.o@student.nsuk.edu.ng | Student@123 |
| Student **and** Lecturer (picks a role at sign-in) | ta.john@nsuk.edu.ng | Assist@123 |
| Suspended student (cannot sign in) | david.p@student.nsuk.edu.ng | Student@123 |

## Tests

```bash
npm test
```

The tests rebuild a separate database, `rbac_elearning_test`, on every run. 41 tests cover:

* **Unit (4.6.1):** hashing, password policy, token issue/verify/tamper, input validation, the seeded matrix.
* **Functional, Table 4.5:** FT-01 to FT-11, plus role activation, token refresh, live matrix edits.
* **Security, Table 4.6:** ST-01 to ST-12, plus `alg:none` tokens, helmet headers, immediate role revocation, and checks that the app's DB account cannot write grades, edit the audit log or drop tables.

## How the security design maps to the thesis

| Thesis | Where it is implemented |
|---|---|
| RBAC0 users ↔ roles ↔ permissions (3.7.2 Tables 1–5) | `tbl_users`, `tbl_roles`, `tbl_user_roles`, `tbl_permissions`, `tbl_role_permissions` in `server/db/schema.js` |
| RBAC1 hierarchy | `hierarchyLevel` on roles; new roles (e.g. HOD, Dean) can be added from the UI |
| RBAC2 static separation of duty (4.4.1) | `sp_assign_lecturer` / `sp_enroll_student` refuse Lecturer + Student of the same course |
| Dynamic SoD / role activation (2.6.1) | Users holding several roles pick one per session; the JWT carries only that role |
| Stateless security middleware (3.4.1, 4.4.3) | `authorize(resource, action)` checks every request against the matrix in the database |
| Principle of least privilege, Table 4.4 | `server/db/seed-data.js` (`MATRIX`), editable on the Roles & permissions page |
| Ownership checks (4.4.4) | `server/src/services/ownership.js`: lecturers act only on assigned courses, students only on their own work |
| Database-level isolation (3.4.1) | The app runs as `elearn_app`, which has **SELECT-only** access to `tbl_grades`. Grades can only be written through `sp_record_grade` / `sp_release_grades`, which repeat the role and ownership checks. The audit log is append-only for the app. |
| Authentication (4.4.2) | bcrypt (cost 12), lockout for 15 min after 5 failures, 30-min HS256 JWT, refresh re-checks the account |
| Token revocation | Logout, suspension, role removal and password change invalidate existing tokens at once (stricter than "within one token lifetime") |
| Audit log (4.4.1, Fig 4.6) | Every allow/deny decision, sign-in and sign-out goes to `tbl_audit_logs`. The admin viewer can filter by user, resource, decision and date. |
| Transport security | `helmet` headers and CSP. Set `TLS_CERT`/`TLS_KEY` to serve HTTPS directly, or terminate TLS at nginx and set `TRUST_PROXY=1`. |

## API overview

All routes are under `/api/v1`. Every route except `auth/login` needs `Authorization: Bearer <token>`.

| Method & path | Permission |
|---|---|
| `POST auth/login`, `POST auth/refresh`, `POST auth/logout`, `GET auth/me` | none (login) / valid session |
| `GET/POST/PUT/DELETE users…` | `/api/v1/users` C/R/U/D |
| `GET/POST roles`, `PUT roles/:id/permissions` | `/api/v1/roles` C/R/U/D |
| `GET/POST/PUT/DELETE courses…` | `/api/v1/courses` C/R/U/D (+ ownership) |
| `POST/DELETE courses/:id/lecturers`, `…/students` | `/api/v1/courses/members` UPDATE |
| `GET/POST courses/:id/materials`, `GET materials/:id/download` | `/api/v1/materials` C/R/U/D (+ ownership) |
| `GET/POST courses/:id/assignments`, `GET assignments` | `/api/v1/assignments` C/R/U/D (+ ownership) |
| `POST assignments/:id/submissions`, `GET …/submissions` | `/api/v1/submissions` C/R (+ ownership) |
| `POST grades/submit`, `POST grades/submit-bulk` | `/api/v1/grades/submit` CREATE |
| `PUT grades/release`, `GET grades/course/:id`, `GET grades/student/:id`, `GET grades/mine` | `/api/v1/grades` R/U (+ ownership) |
| `GET audit-logs`, `GET audit-logs/summary` | `/api/v1/audit-logs` READ |

## Deployment

The system runs directly on the host with Node.js and MySQL/MariaDB. For HTTPS, put it behind a reverse proxy (nginx, Apache or IIS) or set `TLS_CERT`/`TLS_KEY`. See [SETUP_GUIDE.md § 12](SETUP_GUIDE.md#12-before-real-use).
