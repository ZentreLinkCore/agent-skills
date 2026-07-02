# Git Workflow Standards

## Purpose
This document establishes branching models, commit message specifications, and pull request procedures to maintain a clean git history.

## Scope
Applicable to all branches, commits, staging changes, and merge requests in the workspace.

## Responsibilities
- **AI Agent**: Formats commit messages according to Conventional Commits and isolates changes inside appropriate branch types.
- **Developer/User**: Approves and merges branches, manages merge conflicts, and controls releases.

## Actionable Rules
1. **Branch Naming Categories**: Always prefix branch names matching their implementation focus:
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

## Best Practices
- **Single Responsibility Branches**: Keep branches dedicated to a single feature card or bug.
- **Clean Commit History**: Squash commits to group related work cleanly before merging.

## AI Behavior Expectations
- **Form-fitting Commits**: The agent must output descriptive messages. Avoid vague texts (e.g. "update code" or "fix styling").
- **Minimal Staging Diffs**: Verify staging ranges before committing to prevent adding unrelated modifications.
