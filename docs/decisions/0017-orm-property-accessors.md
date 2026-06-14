# 0017. ORM relationship traversal: property accessors on models

- Status: Accepted
- Date: 2026-06-13

## Context

When building the engagements router, `EngagementRead` nests a `BookRead`, and `BookRead.authors`
needs to come from `book.book_authors[i].author` — a two-hop traversal through the join table. Three
options were considered:

- (A) Add a `@property` to `Book` that exposes the traversal as a named attribute.
- (B) Duplicate the mapping logic per-router in a local helper function.
- (C) Extract all ORM-to-schema mapping to a shared mapper module both routers import from.

## Decision

Add `@property` accessors to ORM models that expose natural relationship traversals as named
attributes. `book.authors` returns `[ba.author for ba in self.book_authors]`. Pydantic's
`from_attributes=True` picks up properties via `getattr`, so `model_validate` works naturally up the
full nesting chain without manual construction helpers in the routers.

Properties return domain objects (`list[Author]`), not schema types — the model layer stays unaware
of Pydantic.

## Consequences

- ORM models carry lightweight accessors for any relationship that appears in a response schema.
- `model_validate` with `from_attributes=True` works seamlessly for nested schemas.
- If mapping logic grows beyond simple relationship traversal, or multiple routers need
  differently-shaped responses from the same model, migrate to (C): extract mappers to a shared
  module. The refactor is small (no migration, no contract change).

## Alternatives considered

- (B) Per-router helpers — rejected: duplication means two places to update when a schema changes.
- (C) Shared mapper module — rejected as premature: the right pattern when many routers need
  differently-shaped responses or mapping logic is complex. Adding that indirection now would be
  complexity without benefit.

## Revisit when

Multiple routers need differently-shaped responses from the same model, or mapping logic grows
beyond simple relationship traversal.
