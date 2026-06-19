# 0012. Shared vs per-table Postgres ENUM types

- Status: Accepted
- Date: 2026-06-08

## Context

Several columns are backed by Postgres `ENUM` types, mapped from Python `StrEnum` classes (all
defined in `app/models/enums.py`). SQLAlchemy turns a Python enum into a Postgres ENUM via its
`Enum` type (`SAEnum`), and **each `SAEnum` instance bound to the metadata emits its own
`CREATE TYPE`**, keyed by the type's `name`.

Most of our enums back a single table: `reading_status` and `reading_format` (engagements),
`log_unit` (progress_logs), `book_author_role` (book_authors). One does not: `date_precision` is the
fuzzy-date precision companion (see [[0008-time-modeling-on-vs-at]]) and is used by `books`,
`standalone_entries`, and six separate date columns on `engagements`.

If a multi-table enum is declared inline at every column —
`SAEnum(DatePrecision, name="date_precision")` repeated across three model files — you get several
`SAEnum` instances all naming the same Postgres type, and DDL tries to `CREATE TYPE date_precision`
more than once, which fails ("type already exists").

## Decision

**Declare a shared enum type once, bound to the metadata, and import that single instance everywhere
it's used.**
`date_precision_type = SAEnum(DatePrecision, name="date_precision", metadata=Base.metadata)` lives
in `enums.py`; `books`, `engagements`, and `standalone_entries` all reference that one object, so
SQLAlchemy emits exactly one `CREATE TYPE date_precision`.

**Per-table enums stay inline** in their own model file —
`mapped_column(SAEnum(ReadingStatus, name="reading_status"))` in `engagement.py`, and so on. One
table, one instance, one `CREATE TYPE`; nothing to share.

The split is pragmatic: centralize the _SQLAlchemy type declaration_ only for enums that actually
span tables, and keep the rest next to the column they serve. (The Python `StrEnum` classes all live
in `enums.py` regardless — what's being decided here is where the SQLAlchemy **DDL type** is
declared, not where the Python value set lives.)

## Consequences

- **One canonical definition for the shared type.** All six engagement date-precision columns plus
  the book and standalone ones reference the same Postgres type, so they can't drift apart.
- **Per-table enums read naturally** — the type sits next to the column it serves, no indirection or
  cross-file import.
- **Accept: enum declarations live in two different places.** One type is centralized in `enums.py`,
  the rest are inline, so a reader has to know the rule ("shared → centralized, single-table →
  inline") rather than finding all enum DDL in one spot.
- **Accept (flagged landmine): a single-table enum that later gains a second table must be
  _promoted_** to a shared, `metadata`-bound instance, or DDL will hit the duplicate `CREATE TYPE`
  problem above. Cheap to do — the type name stays the same — but easy to forget.

## Alternatives considered

- **Inline everywhere, including `date_precision`** — uniform and local, but a multi-table enum
  declared inline produces duplicate `CREATE TYPE` attempts for the same named type and fails at
  DDL. Rejected — this is the exact problem the shared instance solves.
- **Centralize _all_ enum types in `enums.py`** — uniform the other way and superficially tidy, but
  it pulls single-use types away from the one model that uses them for no benefit, and adds an
  import where an inline declaration reads fine. Rejected: centralize only what sharing requires.

## Revisit when

A currently single-table enum becomes multi-table — e.g. `reading_format` starts being used outside
engagements. Promote it from an inline `SAEnum` to a shared `metadata`-bound instance like
`date_precision_type`, keeping the same type name. (Otherwise low-stakes: this is an internal
declaration-style convention, not a data-model contract.)
