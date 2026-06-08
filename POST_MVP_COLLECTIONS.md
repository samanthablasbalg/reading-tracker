# Reading Tracker — Collections (Post-MVP Design)

A **design record** for a post-MVP feature, written while the reasoning is fresh.
Nothing here is built yet, and the actual model lands after the MVP (see the
"Library & organization" bucket in `PLANNING.md`). This doc captures *what we
decided and why* so the build later is mechanical.

It follows the same principles as `DATA_MODEL_DECISIONS.md` — especially **store
raw facts, derive labels** and **keep the three axes orthogonal** — and assumes
those as context.

---

## The problem: three features that are secretly one

Three things from other apps are worth porting, and StoryGraph/Goodreads each
treat them as separate, half-finished features:

- **StoryGraph tags** (e.g. `odyssey-subscription`) — a named set of books you can
  slice stats to. But unordered, and with no progress readout.
- **StoryGraph challenges** — a curated set of books with a progress bar ("3 of
  12"). But no stats for the challenge itself, so you end up maintaining a tag
  *and* a challenge for the same books.
- **Goodreads shelves** — a named set of books you can **order** by hand. But no
  progress, no real stats.

The annoyance is maintaining the same set of books in two or three places to get
all three behaviours.

## The reframe: one raw thing, three derived views

Look at what each feature actually *stores* versus what it *shows*:

| Feature | Stored | Shown (derived) |
|---------|--------|-----------------|
| Tag | named set of books | sliced stats |
| Challenge | named set of books | progress "X of N" |
| Shelf | named set of books + order | ordered list |

The stored thing is identical: **a named, ordered set of books.** Everything
else — the progress bar, the sliced stats, the ordered checklist — is *derived*
from that set by reaching into your engagements. StoryGraph forces you to keep a
tag *and* a challenge because it bolted progress onto one feature and stats onto
another. We don't: build the one raw thing, derive all three presentations.

So "tag vs challenge vs shelf" dissolves. There is **one** entity — a
**collection** — and the differences are entirely in *which derived view the UI
renders*, not in what's stored. The UI may surface collections on different pages
with different affordances; the model underneath is one thing.

## Where it sits on the three axes

A collection is a curation of **works** — Axis 1 (the book as concept). Its
progress and stats are *derived* by reaching into Axis 2 (engagements). It stores
no reading status of its own, so it does not violate orthogonality. Same shape as
*book standing*: a derivation that reads across axes without collapsing them.

---

## Entities

### `collections`
| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| name | string | |
| description | text | Optional. |
| starts_on | date + precision | Optional challenge-window start (**fuzzy**, see below). Null = open-ended. |
| ends_on | date + precision | Optional challenge-window end / deadline (**fuzzy**). Null = open-ended. |
| sort_mode | enum | How the UI orders members by default: `manual` (use `position`), `added`, `title`… |
| created_at / updated_at | datetime | Via `TimestampMixin`. |

### `collection_books` (ordered join)
| Field | Type | Notes |
|-------|------|-------|
| collection_id | uuid FK → collections | |
| book_id | uuid FK → books | **Book grain** — points at the work, not an engagement. See below. |
| position | int | Manual (Goodreads-style) ordering. Honored when `sort_mode = manual`. |
| added_at | datetime | System `_at`: when the book was added to the collection. |

Unique constraint on `(collection_id, book_id)` — a book appears once per
collection.

---

## Key decisions

### Membership is at book grain, not engagement grain
The join points at `book_id`, never `engagement_id`. The difference only shows up
on books with zero readings or several:

- **Not-yet-read books.** You build a 2026 challenge in January and add a book
  you've never touched — no `interested`, no `tbr`, nothing. At book grain you
  point at the *book*; done. At engagement grain there'd be nothing to point at,
  so you'd have to fabricate an engagement just to list the book. A challenge that
  can't hold "I might read this" defeats the purpose.
- **Re-reads.** *Circe* read in 2015 (engagement A) and reread in 2026
  (engagement B). At book grain *Circe* is in the collection **once** — it's the
  *work* on the shelf — and "is it done?" is derived across all its engagements.
  At engagement grain you'd have had to pick *which* read is "in the list" back
  when you added it, which is arbitrary (B didn't exist yet).

So membership says "this **work** belongs here," and all reading state is
*derived* by reaching into that book's engagements — the same move as book
standing.

The one case that pulls toward engagement grain — "My Favorite Reads of 2026,
**ranked**," where a reread next year is a separately-ranked entry — is not a
hand-curated list at all. It's a **saved query** (finished engagements in 2026,
sorted by rating) and should be built as one, not as a collection. Collections
stay at book grain.

### Progress and "done" are derived from engagements within the window
A member book is "done" when it has a **finished** engagement that satisfies the
collection's window:

- **No window** (open-ended tag, e.g. Odyssey): any finished engagement counts.
- **Window set**: bucket each member book by its finished engagement's
  `finished_on` relative to `[starts_on, ends_on]`:
  - inside the window → **done on time**
  - after `ends_on` → **done late**
  - before `starts_on` → does **not** count (this is what stops *Circe*'s 2015
    read from marking a 2026 reread-challenge as already complete)

Progress (`done / total`), the on-time/late/unread split, and sliced stats are
**always derived, never stored.** Because progress is free for any collection,
every collection *can* show a "X of N read" readout — challenge affordances aren't
gated behind a type flag; "challenge-ness" is just "has an `ends_on`."

### Nothing is ever stored as "closed" — late completions are a derived bucket
StoryGraph bakes a hard "this challenge ended" state into the data and greys it
out, which is exactly why other people's expired challenges feel dead — you can't
keep going. Here there is **no stored closed/expired state.** "Late" is purely a
derived bucket from comparing `finished_on` to `ends_on`, so finishing a challenge
book after the deadline is a first-class, render-it-in-another-colour outcome. You
can keep working a challenge forever; the progress view natively shows e.g.
"9 of 12 on time · 2 late · 1 unread."

### Window dates are fuzzy `_on` dates — soft vs hard deadlines
`starts_on` / `ends_on` are **fuzzy** (a real `date` plus a `DatePrecision`
companion), fully matching the `_on` convention in `DATA_MODEL_DECISIONS.md`. This
is not uniformity for its own sake: precision carries real meaning here.

- A `day`-precision `ends_on` is a **hard deadline** ("done by 2026-12-31"). The
  UI gives you a picker that forces all three fields.
- A `year`-precision `ends_on` is a **soft deadline** ("read these in 2026,
  whenever") — a real and common kind of reading challenge.

For the bucket comparison, resolve each bound to its **widest** interpretation:

| Precision | `starts_on` resolves to | `ends_on` resolves to |
|-----------|-------------------------|------------------------|
| year | Jan 1 | Dec 31 |
| month | 1st of month | last of month |
| day | itself | itself |

So a `year`-precision 2026 window resolves to `[2026-01-01, 2026-12-31]` — "the
whole of 2026," exactly the soft-challenge intuition. This is the same
precision-aware derivation already used for "languish" durations, so it's not a
new special case.

### `sort_mode` is stored
Whether a collection defaults to manual order, added-date order, title, etc. is a
genuine per-collection preference (Odyssey might always reopen in added-date
order while a hand-ranked shelf stays in `position` order). It's cheap to store
and annoying to recompute as a transient toggle, so it lives on the collection.
The `position` column exists regardless; `sort_mode` decides whether it's honored.

---

## What's stored vs derived (summary)

**Stored (raw facts):** the collection, its name/description, its optional window,
its `sort_mode`, and which books are members in what `position`, added when.

**Derived (never stored):** progress (`done / total`), the on-time/late/unread
buckets, stats sliced to the collection's books, and the lifecycle-aware checklist
(each member shown as finished / reading / tbr / untouched, richer than
StoryGraph's binary done/not-done because engagements carry the full lifecycle).

## How stats slicing works mechanically
Take the collection's member `book_id`s and add `WHERE book_id IN (…)` to the
existing stat aggregations (pages/minutes, pace, ratings, author diversity,
finished counts…). The entire stats-slicing feature is one join — which is the
payoff of book-grain membership.

---

## Status
Design-only. Post-MVP per `PLANNING.md` ("Library & organization"). No open forks
remain; the build is mechanical when its turn comes.
