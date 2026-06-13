# 0007. Progress logs are activities, not positions

- Status: Accepted
- Date: 2026-06-08

## Context

Progress logs hang off an engagement (see [[0005-engagements-lifecycle-entity]]) and
record reading progress over time. The obvious model — the one StoryGraph uses — is to
store a single *current position*: the latest page, or a percent. That conflates
several genuinely different situations into one number and gets them all wrong:

- **Re-reading a section for comprehension** — the position does not advance, but real
  reading happened. A position model shows no progress and can't count the effort.
- **Non-linear reading** — a comics omnibus read out of published order, page numbers
  jumping around. "Latest page" is meaningless as a measure of how far along I am.
- **Audiobooks** — a single current-position scalar can't say *which* part was
  covered, so it can't show where I left off or detect re-listening. This is exactly
  the gap StoryGraph has for audiobooks.

An earlier draft tried to patch the position model with an `out_of_order` flag and
stored audio as a single total-minutes scalar. Both were wrong, for the reasons below.

## Decision

A progress log records **what I did this session — an activity — not where I am now —
a position.**

Each log is a **range**: pages (`page_start`–`page_end`) *or* minutes
(`minute_start`–`minute_end`), tagged **`new_ground`** (`true` = new content, advances
completion; `false` = re-coverage, counts as volume only), plus an optional
`journal_entry` and the activity timestamp `logged_at` that orders the journal
timeline.

- **Pages and minutes are the same kind of object** — a covered interval on a position
  axis — so they take the same shape. An audio position is a timestamp read off the
  player exactly as a page number is read off a book. A **`unit`** (`LogUnit`:
  `pages` / `minutes`) is stored explicitly on each log to say which ruler it used;
  exactly one range pair is populated per row.
- **Completion % is derived**, never stored: cumulative `new_ground` ÷ the
  engagement's total (the per-engagement totals live on the engagement, see
  [[0005-engagements-lifecycle-entity]]), in keeping with
  [[0004-derive-dont-store]]. It is *not* "latest page number."
- **Volume** (pages or minutes read) sums the raw length of every range, re-coverage
  included.

That single `new_ground` distinction replaces the old `out_of_order` flag and handles
all three hard cases without special-casing:

- Re-read for comprehension → re-coverage logs: volume rises, completion stays flat.
- Comics omnibus out of order → all new-ground logs: completion still climbs cleanly
  to 100%; page-number-as-position is simply unused.
- Linear reading → the normal case.

**Why a range, not a scalar:** a current-position scalar can't say which part a
session covered, so it can't drive re-coverage detection, the "where you left off"
pre-fill, or position display — the exact things StoryGraph fails at for audiobooks. A
range costs nothing extra to log (the start pre-fills from the last position; the end
is what the book or player shows now). **`unit` is stored, not inferred** from which
columns are filled: it guards the "exactly one pair populated" invariant, keeps "sum
all my audio time" a clean filter, and leaves room for a future `percent` unit.

### Layer boundary: the table stays dumb

The table stores **dumb, atomic spans** — range + `unit` + `new_ground` +
`journal_entry` + `logged_at` — and nothing more. It knows nothing about percentages
or frontiers. Three further behaviours are **decided**, but they belong in the **API
layer**, computed over these spans rather than baked into the schema:

1. **Frontier-splitting.** A session that re-reads and then continues past my furthest
   point is recorded as *two* rows. For example, if from the frontend I log a session
   whose start page is 30 pages *before* my furthest point and whose end page is 20
   pages *past* it, it becomes two rows: a re-coverage span (`new_ground = false`) for
   the 30 pages re-read, and a new-ground span (`new_ground = true`) for the 20 new
   pages. I log one action; the API splits it at the frontier and writes the two
   atomic rows.
2. **Cross-format inference.** Because page-% and minute-% are two rulers on one
   "fraction of the book" axis, a position logged in one unit can seed the start of a
   session logged in the other (log a page today, "I'm at 3:00" tomorrow). The API does
   the conversion; the table only ever stores real, observed endpoints.
3. **Precision.** A cross-ruler conversion is never quantized through integer percent —
   full precision is carried and rounded once, at the end, to the target unit.

This is a boundary about *where* each decision is enforced, not about what is settled:
the model stays a plain record of what happened, and all interpretation sits above it
in the API. The detailed *algorithms* for these behaviours (and their edge cases) are
implementation, worked out when that API is built — and may earn their own ADR then if
they prove involved.

## Consequences

**Makes easy:**
- Re-reads, non-linear reads, and audiobooks stop being special cases — one shape (a
  tagged range) covers all of them.
- Accurate pace stats (sum of volume) *and* accurate completion (cumulative
  new-ground) at once, from the same logs.
- A single chronological journal timeline (ordered by `logged_at`), re-reads visibly
  included.
- The proportion of a book consumed in each format (see
  [[0006-format-descriptive-set]]) falls out, since each log's `unit` + range converts
  to a percent.
- Audiobook "where you left off" and re-listen detection become possible — the range
  preserves which part was covered.

**What we accept:**
- Completion and volume are both computed from the logs, not stored (read-time cost,
  consistent with [[0004-derive-dont-store]]).
- An invariant must be enforced: exactly one range pair populated, matching `unit`.
- The row carries four nullable position columns (two pairs); only one pair is used
  per log.

## Alternatives considered

- **A single current-position scalar** (latest page / percent) — StoryGraph's model;
  can't represent re-coverage, non-linear reading, or which part of an audiobook was
  covered. The whole reason for this ADR.
- **A single total-minutes scalar for audio** — an earlier draft; a scalar can't say
  which part was covered, breaking re-coverage detection, the pre-fill, and position
  display.
- **An `out_of_order` boolean on a position model** — conflated re-reading, non-linear
  reading, and linear reading into one flag that couldn't keep volume and completion
  both correct. Replaced by `new_ground` on ranges.
- **Infer `unit` from which column pair is non-null** — fragile, can't support a
  future `percent` unit, and makes "sum all audio" depend on column-nullness. Rejected
  in favour of an explicit `unit`.

## Revisit when

A new logging unit is needed beyond pages/minutes — e.g. logging "I'm at 30%" directly
as a `percent` unit. The explicit `unit` column leaves room for it, but adding one is a
real change. Also revisit if the atomic-span model ever needs to store something it
currently derives (e.g. materializing completion for performance) — the same trigger
as [[0004-derive-dont-store]].
