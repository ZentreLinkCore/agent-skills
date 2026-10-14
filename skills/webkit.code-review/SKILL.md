---
name: webkit-code-review
description: |
  Senior-developer review of a diff (a ticket's branch, a branch against its base, or uncommitted work) for bugs, security, performance, duplication and breaks from `.agents/rules/`; grades CRITICAL to INFO and writes `code-review.md`. Read-only, and needs no spec. Visual detail is /webkit-design-review.
  Trigger: "/webkit-code-review", "code review", "review my changes", "review this PR", "review the diff", "ready to merge"
  Use when: changed code needs a correctness and quality pass before it merges.
---

# Webkit Code Review

Acts as a senior developer reviewing a pull request. It reviews the **actual code changes** and identifies bugs, incorrect implementation, security risks, performance issues, maintainability problems, code duplication, bad patterns, and possible future failures. The goal is to improve code quality before merge.

This is **not** a specification review, **not** a feature planning process, and **not** a place to add new requirements.

> [!IMPORTANT]
> **This skill MUST NOT modify application code or any specification.** Its only output is the review report, plus its own rows in the ticket's `task.md`. Fixing is `/webkit-fix`'s job. A reviewer who fixes while reviewing cannot report honestly on what changed.

---

## Authority Boundary

This skill owns **only** reviewing the code quality of a diff, and reporting ([authority-boundary.md](../../rules/authority-boundary.md)). It does not perform another skill's responsibility. Tasks that belong to another workflow stage:

- fixing what it finds → `/webkit-fix`
- checking spec conformance → `/webkit-verify`
- an in-depth visual review → `/webkit-design-review`
- changing requirements → `/webkit-specify` (report **Specification clarification required**)

If a task belongs to another stage: **stop, report it, and do not continue** that task. Report it as `Authority boundary: <the task> belongs to /webkit-<skill>. Not done here.` Do not compensate for another skill, and do not generate work outside this authority.

---

## Inputs

| Form | Meaning |
| --- | --- |
| `/webkit-code-review T#####` | Review that ticket's branch against its base. |
| `/webkit-code-review <branch-name>` | Review that branch against its base. |
| `/webkit-code-review` | Review uncommitted work if any exists, otherwise the current branch against its base. |
| `/webkit-code-review <target_path>` | Narrow any of the above to the changes under that path. |

---

## How This Differs From `/webkit-verify`

| | `/webkit-verify` | `/webkit-code-review` (this skill) |
| --- | --- | --- |
| Question | Does the implementation match the spec? | Is the changed code correct and well built? |
| Authority | The spec | [.agents/rules/](../../rules/), the existing architecture, and correctness |
| Scope | Every requirement in the spec | The diff |
| Needs a spec? | Yes | No |

A change can match its spec and still be bad code; it can be excellent code and not do what was asked. Run both.

---

## Workflow Integration

```text
        webkit-implement / fix / refactor
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
    webkit-verify      webkit-code-review     ← you are here
    (spec match)         (code quality)
                               │
                               ▼
     code-review.md  (.agents/specs/<project>/T#####/code-review.md)
                               │
                               ▼
                         webkit.fix
```

---

## Core Rule: No Scope Expansion

The reviewer MUST NOT:

- suggest new features,
- suggest unrelated improvements,
- modify requirements,
- update specifications or create spec versions,
- redesign the whole system without evidence.

Only review the existing implementation.

## Review Mindset

Think like a senior developer reviewing a pull request. Ask:

- Is this code correct?
- Can this break?
- Is this maintainable?
- Does this follow existing project patterns?
- Will this create problems in the future?
- Is there unnecessary complexity?

Read the body, follow the call, and check the caller actually calls it. Names and comments are not evidence.

---

## Phase 1 — Analyze Changes

### Establish the diff

Review the **change**, not the repository.

```bash
git rev-parse --abbrev-ref HEAD          # which branch
git status --short                       # uncommitted work
git diff --stat; git diff --cached --stat

base=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/master)
git diff "$base"...HEAD --stat           # three dots: only what the branch changed
git diff "$base"...HEAD --name-status    # A / M / D per file
```

Scope, in this order:

1. **Ticket or branch argument** → review that branch's diff (`git diff "$base"...origin/<branch>`). Follow [ticket-numbering.md §8](../../rules/ticket-numbering.md#8-resolving-a-ticket-argument-to-its-branch): fetch and analyze **without checking out** (§8.3). When several branches match one ticket (`F0135`, `F0135-fixed`, `f0135`), stop and ask.
2. Uncommitted changes, if any exist.
3. The current branch against its base.

**State the scope and the file count before reviewing.** If the diff is empty, say so and stop; never expand to a whole-repo review.

> [!WARNING]
> Past ~40 files, review the highest-risk subset first (migrations, auth, money, permissions, shared services) and record what you did not review as an INFO "Not reviewed:" entry. A review that claims 200 files covered none of them properly.

### Understand the change

Group the changes into modified, added, and deleted files, and by area: database, API, frontend, backend, configuration. For each area, understand **what** changed, **why** (commit messages, the ticket's spec if one exists, the PR description), and the **possible impact** on callers and other modules. The spec explains intent here; it is not the yardstick. Spec conformance is `/webkit-verify`'s job.

### Load the project's rules

**Resolve the project first** with [Which Project Am I In?](../../rules/project-profile.md) and read only its sections. The projects differ on framework, database conventions, and component libraries; a rule cited from the wrong one turns correct code into a false finding.

Load only the rules the diff touches:

| Diff contains | Load |
| --- | --- |
| Any code | [coding-standards.md](../../rules/coding-standards.md), [naming-convention.md](../../rules/naming-convention.md) |
| Migrations, models, queries | [project-profile.md](../../rules/project-profile.md) database conventions, [laravel-standards.md](../../rules/laravel-standards.md) |
| Controllers, routes, requests | [laravel-standards.md](../../rules/laravel-standards.md), [security.md](../../rules/security.md) |
| Vue components | [vue-standards.md](../../rules/vue-standards.md), [ui-design.md](../../rules/ui-design.md) |
| React components | your project's section of [project-profile.md](../../rules/project-profile.md), [ui-design.md](../../rules/ui-design.md) |
| Auth, permissions, input handling | [security.md](../../rules/security.md) |
| Lists, dashboards, loops over queries | [performance.md](../../rules/performance.md) |
| New files or folders | [project-structure.md](../../rules/project-structure.md), [duplicate-prevention.md](../../rules/duplicate-prevention.md) |
| Payroll, timekeeping, statutory math | [hrms-rules.md](../../rules/hrms-rules.md) |
| Tests | [testing.md](../../rules/testing.md) |

A rule violation is a finding **with a citation**: quote the rule, do not present a preference as project policy. Read the "Known drift" table in [project-profile.md](../../rules/project-profile.md) before calling anything inconsistent.

> [!NOTE]
> The visual layer belongs to [`/webkit-design-review`](../webkit.design-review/SKILL.md). When it has run on this change, cite its `design-review.md` instead of re-listing accent, contrast, dark-mode, or component-reuse findings. When it has not, report clear [ui-design.md](../../rules/ui-design.md) violations only.

---

## Phase 2 — Code Quality Review

For every finding, report what is wrong, where it happens (`file:line`), why it can fail, and the recommended fix.

### 1. Correctness

- Logic errors and wrong conditions (`<` vs `<=`, `||` vs `&&`, inverted checks, guards never reached)
- Missing validations
- Incorrect assumptions (a value assumed non-null, a database default read from an unrefreshed model, timezone or currency assumed)
- Incorrect error handling (a `catch` that swallows the error and returns mock or empty data)
- Unexpected behavior on empty, single, zero, or negative input

### 2. Bug prevention

- Null / undefined errors
- Race conditions
- Duplicate execution (double submit, retried jobs, re-run cycles)
- Infinite loops
- Memory leaks (listeners, intervals, subscriptions never cleaned up)
- Incorrect state handling
- Data inconsistency (a second source of truth for stored or derived data)
- Transaction problems (multi-step writes that leave half-written state on failure)

### 3. Performance

Report **only with measurable impact** (query count, rows loaded, requests per action, render count).

- **Database:** N+1 queries, missing indexes on newly filtered or joined columns, unnecessary queries, large data loading, inefficient processing in PHP instead of SQL
- **Backend:** expensive operations, repeated calculations, bad API patterns (chatty endpoints, unbounded responses)
- **Frontend:** unnecessary renders, large components, bad state handling, unoptimized requests

### 4. Security

- Authorization issues and missing permission checks, enforced on the **server**, not only hidden in the UI
- Tenant / owner scoping on *every* read and write, not only the one you looked at
- Unsafe input handling (mass assignment from `$request->all()`, unvalidated input)
- Data exposure and sensitive information leaks (secrets, tokens, PII in responses, logs, or `localStorage`)
- Injection risks (raw SQL with interpolated input, unescaped output)

### 5. Maintainability

- Duplicate code, including logic that already exists in a helper, Action, Query, or component ([duplicate-prevention.md](../../rules/duplicate-prevention.md))
- Poor naming, against [naming-convention.md](../../rules/naming-convention.md)
- Large functions and complex logic
- Wrong abstraction
- Dead code, commented-out blocks, stray debug output, stale comments
- Inconsistent patterns versus sibling modules
- Changed business logic without the test [testing.md](../../rules/testing.md) requires

### 6. Architecture

Review **only against the existing project architecture**:

- Does it follow current patterns?
- Is responsibility placed correctly (thin controller, Query / Handler / Action, component vs composable)?
- Is code unnecessarily coupled?

Do **not** recommend changing the architecture unless the current implementation causes a real, demonstrated problem, or the existing pattern cannot support the change.

---

## Phase 3 — Classify and Filter

### Severity

Every finding has exactly one severity, graded by consequence if it ships, never by how hard the fix is.

| Severity | Meaning | Examples |
| --- | --- | --- |
| **CRITICAL** | Must fix before merge. | Security vulnerability, data corruption, application crash, cross-tenant leak, wrong money. |
| **HIGH** | Should fix before merge. | Major bug, incorrect business logic, performance issue with measurable impact. |
| **MEDIUM** | Recommended improvement. | Maintainability issue, code duplication, error handling improvement. |
| **LOW** | Minor suggestion. | Naming, formatting, small cleanup, each backed by a project rule. |
| **INFO** | Observation only; no action required. | Pre-existing problems next to the diff, files not reviewed, specification clarification required. |

Escalate one level when the defect is **silent**: no error, no log, no failing test.

### Filter before reporting

Every finding must pass all four:

1. **Is it real?** Trace the actual code path. A null that is validated upstream is not a finding.
2. **Is it in this change?** Problems the diff merely sits next to are INFO "Pre-existing:", never findings.
3. **Is it falsifiable?** CRITICAL and HIGH state concrete inputs or state → the wrong outcome. If you cannot construct one, it is not a finding.
4. **Is it more than taste?** If no rule requires it and nothing breaks, drop it.

### Do not report

- Personal coding preference
- Style preference without a project rule (or formatting a linter already handles)
- Hypothetical problems without evidence
- Future features or new modules
- Spec changes
- Version files, build numbers, and CHANGELOG entries written by the versioning phase ([versioning.md](../../rules/versioning.md)): expected, not scope expansion

If a code issue can only be resolved by changing a requirement, record **"Specification clarification required"** under INFO with what and why. Do not modify the specification.

---

## Phase 4 — Overall Code Quality and Recommendation

Derived from the findings, not a judgement call:

| Overall Code Quality | When | Final Recommendation |
| --- | --- | --- |
| **CHANGES REQUIRED** | Any CRITICAL or HIGH | **FIX REQUIRED** (list every CRITICAL and HIGH by finding number) |
| **APPROVED WITH COMMENTS** | Only MEDIUM and / or LOW | **READY TO MERGE** |
| **APPROVED** | No findings (INFO only) | **READY TO MERGE** |

---

## Phase 5 — Write the Report

Fill the template [.agents/template/code-review-report.md](../../template/code-review-report.md). Follow its exact structure: no custom format, and no added, removed, renamed, or reordered sections. Follow the fill rules in its header comment, then delete every guide comment except the `<!-- Run history -->` marker.

- Number findings in one sequence across CRITICAL, HIGH, MEDIUM, and LOW (`Finding #1`, `#2`, …), so a number always names one issue. Within a severity, order them dependency-first, so `/webkit-fix` can work straight down.
- Every finding names its file and line, and every CRITICAL and HIGH carries a concrete recommended fix: "add `->with('role')` to the query in `GetOrganizationMembersQuery.php:24`", not "avoid N+1".
- **Positive Feedback** names specific good decisions in this change, not generic praise.

### Persist the report (MANDATORY)

**Step 1 — Resolve the ticket** ([ticket-numbering.md](../../rules/ticket-numbering.md) §4). This skill needs no spec, but its report belongs with the ticket when there is one:

1. The branch usually names it (`T00004`, `T00004-<slug>`).
2. The argument names it (`/webkit-code-review T00004`).
3. Otherwise match the diff's modules, routes, or tables against the project's specs:

   ```bash
   grep -ril '<module|route|table from the diff>' ".agents/specs/$project" --include='*.md' 2>/dev/null
   ```

   Read the hits per [ticket-numbering.md](../../rules/ticket-numbering.md) §4. A hit in a **legacy portal spec** (`specs/<project>/<portal>/<feature>.md`) has no ticket folder: write to `.agents/reports/<domain>-<feature>-review-<YYYYMMDD>.md` (§5).

4. Still nothing → the change has **no ticket**: write to `.agents/reports/<scope>-review-<YYYYMMDD>.md` and set the Ticket row to "None — <reason>".

Never allocate a ticket here; that is `/webkit-specify`'s job. State the ticket you resolved (or that there is none) in your first message.

**Step 2 — Write the file.**

- Write to `.agents/specs/<project>/<ticket>/code-review.md`: exactly that filename ([ticket-numbering.md](../../rules/ticket-numbering.md) §5).
- Re-reviewing **overwrites the file in place**. Before overwriting, append the previous run's **Review Run** value with its date and verdict (e.g. `- v1 — 2026-10-08 — initial — CHANGES REQUIRED`) to the list under `<!-- Run history -->`. Then increment the Metadata **Review Run** row, set **Review Date** to today, and write one line on what changed ("Findings #1–#2 fixed; 1 new MEDIUM"). A previous run row of the form `vN.k` is a [fix pass](../../rules/ticket-numbering.md#fix-pass) by `/webkit-fix`: append it to the history like any run, number this run `v(N+1)`, and re-check each `✅ FIXED` line rather than trusting it.
- Every finding is written with `- **Resolution:** Open` (the template's last field); `/webkit-fix` fills it.
- Every `file:line` must be real and current.

**Step 3 — Update `task.md`** (ticket folder only) per [task.md upkeep](../../rules/ticket-numbering.md#taskmd-upkeep): the §1 Code review row (`vN — <verdict>`); replace this report's unticked §3 items with this run's CRITICAL / HIGH findings (ticked ones stay as history) and count the rest on the Optional line; **Next step** (`/webkit-fix <ticket> --code-review` when any CRITICAL / HIGH is open); one §5 line. A ticket with a spec but no `task.md`: create it from [the task-tracker template](../../template/task-tracker.md) first. This file and the report are the only files this skill writes.

---

## Rules After Review

The reviewer must not:

- update specs,
- create spec versions,
- request new features,
- restart planning.

If a code issue requires changing requirements, report **"Specification clarification required"** and do not modify the specification.

---

## Anti-Patterns

| Anti-pattern | Why it fails |
| --- | --- |
| Reviewing the whole repo instead of the diff | Buries the change's real problems in unrelated noise. |
| Padding with style nits | Trains the reader to skim, so the CRITICAL gets skimmed too. |
| Blaming the diff for pre-existing issues | Makes the author defend code they did not write. Use INFO "Pre-existing:". |
| "Consider refactoring this" | Not falsifiable, not actionable. |
| Suggesting features, redesigns, or spec changes | Scope expansion; this review covers the existing implementation only. |
| A CRITICAL or HIGH with no recommended fix | The next session must redo the analysis to act on it. |
| Grading severity by effort | An awkward fix to a tenant leak is still CRITICAL. |
| Trusting names and comments | Read the body, follow the call. |
| Fixing while reviewing | The report no longer matches any commit. |
| Claiming coverage you did not achieve | Record skipped files as INFO "Not reviewed:". |

---

## Follow-up Commands

Always include the saved report path:

- Fix the CRITICAL and HIGH findings, on the ticket's existing branch: `/webkit-fix <ticket> --code-review`. MEDIUM and LOW only if the user names them.
- Maintainability findings (duplication, large functions, dead code, inconsistent patterns) as a behavior-preserving cleanup: `/webkit-refactor <ticket> --code-review Finding #n`
- Check spec conformance too: `/webkit-verify <ticket>`
- Root cause of one finding: `/webkit-investigate <target_path> <Finding #n from .agents/specs/<project>/<ticket>/code-review.md>`
- After fixes: **no re-run needed.** `/webkit-fix` closes the findings in this report as a fix pass and recomputes the verdict. Re-run only when its Fix Summary says a re-run is needed, or when a fresh review is wanted before merge.
