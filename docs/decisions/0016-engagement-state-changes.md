# 0016. Engagement state changes: REST resource with server-owned transitions

- Status: Accepted
- Date: 2026-06-12

## Context

Issue 6 adds the first API for engagements — marking a book reading/finished. We had to decide how
state changes are modeled over HTTP. Engagements are lifecycle rows (ADR-0005) carrying fuzzy dates
(ADR-0008); standing and completion are derived, not stored (ADR-0004).

Two shapes were weighed:

- (A) REST resource: POST/PATCH/GET on `/engagements`, desired status in the body.
- (B) Action endpoints: named verbs (`/start-reading`, `/finish`).

## Decision

Engagements are a REST resource; state changes by writing the resource:

- `POST /engagements` creates a `reading` engagement.
- `PATCH /engagements/{id}` changes status — **narrow body: status only**.
- `GET /engagements?status=…` feeds the views.

Transition rules and date side-effects live **server-side**, not in the client and not in the URL.
The client states the desired status; the server validates legality and does the bookkeeping
(stamping `started_on`/`finished_on` with today's date, clearing on reversal).

The status PATCH carries **only** status — it is not a general field-writer. Correcting a user-set
`_on` date after the fact (e.g. "I actually finished this two days ago") is a legitimate but
**separate** operation: it sets the date together with its `DatePrecision` (ADR-0008), kept distinct
from the transition so that (a) a status flip can't silently rewrite a date and (b) every date-write
carries its precision. That date-editing capability is deferred — not in issue 6; marking finished
here simply stamps today.

Status changes are **reversible and non-destructive**. `finished` is a label, not a terminal
collapse: reverting to `reading` clears `finished_on` and loses nothing, because progress (once it
exists) lives in separate rows and standing is derived (ADR-0004). The architecture must never
foreclose reversal. Surfacing an undo control in the UI is separate, deferred work — the
_capability_ is not removed.

## Consequences

- New statuses (`paused`/`dnf`) and transitions are absorbed by accepting more status values — no
  new endpoints.
- Avoids StoryGraph's destructive-finish trap by construction.
- "Finish"-style intent lives in the service layer, not the route; a reader must open the handler to
  see the transition rules.

## Alternatives considered

- (B) Action endpoints — clearer for a large guarded state machine, but adds an endpoint per
  transition and makes reversal a second-class citizen. Rejected: the state machine is tiny, and we
  want reversal to be a peer of every other transition.

## Revisit when

Transition rules grow complex enough (many guarded transitions with distinct side effects) that a
generic PATCH obscures behavior — then named transition endpoints or an explicit state-machine layer
may pay off.
