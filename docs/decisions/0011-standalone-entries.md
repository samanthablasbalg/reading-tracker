# 0011. Standalone entries (reads off the annual book goal)

- Status: Accepted
- Date: 2026-06-08

## Context

Not everything I read is a book in my library. A short story, an article, a piece of
fanfic, a single comic issue not yet collected — these are real reads I want to log
(pages or minutes, notes, when I read it), but two things set them apart:

- They must **not** count toward the annual *book* goal.
- Many have **no `books` record at all** — they are uncollected or book-less material.

Engagements (see [[0005-engagements-lifecycle-entity]]) are the wrong home: they are
heavyweight lifecycle entities tied to a `books` row, and finishing one is part of
what the book goal counts. Pushing a fanfic or an uncollected comic through that
machinery would either pollute the book count or force me to invent a fake `books`
row for something that was never published as a book.

## Decision

A separate, lightweight `standalone_entries` table for reads that must **not** count
toward the annual book goal — book-less or uncollected material (short stories,
articles, fanfic, comics not yet in any collection).

It is deliberately **not an engagement**: no status, no lifecycle, no progress logs,
no re-read tracking — just a one-off record of something read. Its fields are minimal:
`read_on` (a required fuzzy `_on` date — "read it in 1994" works, see
[[0008-time-modeling-on-vs-at]]), `pages_read`, `minutes_listened`, and `notes`.

It supports two modes, plus optional author attribution:

- **Linked mode** — `book_id` is set; title / author / cover are inherited from the
  `books` record (e.g. logging a single story against a book that does exist).
- **Manual mode** — `book_id` is null; `manual_title` / `manual_author` are filled in
  for material in no published book.
- `author_id` can point at a known `authors` row **independently** of `book_id`, so a
  story by an author already in the system still feeds author/diversity stats even
  with no book.

Keeping these reads in their own table is what holds them out of the book goal **by
construction**: the goal is a *derived* count over books/engagements (see
[[0004-derive-dont-store]]), and standalone entries simply aren't in that set — no
`counts_toward_goal` flag to set and remember.

## Consequences

**Makes easy:**
- Logging a short story, article, fanfic, or uncollected comic without inventing a
  fake book or polluting the book goal.
- These reads still contribute to pages / minutes totals and can carry notes and an
  author (so diversity stats pick them up).
- The book goal stays a clean derivation over books/engagements — standalone reads are
  excluded because they live elsewhere, not because of a flag.

**What we accept:**
- A second "thing I read" shape exists alongside engagements; a borderline item (a
  long story I might later treat as a book) could go in either, and which to use is a
  judgment call.
- A standalone entry has no progress timeline or re-read history by design, so it
  can't *grow* into a fully tracked read — that would mean re-creating it as an
  engagement.

## Alternatives considered

- **Log these as engagements with a "doesn't count" flag** — pollutes the lifecycle
  model with lightweight one-offs, needs a flag every book-goal query must remember to
  honour, and still wants a `books` row that may not exist. Rejected.
- **Invent a `books` row for every fanfic / article** — corrupts the bibliographic,
  user-agnostic `books` table (see [[0002-books-are-user-agnostic]]) with non-book,
  often unpublished material. Rejected.
- **One free-text reading log with no linking** — loses the ability to attribute a
  read to a known book or author (cover inheritance, diversity stats). Rejected; the
  two modes keep linking optional but available.

## Revisit when

Standalone entries start needing lifecycle features — progress over time, re-reads,
reviews — at which point they would be converging on engagements and the split should
be reconsidered. Or if "counts toward the goal" becomes a per-entry choice rather than
a structural property of which table a read lives in.
