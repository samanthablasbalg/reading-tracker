# 0023. Per-user data isolation via Postgres row-level security

- Status: Accepted
- Date: 2026-06-22

## Context

The app is going multi-user — not open registration, but a small allowlist (me, my partner, a
handful of invited friends and a throwaway test account). The moment a second person's data lives in
the same database, one question has to be answered before any of the auth or users work is built:
**how do we guarantee a user only ever reads or writes their own rows?**

[[0002-books-are-user-agnostic]] did the hard structural part already — the shared work (`books`,
`authors`, `editions`) carries no personal data, so isolation only has to wrap the **personal**
tables (the reading experience, ownership, and anything else stamped with an owner). Joins _out_ to
the shared reference tables must stay unrestricted.

There are two places the isolation rule can live:

- **Application-level scoping** — every query that touches a personal table adds
  `WHERE user_id = <current user>`, enforced in Python/SQLAlchemy.
- **Postgres row-level security (RLS)** — the database carries policies on each personal table; the
  request tells the database who the current user is, and the database refuses to return or accept
  anyone else's rows regardless of what the query says.

The deciding considerations:

- **This is isolation of real people's personal data, where fail-closed is worth more than in an
  ordinary feature.** With app-level scoping, the safety property rests on _every_ query remembering
  the filter; a single forgotten `WHERE` is a silent cross-user leak, and completeness across a
  growing set of endpoints can't really be proven. RLS makes a forgotten filter harmless — even a
  naked `SELECT * FROM engagements` returns only the current user's rows — which is one invariant
  that a single test can prove.
- **Deferring RLS is not cost-neutral, despite being schema-additive.** Adding RLS later is purely
  additive DDL (no table rewrite, no destructive migration), but "additive" is not "cheap to defer."
  The _work_ is identical whenever it's done; deferring only moves it to a worse moment. Installed
  now, the migration runs against an empty/seed database — a wrong policy is caught in dev with no
  consequences. Installed after launch, that same migration runs against live data for real users,
  becomes a coordinated cutover of the connection role and request lifecycle that affects every
  query at once, opens an interim window where a forgotten filter is a real leak, and leaves the
  unanswerable question of whether anything already leaked. The cleanest time to install isolation
  plumbing is **before there is any data to endanger.**

The counter-case for app-level scoping is real and was weighed: it uses tools already understood,
keeps the users milestone a tighter slice, and the threat model is mild (a few trusted, invited
people, where the failure guarded against is an accidental bug, not an adversary). It was rejected
because the fail-closed guarantee on personal data is worth the machinery, the machinery cost is
front-loaded and bounded, and — decisively — paying it now avoids paying _more_ later.

## Decision

**Enforce per-user isolation in the database with Postgres row-level security**, applied as a
standard recipe to every table that carries an ownership column:

1. **A policy per personal table, keyed on a per-request session variable.** Each policied table
   gets an RLS policy whose `USING` (reads) and `WITH CHECK` (writes) clauses compare the row's
   owner to `current_setting('app.current_user_id')`. The application pushes the authenticated
   user's id into that variable at the start of each request; the policy reads it back inside the
   database.

2. **The variable is set with `SET LOCAL`, inside a per-request transaction.** Connections are
   pooled and reused across requests, so a plain `SET` would persist on the connection and leak the
   previous user's identity into the next request. `SET LOCAL` is transaction-scoped and clears
   automatically when the request's transaction ends, so each request starts clean. This requires
   the request/session lifecycle to wrap each request in a transaction and set the variable once,
   after authentication.

3. **The application connects as a restricted database role** — not the table owner, not a
   superuser, and without `BYPASSRLS`. A table's owner and superusers bypass policies, so the app
   must connect as a lower-privilege role for the policies to apply at all.

4. **Policies are `FORCE`d.** `ALTER TABLE … FORCE ROW LEVEL SECURITY` makes policies apply even to
   the table owner, closing the most common accidental bypass — including the trap where tests
   connect as the owner and RLS silently does nothing. (A true superuser or `BYPASSRLS` role still
   bypasses even `FORCE`, which is why the app and test roles must be neither.) `FORCE` is baked
   into the migration that adds each policy, so protection is on by default rather than dependent on
   which role connects.

5. **The test database exercises the same restricted role.** Per [[0014-dedicated-test-database]]
   and [[0018-e2e-testing-database-strategy]], the test setup must connect as the restricted role
   (and/or rely on `FORCE`) so policies are actually exercised — otherwise the central guarantee is
   never tested.

The shared reference tables (`books`, `authors`, `editions`) get **no policy** and stay readable by
everyone. The exact set of personal tables that receive policies is whatever ends up carrying an
ownership column when the users model and ownership FKs are added — the rule is "every owned table
gets a policy + `FORCE`," and the canonical list (and how transitive ownership, e.g. a progress log
owned via its engagement, is expressed in the policy) is settled with the FK design in that work,
not here.

RLS is the **guarantee**, not a convenience: application queries will still naturally read scoped
data, but correctness no longer depends on their doing so.

## Consequences

**Makes easy:**

- A forgotten `WHERE user_id = …` cannot leak across users — the database refuses. The safety
  property stops depending on per-query discipline.
- One strong, provable invariant: a test can connect as the restricted role, set a user, and confirm
  an unfiltered `SELECT` returns only that user's rows.
- Inserts are guarded too — `WITH CHECK` rejects rows claiming another user's id.
- New personal tables are protected by adding a policy in their own migration; the protection is
  structural, applied once per table, not re-earned in every query.
- Installed while the database holds no real data, so getting a policy wrong is a dev-loop fix, not
  a live incident — and there is never an interim window of app-level-only exposure.

**What we accept:**

- The request/session lifecycle must be reworked so every request runs in a transaction and
  `SET LOCAL`s the current user. This is the genuinely new machinery.
- A dedicated restricted database role to provision and connect as, plus `FORCE` on every policied
  table — added operational surface, especially around deployment.
- The connection-pooling footgun must be handled correctly (`SET LOCAL`, never plain `SET`); getting
  it wrong is a cross-request identity leak.
- Test infrastructure must connect as the restricted role to exercise policies; running tests as a
  privileged role would silently disable RLS and give false confidence.
- RLS answers _whose rows can I see_ (isolation). It does **not** answer _what may this account do_
  (authorization) — e.g. who may edit shared reference data like a book's default edition. That is a
  separate axis, solved by an application-level role/flag if and when it's needed, not by RLS or by
  database roles.

## Alternatives considered

- **Application-level scoping only** — every query filters by the current user in Python. Simpler
  and uses familiar tools, but enforcement is smeared across every query, a forgotten filter
  silently leaks, and completeness can't be proven. Defensible for a tiny trusted app; rejected
  because fail-closed on personal data is worth the machinery and the cost is front-loaded.
- **Ship app-level scoping now, add RLS later** — rejected as a false economy. It does not reduce
  the work; it relocates it to a riskier moment: the same machinery _plus_ a production migration
  against live data, a coordinated role/lifecycle cutover, an interim leak-exposure window, and
  uncertainty about whether data already leaked.
- **Both: app-level scoping primary, RLS as a backstop** — viable and safe, but RLS alone already
  provides the guarantee; making app-level filtering load-bearing _and_ maintaining RLS is redundant
  effort. Queries will read scoped data incidentally; RLS is what makes it guaranteed.
- **Map each application user to a Postgres role** — rejected. It breaks connection pooling, doesn't
  scale, and conflates app identity (a `users` row from Google SSO) with the single database
  credential the backend connects as.

## Revisit when

- **An admin needs to see or edit all users' personal data** (support/"fix it for them" tooling).
  That requires a deliberate bypass — an admin-aware policy or a `BYPASSRLS` path — and is an
  additive change to make then, not now.
- **Public or anonymous pages need to read data behind these tables.** Policies would need a defined
  behavior when there is no current user (a null `current_setting`), rather than assuming every
  request is authenticated.
