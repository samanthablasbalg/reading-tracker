# 0013. Author identity: get-or-create by name

- Status: Accepted
- Date: 2026-06-09

## Context

Both `POST /books` (manual add) and `POST /books/import` (from Google Books) need to attach authors
to a book. An author is an entity in its own right — the `authors` table carries identity and
diversity attributes (nationality, gender identity, `bipoc`, `lgbt`, …) that feed author- and
diversity-level stats. Like books, authors are shared, user-agnostic bibliographic data (see
[[0002-books-are-user-agnostic]]), so the same person must resolve to **one** row, reused across all
their books, never duplicated per book.

The only stable handle available at attach time is the author's **name**. On a manual add the client
sends a name string; on import, Google's volume gives authors as bare name strings
(`volume.authors`) with no per-author ID or external key. Name is what we have to match on.

## Decision

Resolve authors by name with **get-or-create**: look up an existing `authors` row whose `name`
matches; reuse it if found, otherwise create one (`_get_or_create_author` in `app/api/books.py`).
This is "option A" from the author-handling design discussion.

`authors.name` carries a `UNIQUE` constraint as the integrity backstop: even if two writes race past
the `SELECT`, the database refuses a duplicate name, so a person can never end up as two author
rows. The same resolver serves both endpoints — import just loops it over each name Google returns.

## Consequences

- **Easy:** adding a book works with a plain author name — no separate author-creation step, no
  `author_id` bookkeeping in the client. An author already in the system is automatically reused, so
  their diversity attributes and cross-book stats stay attached to a single row.
- **Exact-string match, no normalization** (caveat, verify when it bites): matching is on the raw
  `name` — no case/whitespace/punctuation folding. "J.R.R. Tolkien" and "J. R. R. Tolkien" become
  two distinct authors, and a Google import name that differs from a manually-typed one won't merge.
  Dedup/merge is deliberately a future concern, not handled here.
- **Race backstop, not graceful recovery** (flagged landmine): the `UNIQUE` constraint guarantees no
  duplicate row under a race, but the code does not catch the resulting `IntegrityError` to
  re-select — so under genuine concurrency the losing writer would error rather than recover. At
  single-user scale there is no concurrency, so this is a correctness backstop we rely on, not an
  exercised path.

## Alternatives considered

- **Always create a new author row (no reuse)** — simplest to write, but produces a duplicate author
  for every book, destroying author-level and diversity stats (the whole reason authors are their
  own entity). Rejected.
- **Two-step: client looks up / creates the author separately and passes an `author_id`** — more
  REST-pure and free of write side-effects, but adds a round-trip and client bookkeeping to a
  personal, single-user "add a book" flow for no real benefit here. Rejected for now.
- **Match on an external key (e.g. a Google author ID) instead of name** — there is no such key:
  Google returns authors as bare strings and manual adds have none. Name is the only handle.
  Rejected as infeasible.

## Revisit when

- Author dedup/merge becomes a felt problem — duplicates from name variants pile up, or two rows for
  the same person need merging. That's when name-normalisation or a manual merge tool earns its
  place.
- This ever goes concurrent / multi-user: revisit `_get_or_create_author` to catch the `UNIQUE`
  violation and re-select, so a racing writer recovers instead of 500-ing.
