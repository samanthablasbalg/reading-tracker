# 0008. Time modeling: fuzzy `_on` dates vs exact `_at` instants

- Status: Accepted (superseded in part by [[0024-progress-logs-dated-to-a-local-day]] — `logged_at`
  is replaced by the `logged_on` local date; the activity-instant category now covers only
  `written_at`)
- Date: 2026-06-08

## Context

The model records times of two very different kinds, and treating them uniformly gets both wrong:

- **Reading-life dates are often imprecise.** "I read this as a kid, sometime in 1994." A plain
  `date` column can't hold that — it demands a specific day, so it forces me to invent precision I
  don't have and then either shows a lie ("January 1, 1994") or needs a side hack to hide the
  filler.
- **System and activity instants are exact.** When a row was created, or when a reading session
  actually happened, is a precise moment.

Two independent questions decide how any given time is stored: (1) is it _fuzzy or exact_, and (2)
_who sets it_ — the ORM, or me?

## Decision

Model time along two axes, signalled by a naming convention.

### Axis 1 — fuzzy (`_on`) vs exact (`_at`)

A **user-set business date is fuzzy**: stored as a real `date` _plus_ a `DatePrecision` companion
(`day` / `month` / `year`, default `day`). These carry the `_on` suffix.

| I enter       | Stored date  | Precision | Shown as         |
| ------------- | ------------ | --------- | ---------------- |
| 1994          | `1994-01-01` | `year`    | "1994"           |
| March 1994    | `1994-03-01` | `month`   | "March 1994"     |
| 15 March 1994 | `1994-03-15` | `day`     | "March 15, 1994" |

The value stays a genuine sortable, queryable `date` (1994 still sorts before 1995); the precision
flag only tells the UI how much of it to show, and the filler month/day is never displayed. This
applies to every `_on` field — `interested_on`, `tbr_added_on`, `started_on`, `finished_on` (on
engagements, see [[0005-engagements-lifecycle-entity]]), `acquired_on`, and `read_on` on standalone
entries — each gaining a `<field>_precision` companion column.

**System and activity instants are exact**: the `_at` suffix, and no precision (an exact instant has
no fuzziness to record). Durations are _derived_, never stored (see [[0004-derive-dont-store]]), and
**inherit the coarser operand's precision** — so a book discovered "1994" and started "1994" yields
"about a year," never a false "exactly 365 days."

### Axis 2 — within `_at`: audit vs activity

"Exact" does **not** mean "uneditable." Among the exact `_at` instants there are two kinds:

- **Audit timestamps** — `created_at`, `updated_at`, via a shared `TimestampMixin`. The ORM sets
  them; they describe the _row_ (when it was inserted or last modified); I never touch them.
- **Activity timestamps** — `logged_at` (on progress logs, see
  [[0007-progress-logs-activities-not-positions]]) and `written_at` (on reviews / blog posts). They
  describe when a real _activity_ happened, default to now, and are **user-editable and
  backdatable**. `logged_at` is the "edit date" affordance: read last night, log it this morning,
  and `logged_at` is last night while `created_at` stays this morning. They are equal at creation
  and diverge only on a backdate — which is exactly why `logged_at` is its own column, not a reused
  `created_at`.

So the suffix tells you fuzzy-vs-exact (`_on` fuzzy, `_at` exact); and within exact, audit `_at`s
are ORM-owned while activity `_at`s are mine to set. (The `_on` transition dates default sensibly at
the API layer — `tbr_added_on` defaults to today when a TBR engagement is created — but stay
editable and nullable, storing the real fact rather than reusing `created_at`, consistent with
[[0004-derive-dont-store]].)

## Consequences

**Makes easy:**

- "I read this in 1994" is first-class and honest — stored, sortable, and displayed at exactly the
  precision I gave it, no invented day.
- Backdating a session (`logged_at`) never corrupts the row's audit trail (`created_at`); the two
  cannot fight.
- Durations that don't over-claim accuracy, because they inherit the coarser precision.
- A self-documenting naming rule: `_on` ⇒ fuzzy business date, `_at` ⇒ exact instant.

**What we accept:**

- Every fuzzy date costs a companion `_precision` column — two columns per business date.
- Display and duration logic must read the precision, not just the date.
- "Exact `_at`" being editable for _activity_ timestamps is a subtlety the code and UI must respect
  — `_at` does not universally mean immutable.

## Alternatives considered

- **Plain `date` for business dates** — forces a day onto "1994," inventing precision and either
  displaying a lie or needing a separate flag anyway. The date+precision pair is that flag, done
  once and consistently.
- **Fuzzy dates as free text** ("1994", "March 1994") — loses sortability and queryability.
  Rejected; the date+precision pair keeps both.
- **Reuse `created_at` as the activity time** — conflates audit with activity, so backdating a
  session corrupts the row's insert time, and making it editable later needs a migration. Rejected;
  `logged_at` / `written_at` are their own columns.
- **A precision flag on `_at` instants too** — pointless; an exact instant has no fuzziness to
  record.

## Revisit when

A business _time_ (finer than a day) is ever needed — e.g. "started reading at 9pm" — which the
day-granularity `_on` model can't express and would have to extend. Or if a third category of
timestamp appears that is neither ORM-owned audit nor user-owned activity.
