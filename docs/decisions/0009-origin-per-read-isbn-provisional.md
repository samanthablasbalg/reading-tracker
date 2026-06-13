# 0009. Origin is a per-read fact; ISBN provisional

- Status: Accepted
- Date: 2026-06-08

> **Stub — write-up pending.** `origin` / `acquired_on` ("where the copy I read
> *this time* came from, and when") apply to *every* read (libby, library,
> borrowed…), most of which never produce an owned copy — so they live on
> `engagements` permanently, not `owned_copies`. Only `isbn` is genuinely
> edition/ownership-flavoured; it sits on `engagements` provisionally and moves to
> `owned_copies` when that table exists (cheap migration — raw fact).

## Context

## Decision

## Consequences

## Alternatives considered

## Revisit when
