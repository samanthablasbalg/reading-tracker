# 0019. Progress logging happens in a focused sheet

- Status: Accepted
- Date: 2026-06-15

## Context

Daily progress logging is the app's primary action: on a phone, across up to ~11 in-progress books
at once, in bursts of variable size (sometimes one book, sometimes several in a sitting). The
walking-skeleton implementation (issue #23) puts a raw number input and a button _inline in each
Currently Reading row_ — deliberately the thinnest thing that works, not the intended interaction.

Moving to MVP, the logging interaction has to be fast but hard to fumble. Two existing apps frame
the choice: a focused, slide-up logging sheet (liked) versus a small popover anchored to an edit
icon that overlaps surrounding content, with notes and date edits each exiled to a _separate screen_
(disliked — the round trips are the whole complaint).

A log is an activity record ([[0007-progress-logs-activities-not-positions]]), its input unit
depends on format ([[0006-format-descriptive-set]]), and "I finished" is a state change
([[0016-engagement-state-changes]]) — so the surface that captures a log also has to host a date, a
format-aware input, and a finish action.

## Decision

Logging happens in a **focused sheet that temporarily owns the screen** — `MatBottomSheet` on
mobile, `MatDialog` on web — launched from a Currently Reading row. Not inline in the row, and not a
separate per-book page.

The sheet shows, in one surface:

- **Which book** — cover + title, so the target is unambiguous.
- **A format-aware position input** — page number or `HH:MM`, per the engagement's format
  ([[0006-format-descriptive-set]]); it pre-fills the last position so the start of the range is
  known ([[0007-progress-logs-activities-not-positions]]).
- **The date** — default today, with an "edit yesterday" escape hatch (the UI home for
  backdated-but-still-latest logs).
- **Primary `Save`** and **secondary `I finished the book`** ([[0016-engagement-state-changes]]).

Per-log notes are deferred but **additive** — a log already owns a `journal_entry`
([[0007-progress-logs-activities-not-positions]]), so notes later are one more field in the same
sheet, not a restructure.

## Consequences

**Makes easy:**

- One surface absorbs date, finish, and later notes — structurally avoiding the disliked app's
  screen-to-screen ping-pong for those operations.
- Large touch targets on a phone reduce mis-entry versus an inline or anchored-popover field.
- A natural, single home for the format-aware input and the last-position pre-fill that
  [[0006-format-descriptive-set]] and [[0007-progress-logs-activities-not-positions]] imply.

**What we accept:**

- A sheet open/save cycle is heavier than a one-tap inline field, and a burst of N logs is N cycles.
  Mitigated by a stable list order during a session (see 0020), so books don't move between cycles.

## Alternatives considered

- **Inline input in each row** (the walking-skeleton shape, and the disliked app's cramped anchored
  field) — small targets, easy mis-taps, and no room for date/finish without crowding the row.
  Rejected for the primary action.
- **A separate per-book detail page** — forces navigation away from the list and back per log, the
  exact round-tripping the disliked app is faulted for. Rejected.

## Revisit when

The sheet accretes enough fields that it stops being focused, or a genuinely faster bulk-logging
flow (e.g. log several books without reopening) becomes worth the complexity.
