# Reading Tracker — Project Planning Document

## Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Angular | Responsive web app, PWA later |
| Backend | Python + FastAPI | REST API |
| Database | PostgreSQL 18 | Hosted locally in dev, managed in prod |
| ORM | SQLAlchemy + Alembic | Migrations version-controlled |
| Deployment | Railway / Render | ~$5–15/month |

---

## MVP Scope

1. What books am I reading today?
2. What books have I read in the past?
3. Log daily progress entries for books currently being read
4. Add new books to the library with minimal manual effort (via Google Books API)

Everything else is post-MVP.

---

## Data Model

All tables include `created_at: datetime` and `updated_at: datetime`, managed
automatically by the ORM via a shared `TimestampMixin`. These are infrastructure
metadata (when the row was created/last modified in the system) and are never
directly edited by the user. See Key Design Decisions for details.

> **Note:** The reading-lifecycle portion of this model (`engagements`,
> `progress_logs`, `standalone_entries`, `reviews`, and the future `owned_copies`)
> was redesigned. `DATA_MODEL_DECISIONS.md` is the authoritative record of those
> decisions and the reasoning behind them; the tables below have been reconciled to
> match it.

### `authors`
| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| name | string | |
| nationality | string | |
| gender_identity | string | |
| other_attributes | string[] | Extensible diversity fields (JSON or key-value table later) |
| google_books_id | string | |

### `books`
| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| title | string | |
| google_books_id | string | |
| original_language | string | ISO 639-1 code where available; plain string otherwise; nullable |
| default_cover_url | string | Overrideable at session level |
| default_page_count | int | Overrideable at session level |
| default_audio_minutes | int | Overrideable at session level |
| genres | string[] | Auto-filled from Google Books, editable |
| series | string | |
| series_position | int | |
| publication_date | date | Fuzzy — Google Books returns year-only or year-month formats |
| publication_date_precision | enum | day / month / year |

### `book_sources`
A user-extensible reference table for where a book copy came from. Seeded with
initial values; new entries can be added from the UI without a schema migration.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| name | string | e.g. "libby", "gift", "libro.fm" |

Initial seed values: audible, gift, kindle store, libby, library, libro.fm,
project gutenberg, book store.

### `book_authors` (join table)
| Field | Type | Notes |
|-------|------|-------|
| book_id | uuid FK → books | |
| author_id | uuid FK → authors | |
| role | enum | author, illustrator, narrator, colorist, letterer, inker, editor — extensible |

### `engagements`

> Renamed and reshaped from the original `reading_sessions`. One row per
> *engagement* with a book, spanning the whole lifecycle from first interest to
> finishing or abandoning. See `DATA_MODEL_DECISIONS.md` for the full rationale.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| book_id | uuid FK → books | |
| status | enum | interested, tbr, reading, paused, finished, dnf |
| formats | enum[] | Set of formats actually used (print/digital/audio). "Combo" = more than one. May be empty early. |
| isbn | string | Edition identifier. **Provisional** home; moves to `owned_copies` once it exists — you only care about ISBN for a copy you own. |
| cover_url | string | Overrides book default if set |
| custom_page_count | int | null = use book default. Per-engagement total for page→percent conversion. |
| custom_audio_minutes | int | null = use book default. Per-engagement total for minute→percent conversion. |
| origin | enum | **Source of this read**: libby, library, borrowed, purchased, gift, arc… A *per-read* fact (every read has one, owned or not), so it stays here **permanently** — not an ownership concept. See Key Design Decisions. |
| acquired_on | date + precision | When the copy used for *this read* was obtained. Per-read raw fact; stays here permanently. "Bought vs on-shelf" is derived. |
| interested_on | date + precision | Entered `interested` — when it first hit my radar (**discovery**). Editable; null if the engagement skipped the interested phase. |
| tbr_added_on | date + precision | Entered `tbr` (prioritised); null for spontaneous reads/re-reads. Editable, defaults to today at the API layer. |
| started_on | date + precision | Entered `reading`. |
| finished_on | date + precision | Finished (or DNF'd). |

Every `date + precision` field is a **fuzzy date**: a real `date` column plus a
companion precision column (`<field>_precision`, a `DatePrecision` of `day` /
`month` / `year`, default `day`). This lets "read it in 1994" be stored as
`1994-01-01` + `year` and shown as just "1994," while staying sortable. See
*Fuzzy dates* under Key Design Decisions.

**Removed from the old design:** `reread_number` (now *derived* — count of prior
finished engagements + 1) and the single `format` enum (replaced by the `formats`
set).

### `progress_logs`

> Reshaped: a log is an *activity* ("what I did this session"), not a *position*
> ("where I am now"). See `DATA_MODEL_DECISIONS.md`.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| engagement_id | uuid FK → engagements | |
| logged_at | datetime | **When the session happened** — orders the journal/activity timeline. User-editable/backdatable (the "edit date" affordance), unlike `created_at` (row insert time). Exact `_at`, not fuzzy. See *Timestamps* in Key Design Decisions. |
| unit | enum (`LogUnit`) | `pages` or `minutes` — which axis (ruler) this log measures. Stored explicitly, per-log. See *Progress logs: symmetric page/minute ranges*. |
| page_start | int | Page logs: first page covered this session. Null on minute logs. |
| page_end | int | Page logs: last page covered; volume = end − start + 1. Null on minute logs. |
| minute_start | int | Audio logs: start position in whole minutes (HH:MM display). Null on page logs. |
| minute_end | int | Audio logs: end position; volume = end − start. Null on page logs. |
| new_ground | boolean | true = new content (advances completion); false = re-coverage (volume only). Default true. |
| journal_entry | text | Optional notes/quotes; feeds review writing later. |

Completion % is **derived** as cumulative new-ground ÷ total (never stored as a
source of truth). Daily "pages/minutes read" stats sum the raw volume of every
log, re-reads included.

### `standalone_entries`

For logging reads that should **not** count toward the annual book goal: book-less
or uncollected material — short stories, articles, fanfic, and comics not yet
published in any collection. Two modes (linked / manual) below.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| book_id | uuid FK → books | null if manual mode |
| author_id | uuid FK → authors | null if linked to book |
| manual_title | string | null if linked to book |
| manual_author | string | null if linked to book |
| read_on | date + precision | Fuzzy date (see *Fuzzy dates*); e.g. a story read "in 1994". |
| pages_read | int | |
| minutes_listened | int | |
| notes | text | |

**Two modes:**
- **Linked mode:** book_id is set; title, author, cover inherited from book record
- **Manual mode:** book_id is null; fill in manual_title/manual_author for things not in any published book

### `reviews`
| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| engagement_id | uuid FK → engagements | One review per engagement = separate review per re-read |
| rating | int | |
| body | text | |
| published | boolean | Draft vs published |
| written_at | timestamp | |

### `blog_posts`
| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| title | string | |
| body | text | |
| published | boolean | |
| written_at | timestamp | |

**Note:** A `blog_post_sessions` many-to-many join table will be added later, linking blog posts to the reading sessions they cover.

---

## Key Design Decisions

### One book lives on three independent axes
The biggest decision in the model: a book is not a single status. It sits on three
axes that must never be collapsed into one (collapsing them is StoryGraph's core
flaw):

1. **The book as a concept** — the abstract work (`books`). Its overall "standing"
   ("read & loved · reread queued · 2 copies owned") is **derived**, never stored.
2. **Reading it** — `engagements` (each experience), `progress_logs`, `reviews`.
3. **Owning it** — `owned_copies` (possessions, with their own ownership lifecycle).

A book is the abstract work; an *engagement* is one specific experience of it —
format(s), dates, progress, review. This supports re-reads (separate engagements,
reviews, and logs), multiple formats, and per-engagement custom page counts. See
`DATA_MODEL_DECISIONS.md` for the full reasoning and worked examples.

### Audio progress storage
Stored as a **range** of whole minutes (`minute_start`–`minute_end`), the same shape
as page ranges, because audio position is a timestamp on the same axis a page number
sits on. `01:15` = `75`; display logic converts to/from HH:MM. See *Progress logs:
symmetric page/minute ranges* for why a range (not a single scalar) and how
cross-format conversion works.

### Format is a set, decoupled from logging unit
`formats` on an engagement is a *set* of the formats actually used. "Combo" is not a
special value — it just means the set has more than one entry (e.g. audio +
digital), which keeps format-breakdown stats accurate.

Format does **not** gate logging: any engagement can have both page and minute logs.
The logging *unit* lives on each `progress_log`, not on the engagement.
`progress_percent` is the universal currency — page ranges and minute ranges both
convert to percent via the engagement's known totals — but it is *derived* from cumulative
new-ground, not a stored source of truth. Daily "pages/minutes read" come from
summing the raw volume on each log, so re-reads and non-linear reads never corrupt
them.

### Progress logs are activities, not positions
A log records *what you did this session* — a range of pages or of minutes — tagged
`new_ground` (new content, advances completion) or not
(re-coverage, counts as volume only). This single distinction handles three cases
the old `out_of_order` flag conflated:

- **Re-reading for comprehension** — volume rises, completion stays flat.
- **Non-linear reading** (comics omnibus read out of published order) — all new
  ground, completion still climbs to 100%; page-number-as-position is simply unused.
- **Linear reading** — the normal case.

Because completion is derived from cumulative new-ground (not "latest page number")
and pace stats sum raw volume (not position deltas), both hard cases stop being
special.

### Progress logs: symmetric page/minute ranges, and cross-format inference
Pages and minutes are the **same kind of object** — a covered interval on a position
axis — so they get the same shape: a range (`page_start`–`page_end` or
`minute_start`–`minute_end`), with `unit` saying which axis a given log used. Volume
(`end − start`) and the completion contribution both *derive* from the range.

Audio position is a timestamp you read straight off your player (`5:42 / 14:43`),
exactly the way a page number is a position you read off the book — so logging a
minute range costs nothing extra (the end is on screen; the start pre-fills from
where you left off). An earlier draft stored audio as a single total-minutes scalar;
that was wrong. A scalar can't say *which* part of the audio a session covered, so it
can't drive re-coverage detection, the "where you left off" pre-fill, or position
display — the exact thing StoryGraph fails to show for audiobooks.

**Percentage is the only real axis.** Page numbers and minute timestamps are two
rulers laid against one "fraction of the book" line; `custom_page_count` and
`custom_audio_minutes` are the conversion factors. This makes **cross-format
inference** possible: log page 100 (= 20%) one day, then "I'm at 3:00" (= 30%) the
next, and the app converts your last position onto the new ruler (20% × audio total
= 2:00) to fill in `minute_start`, recording a 2:00→3:00 session. Errors don't
compound — every log stores a *real observed* endpoint, so only the inferred *start*
of a cross-format session is an estimate, and only for that one session's volume. A
backward delta (new position behind your last) is read as re-coverage, not a
negative session.

**Precision: never quantize the bridge.** `progress_percent` is derived, never
stored, so there's no column to size — but when percent is used as the conversion
bridge it must *not* be rounded to integer percent first (on a 1,200-page book, 1% is
12 pages — far too coarse, and the error grows with book length). Compute the
cross-ruler position straight from the raw integer totals —
`inferred = round(source_pos × target_total ÷ source_total)` — carrying full
precision and rounding **once, at the end**, to the target unit's own granularity (a
whole minute or whole page). The error is then bounded by half a unit regardless of
book length. The *displayed* completion % is a separate, cosmetic rounding (one
decimal place keeps a long book's progress bar feeling responsive); it never feeds
back into a conversion.

**`unit` is stored explicitly, not inferred** from which column pair is filled. It's
load-bearing for the conversion logic above, it guards the "exactly one pair
populated" invariant, it keeps "sum all my audio time" a clean filter, and it leaves
room for a future `percent` unit (logging "I'm at 30%" directly) that no
column-nullness rule could represent.

**A session splits into one row per `new_ground` value.** `new_ground` is a property
of a *span*, not a session. A session that re-reads and then continues straddles the
**frontier** (your furthest new-ground point) and becomes two rows: the re-covered
part (`new_ground=false`) and the new part (`new_ground=true`), sharing one
`logged_at`. This is mandatory, not stylistic — a straddling span has no single
honest truth value, so a lone boolean would always break either volume (overcounting
the re-read) or completion (undercounting the new pages). You still log one action;
the API splits at the frontier automatically (the frontier is derivable from
cumulative new-ground), and the journal UI can group rows sharing a `logged_at` so it
still reads as one session.

**Layer boundary:** all of this smart behaviour — cross-format inference and
frontier-splitting — lives in the API/UI layer (`feat/progress-logging-api`), *not*
in the model. The table stores dumb, atomic spans and knows nothing about
percentages or frontiers.

### Author diversity tracking
Diversity attributes (nationality, gender identity, etc.) live on `author` records once. Every book by that author inherits them automatically for stats. `other_attributes` field is intentionally extensible so new dimensions can be added without schema migrations.

### Genres: Google Books source + user customization

`genres` on `books` is currently a string array, storing values exactly as returned
by the Google Books API. This is intentional — it defers the design of a controlled
vocabulary until there is a UI to work with.

Future design: a `genres` reference table with canonical values. On book creation,
genres are auto-populated from Google Books and mapped to the closest canonical entry.
The user can then add or remove genres from the book's list via the frontend, but
cannot invent arbitrary free-text strings — only values from the reference table are
valid. This is especially important for comics and graphic novels, where Google Books
metadata is frequently wrong or missing.

Do not enter real genre data until this table is designed. Any early data is
considered throwaway.

### Reference tables: a consistent pattern for user-extensible vocabularies

Three fields use the same pattern — a small reference table pre-seeded with
sensible defaults, extensible from the UI without schema migrations:

- **`book_sources`** — where a book copy came from (libby, gift, libro.fm, etc.)
- **`genres`** — book genres (auto-filled from Google Books, user-curated)
- **`places`** — nationalities and book settings (countries, non-official nations,
  indigenous nation names)

In all three cases, the UI shows a dropdown of existing values plus an "add new"
option. Adding a value = inserting a row, not running a migration.

### Places: nationalities, book settings, and a shared reference table

Several features will eventually share a common `places` reference table:
- `nationality` on `authors` (where an author is from)
- Book settings (where a story takes place)

`nationality` is currently a plain string. It will become a foreign key to `places`
once that table is designed. Do not enter real nationality data until then — early
data is throwaway.

The `places` table should include: all countries, non-official nations (e.g. Wales,
Scotland), and indigenous nation names. It should be pre-seeded from a standard
dataset and extensible (new entries can be added without a migration).

Book settings will also reference `places` but need additional special values not
applicable to nationality: "Space", "Many" (for books spanning many locations), and
potentially historical place names. The exact design is deferred until the UI exists.

### ISBNs identify an edition, not the work
ISBN identifies a specific edition/format, not the abstract work, so it does not
belong on `books`. Its true home is a *copy* (`owned_copies`). Until that table
exists, ISBN lives provisionally on `engagements` — a cheap migration later because
only raw facts are stored.

### Origin is a per-read fact, not an ownership concept
`origin` and `acquired_on` answer "where did the copy I read *this time* come
from, and when did I get it" — libby, the library, a friend's loan, a purchase, a
gift, an ARC. They apply to **every** read, and most sources (libby, library,
borrowed) never produce a copy you own, so they cannot live in `owned_copies`.
They stay on `engagements` permanently. The same book can carry a different
`origin` per engagement (borrowed once, bought the next time), which is exactly
why it's a per-read fact and not an ownership one.

`owned_copies` is a *separate axis* — the books you keep, with their own lifecycle
and their own acquisition record. It is not the home of read-origin; only `isbn`
is genuinely edition/ownership-flavoured and waits for it.

### Discovery is derived; three early dates are kept
Three genuinely different early moments live on `engagements`, because they answer
different questions:

- **`interested_on`** — entered `interested`; first hit my radar (**discovery**).
- **`tbr_added_on`** — entered `tbr`; committed to reading it (prioritised).
- **`acquired_on`** — got the copy (unrelated to the other two — you can be
  interested for a year before acquiring, and a library loan is acquired the day
  you start).

The "how long did it languish" stats are **derived** by subtracting these editable
dates (discovery → start = `started_on − interested_on`), never stored. Any date
is nullable when an engagement skips that phase, in which case the corresponding
gap simply doesn't exist. No per-book table is needed: `interested` and `tbr` are
engagements, so the first engagement always hosts `interested_on`, and "books in
my library" is itself a derivation — which keeps `books` purely bibliographic
without a personal per-book table.

### Fuzzy dates: a real date plus a precision flag
Reading dates are often imprecise — "I read this as a kid, sometime in 1994." A
plain `date` can't hold that (it demands a day), so every **user-set business
date** is stored as a pair: a real `date` plus a `DatePrecision` flag
(`day` / `month` / `year`, default `day`).

| You enter | Stored date | Precision | Shown as |
|-----------|-------------|-----------|----------|
| 1994 | `1994-01-01` | `year` | "1994" |
| March 1994 | `1994-03-01` | `month` | "March 1994" |
| 15 March 1994 | `1994-03-15` | `day` | "March 15, 1994" |

The value stays a genuine sortable/queryable `date` (1994 still sorts before
1995); the precision flag tells the UI how much to show, and the filler day/month
is never displayed. This applies to every `_on` field — `interested_on`,
`tbr_added_on`, `started_on`, `finished_on`, `acquired_on`, and `read_on` on
`standalone_entries` — each gaining a `<field>_precision` companion column. System
datetimes (`_at`) are always exact and carry no precision. Derived durations
inherit the coarser operand's precision, so the UI never invents accuracy it
doesn't have.

### Timestamps: fuzzy business dates (`_on`) vs exact instants (`_at`) — and audit vs activity within `_at`
Two independent questions decide how a time is stored.

**Fuzzy or exact?** Reading-life dates ("I read this in 1994") are *fuzzy* — a real
`date` plus a `DatePrecision` — and use the `_on` suffix. System and activity
instants are *exact* (no precision) and use `_at`.

**ORM-managed or user-set?** Not every `_at` is hands-off. Among the exact instants:

- **Audit timestamps** — `created_at`, `updated_at` (via `TimestampMixin`). The ORM
  sets them; they describe the *row* (when it was inserted / last modified). Users
  never edit them.
- **Activity timestamps** — `logged_at` on `progress_logs`, `written_at` on
  `reviews` / `blog_posts`. These describe when a real *activity* happened, default
  to now, and **are user-editable and backdatable**. `logged_at` is the "edit date"
  affordance in the logging UI: read last night, log it this morning, and
  `logged_at` is last night while `created_at` stays this morning. They're equal at
  creation and diverge only when you backdate — which is exactly why `logged_at` is
  its own column rather than a reused `created_at`.

The status-transition dates on `engagements` — `interested_on`, `tbr_added_on`,
`started_on`, `finished_on` (and `acquired_on`) — are the fuzzy `_on` kind:
**business data** (the real-world day each step happened), `date`-typed and *fuzzy*,
always **user-editable** and nullable. `tbr_added_on`, for instance, defaults to
today at the API layer when a TBR engagement is created, but can be edited or
backdated.

So the suffix tells you fuzzy-vs-exact (`_on` fuzzy, `_at` exact), but "exact" does
**not** mean "uneditable": activity `_at`s are user-set, audit `_at`s are not.
Keeping `logged_at` distinct from `created_at` is what lets you backdate a session
without corrupting the row's audit trail — systems that conflate the two (using
`created_at` as the "date added" surface) can't make it editable without a
non-trivial migration.

### Cover URLs
Default at `books` level, overrideable at the `engagements` level. Useful for
audiobooks (square covers) vs print/digital (portrait covers).

---

## Post-MVP Roadmap

### High priority
- Audio format support (progress in minutes, HH:MM display)
- Multi-format reads (mixed page/audio progress in one engagement) ✅ already in data model (`formats` set + per-log unit)
- Format tracking (print, digital, audio) — `formats` is a **set**; "combo" is not a value, just a set with >1 member ✅ already in data model
- DNF support ✅ already in data model
- Re-read support ✅ already in data model
- Journal entries on progress logs ✅ already in data model
- Review writing with journal entry sidebar
- Data export (CSV/JSON) — backup strategy

### Stats & charts
- Pages/minutes per day
- Reading pace
- Yearly totals
- Author diversity breakdowns (nationality, gender identity, etc.)
- TBR duration stats
- Recommender stats ("books recommended by X, % read, avg rating")
- Monthly wrap-up graphics (way down the road)

### Blog / writing features
- Review writing with journal entries visible in sidebar
- Monthly wrap-up post view (all reviews since last post)
- Blog post → reading sessions join (many-to-many)

### Library & organization
- Custom shelves (user-ordered)
- Custom lists
- Reading plans (by month or year)
- Owned copies tracking (`owned_copies` table: format, source, linked to book)
- Recommender tracking (`recommenders` table, chartable)
- "Where did this come from" field ✅ already in data model (`origin` on `engagements`, all reads)

### Book metadata
- Genre tracking (auto-filled from Google Books, editable)
- Series tracking ✅ already in data model
- Author roles (illustrator, narrator, colorist, letterer, inker, editor) ✅ already in data model

### Mobile / PWA
- Responsive web app (design from day one)
- PWA support for Android home screen install (no Play Store needed)

### X-Men reading order tracker
- Separate section of the app entirely
- Own set of tables, designed independently when the time comes

---

## Deployment Plan (when ready)

**Platform:** Railway or Render
- Both support Python + PostgreSQL natively
- ~$5–15/month for a personal app
- Automated Postgres backups available
- No servers to manage

**Strategy:**
- Angular frontend served as static files
- FastAPI backend as a web service
- Managed PostgreSQL database
- Manual "export everything" button in UI
- Automated database snapshots for backup

---

## Development Order

1. ✅ Set up dev environment (Python, Node, PostgreSQL, Git, GitHub)
2. ✅ Scaffold FastAPI project structure (`chore/project-setup`)
3. ✅ Setup GitHub Actions (`chore/ci-setup`)
3. Define SQLAlchemy models (Python classes = database tables) (`feat/database-models`)
4. Run first Alembic migration (create tables in Postgres) (`feat/databse-migrations`)
5. Build MVP endpoints (list current reads, list past reads, log progress, add book)
    - feat/books-api
    - feat/reading-sessions-api
    - feat/progress-logging-api
6. Scaffold Angular project
7. Build Angular components that call the API
8. Deploy to Railway/Render