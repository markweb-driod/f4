# SecureLearn: Installation and Setup Guide

This guide shows you how to install **SecureLearn**, the secure e-learning system using role-based access control, on your own computer. It also takes you through the demo data and explains how to fix common problems.

No programming knowledge is needed for a standard installation. Allow about **15–20 minutes** the first time; most of that is downloading software.

---

## Contents

1. [What you are installing](#1-what-you-are-installing)
2. [Requirements](#2-requirements)
3. [Quick start (Windows)](#3-quick-start-windows)
4. [Step-by-step installation on Windows](#4-step-by-step-installation-on-windows)
5. [Installation on macOS and Linux](#5-installation-on-macos-and-linux)
6. [Alternative: import the database with phpMyAdmin](#6-alternative-import-the-database-with-phpmyadmin)
7. [Demo accounts](#7-demo-accounts)
8. [Guided demo tour](#8-guided-demo-tour)
9. [Using it from phones and other computers](#9-using-it-from-phones-and-other-computers)
10. [Everyday operation](#10-everyday-operation)
11. [Configuration reference](#11-configuration-reference)
12. [Before real use](#12-before-real-use)
13. [Troubleshooting](#13-troubleshooting)
14. [Uninstalling](#14-uninstalling)

---

## 1. What you are installing

SecureLearn has three parts, and all of them run on your computer:

| Part | What it is | Where it lives |
|---|---|---|
| **Database** | MySQL or MariaDB. It stores users, courses, grades and the audit log. | Provided by XAMPP (or a separate MySQL install) |
| **Server** | A Node.js program. It checks every request against the user's role before doing anything. | `F4/server` |
| **Web interface** | The pages you see in the browser. | `F4/client` (the setup builds it into `client/dist`) |

Once the system is running, you use it in a web browser at **http://localhost:4000**.

---

## 2. Requirements

| Item | Minimum | Recommended |
|---|---|---|
| Operating system | Windows 10, macOS 12, or Ubuntu 20.04 | Windows 11 / latest macOS / Ubuntu 22.04+ |
| Processor and memory | Dual-core, 4 GB RAM | Quad-core, 8 GB RAM |
| Free disk space | 1 GB (including XAMPP and Node.js) | 2 GB |
| **Node.js** | Version 18 | **Version 20 or 22 LTS** |
| **Database** | MariaDB 10.4 (XAMPP 8.x) or MySQL 8.0 | XAMPP 8.2 |
| Browser | Any current Chrome, Edge, Firefox or Safari | Chrome or Edge |
| Internet | Only during installation, to download packages | – |

You do **not** need Docker, Apache, PHP or any programming tools.

---

## 3. Quick start (Windows)

If you are comfortable installing software, these steps are enough. Section 4 explains each one in detail.

1. Install **XAMPP** from https://www.apachefriends.org.
2. Install **Node.js LTS** from https://nodejs.org (keep all the default options).
3. Open the **XAMPP Control Panel** and click **Start** next to **MySQL**.
4. In the `F4` project folder, double-click **`setup.bat`**. Press **Enter** at every question. (A fresh XAMPP install has an empty root password.)
5. When it says **Setup complete**, double-click **`start.bat`**.
6. Open **http://localhost:4000** and sign in as `admin@nsuk.edu.ng` with the password `Admin@12345`.

---

## 4. Step-by-step installation on Windows

### 4.1 Install XAMPP (the database)

1. Go to https://www.apachefriends.org and download **XAMPP for Windows**.
2. Run the installer. On the *Select Components* screen, keep **MySQL** ticked. **phpMyAdmin** is useful too. Apache is only needed for phpMyAdmin.
3. Install to the default folder, `C:\xampp`.
4. If Windows asks whether to allow XAMPP through the firewall, click **Allow** for *Private networks*.

> Already have MySQL 8 or MariaDB installed? You can use it instead of XAMPP. You will need its root (admin) password during setup.

### 4.2 Start MySQL

1. Open **XAMPP Control Panel** from the Start menu.
2. Click **Start** next to **MySQL**. The module name turns green and the port shows as `3306`.

   If MySQL does not start, see [Troubleshooting](#13-troubleshooting) → *MySQL will not start in XAMPP*.

3. *(Optional)* To start MySQL automatically with Windows, click **Config** at the top right of the Control Panel and tick **MySQL** under *Autostart of modules*.

### 4.3 Install Node.js

1. Go to https://nodejs.org and download the **LTS** version (the button marked *LTS*).
2. Run the installer and keep the default options. You do **not** need to tick *Automatically install the necessary tools*.
3. Check the installation. Open **Command Prompt** (press `Win + R`, type `cmd` and press Enter), then run:

   ```bash
   node -v
   ```

   It should print a version such as `v22.x.x`. If it says *'node' is not recognized*, restart the computer and try again.

### 4.4 Put the project on your computer

Copy the whole **`F4`** folder to any location, for example:

- `C:\SecureLearn`, or
- `C:\xampp\htdocs\nginx\F4` (where it was developed).

Avoid folders managed by OneDrive or Dropbox: sync tools can lock files while packages are being installed.

The folder should contain `setup.bat`, `start.bat`, `setup.js`, `SETUP_GUIDE.md`, and the folders `server` and `client`.

### 4.5 Run the setup

1. Make sure MySQL is running (step 4.2).
2. Double-click **`setup.bat`** in the `F4` folder.

   If Windows SmartScreen shows *Windows protected your PC*, click **More info** → **Run anyway**. The file is a plain-text script; you can right-click it and choose *Edit* to read it first.

3. Answer the questions. Press **Enter** to accept the default shown in `[brackets]`:

   | Question | What to enter |
   |---|---|
   | Database host | Enter (uses `127.0.0.1`) |
   | Database port | Enter (uses `3306`) |
   | Database admin user | Enter (uses `root`) |
   | Database admin password | Enter for a fresh XAMPP install (the password is empty); otherwise type your MySQL root password |
   | Web server port | Enter (uses `4000`) |

4. The setup then does the following:

   - **[1/5]** checks Node.js;
   - **[2/5]** downloads the required packages (about 100 MB; this takes a few minutes the first time);
   - **[3/5]** writes `server\.env` with freshly generated secret keys;
   - **[4/5]** creates the database `rbac_elearning`, its stored procedures, a restricted database account (`elearn_app`) and the demo data;
   - **[5/5]** builds the web interface.

5. Wait for **Setup complete.**, then press any key to close the window.

You only need to run the setup once. Running it again is safe: it keeps your existing data and settings.

### 4.6 Start the system

1. Double-click **`start.bat`**. A window opens and shows:

   ```
   SecureLearn is running.
     On this computer:      http://localhost:4000
     On your local network: http://192.168.1.23:4000
   ```

2. **Keep this window open** while you use the system. Closing it stops the server.
3. If Windows Firewall asks about *Node.js JavaScript Runtime*, allow it on **Private networks** if you want phones or other computers to connect (see section 9). Otherwise you can cancel.

Each time you want to use SecureLearn again: start **MySQL** in XAMPP, then double-click **`start.bat`**.

### 4.7 Sign in

Open a browser and go to **http://localhost:4000**. Sign in with any account from [section 7](#7-demo-accounts), for example:

- **Admin:** `admin@nsuk.edu.ng` / `Admin@12345`
- **Lecturer:** `n.ajumobi@nsuk.edu.ng` / `Lecturer@123`
- **Student:** `peace.o@student.nsuk.edu.ng` / `Student@123`

---

## 5. Installation on macOS and Linux

The project includes no `.bat` files for these systems; you run the same steps from a terminal.

### 5.1 Install the database

**Option A: XAMPP** (macOS and Linux). Download it from https://www.apachefriends.org and start MySQL from the XAMPP manager (macOS) or with `sudo /opt/lampp/lampp startmysql` (Linux).

**Option B: a native install.**

- macOS (Homebrew):

  ```bash
  brew install mysql && brew services start mysql
  ```

- Ubuntu / Debian:

  ```bash
  sudo apt update && sudo apt install -y mariadb-server && sudo systemctl enable --now mariadb
  ```

On Ubuntu/Debian, MariaDB's `root` user signs in through the operating system rather than with a password, so the setup cannot use it. Create a separate admin account for the setup:

```bash
sudo mysql -e "CREATE USER 'setup_admin'@'localhost' IDENTIFIED BY 'Choose-A-Strong-Password1'; GRANT ALL PRIVILEGES ON *.* TO 'setup_admin'@'localhost' WITH GRANT OPTION;"
```

At the setup's *Database admin user* and *password* questions, enter `setup_admin` and the password you chose.

### 5.2 Install Node.js

Download the LTS installer from https://nodejs.org. Alternatively, on macOS run `brew install node@22`; on Ubuntu, use the NodeSource instructions on the Node.js website.

### 5.3 Set up and start

```bash
cd /path/to/F4
npm run setup
```

```bash
npm start
```

Open **http://localhost:4000**.

To start SecureLearn again later, start MySQL/MariaDB and run `npm start` in the `F4` folder.

---

## 6. Alternative: import the database with phpMyAdmin

The file **`server/db/rbac_elearning.sql`** contains the complete database (tables, stored procedures, the restricted `elearn_app` account and all demo data) in a single file. Use it if you prefer to work in phpMyAdmin, or if you want to submit the database file with your project.

> ⚠ Importing it **deletes and recreates** the `rbac_elearning` database.

1. In the XAMPP Control Panel, start **Apache** and **MySQL**.
2. Open **http://localhost/phpmyadmin**.
3. Click **Import** in the top menu. Do *not* select a database first.
4. Click **Choose File**, select `F4\server\db\rbac_elearning.sql`, and click **Import** (or **Go**) at the bottom.
5. You should see *Import has been successfully finished*. The `rbac_elearning` database now appears on the left.

Then connect the server to the database, using **either** of these options:

- **Recommended:** run `setup.bat` (or `npm run setup`) as in section 4.5. It finds the existing data, leaves it in place, and sets up everything else automatically.
- **Manual:**
  1. Copy `server\.env.example` to `server\.env`.
  2. Set `DB_PASSWORD=ChangeMe_App_2026!`. This password is written at the top of the SQL file.
  3. Set `JWT_SECRET` to a long random value. You can generate one with:

     ```bash
     node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
     ```

  4. Run `npm install` in both `server` and `client`.
  5. Run `npm run build` in `client`.
  6. Start with `start.bat`.

From the command line, `C:\xampp\mysql\bin\mysql.exe -u root < server\db\rbac_elearning.sql` performs the same import.

---

## 7. Demo accounts

These are **development test values** created from `server/db/seed-data.js`. Change or delete them before real use (section 12).

### Staff

| Name | Username | Password | Role | Courses |
|---|---|---|---|---|
| System Administrator | `admin@nsuk.edu.ng` | `Admin@12345` | Admin | all (management) |
| Fatima Bello (ICT Officer) | `f.bello@nsuk.edu.ng` | `Admin@12345` | Admin | all (management) |
| Dr. N. Ajumobi | `n.ajumobi@nsuk.edu.ng` | `Lecturer@123` | Lecturer | CMP 401, CMP 311 |
| Dr. B. Ajayi | `b.ajayi@nsuk.edu.ng` | `Lecturer@123` | Lecturer | CMP 405 |
| Dr. Aisha Usman | `a.usman@nsuk.edu.ng` | `Lecturer@123` | Lecturer | CMP 307 |
| Mr. Emeka Nwosu | `e.nwosu@nsuk.edu.ng` | `Lecturer@123` | Lecturer | CMP 321 |
| Dr. Tunde Adeyemi | `t.adeyemi@nsuk.edu.ng` | `Lecturer@123` | Lecturer | CMP 499 |
| John Okafor (Graduate Assistant) | `ta.john@nsuk.edu.ng` | `Assist@123` | **Lecturer and Student** | lectures CMP 311, studies CMP 405 |

### Students (password `Student@123` for all)

| Name | Username | Enrolled in |
|---|---|---|
| Peace Ogechi | `peace.o@student.nsuk.edu.ng` | CMP 401, 405, 307, 499 |
| Musa Abdullahi | `musa.a@student.nsuk.edu.ng` | CMP 401, 405, 321, 499 |
| Grace Eze | `grace.e@student.nsuk.edu.ng` | CMP 401, 311, 499 |
| Chinedu Obi | `chinedu.o@student.nsuk.edu.ng` | CMP 401, 307, 499 |
| Aminat Yusuf | `aminat.y@student.nsuk.edu.ng` | CMP 401, 307 |
| Ibrahim Sani | `ibrahim.s@student.nsuk.edu.ng` | CMP 401, 311 |
| Blessing Nnamdi | `blessing.n@student.nsuk.edu.ng` | CMP 401, 307 |
| Halima Mohammed | `halima.m@student.nsuk.edu.ng` | CMP 401, 311 |
| Emmanuel Danjuma | `emmanuel.d@student.nsuk.edu.ng` | CMP 405, 307 |
| Zainab Aliyu | `zainab.a@student.nsuk.edu.ng` | CMP 405, 307 |
| Kelechi Uche | `kelechi.u@student.nsuk.edu.ng` | CMP 405, 321 |
| Ruth Joseph | `ruth.j@student.nsuk.edu.ng` | CMP 405, 321 |
| Yusuf Garba | `yusuf.g@student.nsuk.edu.ng` | CMP 311, 321 |
| Esther Bassey | `esther.b@student.nsuk.edu.ng` | CMP 311, 321 |
| David Peter | `david.p@student.nsuk.edu.ng` | – (**Suspended**: cannot sign in) |

### Courses in the demo

| Course | Lecturer | State of the demo data |
|---|---|---|
| CMP 401 Information Security | Dr. N. Ajumobi | In progress. One closed assignment with 6 submissions and one open assignment. No grades yet. |
| CMP 405 Software Engineering II | Dr. B. Ajayi | Grades recorded and **released**. One open assignment. |
| CMP 311 Database Management Systems | Dr. N. Ajumobi + John Okafor | Grades recorded and **released**. |
| CMP 307 Computer Networks | Dr. Aisha Usman | Grades recorded but **not released**: students cannot see them yet. |
| CMP 321 Operating Systems | Mr. Emeka Nwosu | One open assignment with one submission. |
| CMP 499 Final Year Project | Dr. Tunde Adeyemi | One open assignment (Chapter 4 draft). |

Deadlines are set relative to the moment you ran the setup, so the demo always has some assignments open and some closed. Run `npm run db:reset` (section 10) to refresh them.

---

## 8. Guided demo tour

Use this tour to explore the system, or to demonstrate it at a project defence. Each step names the test case from Chapter 4 that it shows.

### As a student: `peace.o@student.nsuk.edu.ng` / `Student@123`

1. The **Dashboard** shows Peace's courses and the assignments due soon. The menu has no *Users*, *Roles* or *Audit log* items, because a student's role has no permission for them.
2. Open **My courses → CMP 401 → Assignments**. Click **Submit** on the open assignment, type an answer and submit it (**FT-07**).
3. Open **My grades**. CMP 405 shows a released grade. CMP 307 is missing because Dr. Usman has not released its grades yet (**FT-09**).
4. Type **http://localhost:4000/users** into the address bar. You get **Access denied**, and the attempt is recorded (**Fig. 4.5**, **ST-07**).
5. Click **Sign out**.

### As a lecturer: `n.ajumobi@nsuk.edu.ng` / `Lecturer@123`

1. Open **My courses → CMP 401**. Upload a material with **Upload material**; you can attach a PDF (**FT-05**).
2. Under **Assignments**, click **View submissions** on Assignment 1 to read the students' work.
3. Create a new assignment with a deadline (**FT-06**).
4. Open **Grade entry**, choose **CMP 401**, enter scores and click **Save**. Then click **Release grades** (**FT-08**). Sign in as Peace again to see the grade appear.

### As a user with two roles: `ta.john@nsuk.edu.ng` / `Assist@123`

1. After the password, you are asked to choose **Lecturer** or **Student**. The session gets only the role you pick (dynamic separation of duty).
2. As **Lecturer**, you see CMP 311. As **Student**, you see CMP 405.

### As the administrator: `admin@nsuk.edu.ng` / `Admin@12345`

1. The **Dashboard** shows account totals, denied requests and recent security events.
2. **Users** lets you create accounts, assign roles and suspend accounts. Suspending a signed-in user ends their session immediately (**FT-03**, **FT-04**).
3. **Roles & permissions** shows the role-permission matrix (Table 4.4). Untick *Student → assignments → R*, click **Save changes**, and students immediately lose access to assignments. Tick it again to restore access. No code changes are needed.
4. Open **Courses → CMP 311 → People** and try to enrol **John Okafor** as a student. The database refuses because he lectures that course (separation of duty, **ST-10**).
5. **Audit log** shows every allowed and denied request. Filter by *Denied* to see the attempts from the student tour (**FT-10**, **Fig. 4.6**).

### Security demonstrations

| Demonstration | How |
|---|---|
| Account lockout (**ST-09**) | Sign in as any student with a wrong password 5 times. The account is locked for 15 minutes, even for the correct password. An admin can unlock it under **Users → Edit → Unlock account**. |
| Suspended account (**FT-03**) | Try signing in as `david.p@student.nsuk.edu.ng`. |
| Generic error messages (**FT-02**) | A wrong password and an unknown username both show *Invalid username or password*. |
| Session expiry | The badge at the top shows the remaining token lifetime (30 minutes). The token is renewed while you are active. |
| Full automated proof | Run `npm test` (section 10). It runs all of FT-01–FT-11 and ST-01–ST-12. |

---

## 9. Using it from phones and other computers

Other devices on the **same Wi-Fi or LAN** can use the system while your computer runs it:

1. Start the system with `start.bat`. The window shows a line such as `On your local network: http://192.168.1.23:4000`.
2. On the phone or other computer, open that address in the browser.
3. If it does not load:
   - Allow **Node.js** through Windows Firewall on **Private** networks: *Windows Security → Firewall & network protection → Allow an app through firewall → Node.js JavaScript Runtime → tick Private*.
   - Make sure your Wi-Fi is set to a **Private** network in Windows: *Settings → Network & internet → Wi-Fi → (your network) → Private*.
   - Some public or campus Wi-Fi networks block device-to-device traffic. Use a phone hotspot instead.

> Traffic on the local network is plain HTTP. That is fine for demonstrations; for real use, see section 12.

---

## 10. Everyday operation

All commands below are run in a terminal opened in the `F4` folder. In File Explorer, click the address bar, type `cmd` and press Enter.

| Task | Windows | Any system |
|---|---|---|
| Start | double-click `start.bat` | `npm start` |
| Stop | close the server window, or press `Ctrl + C` | `Ctrl + C` |
| Reset to fresh demo data (**deletes all changes**) | `npm run db:reset` | `npm run db:reset` |
| Run the automated tests | `npm test` | `npm test` |
| Rebuild the web interface after editing `client/` | `npm run build` | `npm run build` |
| Regenerate `rbac_elearning.sql` after editing the demo data | `npm run db:export` | `npm run db:export` |

**Running the tests.** `npm test` creates a separate database called `rbac_elearning_test` and leaves your demo data untouched. It needs MySQL running. When it finishes, it should report `Tests: 41 passed, 41 total`.

**Backing up your data.**

```bash
C:\xampp\mysql\bin\mysqldump.exe -u root --routines rbac_elearning > backup.sql
```

Also copy the folder `server\uploads`, which holds uploaded files. In phpMyAdmin you can instead select `rbac_elearning` and use **Export**.

**Restoring a backup.**

```bash
C:\xampp\mysql\bin\mysql.exe -u root rbac_elearning < backup.sql
```

Then put the `server\uploads` folder back.

(On macOS/Linux, use `mysqldump` and `mysql` without the path. Add `-p` if root has a password.)

---

## 11. Configuration reference

The setup writes these settings to **`server/.env`**. Edit the file with Notepad and restart the server for changes to take effect.

| Setting | Default | Meaning |
|---|---|---|
| `PORT` | `4000` | Web port. Change it if 4000 is already in use. |
| `NODE_ENV` | `production` | Leave as is. |
| `DB_HOST`, `DB_PORT` | `127.0.0.1`, `3306` | Where MySQL runs. |
| `DB_NAME` | `rbac_elearning` | Database name. |
| `DB_ROOT_USER`, `DB_ROOT_PASSWORD` | `root`, empty | Admin account used **only** by setup, reset and tests to create the database. |
| `DB_USER`, `DB_PASSWORD` | `elearn_app`, random | Restricted account the server runs as. It cannot write grades or edit the audit log directly. |
| `JWT_SECRET` | random | Key that signs session tokens. Changing it signs everyone out. Never share it. |
| `JWT_EXPIRES_IN` | `30m` | Session token lifetime. |
| `BCRYPT_COST` | `12` | Password-hashing strength. |
| `TLS_CERT`, `TLS_KEY` | empty | Paths to an HTTPS certificate and key, if the server should serve HTTPS itself. |
| `TRUST_PROXY` | `0` | Set to `1` when running behind nginx/Apache/IIS, so the audit log records real client IP addresses. |

---

## 12. Before real use

The demo setup is meant for development, testing and demonstration. Before real students use it:

1. **Remove the demo accounts and data.** Run `npm run db:reset`, sign in as `admin@nsuk.edu.ng`, create your own administrator account, sign in with it, and delete the demo users and courses. Alternatively, edit `server/db/seed-data.js` before running the setup.
2. **Change every demo password**, including the administrator's (*My profile → Change password*).
3. **Set a MySQL root password.** In XAMPP the root password is empty by default. Set one, then update `DB_ROOT_PASSWORD` in `server/.env`.
4. **If you imported `rbac_elearning.sql`, change the `elearn_app` password.** Running the setup (section 4.5) does this automatically.
5. **Use HTTPS.** Put the server behind a reverse proxy with a certificate. With nginx:

   ```nginx
   location / {
       proxy_pass http://127.0.0.1:4000;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       client_max_body_size 12m;
   }
   ```

   Then set `TRUST_PROXY=1` in `server/.env`.

6. **Keep backups** (section 10) and review the **Audit log** regularly.

---

## 13. Troubleshooting

| Problem | Cause and fix |
|---|---|
| Setup says **Cannot reach MySQL/MariaDB** | MySQL is not running. Start it in the XAMPP Control Panel and run the setup again. |
| Setup says **MySQL refused the password** | The root password is wrong. Run `node setup.js --reconfigure` and type the correct password. On Ubuntu, use the `setup_admin` account from section 5.1. |
| **MySQL will not start in XAMPP** (stops right away, or *port 3306 in use*) | Another MySQL service is using port 3306. Stop it in *Services* (`Win + R` → `services.msc` → MySQL → Stop), or change the XAMPP MySQL port in **Config → my.ini** (`port=3307`) and use port `3307` during setup. If the XAMPP log mentions a crash or corruption, see the XAMPP FAQ on recovering the `mysql\data` folder. |
| `'node' is not recognized as an internal or external command` | Node.js is not installed, or the PATH has not been refreshed. Install Node.js LTS and restart the computer. |
| `npm install failed` | You have no internet connection, or a proxy or antivirus is blocking downloads. Check the connection and run the setup again. Behind a proxy, first run `npm config set proxy http://proxy:port`. |
| Start window says **Port 4000 is already in use** | Another program uses that port, or SecureLearn is already running in another window. Close the other window, or set `PORT=4100` in `server/.env` and open http://localhost:4100. |
| Start window says **Cannot use the database** | MySQL is stopped, or the database was deleted. Start MySQL. If the message says to run the setup, run `setup.bat`. |
| The browser shows *The web interface has not been built* | Run `setup.bat` again, or run `npm run build`. |
| Sign-in says **Too many failed attempts** | The account is locked for 15 minutes after 5 wrong passwords. Wait, or ask an admin to use **Users → Edit → Unlock account**. As a last resort, `npm run db:reset` restores the demo data. |
| Sign-in says **Too many login attempts from this address** | More than 30 sign-in attempts in 15 minutes from one device. Wait 15 minutes, or restart the server. |
| Signed out with *Your session has ended* | The 30-minute token expired after inactivity, an admin changed your account, or you signed in again elsewhere after changing your password. Sign in again. |
| Changes in the browser look outdated after an update | Press `Ctrl + F5` to reload without the cache. |
| `npm test` fails with *Access denied* | The tests need the database admin account. Check `DB_ROOT_USER` and `DB_ROOT_PASSWORD` in `server/.env`. |
| Phone cannot open the site | See section 9: firewall, private network setting, or Wi-Fi client isolation. |

Still stuck? Run `npm start` in a terminal (instead of double-clicking `start.bat`) and read the full error message it prints.

---

## 14. Uninstalling

1. Stop the server: close its window.
2. Remove the database:
   - in phpMyAdmin, select `rbac_elearning` → **Operations** → **Drop the database**; or
   - from the command line:

     ```bash
     C:\xampp\mysql\bin\mysql.exe -u root -e "DROP DATABASE rbac_elearning; DROP DATABASE IF EXISTS rbac_elearning_test; DROP USER 'elearn_app'@'localhost', 'elearn_app'@'127.0.0.1', 'elearn_app'@'%';"
     ```

3. Delete the `F4` folder.
4. *(Optional)* Uninstall Node.js and XAMPP from *Settings → Apps*.
