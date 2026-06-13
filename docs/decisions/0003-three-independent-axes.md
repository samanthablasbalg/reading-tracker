# 0003. A book lives on three independent axes

- Status: Accepted
- Date: 2026-06-08

## Context

With the book record settled as **user-agnostic shared data** — a fact about the world, not about me
([[0002-books-are-user-agnostic]]) — the next question was how to model my _relationship_ to a book.
That relationship is not one thing either, and the rest of the data model hangs off getting it
right.

The tool this project replaces, StoryGraph, has a single knob — a _status_ attached to an _edition_
— and forces that one field to answer three unrelated questions at once: what the book _is_, whether
I've _read_ it, and whether I _own_ it. Because one field can't be three things, it is always lying
about at least one of them:

- A re-read flips a finished book back to "to read."
- A DNF'd edition pollutes reading stats and surfaces first in search.
- An owned-but-unread copy has to masquerade as a reading status ("to read") just to be recorded.
- There is no representation of "the book itself" at all — only the edition you happened to shelve.

Every one of these is a real friction I hit, and together they are what forced the model's shape.

## Decision

Refuse the collapse. A book sits on **three independent axes**, and each gets its own home:

1. **The book as a concept** _(what it is)_ — the abstract, edition-agnostic work: the `books`
   table. It carries no reading or ownership status. Its overall **standing** ("read & loved ·
   reread queued · 2 copies owned") is _derived_ from the other two axes, never stored.
2. **Reading it** _(my experiences of it)_ — `engagements`, and the `progress_logs` and `reviews`
   hanging off them. Each experience is its own row.
3. **Owning it** _(my copies)_ — `owned_copies`, each copy with its own ownership lifecycle (owned →
   kept / sold / donated / lost), entirely separate from whether or how the book was read.

The axes are **orthogonal**: a copy has no reading status; a read is not a possession; the book's
standing is a derivation of the other two, never a stored field on `books`.

> Axis 3 (`owned_copies`) is **conceptually settled but deferred** — the table is post-MVP. The
> decision recorded here is that ownership is its _own_ axis, so when the table is built it does not
> fold into reading.

## Consequences

**Makes easy:**

- Re-reads are new `engagements` rows; the old finished read is never mutated.
- Multiple owned copies of one book without inventing fake reads to hold them.
- Per-experience reviews and ratings (a re-read gets its own review).
- A DNF stays attached to one engagement and never becomes the book's public face.
- A genuine "the book itself" concept, independent of any one edition or read.

**What we accept:**

- More tables and joins than a single-status design. Cross-axis questions ("show finished books I
  still own in hardcover") require joining all three.
- **Book standing is computed, not read off a column** — every place that shows a book's overall
  state pays a small derivation cost, because standing is a function of the reading and ownership
  axes rather than a stored field.

This decision is the spine of the model: the design of the reading-experience entity, the treatment
of per-read facts, and the rule of storing raw facts while deriving labels all follow from keeping
the three axes separate.

## Alternatives considered

- **Single status on the edition** (StoryGraph's model) — the status quo we're rejecting. One field
  forced to mean three things, always lying about at least one; see Context.
- **Single status on the abstract work** instead of the edition — fixes "no concept of the book
  itself" but still collapses _reading_ and _owning_ into one knob. Can't represent two copies, or a
  re-read distinct from the first read.
- **Two axes (merge owning into reading)** — let an engagement carry ownership facts. Rejected
  because most reads are of copies you never own (library, Libby, borrowed), so an unread owned copy
  would have no read to attach to, and ownership facts would distort reading stats. Ownership
  genuinely is its own axis with its own lifecycle.

## Revisit when

This is the spine of the whole app and won't be reopened lightly. The one concrete trigger: if the
product ever deliberately narrowed to a single axis (e.g. "just track what I'm currently reading,
drop ownership entirely"), Axis 3 could be dropped — but Axes 1 and 2 stay separate regardless,
because their collapse is the original failure this whole design exists to fix.
