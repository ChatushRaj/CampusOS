# Security policy

## Reporting a vulnerability

If you find a security issue in CampusOS, please report it privately rather than opening a public
issue. Use GitHub's **Report a vulnerability** button under the Security tab, or contact the
maintainer directly.

Please include what you found, the steps to reproduce it, and what an attacker could do with it.
You will get an acknowledgement within a few days.

Do not test against a live deployment holding real student data. Run the project locally with the
seed dataset instead.

## Supported versions

This is a portfolio and coursework project. Fixes land on `main`; there are no maintained release
branches.

## What the project already does

These are deliberate decisions, not accidents, and are worth knowing before reporting:

| Area               | Measure                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| Passwords          | Argon2id with a 19 MB memory cost, never a plain or fast hash                                     |
| Access tokens      | Short-lived, held in memory only — never in `localStorage`, where injected script could read them |
| Refresh tokens     | `httpOnly`, `sameSite` cookie scoped to `/api/auth`                                               |
| Session revocation | Changing a password increments `token_version`, retiring every refresh token issued before it     |
| Login responses    | Identical for an unknown email and a wrong password, so the endpoint cannot enumerate accounts    |
| Authorisation      | Enforced server-side on every route; the UI hiding a button is presentation, never protection     |
| SQL                | All values are bound parameters; `LIKE` wildcards are escaped so a search term stays literal      |
| Uploads            | Extension and MIME allowlist, size ceiling, randomised filenames, stored outside the web root     |
| Errors             | Stack traces and SQL text never reach the client                                                  |
| Headers            | Helmet, plus a rate limiter on authentication and write routes                                    |
| Secrets            | Never committed. `.env.example` documents every variable; `.env` is git-ignored                   |

## Known limitations

- Uploads are written to local disk, so a multi-server deployment would need object storage.
- There is no email verification on registration; staff accounts are gated by a shared invite code.
- Rate limiting is per-process and in-memory, which is not sufficient behind several instances.
