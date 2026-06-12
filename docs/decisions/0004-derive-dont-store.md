# 0004. Store raw facts, derive labels

- Status: Accepted
- Date: 2026-06-08

## Context

Many of the most useful things to show about a book are not facts I record — they
are *interpretations* that can change even when nothing I entered changed:

- "Bought this year" flips to false on January 1, with no new input.
- Completion % shifts if I correct a book's page count.
- A re-read's number changes if I later log an earlier read I'd forgotten.
- A book's standing changes every time I add an engagement or a copy.

If any of these were stored, the stored value would silently drift out of sync with
the facts it was computed from, and every write would have to fan out to keep it
current. The instinct was already in the project before it was named: progress is
logged as raw pages and *shown* as a derived percent, and `tbr_added_on` is a real
entered date rather than a reuse of the row's `created_at`.

## Decision

Store only **raw, observed facts** — the things I actually entered or that were
actually recorded (a page range I read, a date I set, a status I chose). **Derive
every label, aggregate, and interpretation at read time**, never persisting it as a
second source of truth.

The test for which is which: a value is a **raw fact** if it changes only when
reality changes and I record it; it is a **label** if it can flip with no new input
from me — time passing, a correction to an underlying number, or another row being
added. Labels are always derived.

Canonical derivations in this model:

- **Completion %** — cumulative new-ground ÷ total, computed from the logs; never a
  stored column.
- **Book standing** — a function of a book's engagements and copies, not a field on
  `books` (it is the derivation *of* the other two axes; see
  [[0003-three-independent-axes]]).
- **"In my library"** — the existence of any engagement with the book, not a stored
  membership flag. This is also what keeps the book record user-agnostic; see
  [[0002-books-are-user-agnostic]].
- **Re-read number** — count of prior finished engagements + 1.
- **"Languish" durations** — differences between the editable status-transition
  dates, never a stored duration.
- **"Bought this year" / "sat on the shelf a while"** — derived from `acquired_on`
  against today.

## Consequences

**Makes easy:**
- No staleness and no update fan-out: correct one raw fact and every derived view is
  instantly right.
- One source of truth per fact — no reconciling a stored summary against the rows it
  summarizes.
- New interpretations are cheap: a new stat is a new query, not a migration plus a
  backfill of a new column.

**What we accept:**
- Derivations cost compute at read time, and some need their inputs on hand
  (completion % needs the engagement's page / minute totals).
- More logic lives in the query / API layer than in stored columns.

## Alternatives considered

- **Store the derived values (denormalize)** — simplest to read, but they drift the
  moment an underlying fact changes or time passes, and every write must fan out to
  keep them current. The drift is silent and corrupting; rejected.
- **Store *and* cache / materialize derived values up front** — same staleness-
  management burden, paid eagerly; premature optimization with no measured need.

## Revisit when

A specific derivation becomes a **measured** performance bottleneck — e.g. computing
standing across a large library on every list render. Then cache or materialize *that
one* derivation deliberately, with the raw facts still the single source of truth and
the cache rebuilt from them, never edited directly.
