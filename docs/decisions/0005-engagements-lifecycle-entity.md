# 0005. Engagements: one lifecycle entity per read

- Status: Accepted
- Date: 2026-06-08

## Context

Axis 2 — *reading it* — needs a home (see [[0003-three-independent-axes]]). This is
where my personal relationship to a book lives, kept off the shared, user-agnostic
book record (see [[0002-books-are-user-agnostic]]).

A reading experience is not a single moment. It runs a lifecycle — I get
*interested*, add it to the *TBR*, start *reading*, sometimes *pause*, then *finish*
or give up (*DNF*). And a book can be experienced more than once: a re-read is a real
thing, distinct from the first read — even re-reading the same physical copy is a
separate experience, with its own pace, notes, and verdict. The model has to hold all
of that: vague wishes, the happy single-pass read, pauses, abandonment, and
independent re-reads — none of which a status-on-an-edition can represent.

## Decision

Model **one row per *engagement*** — a single experience of a book — and let that one
row span the **whole lifecycle** via a `status` enum:
`interested`, `tbr`, `reading`, `finished`, `paused`, `dnf`. The happy path runs
`interested → tbr → reading → finished`; `paused` and `dnf` are branches off it
(pause and resume, or give up partway).

The shape of the decision:

- **A wish is just a row.** "Reread *Circe* someday" is a row in `interested` with
  almost everything else null — so wishes are tracked, not forgotten.
- **The happy path is one row** walking the track from `interested` to `finished`. It
  genuinely feels like one continuous thing, because it is one row.
- **A wish becoming a real read is a status change**, not a move between tables. This
  is the central reason it is *one* well-named entity rather than separate
  `wishlist` / `currently_reading` / `finished` tables: the thing keeps its identity
  and history as it advances.
- **Each re-read is a new row.** The old finished row is *never* mutated. Reads are
  independent entities, not states of a single record — which is what lets each
  re-read carry its own progress logs, rating, and review (something a single
  edition-status cannot do).

The row stores **raw facts**: `status`, `formats` (which formats the book was read
in), the status-transition dates, the per-read source facts (`origin`,
`acquired_on`), and the per-engagement totals (`custom_page_count`,
`custom_audio_minutes`) used to convert progress into a percentage. It deliberately
does **not** store `reread_number` (derived — count of prior finished engagements + 1)
or any "how long did it languish" duration (derived from the dates), per
[[0004-derive-dont-store]].

## Consequences

**Makes easy:**
- Wishes, TBR, pauses, DNFs, and re-reads all fall out of one `status` enum on
  independent rows — no special tables, no special cases.
- Per-experience reviews, ratings, and progress logs, including a separate verdict
  for each re-read.
- Advancing a wish to a real read is a single field update — no data migration.

**What we accept:**
- "The book's current state" is now a question *across* possibly many engagement
  rows — it is derived standing, not a column (see [[0003-three-independent-axes]],
  [[0004-derive-dont-store]]).
- Early rows are nullable-heavy: a wish has almost everything null, so the schema and
  validation must allow a mostly-empty engagement.

## Alternatives considered

- **Status on the edition / book** (StoryGraph's model) — can't represent re-reads, a
  DNF that doesn't pollute, or a wish; the collapse [[0003-three-independent-axes]]
  exists to reject.
- **Separate tables per phase** (`wishlist`, `currently_reading`, `finished`) — every
  status change becomes a cross-table delete-and-reinsert that loses the row's
  identity and history, and re-reads still need duplication. One entity with a status
  enum is simpler and keeps identity intact across the lifecycle.
- **One read row mutated in place across re-reads** (bump a counter, overwrite the
  dates) — destroys each prior read's history and makes per-read reviews impossible.
  Rejected: reads are independent things, not overwrites of one.

## Revisit when

The `status` enum is the entire vocabulary of the lifecycle. Revisit if an experience
ever needs to be in two lifecycle states at once, or if pause/resume has to become a
logged **history of intervals** (multiple distinct pauses with their own dates) rather
than the single current `status` it is today.
