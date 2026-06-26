---
name: worktree
description: Open a worktree for a branch. Use whenever the user says "make me a worktree", "open a worktree", or "create a worktree" — with or without a branch name.
---

# Opening a worktree

## If the user provides a branch name

The branch already exists on origin (they copy it from GitHub's "Create a branch"
flow). Run these three steps in order:

1. **Fetch the branch:**
   ```
   git fetch origin <branch-name>
   ```

2. **Enter the worktree** (EnterWorktree tool, `name=<branch-name>`). This creates
   the worktree and gives the session ownership of it so ExitWorktree can clean it
   up correctly. It will land on a generated branch name — that's fine, step 3
   fixes it.

3. **Switch to the real branch** (inside the worktree):
   ```
   git switch <branch-name>
   ```

Do NOT use `git worktree add` + `EnterWorktree path=...`. That pattern breaks
cleanup: ExitWorktree will not remove a worktree entered via `path`, leaving
orphaned worktrees behind.

## After entering the worktree (always)

Run these installs before starting any work — `node_modules` is not tracked in
git so worktrees always start without it:

```
cd frontend && npm install
cd ../e2e && npm install
```

Do both even if the task only touches one of them.

## If the user does not provide a branch name

Ask: "Do you have a branch name you want to use?"

- **Yes** → follow the branch-name steps above.
- **No** → just call `EnterWorktree` with no `name` argument (a name will be
  generated). No fetch, no switch needed.
