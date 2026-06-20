# 0022. Adding a book seeds three editions — one real, two synthetic — enriched at point of use

- Status: Accepted
- Date: 2026-06-20
- Amends: [[0021-editions-and-engagement-edition]]

## Context

[[0021-editions-and-engagement-edition]] introduced `Edition` and `EngagementEdition` and posited a
**synthetic** ("generic") edition — a row standing in for "the ⟨format⟩ version of this book" —
created **lazily** on the first bind of a `(book, format)`, with length seeded from the book's
`default_*` fields. It declared a synthetic _audio_ edition impossible: with no audiobook duration
from Google Books, the row would be length-less, "a ghost."

Implementing it (#89, 2026-06-17) **reversed** that and the reversal was never recorded in an ADR.
#89 removed synthetic editions entirely: adding a book creates only the **one real print edition**
seeded from the imported Google Books volume (real ISBN, cover, page count); the binding `format`
shortcut is **find-only and never mints**; audio is deferred. The grounds were "no fakes, no
length-less ghosts."

This decision is a **third position**, reached after more thinking: synthetic editions come back —
but created **eagerly at add-time** and **enriched at the point of use**, in a form that answers the
exact objections that killed them. It backfills the print outcome and settles digital and audio
together.

The reframe that makes synthetic editions honest now: of all edition data, **only the length is
load-bearing** (it is the completion denominator, [[0004-derive-dont-store]]), and it is overridable
per read (`length_override` on the binding). ISBN-exact identity has never driven how an edition is
actually chosen — the real-world act is "find the version with the right length," never "the right
ISBN." So a synthetic edition is not a fake claim that loses data; it is a labeled placeholder whose
one load-bearing field is either ported from a real sibling edition, captured at first use, or
overridden per read.

## Decision

**Adding a book seeds three editions, one per format.**

### Print — real, from Google Books

Created from the imported volume's real data: `isbn` (from `industryIdentifiers`), cover, page
count. This is the genuine edition; it also populates the book-level cover and length. (Shipped in
#89/#106.) A manually-added book's print edition carries what was entered and `isbn` null.

### Digital — synthetic

Ports the print edition's **cover and length** (page count); no ISBN, no other data. Digital is
measured in pages, the same unit as print, so the print length is a reasonable default. It can be
wrong — editions genuinely differ in length — so it is **correctable on the edition** and
**overridable per read**. It is a default, not an asserted fact.

### Audio — synthetic

Ports the **cover only** (so a cover is associated, even if not the preferred square shape); no
length, no ISBN. The length is **captured the first time an audio read is logged** — Google Books
has no durations and there is no free source — and the captured value is written to the **audio
edition** (a real audiobook fact), available to future re-reads; the per-read override handles "my
copy differs." The edition sits length-less until then, which is safe because it is never used as a
completion denominator while empty: you cannot log audio progress without first supplying the
length. This is the resolution to 0021's "length-less ghost" — the ghost is never _used_ while
empty.

### How this fits the binding rule

Because all three editions exist from add-time, the find-only `format` shortcut always resolves and
**never has to mint**. "Editions are never auto-minted by a binding" survives; creation simply
happens at add-time, deliberately, not as a binding side-effect.

### Enrichment is never required, never lost

Editions are **user-correctable** (the existing update endpoint): fix a wrong ISBN, cover, or length
anytime. This is opportunistic and low-stakes — nothing breaks if you never do it. The **only**
datum that must be supplied to function is the audio length, and it surfaces itself exactly when you
log an audio read; print and digital reads never ask.

### Parked as future direction (not built, not blocked)

Caring about a _specific real_ edition later: either update the synthetic edition in place into a
real one, or create a **second** same-format edition with real details and designate which is
**canonical**. A canonical pointer plus multiple editions per format is a future, **additive**
direction — nothing here blocks it. Captured, not designed.

One wrinkle to define precisely **when it is built**: some engagement-layer edits should flow back
to the synthetic edition when it is the read's only binding (e.g. setting a cover on a first/only
read updates the synthetic edition). This is the single place the shared edition and the personal
read touch, and the rule is **stateful** (it depends on how many reads exist). Left open here; needs
a crisp definition at build time.

### What is built vs. pending

Print seeding shipped (#89/#91, cutover #106). Eager **digital and audio** synthetic seeding,
audio-length capture, and audio logging are **not yet built** — that is the audio-format work (#33).
This ADR records the target; sequencing lives in the issues.

## Consequences

**Makes easy:**

- A book is "ready" in all three formats the moment it is added; starting a read is a pure format
  pick — zero data entry for print/digital, one number for audio.
- Re-reads (and, hypothetically, other users — [[0002-books-are-user-agnostic]]) inherit the
  synthetic editions; each read overrides the length for its own copy without disturbing the shared
  edition.
- No required data-entry chore. Enrichment is opportunistic correction; the sole mandatory datum
  (audio length) is demanded at point of use, so it cannot be forgotten and never blocks non-audio
  reads.
- The find-only binding rule holds with no auto-minting.

**What we accept:**

- Two of every book's three editions are **synthetic placeholders** carrying a ported-or-empty value
  rather than that edition's own real data — accepted because length is the only load-bearing field
  and it is overridable per read, and ISBN-exact identity has never driven edition choice.
- The digital edition's ported print length **can be wrong**; it is a default, corrected on the
  edition or overridden per read.
- Every book carries editions in formats it may never be read in — the eager-creation cost 0021
  specifically avoided, accepted here for the always-ready start experience.

## Alternatives considered

- **0021's lazy, defaults-seeded synthetic editions** — the synthetic audio edition was length-less
  and declared impossible. Superseded: eager creation plus capture-at-use makes the audio
  placeholder safe.
- **#89's real-editions-only** (no synthetic; audio deferred) — keeps the database strictly honest
  but pushes all non-print, non-imported data into required entry or non-support, and never delivers
  the "ready in all formats" start. Reversed here on the reframe that length is the only
  load-bearing field and it is overridable.
- **Auto-discovering real per-format editions** (scraping a Goodreads-style editions page) — the
  only thing that would make all three editions genuinely real with no entry; a real future feature,
  too heavy for now. Synthetic-plus-capture is the stand-in until it exists.

## Revisit when

- **Auto-discovery of real per-format editions** becomes worth building — it would replace synthetic
  seeding with discovered real editions and remove the audio-length capture step.
- The **canonical-edition / multiple-editions-per-format** direction gets built — define the
  canonical pointer and the promotion action then.
- The **engagement-edit → synthetic-edition propagation** gets built — define its (stateful) rule
  then.
