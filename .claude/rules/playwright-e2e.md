---
paths:
  - 'e2e/**'
---

# Playwright e2e conventions

The standards for writing and editing Playwright e2e tests in `e2e/`. Follow this file over any
external Playwright-docs default.

## Layout

- `e2e/tests/<feature>/<name>.spec.ts` — the tests ("specs"), grouped in a folder per feature.
- `e2e/page-objects/<feature>.page.ts` — Page Objects, kept in one tree (POMs are reused across
  features, so they're not buried inside feature folders).
- `e2e/fixtures/<purpose>.ts` — fixtures, one file per purpose, named for what it sets up. They
  compose into the single `test`/`expect` that specs import: **chain to compose** (each file
  `.extend`s the previous test, not `@playwright/test`), **depend to order** (a fixture runs after
  another by destructuring it).
- `e2e/api/api-client.ts` — `ApiClient` for backend data setup.
- `e2e/tests/seed.spec.ts` — the authoring seed (its own `seed` project, excluded from the suite).

## Auth & seed

Every route is login-gated (Google OAuth). The `auth setup` project (`tests/auth.setup.ts`) logs in
once per run via the env-gated `POST /auth/test-login` bypass (active only when
`ALLOW_TEST_LOGIN=true`; set for the e2e backend, and also for local dev so
`scripts/seed_dev.py` can authenticate — see below) and saves the session to
`e2e/.auth/user.json`; `chromium`/`firefox`/`mobile` load it as `storageState`, so every
`page`/`request` starts already authenticated. `test-login` takes a `persona`
(`"e2e"` default, or `"dev"`) that picks a fixed, hardcoded email — never a caller-supplied one —
so the bypass can never mint a session for an arbitrary address.

- **Schema** is provisioned by the `db setup` project (`tests/db.setup.ts`): it creates the e2e
  database if missing and runs `alembic upgrade head`. Every other project depends on it.
- **Data isolation** is per-test truncation. Specs import `test`/`expect` from the `fixtures/`
  tree — never `@playwright/test` directly — and the base `test` carries an `auto` fixture that
  truncates every table before each test **except `users`** — truncating it would orphan the
  session `auth setup` already established. With `workers: 1` that means each test starts from an
  otherwise-empty DB, so tests use **fixed** identifiers and need **no** per-test cleanup or unique
  suffixes.
- **Data setup** goes through `ApiClient` (`e2e/api/api-client.ts`), built from the `request`
  fixture, hitting the e2e backend on :8001 directly.

The **authoring seed** (`tests/seed.spec.ts`, the `seed` project) runs `seed_dev.py`, logs the
browser in, then navigates to `/` and `page.pause()`s so `playwright-cli` can drive one live
session under `--debug=cli`. It is excluded from the browser projects via `testIgnore`, from CI via
a `process.env['CI']` check in `playwright.config.ts` (it's an interactive tool, not a regression
check), and runs with `timeout: 0`. The authoring loop is in the skill. `seed_dev.py`, the dev-data
seeder it runs, authenticates via `POST /auth/test-login` with `persona: "dev"` before creating any
books/engagements — the same email `reset()` already hardcodes, so both agree on one user
regardless of which database (local dev or e2e) it points at. The spec itself then makes that same
`persona: "dev"` call via `page.request` before navigating, so the paused session is logged in as
the user the data actually belongs to and lands on the authenticated app with the seeded books
visible, not the guest landing page.

> Forward note: serial truncation is the **current** model, not the destination. Parallelism is a
> known future direction (#65) and will retire the global truncate in favour of
> unique-id data and scoped cleanup. Don't pre-build for it — but when it lands, the fixed-id and
> no-cleanup rules below flip.

## Running

- Run a spec with the dot reporter:
  `npm test -- tests/<feature>/<name>.spec.ts --reporter=dot`. The repo's default reporter is
  `html`; always pass `--reporter=dot` for a readable run.
- Single browser (chromium); `webServer` auto-starts the e2e backend on :8001 and the frontend on
  :4201.
- Flakiness check: `--repeat-each=10`. Any failure = flaky = not done.

## Quality gate

Every item below is a hard requirement. A spec or POM that breaks any of them is **not done** — it
is exactly what a review should catch (with `file:line`).

### Test code is NOT source code

Think like a test author, not an app developer. A test produces one clear pass/fail signal; every
line is setup, action, or assertion. Production-code habits are anti-patterns:

- **No control flow _inside_ a test body** — no loops, `if`/branches, `switch`, or flow-control
  ternaries within the `test()` callback. A single test exercises ONE concrete path. (A `for` loop
  _around_ `test()` to generate parameterized/data-driven tests is fine — that's Playwright's
  pattern; the rule is about control flow _within_ a test.)
- **No `try/catch` or `try/finally` in a test** — let failures throw. Cleanup lives in `afterEach`
  (which _may_ use try/catch so a cleanup failure doesn't mask the result — the one place it's
  allowed).
- **No defensive parsing or graceful recovery** — don't guard against malformed responses, missing
  tokens, or bad state. Fail loudly so the signal is real.
- **No redundant guards** — don't re-check env that `db setup` already provisioned; don't `waitFor`
  before a click (Playwright auto-waits).
- **No wrapper indirection or `unknown`-type juggling** — no one-off helper abstractions, no
  branching on response shape.
- If you're adding a safety net, you're solving the wrong problem. Trust the framework (auto-waits,
  `afterEach` cleanup, timeouts) and the setup (provisioned schema, truncated DB).

### Locators

- All element access in a spec goes through a Page Object — never `page.getByX()` or
  `page.locator()` in a spec.
- Use user-facing locators, in order: `getByRole(name)` → `getByLabel` → `getByPlaceholder` →
  `getByText` → scoped CSS (last resort only).
- No `data-testid`.
- No `.first()` / `.nth()` / `.last()` — scope the locator to be unique instead.
- No `.or()` chains. Target the interactive element itself, not a nested icon/SVG.
- No `xpath=`, and don't chain `locator()` by DOM-structure depth (parent hops, `..`) — scope to a
  unique, stable container instead.
- When no good locator exists, fix the **source** semantically (`role`, `<label for>`, `aria-label`)
  rather than shipping a brittle locator.

### Page objects

- No assertions (`expect`) inside a Page Object — POMs expose locators/values; specs assert.
- Reuse existing navigation; don't duplicate a `goto()` a POM already provides.
- Parameterless element accessors are `readonly Locator` properties built in the constructor, not
  methods; parameterized ones are methods.
- **Every POM method begins with a verb** — actions (`sendMessage`) and locator-returning getters
  alike (`getRowFor(name)`, never `rowFor(name)`).
- No private members — a POM is a simple public-API class.

### Structure & waiting

- **~5–8 tests per spec file (10 absolute max).** When a file reaches ~8, find a sensible seam (a
  sub-feature) and **propose a split** to the user rather than piling on; a spec over 10 tests is
  too big.
- No `describe` block unless the file genuinely needs more than one setup.
- **Every action lives in a `test.step()`** — setup included (data seeding via `ApiClient`, route
  stubs, navigation). Loose actions at the top of the test body don't appear in the report; a reader
  should see the test's phases — setup → exercise → verify — from the step list alone.
- **Verification is its own step**, titled for what it checks, so the verify phase is visible. The
  one exception: an assertion that *gates a precondition* (confirming a setup action took effect
  before the test proceeds) rides inside that setup/exercise step instead of standing alone.
- No `page.waitForTimeout()` and no `networkidle` — use `toBeVisible` / `toHaveURL` /
  `waitForResponse` / `domcontentloaded`.
- Don't hardcode timeouts; rely on Playwright's auto-waiting and 30s default. Only set an explicit
  timeout when it genuinely differs from the default. (No shared `TIMEOUTS` constant yet — add one
  if real values start to accumulate.)
- No per-test cleanup of created data — the `auto` truncate fixture resets the DB before each test.
  (Cleanup that genuinely outlives the DB, e.g. files, goes in `afterEach`.)
- Tests are independent: no reliance on execution order, no shared mutable state — each must pass
  alone and under `--repeat-each`.
- Under the current truncate model, artifacts use **fixed, readable** identifiers (no
  timestamp/random suffix) — `workers: 1` plus per-test truncation means there's nothing to collide
  with. (This flips to unique suffixes when the suite goes parallel.)

### Code quality

- No comments in **test code** — specs self-document via `test.step()` titles; only
  `// eslint-disable-*` is allowed. (POMs, helpers, and the seed may keep concise _why_-comments.)
- No `test.only`, no `console.log`, no hardcoded credentials.
- File uploads use `setInputFiles()` or a `page.waitForEvent('filechooser')` listener — never click
  a chooser button without it.

### API data setup (`ApiClient`)

Tests that need backend data create it through `ApiClient` (`e2e/api/api-client.ts`), built from the
`request` fixture — never inline HTTP in the spec:

- **Setup only — never assertions.** `ApiClient` creates data; tests assert. No `expect` inside it.
- **Type the responses — no `unknown`, no defensive parsing.** Extract directly
  (`(await res.json()).id`); a malformed response should fail loudly, not be handled gracefully.
- **Methods are verbs** (`createBook`, `markAsReading`) and earn their place by reuse — don't add a
  one-off wrapper for a single caller.
- Teardown is the `auto` truncate fixture's job, not `ApiClient`'s — it has no delete methods.

## Naming

- **Name the spec file for the feature/surface under test, matching its Page Object** —
  `e2e/tests/navigation/sidebar.spec.ts` ↔ `e2e/page-objects/sidebar.page.ts`. **Not** the
  scenario: never `sidebar-collapse.spec.ts`. The file is the home for every test of that surface;
  the specific scenario is the `test()` title, and more scenarios go in the same file.
- **Test titles: present tense, first letter capitalized** — e.g.
  `'Collapsing the sidebar persists across reload'` (not `'collapses…'`, not `'should…'`).
- kebab-case filenames; camelCase identifiers.

---

Authoring workflow → `.claude/skills/playwright-new-test/`
