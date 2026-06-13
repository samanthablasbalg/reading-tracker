# 0008. Time modeling: fuzzy `_on` dates vs exact `_at` instants

- Status: Accepted
- Date: 2026-06-08

> **Stub — write-up pending.** User-set business dates (`_on`) are *fuzzy* — a
> real `date` plus a `DatePrecision` (day/month/year), so "read it in 1994" is
> first-class and still sortable. System/activity instants (`_at`) are exact, no
> precision. Within `_at`: audit timestamps (`created_at`/`updated_at`, ORM-set,
> never edited) vs activity timestamps (`logged_at`/`written_at`, user-editable
> and backdatable).

## Context

## Decision

## Consequences

## Alternatives considered

## Revisit when
