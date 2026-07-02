# 0024. Progress logs are dated to a local day; business dates come from the client

- Status: Accepted
- Date: 2026-06-28

## Context

A progress log records reading over time (see [[0007-progress-logs-activities-not-positions]]).
[[0008-time-modeling-on-vs-at]] classified its `logged_at` as an exact, user-editable activity
_instant_ (a `timestamptz`). In practice that conflates two things the reader cares about
_separately_:

- **Which local day the reading happened** — what gets displayed and grouped by.
- **The order entries appear in** — the sequence within a day and across backdates.

Storing one UTC instant to serve both gets both wrong. The displayed day drifts by timezone: a
session logged at 9pm Pacific is `04:00Z` the _next_ day, so it shows as tomorrow; travelling makes
it worse, because the stored instant carries no record of where the reader was. And ordering
backdated entries forces _synthetic_ timestamps (midnight, or "+1 second after the last entry") that
are pure invention.

The reader never thinks in instants here — they think in days ("I read this on the 28th"), and they
want entries in order. That is what the model should store.

## Decision

### 1. A progress log is dated to a local calendar day

`logged_at` (instant) is replaced by **`logged_on`** — a plain `date`, the reader's _local_ date at
the moment of logging, supplied by the client (the only party that knows where they are). Stored
verbatim, displayed verbatim: no UTC round-trip, no `astimezone`.

Unlike the other `_on` fields in [[0008-time-modeling-on-vs-at]], `logged_on` carries **no
`_precision` companion** — a reading session always happens on a specific day, so it is inherently
day-precision and never fuzzy.

### 2. Canonical order is `(logged_on, created_at)`

Every place that orders or picks the "latest" log uses **`logged_on` ascending, then `created_at`
ascending**. `created_at` is the immutable audit timestamp from the timestamp mixin (see
[[0008-time-modeling-on-vs-at]]); using it as the within-day tiebreaker gives, for free:

- same-day logs in the order they were actually made (creation order);
- a backdated entry after that day's _real_ entries (it was created later, so it sorts later);
- a single deterministic total order that no date edit can corrupt.

This one order drives **every** derived value — completion %, volume, the "where you left off"
pre-fill, cross-format seeding, and the future reflow feature. Because `created_at` is server-set
and monotonic, a client can never corrupt the ordering even if it sends a wrong `logged_on`.

### 3. Business dates come from the client

Generalising the rule that makes the above correct: **the server clock sets only audit timestamps**
(`created_at` / `updated_at` — the `_at` fields). **Every user-facing business date (the `_on`
fields) comes from the client's local date** — `logged_on`, `started_on`, `finished_on`,
`abandoned_on`, and the date of the auto-created completion log written when a book is finished.
Where there is no client (seed scripts, future automation), the server's date is the fallback.

## Consequences

**Makes easy:**

- The logged date is honest in the reader's local frame, including across travel — no conversion, no
  synthetic timestamps.
- Backdating is just setting a past date; ordering falls out of `(logged_on, created_at)`.
- One deterministic chronological timeline, whether for one engagement or across all books (same
  sort key).
- Day granularity sidesteps DST and timezone-instant ambiguity entirely.

**What we accept:**

- The server is no longer the authority on dates; it trusts the client's clock. A misconfigured
  device writes a wrong date undetectably (acceptable for a personal, single-user app).
- Server-side validation against "now" can't be authoritative — the server's UTC "today" may differ
  from the client's local "today" by a day. The client picker constrains future dates; the server
  keeps only a loose sanity bound. **Relative** checks (`finished_on ≥ started_on`, a log not before
  `started_on`, ordering) are unaffected.
- Every dated endpoint gains a date parameter; tests and non-browser callers must supply one or rely
  on the server fallback.
- Intra-day clock times are no longer stored or shown. `created_at` still records true insertion
  order, which is all the ordering needs.
- Within-day _manual_ reordering is not expressible — `created_at` fixes same-day order. Adding a
  user-controlled ordinal later is additive.

This **supersedes in part** [[0007-progress-logs-activities-not-positions]] (which ordered the
journal by `logged_at`) and [[0008-time-modeling-on-vs-at]] (which filed `logged_at` as an exact
activity instant). The activity-instant category in 0008 now applies only to `written_at`.

## Alternatives considered

- **Keep an instant plus the reader's timezone/offset, derive the local day.** More columns, read-
  time math on every access, and it preserves intra-day times we never use — while still requiring
  the client to send its zone. The plain date is simpler and loses nothing we want.
- **Server-stamped dates (the prior model).** Wrong local day for evening or travelling readers, and
  needs invented timestamps to order backdated entries. The defect this ADR removes.
- **An explicit user-controlled ordinal for within-day order** instead of `created_at`. Heavier, and
  manual reordering is not a present need. Parked as additive.

## Revisit when

- Within-day manual reordering becomes a real need — add an ordinal column, backfilled from
  `created_at` order.
- A review's or blog post's `written_at` (or another activity instant) needs the same local-day
  correctness — extend the client-date rule to it.
- The reflow feature lands (recomputing auto-derived continuation `page_start`s when a log is
  inserted or backdated) — it builds on this ordering but is its own design, and the genuinely
  observed starts in [[0007-progress-logs-activities-not-positions]] still never re-flow.
