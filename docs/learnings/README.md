# Learnings

These notes come out of a shift in how I'm building. I've started moving away from the strict
explain-before-any-code workflow in my [CLAUDE.md](../../CLAUDE.md) toward asking the assistant for
just enough of a hint that I can write and debug it on my own, with the AI there as a backstop if I
get stuck on the concepts that are brand new to me. This isn't an exhaustive log of every time I've
done that. But when something comes up that I want to make sure sticks, I record it here, so I
recognize it the second or third time I run into it.

- **[Progress Log Sheet Refactor](<2026-06-20 Progress Log Sheet Refactor.md>)** (2026-06-20) —
  turning a pile of boolean flags into one state machine: modeling state as a single signal, naming
  computeds honestly, and deciding where branching logic belongs.
- **[Audio Progress Log Refactor](<2026-06-23 Audio Progress Log Refactor.md>)** (2026-06-23) —
  cleaning up an audio-logging bolt-on: collapsing duplicated branches, wrangling TypeScript literal
  types, and not solving problems that don't exist.
