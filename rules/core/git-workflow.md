# Git Workflow (always-on)

1. **Branches.** Ticket work branches on the bare ticket number (`T00001`, matching `specs/<project>/T00001/`); the remote's `F####` branches are valid ticket branches. No ticket: `feature/` (new pages, modules, features), `bugfix/` (bugs, exceptions, visual glitches), `refactor/` (cleanup, optimization, no new features), or `hotfix/` (critical production patches), + `<domain>-<feature-kebab>`, no dates. One branch per ticket; ticket numbers are per project.
2. **Conventional Commits**: `type(scope): description` with `feat`, `fix`, `refactor`, `docs`, `test`. Descriptive (never "update code"), and no `T00001:` prefix. The PR title carries the ticket (`T00001 — <feature>`), the body the spec path. Check the staged range before committing.
3. **Never commit to `main` / `master`.** Every change goes through a branch and a merge request.

Commit, push, merge, and rewrite history only when the user asks. Never `git stash`, `reset`, `checkout -- .`, or `clean` to tidy a tree, and never commit someone else's uncommitted changes.

Skills that write application code first run the **Mandatory Branch Gate** (`conditional/branch-gate.md`): it **creates** the branch, it does not just confirm one.
