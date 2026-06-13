# 0002. Books are user-agnostic shared reference data

- Status: Accepted
- Date: 2026-06-08

## Context

Before the data model could take shape, one question had to be answered first: does a book record
belong to _me_, or is it a shared fact about the world? StoryGraph (the tool being replaced) blurs
this — a book's record and your personal status are the same object, so "the book" and "my
relationship to the book" can't be pulled apart.

The realization that broke the model open: **a book is a fact about the world, not a fact about
me.** "Circe by Madeline Miller, 416 pages, published 2018" is true whether or not I've read it, own
it, or have ever heard of it. My rating, my shelf, my reading progress are facts about _me_ — a
different kind of thing entirely, and they have no business living on the shared record.

This is a single-user app today, so nothing _forces_ the separation: a personal flag on the book
record would "work" right now. But fusing the two is the mistake that makes a model impossible to
evolve, and seeing this split clearly is what let the rest of the design fall into place.

## Decision

The `books` record holds **only bibliographic facts about the work** — title, authors, series,
genres, Google Books metadata, default cover / page count / audio length. It carries **no user data
at all**: no rating, no favorite flag, no "in my library" boolean, no reading status, no ownership.

Anything personal lives elsewhere, attached to the thing that is _actually_ personal (a reading
experience, a copy) — never to the shared work. As a direct consequence there is also **no personal
per-book table**: "books in my library" is itself **derived** — the set of books I have any reading
experience with — not a stored membership flag.

Keeping the shared work cleanly separate from my relationship to it is what opened the way to
modeling reading and owning as their own independent axes.

## Consequences

**Makes easy:**

- The book record is correct-by-construction for more than one user: it could be _shared_ across
  users untouched, with each person's data hanging off their own rows. The single-user → multi-user
  path becomes additive, not a rewrite.
- `books` can be populated and refreshed from Google Books without any risk of clobbering personal
  data — there is none on it to clobber.
- No personal flag (rating, shelf, status) can leak onto the shared work and force the
  StoryGraph-style lie where one record means two things.

**What we accept:**

- "Is this in my library?" and "my rating for this" are **derivations / joins**, not a column read —
  a small, deliberate cost, consistent with storing raw facts and deriving labels.

## Alternatives considered

- **Personal fields on `books`** (rating, shelf, status directly on the record) — how StoryGraph
  does it. Simplest for one user, but it fuses "the book" with "my relationship to the book," which
  is the root cause of the downstream problems and permanently closes the door on sharing the
  record.
- **A personal per-book table** (one row per user-book, holding library membership) — rejected as
  storing a derivable fact. A book only enters "my library" by my having a reading experience with
  it, so membership already follows from those rows; a dedicated table would duplicate state that
  can be computed.

## Revisit when

The app goes **multi-user**. This decision is designed to make that transition additive — personal
data is already off the shared record — so multi-user is the moment to confirm the boundary actually
held: that nothing user-specific ever crept onto `books`.
