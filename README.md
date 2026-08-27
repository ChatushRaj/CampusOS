<h1 align="center">CampusOS</h1>

<p align="center">
  One board for everything on campus — notices, placements, events, articles, polls,
  a student marketplace, study groups and a people directory.
</p>

<p align="center">
  <img alt="CI" src="https://img.shields.io/github/actions/workflow/status/ChatushRaj/campusos/ci.yml?branch=main&label=CI">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D20-brightgreen">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6">
  <img alt="MySQL" src="https://img.shields.io/badge/MySQL-8-4479A1">
</p>

<p align="center">
  <a href="docs/SETUP.md">Setup guide</a> ·
  <a href="#features">Features</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="CONTRIBUTING.md">Contributing</a> ·
  <a href="SECURITY.md">Security</a>
</p>

<!-- Add screenshots here once deployed: dashboard, feed, notice board, placements. -->

## Quick start

```bash
npm install
mysql -u root -p < server/sql/schema.sql
cp server/.env.example server/.env    # set DATABASE_URL and the two secrets
cp web/.env.example web/.env
npm run seed
npm run dev
```

Open <http://localhost:5173> and sign in as `rahul@campusos.dev`, `faculty@campusos.dev` or
`admin@campusos.dev` — password `CampusOS2025`. Each role sees a different dashboard.

Step-by-step instructions, including Windows and XAMPP, are in **[docs/SETUP.md](docs/SETUP.md)**.

## Overview

Campus information usually lives in a dozen places: a physical noticeboard, four WhatsApp groups,
a placement spreadsheet and a portal nobody can log into. CampusOS replaces that with one board
where every item has an owner, a deadline and a visibility rule that is actually enforced.

Three kinds of people use it:

- **Students** read notices, apply to openings, RSVP to events, publish articles, trade on the
  marketplace and connect with people across departments.
- **Faculty** post notices and openings, organise events, and review applications they receive.
- **Administrators** do all of the above, plus moderate content and read platform analytics.

## Features

**Campus feed** — posts with up to four images, tags, and campus-wide or connections-only
visibility. Likes and bookmarks are optimistic; comments are threaded under each post.

**Notice board** — categorised announcements with a priority level and an expiry date. Expired
notices leave the board automatically. Urgent notices notify every active member.

**Placements** — faculty post openings with type, work mode, skills, stipend range and a deadline.
Students apply in one tap and cannot apply twice; the poster reviews every application in one place.
Closed roles reject applications server-side, not just in the interface.

**Events** — going/interested RSVPs with capacity limits enforced by the API. Switching or
withdrawing an RSVP keeps both counters correct.

**Articles** — long-form writing with automatic reading-time estimation, unique slugs, tags, view
counts and discussion.

**Polls** — two to six options, one vote per person per poll, results hidden until you vote so
early answers do not anchor later ones.

**Marketplace** — student-to-student listings with category, condition, price and photos, plus
available/reserved/sold status.

**People** — a searchable directory filtered by department, year, role or interest. Connection
requests work in both directions; if two people request each other, the second request is treated
as an acceptance rather than a duplicate.

**Study groups** — a directory of member-run groups by category, with join and leave, and a
discussion thread inside each one. Membership gates the discussion: the API refuses to return it to
someone who has not joined, so hiding the button is not what protects it. The owner cannot leave a
group without deleting it, which avoids leaving one ownerless.

**Saved** — one list across posts, articles, openings and listings. Bookmarks whose target was
deleted are dropped rather than rendered as blank rows.

**Dashboards** — three different shapes by role, every figure computed from the database. Admins
get 14-day signup and posting trends plus a departmental breakdown; faculty see applications
received against their own postings; students see their connections, applications and next events.

**Throughout** — global cross-table search (press `/`), notifications, light and dark themes,
keyboard navigation, skeleton loading states, empty states, confirmation dialogs before destructive
actions, and toast feedback.

**Motion** — one easing curve and one entrance animation used consistently: pages fade up on every
navigation, lists stagger their rows in sequence rather than appearing all at once, cards lift on
hover, and buttons depress on press. Overlay motion comes from `tailwindcss-animate` rather than
being redefined. All of it collapses to nothing under `prefers-reduced-motion`, including the
stagger delay — the point is to make state changes legible, not to decorate.

## Technology stack

**Frontend** — React 18, TypeScript, Vite 6, Tailwind CSS, TanStack Query, React Hook Form with Zod,
Radix UI primitives, Recharts, Sonner, React Router 7.

**Backend** — Node.js 20, Express, TypeScript, Drizzle ORM, mysql2, Zod, Argon2, JSON Web Tokens,
Helmet, express-rate-limit, Multer, Pino.

**Database** — MySQL 8 (MariaDB 10.6+ also works). Thirty-five InnoDB tables, fifty-three foreign
keys, twelve `CHECK` constraints. The schema is hand-written SQL in `server/sql/schema.sql`, mirrored as a
typed Drizzle schema in `server/src/db/schema.ts` — so queries are type-checked at compile time
while the file you hand to a reviewer is still plain, readable SQL.

## Architecture

```
campusos/
├── server/                        Express + TypeScript API
│   └── src/
│       ├── config/                Environment parsing, logger
│       ├── db/                    Drizzle schema, connection pool, query helpers
│       ├── middleware/            Auth, RBAC, validation, uploads, errors, rate limits
│       ├── modules/               One folder per domain: routes + controller + schema
│       ├── services/              Cross-domain logic (engagement, notifications)
│       ├── utils/                 Errors, pagination, tokens, media URLs
│       ├── seed.ts                Development dataset
│   └── sql/schema.sql             The database, as runnable SQL
│
└── web/                           React + TypeScript client
    └── src/
        ├── components/ui/         Design-system primitives
        ├── components/layout/     Shell, navigation, guards, search
        ├── components/cards/      One card component per content type
        ├── context/               Authentication state
        ├── hooks/                 Debounce, theme, document title
        ├── lib/                   API client, formatters, query client
        ├── pages/                 Route components
        └── types/                 Shared API contracts
```

**Request flow.** A route attaches `requireAuth`, then a role guard where relevant, then `validate`
with a Zod schema that replaces `req.body`/`req.query` with parsed, stripped data. Controllers
receive typed input, check ownership, and return a mapped shape. Every thrown value passes through
one error handler that converts MySQL driver, Multer, Zod and application errors into a consistent
envelope: `{ error: { code, message, details? } }`. Stack traces never reach the client.

**Authentication.** Passwords are hashed with Argon2id. Sign-in returns a short-lived access token
held **in memory only** — never in `localStorage`, where any injected script could read it — plus a
long-lived refresh token in an `httpOnly`, `sameSite` cookie scoped to `/api/auth`. The API client
catches a 401, refreshes once, and replays the original request; parallel 401s collapse into a
single refresh call. Changing a password increments `tokenVersion`, which retires every refresh
token issued before it.

**Engagement model.** Likes, bookmarks and comments each get **one table per parent** —
`post_likes`, `blog_likes`, `listing_likes`, and so on — rather than a single polymorphic table
keyed by `(target_type, target_id)`.

The polymorphic version looks tidier and is a trap: a `target_id` that points at four different
tables cannot carry a foreign key, so nothing stops a like from outliving the post it belongs to.
One table per parent makes `ON DELETE CASCADE` real, and a composite primary key of
`(user_id, post_id)` turns "one like per person per item" into something the database enforces
rather than something the application remembers to check.

The cost is that the unified bookmarks page has to read four tables. It does so as a `UNION` of four
small indexed queries carrying only `(type, id, saved_at)`, so the page is decided before a single
content row is read.

**Counters and transactions.** `like_count`, `comment_count` and the poll and RSVP tallies are
denormalised onto their parent row, which keeps the feed to a fixed number of queries instead of an
aggregate per item. Every write that changes a counter runs in the same transaction as the row it
counts, so the two cannot drift apart.

**Money.** Prices and stipends are `DECIMAL`, never `FLOAT`. A test in the suite fails the build if a
floating-point column is ever introduced.

## Installation

**Prerequisites:** Node.js 20 or newer, and MySQL 8 or newer running locally (MariaDB 10.6+ works
too, and so does the MySQL bundled with XAMPP or WAMP).

```bash
git clone <your-repository-url> campusos
cd campusos
npm install          # installs both workspaces
```

## Configuration

Copy each package's example file and fill in real values. Neither `.env` is committed.

```bash
cp server/.env.example server/.env
cp web/.env.example web/.env
```

Generate the two signing secrets — do not reuse one for both:

```bash
openssl rand -base64 48    # run twice
```

### Environment variables

**`server/.env`**

| Variable             | Required | Description                                                                        |
| -------------------- | -------- | ---------------------------------------------------------------------------------- |
| `NODE_ENV`           | no       | `development`, `test` or `production`. Defaults to `development`.                  |
| `PORT`               | no       | API port. Defaults to `4000`.                                                      |
| `DATABASE_URL`       | **yes**  | MySQL connection string, e.g. `mysql://campusos:password@127.0.0.1:3306/campusos`. |
| `DB_POOL_SIZE`       | no       | Maximum pooled connections. Defaults to `10`.                                      |
| `CORS_ORIGIN`        | no       | Comma-separated allowed origins. Defaults to `http://localhost:5173`.              |
| `JWT_ACCESS_SECRET`  | **yes**  | Signs access tokens. At least 24 characters.                                       |
| `JWT_REFRESH_SECRET` | **yes**  | Signs refresh tokens. Must differ from the access secret.                          |
| `JWT_ACCESS_TTL`     | no       | Access token lifetime. Defaults to `15m`.                                          |
| `JWT_REFRESH_TTL`    | no       | Refresh token lifetime. Defaults to `30d`.                                         |
| `STAFF_INVITE_CODE`  | **yes**  | Required to register a faculty or admin account.                                   |
| `UPLOAD_DIR`         | no       | Upload directory. Defaults to `uploads`.                                           |
| `MAX_UPLOAD_MB`      | no       | Per-file size ceiling. Defaults to `5`.                                            |
| `PUBLIC_URL`         | no       | Base URL used to build absolute media links.                                       |

**`web/.env`**

| Variable       | Required | Description                                                     |
| -------------- | -------- | --------------------------------------------------------------- |
| `VITE_API_URL` | no       | API base URL. Leave blank in development to use the Vite proxy. |

The server validates its environment at boot and refuses to start with a clear message if anything
is missing or too short. A half-configured server is worse than one that will not start.

## Database setup

The whole schema lives in one readable file: **`server/sql/schema.sql`**. It creates the database if
it does not exist, so this is the only command you need:

```bash
mysql -u root -p < server/sql/schema.sql
```

If you prefer a GUI, open that file in MySQL Workbench or paste it into the phpMyAdmin SQL tab — it
is ordinary SQL with no ORM-specific syntax.

Creating a dedicated user rather than connecting as `root` is a good habit:

```sql
CREATE USER 'campusos'@'localhost' IDENTIFIED BY 'a-strong-password';
GRANT ALL PRIVILEGES ON campusos.* TO 'campusos'@'localhost';
FLUSH PRIVILEGES;
```

Then point `DATABASE_URL` at it and load the sample dataset:

```bash
npm run seed
```

This truncates every table and creates six accounts, four posts, three articles, four notices, four
events, three openings, four listings and two polls. It refuses to run when `NODE_ENV` is
`production`.

**Sign in with any of these, password `CampusOS2025`:**

| Email                  | Role    |
| ---------------------- | ------- |
| `admin@campusos.dev`   | Admin   |
| `faculty@campusos.dev` | Faculty |
| `rahul@campusos.dev`   | Student |

### What the schema enforces

Rules that must hold no matter what the application does are constraints, not `if` statements:

| Rule                                                 | Mechanism                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| One account per email address                        | `UNIQUE KEY users_email_unique`                             |
| One like, bookmark or RSVP per person per item       | Composite `PRIMARY KEY (user_id, post_id)` and friends      |
| One application per person per opening               | `UNIQUE KEY job_applications_unique (job_id, applicant_id)` |
| One vote per person per poll                         | `PRIMARY KEY (poll_id, user_id)`                            |
| Nobody connects with themselves                      | `CHECK (requester_id <> recipient_id)`                      |
| An event cannot end before it starts                 | `CHECK (ends_at IS NULL OR ends_at >= starts_at)`           |
| Prices are never negative                            | `CHECK (price >= 0)`                                        |
| A maximum stipend is never below the minimum         | `CHECK (stipend_max >= stipend_min)`                        |
| Deleting a user removes their content and engagement | `ON DELETE CASCADE` on every child table                    |
| Notification history survives account deletion       | `ON DELETE SET NULL` on `notifications.actor_id`            |

## Running the application

```bash
npm run dev          # API on :4000 and client on :5173, together
```

Or separately:

```bash
npm run dev -w server
npm run dev -w web
```

Other scripts:

```bash
npm run build        # compile the API and bundle the client
npm run start        # run the compiled API
npm run test         # run the API test suite
npm run typecheck    # typecheck both workspaces
npm run lint         # lint the client
```

## Tests

```bash
npm test
```

96 tests run on Node's built-in test runner, with no additional test dependency. They cover four
areas and need no database:

- **Validation** — the password policy, input normalisation, length limits, tag handling, and that
  unknown keys are stripped so a client cannot set server-owned fields such as `likeCount`.
- **Logic** — regular-expression escaping on search input, pagination clamping, slug generation,
  reading-time estimation, and token signing including rejection of a tampered signature and of an
  access token presented as a refresh token.
- **HTTP** — routing, anonymous rejection on every protected route, field-level validation errors,
  security headers, and that the liveness probe is deliberately exempt from rate limiting.
- **Schemas** — that every model registers, no index is declared twice, the password hash is
  unselectable by default, and each uniqueness rule is backed by a database index.

Tests that exercise controller bodies against a real database are listed under future improvements.

## API reference

All routes are prefixed with `/api`. Every route except `/api/health` and the auth endpoints
requires an `Authorization: Bearer <accessToken>` header.

### Authentication

| Method | Route                   | Access | Description                                                      |
| ------ | ----------------------- | ------ | ---------------------------------------------------------------- |
| `POST` | `/auth/register`        | public | Create an account. Faculty and admin roles require `inviteCode`. |
| `POST` | `/auth/login`           | public | Sign in; sets the refresh cookie.                                |
| `POST` | `/auth/refresh`         | cookie | Exchange the refresh cookie for a new access token.              |
| `POST` | `/auth/logout`          | public | Clear the refresh cookie.                                        |
| `GET`  | `/auth/me`              | any    | The signed-in user.                                              |
| `POST` | `/auth/change-password` | any    | Change password; signs out other devices.                        |

### Content

| Method                 | Route                           | Access                 | Description                                               |
| ---------------------- | ------------------------------- | ---------------------- | --------------------------------------------------------- |
| `GET` `POST`           | `/posts`                        | any                    | List (filter by `scope`, `tag`, `author`, `q`) or create. |
| `GET` `PATCH` `DELETE` | `/posts/:id`                    | any / owner            | Read, edit or delete a post.                              |
| `POST`                 | `/posts/:id/like` · `/bookmark` | any                    | Toggle.                                                   |
| `GET` `POST`           | `/posts/:id/comments`           | any                    | List or add.                                              |
| `GET` `POST`           | `/blogs`                        | any                    | List (`q`, `tag`, `sort`) or publish an article.          |
| `GET` `PATCH` `DELETE` | `/blogs/:id`                    | any / owner            | Read, edit or delete.                                     |
| `GET` `POST`           | `/notices`                      | any / **staff**        | List (`q`, `category`, `priority`) or post.               |
| `PATCH` `DELETE`       | `/notices/:id`                  | **staff**, owner       | Edit or remove.                                           |
| `GET` `POST`           | `/events`                       | any / **staff**        | List (`when`, `category`, `q`) or create.                 |
| `POST`                 | `/events/:id/rsvp`              | any                    | Set, switch or withdraw an RSVP.                          |
| `GET` `POST`           | `/jobs`                         | any / **staff**        | List (`q`, `type`, `mode`, `skill`, `sort`) or post.      |
| `GET` `PATCH` `DELETE` | `/jobs/:id`                     | any / **staff**, owner | Read, edit or delete an opening.                          |
| `POST`                 | `/jobs/:id/apply`               | any                    | Apply once.                                               |
| `GET`                  | `/jobs/:id/applications`        | **staff**, owner       | Review applications.                                      |
| `GET` `POST`           | `/marketplace`                  | any                    | List (`q`, `category`, `maxPrice`, `sort`) or create.     |
| `GET` `PATCH` `DELETE` | `/marketplace/:id`              | any / owner            | Read, update status or remove a listing.                  |
| `GET` `POST`           | `/polls`                        | any                    | List or create; `POST /polls/:id/vote` to vote.           |

### People and platform

| Method       | Route                                    | Access          | Description                                                 |
| ------------ | ---------------------------------------- | --------------- | ----------------------------------------------------------- |
| `GET`        | `/users`                                 | any             | Directory with `q`, `department`, `graduationYear`, `role`. |
| `GET`        | `/users/suggestions`                     | any             | People in your department or year you are not connected to. |
| `GET`        | `/users/:id`                             | any             | Profile with stats and relationship.                        |
| `PATCH`      | `/users/me` · `/me/avatar`               | any             | Update profile or photo.                                    |
| `GET`        | `/connections` · `/connections/requests` | any             | Accepted connections; pending requests.                     |
| `POST`       | `/connections/:id/request` · `/accept`   | any             | Send or accept.                                             |
| `DELETE`     | `/connections/:id`                       | involved        | Decline, withdraw or disconnect.                            |
| `GET`        | `/notifications`                         | any             | Paginated, with `unreadCount`.                              |
| `GET`        | `/bookmarks`                             | any             | Unified saved list, filter by `type`.                       |
| `GET`        | `/search?q=`                             | any             | Cross-collection search.                                    |
| `GET`        | `/dashboard`                             | any             | Role-shaped statistics.                                     |
| `POST` `GET` | `/feedback`                              | any / **admin** | Submit a report; admins triage.                             |
| `GET`        | `/health`                                | public          | Liveness probe.                                             |

Responses use conventional status codes: `200`/`201` on success, `204` on delete, `400` validation,
`401` unauthenticated, `403` wrong role or not the owner, `404` missing, `409` duplicate, `413`
file too large, `429` rate limited.

## Security

- Argon2id password hashing with a 19 MB memory cost; the hash is never selectable by default, so a
  stray `find()` cannot leak it.
- Access tokens in memory, refresh tokens in `httpOnly` cookies scoped to `/api/auth`.
- Role checks on the server for every privileged route, plus per-record ownership checks. Hiding a
  button is not authorisation.
- Every input parsed by Zod; parsed output replaces the raw request so handlers never see unvalidated data.
- User input escaped before use in a `RegExp`, preventing regular-expression injection through search.
- Rate limits: 10 attempts per 15 minutes on credentials, 30 writes per minute, 600 requests per 15 minutes overall.
- Uploads restricted by MIME type, size and count. Filenames are generated, never taken from the
  client, and deletion refuses to unlink anything outside the upload root.
- Helmet headers, an explicit CORS allowlist, a 1 MB body cap, and logger redaction of
  `authorization`, `cookie` and any `password` field.
- Identical responses for unknown email and wrong password, so sign-in cannot enumerate accounts.
- No secrets in source. `.env` is git-ignored; `.env.example` documents every variable.
- Dependencies audit clean in both workspaces at the time of writing.

## Accessibility

Semantic landmarks and a skip link; every control labelled and wired to its error message through
`aria-describedby`; visible focus rings on a single shared style; `aria-pressed` on toggles and
`role="alert"` on error summaries; full keyboard operation with Escape closing overlays and `/`
focusing search; and `prefers-reduced-motion` honoured globally rather than per component.

## Performance

Route-level code splitting keeps the 393 kB chart bundle off every route except the dashboard.
Denormalised counters make the feed a single query instead of an aggregation per row. A batch
lookup resolves the viewer's likes and bookmarks for a whole page in two queries rather than 2N.
Compound indexes back every list query and sort. Pagination limits are clamped server-side, search
input is debounced, images are lazily decoded, and static uploads are served immutable with a
seven-day cache.

## Known gaps

Deliberate, and listed rather than hidden:

- **Editing existing notices, events, openings and articles.** The API supports it
  (`PATCH /api/notices/:id` and siblings, with ownership checks and tests); the interface currently
  offers create and delete for those types, and edit only for posts, listings and your own profile.
  Wiring the remaining four is a form each, not new backend work.
- **Uploads are stored on local disk.** Fine for a single server; a deployment behind a load balancer
  would need object storage.
- **Search uses `LIKE`.** Correct and injection-safe, but it will not scale to hundreds of thousands
  of rows. MySQL full-text indexes are the next step.

## Future improvements

- WebSocket delivery for notifications, replacing the 60-second poll.
- Direct messaging between connected members.
- Résumé upload and structured application tracking for placements.
- Calendar export (`.ics`) for events you are attending.
- Controller-level integration tests against a throwaway database, and end-to-end coverage of the critical flows.
- Server-rendered public article pages for search-engine visibility.
- Audit logging for administrative actions.

## Author

**Chatush Raj** — design, architecture and implementation.

## License

Released under the MIT License. See [LICENSE](LICENSE).
