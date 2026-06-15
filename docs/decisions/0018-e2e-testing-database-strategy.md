# 0018. End-to-end testing database strategy

- Status: Accepted
- Date: 2026-06-14

## Context

We want full-stack, browser-driven tests (Playwright) that exercise the real Angular frontend
against the real FastAPI backend — coverage our unit and integration tests can't reach. Three forces
shape how:

- **Database safety.** Tests mutate data. ADR-0014 already records a bug where the pytest suite,
  pointed at `DATABASE_URL`, wiped the dev database on teardown. E2E carries the same hazard,
  amplified: it runs a real backend that reads and writes a real database.
- **Coexistence with development.** The dev stack (backend `:8000`, frontend `:4200`) is typically
  running while working. E2E must not require tearing it down.

## Decision

- **A dedicated e2e database**, `reading_tracker_e2e`, addressed by `E2E_DATABASE_URL`. This is the
  third database, each with a distinct job: `reading_tracker` (dev), `reading_tracker_test` (pytest,
  ADR-0014), `reading_tracker_e2e` (Playwright).
- **Playwright owns the whole stack.** A `db setup` project provisions the database and runs
  migrations; `webServer` entries start a backend and frontend dedicated to e2e.
- **Isolated ports.** The e2e backend runs on `:8001` and the frontend on `:4201` (via a dedicated
  `proxy.e2e.conf.json`), so e2e coexists with the dev stack on `:8000`/`:4200`.
- **Per-test isolation by truncation.** An auto-fixture runs `TRUNCATE ... RESTART IDENTITY CASCADE`
  before each test.

## Consequences

- Three databases to keep migrated and reasoned about.
- E2E runs alongside an active dev session with no port or data collisions.
- **Serial execution (`workers: 1`).** The shared-database + truncate model is unsafe under parallel
  workers: concurrent tests truncate each other's rows mid-run and race on inserts. This is not the
  desired long-term state, but is sufficient for where the app is now in development. Parallel
  execution with real isolation is tracked in #65.
- `reuseExistingServer` is a footgun: a stale process already on an e2e port is adopted silently
  (and may point at the wrong database). Kept `true` locally for speed; mitigate by killing strays.

## Alternatives considered

- **Share the dev database** — rejected for now, but it is unclear if this would have the same
  problem as the ADR-0014 bug. That issue was about migrations being reset. It may be sufficient to
  just wipe the dev db each time the tests run, if I don't care about my dev data (which I certainly
  do not).
- **Drop/recreate the schema per test** — rejected; slow and unnecessary versus truncation.
- **Per-worker databases / unique-data-per-test** for parallel isolation — deferred to #65. These
  also may end up being the solution but were higher cost to implement right now.

## Revisit when

- #65 enables parallel execution (per-worker databases or unique-data-per-test).
- The `reuseExistingServer` footgun causes a wrong-database run → switch the e2e backend to
  `reuseExistingServer: false`.
