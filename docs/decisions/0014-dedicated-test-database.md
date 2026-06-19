# 0014. Dedicated test database

- Status: Accepted
- Date: 2026-06-11

## Context

The test suite needs to create the schema, write rows, and tear everything down between runs. That
teardown is **destructive by nature**: the session-scoped fixture calls `Base.metadata.drop_all()`
(`backend/tests/conftest.py`).

This caused real data loss. `conftest.py` originally built its engine from `DATABASE_URL` — the dev
database. So simply running `pytest` created tables in dev and then, on teardown, ran `drop_all()`
against it, wiping the development database after every test run.

## Decision

Tests run against a **dedicated database**, `reading_tracker_test`, selected by a separate
`TEST_DATABASE_URL` environment variable that `conftest.py` reads independently of the app's
`DATABASE_URL`.

`conftest.py` **hard-fails** (`raise ValueError`) if `TEST_DATABASE_URL` is unset — it never falls
back to `DATABASE_URL`. The destructive `create_all` / `drop_all` lifecycle is therefore permanently
scoped to a throwaway database that holds nothing precious.

(Isolation is two-layered: `drop_all` at the session boundary, plus a per-test `clean_data` fixture
that deletes rows between tests. The safety property here is the separate database; the row-cleaning
is just per-test hygiene.)

## Consequences

- **The destructive teardown is safe by construction.** `drop_all()` can only ever hit the throwaway
  test database; dev data is never in the blast radius.
- **The bug's exact path is now a hard stop.** With no silent fallback to `DATABASE_URL`, running
  the suite without a configured test database fails loudly instead of quietly destroying dev data.
- **Accept: a little setup.** You must create `reading_tracker_test` and set `TEST_DATABASE_URL`
  (e.g. in `.env`) before tests run, and the engine/`Base` wiring now lives in two places (app vs.
  conftest).
- **Accept: tests need a live Postgres.** Running against real Postgres 18 means dialect-specific
  features (`ARRAY` columns, ENUM types) are exercised faithfully — at the cost of no in-memory
  shortcut for the suite.

## Alternatives considered

- **Share the dev database, isolate per test via transaction rollback** — avoids a second database,
  but the schema fixtures use session-level `create_all` / `drop_all` (DDL, which doesn't roll back
  cleanly), and the teardown is destructive: one stray `drop_all` against dev — exactly the bug that
  happened — loses real data. A separate database makes that blast radius empty. Rejected.
- **Same database, separate Postgres schema / table prefix** — possible, but more machinery than a
  second database and still shares a failure domain with dev data. Not worth it at this scale.
  Rejected.
- **In-memory SQLite for tests** — fast and zero-setup, but diverges from the Postgres engine we
  actually run (see [[0001-tech-stack-angular-fastapi-postgres]]): `ARRAY`, ENUM types, and dialect
  behaviour wouldn't be exercised, so tests would pass against a database we don't ship. Fidelity
  beats speed here. Rejected.

## Revisit when

- Suite startup cost starts to bite and per-test transaction rollback (layered on top, still against
  the test database) becomes worth the complexity for speed.
- This runs in CI: the test database gets provisioned per run there, which the separate-database
  design already supports — no change to the decision, just a new place it applies.
