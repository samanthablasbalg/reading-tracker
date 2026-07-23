# 0025. Backend layering: routers, services, generic CRUD

- Status: Accepted
- Date: 2026-07-23

## Context

Before this decision, `app/api/*.py` routers did everything themselves: parse the request, build
SQLAlchemy `select()` statements inline, construct model instances with `db.add()`/`db.flush()`, and
shape the response — all in one function body. `app/services/` existed, but only for
`google_books.py`, an external API client; nothing about the app's own data lived in a service
layer. Business rules and database access were both just router code.

This surfaced as a real bug, not a hypothetical one: `create_book` (manual entry) and `import_book`
(Google import) each independently built a `Book` + its `BookAuthor` links — same shape, two
separate implementations. They had already drifted (no shared handling if a new field needed setting
on both), and there was no structural reason they wouldn't keep drifting. The get-or-create pattern
(look up by a column, create if missing, flush) was similarly reimplemented three times — once for
authors in `books.py`, once for users in `auth.py`, and again wherever engagements needed it — each
copy subtly different.

Fixing the book-creation duplication by hand would have left the underlying cause in place: there
was no home for shared business logic, and no shared primitive for the DB-access pattern every one
of these was rebuilding. The fix had to be structural, not a one-off patch.

## Decision

Three layers, each with one job:

- **`app/api/`** — routers. Parse and validate the request, call a service function (or, for routes
  with no real logic, a `crud` instance directly), commit, shape the response. No direct
  `db.add()`/`select()` construction of domain writes.
- **`app/services/`** — business logic. One function per operation that has actual rules to enforce
  (`create_book`, `import_book_from_google`, engagement lifecycle transitions, review upsert).
  Callable independent of FastAPI, so the same rule can't exist twice because two routes need it.
- **`app/crud/`** — a single generic `CRUDBase[ModelType]` (`get`, `get_or_raise`, `get_by`, `list`,
  `list_by`, `create`, `update`, `delete`, `get_or_create`), instantiated once per model in
  `crud/__init__.py` (`book_crud`, `author_crud`, `engagement_crud`, etc.) and imported from there
  by everything else. One class replaces per-model boilerplate; one file answers "where does
  `book_crud` come from" instead of it depending on import order.

Alongside this, `app/exceptions.py` defines plain-Python `NotFoundError` / `ConflictError` /
`InvalidOperationError` (no FastAPI dependency), with `register_exception_handlers()` mapping each
to an HTTP status in one place in `main.py`. This is what lets `crud`/`services` raise domain errors
without importing FastAPI or hand-rolling `HTTPException` in every router.

Router files that grew past the point of being one concern were split along this same layering, not
left flat: `app/api/engagements.py` (698 lines) became
`app/api/engagements/{lifecycle, progress_logs, bindings, reviews}.py`, each paired with the
matching file in `app/services/engagements/`. `editions.py` was small enough to rebuild directly on
`crud` instances without needing its own service module — the layering is a default, not a rule
requiring a service file for every router.

## Consequences

**Makes easy:**

- A rule enforced once has exactly one implementation to find, read, or change — the specific
  failure mode that caused the book-creation drift can't recur the same way for anything routed
  through a service function.
- New CRUD-shaped code for a new model costs one `CRUDBase(Model)` instantiation, not a new
  get/list/create/update/delete implementation.
- Business logic is unit-testable without spinning up a request (`test_crud.py` tests `CRUDBase`
  directly, not only through router integration tests).
- Files split along layer boundaries as they grow, instead of a flat file accreting until a rewrite
  is unavoidable.

**What we accept:**

- More files and more indirection for simple cases — reading `create_book`'s full behavior means
  following router → service → crud, not one function body.
- The layering is judgment, not enforced structure: nothing stops a future router from reaching back
  into `db.execute(select(...))` directly. Discipline here is a convention, not a constraint the
  codebase enforces on itself.
- `CRUDBase.update()` only applies `PATCH`-shaped semantics (only fields in
  `payload.model_fields_set`). Anything that's genuinely a `PUT` full-replace (e.g. review upsert's
  rating/body overwrite) has to bypass it and assign fields directly — a case where the generic
  primitive doesn't fit and reaching around it is correct, not a workaround to clean up later.

## Alternatives considered

- **Patch the book-creation duplication directly** (make `import_book` call into `create_book`'s
  logic without extracting a service layer or a generic CRUD class) — rejected because it would have
  fixed one symptom while leaving the same root cause (no shared home for business logic, no shared
  DB-access primitive) free to reproduce it elsewhere, which it already had three times over.
- **Per-model CRUD classes** (a `BookCRUD`, `AuthorCRUD`, etc., each subclassing or duplicating the
  same methods) — rejected in favor of one generic `CRUDBase[ModelType]`, since every model needed
  the identical get/list/create/update/delete/get_or_create shape and per-model classes would just
  be the same boilerplate problem one level up.
- **Keep raising `HTTPException` directly from services** — rejected because it would make service
  functions depend on FastAPI, blocking the stated goal of business logic being callable outside a
  request (e.g. a future import script).

## Revisit when

If a route's logic is genuinely a one-liner over `crud`, don't force a service module just to match
the pattern — `editions.py` is the precedent for skipping straight to `crud`. Revisit the generic
`CRUDBase` itself if a model's access pattern stops fitting get/list/create/update/delete (e.g.
needs bulk operations or a non-trivial query shape) — extend that model's usage with
router/service-local queries rather than bending `CRUDBase` to fit one outlier.
