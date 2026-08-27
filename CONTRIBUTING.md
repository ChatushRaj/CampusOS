# Contributing

Thanks for taking a look at CampusOS.

## Getting set up

You need Node.js 20 or newer and MySQL 8 or newer (MariaDB 10.6+ works too).

```bash
npm install
mysql -u root -p < server/sql/schema.sql
cp server/.env.example server/.env      # fill in DATABASE_URL and the two secrets
cp web/.env.example web/.env
npm run seed
npm run dev
```

The API runs on port 4000 and the client on 5173.

## Before you open a pull request

Everything below has to pass. There is one command for it:

```bash
npm run verify
```

That runs, in order:

| Step                | What it checks                         |
| ------------------- | -------------------------------------- |
| `npm run typecheck` | Both workspaces compile under `strict` |
| `npm run lint`      | ESLint, zero warnings allowed          |
| `npm test`          | Unit, validation and schema tests      |
| `npm run build`     | Both workspaces produce a bundle       |

## How the codebase is organised

- `server/src/modules/<domain>/` — one folder per domain: routes, controller, Zod schemas.
- `server/src/db/` — the Drizzle schema and query helpers. `server/sql/schema.sql` is the
  source of truth for the database and must stay in step; a test fails the build if it drifts.
- `web/src/components/cards/` — one card component per content type.
- `web/src/pages/` — one component per route.

## Conventions worth knowing

- **Validation is Zod at the route boundary.** `validate({ body, query, params })` replaces the
  request data with parsed, stripped values, so controllers receive typed input.
- **Authorisation is server-side, always.** Hiding a button is presentation. The route decides.
- **Rules that must always hold are database constraints,** not `if` statements. If you add one,
  add it to `schema.sql` and to `server/src/db/schema.ts`.
- **Counters move inside the transaction that changes the rows they count.**
- **Money is `DECIMAL`.** A test fails the build if a `FLOAT` column appears.
- Comments explain _why_, not _what_. If the code needs a comment to say what it does, rename
  something instead.

## Commit messages

Present tense, describing the effect: `add capacity check to event RSVP`, not `fixed stuff`.
