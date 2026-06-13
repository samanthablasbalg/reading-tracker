# 0012. Shared vs per-table Postgres ENUM types

- Status: Accepted
- Date: 2026-06-08

> **Stub — write-up pending.** `date_precision` is used by multiple tables (books, engagements,
> standalone_entries), so it's declared once and bound to the metadata — SQLAlchemy emits a single
> `CREATE TYPE`. Per-table enums (`reading_status`, `log_unit`, etc.) stay inline in their own model
> files. (The "why" here is a learning about how SQLAlchemy maps Python enums to Postgres ENUM
> types.)

## Context

## Decision

## Consequences

## Alternatives considered

## Revisit when
