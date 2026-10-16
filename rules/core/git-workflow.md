# Git Workflow (always-on)

The agent formats commits and isolates work on branches; the user approves, merges, and releases.

## Rules

1. **Branch names.** Work with a ticket branches on **the ticket number itself**: `T00001`, matching `.agents/specs/<project>/T00001/` character for character ([ticket-numbering.md §6](../conditional/ticket-numbering.md#6-the-branch-is-the-ticket)). The remote also carries the team's `F####` branches (`F0135`); they are valid ticket branches, not malformed ones ([§8](../conditional/ticket-numbering.md#8-resolving-a-ticket-argument-to-its-branch)). Work with **no** ticket is prefixed by its focus:
   - `feature/` new pages, modules, features · `bugfix/` active bugs, exceptions, visual glitches · `refactor/` cleanup and optimization without new features · `hotfix/` critical production patches.
2. **Conventional Commits**: `type(scope): description`, with `feat`, `fix`, `refactor`, `docs`, `test`. Descriptive, never "update code" or "fix styling". No `T00001:` prefix: the branch already carries the ticket.
3. **No direct commits to `main` / `master`.** Every change goes through a branch and a merge request.

PRs carry the ticket in the title (`T00001 — Loan amortization schedule`) and the spec path in the body. Keep one ticket per branch; check the staged range before committing so nothing unrelated rides along.

## Mandatory Branch Gate (for implementing skills)

> [!CAUTION]
> A **blocking gate, not a reminder.** Any skill that writes application code completes it before creating or editing its first file. "Confirm you are on a branch" has failed in practice (the agent sees `main`, notes it, and implements anyway), so the instruction is to **create** the branch.

**Step 0 — Ticket argument?** If invoked as `/<skill> <ticket>` (`F0135`, `T00004`), that ticket names a remote branch that must be fetched and analyzed first ([ticket-numbering.md §8](../conditional/ticket-numbering.md#8-resolving-a-ticket-argument-to-its-branch)). Several matches (`F0135`, `F0135-fixed`, `f0135`): **stop and ask**. Skipping this means working on whatever tree you happened to start in.

**Step 1 — Read the branch:** `git rev-parse --abbrev-ref HEAD`

**Step 2 — Act on it:**

| Current branch | Action |
| :--- | :--- |
| `main` / `master` | **Create and switch to the branch now.** Do not ask: Rule 3 already forbids working here, so creating it is compliance. |
| The ticket's own branch, or a correctly-prefixed branch for **this** work | Continue on it. Do not create a second branch. |
| A branch for **different** work | **Stop and ask.** Mixing two changes into one history is not recoverable by the agent. |
| Detached HEAD | **Stop and ask.** Commits here are unreachable. |

**Step 3 — Name it.** Ticket → `git checkout -b T00001`: no prefix, no slug, so a later skill reads the branch and lands on the right spec. No ticket → `<prefix>/<domain>-<feature-kebab>` (`bugfix/timesheet-late-log-miscalculation`, `refactor/payroll-handler-extraction`); no dates. **One branch per ticket**: frontend, backend, and the fixes after verification all share it. `T#####-<short-slug>` only when a second branch is unavoidable (the first is already merged), and say why. Numbers are per project, so `T00001` in one repo is unrelated to `T00001` in another.

**Step 4 — Uncommitted changes.** `git checkout -b` carries them onto the new branch, which is normally right. Run `git status --short` and **tell the user what is carried over**. Never `git stash`, `git checkout -- .`, `git reset`, or `git clean` to get a clean tree, and never commit pre-existing changes to make room: they may be someone else's work. If they look unrelated to your task, say so and ask before switching.

**Step 5 — State it.** Name the branch in your first message after the gate.

> [!IMPORTANT]
> The gate does not authorize `git commit`, `git push`, `git merge`, or any history rewrite. Do those only when explicitly asked.
