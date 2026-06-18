---
name: playwright-new-test
description:
  Author a new, verified Playwright end-to-end test from a github issue, a markdown test plan, or a
  plain-English description. Triages whether the request is really an e2e (Playwright) concern
  before writing anything. Use when the user asks to write, create, or add a Playwright or e2e test.
when_to_use:
  Auto-invoke when the user says "write a Playwright test", "add an e2e test", "create a test for
  <feature>", "test that <behavior>", or points at a issue/plan and asks for an e2e test.
allowed-tools: Bash(npx playwright test:*), Bash(npx playwright-cli:*), Bash(npm test:*)
---

# Author a new Playwright e2e test

Turn a GitHub issue, a markdown test plan, or a plain-English description into one working, verified
Playwright test for the reading tracker app.

## How this skill works (read first)

- **You run in the main conversation loop.** Do NOT spawn sub-agents — the user needs to see
  progress and step in. Work the steps yourself, in order.
- **CLI-first.** Drive the browser with `npx playwright-cli` through the seed test; it **prints the
  Playwright TypeScript for every action** — that emitted code is what goes into the Page Object /
  spec.
- **The live snapshot is the source of truth for locators.** Angular source is a _hint_.
- **Conventions are auto-loaded** from `.claude/rules/playwright-e2e.md` (it loads whenever you
  touch `e2e/**`). This file is the _procedure_; that rule is the _standards_ — follow both, and
  don't restate the rule's contents here.
- **Always tear down** the background `--debug=cli` run and `playwright-cli close` before you finish
  or hand back.
- **Stop and ask — don't spin.** If the _environment_ is broken — the app is a blank screen or
  won't boot — STOP immediately and tell the user exactly what you saw. Do NOT
  re-attach, re-snapshot, retry, or keep driving. A broken app is the user's to fix, not yours to
  work around; spinning on it wastes their time and yours.

## Step 0 — Triage the test type

Decide whether this is actually a Playwright e2e concern before writing anything:

- **Playwright (this skill):** real-browser user journeys, navigation, auth-gated flows,
  cross-component behavior, anything needing a rendered DOM + backend.
- **Vitest** (`@testing-library/angular` + `vitest`): pure logic, services, pipes, a single
  component's behavior in isolation. Faster and closer to the code.

If the request is better served by Vitest, **say so and recommend that instead** — proceed as e2e
only once the user confirms, or when it's clearly a browser-level journey.

## Step 1 — Gather requirements

Resolve the input into a concrete scenario:

- **GitHub issue** (e.g. `#89`): obtain the ticket's summary, description, and acceptance criteria.
- **Markdown plan**: a file path (anywhere) or pasted inline.
- **Plain description**: use it directly.

Pin down — and **stop and ask** if unclear: the feature area and specific user-visible behavior;
preconditions (assume authenticated + fresh app shell); any artifacts needing cleanup. If the input
is too vague to build a scenario, clarify inline.

<!-- FUTURE: when the `playwright-plan` skill exists, offer to route there first to
     produce a plan, then come back here to generate. -->

## Step 2 — Orient (do NOT scan the whole suite)

- The conventions rule auto-loads when you read `e2e/` files; follow it.
- Read the relevant Angular component template(s) under `src/app/` to understand the feature and
  draft **candidate** locators. Flag dynamic / PrimeNG / icon-only elements — those need live
  confirmation. If a flagged element clearly has **no usable hook** in source (icon-only button with
  no `aria-label`, a detached `<label>`), do the Step 4 a11y fix **now, before driving** — so the
  snapshot already carries the hook and you derive the real locator in one pass instead of snapshot
  → find nothing → fix → re-snapshot.
- Open an existing Page Object **only if one already exists for this feature** (to extend it). Don't
  read unrelated tests/POMs.

## Step 3 — Drive the live app (CLI-first)

You don't need to start the app — the config's `webServer` brings it up on `http://localhost:4201`
if nothing's there (first run can be slow while it boots).

Drive through the seed so one command gives a single paused session.

**Launch it with the Bash tool's background mode — a PLAIN command, NEVER a shell `&`:**

- ✅ Bash tool, `run_in_background: true`, command exactly:
  `npx playwright test --project=seed --debug=cli`
- ❌ `... --debug=cli &` (or `2>&1 &`, `$!`, env prefixes). The `&` **orphans the process**: the
  shell returns exit 0 immediately (looks "completed" but the test is still running, detached), the
  harness can't track it, and **teardown can't stop it**. This is the #1 way this skill breaks.
  Plain command + `run_in_background` only — nothing appended.

```bash
# 1. Background; wait for "Debugging Instructions" + a session id like tw-abcdef.
npx playwright test --project=seed --debug=cli

# 2. Attach (give the WebSocket ~3s; retry once if the first command errors), then resume —
#    that runs the seed (navigate to /) and stops at page.pause(), leaving the app open to drive.
npx playwright-cli attach tw-abcdef
npx playwright-cli resume

# 3. Rehearse the scenario; each action echoes the Playwright TS to reuse.
npx playwright-cli snapshot                     # refs = source of truth
npx playwright-cli click e15
npx playwright-cli fill e3 "hello"
npx playwright-cli --raw generate-locator e15   # robust locator for the POM
```

Confirm every candidate locator against the snapshot. The seed ends in `page.pause()` so the page
stays open after `resume` — without it the test would finish and close the session before you can
drive it (don't remove it). It runs on plain `@playwright/test` and doesn't truncate, so it lands on
whatever is already in the e2e DB; add what you need through the UI or `ApiClient`. **When done:
`npx playwright-cli close` and stop the tracked background task — never `pkill`/`kill`, never leave
a paused test behind.**

## Step 4 — Improve a11y when a locator is weak

Timing: **fix first when the gap is already visible from source (before Step 3)** — see Step 2 — so
the snapshot has the hook; fix **reactively** if you only discover the gap while driving. Either
way: if an element can't be located robustly, **fix the Angular source semantically** (proper
`role`, `<label for>`, or `aria-label`) rather than shipping a brittle locator. Keep edits minimal
and matching the component's style. (The rule covers what's allowed; e.g. no `data-testid`.)

## Step 5 — Build / extend the Page Object, then write the spec

Both follow the auto-loaded conventions rule — don't restate its rules here. Skill-specific
mechanics:

- **POM** at `e2e/page-objects/<feature>.page.ts`: the role-based locators the CLI emitted become
  `readonly Locator` props; add action/verification methods. Extend an existing POM if one fits.
  (Conventions are in the auto-loaded rule; existing POMs under `e2e/page-objects/` are the model.)
- **Spec** at `e2e/tests/<feature>/<name>.spec.ts`: import `test`/`expect` from the `fixtures/` tree
  (never `@playwright/test` directly), plus the POM. One `test.step()` per action, the step
  description as its title. All element access through the POM.

## Step 6 — Run & fix (bounded)

```bash
npm test -- tests/<feature>/<name>.spec.ts --reporter=dot
```

Up to **3 fix-and-rerun cycles**. **Timeouts are almost never the real problem** — if it times out,
the element probably isn't appearing at all; fix the **locator in the POM** (re-derive from a fresh
`playwright-cli snapshot`) or improve source a11y (Step 4) rather than extending timeouts.

**Stop and ask the user** if: the 3 cycles are exhausted; you can't find a working locator; you're
unsure whether the behavior is a bug; or you're guessing rather than working from
snapshot/console/network evidence. State what you tried, what failed, what would unblock you.

## Step 7 — Validate

1. Green run: `npm test -- tests/<feature>/<name>.spec.ts --reporter=dot`
2. Stability: same command + `--repeat-each=10` — any failure means flaky = **not done**.
3. **Quality gate:** the test is not done if it breaks any item in the `## Quality gate` of
   `.claude/rules/playwright-e2e.md`. Check it against that list (don't rely on memory).
4. Format: `npm run format` (also enforced on commit via husky/lint-staged).

Confirm no background `playwright` / `playwright-cli` process is still running, then summarize what
you created (POM + spec) and the validation results.
