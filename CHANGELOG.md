# Changelog

Notable changes to CampusOS. Format based on [Keep a Changelog](https://keepachangelog.com/).

## [1.0.0] — 2026

First complete release.

### Added

- **Campus feed** — posts with up to four images, tags, and campus-wide or connections-only
  visibility; likes, bookmarks, comments and editing.
- **Notice board** — categorised announcements with priority, expiry and pinning. Urgent notices
  notify every active member.
- **Placements** — openings with type, work mode, skills, stipend range and deadline. One-tap
  apply, duplicates blocked at the database level, applicant review for the poster.
- **Events** — going/interested RSVPs with capacity enforced server-side.
- **Articles** — long-form writing with reading-time estimation, unique slugs, views and discussion.
- **Polls** — two to six options, one vote per person, results hidden until you vote.
- **Marketplace** — listings with category, condition, price, photos and availability status.
- **Study groups** — member-run groups with join/leave and a discussion thread gated by membership.
- **People directory** — search and filters, plus bidirectional connection requests where a mutual
  request is treated as an acceptance.
- **Saved** — one list across posts, articles, openings and listings.
- **Dashboards** — three role-specific shapes, every figure computed from the database.
- **Reports** — support queue for administrators with status triage.
- Global search, notifications, light and dark themes.

### Security

- Argon2id password hashing with a 19 MB memory cost.
- Access tokens held in memory only; refresh tokens in an `httpOnly` cookie scoped to `/api/auth`.
- A password change increments `token_version`, retiring every refresh token issued before it.
- Login responses are identical for an unknown email and a wrong password.
- All values bound as parameters; `LIKE` wildcards escaped so a search term stays literal.
- Upload allowlist, size ceiling and randomised filenames.
- Stack traces and SQL text never reach the client.

### Database

- Thirty-five InnoDB tables, fifty-three foreign keys, twelve `CHECK` constraints.
- Likes, bookmarks and comments use one table per parent rather than a polymorphic pair, so every
  row carries a real foreign key and cascade deletes work.
- Money is `DECIMAL`; a test fails the build if a floating-point column appears.
- Counter columns are updated inside the same transaction as the rows they count.
