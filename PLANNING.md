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
| default_cover_url | string | Overrideable at session level |
| default_page_count | int | Overrideable at session level |
| default_audio_minutes | int | Overrideable at session level |
| genres | string[] | Auto-filled from Google Books, editable |
| series | string | |
| series_position | int | |

### `book_authors` (join table)
| Field | Type | Notes |
|-------|------|-------|
| book_id | uuid FK → books | |
| author_id | uuid FK → authors | |
| role | enum | author, illustrator, narrator, colorist, letterer, inker, editor — extensible |

### `reading_sessions`
| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| book_id | uuid FK → books | |
| format | enum | print, digital, audio, combo |
| isbn | string | Edition-specific, lives here not on books |
| cover_url | string | Overrides book default if set |
| custom_page_count | int | null = use book default |
| custom_audio_minutes | int | null = use book default |
| tbr_added_at | date | Track TBR duration; null for re-reads |
| started_at | date | |
| finished_at | date | |
| status | enum | reading, finished, dnf, tbr |
| reread_number | int | 1 for first read |

### `progress_logs`
| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| session_id | uuid FK → reading_sessions | |
| logged_at | date | |
| progress_percent | decimal | Source of truth for position in book |
| page_number | int | Raw input if paged format |
| minutes_elapsed | int | Raw input if audio (stored as total minutes, displayed as HH:MM) |
| journal_entry | text | Optional notes/quotes, feeds into review writing later |
| out_of_order | boolean | Flags non-linear reads; disables delta calculations |

### `standalone_entries`
| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| book_id | uuid FK → books | null if manual mode |
| author_id | uuid FK → authors | null if linked to book |
| manual_title | string | null if linked to book |
| manual_author | string | null if linked to book |
| read_on | date | |
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
| session_id | uuid FK → reading_sessions | One review per session = separate review per re-read |
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

### Why `books` and `reading_sessions` are separate
A book is the abstract work. A reading session is your specific experience of it — format, edition, dates, progress. This supports:
- Re-reads (separate sessions, separate reviews, separate progress logs)
- Multiple formats of the same book (audiobook in 2023, paperback in 2026)
- Custom page counts (trimming after-matter from omnibuses)

### Audio progress storage
Stored as total integer minutes. `01:15` = `75`. Display logic converts to/from HH:MM. This is trivial and solves a known StoryGraph pain point.

### Combo format progress tracking
`progress_percent` is the universal currency. Whether the user inputs a page number or a minutes-elapsed figure, the backend converts it to percent using the session's known total. Deltas ("you read 110 pages today") are calculated from percent differences. Raw inputs (page_number, minutes_elapsed) are also stored so original data is never lost.

### Out-of-order reading
Flagged with `out_of_order` boolean on progress_logs. Display layer skips delta calculations for flagged entries. Supports comics omnibuses with non-linear reading orders.

### Author diversity tracking
Diversity attributes (nationality, gender identity, etc.) live on `author` records once. Every book by that author inherits them automatically for stats. `other_attributes` field is intentionally extensible so new dimensions can be added without schema migrations.

### ISBNs live on `reading_sessions`
ISBN identifies a specific edition/format, not the abstract work. Two reads of the same book in different formats = two different ISBNs.

### Cover URLs
Default at `books` level, overrideable at `reading_sessions` level. Useful for audiobooks (square covers) vs print/digital (portrait covers).

---

## Post-MVP Roadmap

### High priority
- Audio format support (progress in minutes, HH:MM display)
- Combo format support (mixed page/audio progress)
- Format tracking (print, digital, audio, combo)
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
- "Where did this come from" field on sessions (libby, purchased, gifted, owned, borrowed, arc)

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
2. ⬅️ **Current:** Scaffold FastAPI project structure (`chore/project-setup`)
3. Setup GitHub Actions (`chore/ci-setup`)
3. Define SQLAlchemy models (Python classes = database tables) (`feat/database-models`)
4. Run first Alembic migration (create tables in Postgres) (`feat/databse-migrations`)
5. Build MVP endpoints (list current reads, list past reads, log progress, add book)
    - feat/books-api
    - feat/reading-sessions-api
    - feat/progress-logging-api
6. Scaffold Angular project
7. Build Angular components that call the API
8. Deploy to Railway/Render