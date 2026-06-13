# Use Cases

Real scenarios that drove design decisions and double as test cases. Each scenario
should be fully representable in the data model without hacks or workarounds — if
it isn't, the model is wrong.

Organised by theme. The data model consequences are noted for each.

---

## Ownership vs reading

### Death of the Author (Nnedi Okorafor) — two copies, one read
Added to TBR with no format in mind. Bought the audiobook on Libro.fm when it was
on sale. Later received the hardcover as a gift. Read the audiobook to completion
and reviewed it. The hardcover is still sitting unread on the shelf.

- One engagement: `interested` → `tbr` → `finished` via audio, rated and reviewed.
- Two owned copies: audiobook (purchased) and hardcover (gift) — future `owned_copies`.
- The hardcover has no reading status. It was never TBR'd; it can't get stuck there.
- Book standing: read once, owned twice. Two copies are not two reads.

**Tests:** Book can be marked finished while an unread owned copy exists. Rating and
review attach to the engagement, not the book. Book standing ("read & loved · 2
copies owned") is derived correctly.

---

## Format

### Series with a partner — format known at TBR stage
A series listened to as audiobooks with a partner. Format is intentional before
reading begins.

- Engagement created at `interested` or `tbr` with `formats` = {audio} already set.
- Format is optional early — set it when you know it, leave it empty when you don't.

**Tests:** `formats` can be set on an `interested` or `tbr` engagement. Empty
`formats` on an unstarted engagement is valid.

### Gift received, read in a different format
Received a book as a paperback gift. Decided to listen to the audiobook instead.

- One engagement. `formats` = {audio} when reading begins, regardless of how the
  copy was acquired.
- Acquisition format (paperback, in `owned_copies`) is independent of reading format.

**Tests:** `formats` on the engagement is independent of the format of any owned copy.

### A Desolation Called Peace — mixed units, one engagement
Audiobook with a partner. Got lost at 14% and read that section as a library ebook.
Listened on. Got lost again around 60% and re-read ~28 pages. Near the end re-read
~30 pages.

- One engagement, finished. `formats` = {audio, digital}.
- Forward listening = new-ground minute logs.
- Each re-read section = re-coverage page log: volume counts, completion stays flat.
- All pages and minutes counted. One journal timeline. No second edition, no fake DNF.

**Tests:** A single engagement can hold both page and minute logs. Re-coverage logs
count toward volume stats but not completion. `formats` accumulates correctly as
formats are used.

### Immersive reading (Nicola Griffith) — genuine combo
Listening while following a physical book, plus a separate ebook before bed.

- One engagement. `formats` = {audio, print, digital}.
- Immersive sessions logged in minutes. Bedtime sessions logged in pages.
- Shared completion % stitches both log types into one position line.

**Tests:** Three formats on one engagement. Mixed-unit logs produce a correct
combined completion %.

---

## Re-reads

### Circe — deliberate re-read in a different format
Read as an audiobook years ago. Now want to re-read in print.

- Two engagements: the old one (`finished`, `formats` = {audio}) and a new one
  (`tbr`, `formats` = {print}) for the planned re-read.
- The old engagement is never touched. The new one starts its own lifecycle.

**Tests:** Multiple engagements per book. Old engagement remains `finished` and
unmodified when a new one is created. Each engagement has its own review and rating.

---

## Progress logging

### Comics omnibus — non-linear but all new ground
Read pages 1–150, jump to 300–350, back to 151. Page numbers are non-monotonic but
every page is new content.

- All logs are new-ground. Completion = cumulative new-ground ÷ total, climbs
  cleanly to 100%.
- Page-number-as-position is simply not used here.
- Page ranges preserve enough data to build a coverage map later (deferred UI work).

**Tests:** Non-monotonic page ranges with `new_ground=True` produce correct
completion %. UI coverage map data (deferred).

---

## Fuzzy dates

### "I read this in 1994" — year-only date
Read a book sometime in 1994 but don't remember when.

- `started_on` = `1994-01-01`, `started_on_precision` = `year`.
- Date is sortable; precision tells the UI not to display month or day.

**Tests:** Year-precision dates sort correctly relative to other dates in 1994.
UI displays "1994" not "January 1, 1994."

### Google Books partial publication date
Google Books returns `"2019-03"` (year + month, no day) for a book's publication date.

- `publication_date` = `2019-03-01`, `publication_date_precision` = `month`.

**Tests:** Month-precision dates imported from Google Books store and display correctly.

---

## Book sources (user-extensible)

### New source not in the seed list
A friend loans you a book. "Loan" isn't in the initial `book_sources` seed data.

- User adds "loan" via the UI → new row in `book_sources`, no migration needed.
- Engagement's `source_id` points at the new row.

**Tests:** New `book_source` row can be created via the API. Engagement can
reference it immediately after creation.
