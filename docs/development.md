# Development guide

How to run the whole stack locally. The one non-obvious part is the database: the app uses **two
Postgres roles** so that row-level security actually constrains it (see
[ADR-0023](decisions/0023-per-user-data-isolation-via-rls.md)) — an owner role that owns the schema
and runs migrations, and a restricted `app_user` role the running app connects as.

## Prerequisites

- **Python 3.14**
- **PostgreSQL 18**
- **Node.js** (for the Angular 22 frontend)

---

## Backend

From `backend/`:

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

> The pre-commit hook looks for the virtualenv at `backend/venv`, so that's the path to use.

**1. Create the databases.** In Postgres, create a development database and a test database (any
names you like — you'll point the env vars at them).

**2. Create the `backend/.env` file** (loaded automatically). See the variable table below.

**3. Create the restricted role.** This creates the `app_user` role and grants it CRUD — but not
ownership — on both databases:

```bash
python scripts/setup_db_role.py
```

**4. Run migrations** (as the owner — this builds the schema _and_ installs the RLS policies):

```bash
alembic upgrade head
```

**5. Run the app:**

```bash
uvicorn app.main:app --reload   # http://localhost:8000
```

### Environment variables (`backend/.env`)

| Variable                | Required  | Purpose                                                                                     |
| ----------------------- | --------- | ------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | ✅        | **Owner** connection to the dev DB. Used by migrations, the role-setup script, and seeding. |
| `APP_DATABASE_URL`      | ✅        | **`app_user`** connection to the dev DB. What the running app connects as, so RLS applies.  |
| `SESSION_SECRET`        | ✅        | Signs the session cookie.                                                                   |
| `GOOGLE_CLIENT_ID`      | ✅        | Google OAuth client.                                                                        |
| `GOOGLE_CLIENT_SECRET`  | ✅        | Google OAuth client secret.                                                                 |
| `ALLOWED_EMAILS`        | ✅        | Allowlist of emails permitted to log in (the app is invite-only).                           |
| `TEST_DATABASE_URL`     | for tests | **Owner** connection to the test DB.                                                        |
| `APP_TEST_DATABASE_URL` | for tests | **`app_user`** connection to the test DB.                                                   |
| `APP_DB_PASSWORD`       | optional  | Sets the `app_user` role's password in `setup_db_role.py`.                                  |
| `GOOGLE_REDIRECT_URI`   | optional  | Override the OAuth redirect URI (otherwise derived from the request).                       |
| `FRONTEND_URL`          | optional  | Where to redirect after login (default `http://localhost:4200`).                            |
| `SESSION_COOKIE_SECURE` | optional  | Set to `true` for https-only cookies (production).                                          |
| `GOOGLE_BOOKS_API_KEY`  | optional  | Key for the Google Books search proxy.                                                      |

---

## Frontend

From `frontend/`:

```bash
npm install
npm start          # http://localhost:4200
```

`npm start` runs `ng serve` with `proxy.conf.json`, which forwards `/api` to the backend at
`http://localhost:8000` — so run the backend alongside it.

---

## Google OAuth setup

Auth is Google OAuth with an email allowlist. To run it locally you'll need your own OAuth client:

1. In the Google Cloud console, create an **OAuth 2.0 Client ID** (web application).
2. Add an authorized redirect URI that matches where the backend serves the callback (locally, the
   value `GOOGLE_REDIRECT_URI` resolves to, e.g. `http://localhost:8000/api/auth/callback`).
3. Put the client ID and secret in `backend/.env`, and add your Google account's email to
   `ALLOWED_EMAILS` — only allowlisted emails can complete login.

---

## Seeding development data

`scripts/seed_dev.py` populates a dev database by calling the running backend's API:

```bash
python scripts/seed_dev.py   # backend must be running; override its URL with BASE_URL
```

> **Known gotcha (verify when pulled):** the seed script doesn't currently authenticate against the
> auth-gated backend (issue #147), so it may need adjustment before it works end-to-end against the
> login flow.

---

## Tests

- **Backend** — from `backend/`:

  ```bash
  pytest
  ```

  Requires `TEST_DATABASE_URL` and `APP_TEST_DATABASE_URL`. The suite resets the schema, runs
  migrations, and truncates between tests against a
  [dedicated test database](decisions/0014-dedicated-test-database.md).

- **Frontend** — from `frontend/`:

  ```bash
  npm test
  ```

  This runs `ng test --watch=false` through Angular's build (which sets up the Vitest environment).
  Don't run `vitest` directly — it bypasses that setup.

- **End-to-end** — from `e2e/`:

  ```bash
  npm install
  npx playwright install   # first time: browser binaries
  npm test
  ```

  Playwright against a
  [purpose-built e2e database strategy](decisions/0018-e2e-testing-database-strategy.md). The e2e
  run uses a test-auth bypass (`E2E_TEST_AUTH=true`) so it doesn't need real Google login; that flag
  must never be set in production.

- **Static checks** — Ruff, mypy (strict), ESLint, and Prettier run via pre-commit
  (`.pre-commit-config.yaml`); install the hooks with `pre-commit install`.

---

## How it fits together locally

```
frontend (ng serve :4200)  ──/api proxy──▶  backend (uvicorn :8000)  ──app_user──▶  PostgreSQL
```

For the bigger picture — the request path, the RLS boundary, the data model — see the
[architecture overview](architecture.md).
