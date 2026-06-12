# 0013. Dedicated test database

- Status: Accepted
- Date: 2026-06-11

> **Stub — write-up pending.** Tests run against a separate `TEST_DATABASE_URL`
> (`reading_tracker_test`), not the dev database. Came from a bug: `conftest.py`
> built its engine from `DATABASE_URL`, so `drop_all()` on teardown wiped the dev
> database after every `pytest` run.

## Context

## Decision

## Consequences

## Alternatives considered

## Revisit when
