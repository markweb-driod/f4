# Deploying SecureLearn to Vercel

This guide puts SecureLearn on the public internet using **Vercel** (free tier) for the
web server and **Aiven** (free tier) for the MySQL database. Vercel cannot run MySQL
itself and does not keep files written to disk, so the database is hosted separately
and uploaded files are stored as data inside it (`FILE_STORAGE=database`), with each
file limited to about 4 MB.

If you only want to run SecureLearn on your own computer, use **setup.bat** /
`npm run setup` instead — see [SETUP_GUIDE.md](SETUP_GUIDE.md). You do not need this
guide for that.

Allow about 20 minutes.

---

## Contents

1. [What gets created](#1-what-gets-created)
2. [Create the Aiven MySQL database](#2-create-the-aiven-mysql-database)
3. [Prepare the database](#3-prepare-the-database)
4. [Import the project into Vercel](#4-import-the-project-into-vercel)
5. [Add the environment variables](#5-add-the-environment-variables)
6. [Deploy and sign in](#6-deploy-and-sign-in)
7. [Updating the live site](#7-updating-the-live-site)
8. [Limits of the free tiers](#8-limits-of-the-free-tiers)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. What gets created

| Service | Free tier | Holds |
|---|---|---|
| **Aiven** | 1 MySQL service, 30-day trial (see §8) | Users, courses, grades, audit log, and — since this deployment uses database file storage — uploaded materials and submissions |
| **Vercel** | Hobby plan | The web pages and the API (as a serverless function) |

Nothing is stored on Vercel's own disk between requests, so the database holds
everything that must persist.

---

## 2. Create the Aiven MySQL database

1. Go to https://aiven.io and sign up (GitHub or Google sign-in is fastest).
2. Click **Create service**.
3. Choose **MySQL**.
4. Pick any cloud and region close to you.
5. Choose the **Free** plan.
6. Name it, e.g. `securelearn-db`, and click **Create service**.
7. Wait for the service's status to turn **Running** (1–3 minutes).
8. Open the service and go to its **Overview** tab. Note down:
   - **Host**
   - **Port**
   - **User** (`avnadmin`)
   - **Password** (click the eye icon to reveal it)
9. On the same page, find **CA certificate** and click **Download**. Save the file as
   `ca.pem` directly inside your `F4` project folder.

> Aiven's free trial lasts 30 days (§8 explains what to do afterwards).

---

## 3. Prepare the database

From the `F4` folder on your computer, with Node.js installed (see
[SETUP_GUIDE.md §4.3](SETUP_GUIDE.md#43-install-nodejs) if you don't have it yet):

```bash
npm run vercel:setup
```

Answer the questions using the values from step 2.8 above. The default for the CA
certificate path is `ca.pem`, matching step 2.9.

This:

- connects to Aiven and creates the database, its stored procedures, a **restricted**
  database account (`elearn_app`) and the demo data — the same data described in
  [SETUP_GUIDE.md §7](SETUP_GUIDE.md#7-demo-accounts);
- saves the Aiven admin details to `server/.env.vercel` (git-ignored — never commit it);
- writes **`vercel-env.txt`** in the `F4` folder with the settings Vercel needs. This
  file holds only the restricted `elearn_app` account, a freshly generated JWT secret,
  and the database's CA certificate — never the Aiven admin password. It is also
  git-ignored.

Keep `vercel-env.txt` open; you'll paste it into Vercel in step 5.

To redo this later with fresh demo data (**this deletes everything in the hosted
database**):

```bash
npm run vercel:setup -- --reset
```

---

## 4. Import the project into Vercel

1. Make sure your code is pushed to GitHub (see your repository, e.g.
   `github.com/<you>/f4`). `vercel-env.txt`, `server/.env.vercel` and `ca.pem` are
   git-ignored, so they are **not** pushed — that's intended, since they hold secrets.
2. Go to https://vercel.com and sign up/sign in (**Continue with GitHub** is simplest —
   it also grants Vercel access to import your repository).
3. Click **Add New...** → **Project**.
4. Find your repository in the list and click **Import**.
5. Vercel reads `vercel.json` from the repository and fills in the build settings
   automatically. You don't need to change **Framework Preset**, **Build Command**,
   **Output Directory** or **Install Command**.
6. **Do not click Deploy yet** — add the environment variables first (next section).

---

## 5. Add the environment variables

Still on the import screen (or afterwards under **Settings → Environment Variables**):

1. Open `vercel-env.txt` from the `F4` folder on your computer.
2. Click into the **Key** field of the first environment-variable row.
3. **Paste the entire contents of the file** in one go. Vercel recognises the
   `KEY=value` lines and splits them into separate rows automatically.
4. Check that these rows now exist: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`,
   `DB_PASSWORD`, one of `DB_SSL_CA` or `DB_SSL`, `JWT_SECRET`, `JWT_EXPIRES_IN`,
   `BCRYPT_COST`, `NODE_ENV`.
5. Leave **Environment** set to all of *Production, Preview, Development* (the
   default) unless you plan to use a separate database for previews.

If you ever need to add a variable by hand instead, add it as one `KEY` / `VALUE` pair
per row — the paste trick above is just a shortcut for doing that many times at once.

---

## 6. Deploy and sign in

1. Click **Deploy**.
2. Vercel installs the packages, builds the React client, and publishes the API as a
   serverless function. This takes 1–3 minutes.
3. When it finishes, click **Visit** (or open the `*.vercel.app` URL Vercel shows).
4. Sign in with a demo account, for example:
   - Admin: `admin@nsuk.edu.ng` / `Admin@12345`
   - Student: `peace.o@student.nsuk.edu.ng` / `Student@123`

   The full list is in [SETUP_GUIDE.md §7](SETUP_GUIDE.md#7-demo-accounts).

Your site is now live at the `*.vercel.app` address (and at any custom domain you add
under **Settings → Domains**).

---

## 7. Updating the live site

Vercel redeploys automatically on every `git push` to your repository's main branch.
From the `F4` folder:

```bash
git add -A
git commit -m "Describe the change"
git push
```

Open the **Deployments** tab in Vercel to watch the build and see the live log if
anything fails.

To change a setting (for example `JWT_EXPIRES_IN`), edit it under **Settings →
Environment Variables**, then redeploy from the **Deployments** tab (⋯ → Redeploy) —
environment variable changes don't take effect on their own.

---

## 8. Limits of the free tiers

| Limit | Why | What it means here |
|---|---|---|
| Uploads capped at **4 MB** | Vercel's serverless functions cap request bodies at ~4.5 MB | Materials/submissions over 4 MB are refused with a clear message; raise `MAX_UPLOAD_MB` only if you move to a paid Vercel plan with a larger limit |
| Functions **sleep between requests** | Serverless: no server process keeps running | The first request after a quiet period takes 1–2 seconds longer (cold start); normal afterwards |
| Aiven free trial is **30 days** | Aiven's free tier is trial-based | Before it ends, either add billing in Aiven, or export your data (`mysqldump`) and move to another free MySQL host (e.g. PlanetScale, Railway) and re-run `npm run vercel:setup --reconfigure` with the new details |
| Each serverless invocation opens its **own small connection pool** | No shared server process | Normal for demo/low traffic; a very busy real deployment would need a connection-pooling proxy (e.g. PlanetScale handles this itself) |

---

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| `npm run vercel:setup` says it cannot reach the database | Check the Aiven service status is **Running**, and that host/port/password match the Overview tab exactly. Try again a minute after creating the service. |
| It says the CA certificate is not found | Re-download it from Aiven (**CA certificate → Download**) and save it as `ca.pem` in the `F4` folder, or pass `--ca=path\to\ca.pem`. |
| Vercel build fails on **Install dependencies** | Open the build log in the **Deployments** tab. Usually a missing environment variable or a typo pasted into `vercel-env.txt`'s values. |
| The site loads but sign-in fails with a database error | Double-check every row from `vercel-env.txt` was pasted into Vercel's environment variables, then **Redeploy**. |
| Uploads fail with "File is larger than 4 MB" | Expected on Vercel's free plan (see §8). Use a smaller file, or move to a paid plan and raise `MAX_UPLOAD_MB`. |
| Aiven trial expired / service suspended | See the Aiven row in §8. Back up first: `mysqldump --routines -h <host> -P <port> -u avnadmin -p rbac_elearning > backup.sql` (needs a MySQL client and the CA certificate; see Aiven's docs for the exact `mysql`/`mysqldump` SSL flags). |
| You want to go back to running it locally only | Nothing changes there: `npm start` on your own computer still uses `server/.env` (not `.env.vercel`) and your local MySQL/MariaDB. |

Still stuck? Vercel's **Deployments → (your deployment) → Functions** tab shows the
server's own console output, which usually names the real problem.
