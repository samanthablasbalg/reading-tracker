# 0026. Frontend API client generated from OpenAPI (orval), synced automatically

- Status: Accepted
- Date: 2026-07-23

## Context

The frontend HTTP layer — hand-written TypeScript interfaces plus hand-rolled `HttpClient` service
methods — was maintained in parallel with the backend's Pydantic/FastAPI contract, with nothing
structural keeping the two in sync. Drift had already happened, not hypothetically:

- The `Book` interface was missing `publication_date_precision`, which the backend actually returns.
- `ReviewRead.rating` serializes `Decimal → string` over the wire, which the hand-written interface
  didn't capture, forcing a manual `parseFloat` at every call site.
- Progress logs had no `type` discriminator field, so the frontend narrowed page-vs-minute logs by
  sniffing whether `current_page` or `current_minute` was null instead of switching on an explicit
  tag.

FastAPI already publishes a full OpenAPI schema for the app; orval can generate a typed client and
models directly from that schema. This closes the drift class structurally — a missing field or
wrong wire type becomes a type error at build time — rather than something to keep catching by hand
after the fact, one bug at a time.

## Decision

**Backend exports a deterministic schema.** `backend/scripts/export_openapi.py` imports `app.main`
and writes `app.openapi()` to `backend/openapi.json`. Two adjustments make the schema fit for
codegen rather than just documentation:

- `generate_unique_id_function` on the `FastAPI` app builds operation IDs as `tag-routeName`, so
  orval's generated method names stay collision-free across routers.
- The frontend catch-all route (`/{full_path:path}`, which serves the built Angular app when
  `frontend/dist` is present) is marked `include_in_schema=False`, so the schema doesn't vary
  between a local build (where `dist` exists) and CI (which never builds the frontend before this
  step runs).
- The script sets placeholder `APP_DATABASE_URL`/`SESSION_SECRET` before importing `app.main`, since
  both raise at import time otherwise and CI has no real values for them at this point.

**Frontend generates an Angular client from that schema via orval**, in `tags-split` mode (each
router gets its own generated file, under `frontend/src/app/api/generated/`). No base URL or mutator
is configured, since `/api` is a relative prefix that already works through the dev proxy and shares
origin with the app in production. Generated files are excluded from eslint/prettier
(`frontend/eslint.config.js`, `frontend/.prettierignore`) and marked `linguist-generated` in
`.gitattributes`, so they don't clutter PR diffs or get reformatted by lint-staged.

**Hand-written services were rewired, not deleted.** `book.service.ts`, `engagement.service.ts`, and
`auth.service.ts` now delegate their HTTP calls to the generated services, and re-export the
generated schema types under their old names so the ~20 consuming components needed no import
changes. The rxjs caching/reload layer each service already had (`books$`, the engagements-by-status
`BehaviorSubject` cache, the auth signal) stays hand-written, since orval only generates raw HTTP
wrappers with no opinion on caching.

**The progress-log schema was refactored ahead of the client generation** (`59b4e71`) from a flat
shape into a `PageProgressLogRead | MinuteProgressLogRead` discriminated union, so the generated
client produces a real discriminated union instead of one flat schema with optional fields.
`engagement-history.ts` narrows on `'page_start' in log` rather than the `type` field itself,
because `type` is optional in the generated schema (Pydantic gives it a default), which defeats
TypeScript's literal-discriminant narrowing on the `else` branch.

**`AuthMe200` stays an inline `{[key: string]: string | null}` type**, not a named model, because
`GET /auth/me` returns a plain dict rather than a Pydantic response model on the backend — left
as-is, out of scope for this change. `currentUser` reads go through bracket notation instead of dot
access as a consequence.

**Kept in sync two ways:**

- A pre-commit hook (`.pre-commit-config.yaml`) regenerates `backend/openapi.json` and the orval
  client whenever a `backend/app/*.py` file changes, stages the results, and widens
  `frontend-typecheck`'s file match (`^(frontend/.*\.ts|backend/app/.*\.py)$`) so the regenerated
  client is type-checked in the same commit.
- CI re-runs the export/generate step in both `backend.yml` and `frontend.yml` and diffs the result
  against the committed files, failing the build on drift. This is detect-only by design — it fails
  loudly rather than auto-committing a fix, so a `--no-verify` bypass or a hand-edit to a generated
  file stays visible instead of getting silently repaired.

## Consequences

**Makes easy:**

- Structural drift (a missing field, a wrong serialized type, a missing discriminator) is now a type
  error or a CI failure, not something discovered by reading response payloads.
- New backend routes or fields propagate to frontend types automatically on regeneration — no
  hand-written interface to remember to update.
- Consuming components didn't need touching — re-exporting generated types under the old names hid
  the migration from ~20 call sites.

**What we accept:**

- Two sync points to maintain instead of one: the pre-commit hook's regenerate-and-stage logic, and
  the CI drift-check duplicated across `backend.yml` and `frontend.yml`.
- The generated client is HTTP-wrapper-only; the caching/reload layer (`books$`, the BehaviorSubject
  caches, the auth signal) remains hand-written and has to be kept correct against whatever the
  generated client returns — orval doesn't help here.
- The discriminated-union narrowing has one non-obvious quirk (`type` is optional in the generated
  schema, so narrowing has to key off `'page_start' in log` instead) that has to be remembered at
  each call site, not enforced by the type system.
- `AuthMe200` being an untyped dict is a known gap carried forward, not fixed by this change.

## Alternatives considered

- **Hand-maintain frontend interfaces with tighter review discipline** — rejected; doesn't
  structurally prevent drift, and the same failure mode had already recurred three times
  independently (missing field, wrong serialized type, missing discriminator).
- **Auto-commit the regenerated files in CI when drift is detected** — rejected in favor of
  detect-only failure, so a bypass or hand-edit stays visible instead of being silently repaired.
- **Configure a custom orval mutator / base URL** — rejected as unnecessary; the relative `/api`
  prefix already works through the dev proxy and shares origin in production.
- **Skip the progress-log discriminated-union refactor and generate a client off the old flat
  schema** — rejected because it would leave in place the exact drift the motivating issue called
  out (narrowing by null-sniffing instead of an explicit discriminator).

## Revisit when

If `GET /auth/me` ever gets a named Pydantic response model, drop the `AuthMe200` bracket-notation
workaround in favor of a typed model. If the frontend and backend move to separately-hosted origins
(no longer sharing one via the dev proxy / prod build), revisit the "no base URL" assumption in
`frontend/orval.config.ts`. If FastAPI's operation-ID strategy or orval's naming ever collides again
despite `generate_unique_id_function`, revisit that function rather than patching around it per
route.
