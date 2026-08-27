# Setup guide

Everything needed to run CampusOS locally in VS Code, in order.

If you are looking for a `requirements.txt`, there isn't one — that is a Python convention. In a
Node project the dependency list lives in `package.json`, and `npm install` reads it. The exact
versions are pinned in `package-lock.json`, which is committed, so everyone installs the same tree.

---

## 1. What you need installed

| Requirement | Version     | Check with        | Where to get it                          |
| ----------- | ----------- | ----------------- | ---------------------------------------- |
| Node.js     | 20 or newer | `node --version`  | <https://nodejs.org> (LTS build)         |
| npm         | 10 or newer | `npm --version`   | Comes with Node.js                       |
| MySQL       | 8 or newer  | `mysql --version` | <https://dev.mysql.com/downloads/mysql/> |
| Git         | any recent  | `git --version`   | <https://git-scm.com>                    |

**MariaDB 10.6+ works instead of MySQL.** So does the MySQL bundled with XAMPP or WAMP — start
MySQL from the control panel and skip to step 3.

If `mysql` is not recognised on Windows, its `bin` folder is not on your PATH. Either add it, or use
MySQL Workbench for the schema step instead of the command line.

---

## 2. Get the code

```bash
git clone <your-repository-url> campusos
cd campusos
code .
```

When VS Code opens, accept the **"Install recommended extensions"** prompt. The list is in
`.vscode/extensions.json` — ESLint, Prettier, Tailwind IntelliSense and a MySQL client.

---

## 3. Install dependencies

One command from the project root. It installs both workspaces — you do not need to `cd` into
`server` or `web` separately.

```bash
npm install
```

Expect this to take a minute or two and create a `node_modules` folder. That folder is
git-ignored and must never be committed.

---

## 4. Create the database

The entire schema is one file. Run it once:

```bash
mysql -u root -p < server/sql/schema.sql
```

It creates the `campusos` database itself, so you do not need to create it first.

**Prefer a GUI?** Open `server/sql/schema.sql` in MySQL Workbench and run it, or paste it into the
phpMyAdmin SQL tab. It is ordinary SQL with no ORM-specific syntax.

Connecting as `root` is fine for local work, but a dedicated user is a better habit:

```sql
CREATE USER 'campusos'@'localhost' IDENTIFIED BY 'a-strong-password';
GRANT ALL PRIVILEGES ON campusos.* TO 'campusos'@'localhost';
FLUSH PRIVILEGES;
```

---

## 5. Configure the environment

Copy both example files. Neither `.env` is committed — that is deliberate.

```bash
cp server/.env.example server/.env
cp web/.env.example web/.env
```

On Windows PowerShell:

```powershell
Copy-Item server\.env.example server\.env
Copy-Item web\.env.example web\.env
```

Open `server/.env` and set three values:

**`DATABASE_URL`** — your MySQL connection string:

```
DATABASE_URL=mysql://campusos:a-strong-password@127.0.0.1:3306/campusos
```

If your password contains `@`, `:`, `/` or `#`, percent-encode it (`@` becomes `%40`).

**The two signing secrets** — generate them, do not invent them, and never reuse one for both:

```bash
openssl rand -base64 48    # run twice, paste one into each
```

No `openssl` on Windows? Use Node, which you already have:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

**`STAFF_INVITE_CODE`** — any private string. It gates faculty and admin registration.

The server validates all of this at boot and refuses to start with a clear message if something is
missing or too short. A half-configured server is worse than one that will not start.

---

## 6. Load the sample data

```bash
npm run seed
```

This truncates every table and creates six accounts, four posts, three articles, four notices, four
events, three openings, four listings, two polls and three study groups. It refuses to run when
`NODE_ENV=production`.

---

## 7. Run it

```bash
npm run dev
```

Two processes start together: the API on <http://localhost:4000> and the client on
<http://localhost:5173>. Open the second one.

Sign in with any of these — the password is `CampusOS2025`:

| Email                  | Role    | What you'll see                                      |
| ---------------------- | ------- | ---------------------------------------------------- |
| `rahul@campusos.dev`   | Student | Feed, connections, applications, saved items         |
| `faculty@campusos.dev` | Faculty | Post notices, events and openings; review applicants |
| `admin@campusos.dev`   | Admin   | Platform trends, department breakdown, report queue  |

Each role gets a different dashboard, so it is worth signing in as all three.

---

## 8. Before you commit anything

```bash
npm run verify
```

That runs typecheck, lint, tests and both builds. The same command runs in CI on every push, so if
it passes locally it will pass there.

---

## Every command

| Command             | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `npm run dev`       | API and client together, both with hot reload         |
| `npm run build`     | Production build of both workspaces                   |
| `npm start`         | Run the built API                                     |
| `npm run seed`      | Reset the database to the sample dataset              |
| `npm run verify`    | Typecheck, lint, test and build — the pre-commit gate |
| `npm run typecheck` | TypeScript only                                       |
| `npm run lint`      | ESLint only                                           |
| `npm test`          | Tests only                                            |

---

## When something goes wrong

**`Invalid environment configuration`** — the server is telling you exactly which variable is
missing or too short. Fix that line in `server/.env`.

**`ER_ACCESS_DENIED_ERROR` or `ECONNREFUSED 127.0.0.1:3306`** — MySQL is not running, or the
credentials in `DATABASE_URL` are wrong. Confirm with `mysql -u root -p` before debugging the app.

**`Unknown database 'campusos'`** — step 4 did not run. Apply `server/sql/schema.sql`.

**`EADDRINUSE`** — something already holds port 4000 or 5173. Change `PORT` in `server/.env`, or
stop the other process.

**Red squiggles in VS Code that `npm run typecheck` does not report** — VS Code is using its own
bundled TypeScript. Open any `.ts` file, press `Ctrl+Shift+P`, run **TypeScript: Select TypeScript
Version**, and choose **Use Workspace Version**.

**Tailwind classes not autocompleting** — install the Tailwind CSS IntelliSense extension and
reload the window.
