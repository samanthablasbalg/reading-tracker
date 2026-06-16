# 0020. Currently Reading: cover-led rows, sorted on load

- Status: Accepted
- Date: 2026-06-15

## Context

Currently Reading is the landing surface and the launch point for logging
([[0019-progress-logging-in-a-focused-sheet]]). It holds up to ~11 in-progress books, scanned and
logged on a phone. The walking-skeleton row is five stacked text lines with no cover — slow to tell
apart and visually flat.

Two things need deciding: what a row shows at rest, and how the list orders itself. The ordering has
a real tension — wanting the most active reads at the top on open, while also logging several books
in one session without the list rearranging underfoot.

## Decision

**A row is cover-led:** `cover · title · author · format icon · progress bar/%`.

- The **cover is the primary identifier** — visual recognition is faster than reading titles across
  ~11 books, especially near-identical series/comics siblings. It uses the per-read cover
  ([[0009-origin-per-read-isbn-provisional]]), falling back to the book default.
- A **format icon** is shown because format is first-class ([[0006-format-descriptive-set]]) and an
  audiobook vs. a print copy of the same title are different reads.
- **Completion is derived** ([[0004-derive-dont-store]],
  [[0007-progress-logs-activities-not-positions]]), shown as a bar + %.
- **Not on the row:** the resume position (it lives in the logging sheet, where it's needed —
  [[0019-progress-logging-in-a-focused-sheet]]) and the started-on date (low value at rest;
  trivially re-addable).

**Ordering is most-recent-activity, computed on load, stable within a session.**

- Sort key is most recent activity — `max(latest log date, started_on)` — so a just-started book
  with no logs still sorts to the top rather than the bottom (exact tiebreak is implementation).
- The order is computed when the list is _fetched_. Logging a progress update mutates that row **in
  place** and does **not** re-sort the live list; the next load re-sorts. So active reads rise to
  the top on open, but the list never shifts under your thumb mid-burst.

**The landing route is a thin shell** that today renders only the Currently Reading list, so a
future home page (challenge tracker, up-next queue, charts) is additive — more sections, not a
rewrite.

## Consequences

**Makes easy:**

- Fast visual scan-and-launch across many books.
- Burst logging without the list rearranging between entries.
- An additive path to a richer home page, and (via Material's `--mat-sys-*` system tokens under the
  stock dark theme) an additive path to a light mode later.

**What we accept:**

- The visible order can be "stale" relative to what you just logged until a reload — intended, and
  the point of the stability.
- Completion is computed per render, not stored ([[0004-derive-dont-store]]).

## Alternatives considered

- **Horizontal cover carousel** (showing ~3, rest behind "view all") — fine for a few current reads,
  but hides most of an 11-book list and makes burst logging a scavenger hunt. Rejected.
- **Live re-sort on each log** — keeps the order fresh, but rearranges the list under the user
  mid-session. Rejected in favour of sort-on-load.
- **Text-only rows** (the walking-skeleton shape) — slow to distinguish near-identical titles at a
  glance. Rejected for the cover-led row.

## Revisit when

The landing page grows beyond the Currently Reading list (the shell gains real widgets), or the
in-progress count grows large enough that a flat sorted list needs grouping, filtering, or search.
