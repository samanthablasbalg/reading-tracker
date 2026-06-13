# 0010. User-extensible reference tables

- Status: Accepted
- Date: 2026-06-08

## Context

Some values in the app are vocabularies I curate over time, not a fixed set the system owns: where a
copy came from (Libby, the library, a gift, Audible…), genres, and eventually places (author
nationalities, book settings). I don't know the full list up front, and I'll want to add to it as I
read — without writing code or running a migration each time.

There are two ways to model a constrained-choice field:

- **An enum** — the allowed values are baked into the code (like `reading_status`). Adding a value
  means a code change plus a schema migration. Right for a _closed_ set the system defines.
- **A reference table** — a small table with one row per value, foreign-keyed from whatever uses it.
  Adding a value means inserting a row. Right for an _open_ set the user owns.

The deciding question is **who owns the vocabulary**. A reading status is the app's to define; a
list of book sources is mine.

## Decision

For vocabularies I curate, use a **reference table**: a small table (a value per row), foreign-keyed
from the things that reference it, **seeded with sensible defaults** so it's useful immediately, and
**extensible from the UI by inserting a row** — no schema migration to add a value.

This is the intended pattern for:

- **`book_sources`** — where a copy came from. Sensible seed values: audible, gift, kindle store,
  libby, library, libro.fm, project gutenberg, book store.
- **`genres`** — though genres currently arrive raw from Google Books and aren't canonicalised;
  folding them into a curated reference table waits until there's a UI to manage them. For now this
  ADR records genres as a _member of this pattern's intended domain_, not a current instance of it.
- **`places`** (future) — author nationalities and book settings.

Closed, system-owned sets stay enums (see [[0012-shared-vs-per-table-enums]]); the split is along
ownership, and the two approaches coexist deliberately.

## Consequences

- **Adding a value is data, not a deploy.** I extend my own lists from the UI — no migration, no
  code change, no waiting on a release.
- **The lists aren't empty on first use** — defaults ship, so there's something to pick from on day
  one and a consistent set to grow from.
- **Accept: looser than an enum.** Values are free-form rows, so without a guard two near-duplicates
  ("library" / "Library") can coexist, and the database can't constrain a column to "one of a known
  set" the way an enum does. That looseness is the price of letting me own the list.
- **Accept: joins instead of an in-code value set** — a reference table is a foreign key and a join,
  where an enum is just a value on the row.

## Alternatives considered

- **An enum for everything** — wrong for curated lists: every new source, genre, or place would be a
  code change and migration I can't do for myself from the UI. Rejected for these vocabularies; kept
  for closed, system-owned sets.
- **Free text on the row** (type the source as a string each time) — no shared list, no consistency,
  no picking from prior values; "libby" / "Libby" / "libbey" proliferate with nothing tying them
  together. Rejected — a curated, reusable list is the entire point.

## Revisit when

A vocabulary needs more than a name — display ordering, grouping, deprecating a value without
deleting it, or canonicalising/merging near-duplicates. That's when a bare `(id, name)` row grows
real structure. Genres specifically get pulled into this pattern once there's a UI to curate them.
