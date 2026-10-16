# Mandatory Branch Gate (for implementing skills)

> [!CAUTION]
> A **blocking gate, not a reminder.** Any skill that writes application code completes it before creating or editing its first file. "Confirm you are on a branch" has failed in practice (the agent sees `main`, notes it, and implements anyway), so the instruction is to **create** the branch.

**Step 0 — Ticket argument?** If invoked as `/<skill> <ticket>` (`F0135`, `T00004`), that ticket names a remote branch that must be fetched and analyzed first ([ticket-numbering.md §8](./ticket-numbering.md#8-resolving-a-ticket-argument-to-its-branch)). Several matches (`F0135`, `F0135-fixed`, `f0135`): **stop and ask**. Skipping this means working on whatever tree you happened to start in.

**Step 1 — Read the branch:** `git rev-parse --abbrev-ref HEAD`

**Step 2 — Act on it:**

| Current branch | Action |
| :--- | :--- |
| `main` / `master` | **Create and switch to the branch now.** Do not ask: [git-workflow.md](../core/git-workflow.md) Rule 3 already forbids working here, so creating it is compliance. |
| The ticket's own branch, or a correctly-prefixed branch for **this** work | Continue on it. Do not create a second branch. |
| A branch for **different** work | **Stop and ask.** Mixing two changes into one history is not recoverable by the agent. |
| Detached HEAD | **Stop and ask.** Commits here are unreachable. |

**Step 3 — Name it.** Ticket → `git checkout -b T00001`: no prefix, no slug, so a later skill reads the branch and lands on the right spec. No ticket → `<prefix>/<domain>-<feature-kebab>` (`bugfix/timesheet-late-log-miscalculation`, `refactor/payroll-handler-extraction`); no dates. **One branch per ticket**: frontend, backend, and the fixes after verification all share it. `T#####-<short-slug>` only when a second branch is unavoidable (the first is already merged), and say why. Numbers are per project, so `T00001` in one repo is unrelated to `T00001` in another.

**Step 4 — Uncommitted changes.** `git checkout -b` carries them onto the new branch, which is normally right. Run `git status --short` and **tell the user what is carried over**. Never `git stash`, `git checkout -- .`, `git reset`, or `git clean` to get a clean tree, and never commit pre-existing changes to make room: they may be someone else's work. If they look unrelated to your task, say so and ask before switching.

**Step 5 — State it.** Name the branch in your first message after the gate.

> [!IMPORTANT]
> The gate does not authorize `git commit`, `git push`, `git merge`, or any history rewrite. Do those only when explicitly asked.
