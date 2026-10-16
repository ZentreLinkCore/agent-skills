---
name: webkit-code-review
description: |
  Senior-developer review of a diff (a ticket's branch, a branch against its base, or uncommitted work) for bugs, security, performance, duplication and breaks from `.agents/rules/`; grades CRITICAL to INFO and writes `code-review.md`. Read-only, and needs no spec. Visual detail is /webkit-design-review.
  Trigger: "/webkit-code-review", "code review", "review my changes", "review this PR", "review the diff", "ready to merge"
  Use when: changed code needs a correctness and quality pass before it merges.
---

# Webkit Code Review

Reviews the **actual code changes** like a senior developer reviewing a pull request: bugs, incorrect implementation, security risks, performance issues, maintainability problems, duplication, bad patterns, and likely future failures. Not a spec review, not planning, not a place for new requirements.

> [!IMPORTANT]
> **Never modify application code or any specification.** The only outputs are `code-review.md` and this skill's rows in `task.md`. A reviewer who fixes while reviewing cannot report honestly on what changed.

Shared steps (gates, ticket resolution, templates, report persistence, `task.md`) follow [skill-protocol.md](../../rules/conditional/skill-protocol.md). **Authority:** reviewing a diff's code quality and reporting. Fixing → `/webkit-fix`; spec conformance → `/webkit-verify`; in-depth visual review → `/webkit-design-review`; requirement changes → `/webkit-specify` (report **Specification clarification required**).

## Inputs

| Form | Meaning |
| --- | --- |
| `/webkit-code-review T#####` | Review that ticket's branch against its base. |
| `/webkit-code-review <branch-name>` | Review that branch against its base. |
| `/webkit-code-review` | Uncommitted work if any exists, otherwise the current branch against its base. |
| `/webkit-code-review <target_path>` | Narrow any of the above to the changes under that path. |

**Versus `/webkit-verify`:** verify asks *does it match the spec* (authority: the spec; scope: every requirement; needs a spec). This skill asks *is the changed code correct and well built* (authority: [.agents/rules/](../../rules/), the existing architecture, correctness; scope: the diff; no spec needed). Run both.

## Context Loading Priority

1. **`task.md`**: which reviews ran, which findings are open. Read `summary.md` first if it exists.
2. **`context.md`** (if it exists): the intended touched files and the do-not-touch list; a diff outside it is worth a look.
3. **`spec.md` / `plan.md` only for intent**, and only the sections the diff touches. Never the yardstick.
4. **The diff**, then each changed file at the changed hunks. Callers and callees only where a finding needs them (Graphify `affected` before grep).

Rules: the router's [By files in a diff](../../rules/rule-router.md#by-files-in-a-diff-reviews-fixes) table, for this diff's paths only. The previous `code-review.md` only on a re-run (its Metadata and findings, to re-check `✅ FIXED` lines). **Avoid:** whole-repo reads, unrelated tickets' reports, the whole blueprint.

## Core rule: no scope expansion

Review only the existing implementation. Never suggest new features or unrelated improvements, modify requirements, update the spec or create spec versions, request features, restart planning, or redesign the system without evidence. A code issue that can only be resolved by changing a requirement is recorded as INFO **"Specification clarification required: <what and why>"**, and the spec is left untouched.

**Mindset:** Is it correct? Can it break? Is it maintainable? Does it follow the project's patterns? Will it cause future problems? Is anything needlessly complex? Read the body, follow the call, check the caller actually calls it. Names and comments are not evidence.

## Phase 1 — Analyze the change

Run protocol §1 (project, ticket, branch analysis **without checkout**).

**Establish the diff: review the change, not the repository.**

```bash
git rev-parse --abbrev-ref HEAD; git status --short
git diff --stat; git diff --cached --stat
base=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/master)
git diff "$base"...HEAD --stat           # three dots: only what the branch changed
git diff "$base"...HEAD --name-status    # A / M / D per file
```

Scope, in order: (1) a ticket or branch argument → that branch's diff (`git diff "$base"...origin/<branch>`), fetched and analyzed per [ticket-numbering.md §8](../../rules/conditional/ticket-numbering.md#8-resolving-a-ticket-argument-to-its-branch), several matches → stop and ask; (2) uncommitted changes; (3) the current branch against its base. **State the scope and file count before reviewing.** An empty diff: say so and stop; never expand to a whole-repo review.

> [!WARNING]
> Past ~40 files, review the highest-risk subset first (migrations, auth, money, permissions, shared services) and record the rest as an INFO "Not reviewed:" entry. A review that claims 200 files covered none of them properly.

**Understand it.** Group files into modified / added / deleted and by area (database, API, backend, frontend, configuration). Per area: what changed, why (commit messages, the spec if any, the PR description), and the impact on callers and other modules.

**Blast radius.** For each modified or deleted method, class, composable, or component, list its callers **outside the diff**: `graphify explain "<ExactName>" --all` when `graphify-out/graph.json` exists, otherwise grep. Read the callers whose contract changed (signature, return shape, removed export). The graph describes the checked-out tree as of its last build, not a branch analyzed without checkout (§8.3), and its blind spots ([context-budget.md §2](../../rules/context-budget.md#2-find-code-graphify-first-then-targeted-search)) are grep-only: treat each hit as a pointer and confirm it in the file before citing it in a finding.

**Rules.** Load only what the diff's paths need (router). A rule violation is a finding **with a citation**: quote the rule; never present a preference as policy. In (React), read [Known drift](../../rules/conditional/backend.md#6-source-path-react-known-drift) before calling anything inconsistent. The visual layer belongs to `/webkit-design-review`: when its `design-review.md` exists for this change, cite it instead of re-listing accent, contrast, dark-mode, or component-reuse findings; otherwise report only clear [ui-design.md](../../rules/conditional/ui-design.md) violations.

## Phase 2 — Review

Every finding: what is wrong, where (`file:line`), why it can fail, the recommended fix.

1. **Correctness**: wrong conditions (`<` / `<=`, `||` / `&&`, inverted checks, unreachable guards); missing validation; wrong assumptions (non-null, a DB default read from an unrefreshed model, timezone, currency); error handling that swallows and returns mock or empty data; empty, single, zero, or negative input.
2. **Bug prevention**: null / undefined; race conditions; duplicate execution (double submit, retried jobs, re-run cycles); infinite loops; leaks (listeners, intervals, subscriptions); wrong state handling; a second source of truth; multi-step writes that leave half-written state on failure.
3. **Performance**, only with measurable impact (queries, rows, requests per action, renders): N+1, missing index on a newly filtered or joined column, unneeded queries, large loads, PHP work that belongs in SQL; expensive or repeated backend work, chatty or unbounded endpoints; needless renders, oversized components, unoptimized requests.
4. **Security**: authorization on the **server**, not only hidden UI; tenant / owner scoping on *every* read and write; mass assignment from `$request->all()` and unvalidated input; secrets, tokens, or PII in responses, logs, broadcasts, or `localStorage`; raw SQL with interpolated input; unescaped output.
5. **Maintainability**: duplicated logic that already exists in a helper, Action, Query, or component ([system-awareness.md §4](../../rules/conditional/system-awareness.md#4-no-duplicate-logic)); naming against [code-quality.md](../../rules/conditional/code-quality.md#2-naming); large functions; wrong abstraction; dead code, commented-out blocks, debug output, stale comments; patterns inconsistent with sibling modules. **Changed behavior without the test [testing.md](../../rules/conditional/testing.md#every-code-change-ships-with-a-test-mandatory) requires** (unit, feature, schema, regression, component): MEDIUM, raised to HIGH for money, authorization, or data integrity. A test that asserts nothing real (`assertTrue(true)`, a snapshot of nothing) counts as missing.
6. **Architecture**, against the existing project only: current patterns followed; responsibility in the right place (thin controller, Query / Handler / Action, component vs. composable); needless coupling. Recommend an architectural change only for a demonstrated problem, or when the existing pattern cannot support the change.

## Phase 3 — Classify and filter

| Severity | Meaning | Examples |
| --- | --- | --- |
| **CRITICAL** | Must fix before merge | Security hole, data corruption, crash, cross-tenant leak, wrong money |
| **HIGH** | Should fix before merge | Major bug, wrong business logic, measurable performance problem |
| **MEDIUM** | Recommended | Maintainability, duplication, error handling |
| **LOW** | Minor | Naming, formatting, small cleanup, each backed by a project rule |
| **INFO** | No action | Pre-existing problems beside the diff, files not reviewed, specification clarification required |

Grade by consequence if it ships, never by the effort to fix. **Escalate one level when the defect is silent** (no error, no log, no failing test).

A finding must pass all four: **real** (trace the path; a null validated upstream is not a finding) · **in this change** (otherwise INFO "Pre-existing:") · **falsifiable** (CRITICAL / HIGH state concrete inputs or state → wrong outcome) · **more than taste** (no rule requires it and nothing breaks → drop it).

Never report: personal preference; style with no project rule, or what a linter already handles; hypotheticals without evidence; future features; spec changes; version files, build numbers, and CHANGELOG entries from the versioning phase (expected, per [versioning.md](../../rules/conditional/versioning.md)).

## Phase 4 — Verdict

| Overall Code Quality | When | Final Recommendation |
| --- | --- | --- |
| **CHANGES REQUIRED** | any CRITICAL or HIGH | **FIX REQUIRED**, listing every CRITICAL and HIGH by number |
| **APPROVED WITH COMMENTS** | only MEDIUM and / or LOW | **READY TO MERGE** |
| **APPROVED** | INFO only | **READY TO MERGE** |

## Phase 5 — Write the report

Fill [code-review-report.md](../../template/code-review-report.md) per protocol §3, and persist it per protocol §4 as **`code-review.md`** (`<kind>` = `review` in `.agents/reports/` names). Skill-specific:

- **Ticket**, in order: the branch (`T00004`, `T00004-<slug>`) → the argument → a grep of the diff's modules, routes, or tables against `.agents/specs/<project>` → none. A hit in a legacy portal spec writes to `.agents/reports/<domain>-<feature>-review-<YYYYMMDD>.md`; no ticket writes to `.agents/reports/<scope>-review-<YYYYMMDD>.md`. Never allocate one.
- Every CRITICAL and HIGH carries a concrete fix: "add `->with('role')` to the query in `GetOrganizationMembersQuery.php:24`", not "avoid N+1".
- **Positive Feedback** names specific good decisions in this change, not generic praise.
- **`task.md`** (protocol §5): the §1 Code review row (`vN — <verdict>`); replace this report's unticked §3 items with this run's CRITICAL / HIGH (ticked ones stay as history) and count the rest on the Optional line; **Next step** `/webkit-fix <ticket> --code-review` while any CRITICAL / HIGH is open.

## Anti-patterns

| Anti-pattern | Why it fails |
| --- | --- |
| Reviewing the repo instead of the diff | Buries the change's real problems in noise. |
| Padding with style nits | Trains the reader to skim past the CRITICAL. |
| Blaming the diff for pre-existing issues | Use INFO "Pre-existing:". |
| "Consider refactoring this" | Not falsifiable, not actionable. |
| A CRITICAL or HIGH with no recommended fix | The next session must redo the analysis. |
| Grading severity by effort | An awkward fix to a tenant leak is still CRITICAL. |
| Claiming coverage you did not achieve | Record skipped files as INFO "Not reviewed:". |

## Follow-up commands

Always include the saved report path:

- Fix CRITICAL and HIGH on the ticket's branch: `/webkit-fix <ticket> --code-review` (MEDIUM / LOW only if the user names them).
- Maintainability findings as a behavior-preserving cleanup: `/webkit-refactor <ticket> --code-review Finding #n`
- Spec conformance: `/webkit-verify <ticket>`
- Root cause of one finding: `/webkit-investigate <target_path> <Finding #n from .agents/specs/<project>/<ticket>/code-review.md>`
- After fixes: **no re-run needed**; `/webkit-fix` closes the findings in this report as a fix pass. Re-run only when its Fix Summary says so, or a fresh review is wanted before merge.
