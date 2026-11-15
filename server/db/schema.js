// Database schema for the secure e-learning system (Section 3.7 / 4.4.1).
// Written to run on both MySQL 8.0 and MariaDB 10.4+.
// Each entry is executed as a single statement, so stored procedures need no DELIMITER.

const TABLES = [
  // ---- Core RBAC tables (Section 3.7.2, Tables 1-5) ----
  `CREATE TABLE IF NOT EXISTS tbl_users (
     userID         INT AUTO_INCREMENT PRIMARY KEY,
     username       VARCHAR(50)  NOT NULL UNIQUE,
     fullName       VARCHAR(100) NOT NULL,
     passwordHash   VARCHAR(255) NOT NULL,
     accountStatus  VARCHAR(15)  NOT NULL DEFAULT 'Active',
     failedAttempts INT          NOT NULL DEFAULT 0,
     lockedUntil    DATETIME     NULL,
     tokenVersion   INT          NOT NULL DEFAULT 0,
     lastLoginAt    DATETIME     NULL,
     createdAt      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS tbl_roles (
     roleID         INT AUTO_INCREMENT PRIMARY KEY,
     roleName       VARCHAR(30)  NOT NULL UNIQUE,
     hierarchyLevel INT          NOT NULL DEFAULT 1,
     description    VARCHAR(255) NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS tbl_user_roles (
     userRoleID INT AUTO_INCREMENT PRIMARY KEY,
     userID     INT NOT NULL,
     roleID     INT NOT NULL,
     UNIQUE KEY uq_user_role (userID, roleID),
     CONSTRAINT fk_ur_user FOREIGN KEY (userID) REFERENCES tbl_users(userID) ON DELETE CASCADE,
     CONSTRAINT fk_ur_role FOREIGN KEY (roleID) REFERENCES tbl_roles(roleID) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS tbl_permissions (
     permissionID     INT AUTO_INCREMENT PRIMARY KEY,
     resourceEndpoint VARCHAR(100) NOT NULL,
     allowedAction    VARCHAR(10)  NOT NULL,
     description      VARCHAR(255) NULL,
     UNIQUE KEY uq_perm (resourceEndpoint, allowedAction)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS tbl_role_permissions (
     rolePermissionID INT AUTO_INCREMENT PRIMARY KEY,
     roleID           INT NOT NULL,
     permissionID     INT NOT NULL,
     UNIQUE KEY uq_role_perm (roleID, permissionID),
     CONSTRAINT fk_rp_role FOREIGN KEY (roleID) REFERENCES tbl_roles(roleID) ON DELETE CASCADE,
     CONSTRAINT fk_rp_perm FOREIGN KEY (permissionID) REFERENCES tbl_permissions(permissionID) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // ---- Audit log (Section 4.4.1) ----
  `CREATE TABLE IF NOT EXISTS tbl_audit_logs (
     logID     BIGINT AUTO_INCREMENT PRIMARY KEY,
     userID    INT          NULL,
     username  VARCHAR(50)  NULL,
     roleName  VARCHAR(30)  NULL,
     resource  VARCHAR(150) NOT NULL,
     action    VARCHAR(10)  NOT NULL,
     decision  VARCHAR(10)  NOT NULL,
     reason    VARCHAR(255) NULL,
     ipAddress VARCHAR(45)  NULL,
     createdAt DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
     KEY ix_audit_time (createdAt),
     KEY ix_audit_user (userID),
     KEY ix_audit_decision (decision)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // ---- Academic tables ----
  `CREATE TABLE IF NOT EXISTS tbl_courses (
     courseID    INT AUTO_INCREMENT PRIMARY KEY,
     courseCode  VARCHAR(20)  NOT NULL UNIQUE,
     title       VARCHAR(150) NOT NULL,
     description TEXT NULL,
     creditUnits INT NOT NULL DEFAULT 3,
     createdAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS tbl_course_lecturers (
     courseID INT NOT NULL,
     userID   INT NOT NULL,
     PRIMARY KEY (courseID, userID),
     CONSTRAINT fk_cl_course FOREIGN KEY (courseID) REFERENCES tbl_courses(courseID) ON DELETE CASCADE,
     CONSTRAINT fk_cl_user   FOREIGN KEY (userID)   REFERENCES tbl_users(userID)     ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS tbl_enrollments (
     courseID   INT NOT NULL,
     userID     INT NOT NULL,
     enrolledAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY (courseID, userID),
     CONSTRAINT fk_en_course FOREIGN KEY (courseID) REFERENCES tbl_courses(courseID) ON DELETE CASCADE,
     CONSTRAINT fk_en_user   FOREIGN KEY (userID)   REFERENCES tbl_users(userID)     ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS tbl_materials (
     materialID   INT AUTO_INCREMENT PRIMARY KEY,
     courseID     INT NOT NULL,
     title        VARCHAR(150) NOT NULL,
     description  TEXT NULL,
     filePath     VARCHAR(255) NULL,
     originalName VARCHAR(255) NULL,
     mimeType     VARCHAR(100) NULL,
     fileSize     INT NULL,
     uploadedBy   INT NULL,
     createdAt    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT fk_mat_course FOREIGN KEY (courseID)   REFERENCES tbl_courses(courseID) ON DELETE CASCADE,
     CONSTRAINT fk_mat_user   FOREIGN KEY (uploadedBy) REFERENCES tbl_users(userID)     ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS tbl_assignments (
     assignmentID INT AUTO_INCREMENT PRIMARY KEY,
     courseID     INT NOT NULL,
     title        VARCHAR(150) NOT NULL,
     instructions TEXT NULL,
     maxScore     INT NOT NULL DEFAULT 100,
     dueAt        DATETIME NOT NULL,
     createdBy    INT NULL,
     createdAt    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT fk_as_course FOREIGN KEY (courseID)  REFERENCES tbl_courses(courseID) ON DELETE CASCADE,
     CONSTRAINT fk_as_user   FOREIGN KEY (createdBy) REFERENCES tbl_users(userID)     ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS tbl_submissions (
     submissionID INT AUTO_INCREMENT PRIMARY KEY,
     assignmentID INT NOT NULL,
     studentID    INT NOT NULL,
     content      TEXT NULL,
     filePath     VARCHAR(255) NULL,
     originalName VARCHAR(255) NULL,
     mimeType     VARCHAR(100) NULL,
     fileSize     INT NULL,
     submittedAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     UNIQUE KEY uq_sub (assignmentID, studentID),
     CONSTRAINT fk_sub_as   FOREIGN KEY (assignmentID) REFERENCES tbl_assignments(assignmentID) ON DELETE CASCADE,
     CONSTRAINT fk_sub_user FOREIGN KEY (studentID)    REFERENCES tbl_users(userID)             ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS tbl_grades (
     gradeID    INT AUTO_INCREMENT PRIMARY KEY,
     courseID   INT NOT NULL,
     studentID  INT NOT NULL,
     score      DECIMAL(5,2) NOT NULL,
     letter     CHAR(1) NOT NULL,
     remarks    VARCHAR(255) NULL,
     released   TINYINT(1) NOT NULL DEFAULT 0,
     recordedBy INT NULL,
     updatedAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     UNIQUE KEY uq_grade (courseID, studentID),
     CONSTRAINT fk_gr_course FOREIGN KEY (courseID)   REFERENCES tbl_courses(courseID) ON DELETE CASCADE,
     CONSTRAINT fk_gr_user   FOREIGN KEY (studentID)  REFERENCES tbl_users(userID)     ON DELETE CASCADE,
     CONSTRAINT fk_gr_rec    FOREIGN KEY (recordedBy) REFERENCES tbl_users(userID)     ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

// Stored procedures (Section 3.4.1 "Database-Level Isolation", Section 4.4.4).
// The application DB account has only SELECT on tbl_grades, so grades can be written
// exclusively through these procedures, which repeat the role and ownership checks.
const PROCEDURES = [
  `DROP PROCEDURE IF EXISTS sp_record_grade`,
  `CREATE PROCEDURE sp_record_grade(
     IN p_actor INT, IN p_course INT, IN p_student INT, IN p_score DECIMAL(5,2), IN p_remarks VARCHAR(255))
   BEGIN
     DECLARE v_is_lecturer INT DEFAULT 0;
     DECLARE v_assigned INT DEFAULT 0;
     DECLARE v_enrolled INT DEFAULT 0;
     DECLARE v_letter CHAR(1);

     SELECT COUNT(*) INTO v_is_lecturer
       FROM tbl_user_roles ur JOIN tbl_roles r ON r.roleID = ur.roleID
       JOIN tbl_users u ON u.userID = ur.userID
      WHERE ur.userID = p_actor AND r.roleName = 'Lecturer' AND u.accountStatus = 'Active';
     IF v_is_lecturer = 0 THEN
       SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RBAC: only an active Lecturer may record grades';
     END IF;

     SELECT COUNT(*) INTO v_assigned FROM tbl_course_lecturers WHERE courseID = p_course AND userID = p_actor;
     IF v_assigned = 0 THEN
       SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RBAC: lecturer is not assigned to this course';
     END IF;

     SELECT COUNT(*) INTO v_enrolled FROM tbl_enrollments WHERE courseID = p_course AND userID = p_student;
     IF v_enrolled = 0 THEN
       SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RBAC: student is not enrolled in this course';
     END IF;

     IF p_score < 0 OR p_score > 100 THEN
       SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Score must be between 0 and 100';
     END IF;

     SET v_letter = CASE
       WHEN p_score >= 70 THEN 'A' WHEN p_score >= 60 THEN 'B' WHEN p_score >= 50 THEN 'C'
       WHEN p_score >= 45 THEN 'D' WHEN p_score >= 40 THEN 'E' ELSE 'F' END;

     INSERT INTO tbl_grades (courseID, studentID, score, letter, remarks, recordedBy, updatedAt)
     VALUES (p_course, p_student, p_score, v_letter, p_remarks, p_actor, NOW())
     ON DUPLICATE KEY UPDATE score = VALUES(score), letter = VALUES(letter), remarks = VALUES(remarks),
                             recordedBy = VALUES(recordedBy), updatedAt = NOW();
   END`,

  `DROP PROCEDURE IF EXISTS sp_release_grades`,
  `CREATE PROCEDURE sp_release_grades(IN p_actor INT, IN p_course INT, IN p_release TINYINT)
   BEGIN
     DECLARE v_ok INT DEFAULT 0;
     SELECT COUNT(*) INTO v_ok
       FROM tbl_course_lecturers cl
       JOIN tbl_user_roles ur ON ur.userID = cl.userID
       JOIN tbl_roles r ON r.roleID = ur.roleID AND r.roleName = 'Lecturer'
       JOIN tbl_users u ON u.userID = cl.userID AND u.accountStatus = 'Active'
      WHERE cl.courseID = p_course AND cl.userID = p_actor;
     IF v_ok = 0 THEN
       SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RBAC: only the assigned Lecturer may release grades';
     END IF;
     UPDATE tbl_grades SET released = IF(p_release = 1, 1, 0), updatedAt = NOW() WHERE courseID = p_course;
   END`,

  // Static Separation of Duty (RBAC2, Section 4.4.1): one account may not be both the
  // Lecturer and a Student of the same course.
  `DROP PROCEDURE IF EXISTS sp_assign_lecturer`,
  `CREATE PROCEDURE sp_assign_lecturer(IN p_course INT, IN p_user INT)
   BEGIN
     DECLARE v_role INT DEFAULT 0;
     DECLARE v_conflict INT DEFAULT 0;
     SELECT COUNT(*) INTO v_role FROM tbl_user_roles ur JOIN tbl_roles r ON r.roleID = ur.roleID
      WHERE ur.userID = p_user AND r.roleName = 'Lecturer';
     IF v_role = 0 THEN
       SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User does not hold the Lecturer role';
     END IF;
     SELECT COUNT(*) INTO v_conflict FROM tbl_enrollments WHERE courseID = p_course AND userID = p_user;
     IF v_conflict > 0 THEN
       SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Separation of Duty: user is already a Student of this course';
     END IF;
     INSERT IGNORE INTO tbl_course_lecturers (courseID, userID) VALUES (p_course, p_user);
   END`,

  `DROP PROCEDURE IF EXISTS sp_enroll_student`,
  `CREATE PROCEDURE sp_enroll_student(IN p_course INT, IN p_user INT)
   BEGIN
     DECLARE v_role INT DEFAULT 0;
     DECLARE v_conflict INT DEFAULT 0;
     SELECT COUNT(*) INTO v_role FROM tbl_user_roles ur JOIN tbl_roles r ON r.roleID = ur.roleID
      WHERE ur.userID = p_user AND r.roleName = 'Student';
     IF v_role = 0 THEN
       SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User does not hold the Student role';
     END IF;
     SELECT COUNT(*) INTO v_conflict FROM tbl_course_lecturers WHERE courseID = p_course AND userID = p_user;
     IF v_conflict > 0 THEN
       SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Separation of Duty: user is already the Lecturer of this course';
     END IF;
     INSERT IGNORE INTO tbl_enrollments (courseID, userID) VALUES (p_course, p_user);
   END`,
];

// Tables the application account may only read / append to (database-level isolation).
const TABLE_GRANTS = {
  tbl_users: 'SELECT, INSERT, UPDATE, DELETE',
  tbl_roles: 'SELECT, INSERT, UPDATE, DELETE',
  tbl_user_roles: 'SELECT, INSERT, UPDATE, DELETE',
  tbl_permissions: 'SELECT',
  tbl_role_permissions: 'SELECT, INSERT, DELETE',
  tbl_audit_logs: 'SELECT, INSERT', // append-only: audit records cannot be edited or erased by the app
  tbl_courses: 'SELECT, INSERT, UPDATE, DELETE',
  tbl_course_lecturers: 'SELECT, DELETE', // inserts only via sp_assign_lecturer (SoD)
  tbl_enrollments: 'SELECT, DELETE', // inserts only via sp_enroll_student (SoD)
  tbl_materials: 'SELECT, INSERT, UPDATE, DELETE',
  tbl_assignments: 'SELECT, INSERT, UPDATE, DELETE',
  tbl_submissions: 'SELECT, INSERT, UPDATE, DELETE',
  tbl_grades: 'SELECT', // writes only via sp_record_grade / sp_release_grades
};

module.exports = { TABLES, PROCEDURES, TABLE_GRANTS };
