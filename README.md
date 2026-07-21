# Rainbow Sam Reads 🌈📚

I'm a career SDET with over twelve years of experience, and in my spare time I am an avid reader. I
read 100+ books a year, several going at once, across print, ebook, and audiobook. I spend a huge
amount of time in multiple reading tracking apps, logging progress every day across my various reads
and meticulously curating tags for my stats. I use different trackers for different features, but no
matter which one I use, it never quite fits how I actually read. As an example, I'll start a book on
audio with my partner, lose the thread, re-read a chunk with my eyes to catch up, then switch back
to audio. I've never used a tracker that lets me both accurately track this as one single read _and_
lets me log all of the pages and minutes into my yearly totals.

For years that was just a fact of life, but a few things have been changing recently. In my latest
position at work, I have rapidly expanded my responsibilities from writing and maintaining automated
tests to building CI pipelines, automations between Playwright, Jira and Slack, and whole Docker
stacks from scratch. It was slowly dawning on me that I'd actually been "building" all along. As
part of this new role, I have become a serious Claude Code user, which stretched what I could
realistically take on by myself and has allowed me to step into new arenas that I hadn't previously
explored. All of this came together in one fateful moment where a years-old, tiny, quality-of-life
issue in one of my trackers made my brain go: _wait a minute, what if I just... try to build the
reading tracker of my dreams myself?!_

So I am! It's the first app I've ever built for real users, starting with me. Curious? It's live at
**[rainbowsamreads.fun](https://rainbowsamreads.fun)** — the app is invite-only while it's early, so
if you want to poke around inside, email me at **rainbowsamreads@gmail.com** and I'll add you.

## What it does

I'm a recovering perfectionist, so my instinct was to hide this until it was complete, which, given
how much of the data model I built for features that don't exist yet, could have taken years.
Instead, I made myself define an actual MVP: the smallest feature set that I could use for daily
progress tracking. That is what went live in my first deployment.

Today you can sign in with Google, add books, track your reads, log daily progress, and rate and
review. It is still pretty rough around the edges, but I am adding new improvements and features
nearly every day.

It's built mobile-friendly first — a phone is where I do most of my reading-tracking, so that's the
experience I design around, with the desktop layout built just as deliberately. I even run a
separate staging environment so I can test in-progress work on my real phone before it ships.

What's next is the part I actually built this for: tracking the reading no app has ever fit right.
Multi-format and non-linear progress, a proper TBR, book and author pages, ownership, stats, as well
as some infrastructure improvements like a proper local Docker setup and migrating to Orval. It's
all in the [roadmap](docs/roadmap.md).

## How it's tested

Testing is the discipline I bring to building, so it's not an afterthought:

- **Backend:** pytest against a [dedicated test database](docs/decisions/0014-dedicated-test-database.md)
  that resets the schema, runs migrations, and truncates between tests — every run starts from a
  known state.
- **Frontend:** Vitest via Angular's runner, with Angular Testing Library for component specs.
- **End-to-end:** Playwright with page objects and fixtures, on a
  [purpose-built e2e database strategy](docs/decisions/0018-e2e-testing-database-strategy.md), with a
  test-auth path so runs don't depend on live Google login.
- **Static analysis:** mypy (strict), Ruff, ESLint, and Prettier — wired into pre-commit and re-run
  in CI, so nothing merges without passing.

## Built with an AI assistant

I'm building this with Claude Code, and learning to build as I go. How I work with it is written up
in my [CLAUDE.md](CLAUDE.md). I strictly require that every change is explained before any code is
written, so I actually gain understanding of what is going in and best practices for frameworks and
languages I've never used before. As I've gotten more comfortable, I've been writing and debugging
more of it myself, and I've got a queue of tickets I'm now taking on solo.

A decade-plus in testing has given me strong instincts for what good software looks like, and those
carry over even where the specifics are new. A lot of this never makes it into the commit history. I
get real satisfaction every time I catch poor or fragile code patterns and send them back before
they land. I'm learning a lot, and I'm proud of what's here.

## The stack

Python · FastAPI · SQLAlchemy · Alembic · PostgreSQL 18 · Angular 22 · Angular Material · Tailwind
CSS

## Dig in

- **[Architecture](docs/architecture.md)** — the system and data model as one story
- **[Development guide](docs/development.md)** — how to run the whole stack locally
- **[Decision records](docs/decisions/README.md)** — the _why_ behind every significant choice
- **[Learnings](docs/learnings/README.md)** — what I've picked up building hands-on
- **[Roadmap](docs/roadmap.md)** — where it's going
