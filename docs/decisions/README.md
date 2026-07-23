# Architecture Decision Records

This directory records the **why** behind significant decisions in the reading tracker. Each file
captures one decision: the context that forced it, what was chosen, the consequences accepted, and
the trigger that would make us revisit it.

ADRs are the durable home for reasoning that would otherwise be lost in chat, commit messages, or
planning docs. They're written for future-you, months later, asking "why is it like this?"

## Conventions

- **One decision per file**, named `NNNN-short-slug.md`.
- **Numbering is chronological by when the decision was made**, and immutable: once assigned, a
  number is never reused or renumbered. New decisions append at the end (the next free number), so
  going forward "newest = highest number" holds.
- **Status** is one of: `Accepted`, `Proposed`, or `Superseded by NNNN`. `Proposed` means the
  decision isn't yet ratified (or we're not sure it was consciously made) — don't treat it as
  settled until it's `Accepted`.
- A record carrying `> **Stub — write-up pending.**` is a placeholder: the prose isn't written yet.
  Fill at leisure.
- Records **0001–0014 were backfilled** from `PLANNING.md` to capture decisions made before this log
  existed, so their dates are approximate. Most of the data-model ones (0002–0012) were decided
  together, so their order relative to each other is cosmetic. `PLANNING.md` can be retired once its
  reasoning is fully captured here.

## Template

```markdown
# NNNN. <Title>

- Status: Accepted
- Date: YYYY-MM-DD

## Context

What forced a decision; the constraints in play.

## Decision

What we chose, stated plainly.

## Consequences

What this makes easy, what it makes hard, what we accept.

## Alternatives considered

- <Option> — why not.

## Revisit when

The concrete trigger that would reopen this (e.g. "if this goes multi-user").
```

## Index

| #                                                               | Decision                                                               | Status                                                                                  |
| --------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [0001](0001-tech-stack-angular-fastapi-postgres.md)             | Tech stack: Angular + FastAPI + PostgreSQL 18                          | **Accepted**                                                                            |
| [0002](0002-books-are-user-agnostic.md)                         | Books are user-agnostic shared reference data                          | **Accepted**                                                                            |
| [0003](0003-three-independent-axes.md)                          | A book lives on three independent axes                                 | **Accepted**                                                                            |
| [0004](0004-derive-dont-store.md)                               | Store raw facts, derive labels                                         | **Accepted**                                                                            |
| [0005](0005-engagements-lifecycle-entity.md)                    | Engagements: one lifecycle entity per read                             | **Accepted**                                                                            |
| [0006](0006-format-descriptive-set.md)                          | Format is a descriptive set, decoupled from logging unit               | **Accepted**                                                                            |
| [0007](0007-progress-logs-activities-not-positions.md)          | Progress logs are activities, not positions                            | **Accepted** (superseded in part by [0024](0024-progress-logs-dated-to-a-local-day.md)) |
| [0008](0008-time-modeling-on-vs-at.md)                          | Time modeling: fuzzy `_on` vs exact `_at`                              | **Accepted** (superseded in part by [0024](0024-progress-logs-dated-to-a-local-day.md)) |
| [0009](0009-origin-per-read-isbn-provisional.md)                | Origin is per-read; ISBN provisional                                   | Superseded by [0021](0021-editions-and-engagement-edition.md)                           |
| [0010](0010-user-extensible-reference-tables.md)                | User-extensible reference tables                                       | **Accepted**                                                                            |
| [0011](0011-standalone-entries.md)                              | Standalone entries (reads off the book goal)                           | **Accepted**                                                                            |
| [0012](0012-shared-vs-per-table-enums.md)                       | Shared vs per-table Postgres ENUM types                                | **Accepted**                                                                            |
| [0013](0013-author-identity-get-or-create.md)                   | Author identity: get-or-create by name                                 | **Accepted**                                                                            |
| [0014](0014-dedicated-test-database.md)                         | Dedicated test database                                                | **Accepted**                                                                            |
| [0015](0015-google-books-access-via-backend-proxy.md)           | Google Books access via backend proxy                                  | **Accepted**                                                                            |
| [0016](0016-engagement-state-changes.md)                        | Engagement state changes: REST resource, server-owned                  | **Accepted**                                                                            |
| [0017](0017-orm-property-accessors.md)                          | ORM relationship traversal: property accessors on models               | **Accepted**                                                                            |
| [0018](0018-e2e-testing-database-strategy.md)                   | End-to-end testing database strategy                                   | **Accepted**                                                                            |
| [0019](0019-progress-logging-in-a-focused-sheet.md)             | Progress logging happens in a focused sheet                            | **Accepted**                                                                            |
| [0020](0020-currently-reading-cover-led-rows-sorted-on-load.md) | Currently Reading: cover-led rows, sorted on load                      | **Accepted**                                                                            |
| [0021](0021-editions-and-engagement-edition.md)                 | Editions own format; read binds via EngagementEdition                  | **Accepted**                                                                            |
| [0022](0022-seed-three-editions-per-book.md)                    | Adding a book seeds three editions, enriched at use                    | **Accepted**                                                                            |
| [0023](0023-per-user-data-isolation-via-rls.md)                 | Per-user data isolation via Postgres row-level security                | **Accepted**                                                                            |
| [0024](0024-progress-logs-dated-to-a-local-day.md)              | Progress logs are dated to a local day; business dates from the client | **Accepted**                                                                            |
| [0025](0025-api-services-crud-layering.md)                      | Backend layering: routers, services, generic CRUD                      | **Accepted**                                                                            |
