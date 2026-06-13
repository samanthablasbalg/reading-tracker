# 0001. Tech stack: Angular + FastAPI + PostgreSQL 18

- Status: Accepted
- Date: 2026-06-07

## Context

This project has two purposes at once: build a genuinely useful personal reading tracker, and serve
as a deliberate vehicle for learning the technologies I want for my career. The stack was chosen as
much for the second reason as the first — an unusual basis for a tech decision, and the reason this
ADR reads differently from the others.

I'm an SDET with a decade of experience from the testing side, not the building side. My background
is React shops, though I wouldn't claim I could build self-sufficiently in React — more general
familiarity than fluency. I've never touched Angular, and Python is entirely new to me.

Two concrete career drivers shaped the choice:

- **My company builds all its apps in Angular.** Learning Angular has direct, immediate day-job
  value.
- **Learning Python was an explicit goal for the year.** It's partially used at my job (the app I
  currently work on is more Kotlin), and it feels far more universally useful across my work than
  Kotlin does.

## Decision

- **Frontend:** Angular.
- **Backend:** Python + FastAPI (REST API).
- **Database:** PostgreSQL 18, accessed via SQLAlchemy + Alembic.

The frontend framework (Angular) and the backend language (Python) were chosen as **learning bets
aligned with the day job**, deliberately over the tools I already had some footing in.

Postgres, SQLAlchemy, and Alembic are **conventional defaults** for a FastAPI app, not separately
deliberated: a relational database fits the data, and this is the standard Python ORM + migrations
pairing. FastAPI specifically because it's a modern, type-hint-driven REST framework — which doubles
as a good way to absorb idiomatic, typed Python.

Deployment is planned for Railway or Render (managed Postgres, static frontend, ~$5–15/month), but
that's a deferred "when ready" decision, not part of this one.

## Consequences

- **Velocity is deliberately traded for comprehension.** I'm new to both Angular and Python, so the
  project goes slower and every step gets explained before it's built. This is the project's entire
  working style — optimise for understanding, not speed — and it's downstream of this decision.
- **The build doubles as the curriculum.** "Why is it like this?" is worth writing down, which is
  part of why this ADR log exists at all.
- **Friction is front-loaded, on purpose.** Choosing unfamiliar tools is harder than reaching for
  what I know — but the friction is exactly where the learning is, so that cost is the point, not a
  regret.

## Alternatives considered

- **React for the frontend** — my actual background. Rejected on purpose: the job uses Angular
  exclusively, so the learning value is in Angular, and staying with the familiar would forfeit it.
- **Kotlin for the backend** — the language my current app mostly uses. Rejected in favour of
  Python, which was the explicit year goal and is more broadly useful across my work than Kotlin.
- **Reaching for known tools generally** — rejected because a core purpose of the project is to
  learn unfamiliar ones; picking for familiarity would defeat it.

## Revisit when

This is effectively a one-way door — swapping a layer mid-project means a rewrite — but for a
personal learning project the real trigger is the _learning goal_, not technical scaling. Reconsider
a layer only if it actively stops serving that goal (e.g. the Angular learning is "done" and its
friction now outweighs its value), or if the project ever needed to grow beyond what a single-user,
single-machine stack comfortably supports. Neither is expected.
