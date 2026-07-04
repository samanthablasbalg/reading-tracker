# Reading Tracker — Design System

The durable home for the **look, feel, and structure** of the app — the counterpart to
`docs/decisions/` (which records data/architecture decisions). This captures the ground-up UI
redesign so the reasoning doesn't evaporate into chat.

Interactive mockups live in [`mockups/`](./mockups/) — open the `.html` files in a browser. They are
illustrative prototypes (hand-built HTML/CSS, **not** Angular), meant to show intent, not to be
ported literally.

---

## 1. North star

> "What if the bright, friendly, easy-to-use bits of **Pagebound** and the deep insights + stats of
> **StoryGraph** had a baby."

- **Personal app**, tailored to the owner, with **no social/community** ambitions — but the design
  must _accommodate_ multiple private users (per-user isolation already exists).
- **Genuinely both** phone and desktop — the nav adapts between them.
- **Bright and fun, but not overwhelming.** Loud color is _rationed_ onto what matters, sitting on
  calm backgrounds. Dark mode is a **first-class citizen**, designed alongside light — not derived
  from it (this is where we deliberately beat Pagebound, which has no dark mode).

## 2. Foundation

Build on **Angular Material's Material 3 (Material You)** with a **custom M3 theme**. Material 3 is
rounded and friendly by default, ships a real dynamic-color system so a bright palette stays
coherent and accessible, and handles data/tables/charts without a fight. We get personality by
_theming_ Material (colors, fonts, a few signature touches), **not** by fighting it — keeping build
effort low. The exotic-style options (claymorphism, neumorphism, neon block, kids fonts) were all
rejected: too childish, too low-contrast, or too loud for a data-dense reading app.

## 3. Information architecture

Two kinds of surface:

- **Destinations** — places you navigate to (the nav bar).
- **Entity pages** — the rich **Book page** and **Author page**. _Never_ nav tabs; reached by
  drilling in (tap a cover, an author name, a search result). This is why book/author complexity
  (anthology breakdown, author demographics) never crowds the top level.

**Four primary destinations**, presented adaptively — **bottom nav (≤5) on phone, sidebar on
desktop**, same set both places so the mental model never changes:

| Destination    | Holds                                                                              |
| -------------- | ---------------------------------------------------------------------------------- |
| **Home**       | Right now: currently-reading cards with inline logging, + a Streak shortcut.       |
| **Library**    | The books: shelves + **TBR**. TBR **holds Plan** (a flexible up-next surface).     |
| **Insights**   | Reading _looked back on_ — retrospective: stats, genres, moods, diversity, habits. |
| **Challenges** | Reading _aimed at_ — prospective: Goals + Challenges.                              |

- **Account/Settings** lives on the **avatar** (top bar), never among reading features.
- The **5th nav slot is deliberately left open** for a future **Blog** — so adding it costs no nav
  redesign.
- Adding books = **search in the top bar** (results → add to library; a miss → manual-add flow). No
  "Discover" tab; no center `+` (logging is contextual, per-book — it lives on the card).

**Two reasoning seams that resolved the structure** (worth preserving):

1. **Retrospective vs prospective.** _Insights_ is what happened (no targets); _Challenges_ is what
   you're aiming at (goals + themed challenges, both scored with progress). Clean split.
2. **Plan belongs with TBR, not with Goals/Challenges.** A "plan" (Pagebound-style monthly/yearly,
   or ranked "next 5 books / next 5 audiobooks") is a _shape you give the to-be-read pile_ — a facet
   of **TBR**, which lives in Library. It is **not** a peer of Goals/Challenges. This dissolved the
   "no single word covers Plan + Goals + Challenges" naming problem, and left "Challenges" as an
   honest name for the two things that _do_ pair.

**Collections** (see issue #58): one primitive with derived views — a **shelf** view surfaces in
Library, a **challenge** view in Challenges, a **tag** view as a slicing dimension in Insights. Same
entity, shown where its view belongs.

## 4. Color

Loud colors are rationed; both modes are designed together; **color never carries meaning alone**
(always paired with a label/number/icon). Reference:
[`mockups/palette-board.html`](./mockups/palette-board.html).

### Brand + surface tokens

| Token             | Light     | Dark                    | Notes                                             |
| ----------------- | --------- | ----------------------- | ------------------------------------------------- |
| `primary`         | `#E11584` | `#FF5FAB`               | **Barbie pink** — the punch. Brightens in dark.   |
| `on-primary`      | `#FFFFFF` | `#23111B`               | Text/icon on primary.                             |
| `secondary`       | `#FF7A2F` | `#FFA24D`               | Warm orange — the second favorite.                |
| `background`      | `#FBF6EE` | `#18131B`               | Warm cream / **warm** plum-dark (not cold black). |
| `surface` (cards) | `#FFFFFF` | `#241C26`               |                                                   |
| `surface-2`       | `#FFFDF9` | `#2E2432`               | Nested/elevated.                                  |
| `text`            | `#241C22` | `#F3E9EE`               | Warm near-black / warm off-white.                 |
| `muted`           | `#8A7A82` | `#B7A7B0`               | Secondary text.                                   |
| `track`           | `#F0E7DB` | `#3A2F3F`               | Progress-bar / chart track.                       |
| `border` / `line` | `#EFE4D8` | `rgba(255,255,255,.09)` |                                                   |
| `success` (delta) | `#16A34A` | `#4ADE80`               | Positive stat deltas.                             |

### Categorical data palette

For genres / moods / chart series. It **includes** the brand pink & orange so brand and data feel
like one family. Base (light) → lightened (dark):

| #   | Light     | Dark      | #   | Light     | Dark      |
| --- | --------- | --------- | --- | --------- | --------- |
| 1   | `#EC4899` | `#F472B6` | 5   | `#3B82F6` | `#60A5FA` |
| 2   | `#F97316` | `#FB923C` | 6   | `#84CC16` | `#A3E635` |
| 3   | `#8B5CF6` | `#A78BFA` | 7   | `#F59E0B` | `#FBBF24` |
| 4   | `#14B8A6` | `#2DD4BF` | 8   | `#F43F5E` | `#FB7185` |

Stacked bars get a **thin gap** between segments (adjacent warm hues blur edge-to-edge otherwise).

### Pastel card tints

Soft accent backgrounds for book cards / category color. Light:
`#FFD8EA #ECE3FF #D5F3E1 #FFE0CC #D6EBFF #FFEFB8`. Dark (deepened, not washed out):
`#4E2A44 #3A2E56 #24503E #5A3A2A #2A3E5A #5A4A22`.

## 5. Typography

**Serif where it's literary; sans where it's functional.** The "serifs are less accessible" concern
targets small UI text — it doesn't apply to large display or long-form prose, which is serif's home
turf and perfect for a _reading_ app. Reference:
[`mockups/serif-compare.html`](./mockups/serif-compare.html).

- **Lora** (serif) — page titles, book & entry titles, and **reading prose** (reviews, notes, and
  the eventual blog/journal). Chosen over Newsreader for its warmer, softer curves; over Fraunces
  because Fraunces's "wonk" axis makes jarring `f`/`j` shapes.
- **Plus Jakarta Sans** (sans) — everything functional: nav, buttons, labels, chips, filters, and
  **all numbers** (with `tabular-nums` so stat columns align).

Rough scale: page title ~30px Lora 600 · card/section title ~17–18px Lora 600 · book title 18–25px
Lora 600 · prose 15–16px Lora 400 · stat number 26–30px sans 800 · labels 11–13px sans 600/700 · nav
10.5px sans 600.

## 6. Component & layout language

- **Rounded cards on a calm background** carry everything — this is what keeps a dense screen
  reading as "rich," not "loud." Radii ≈ cards 18–20px, buttons 12–14px, pills fully round.
- **One primary CTA per screen** (filled pink); secondary actions are subordinate (ghost/surface).
- **Progress bars** in primary pink on the `track` color; a `%` label alongside (tabular). At **100%
  (finished)** the fill becomes a **pink→gold gradient** and the label turns gold — the one small
  reward flourish that marks a completed book, used consistently wherever a finished book's bar
  appears.
- **Streak** is the one place both brand colors go full-volume — a pink→orange gradient hero on Home
  (a reward should feel like one). Everything else stays calm around it.
- **Icons:** one line-icon family, consistent ~2px stroke, **no emoji as icons** (mockups use
  Lucide-style; Material Symbols is the natural Angular pairing). Format icons (audio/ebook/print)
  recur on book rows.
- **Adaptive nav:** bottom bar (phone) ⇄ sidebar (desktop), identical destinations; drill-in pages
  keep the nav and add a back affordance.

## 7. Key screens

- **Home** — [`mockups/home-mockup.html`](./mockups/home-mockup.html). Top search + avatar, the
  streak hero, currently-reading cards (cover, serif title, format, pink progress, inline **Log
  progress** + history), bottom nav. The daily driver.
- **Insights** — [`mockups/insights-mockup.html`](./mockups/insights-mockup.html). Deliberately
  dense (that's the point): hero stats with deltas, a pages-over-time area line, a genre donut with
  legend, mood bars, format split, a reading-activity heatmap, and a diversity card fed by private
  author tags. Every chart pairs color with a label/number.
- **Book page** — [`mockups/book-page-mockup.html`](./mockups/book-page-mockup.html). The richest
  drill-in: hero (cover, Lora title, author link, rating, chips), one primary CTA, About,
  **Contents**, Your notes (serif review + moods).
  - **Contents (anthology / omnibus)** —
    [`mockups/contents-collapse.html`](./mockups/contents-collapse.html). Component entries (stories
    / issues) each with a **page range** and **own read state**, logged individually. Logging one
    entry tracks _just that entry_ — it does **not** flip the whole book to "Currently reading."
    **Collapsible:** collapsed shows one row + progress + a "next up" nudge; large omnibuses **nest
    by arc**, each arc collapsing independently with its own progress. Default: collapsed above ~6
    entries, expanded below.
- **Library / TBR / Plan** —
  [`mockups/library-tbr-plan-mockup.html`](./mockups/library-tbr-plan-mockup.html). Shelves are a
  chip row (TBR / Reading / Finished / DNF / Paused / custom, with a lock on private
  ones; ＋ Shelf); on desktop they move to the sidebar. Selecting **TBR** reveals the **Plan**
  surface, built on one primitive: a **lane** = a named, ordered list of TBR books, either
  **freeform** (ranked, e.g. "Up next · Books," "Up next · Audiobooks") or **time-anchored** (e.g.
  "July 2026 · Monthly plan"). This unifies StoryGraph's rigid "Up Next," Pagebound's monthly plans,
  and custom ranked lists into one flexible thing. Lanes are horizontal, reorderable, and
  **collapsible** (collapsed = name + count + a peek of covers) so many months stay tidy. Below the
  lanes sits **All to-read** — the full pile with search, sort, and filter chips (Owned / Format /
  Genre / Tag) and per-book "＋ to a lane." Default: current/near month expanded, others collapsed.
- **Desktop layout** —
  [`mockups/desktop-insights-mockup.html`](./mockups/desktop-insights-mockup.html). Proof of
  "genuinely both": the same four destinations move from a **bottom bar** to a **persistent left
  sidebar** (account → sidebar footer, search → top bar), and single-column phone content **reflows
  into a bento grid** (wide charts span columns; the heatmap shows a full year). One component set,
  adapted by shell + grid — standard Angular Material responsive layout, not a second app.

## 8. Progress logging

The app's primary daily action. Logging happens in a **focused sheet** (`MatBottomSheet` on phone,
`MatDialog` on web) launched from a Currently Reading row — never inline, never a separate page
[ADR-0019]. One sheet hosts the whole act: a format-aware range input, the date, notes, live
completion feedback, and Finish. Mockups:
[`mockups/progress-logging-wip/input-and-strip-mockup.html`](./mockups/progress-logging-wip/input-and-strip-mockup.html)
(the input) and
[`add-format-via-menu-mockup.html`](./mockups/progress-logging-wip/add-format-via-menu-mockup.html)
(going multi-format), and
[`finish-and-linger-card-mockup.html`](./mockups/progress-logging-wip/finish-and-linger-card-mockup.html)
(the finished card).

**One input shape for every log.** Every log is a range **`From → To`** in a chosen format, in a
single container: `From` and `To · Now` side by side with the total trailing — `180 → 214 of 560`.
The same shape holds audio once seconds are dropped — `3:40 → 4:15 of 7:10` — so pages and audio
have **parity**. `To · Now` carries the visual weight; it's the ~90% input. `From` is **always
visible but subordinate**: its value is the reference (where you left off) — the fix to StoryGraph's
blank-box-on- audio paper cut, and the answer to "did I already log this?" It's editable via a quiet
**dotted underline** (no pencil); an edited `From` is signalled by **colour alone**, so the layout
never shifts. Because `From` carries the reference, `To` can open empty.

**From and Format collapse by default — so re-reads aren't a separate mode.** Two sub-controls
modulate the range and both stay collapsed on a normal linear log: **From** pre-fills to your last
spot _in that format_ and is only touched to re-read a section (pull it back), restart at 0, or fix
a non-linear resume; **Format** is fixed and quiet on a single-format read. So linear log, re-cover,
jump, and switch-format are one mechanism in different control states — not distinct screens.

**Completion is a covered _set_, not a position.** A log is a tagged range whose `new_ground` is
derived in the API [ADR-0007]; completion is the measure of the **union of covered intervals**, not
a high-water mark. That is what lets a non-linear read (a comics omnibus read out of published
order) climb correctly to 100% instead of sticking. The sheet shows **live new-vs-re-covered
feedback** before Save — new ground advances the %, re-coverage holds it and counts as reading
volume. _The visual form of that feedback bar is parked (see §11)._ The **unit** offered is the
format's **native unit vs. percent** (pages/minutes, or % when a source lacks page counts) — not a
pages↔minutes toggle.

**Multi-format is a pull, never a push.** Nothing advertises multi-format on a single-format log.
Reading a book in a second edition is entered deliberately from the card's **`⋯` menu** → an
**edition picker** (pick from the book's editions — all three formats exist from add-time
[ADR-0022]; "want a specific one?" → the book page; no edition creation in the modal). Only _after_
binding does the sheet grow a **format switch**, for that engagement only. Each format keeps its own
last spot; switching re-projects From, the unit, and the feedback onto the selected format.

**Status changes split by their tie to a logging session.** **Finish** is session-bound ("I just
read the last page"), so it lives in the sheet as the secondary action, and the finished book
**lingers** on Currently Reading with a dismissible "rate & review?" until refresh — no forced
review [ADR-0016]. **Pause / DNF / Undo-finish** are _not_ session-bound (you're setting the book
down, not logging), so they live in the card `⋯` menu and the book page — never the sheet.
**Read-again** on a finished book is a _new engagement_ [ADR-0005], so it lives on the book page.

## 9. Search & adding books

Two distinct searches, kept separate (conflating them was the MVP's jankiest part):

- **Global book search** — find or add _any_ book, across your library **+** the app catalog **+**
  Google Books. One consistent home (top bar on phone, top-right on desktop); same behavior on every
  screen. Present everywhere for consistency; collapses to an icon where it isn't the point.
- **Local list filter** — narrows _this_ list; appears only on list screens (the TBR pile, a shelf),
  scoped and labeled ("Search your TBR…"). It filters, it doesn't navigate.

A result is in one of **four states**, and the state drives what its actions mean:

| State                        | Row action                         | "Open" (tap the row)                          |
| ---------------------------- | ---------------------------------- | --------------------------------------------- |
| 1 · in **my** library        | — (status shown)                   | real Book page                                |
| 2 · in the **app**, not mine | **Add** (to my library, w/ status) | real Book page                                |
| 3 · **not** in the app       | **Import** (into the catalog)      | **provisional** Book page (Google, read-only) |
| 4 · not in Google            | **Add manually** (form)            | —                                             |

**Implement now — separated import / add**
([`mockups/book-search-separated-mockup.html`](./mockups/book-search-separated-mockup.html)):
importing a book into the shared catalog and adding it to _your_ library are **two deliberate acts**
— with two users curating one catalog, "import but don't personally add it" is a real intent. Google
rows say **Import**; already-in-app rows say **Add**. The provisional page's CTA is **Import**;
after import, a sheet offers two first-class exits — **Add to my library** (with a status, default
"Want to read") or **just import**. Grounding: per [ADR-0002] "my library" is a _derived_
relationship, so "add to my library" = creating that relationship; per [ADR-0015] the provisional
page renders from the search payload (no extra call) and import re-fetches by id, cache-served (~1
external call for the whole flow).

**Documented future alternative — combined one-tap add**
([`mockups/book-search-states-mockup.html`](./mockups/book-search-states-mockup.html)): if the
double-tap grates, collapse import + add into a single atomic **Add** (import-if-needed → relate →
set status). Reversible either direction — it's a UI choice with no migration.

**Landmines to resolve when the import path is built** (flagged, not designed here):

- **Source dedup** — search must reconcile Google hits against existing `books` rows (by
  `google_books_id` / ISBN) so a state-2 book never _also_ appears as a state-3 result, and adding
  it can't mint a duplicate record.
- **Work identity on import** — different Google _volumes_ of one work have different ids; naive
  import creates duplicate `books` rows (ADR-0009 / ADR-0013 hold the identity machinery).

## 10. Accessibility (non-negotiables)

- Text contrast ≥ 4.5:1 (body) in **both** themes; verify dark independently.
- Color is never the only signal — pair with label, number, icon, or pattern.
- Touch targets ≥ 44px; visible focus states; respect `prefers-reduced-motion`.
- Charts get a text/table alternative and a screen-reader summary of the key insight.

## 11. Parked — captured, not yet designed

Structure accommodates these; they get designed when pulled.

- **Screens not yet drawn:** Challenges, Author page (with privately-tagged demographics).
- **Admin / import surface** — a future place that pulls "import to the catalog" out of the main
  app, so day-to-day there's barely any in/out-of-app affordance.
- **Streak mechanics** — the feature is placed on Home; the rules are undesigned.
- **Blog** — Substack migration, possibly owner-only; lands in the reserved 5th nav slot, with
  cross-linking to reviews/journal. Serif prose already has a home.
- **Sharable public curated lists** — incl. the cross-referenced X-Men reading order.
- **Public / logged-out pages** — confirmed _additive_; can be bolted on later without rework.
