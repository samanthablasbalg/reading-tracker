# 0013. Author identity: get-or-create by name

- Status: Accepted
- Date: 2026-06-09

> **Stub — write-up pending.** `POST /books` and import both resolve authors by
> name: reuse an existing author row if the name matches, otherwise create one
> (option A from the design discussion). A `UNIQUE(authors.name)` constraint is the
> backstop that closes the check-then-insert race.

## Context

## Decision

## Consequences

## Alternatives considered

## Revisit when
