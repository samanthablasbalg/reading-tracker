# 0006. Format is a descriptive set, decoupled from logging unit

- Status: Accepted
- Date: 2026-06-08

## Context

An engagement records which format(s) a book was read in — `formats` is a column on
it (see [[0005-engagements-lifecycle-entity]]). Two questions had to be settled about
that column:

1. **How is format represented** when a single read can mix formats — listening to
   the audiobook, then switching to the library ebook when the audio is unavailable,
   then back?
2. **Does format dictate how progress is logged** — must an audio read be logged in
   minutes and a print read in pages?

StoryGraph answers both badly: format is a single value attached to an edition, so a
mixed read has no honest representation, and logging is tied to that one format.

## Decision

`formats` is a **set** of the formats actually used — drawn from the `ReadingFormat`
enum (`print`, `digital`, `audio`) — not a single value. Two things follow:

- **"Combo" is not a special value.** A combined read is simply a set with more than
  one member (e.g. `{audio, digital}`). Modeling it as a set rather than adding a
  `combo` enum value keeps format-breakdown stats honest: a combo read still counts
  toward *both* audio and digital, instead of disappearing into a separate "combo"
  bucket that distorts every per-format total.
- **The set is descriptive, editable, and optional early.** Set it when the format is
  known (a series that will always be listened to), leave it empty when it isn't yet.
  It describes what happened; it is not a required up-front choice.

Format is **decoupled from logging unit**. The `formats` set does not gate how
progress is recorded: what unit a given progress entry uses (pages or minutes) is a
property of that entry, not something read off the format set. A read can be tagged
`{audio}` and still carry page-logged entries. (How logging itself works is a separate
decision, recorded with progress logs.)

This decoupling is also what makes the *proportion* of a book consumed in each format
measurable. Because every progress entry carries its own unit and converts to a
percentage of the book, the share read in audio versus in print is derivable — "70%
listened, 30% read." The set names *which* formats were used; the logs measure *how
much* of the book each one accounts for. A single `format` value could never express
that split.

The old single `format` scalar is removed in favor of the set, and `ReadingFormat`
carries no `combo` member.

## Consequences

**Makes easy:**
- A genuinely mixed read (immersion reading: audiobook while following the print
  book) is one engagement with `{audio, print}` — not a fake "combo," and not two
  separate reads.
- Per-format stats stay accurate at two levels: a combo read is *counted* toward
  every format it used (no "combo" bucket swallowing it), and the *proportion* of a
  book consumed in each format (e.g. 70% audio / 30% print) is derivable from the
  per-unit logs.
- Format can be committed early (set at `interested` / `tbr`) or left blank with no
  forced choice.

**What we accept:**
- "What format is this read?" is a set-membership question, not a single value — the
  UI and stats must handle zero, one, or many formats.
- A read's format set and the unit its logs use can legitimately differ, so the two
  have to be reasoned about independently rather than one implying the other.

## Alternatives considered

- **A single `format` value per read, including a `combo` enum member** (StoryGraph's
  approach) — a `combo` value is a black hole for stats (it counts toward neither
  audio nor digital), and a single value still can't express a read that was mostly
  audio with some print. Rejected.
- **Let format gate the logging unit** (audio ⇒ minutes, else pages) — rejected
  because real reads cross formats mid-stream; the unit belongs on each individual log
  entry, not on the read's format.

## Revisit when

A format needs **sub-types or attributes** — distinguishing hardcover from paperback
within `print`, or tracking a specific audio narration — which is richer than a flat
set of three values. Or if format ever genuinely must **gate behavior** (a feature
valid only for audio), forcing a tighter coupling than the purely descriptive set
chosen here.
