-- =====================================================================
-- SecureLearn: secure e-learning system using role-based access control
-- Complete database: schema, stored procedures, app account and demo data.
-- Works with MySQL 8.0+ and MariaDB 10.4+ (XAMPP).
--
-- Import with phpMyAdmin (Import tab, no database selected) or:
--     mysql -u root -p < rbac_elearning.sql
--
-- WARNING: this DROPS and recreates the `rbac_elearning` database.
--
-- It also creates the MySQL account 'elearn_app' with the password
-- 'ChangeMe_App_2026!'. Put the same value in server/.env as DB_PASSWORD,
-- and change both before real use (see SETUP_GUIDE.md).
--
-- Demo sign-in passwords: Admin@12345, Lecturer@123, Student@123,
-- Assist@123 (see SETUP_GUIDE.md for the account list).
-- Generated 2026-11-13 by server/db/export-sql.js - do not edit by hand.
-- =====================================================================

SET time_zone = '+00:00';
SET NAMES utf8mb4;

DROP DATABASE IF EXISTS `rbac_elearning`;
CREATE DATABASE `rbac_elearning` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `rbac_elearning`;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tbl_users (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tbl_roles (
  roleID         INT AUTO_INCREMENT PRIMARY KEY,
  roleName       VARCHAR(30)  NOT NULL UNIQUE,
  hierarchyLevel INT          NOT NULL DEFAULT 1,
  description    VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tbl_user_roles (
  userRoleID INT AUTO_INCREMENT PRIMARY KEY,
  userID     INT NOT NULL,
  roleID     INT NOT NULL,
  UNIQUE KEY uq_user_role (userID, roleID),
  CONSTRAINT fk_ur_user FOREIGN KEY (userID) REFERENCES tbl_users(userID) ON DELETE CASCADE,
  CONSTRAINT fk_ur_role FOREIGN KEY (roleID) REFERENCES tbl_roles(roleID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tbl_permissions (
  permissionID     INT AUTO_INCREMENT PRIMARY KEY,
  resourceEndpoint VARCHAR(100) NOT NULL,
  allowedAction    VARCHAR(10)  NOT NULL,
  description      VARCHAR(255) NULL,
  UNIQUE KEY uq_perm (resourceEndpoint, allowedAction)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tbl_role_permissions (
  rolePermissionID INT AUTO_INCREMENT PRIMARY KEY,
  roleID           INT NOT NULL,
  permissionID     INT NOT NULL,
  UNIQUE KEY uq_role_perm (roleID, permissionID),
  CONSTRAINT fk_rp_role FOREIGN KEY (roleID) REFERENCES tbl_roles(roleID) ON DELETE CASCADE,
  CONSTRAINT fk_rp_perm FOREIGN KEY (permissionID) REFERENCES tbl_permissions(permissionID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tbl_audit_logs (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tbl_courses (
  courseID    INT AUTO_INCREMENT PRIMARY KEY,
  courseCode  VARCHAR(20)  NOT NULL UNIQUE,
  title       VARCHAR(150) NOT NULL,
  description TEXT NULL,
  creditUnits INT NOT NULL DEFAULT 3,
  createdAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tbl_course_lecturers (
  courseID INT NOT NULL,
  userID   INT NOT NULL,
  PRIMARY KEY (courseID, userID),
  CONSTRAINT fk_cl_course FOREIGN KEY (courseID) REFERENCES tbl_courses(courseID) ON DELETE CASCADE,
  CONSTRAINT fk_cl_user   FOREIGN KEY (userID)   REFERENCES tbl_users(userID)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tbl_enrollments (
  courseID   INT NOT NULL,
  userID     INT NOT NULL,
  enrolledAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (courseID, userID),
  CONSTRAINT fk_en_course FOREIGN KEY (courseID) REFERENCES tbl_courses(courseID) ON DELETE CASCADE,
  CONSTRAINT fk_en_user   FOREIGN KEY (userID)   REFERENCES tbl_users(userID)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tbl_materials (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tbl_assignments (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tbl_submissions (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tbl_grades (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Stored procedures (role checks and Separation of Duty in the database)
-- ---------------------------------------------------------------------
DELIMITER $$
DROP PROCEDURE IF EXISTS sp_record_grade$$

CREATE PROCEDURE sp_record_grade(
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
END$$

DROP PROCEDURE IF EXISTS sp_release_grades$$

CREATE PROCEDURE sp_release_grades(IN p_actor INT, IN p_course INT, IN p_release TINYINT)
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
END$$

DROP PROCEDURE IF EXISTS sp_assign_lecturer$$

CREATE PROCEDURE sp_assign_lecturer(IN p_course INT, IN p_user INT)
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
END$$

DROP PROCEDURE IF EXISTS sp_enroll_student$$

CREATE PROCEDURE sp_enroll_student(IN p_course INT, IN p_user INT)
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
END$$

DELIMITER ;

-- ---------------------------------------------------------------------
-- Least-privilege application account
-- ---------------------------------------------------------------------
CREATE USER IF NOT EXISTS 'elearn_app'@'localhost' IDENTIFIED BY 'ChangeMe_App_2026!';
ALTER USER 'elearn_app'@'localhost' IDENTIFIED BY 'ChangeMe_App_2026!';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rbac_elearning`.`tbl_users` TO 'elearn_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rbac_elearning`.`tbl_roles` TO 'elearn_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rbac_elearning`.`tbl_user_roles` TO 'elearn_app'@'localhost';
GRANT SELECT ON `rbac_elearning`.`tbl_permissions` TO 'elearn_app'@'localhost';
GRANT SELECT, INSERT, DELETE ON `rbac_elearning`.`tbl_role_permissions` TO 'elearn_app'@'localhost';
GRANT SELECT, INSERT ON `rbac_elearning`.`tbl_audit_logs` TO 'elearn_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rbac_elearning`.`tbl_courses` TO 'elearn_app'@'localhost';
GRANT SELECT, DELETE ON `rbac_elearning`.`tbl_course_lecturers` TO 'elearn_app'@'localhost';
GRANT SELECT, DELETE ON `rbac_elearning`.`tbl_enrollments` TO 'elearn_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rbac_elearning`.`tbl_materials` TO 'elearn_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rbac_elearning`.`tbl_assignments` TO 'elearn_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rbac_elearning`.`tbl_submissions` TO 'elearn_app'@'localhost';
GRANT SELECT ON `rbac_elearning`.`tbl_grades` TO 'elearn_app'@'localhost';
GRANT EXECUTE ON `rbac_elearning`.* TO 'elearn_app'@'localhost';
CREATE USER IF NOT EXISTS 'elearn_app'@'127.0.0.1' IDENTIFIED BY 'ChangeMe_App_2026!';
ALTER USER 'elearn_app'@'127.0.0.1' IDENTIFIED BY 'ChangeMe_App_2026!';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rbac_elearning`.`tbl_users` TO 'elearn_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rbac_elearning`.`tbl_roles` TO 'elearn_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rbac_elearning`.`tbl_user_roles` TO 'elearn_app'@'127.0.0.1';
GRANT SELECT ON `rbac_elearning`.`tbl_permissions` TO 'elearn_app'@'127.0.0.1';
GRANT SELECT, INSERT, DELETE ON `rbac_elearning`.`tbl_role_permissions` TO 'elearn_app'@'127.0.0.1';
GRANT SELECT, INSERT ON `rbac_elearning`.`tbl_audit_logs` TO 'elearn_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rbac_elearning`.`tbl_courses` TO 'elearn_app'@'127.0.0.1';
GRANT SELECT, DELETE ON `rbac_elearning`.`tbl_course_lecturers` TO 'elearn_app'@'127.0.0.1';
GRANT SELECT, DELETE ON `rbac_elearning`.`tbl_enrollments` TO 'elearn_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rbac_elearning`.`tbl_materials` TO 'elearn_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rbac_elearning`.`tbl_assignments` TO 'elearn_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rbac_elearning`.`tbl_submissions` TO 'elearn_app'@'127.0.0.1';
GRANT SELECT ON `rbac_elearning`.`tbl_grades` TO 'elearn_app'@'127.0.0.1';
GRANT EXECUTE ON `rbac_elearning`.* TO 'elearn_app'@'127.0.0.1';
CREATE USER IF NOT EXISTS 'elearn_app'@'%' IDENTIFIED BY 'ChangeMe_App_2026!';
ALTER USER 'elearn_app'@'%' IDENTIFIED BY 'ChangeMe_App_2026!';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rbac_elearning`.`tbl_users` TO 'elearn_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rbac_elearning`.`tbl_roles` TO 'elearn_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rbac_elearning`.`tbl_user_roles` TO 'elearn_app'@'%';
GRANT SELECT ON `rbac_elearning`.`tbl_permissions` TO 'elearn_app'@'%';
GRANT SELECT, INSERT, DELETE ON `rbac_elearning`.`tbl_role_permissions` TO 'elearn_app'@'%';
GRANT SELECT, INSERT ON `rbac_elearning`.`tbl_audit_logs` TO 'elearn_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rbac_elearning`.`tbl_courses` TO 'elearn_app'@'%';
GRANT SELECT, DELETE ON `rbac_elearning`.`tbl_course_lecturers` TO 'elearn_app'@'%';
GRANT SELECT, DELETE ON `rbac_elearning`.`tbl_enrollments` TO 'elearn_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rbac_elearning`.`tbl_materials` TO 'elearn_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rbac_elearning`.`tbl_assignments` TO 'elearn_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rbac_elearning`.`tbl_submissions` TO 'elearn_app'@'%';
GRANT SELECT ON `rbac_elearning`.`tbl_grades` TO 'elearn_app'@'%';
GRANT EXECUTE ON `rbac_elearning`.* TO 'elearn_app'@'%';
FLUSH PRIVILEGES;

-- ---------------------------------------------------------------------
-- Demo data
-- ---------------------------------------------------------------------
START TRANSACTION;

-- Roles (Table 4.3)
INSERT INTO tbl_roles (roleName, hierarchyLevel, description) VALUES ('Admin', 3, 'Manages users, roles, courses and system settings; views audit logs');
INSERT INTO tbl_roles (roleName, hierarchyLevel, description) VALUES ('Lecturer', 2, 'Manages assigned courses, uploads materials, creates assignments and records grades');
INSERT INTO tbl_roles (roleName, hierarchyLevel, description) VALUES ('Student', 1, 'Views enrolled courses and materials, submits assignments and views own released grades');

-- Permissions
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/users', 'CREATE', 'Create user accounts');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/users', 'READ', 'List and view user accounts');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/users', 'UPDATE', 'Edit accounts, status and role assignments');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/users', 'DELETE', 'Delete user accounts');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/profile', 'READ', 'View own profile');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/profile/password', 'UPDATE', 'Change own password');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/roles', 'CREATE', 'Create roles');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/roles', 'READ', 'View roles and the permission matrix');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/roles', 'UPDATE', 'Change role permissions');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/roles', 'DELETE', 'Delete roles');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/courses', 'CREATE', 'Create courses');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/courses', 'READ', 'View courses (scoped by ownership)');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/courses', 'UPDATE', 'Edit course details (scoped by ownership)');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/courses', 'DELETE', 'Delete courses');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/courses/members', 'UPDATE', 'Assign lecturers and enrol students');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/materials', 'CREATE', 'Upload course materials');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/materials', 'READ', 'View and download course materials');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/materials', 'UPDATE', 'Edit course materials');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/materials', 'DELETE', 'Delete course materials');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/assignments', 'CREATE', 'Create assignments');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/assignments', 'READ', 'View assignments');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/assignments', 'UPDATE', 'Edit assignments');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/assignments', 'DELETE', 'Delete assignments');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/submissions', 'CREATE', 'Submit assignments');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/submissions', 'READ', 'View assignment submissions (scoped)');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/grades/submit', 'CREATE', 'Record grades');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/grades', 'READ', 'View grades (scoped)');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/grades', 'UPDATE', 'Release / withhold grades');
INSERT INTO tbl_permissions (resourceEndpoint, allowedAction, description) VALUES ('/api/v1/audit-logs', 'READ', 'View the access audit log');

-- Role-permission matrix (Table 4.4)
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Admin' AND p.resourceEndpoint = '/api/v1/users' AND p.allowedAction = 'CREATE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Admin' AND p.resourceEndpoint = '/api/v1/users' AND p.allowedAction = 'READ';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Admin' AND p.resourceEndpoint = '/api/v1/users' AND p.allowedAction = 'UPDATE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Admin' AND p.resourceEndpoint = '/api/v1/users' AND p.allowedAction = 'DELETE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Admin' AND p.resourceEndpoint = '/api/v1/profile' AND p.allowedAction = 'READ';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Admin' AND p.resourceEndpoint = '/api/v1/profile/password' AND p.allowedAction = 'UPDATE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Admin' AND p.resourceEndpoint = '/api/v1/roles' AND p.allowedAction = 'CREATE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Admin' AND p.resourceEndpoint = '/api/v1/roles' AND p.allowedAction = 'READ';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Admin' AND p.resourceEndpoint = '/api/v1/roles' AND p.allowedAction = 'UPDATE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Admin' AND p.resourceEndpoint = '/api/v1/roles' AND p.allowedAction = 'DELETE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Admin' AND p.resourceEndpoint = '/api/v1/courses' AND p.allowedAction = 'CREATE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Admin' AND p.resourceEndpoint = '/api/v1/courses' AND p.allowedAction = 'READ';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Admin' AND p.resourceEndpoint = '/api/v1/courses' AND p.allowedAction = 'UPDATE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Admin' AND p.resourceEndpoint = '/api/v1/courses' AND p.allowedAction = 'DELETE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Admin' AND p.resourceEndpoint = '/api/v1/courses/members' AND p.allowedAction = 'UPDATE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Admin' AND p.resourceEndpoint = '/api/v1/materials' AND p.allowedAction = 'READ';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Admin' AND p.resourceEndpoint = '/api/v1/assignments' AND p.allowedAction = 'READ';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Admin' AND p.resourceEndpoint = '/api/v1/grades' AND p.allowedAction = 'READ';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Admin' AND p.resourceEndpoint = '/api/v1/audit-logs' AND p.allowedAction = 'READ';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Lecturer' AND p.resourceEndpoint = '/api/v1/profile' AND p.allowedAction = 'READ';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Lecturer' AND p.resourceEndpoint = '/api/v1/profile/password' AND p.allowedAction = 'UPDATE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Lecturer' AND p.resourceEndpoint = '/api/v1/courses' AND p.allowedAction = 'READ';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Lecturer' AND p.resourceEndpoint = '/api/v1/courses' AND p.allowedAction = 'UPDATE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Lecturer' AND p.resourceEndpoint = '/api/v1/materials' AND p.allowedAction = 'CREATE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Lecturer' AND p.resourceEndpoint = '/api/v1/materials' AND p.allowedAction = 'READ';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Lecturer' AND p.resourceEndpoint = '/api/v1/materials' AND p.allowedAction = 'UPDATE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Lecturer' AND p.resourceEndpoint = '/api/v1/materials' AND p.allowedAction = 'DELETE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Lecturer' AND p.resourceEndpoint = '/api/v1/assignments' AND p.allowedAction = 'CREATE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Lecturer' AND p.resourceEndpoint = '/api/v1/assignments' AND p.allowedAction = 'READ';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Lecturer' AND p.resourceEndpoint = '/api/v1/assignments' AND p.allowedAction = 'UPDATE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Lecturer' AND p.resourceEndpoint = '/api/v1/assignments' AND p.allowedAction = 'DELETE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Lecturer' AND p.resourceEndpoint = '/api/v1/submissions' AND p.allowedAction = 'READ';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Lecturer' AND p.resourceEndpoint = '/api/v1/grades/submit' AND p.allowedAction = 'CREATE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Lecturer' AND p.resourceEndpoint = '/api/v1/grades' AND p.allowedAction = 'READ';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Lecturer' AND p.resourceEndpoint = '/api/v1/grades' AND p.allowedAction = 'UPDATE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Student' AND p.resourceEndpoint = '/api/v1/profile' AND p.allowedAction = 'READ';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Student' AND p.resourceEndpoint = '/api/v1/profile/password' AND p.allowedAction = 'UPDATE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Student' AND p.resourceEndpoint = '/api/v1/courses' AND p.allowedAction = 'READ';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Student' AND p.resourceEndpoint = '/api/v1/materials' AND p.allowedAction = 'READ';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Student' AND p.resourceEndpoint = '/api/v1/assignments' AND p.allowedAction = 'READ';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Student' AND p.resourceEndpoint = '/api/v1/submissions' AND p.allowedAction = 'CREATE';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Student' AND p.resourceEndpoint = '/api/v1/submissions' AND p.allowedAction = 'READ';
INSERT INTO tbl_role_permissions (roleID, permissionID) SELECT r.roleID, p.permissionID FROM tbl_roles r, tbl_permissions p WHERE r.roleName = 'Student' AND p.resourceEndpoint = '/api/v1/grades' AND p.allowedAction = 'READ';

-- Demo user accounts (passwords are bcrypt hashes of the test values in seed-data.js)
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('admin@nsuk.edu.ng', 'System Administrator', '$2b$12$SExpPubmBiTRFRyspT3/t.rKFb9wwocDcNlkvXPbu00Zup3Q9cFeS', 'Active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -120 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'admin@nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Admin';
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('f.bello@nsuk.edu.ng', 'Fatima Bello (ICT Officer)', '$2b$12$qjZQr/dgsOjZNUwTV.ZXoe.9LdqOgFMRRdlBWoV7.q3glCp7znMAm', 'Active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1800 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'f.bello@nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Admin';
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('n.ajumobi@nsuk.edu.ng', 'Dr. N. Ajumobi', '$2b$12$fqrLNt5Y1P/vFu6EaOz0KeENFeuOaxxyBlles/7jBf6axDYZedm1u', 'Active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -300 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'n.ajumobi@nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Lecturer';
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('b.ajayi@nsuk.edu.ng', 'Dr. B. Ajayi', '$2b$12$ChXoxfQEMmVd2jF5gtQr9uRiq1tB/ImWBnl32YJtkobxPdqCzdrTa', 'Active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1200 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'b.ajayi@nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Lecturer';
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('a.usman@nsuk.edu.ng', 'Dr. Aisha Usman', '$2b$12$tHCaH2tUbTLwgIDMdxCHb.4y.trUQ1/B50uPttFnaOENLEp2HAXtK', 'Active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -2880 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'a.usman@nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Lecturer';
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('e.nwosu@nsuk.edu.ng', 'Mr. Emeka Nwosu', '$2b$12$zTHOxJx8HMdtcf.POw2P2.U5.XR1KGbcaMnhg/5cIfwLVWBP.HiR6', 'Active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -540 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'e.nwosu@nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Lecturer';
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('t.adeyemi@nsuk.edu.ng', 'Dr. Tunde Adeyemi', '$2b$12$3N5hm4zQCUW8DBhuxxw8y.NJL9FRAP4rUMpy5uJitmkEjF7Gi3qB.', 'Active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -4320 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 't.adeyemi@nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Lecturer';
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('ta.john@nsuk.edu.ng', 'John Okafor (Graduate Assistant)', '$2b$12$/wORrrpp75BxJR6yDpIUcejMZAwJfmJtdt6OoBJ.h24KX8QaY6D7K', 'Active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1560 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'ta.john@nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Student';
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'ta.john@nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Lecturer';
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('peace.o@student.nsuk.edu.ng', 'Peace Ogechi', '$2b$12$Tzsoy/amENUi306lAG2wzOgMMguwHzrSgGIkxxMJax9U2TA26v3rm', 'Active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -180 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'peace.o@student.nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Student';
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('musa.a@student.nsuk.edu.ng', 'Musa Abdullahi', '$2b$12$WlsW6iqgAvwh7WxyfaFl5Otm8jwDjeNnrhl47.4HhnK/qPSRWPV82', 'Active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -720 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'musa.a@student.nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Student';
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('grace.e@student.nsuk.edu.ng', 'Grace Eze', '$2b$12$Al.bfO.6Eoubd8HfKTx4B.CqjSohtezU5U3SSpVs.M577C.tCHTLW', 'Active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -420 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'grace.e@student.nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Student';
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('chinedu.o@student.nsuk.edu.ng', 'Chinedu Obi', '$2b$12$zWuCX4vgKk08DxvRvqTXQuifVJLm618JBcylLM6NmxwGOtVVltVN.', 'Active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -900 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'chinedu.o@student.nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Student';
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('aminat.y@student.nsuk.edu.ng', 'Aminat Yusuf', '$2b$12$J1BLVCoa2Y3At5yRa9Cfl.OudMQINIpdzgEI/BPcySqt6EnEVC1P6', 'Active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -2400 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'aminat.y@student.nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Student';
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('ibrahim.s@student.nsuk.edu.ng', 'Ibrahim Sani', '$2b$12$3boFMCcjA6c1nKgcHQ6yfOc9gRXdKA6aZRXgNgbtBONj81.vlG5vm', 'Active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1320 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'ibrahim.s@student.nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Student';
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('blessing.n@student.nsuk.edu.ng', 'Blessing Nnamdi', '$2b$12$dF0GvGU2q88dy0BRALMkKu3wMGO3CgbjS1h5BLXBldAGMDYC072ca', 'Active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -3600 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'blessing.n@student.nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Student';
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('halima.m@student.nsuk.edu.ng', 'Halima Mohammed', '$2b$12$Iu.B3lBL7xRjP7oPlHklgOhxtiMYcj9Dg.609t4Eus/ZZ8yGeXTU2', 'Active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1080 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'halima.m@student.nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Student';
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('emmanuel.d@student.nsuk.edu.ng', 'Emmanuel Danjuma', '$2b$12$EFtAC7fm/C8LI9W2N3L0BunSP15BX0sceOeqmEQk5VJdhVJS6rF8m', 'Active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1980 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'emmanuel.d@student.nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Student';
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('zainab.a@student.nsuk.edu.ng', 'Zainab Aliyu', '$2b$12$cqQxYB2GWJ5AhboiW71ZfeH9QBZ1m1gbohtb63tuRzv9bmqpEsqki', 'Active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -660 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'zainab.a@student.nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Student';
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('kelechi.u@student.nsuk.edu.ng', 'Kelechi Uche', '$2b$12$LuVGOWP.RthSXjJBsbE5DeLtteiUL2Rc8i5DZ26fhHB2ZqM8m4vFK', 'Active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -3000 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'kelechi.u@student.nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Student';
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('ruth.j@student.nsuk.edu.ng', 'Ruth Joseph', '$2b$12$8ubhAsnMJT/Gq/m6pi4imuM9OTJhRC72kCs3LLgf/wRQziYEje3Nq', 'Active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1620 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'ruth.j@student.nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Student';
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('yusuf.g@student.nsuk.edu.ng', 'Yusuf Garba', '$2b$12$bqLKEcLmVML2e0jGa1pGR.yFv0pBddXUbvsOakeg7Nok3do5RI.6m', 'Active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -2160 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'yusuf.g@student.nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Student';
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('esther.b@student.nsuk.edu.ng', 'Esther Bassey', '$2b$12$5pppe3m1pk.ybAnSOgO0T.zyoEPUX/UcFd8X4V8BqDIxroFcPRtme', 'Active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -840 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'esther.b@student.nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Student';
INSERT INTO tbl_users (username, fullName, passwordHash, accountStatus, lastLoginAt, createdAt) VALUES ('david.p@student.nsuk.edu.ng', 'David Peter', '$2b$12$JpZ4bGbrbehmw9QsGEwgcubPU7yPTUXLScdWiwaCBpk6iig6Sa4Z.', 'Suspended', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -24000 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172800 MINUTE));
INSERT INTO tbl_user_roles (userID, roleID) SELECT (SELECT userID FROM tbl_users WHERE username = 'david.p@student.nsuk.edu.ng'), roleID FROM tbl_roles WHERE roleName = 'Student';

-- Course CMP 401
INSERT INTO tbl_courses (courseCode, title, description, creditUnits, createdAt) VALUES ('CMP 401', 'Information Security', 'Principles of information security: the CIA triad, access control models (IBAC, RBAC, ABAC), authentication, cryptography and security auditing.', 3, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -129600 MINUTE));
SET @course = (SELECT courseID FROM tbl_courses WHERE courseCode = 'CMP 401');
CALL sp_assign_lecturer(@course, (SELECT userID FROM tbl_users WHERE username = 'n.ajumobi@nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'peace.o@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'musa.a@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'grace.e@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'chinedu.o@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'aminat.y@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'ibrahim.s@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'blessing.n@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'halima.m@student.nsuk.edu.ng'));
SET @lecturer = (SELECT userID FROM tbl_users WHERE username = 'n.ajumobi@nsuk.edu.ng');
INSERT INTO tbl_materials (courseID, title, description, uploadedBy, createdAt) VALUES (@course, 'Course outline and reading list', 'Weeks 1-3: security goals and threat models.\nWeeks 4-6: access control (ACLs, RBAC96, ABAC).\nWeeks 7-9: authentication, passwords and tokens.\nWeeks 10-12: cryptography basics and secure protocols.\nWeek 13: revision.\n\nCore reading: Sandhu et al. (1996) \"Role-based access control models\"; Saltzer & Schroeder (1975).', @lecturer, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -57600 MINUTE));
INSERT INTO tbl_materials (courseID, title, description, uploadedBy, createdAt) VALUES (@course, 'Lecture 3: Role-Based Access Control (RBAC96)', 'RBAC0 links users to roles and roles to permissions. RBAC1 adds role hierarchies (senior roles inherit junior permissions). RBAC2 adds constraints such as Separation of Duty. RBAC3 combines both.\n\nKey idea: permissions are never assigned to people directly, only to roles.', @lecturer, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -28800 MINUTE));
INSERT INTO tbl_materials (courseID, title, description, uploadedBy, createdAt) VALUES (@course, 'Lecture 5: Password storage and session tokens', 'Never store plain-text passwords. Use a slow, salted hash such as bcrypt with a cost factor of 10-12.\n\nSigned JSON Web Tokens (JWT) carry a user identity and role. The server verifies the signature on every request, so a changed role claim is rejected.', @lecturer, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -8640 MINUTE));
INSERT INTO tbl_assignments (courseID, title, instructions, maxScore, dueAt, createdBy, createdAt) VALUES (@course, 'Assignment 1: Threat model of the university portal', 'Identify five assets of the student portal, the threats to each, and one control for each threat. 2 pages maximum.', 100, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -12960 MINUTE), @lecturer, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -27360 MINUTE));
SET @assignment = LAST_INSERT_ID();
INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, (SELECT userID FROM tbl_users WHERE username = 'peace.o@student.nsuk.edu.ng'), 'Assets: student records, exam scripts, grade book, payment data, credentials. Main threat to the grade book is privilege escalation; control: RBAC with server-side checks.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -13080 MINUTE));
INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, (SELECT userID FROM tbl_users WHERE username = 'musa.a@student.nsuk.edu.ng'), 'I chose the exam question bank as the most critical asset. Threats: insider leakage, weak passwords. Controls: least privilege and audit logging.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -13380 MINUTE));
INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, (SELECT userID FROM tbl_users WHERE username = 'grace.e@student.nsuk.edu.ng'), 'See attached reasoning: confidentiality of records, integrity of grades and availability during registration.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -13680 MINUTE));
INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, (SELECT userID FROM tbl_users WHERE username = 'chinedu.o@student.nsuk.edu.ng'), 'Threat model table with STRIDE categories for each asset.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -13980 MINUTE));
INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, (SELECT userID FROM tbl_users WHERE username = 'ibrahim.s@student.nsuk.edu.ng'), 'Assets and threats listed; controls include MFA and encryption at rest.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -14280 MINUTE));
INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, (SELECT userID FROM tbl_users WHERE username = 'halima.m@student.nsuk.edu.ng'), 'Five assets analysed with likelihood and impact ratings.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -14580 MINUTE));
INSERT INTO tbl_assignments (courseID, title, instructions, maxScore, dueAt, createdBy, createdAt) VALUES (@course, 'Assignment 2: Design an RBAC matrix', 'Design a role-permission matrix for a hospital records system with at least four roles. Justify each permission using the principle of least privilege.', 100, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 14400 MINUTE), @lecturer, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -14400 MINUTE));
SET @assignment = LAST_INSERT_ID();
INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, (SELECT userID FROM tbl_users WHERE username = 'grace.e@student.nsuk.edu.ng'), 'Roles: Doctor, Nurse, Records Officer, Patient. Draft matrix attached below; Separation of Duty between Records Officer and Auditor.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -180 MINUTE));

-- Course CMP 405
INSERT INTO tbl_courses (courseCode, title, description, creditUnits, createdAt) VALUES ('CMP 405', 'Software Engineering II', 'Agile methods, object-oriented analysis and design (OOAD), UML modelling, software testing and quality assurance.', 3, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -129600 MINUTE));
SET @course = (SELECT courseID FROM tbl_courses WHERE courseCode = 'CMP 405');
CALL sp_assign_lecturer(@course, (SELECT userID FROM tbl_users WHERE username = 'b.ajayi@nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'peace.o@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'musa.a@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'ta.john@nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'emmanuel.d@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'zainab.a@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'kelechi.u@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'ruth.j@student.nsuk.edu.ng'));
SET @lecturer = (SELECT userID FROM tbl_users WHERE username = 'b.ajayi@nsuk.edu.ng');
INSERT INTO tbl_materials (courseID, title, description, uploadedBy, createdAt) VALUES (@course, 'Agile iterative development', 'Each iteration delivers a working increment that is tested before the next begins. Ceremonies: planning, daily stand-up, review and retrospective.', @lecturer, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -50400 MINUTE));
INSERT INTO tbl_materials (courseID, title, description, uploadedBy, createdAt) VALUES (@course, 'UML: use case, class and sequence diagrams', 'Use case diagrams show actors and system boundaries. Class diagrams show structure. Sequence diagrams show the order of messages, e.g. login -> token check -> permission lookup -> response.', @lecturer, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -25920 MINUTE));
INSERT INTO tbl_assignments (courseID, title, instructions, maxScore, dueAt, createdBy, createdAt) VALUES (@course, 'Group project: Sprint 1 report', 'Submit your sprint backlog, burndown chart and retrospective notes.', 100, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -20160 MINUTE), @lecturer, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -34560 MINUTE));
SET @assignment = LAST_INSERT_ID();
INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, (SELECT userID FROM tbl_users WHERE username = 'peace.o@student.nsuk.edu.ng'), 'Sprint 1 completed 8 of 10 stories; authentication and role middleware done.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -20280 MINUTE));
INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, (SELECT userID FROM tbl_users WHERE username = 'musa.a@student.nsuk.edu.ng'), 'Burndown attached; velocity 21 points.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -20580 MINUTE));
INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, (SELECT userID FROM tbl_users WHERE username = 'emmanuel.d@student.nsuk.edu.ng'), 'Backlog and retro notes.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -20880 MINUTE));
INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, (SELECT userID FROM tbl_users WHERE username = 'zainab.a@student.nsuk.edu.ng'), 'Sprint 1 report with test results.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -21180 MINUTE));
INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, (SELECT userID FROM tbl_users WHERE username = 'kelechi.u@student.nsuk.edu.ng'), 'Report attached.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -21480 MINUTE));
INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, (SELECT userID FROM tbl_users WHERE username = 'ruth.j@student.nsuk.edu.ng'), 'Retrospective: improve code review turnaround.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -21780 MINUTE));
INSERT INTO tbl_assignments (courseID, title, instructions, maxScore, dueAt, createdBy, createdAt) VALUES (@course, 'Unit testing exercise', 'Write five unit tests for a password-policy function. Include at least two failing cases.', 50, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7200 MINUTE), @lecturer, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -14400 MINUTE));
SET @assignment = LAST_INSERT_ID();
CALL sp_record_grade(@lecturer, @course, (SELECT userID FROM tbl_users WHERE username = 'peace.o@student.nsuk.edu.ng'), 74, 'Excellent sprint leadership');
CALL sp_record_grade(@lecturer, @course, (SELECT userID FROM tbl_users WHERE username = 'musa.a@student.nsuk.edu.ng'), 66, 'Good');
CALL sp_record_grade(@lecturer, @course, (SELECT userID FROM tbl_users WHERE username = 'ta.john@nsuk.edu.ng'), 71, 'Very good');
CALL sp_record_grade(@lecturer, @course, (SELECT userID FROM tbl_users WHERE username = 'emmanuel.d@student.nsuk.edu.ng'), 58, 'Fair');
CALL sp_record_grade(@lecturer, @course, (SELECT userID FROM tbl_users WHERE username = 'zainab.a@student.nsuk.edu.ng'), 63, 'Good');
CALL sp_record_grade(@lecturer, @course, (SELECT userID FROM tbl_users WHERE username = 'kelechi.u@student.nsuk.edu.ng'), 47, 'Needs improvement on testing');
CALL sp_record_grade(@lecturer, @course, (SELECT userID FROM tbl_users WHERE username = 'ruth.j@student.nsuk.edu.ng'), 69, 'Good');
UPDATE tbl_grades SET released = 1 WHERE courseID = @course;

-- Course CMP 311
INSERT INTO tbl_courses (courseCode, title, description, creditUnits, createdAt) VALUES ('CMP 311', 'Database Management Systems', 'Relational modelling, normalisation, SQL, transactions, stored procedures and database security.', 2, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -129600 MINUTE));
SET @course = (SELECT courseID FROM tbl_courses WHERE courseCode = 'CMP 311');
CALL sp_assign_lecturer(@course, (SELECT userID FROM tbl_users WHERE username = 'n.ajumobi@nsuk.edu.ng'));
CALL sp_assign_lecturer(@course, (SELECT userID FROM tbl_users WHERE username = 'ta.john@nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'grace.e@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'yusuf.g@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'esther.b@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'halima.m@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'ibrahim.s@student.nsuk.edu.ng'));
SET @lecturer = (SELECT userID FROM tbl_users WHERE username = 'n.ajumobi@nsuk.edu.ng');
INSERT INTO tbl_materials (courseID, title, description, uploadedBy, createdAt) VALUES (@course, 'Normalisation (1NF to BCNF)', 'A table is in 3NF when every non-key attribute depends on the key, the whole key and nothing but the key.', @lecturer, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -36000 MINUTE));
INSERT INTO tbl_materials (courseID, title, description, uploadedBy, createdAt) VALUES (@course, 'Stored procedures and privileges', 'GRANT EXECUTE on a procedure lets an account change data only through that procedure, which can enforce business rules such as \"only the course lecturer may record grades\".', @lecturer, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -5760 MINUTE));
INSERT INTO tbl_assignments (courseID, title, instructions, maxScore, dueAt, createdBy, createdAt) VALUES (@course, 'SQL practical 1', 'Write queries for the ten questions in the practical sheet discussed in class.', 100, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -8640 MINUTE), @lecturer, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -23040 MINUTE));
SET @assignment = LAST_INSERT_ID();
INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, (SELECT userID FROM tbl_users WHERE username = 'grace.e@student.nsuk.edu.ng'), 'SELECT ... JOIN answers for Q1-Q10.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -8760 MINUTE));
INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, (SELECT userID FROM tbl_users WHERE username = 'yusuf.g@student.nsuk.edu.ng'), 'All ten queries attempted.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -9060 MINUTE));
INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, (SELECT userID FROM tbl_users WHERE username = 'esther.b@student.nsuk.edu.ng'), 'Q1-Q8 completed.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -9360 MINUTE));
INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, (SELECT userID FROM tbl_users WHERE username = 'halima.m@student.nsuk.edu.ng'), 'Queries with explanations.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -9660 MINUTE));
CALL sp_record_grade(@lecturer, @course, (SELECT userID FROM tbl_users WHERE username = 'grace.e@student.nsuk.edu.ng'), 82, 'Outstanding');
CALL sp_record_grade(@lecturer, @course, (SELECT userID FROM tbl_users WHERE username = 'yusuf.g@student.nsuk.edu.ng'), 61, 'Good');
CALL sp_record_grade(@lecturer, @course, (SELECT userID FROM tbl_users WHERE username = 'esther.b@student.nsuk.edu.ng'), 55, 'Fair');
CALL sp_record_grade(@lecturer, @course, (SELECT userID FROM tbl_users WHERE username = 'halima.m@student.nsuk.edu.ng'), 72, 'Very good');
CALL sp_record_grade(@lecturer, @course, (SELECT userID FROM tbl_users WHERE username = 'ibrahim.s@student.nsuk.edu.ng'), 38, 'Did not submit practicals');
UPDATE tbl_grades SET released = 1 WHERE courseID = @course;

-- Course CMP 307
INSERT INTO tbl_courses (courseCode, title, description, creditUnits, createdAt) VALUES ('CMP 307', 'Computer Networks', 'Network models, TCP/IP, routing, transport protocols and network security basics.', 3, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -129600 MINUTE));
SET @course = (SELECT courseID FROM tbl_courses WHERE courseCode = 'CMP 307');
CALL sp_assign_lecturer(@course, (SELECT userID FROM tbl_users WHERE username = 'a.usman@nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'chinedu.o@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'aminat.y@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'blessing.n@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'emmanuel.d@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'zainab.a@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'peace.o@student.nsuk.edu.ng'));
SET @lecturer = (SELECT userID FROM tbl_users WHERE username = 'a.usman@nsuk.edu.ng');
INSERT INTO tbl_materials (courseID, title, description, uploadedBy, createdAt) VALUES (@course, 'The TCP/IP model', 'Four layers: link, internet, transport and application. HTTPS runs HTTP over TLS at the application layer.', @lecturer, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -43200 MINUTE));
INSERT INTO tbl_materials (courseID, title, description, uploadedBy, createdAt) VALUES (@course, 'Subnetting worksheet', 'Practise dividing 192.168.10.0/24 into eight equal subnets; list network address, broadcast address and usable hosts for each.', @lecturer, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -17280 MINUTE));
INSERT INTO tbl_assignments (courseID, title, instructions, maxScore, dueAt, createdBy, createdAt) VALUES (@course, 'Subnetting test', 'Answer all questions on the worksheet.', 100, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -4320 MINUTE), @lecturer, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -18720 MINUTE));
SET @assignment = LAST_INSERT_ID();
INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, (SELECT userID FROM tbl_users WHERE username = 'chinedu.o@student.nsuk.edu.ng'), 'Eight /27 subnets listed.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -4440 MINUTE));
INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, (SELECT userID FROM tbl_users WHERE username = 'aminat.y@student.nsuk.edu.ng'), 'Answers attached.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -4740 MINUTE));
INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, (SELECT userID FROM tbl_users WHERE username = 'blessing.n@student.nsuk.edu.ng'), 'All questions done.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -5040 MINUTE));
INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, (SELECT userID FROM tbl_users WHERE username = 'peace.o@student.nsuk.edu.ng'), 'Worked answers with host ranges.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -5340 MINUTE));
CALL sp_record_grade(@lecturer, @course, (SELECT userID FROM tbl_users WHERE username = 'chinedu.o@student.nsuk.edu.ng'), 64, NULL);
CALL sp_record_grade(@lecturer, @course, (SELECT userID FROM tbl_users WHERE username = 'aminat.y@student.nsuk.edu.ng'), 77, NULL);
CALL sp_record_grade(@lecturer, @course, (SELECT userID FROM tbl_users WHERE username = 'blessing.n@student.nsuk.edu.ng'), 52, NULL);
CALL sp_record_grade(@lecturer, @course, (SELECT userID FROM tbl_users WHERE username = 'emmanuel.d@student.nsuk.edu.ng'), 44, NULL);
CALL sp_record_grade(@lecturer, @course, (SELECT userID FROM tbl_users WHERE username = 'zainab.a@student.nsuk.edu.ng'), 68, NULL);
CALL sp_record_grade(@lecturer, @course, (SELECT userID FROM tbl_users WHERE username = 'peace.o@student.nsuk.edu.ng'), 71, NULL);

-- Course CMP 321
INSERT INTO tbl_courses (courseCode, title, description, creditUnits, createdAt) VALUES ('CMP 321', 'Operating Systems', 'Processes, threads, scheduling, memory management, file systems and protection.', 3, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -129600 MINUTE));
SET @course = (SELECT courseID FROM tbl_courses WHERE courseCode = 'CMP 321');
CALL sp_assign_lecturer(@course, (SELECT userID FROM tbl_users WHERE username = 'e.nwosu@nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'kelechi.u@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'ruth.j@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'yusuf.g@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'esther.b@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'musa.a@student.nsuk.edu.ng'));
SET @lecturer = (SELECT userID FROM tbl_users WHERE username = 'e.nwosu@nsuk.edu.ng');
INSERT INTO tbl_materials (courseID, title, description, uploadedBy, createdAt) VALUES (@course, 'CPU scheduling algorithms', 'FCFS, SJF, Priority and Round Robin. Compare average waiting time on the example in class.', @lecturer, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -21600 MINUTE));
INSERT INTO tbl_assignments (courseID, title, instructions, maxScore, dueAt, createdBy, createdAt) VALUES (@course, 'Scheduling simulation', 'Simulate Round Robin with quantum 4 on the given process set and report average waiting time.', 100, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10080 MINUTE), @lecturer, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -14400 MINUTE));
SET @assignment = LAST_INSERT_ID();
INSERT INTO tbl_submissions (assignmentID, studentID, content, submittedAt) VALUES (@assignment, (SELECT userID FROM tbl_users WHERE username = 'ruth.j@student.nsuk.edu.ng'), 'Average waiting time = 7.5 ms (Gantt chart in answer).', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -180 MINUTE));

-- Course CMP 499
INSERT INTO tbl_courses (courseCode, title, description, creditUnits, createdAt) VALUES ('CMP 499', 'Final Year Project', 'Independent project: proposal, literature review, design, implementation and defence.', 6, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -129600 MINUTE));
SET @course = (SELECT courseID FROM tbl_courses WHERE courseCode = 'CMP 499');
CALL sp_assign_lecturer(@course, (SELECT userID FROM tbl_users WHERE username = 't.adeyemi@nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'peace.o@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'musa.a@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'grace.e@student.nsuk.edu.ng'));
CALL sp_enroll_student(@course, (SELECT userID FROM tbl_users WHERE username = 'chinedu.o@student.nsuk.edu.ng'));
SET @lecturer = (SELECT userID FROM tbl_users WHERE username = 't.adeyemi@nsuk.edu.ng');
INSERT INTO tbl_materials (courseID, title, description, uploadedBy, createdAt) VALUES (@course, 'Project report template and timeline', 'Chapter 1 Introduction, Chapter 2 Literature Review, Chapter 3 Methodology, Chapter 4 Implementation and Results, Chapter 5 Summary and Conclusion.\n\nChapter 4 draft due in week 10; final defence in week 14.', @lecturer, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -72000 MINUTE));
INSERT INTO tbl_assignments (courseID, title, instructions, maxScore, dueAt, createdBy, createdAt) VALUES (@course, 'Chapter 4 draft', 'Upload the draft of Chapter 4 (implementation, testing and results).', 100, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 20160 MINUTE), @lecturer, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -14400 MINUTE));
SET @assignment = LAST_INSERT_ID();

-- Audit history
INSERT INTO tbl_audit_logs (userID, username, roleName, resource, action, decision, reason, ipAddress, createdAt) VALUES ((SELECT userID FROM tbl_users WHERE username = 'admin@nsuk.edu.ng'), 'admin@nsuk.edu.ng', 'Admin', '/api/v1/auth/login', 'LOGIN', 'ALLOWED', 'Login successful', '10.0.0.5', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -3000 MINUTE));
INSERT INTO tbl_audit_logs (userID, username, roleName, resource, action, decision, reason, ipAddress, createdAt) VALUES ((SELECT userID FROM tbl_users WHERE username = 'peace.o@student.nsuk.edu.ng'), 'peace.o@student.nsuk.edu.ng', 'Student', 'POST /api/v1/grades/submit', 'CREATE', 'DENIED', 'Role Student lacks CREATE on /api/v1/grades/submit', '10.0.0.23', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -2760 MINUTE));
INSERT INTO tbl_audit_logs (userID, username, roleName, resource, action, decision, reason, ipAddress, createdAt) VALUES (NULL, NULL, NULL, '/api/v1/auth/login', 'LOGIN', 'DENIED', 'Unknown username', '41.203.72.11', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -2400 MINUTE));
INSERT INTO tbl_audit_logs (userID, username, roleName, resource, action, decision, reason, ipAddress, createdAt) VALUES (NULL, NULL, NULL, '/api/v1/auth/login', 'LOGIN', 'DENIED', 'Unknown username', '41.203.72.11', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -2400 MINUTE));
INSERT INTO tbl_audit_logs (userID, username, roleName, resource, action, decision, reason, ipAddress, createdAt) VALUES ((SELECT userID FROM tbl_users WHERE username = 'musa.a@student.nsuk.edu.ng'), 'musa.a@student.nsuk.edu.ng', NULL, '/api/v1/auth/login', 'LOGIN', 'DENIED', 'Wrong password (1)', '10.0.0.31', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1800 MINUTE));
INSERT INTO tbl_audit_logs (userID, username, roleName, resource, action, decision, reason, ipAddress, createdAt) VALUES ((SELECT userID FROM tbl_users WHERE username = 'musa.a@student.nsuk.edu.ng'), 'musa.a@student.nsuk.edu.ng', 'Student', '/api/v1/auth/login', 'LOGIN', 'ALLOWED', 'Login successful', '10.0.0.31', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1800 MINUTE));
INSERT INTO tbl_audit_logs (userID, username, roleName, resource, action, decision, reason, ipAddress, createdAt) VALUES ((SELECT userID FROM tbl_users WHERE username = 'musa.a@student.nsuk.edu.ng'), 'musa.a@student.nsuk.edu.ng', 'Student', 'GET /api/v1/grades/student/11', 'READ', 'DENIED', 'Ownership check failed: grades of student 11', '10.0.0.31', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1740 MINUTE));
INSERT INTO tbl_audit_logs (userID, username, roleName, resource, action, decision, reason, ipAddress, createdAt) VALUES ((SELECT userID FROM tbl_users WHERE username = 'b.ajayi@nsuk.edu.ng'), 'b.ajayi@nsuk.edu.ng', 'Lecturer', 'GET /api/v1/users', 'READ', 'DENIED', 'Role Lecturer lacks READ on /api/v1/users', '10.0.0.12', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1200 MINUTE));
INSERT INTO tbl_audit_logs (userID, username, roleName, resource, action, decision, reason, ipAddress, createdAt) VALUES ((SELECT userID FROM tbl_users WHERE username = 'b.ajayi@nsuk.edu.ng'), 'b.ajayi@nsuk.edu.ng', 'Lecturer', 'POST /api/v1/grades/submit-bulk', 'CREATE', 'ALLOWED', NULL, '10.0.0.12', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1140 MINUTE));
INSERT INTO tbl_audit_logs (userID, username, roleName, resource, action, decision, reason, ipAddress, createdAt) VALUES (NULL, NULL, NULL, '/api/v1/courses', 'READ', 'DENIED', 'Invalid token signature', '10.0.0.44', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -960 MINUTE));
INSERT INTO tbl_audit_logs (userID, username, roleName, resource, action, decision, reason, ipAddress, createdAt) VALUES ((SELECT userID FROM tbl_users WHERE username = 'david.p@student.nsuk.edu.ng'), 'david.p@student.nsuk.edu.ng', NULL, '/api/v1/auth/login', 'LOGIN', 'DENIED', 'Account Suspended', '10.0.0.52', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -480 MINUTE));
INSERT INTO tbl_audit_logs (userID, username, roleName, resource, action, decision, reason, ipAddress, createdAt) VALUES ((SELECT userID FROM tbl_users WHERE username = 'grace.e@student.nsuk.edu.ng'), 'grace.e@student.nsuk.edu.ng', 'Student', 'POST /api/v1/assignments/2/submissions', 'CREATE', 'ALLOWED', NULL, '10.0.0.27', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -360 MINUTE));
COMMIT;
