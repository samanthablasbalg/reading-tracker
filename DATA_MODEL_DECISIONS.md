# Reading Tracker — Data Model Decisions

This is a **decisions record**: the resolved output of the conversation captured in
`DESIGN_DISCUSSION.md`. That file held the open questions; this file holds what we
decided and *why*. Where this file and `PLANNING.md` disagree, **this file wins**
(`PLANNING.md` has been reconciled to match).

The whole design exists to fix one thing StoryGraph gets catastrophically wrong, so
it's worth stating the failure first.

---

## The core idea: one book lives on independent axes

StoryGraph has a single knob — *status, attached to an edition* — and forces that
one knob to do three unrelated jobs: say what the book *is*, whether you've *read*
it, and whether you *own* it. Because one field can't be three things, the field is
always lying: a re-read flips a finished book to "to read"; a DNF edition pollutes
your stats and surfaces first in search; an owned-but-unread copy masquerades as a
reading status; there is no high-level "the book itself" at all.

Our fix is to refuse the collapse. **A book sits on three independent axes**, and
each gets its own home:

1. **The book as a concept** *(what it is)* — the abstract work. Its overall
   **standing** ("read & loved · reread queued · 2 copies owned") is **derived**,
   never stored.
2. **Reading it** *(my experiences of it)* — engagements, progress logs, reviews.
3. **Owning it** *(my copies)* — owned copies, each with its own ownership
   lifecycle, entirely separate from whether/how the book was read.

---

## Cross-cutting principles

These rules recur throughout the model and should guide future tables too:

1. **Store raw facts; derive labels.** Anything that can change while the
   underlying facts don't — "Bought this year," completion %, book standing,
   re-read number — is *computed*, never stored. (Same instinct already in the
   project: raw pages → derived percent; `tbr_added_on` as a real fact rather than
   reusing `created_at`.)
2. **Keep the three axes orthogonal.** A copy has no *reading* status; a read is
   not a *possession*; the book's standing is a *derivation* of the other two.
3. **Format is descriptive (a set), decoupled from input unit.** What you call the
   read and what unit you log in are independent.
4. **A progress log is an activity, not a position.** "What I did this session,"
   not "where I am now."
5. **User-set dates are fuzzy by design.** Every business date you enter (`_on`)
   is stored as a real `date` *plus* a `DatePrecision` (`day` / `month` / `year`),
   so "read it in 1994" is first-class. The date stays sortable/queryable; the
   precision says how much of it is real. Both the value and how precise it is are
   raw facts. System datetimes (`_at`) are always exact and never carry precision.

---

## Entities

### `books` *(already built)*
The abstract work — title, authors (via `book_authors`), series, genres, Google
Books data, default cover / page count / audio minutes. Edition-agnostic. Shared
reference data; carries no reading or ownership status.

### `authors` *(already built)*
Diversity attributes live here once and are inherited by all the author's books for
stats. `nationality` → `places` reference table still deferred.

### `engagements` *(new — the heart of the redesign)*
**One row per engagement with a book**, spanning the entire lifecycle:
`interested → tbr → reading → paused → finished → dnf`.

- A **vague wish** ("reread *Circe* someday") is just a row in `interested` with
  almost everything else null — so wishes get tracked and not forgotten.
- The **happy path** is a single row walking the whole track; it genuinely feels
  like one continuous thing.
- Each **re-read is a new row**; the old finished row is never touched. (You told
  me even re-reading the same physical copy feels like a separate thing — so reads
  are independent entities, not states of one record.)
- A wish becoming a real read is a **status change on one row**, not a move between
  tables — the main reason this is *one* well-named entity, not two.
- Each engagement is **independently rateable and reviewable**, including re-reads
  of the same edition.
- Carries: `status`, `formats` (a **set**), `origin`, `acquired_on`, the four
  status-transition dates (`interested_on`, `tbr_added_on`, `started_on`,
  `finished_on`), and the per-engagement totals (`custom_page_count`,
  `custom_audio_minutes`) needed to convert page/minute logs into percent.
- `origin` and `acquired_on` are **per-read facts** ("where the copy I read
  *this time* came from," and when I got it), so they stay here permanently — not
  provisionally. See *Origin is a per-read fact, not an ownership concept*.
- The date fields are **status-transition dates**, each an editable, fuzzy
  business date (a `date` + a `DatePrecision`; suffix `_on`): `interested_on`
  (entered `interested` — discovery), `tbr_added_on` (entered `tbr` —
  prioritised), `started_on` (entered `reading`), `finished_on`. Any can be null
  when an engagement skips that phase (a spontaneous read has no `interested_on`).
- **`reread_number` is dropped** — it's derivable (count of prior finished
  engagements + 1).
- **No duration is stored.** The "how long did this book languish before I read
  it" gaps are *derived* by subtracting these dates (discovery → start =
  `started_on − interested_on`), inheriting the coarser operand's precision. See
  *Discovery date is derived, not stored*.

### `progress_logs` *(reshaped)*
A log records **what you did this session** — a volume of pages (as a **range**) or
minutes — tagged **new-ground vs re-coverage**, plus an optional journal entry and a
timestamp.

- **Volume** (pages/minutes) is a first-class fact on every log → always sums into
  page/minute totals and the "you read X today" pace stat. Always correct.
- **Completion %** is *derived* as cumulative new-ground ÷ total — **not** from
  "latest page number."
- Page input is a **range** (`page_start`–`page_end`), which costs nothing extra
  and later unlocks coverage maps and automatic re-coverage detection.
- All logs ordered by time give the single visual journal timeline, re-reads
  included and visibly flagged.

### `reviews`
One review per **engagement** → a separate review per re-read, which StoryGraph
cannot do.

### `standalone_entries`
For logging reads that must **not** count toward the annual book goal: book-less or
uncollected material — short stories, articles, fanfic, and comics not yet
published in any collection. Linked mode (points at a `book`) or manual mode
(free-text title/author).

### `owned_copies` *(deferred, but conceptually real — Axis 3)*
Possessions with their **own** lifecycle: `owned → kept / sold / donated / given
away / lost`. A copy has **no reading status**. An engagement may point at the
copy it used. This is the home of **ISBN** and of a *possession's* own
acquisition record — which is **not** the same as a read's `origin`. A read's
source (libby, library, borrowed, purchased…) lives on the engagement and applies
to every read, owned or not; only books you actually keep ever become
`owned_copies`. See *Origin is a per-read fact, not an ownership concept*.

### Book standing *(derived — not a table)*
Computed from a book's engagements + copies: which finished read represents it, a
queued re-read shown as secondary, copies owned — and a DNF never masquerading as
the book's face.

---

## Worked scenarios (these double as test cases for the schema)

### Death of the Author — copies ≠ reads ≠ standing
TBR'd format-agnostically; bought the audiobook on sale; later gifted the hardcover;
read the audiobook to completion and reviewed it; hardcover sits unread.
- **One engagement**: `tbr` (format-agnostic) → `finished` via audio, rated,
  reviewed, pointing at the audiobook copy.
- **Two owned copies**: audiobook (purchased) and hardcover (gift).
- The hardcover has **no reading status** — it's `owned`, maybe later `donated`. It
  was never in "TBR," so it can't get stuck there.
- Book is **read once, owned twice.** Two copies are not two reads.

### A Desolation Called Peace — one engagement, mixed units, re-reads
Audiobook with a partner; got lost at 14%, read that section in the library ebook;
listened on; lost again ~60%, re-read 28 pages; near the end re-read ~30 pages.
- **One engagement**, finished. `formats` = {audio, digital}.
- Forward listening = new-ground minute logs. Each ebook re-read = a **re-coverage**
  page log: volume counts toward totals, completion stays flat.
- All pages + minutes counted; one journal timeline; **no second edition, no fake
  DNF.**

### Comics omnibus — non-linear but all new ground
Read pages 1–150, jump to 300–350, back to 151… The page numbers are non-monotonic
but every page is new content read once.
- Every log is **new-ground** (out of page order). Completion = cumulative
  new-ground ÷ total still climbs cleanly to 100%; page-number-as-position is simply
  not used. (How to *display* this is a deferred UI problem; the page-range data
  preserves enough to build a coverage map later.)

### Immersive reading (Nicola Griffith) — genuine combo
Listening while following a physical book, plus a separate ebook before bed.
- **One engagement**, `formats` = {audio, print, digital}. Log the immersive
  sessions in **minutes** (you were mostly listening) and the bedtime sessions in
  **pages** — the shared percent stitches them into one position line.

### Series with a partner — format known at TBR stage
A series listened to as audiobooks together from the start. Format is known and
intentional before reading begins.
- **One engagement per book**, created at `interested` or `tbr` with `formats` =
  {audio} already set. Format is optional early — it can be set whenever it's known,
  not only when reading starts.
- Demonstrates that `formats` being an editable set (not a required field) is the
  right design: known early when you know early, left empty when you don't.

### Circe — deliberate re-read in a different format
Read as an audiobook years ago. Now want to re-read in print specifically. Adding
to TBR with a specific format in mind, separate from the original read.
- **Two engagements**: the old one (`finished`, `formats` = {audio}), and a new one
  (`tbr`, `formats` = {print}) for the planned re-read.
- The old engagement is never touched. The new one starts its own lifecycle
  independently.
- Demonstrates that re-reads are new rows, not updates to existing ones, and that
  format intent can be captured at the `tbr` stage.

---

## Resolved follow-up decisions

### Origin is a per-read fact, not an ownership concept
`origin` ("where did the copy I read *this time* come from" — libby, the library,
a friend's loan, a purchase, a gift, an ARC) and `acquired_on` ("when I got it")
apply to **every** read. Most sources — libby, the library, a borrowed book —
never produce a copy you own, so these facts cannot live in `owned_copies`. They
are properties of the **engagement** and stay there permanently. The earlier plan
to "move them to `owned_copies`" conflated two axes that merely share vocabulary:

- **Source of a read** → `engagement.origin` / `acquired_on`. Applies to all reads.
- **Acquisition of a possession** → `owned_copies` (how *that copy* was acquired,
  plus its lifecycle: kept/sold/donated/lost). Owned books only.

The same book can carry a different `origin` per engagement (borrowed once, bought
the next time) — which is the proof it's per-read, not per-book and not per-copy.
`owned_copies` is not a misnomer; it's a genuine separate axis (Axis 3). It was
just the wrong home for read-origin. Only `isbn` is genuinely
edition/ownership-flavoured and waits for `owned_copies`.

### Discovery date is derived, not stored
"How long did this book languish before I read it" is a **derived duration**,
never a stored one. What we store are the editable status-transition *dates*; the
gaps are differences between them:

    discovery → start    = first_engagement.started_on − first_engagement.interested_on
    prioritised → start  = first_engagement.started_on − first_engagement.tbr_added_on
    acquired → start     = first_engagement.started_on − first_engagement.acquired_on

Three genuinely different early moments are kept, because they answer different
questions and "keep all the data" wins:

- **`interested_on`** — entered `interested`; first hit my radar. *This is
  discovery.*
- **`tbr_added_on`** — entered `tbr`; I committed to reading it.
- **`acquired_on`** — I got the copy (unrelated to either: you can be interested
  for a year before acquiring, and a library loan is acquired the day you start).

Each is an editable, fuzzy business date (see principle 5 — a `date` plus a
`DatePrecision`), nullable when an engagement skips that phase. A spontaneous read
or re-read may have no `interested_on` or `tbr_added_on`, in which case that gap
simply doesn't exist — the honest answer. Only the durations are computed,
consistent with *store raw facts; derive labels*, and they inherit the coarser
operand's precision (discovered "1994", started "1994" → "about a year").

No per-book table is needed. It would be justified only if a book could sit in
your world with a discovery date but **no** engagement — and it can't:
`interested` and `tbr` *are* engagements, so the first engagement always exists to
host `interested_on`. "Books in **my** library" is likewise a *derivation* (the
set of books you have any engagement with), which keeps `books` purely
bibliographic and user-agnostic **without** a personal per-book table.

---

## Open / deferred decisions

1. **`owned_copies` build timing.** Defer the table to post-MVP. Note that
   `origin` / `acquired_on` are **not** waiting on it — they are per-read facts
   and stay on `engagements` permanently (see *Origin is a per-read fact, not an
   ownership concept*). Only `isbn` sits on `engagements` provisionally; because
   it's a stored raw fact, lifting it onto `owned_copies` later is a cheap
   migration.
2. **ISBN final home** — `owned_copies`, once it exists. Until then it lives on
   `engagements`; you only care about ISBN for a copy you actually own.
3. **`reread_number`** — confirmed derived; the stored column is dropped.
4. **`places` reference table** (author nationality + book settings) and **genres
   reference table** — unchanged from before; still deferred, still no real data
   until designed.

---

## Implementation consequences to handle when writing models

- `enums.py` `ReadingFormat` no longer includes `combo` (**done** — removed).
  Under the **format-as-set** decision, "combo" is just a set with more than one
  member, so it is not a stored value.
- `ReadingStatus` already covers the lifecycle (`interested, tbr, reading, paused,
  finished, dnf`) and is reused as-is on `engagements`.
- The old single `reading_sessions` table is replaced by `engagements`; FKs on
  `progress_logs` and `reviews` point at `engagements`.
- On `engagements`, `origin` and `acquired_on` are **permanent** columns; `isbn`
  is **provisional** (moves to `owned_copies` later).
- The editable status-transition dates use the `_on` suffix and are **fuzzy**: a
  `date` column plus a `DatePrecision` companion (`*_on_precision`). They are
  `interested_on`, `tbr_added_on`, `started_on`, `finished_on` (and `acquired_on`,
  and `read_on` on `standalone_entries`). System datetimes keep `_at`
  (`created_at`, `updated_at`, `logged_at`, `written_at`) and need no precision.
  No duration column exists — all "languish" gaps are derived by subtracting dates.
- `DatePrecision` enum (`day` / `month` / `year`) has been added to `enums.py`
  (**done**); the `default day` lives on each model column, not the enum.
