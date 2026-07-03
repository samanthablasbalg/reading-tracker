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
- **Progress bars** in primary pink on the `track` color; a `%` label alongside (tabular).
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

## 8. Accessibility (non-negotiables)

- Text contrast ≥ 4.5:1 (body) in **both** themes; verify dark independently.
- Color is never the only signal — pair with label, number, icon, or pattern.
- Touch targets ≥ 44px; visible focus states; respect `prefers-reduced-motion`.
- Charts get a text/table alternative and a screen-reader summary of the key insight.

## 9. Parked — captured, not yet designed

Structure accommodates these; they get designed when pulled.

- **Screens not yet drawn:** desktop/sidebar layout, Challenges, Author page (with privately-tagged
  demographics).
- **Streak mechanics** — the feature is placed on Home; the rules are undesigned.
- **Blog** — Substack migration, possibly owner-only; lands in the reserved 5th nav slot, with
  cross-linking to reviews/journal. Serif prose already has a home.
- **Sharable public curated lists** — incl. the cross-referenced X-Men reading order.
- **Public / logged-out pages** — confirmed _additive_; can be bolted on later without rework.
