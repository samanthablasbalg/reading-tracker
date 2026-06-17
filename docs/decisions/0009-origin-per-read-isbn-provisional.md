# 0009. Origin is a per-read fact; ISBN provisional

- Status: Superseded by [[0021-editions-and-engagement-edition]]
- Date: 2026-06-08

## Context

An engagement (see [[0005-engagements-lifecycle-entity]]) needs to record two things that _feel_
like ownership: where the copy I read this time came from, and which edition it was (its ISBN). The
tempting move is to treat both as ownership facts and hang them on an `owned_copies` table — Axis 3
(see [[0003-three-independent-axes]]).

But "where a read came from" and "a copy I own" are not the same thing, and **most reads are not of
owned copies at all** — a library loan, a Libby borrow, a friend's copy. So the two facts need
placing carefully:

- `origin` — where the copy I read _this time_ came from (libby, the library, a borrowed copy, a
  purchase, a gift, an ARC) — and `acquired_on`, when I got it.
- `isbn` — which edition this was.

## Decision

Split the two, because they answer different questions.

### `origin` and `acquired_on` are per-read facts — permanently on the engagement

- They apply to **every** read. Most sources — libby, the library, a borrowed copy — never produce a
  copy I own, so they cannot live on `owned_copies`; an owned-copies- only home would have nowhere
  to put a library read's origin.
- The **same book can carry a different `origin` per engagement** (borrowed once, bought the next
  time) — which is the proof that origin is per-_read_, not per-book and not per-copy.
- So `origin` and `acquired_on` are columns on `engagements`, and they stay there **permanently** —
  not provisionally. (`acquired_on` is a fuzzy `_on` date, see [[0008-time-modeling-on-vs-at]];
  "bought this year" versus "sat on the shelf a while" is _derived_ from it, see
  [[0004-derive-dont-store]].)

This is distinct from a _possession's_ acquisition. How a copy I keep was acquired, plus its
lifecycle (kept / sold / donated / lost), belongs on `owned_copies` — owned books only. The two
share vocabulary (both say "gift," "purchased") but are different axes: reading versus owning (see
[[0003-three-independent-axes]]).

### `isbn` is edition-flavoured — provisionally on the engagement

- An ISBN identifies a specific **edition / format**, not the abstract work, so it does not belong
  on `books` (the work is edition-agnostic, and one work has many ISBNs). Its true home is a _copy_
  (`owned_copies`) — an ISBN only matters for a copy I actually own.
- `owned_copies` is deferred to post-MVP. Until it exists, `isbn` sits **provisionally** on
  `engagements`. Because it is a stored **raw fact** (see [[0004-derive-dont-store]]), lifting it
  onto `owned_copies` later is a cheap migration — move the column, nothing to recompute.

## Consequences

**Makes easy:**

- A library / Libby / borrowed read records its origin honestly, with no owned copy required to
  exist.
- Per-read origin differences (borrowed this time, bought last time) are represented naturally, one
  value per engagement.
- `owned_copies` can be deferred without blocking anything — only `isbn` waits on it, and that move
  is cheap.

**What we accept:**

- `isbn` has a temporary home and a known future migration — a small, deliberate debt, bounded
  because it is only a raw fact being relocated.
- A read's `origin` and an owned copy's _acquisition_ look alike and share words; they must be kept
  conceptually distinct despite that overlap.

## Alternatives considered

- **Put `origin` / `acquired_on` on `owned_copies`** (the earlier plan) — breaks for the majority of
  reads that never produce an owned copy: a library read would have nowhere to record its source.
  Rejected; it conflated two axes that merely share vocabulary.
- **Put `isbn` on `books`** — wrong target: an ISBN is an edition, `books` is the abstract work, and
  one work has many ISBNs.
- **Make `origin` a per-book field** — wrong granularity: the same book can have a different origin
  on each read.
- **Wait for `owned_copies` before recording origin at all** — would block MVP and lose data for
  every non-owned read.

## Revisit when

`owned_copies` is built. That is the trigger to migrate `isbn` onto it (the planned provisional →
permanent move), while `origin` and `acquired_on` stay put on `engagements`.
