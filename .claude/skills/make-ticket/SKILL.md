---
name: make-ticket
description: Create a GitHub issue for the reading-tracker project the correct way — drafted and approved first, then created with mandatory structure (on the project board, in the right column, parented to an epic). Use whenever the user asks to make/open/file/create an issue or ticket, capture a backlog item, or write up work as an issue. Prevents bare, unstructured issues.
---

# Making a ticket

This project tracks work on the **Reading Tracker** GitHub Project (project #1,
owner `samanthablasbalg`, repo `samanthablasbalg/reading-tracker`). Every issue
MUST live on that board, in a column, under a parent epic. A "bare" issue —
created with only a title and body, not on the board, with no parent — is wrong.
This skill exists because that keeps happening. Follow every step.

## Hard rules (do not skip, do not rationalize away)

1. **Draft before create.** Write the full issue body in chat and get the user's
   explicit approval BEFORE running `gh issue create`. Never create first and show
   after. If the user says "just make it," still show the draft first.
2. **No orphans — every issue gets a parent epic.** If no existing epic fits
   *squarely*, STOP and ask the user which epic it belongs under (or whether a new
   epic is needed). Do not invent a parent, do not guess, do not proceed unparented.
3. **Every issue goes on the board**, with its Status column set.
4. **Pick the artifact by destination — never the over-built in-between:**
   - **Stub** (default for a fresh capture) = title + one-line problem statement +
     a few rough acceptance bullets. Nothing else: no scope/constraints/out-of-scope
     sections, no schema, no firm criteria. Open questions are fine and expected.
     → Column: **Backlog**.
   - **Refined** = produced only when the user says the work is being pulled to
     build: every open decision resolved with the user, firm scope, concrete
     acceptance criteria, known constraints/landmines, ZERO open questions.
     → Column: **To Develop**.
   - If you're handed a stub request, write ~3 lines and stop.

## Procedure

1. **Decide stub vs refined** from what the user asked for (default: stub).
2. **Find the parent epic.** List current epics and match:
   `gh issue list --repo samanthablasbalg/reading-tracker --label epic --limit 50`
   If none fits squarely → ask the user. Do not continue without a parent.
3. **Draft the body** in chat (stub = thin; refined = full). Get approval.
4. **Create the issue** (step 1 of recipes below). Capture its number.
5. **Link it to the parent epic** as a sub-issue (step 2).
6. **Add it to the board and set the column** (step 3).
7. **Set a milestone ONLY if the user said it's scheduled** (Walking Skeleton or
   MVP). Otherwise leave it unmilestoned (step 4).
8. **Verify** (step 5): re-read the issue, confirm parent + board membership +
   column + milestone, and report what you set. Do not assume the writes landed.

## Recipes (real IDs for this project)

Run `gh` bare otherwise, but these writes need captured output, so the command
substitution below is expected.

**1. Create the issue:**
```
gh issue create --repo samanthablasbalg/reading-tracker \
  --title "<title>" --body-file /tmp/ticket-body.md
```
Note the new issue number from the URL it prints (e.g. `.../issues/75` → `75`).

**2. Link to parent epic** (PARENT = epic's issue number, CHILD = new issue number).
The sub-issue API needs the child's integer **database id**, sent typed with `-F`:
```
child_id=$(gh api repos/samanthablasbalg/reading-tracker/issues/<CHILD> --jq .id)
gh api repos/samanthablasbalg/reading-tracker/issues/<PARENT>/sub_issues -F sub_issue_id="$child_id"
```

**3. Add to the board and set Status column:**
```
item_id=$(gh project item-add 1 --owner samanthablasbalg \
  --url https://github.com/samanthablasbalg/reading-tracker/issues/<CHILD> \
  --format json --jq .id)
gh project item-edit --project-id PVT_kwHOAV2sIM4Bak3a --id "$item_id" \
  --field-id PVTSSF_lAHOAV2sIM4Bak3azhVbe2E \
  --single-select-option-id <STATUS_OPTION_ID>
```
Status option IDs: **Backlog** `d8528043` · To Refine `e2566a58` ·
**To Develop** `36ff1833` · In Progress `1e2e38c0` · Done `b578580f`.
(Stub → Backlog `d8528043`. Refined → To Develop `36ff1833`.)

**4. Set milestone (only if scheduled):**
```
gh issue edit <CHILD> --repo samanthablasbalg/reading-tracker --milestone "MVP"
```
Milestones: `Walking Skeleton`, `MVP`.

**5. Verify:**
```
gh issue view <CHILD> --repo samanthablasbalg/reading-tracker
```
Confirm `parent:`, `projects:` (with the column), and `milestone:` are what you
intended. Report the result.
