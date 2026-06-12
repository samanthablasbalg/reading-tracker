# 0013. Google Books access goes through the backend (proxy + re-fetch by ID)

- Status: Accepted
- Date: 2026-06-11

## Context
We import books from Google Books into our catalog (#5). Two operations are
involved: **search** (read) and **import** (write to `books`).

- Import writes persistent catalog rows. The browser is an untrusted client; if it
  sent the full book payload, it could store spoofed or mismatched data.
- We may later add a `GOOGLE_BOOKS_API_KEY` for higher limits. A key embedded in
  frontend code is world-readable (view-source / network tab).
- Google's volume JSON is messy (nested `volumeInfo`, fuzzy dates, nullable
  fields) and must be mapped to our schema. Import needs that mapping server-side
  regardless.

## Decision
All Google Books access lives in the backend (`app/services/google_books.py`).
The frontend talks only to our own endpoints — `GET /books/search` and
`POST /books/import` — never to Google directly.

Import sends only a `google_books_id`. The server re-fetches that volume from
Google itself and maps it; it never trusts client-supplied book data. Google stays
the single source of truth for catalog content.

## Consequences
- **Easier:** one Google client, one place for the key, one copy of the
  volume→schema mapping; central caching, rate-limiting, and error mapping
  (Google 404 → our `404`, upstream failure → `502`); the write path is
  correct-by-construction even if this ever goes multi-user.
- **Accepted cost:** one extra network hop (browser → backend → Google), and
  search traffic consumes our server rather than only Google's. Negligible at
  personal, human-paced scale.

## Alternatives considered
- **Frontend calls Google directly for everything** — rejected: leaks any API key
  into the bundle, duplicates the messy mapping in TypeScript, and can't centralize
  caching or error handling.
- **Hybrid: frontend searches Google directly, backend still re-fetches by ID on
  import** — genuinely viable; write integrity is preserved because the trust
  boundary is on the *write*, not the search. Rejected *for now* because at
  single-user scale its wins (server offload, per-IP quota distribution, one fewer
  hop) are worth nearly nothing, while it costs a second copy of Google's quirks in
  TypeScript.

## Revisit when
- This goes multi-user or search volume gets high (e.g. live search-as-you-type at
  scale): reconsider the hybrid, or proxy-plus-edge-cache, to offload search
  traffic and spread quota across users' IPs.
- We add a Google API key and want browser-side search: that would force either
  key referrer-restriction or the proxy we already have.
