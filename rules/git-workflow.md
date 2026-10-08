# Git Workflow Standards

## Purpose

This document establishes branching models, commit message specifications, and pull request procedures to maintain a clean git history.

## Scope

Applicable to all branches, commits, staging changes, and merge requests in the workspace.

## Responsibilities

- **AI Agent**: Formats commit messages according to Conventional Commits and isolates changes inside appropriate branch types.
- **Developer/User**: Approves and merges branches, manages merge conflicts, and controls releases.

## Actionable Rules

1. **Branch Naming**: Work that has a ticket is branched on **the ticket number itself** — `T00001`, matching its folder in `.agents/specs/<project>/T00001/` character for character ([ticket-numbering.md](./ticket-numbering.md) §6). The remote also carries the team's own `F####` ticket branches (`F0135`); those are valid ticket branches, not malformed ones — see [§8](./ticket-numbering.md#8-resolving-a-ticket-argument-to-its-branch). Work with **no** ticket uses the categorised form, prefixed by implementation focus:
   - `feature/`: Adding new page templates, modules, or features.
   - `bugfix/`: Correcting active bugs, exceptions, or visual glitches.
   - `refactor/`: Performance updates, cleanup tasks, or logic optimization without adding features.
   - `hotfix/`: Critical production patches.
2. **Conventional Commit Standard**: All commits must follow the format `type(scope): description`.
   - `feat`: User-facing features.
   - `fix`: Code fixes.
   - `refactor`: Structural optimizations.
   - `docs`: Modifying document structures or inline comments.
   - `test`: Adding or editing tests.
3. **No Direct Master Commits**: Never commit directly to `main` or `master`. All updates must pass through a feature branch and a merge request.

## Mandatory Branch Gate (for implementing skills)

> [!CAUTION]
> This is a **blocking gate, not a reminder.** Any skill that writes application code MUST complete this before creating or editing its first file. "Confirm you are on a branch" has repeatedly failed in practice: the agent checks, sees `main`, notes it, and implements anyway. The instruction is therefore to **CREATE the branch**, not to confirm one exists.

### Step 0 — Was a ticket passed as an argument?

If the skill was invoked as `/<skill> <ticket>` (`F0135`, `T00004`), **that ticket names a branch on the remote, and it must be fetched and analyzed before this gate runs** — see [ticket-numbering.md §8](./ticket-numbering.md#8-resolving-a-ticket-argument-to-its-branch). Several branches can match one ticket (`F0135`, `F0135-fixed`, `f0135` all exist on this remote); when more than one does, **stop and ask** rather than choosing.

Reaching Step 1 without having done that means you are about to work on whatever tree you happened to start in.

### Step 1 — Read the current branch

```bash
git rev-parse --abbrev-ref HEAD
```

### Step 2 — Act on what it says

| Current branch | Action |
| :--- | :--- |
| `main` / `master` | **Create and switch to the branch now.** Do not ask permission — Rule 3 already forbids working here, so creating it is compliance, not a new decision. |
| The ticket's own branch (`T00001`), or a correctly-prefixed branch for **this** work | Continue on it. Do not create a second branch. |
| A branch for **different** work | **Stop and ask.** Committing this feature onto an unrelated branch mixes two changes into one history and is not recoverable by the agent. |
| Detached HEAD | **Stop and ask.** Commits here are unreachable. |

### Step 3 — Derive the branch name

**Has a ticket? The branch IS the ticket number.** Nothing else — no prefix, no slug:

```bash
# From a spec: .agents/specs/<project>/T00001/spec.md
git checkout -b T00001
```

This is what lets a later skill in a fresh session read `git rev-parse --abbrev-ref HEAD`, get `T00001`, and go straight to the right spec, verify report, and review. A prefix or a slug breaks that match.

**No ticket** (a fix from an investigation report, a standalone refactor)? Prefix from the work type (Rule 1), slug from the target:

```bash
# From a bug/investigation report
git checkout -b bugfix/timesheet-late-log-miscalculation

# From a refactor target
git checkout -b refactor/payroll-handler-extraction
```

Rules: `T#####` when a ticket exists, otherwise `<prefix>/<domain>-<feature-kebab-case>`; no dates; **one branch per ticket** — the frontend gate, the backend gate, and the fixes that follow verification all share it. `T#####-<short-slug>` only when a second branch is genuinely unavoidable (e.g. the first is already merged), and say why.

Ticket numbers are **per project**, so `T00001` can exist in both repos as unrelated work. Never assume a `T00001` branch in one repo relates to `T00001` in the other.

### Step 4 — Pre-existing uncommitted changes

`git checkout -b` **carries uncommitted changes onto the new branch**, which is normally what you want — the work moves with you and nothing is lost.

- Run `git status --short` first and **tell the user what is being carried over** before switching.
- **Never `git stash`, `git checkout -- .`, `git reset`, or `git clean`** to get a clean tree. Those discard or hide work you did not write.
- **Never commit pre-existing changes to make room.** They may be someone else's in-progress work, and a commit authored by you over their diff is a real loss.
- If the existing changes look unrelated to your task, say so and ask before switching.

### Step 5 — State it

Report the branch you are on in your first message after the gate, so the user can see it without running git. A silent branch switch is nearly as confusing as no branch at all.

> [!IMPORTANT]
> Committing is still the **user's** call. This gate only guarantees the work lands somewhere isolated and revertible — it does not authorize `git commit`, `git push`, `git merge`, or any history rewrite. Do those only when explicitly asked.

---

## Best Practices

- **Single Responsibility Branches**: Keep branches dedicated to a single ticket, feature card, or bug.
- **Ticket in the PR title**: `T00001 — Loan amortization schedule`, with the spec path (`.agents/specs/<project>/T00001/spec.md`) in the body. Commit messages stay plain Conventional Commits — the branch already carries the ticket, so no `T00001:` prefix on every commit.
- **Clean Commit History**: Squash commits to group related work cleanly before merging.

## AI Behavior Expectations

- **Form-fitting Commits**: The agent must output descriptive messages. Avoid vague texts (e.g. "update code" or "fix styling").
- **Minimal Staging Diffs**: Verify staging ranges before committing to prevent adding unrelated modifications.
