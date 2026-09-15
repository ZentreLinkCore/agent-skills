---
name: webkit-code-review
description: >
  Reviews the DIFF (uncommitted changes, or a branch against its base) for correctness bugs, security holes,
  N+1s, duplication, and violations of the project's own rules in `.agents/rules/`. Complements `/webkit.verify`:
  verify asks "does this match the spec", this asks "is this code any good". Grades every finding
  CRITICAL/HIGH/MEDIUM/LOW with a suggested fix and a dependency-first Fix Plan. Never edits code;
  writes `code-review.md` into the ticket folder of the spec the change belongs to
  (`.agents/specs/<project>/T#####/code-review.md`), or to `.agents/reports/` when the change has no ticket.
  Triggered by `/webkit.code-review`, `/webkit.code-review <target_path>`, `/webkit.code-review T#####`, or `/webkit.code-review <branch>`.
---

# Webkit Code Review

This skill reviews code the way a senior engineer reviews a colleague's pull request: **on the diff, against the project's own rules, looking for what will actually break.**

> [!IMPORTANT]
> **This skill MUST NOT modify application code.** Its only file output is the review report — `code-review.md` in the change's ticket folder, or a dated report under `.agents/reports/` when there is no ticket. Fixing is `/webkit.fix`'s job. A reviewer who fixes as they go cannot report honestly on what they changed, and the report stops matching any commit.

---

## How This Differs From `/webkit.verify`

They are complementary and both are needed. Running only one leaves a whole class of defect unexamined.

| | `/webkit.verify` | `/webkit.code-review` (this skill) |
| :--- | :--- | :--- |
| Question | Does the code match the spec? | Is the code correct and compliant? |
| Authority | The spec | [`.agents/rules/`](../../rules/) + correctness |
| Scope | Every claim in the spec | The diff |
| Needs a spec? | Yes — stops without one | No |
| Catches | Absent rules, inverted rules, unspecced behavior | Bugs, security holes, N+1s, duplication, rule violations |
| Misses | A tenant leak the spec never mentioned | A spec rule that was silently never coded |

A change can conform perfectly to its spec and still be bad code. A change can be excellent code and not do what was asked. **Run verify for spec conformance, this for quality.**

---

## Workflow Integration

```text
   webkit.frontend-implement / backend-implement / fix / refactor
               │
      ┌────────┴────────┐
      ▼                 ▼
 webkit.verify   webkit.code-review     ← you are here
 (spec match)      (code quality)
      └────────┬────────┘
               ▼
   Review Report (.agents/specs/<project>/T#####/code-review.md)
               │
               ▼
          webkit.fix
```

---

## Phase 1 — Establish the Diff

Review the **change**, not the repository. Reviewing everything produces a report nobody reads.

```bash
git rev-parse --abbrev-ref HEAD          # which branch
git status --short                       # uncommitted work
git diff --stat                          # unstaged
git diff --cached --stat                 # staged

# detect the base — it is `master` in SubHRMS, not `main`
base=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/master)
git diff "$base"...HEAD --stat           # the branch vs its base
```

Pick the scope in this order:

1. **A ticket argument** (`/webkit.code-review F0135`, `T00004`) — resolve it to its branch and review **that branch's diff**: `git diff "$base"...origin/<branch>`. Follow [ticket-numbering.md §8](../../rules/ticket-numbering.md#8-resolving-a-ticket-argument-to-its-branch), and note §8.3 — this skill writes no code, so it **fetches and analyzes without checking out**. Several branches can match one ticket (`F0135`, `F0135-fixed`, `f0135`); when more than one does, stop and ask.
2. An explicit `<branch>` or `<target_path>` argument
3. Uncommitted changes, if any exist
4. The current branch against its base

**State the scope and the file count before reviewing.** If the diff is empty, say so and stop — do not silently expand to a whole-repo review.

> [!WARNING]
> If the diff exceeds ~40 files, review the highest-risk subset first (migrations, auth, money, anything under a `security`/`auth` path) and **say explicitly what you did not review**. A review that claims to cover 200 files covered none of them properly.

---

## Phase 2 — Load the Applicable Rules

**Resolve which project you are in before loading a single rule.** Run the **[Which Project Am I In?](../../rules/project-profile.md)** resolution at the top of the profile and state the answer — then read only that project's sections. Reviewing React against Vue standards produces pure noise, and citing the wrong project's DB conventions turns a correct migration into a "finding". The two projects are opposite on foreign keys, relationship-column naming, and soft deletes, so a confidently-cited rule from the wrong half is worse than no citation.

Then load only the rules the diff actually touches:

| Diff contains | Load |
| :--- | :--- |
| Any code | [coding-standards.md](../../rules/coding-standards.md), [naming-convention.md](../../rules/naming-convention.md) |
| Migrations, models, queries | [project-profile.md](../../rules/project-profile.md) DB conventions, [laravel-standards.md](../../rules/laravel-standards.md) |
| Controllers, routes, requests | [laravel-standards.md](../../rules/laravel-standards.md), [security.md](../../rules/security.md) |
| Vue components | [vue-standards.md](../../rules/vue-standards.md), [ui-design.md](../../rules/ui-design.md) |
| React components | [project-profile.md](../../rules/project-profile.md) ScaleUP Profile, [ui-design.md](../../rules/ui-design.md) |
| Auth, permissions, input handling | [security.md](../../rules/security.md) |
| Lists, dashboards, loops over queries | [performance.md](../../rules/performance.md) |
| New files or folders | [project-structure.md](../../rules/project-structure.md), [duplicate-prevention.md](../../rules/duplicate-prevention.md) |
| Payroll, timekeeping, statutory math | [hrms-rules.md](../../rules/hrms-rules.md) |
| Tests | [testing.md](../../rules/testing.md) |

A rule violation is a finding **with a citation**. Quote the rule; do not paraphrase your preference as project policy.

> [!NOTE]
> **The visual layer belongs to [`/webkit.design-review`](../webkit.design-review/SKILL.md).** When that skill has run on this
> change, cite its `design-review.md` for accent, contrast, dark-mode, and component-reuse findings instead of re-listing them.
> When it has not, keep [ui-design.md](../../rules/ui-design.md) checks here to clear violations only — depth is its job, not this one's.

---

## Phase 3 — Review Dimensions

Work these in order. The first three find the defects that matter; the rest find the ones that compound.

### 1. Correctness — will it break?

- Null / undefined on a path that can produce it; optional chaining missing where the type allows null
- Off-by-one, `<` vs `<=`, empty collection, single element, zero, negative
- A guard that is never reached — early `return` above it, wrong boolean operator, or a method nobody calls
- Multi-step writes with no transaction: a partial failure leaves half-written state
- Values that come from a database default and are read from an unrefreshed in-memory model
- `catch` blocks that swallow the error and return mock, seed, or empty data — making a broken dependency look healthy
- Money and dates: rounding, precision, currency assumed, timezone assumed

### 2. Security

- **Tenant scoping** — does *every* read and write filter by the organization/tenant key, or only the one you looked at? One unscoped query defeats the entire isolation model. Grep the model, not a single call site.
- Authorization checked on the **server**, not only hidden in the UI
- Mass assignment: `$request->all()` reaching `create()`/`update()` without a FormRequest or explicit allow-list
- Raw SQL with interpolated input
- Secrets, tokens, or PII in logs, in `localStorage`, or in an API response
- Missing rate limits on auth-adjacent or expensive endpoints
- A permission granted more broadly than the matrix allows

### 3. Rule compliance

Every violation from Phase 2's loaded rules, each with the rule cited. Include the conventions that are easy to get backwards — FK naming, response envelope shape, whether API Resources are used, which HTTP client to import.

### 4. Reuse and duplication

- Logic that already exists in a helper, Action, Query, or component ([duplicate-prevention.md](../../rules/duplicate-prevention.md))
- A second source of truth for something already stored or derived elsewhere
- A near-copy of a sibling module that should have been extended

### 5. Performance

- **N+1 queries** — a query inside a loop, or a relation accessed without eager loading. The most common real performance defect.
- Whole tables loaded to count or sum in PHP
- Missing index on a column the diff newly filters or joins on
- Frontend: work in a render path, an effect with a missing or over-broad dependency list, a list without keys

### 6. Maintainability

- A function doing several unrelated things where the project's SRP threshold says split
- Dead code, unreachable branches, commented-out blocks, stray debug output
- Comments or names that no longer describe the behavior — **stale comments in a source-of-truth file are worse than none**, because they are believed
- Magic numbers and strings that belong in a constant or config

### 7. Tests

Per [testing.md](../../rules/testing.md): does changed calculation or business logic have a corresponding test? A missing test for money math is a finding, not a nice-to-have.

---

## Phase 4 — Filter Before Reporting

Every finding must survive all four checks. Findings that fail these are what make reviews get ignored.

1. **Is it real?** Trace the actual code path. A theoretical null on a value that is validated upstream is not a finding.
2. **Is it in scope?** Pre-existing issues the diff merely sits next to are not this change's fault. Note them once under **Pre-existing** — never mixed into the findings.
3. **Is it falsifiable?** Concrete inputs or state → the wrong outcome. If you cannot construct one, it is a suspicion; mark it `UNVERIFIED` and say why.
4. **Is it more than taste?** If no rule requires it and nothing breaks, it is a preference. Drop it.

> [!CAUTION]
> **Do not report:** formatting a linter already handles, naming you would have chosen differently, "consider extracting this" with no rule behind it, or architecture the project deliberately chose (check the [project-profile.md](../../rules/project-profile.md) drift table before calling anything inconsistent).

---

## Phase 5 — Severity and Suggested Fix

Same model as `/webkit.verify`, so the two reports are directly comparable. Grade by **consequence if it ships**, never by how hard the fix is.

| Severity | Applies to | Fix urgency |
| :--- | :--- | :--- |
| `CRITICAL` | Cross-tenant leak, auth bypass, data loss, money wrong, secret exposed | Before anything ships |
| `HIGH` | A bug users will hit, a security weakness, a rule violation with real consequence | Before merge |
| `MEDIUM` | Contained bug, N+1, duplication, missing test on real logic | Same milestone |
| `LOW` | Dead code, stale comment, magic number, cosmetic naming | Opportunistic |

**Escalate one level** when the defect is *silent* — no error, no log, no failing test. A wrong value that surfaces loudly is safer than one nobody notices.

Every finding carries a **concrete suggested fix**: name the file and the construct, not the intent. "Add `->with('role')` to the query at `GetOrganizationMembersQuery.php:24`" is actionable; "avoid N+1" is not.

---

## Phase 6 — Report Structure

```markdown
# Code Review: <scope>

> **Ticket:** `T#####` (<project>) — this file is `.agents/specs/<project>/T#####/code-review.md`. (Or: *no ticket — <why>*.)
> **Scope:** <branch / uncommitted / path> — <n> files, <+a/-d> lines
> **Branch:** <branch name>
> **Run:** v<N> — <YYYY-MM-DD> — <one-line summary of what changed since the previous run, or "initial">.
> **Reviewed:** <YYYY-MM-DD>
> **Verdict:** APPROVE | APPROVE WITH COMMENTS | REQUEST CHANGES

---

## 1. Summary

<Two or three sentences: is this mergeable, and what is the single most consequential problem.>

| Severity | Count | Must fix before |
| :--- | :---: | :--- |
| CRITICAL | n | anything ships |
| HIGH | n | merge |
| MEDIUM | n | end of milestone |
| LOW | n | — |

## 2. Findings

<Most severe first. Omit the section if there are none.>

### F<n> — <one-line title> · `HIGH` · `security`

- **Location:** [`file.php:42`](path#L42)
- **Problem:** <what is wrong>
- **Failure scenario:** <specific inputs or state → the wrong outcome>
- **Rule:** <cited rule, or `correctness` when it is a plain bug>
- **Suggested fix:** <the concrete change: file, construct, what it becomes>
- **Effort:** `trivial` | `small` | `large`
- **Regression risk:** <what the fix could break, or `none`>

## 3. Fix Plan

<Ordered so a developer can work straight down. Dependency-first within a severity band.
This is the section `/webkit.fix` consumes, so it must stand alone.>

| Order | Finding | Severity | Change | File(s) | Effort |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | F2 | CRITICAL | <what to change> | `path/to/file.php` | small |

**Fix together:** <findings sharing a file that should be one change, not three.>

## 4. What Was Verified

<How each dimension was checked — commands run, paths traced. This is what separates a review
from a skim, and it lets the reader judge how much weight to give the verdict.>

## 5. Pre-existing Issues

<Problems the diff sits next to but did not cause. Kept separate so they never inflate this
change's finding count. Omit if none.>

## 6. Review Limits

<What was NOT reviewed and why — files skipped, behavior only observable at runtime, no test
database. Omit nothing here; an unstated gap reads as coverage.>
```

### Verdict rule

Derive it, do not judge it:

| Verdict | When |
| :--- | :--- |
| `REQUEST CHANGES` | Any `CRITICAL` or `HIGH` |
| `APPROVE WITH COMMENTS` | Only `MEDIUM` / `LOW` |
| `APPROVE` | No findings |

### Persist the Report (MANDATORY)

**Step 1 — Resolve the ticket the diff belongs to.** This skill needs no spec to run, but its report belongs with the spec when one exists ([ticket-numbering.md](../../rules/ticket-numbering.md) §4):

1. **The branch usually says it outright.** You already read it in Phase 1: `git rev-parse --abbrev-ref HEAD` returning `T00004` (or `T00004-<slug>`) *is* the ticket, because implementing skills branch on the ticket number ([git-workflow.md](../../rules/git-workflow.md#step-3--derive-the-branch-name)).
2. The prompt names one (`/webkit.code-review T00004`) → use it.
3. Otherwise match the diff to a ticket by the modules, routes, or tables it touches, inside the resolved project (numbers are per project, so `T00004` exists in both):

   ```bash
   grep -ril '<module|route|table from the diff>' ".agents/specs/$project" --include='specs.md' 2>/dev/null
   ```

4. Still nothing → the change has **no ticket**. Say so and fall back to `.agents/reports/<scope>-review-<YYYYMMDD>.md` (e.g. `.agents/reports/organization-schema-correction-review-20260812.md`).

Do **not** allocate a ticket number here — allocating is `/webkit.spec`'s job. State which ticket you resolved to (or that there is none) in your first message.

**Step 2 — Write the report.**

- Write to **`.agents/specs/<project>/<ticket>/code-review.md`** — that exact filename, no dates or scope names in it ([ticket-numbering.md](../../rules/ticket-numbering.md) §5). Only an unticketed change goes to the dated `.agents/reports/` path.
- Re-reviewing the same scope **overwrites that file in place** ([duplicate-prevention.md](../../rules/duplicate-prevention.md)) — history lives inside the file: increment the `> **Run:**` `v<N>`, set today's date, write one line on what changed since the previous run, and append the superseded run line verbatim to a `<!-- Run history -->` list at the bottom.
- Every `file:line` must be real and current. One stale line number makes the whole report untrustworthy.

---

## Anti-Patterns

| Anti-pattern | Why it fails |
| :--- | :--- |
| Reviewing the whole repo instead of the diff | Buries the change's real problems in unrelated noise |
| Padding with style nits | Trains the reader to skim, so the `CRITICAL` gets skimmed too |
| Blaming the diff for pre-existing issues | Makes the author defend code they did not write |
| "Consider refactoring this" | Not falsifiable, not actionable, not a finding |
| A finding with no suggested fix | The next session redoes the whole analysis to act on it |
| Grading severity by effort | An awkward one-line fix to a tenant leak is still `CRITICAL` |
| Flagging deliberate architecture | Check the [project-profile.md](../../rules/project-profile.md) drift table first |
| Trusting names and comments | Read the body, follow the call, check the caller |
| Fixing while reviewing | The report no longer matches any commit |
| Claiming coverage you did not achieve | State limits in §6 — an unstated gap reads as coverage |

---

## Follow-up Commands

- Apply the findings: `/webkit.fix <target_path> using .agents/specs/<project>/<ticket>/code-review.md` — **on the ticket's existing branch**, not a new one
- Also check spec conformance: `/webkit.verify <ticket>` — writes `verify.md` into the same ticket folder
- Deeper root-cause on one finding: `/webkit.investigate <target_path> <finding F<n> from .agents/specs/<project>/<ticket>/code-review.md>`
