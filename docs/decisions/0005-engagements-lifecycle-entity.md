# 0005. Engagements: one lifecycle entity per read

- Status: Accepted
- Date: 2026-06-08

> **Stub — write-up pending.** One row per engagement spanning
> `interested → tbr → reading → paused → finished → dnf`; re-reads are new rows
> (never mutate the old one); a wish becoming a read is a status change, not a
> table move. Also capture here: `formats` is a descriptive *set*, decoupled from
> the logging unit ("combo" is just a set with more than one member).

## Context

## Decision

## Consequences

## Alternatives considered

## Revisit when
