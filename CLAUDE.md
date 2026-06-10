# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal reading tracker — Angular frontend + FastAPI backend + PostgreSQL 18.

## Working Style

The owner of this project is an SDET with over a decade of software experience
from the testing side, not the building side. Python is completely new to them.
This context should calibrate how you explain things: assume solid engineering
intuition and familiarity with software concepts, but explain Python-specific
syntax, idioms, and library patterns as if they are new.

**Do not jump ahead and implement things without explaining them first.**

Before writing any code, explain:
- What you are about to build and why it is structured that way
- Any non-obvious decisions (naming, types, file layout, patterns)
- How the new code connects to what already exists

Only write code after the owner has confirmed. If a task is multi-step, explain
and confirm one step at a time.

The goal is for the owner to be able to read every file in this project and
understand it fully. Optimise for understanding, not for speed.

When presenting options, list them neutrally and let the owner reason. Only
offer a recommendation if explicitly asked.

## Scope and Forward Momentum

Governs *how much* to design/build in a stretch of work. Subordinate to **Working
Style**: explaining before building and never letting the owner rubber-stamp is
invariant. Momentum comes from **narrowing scope, not lowering comprehension** —
build less, still explain every step.

The owner is a recovering perfectionist with an SDET completeness instinct, training
the skill of scoping. Build that instinct; don't substitute for it.

- **Door check.** When a *net-new capability* decision appears ("should we also
  support X later?"), pause and have the owner classify it *first*: is adding X later
  **additive** (new column/table/endpoint — cheap) or **destructive** (rewrite,
  migrate data, break a contract)? Confirm or correct. Design effort goes to
  destructive decisions; additive ones get parked in a sentence. Most are additive,
  especially now (no data, no app).
- **Parking is for net-new capability ONLY — never a cover for shirking.** Never
  license to abandon required work ("tests won't pass, leave it"), disclaim a branch
  bug because "I didn't introduce it this session" (**branch responsibility is
  total** — own what's broken regardless of who broke it), or defer something just
  because it's hard. Defects, regressions, failing tests, and finishing what's
  started are never scope. If genuinely blocked, say so loudly and escalate — never
  silently punt.
- **Scope-drift detector.** Get a loose intent at the start ("a book in a browser
  today"). The owner can't feel when a design discussion balloons past it — they're
  enjoying the dive. Be the outside signal: name the drift, let them choose. Chosen
  depth, not no depth.
- **Calibration.** Fire only at genuine decision points, not every micro-choice.
  Taper over time (walk-through → "you call it, I'll check" → flag only miscalls); if
  it isn't getting lighter, say so. The same triage applies to test design — draw the
  parallel so the instinct generalizes.
- **Capture, don't design, future work.** Backlog items get a problem statement + a
  few acceptance bullets — not schema, enums, or full edge-case analysis. *Gray-area
  exception:* DO note a constraint or gotcha you've **already discovered** — a known
  one-way-door implication, or a non-obvious landmine the future implementer would hit
  — as a short, flagged caveat ("note, verify when pulled: …"). The line is *facts you
  found* (capture) vs *solutions you're inventing ahead* (don't): note the landmines,
  not the blueprints. If a note grows into a schema or real edge-case analysis, stop
  and mark it "design when pulled" — most backlog is reprioritized or cut before it
  ships, so upfront design has a high waste rate.
- **Prefer vertical slices.** Favor outcome-shaped milestones that run end-to-end
  ("add a book, see it in a browser") over layer-shaped ones ("build all the models");
  layer milestones have no natural stopping point and hide a working app until the end.

## Branching and Commits

This is a personal project but uses branches and PRs deliberately, as a learning
and documentation tool. PR descriptions serve as breadcrumbs the owner can return
to later to understand why decisions were made.

- Features should be chunked into reasonably scoped branches.
- Within a branch, work should be committed in small, logical units — one
  coherent change per commit, not one giant commit per branch.
- PR descriptions should be written to explain the *why* behind decisions, not
  just the *what*, since the owner may return to them months later.
- Do not push branches or open PRs without explicit instruction.

## Working from GitHub Issues

Branches follow the pattern `<type>/<issue#>/<slug>` — for example
`feat/4/scaffold-angular`. The issue number is always the **second**
slash-separated segment of the branch name.

When the owner refers to "this issue" / "the issue", or asks to continue or
finish the current work without naming a number:

1. Get the current branch: `git branch --show-current`.
2. Extract the issue number — the second segment (e.g.
   `feat/4/scaffold-angular` → `4`). If the branch does not match this pattern,
   say so and ask for the number rather than guessing.
3. Pull the issue with its discussion: `gh issue view <#> --comments`.
4. Compare the issue's requirements against what already exists — review
   `git diff main...HEAD` and the working tree — before deciding what remains.
5. Summarize what's done vs. outstanding, then continue per **Working Style**
   (explain before building; confirm one step at a time).

Use `gh` for all issue/PR context (`gh issue view`, `gh pr view`,
`gh pr view --comments`). It is already authenticated.
