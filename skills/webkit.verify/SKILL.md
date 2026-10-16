---
name: webkit-verify
description: |
  Adversarial check of a finished implementation against its ticket's spec.md, every claim backed by file:line evidence; grades BLOCKER / REQUIRED FIX / IMPROVEMENT / OUT OF SCOPE and writes `verify.md`, then keeps the ticket in step: applies a proven spec error (Case 1) to spec.md and plan.md, ticks plan tasks it proved done, updates task.md. Never edits code. Code quality without a spec is /webkit-code-review.
  Trigger: "/webkit-verify", "verify against the spec", "does it match the spec", "spec compliance", "are all requirements done"
  Use when: implementation is finished and the question is whether it does what the spec says.
---

# Webkit Verify

Reviews the completed implementation against its specification: did it follow the approved spec, are all requirements complete, are there hidden problems, are there security, performance, usability, or maintainability risks? Not a feature planning command, not a redesign command, and not a place for new requirements. The specification remains the source of truth.

> [!IMPORTANT]
> **Never modify application code.** The outputs are `verify.md` in the spec's ticket folder plus the ticket updates of [Phase 7](#phase-7--keep-the-ticket-in-step): a **Case 1** spec correction applied in place (with the plan change it needs), ticks for plan tasks this run proved done, and `task.md`. Fixing is `/webkit-fix`'s job; a requirement change (Case 2, a new spec version) is `/webkit-specify`'s.

Shared steps (gates, ticket resolution, templates, report persistence, `task.md`) follow [skill-protocol.md](../../rules/conditional/skill-protocol.md). **Authority:** checking the implementation against its spec and reporting. Fixing → `/webkit-fix`; a requirement change or new spec version (Case 2) → `/webkit-specify`; general code quality → `/webkit-code-review`. Phase 7's edits (a Case 1 correction, plan ticks, `task.md`) are this skill's own bookkeeping: they record what this run proved and add no requirement.

## Inputs

| Form | Meaning |
| --- | --- |
| `/webkit-verify T#####` | Verify that ticket's spec against that ticket's branch. |
| `/webkit-verify <branch-name>` | Verify that branch; the branch names the ticket (`T00004`, `T00004-<slug>`, `F0135`). |
| `/webkit-verify` | Verify the current branch (or the uncommitted workspace) against its ticket's spec. |

## Context Loading Priority

1. **`task.md`**: the Verify row, the open findings, the previous runs. Read `summary.md` first if it exists.
2. **`context.md`** (if it exists), plus `touched-files.md` / `dependency-map.md`: where each rule's code is expected to live, a starting point for the absence sweep. A map, not evidence.
3. **The whole `spec.md`, before any code** (Phase 1). This skill is the exception to "only the sections the step needs": the spec is the yardstick, and every section is graded. `plan.md` only in Phase 7: the unticked tasks with their **Done when**, and the tasks a Case 1 correction touches. The previous `verify.md` only on a re-run: its Metadata, status, and findings, to append the run history and re-check every `✅ FIXED` line.
4. **The implementation**: the branch diff, then each changed file at the changed hunks; for the absence sweep, the place each rule's code would live. Graphify first ([context-budget.md §2](../../rules/context-budget.md#2-find-code-graphify-first-then-targeted-search)), then targeted `rg`; `graphify path` to follow a route to the guard or handler that should enforce a rule. The source `file:line` is the evidence, never the graph.

Rules: the router's [By files in a diff](../../rules/rule-router.md#by-files-in-a-diff-reviews-fixes) table, for this diff's paths only. Open [verification-report.md](../../template/verification-report.md) at Phase 6. **Avoid:** whole-repo reads; `code-review.md` / `design-review.md` beyond their status and open CRITICAL / HIGH (Phase 7 Step 3); unrelated tickets' reports; the whole blueprint.

## Reviewer Posture

Think like a strict reviewer trying to break the implementation.

1. **Default to not met.** Every requirement starts **UNPROVEN** until you can point at the `file:line` that implements it. "I saw nothing wrong" is what a missing implementation looks like.
2. **Try to refute, not confirm.** Ask "what would this look like if it were broken, and does it look like that?"
3. **Never trust the code's account of itself.** A comment, a method name, or a variable called `$isAuthorized` is not authorization. Read the body, follow the call, check the caller actually calls it.
4. **Absence is the main target.** The most common failure is a spec rule that was never written. It is found only by walking the spec and asking "where is this?" for each rule.
5. **Every finding is falsifiable.** State concrete inputs or state → the wrong outcome. If you cannot, it is not a finding: mark the requirement `UNVERIFIED` and say why.
6. **Spec, not preference.** Style, naming taste, and "I would have done it differently" are not findings.

## Phase 1 — Load Context

1. **Run protocol §1**: project (ticket numbers are per project, so `T00004` exists in both), ticket, and branch analysis **without checkout** ([ticket-numbering.md §8.3](../../rules/conditional/ticket-numbering.md#83-read-only-skills-stop-at-step-4)).
2. **Find the spec.** Ticket → `.agents/specs/<project>/T#####/spec.md` (`specs.md` on tickets created before `/webkit-specify`). A legacy portal spec (`.agents/specs/<project>/<portal>/<feature>.md`) is still a valid spec to verify against. **No spec → stop and say so**, and suggest `/webkit-specify`. Inventing a standard to judge against is the failure this skill exists to prevent.
3. **Read the spec completely, before any code.** Note its version and Status from the Metadata table. A spec that is not `Approved` is still verified; record its Status in the report header.
4. **Resolve the implementation under review**: a ticket or branch argument → that branch, fetched and analyzed without checkout (several matches → stop and ask); no argument → the current workspace, `git status --short` plus the branch diff against its base.

   ```bash
   base=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/master)
   git log "$base".."$branch" --oneline
   git diff "$base"..."$branch" --stat     # three dots: only what the branch changed
   ```

5. **Group the changed files** and review each group: Frontend, Backend, Database (migrations, seeders), API (routes, request/response contracts), Configuration (`config/`, `.env.example`, feature flags), Tests.
6. **Separate decided from open.** §15 Technical Decisions, `DECIDED` blocks, and accepted recommendations are binding. §15 Open Questions and unresolved option tables are **not**: code may do either, so they are never findings.
7. **Respect sanctioned drift.** In (React), read [Known drift](../../rules/conditional/backend.md#6-source-path-react-known-drift) before flagging code that differs from its neighbours to follow the spec.

## Phase 2 — Specification Comparison

Compare the implementation against the spec, and only the spec. Report deviations, not preferences.

| Spec section | Check |
| --- | --- |
| §4 Scope | Everything in **Included** exists. Nothing in **Not Included** was built. |
| §5 User Flow | Each step's system behavior and each failure path. |
| §6 Functional Requirements | Each `FR-xx` is implemented as its Expected Behavior states. |
| §8 Technical Design | Components, classes, routes, tables, and columns exist as specified (Reused / Extended / New). Request, response, and error contracts match field by field. |
| §10 Acceptance Criteria | **Every `AC-xx` row** gets a result: `MET`, `NOT MET`, `PARTIAL`, or `UNVERIFIED`. Verify the literal Given/When/Then; do not paraphrase. |
| §11 Edge Cases | Each row's stated handling exists. |
| §7, §13 Non-functional and Security | Each stated limit, guard, rule, and rejection response exists. An `N/A — <reason>` entry is a claim too: check the reason still holds. |

Older specs use other section names (Business Rules, Permissions, Non-Functional & Failure-Mode Checklist, Build Order, Definition of Done); map them to the rows above.

**Absence sweep (do not skip).** For every FR, edge case, and authorization rule, answer in writing *"where would the code be if this existed?"* and look there (Graphify first, then targeted search). Hunt for:

- rules with no enforcement anywhere,
- edge cases with no guard, branch, or catch,
- validation named in the spec but missing from the request class or handler,
- side effects the spec requires (notifications, audit entries) that nothing emits,
- permission rules with no check that reads them.

**Reverse direction.** Code the spec never authorized is a deviation too: endpoints, columns, or response fields with no spec counterpart; items listed in Not Included; `TODO`, stubbed returns, or hard-coded values where real logic is specified; a `try/catch` that hides a failure by returning mock data. Version files, build numbers, and the CHANGELOG entry written by the versioning phase ([versioning.md](../../rules/conditional/versioning.md)) are expected, not a deviation.

## Phase 3 — Adversarial Review

- **Functional correctness**: the feature works as the spec says; every required flow is implemented; validations are correct; permissions hold both ways: the allowed role can, **and every other role cannot**.
- **Edge cases**: empty data; invalid input (null, empty, too long, wrong type, out of range); duplicate actions (double submit, retry replay, concurrent edits); failed requests (database error, external service down, timeout; partial writes outside a transaction); unexpected user behavior (back button, stale page, direct URL access).
- **Security**: authorization, including scoping every query to the tenant / owner, not just the one you looked at; authentication; data exposure (fields returned or logged that should not be); input validation; API protection (IDOR, mass assignment, rate limits, CSRF).
- **Performance**: slow queries (N+1, missing indexes, unbounded `get()`); unnecessary API calls; large data handling (pagination, chunking); missing optimization the spec's §7 targets require.
- **Maintainability**, judged against the existing project patterns and [.agents/rules/](../../rules/), never taste: consistency, duplicate logic, future maintenance problems with a concrete consequence. Deep code-quality review belongs to `/webkit-code-review`.

**Verify by execution where you can.** Reading shows what the code says; running shows what it does: `php artisan tinker --execute="..."`, `php artisan route:list`, `vendor/bin/phpunit`, `npm run typecheck`, `node .agents/scripts/check-changed.mjs --base origin/master` (never the full `npm run build`: [testing.md](../../rules/conditional/testing.md#frontend-build-check-changed-files-only)), and negative `grep -rn` searches for what must not exist.

An acceptance criterion that can only be seen in the running UI (and would otherwise stay `UNVERIFIED`) is checked with Playwright or any browser tool you have. Log in as the default dev user documented in the project's root [AGENTS.md](../../../AGENTS.md#7-seeing-the-real-behavior-or-ui-playwright-or-any-browser-tool); if the project documents none, ask rather than guess a login. Log in once and reuse the session. The evidence is the page, the steps, and what you saw. The password never goes into `verify.md`.

> [!CAUTION]
> Never run a destructive command (`migrate:fresh`, truncation, seeding over data) against a database you have not confirmed is disposable. Ask first.

## Phase 4 — Classify Findings

Every finding has **exactly one** category.

| Category | Meaning | Examples | Action |
| --- | --- | --- | --- |
| **BLOCKER** | Prevents release. | Feature does not work; security vulnerability; data corruption risk; wrong money; cross-tenant leak. | Must fix before completion. |
| **REQUIRED FIX** | Violates the specification. | Validation from an AC missing; required flow missing; implementation differs from the spec. | Fix the implementation. |
| **IMPROVEMENT** | Optional enhancement. | Cleaner code approach; better UX; optimization opportunity. | Does not block completion. |
| **OUT OF SCOPE** | Unrelated to the current specification. | A new feature idea; a redesign suggestion. | Never part of the required fixes. |

Rules:

- A spec violation that also prevents release (security, data integrity, money, access) is a **BLOCKER**, not a REQUIRED FIX.
- A security vulnerability or data corruption risk is a **BLOCKER** even when the spec never mentions it.
- Every BLOCKER and REQUIRED FIX names its location (`file:line`), the expected vs actual behavior, and a concrete fix: which file, which construct, what it becomes. `/webkit-fix` usually runs in a new session and can act only on what was saved, so make it specific enough to act on without re-deriving the analysis.
- List findings in fix order: dependency-first within each category (if fixing one needs another's migration, that one comes first).
- Number BLOCKER and REQUIRED FIX findings in one sequence (`Finding #1`, `#2`, … continuing from BLOCKER into REQUIRED FIX), so a number always names one issue. Improvements and out-of-scope suggestions are numbered separately (`Improvement #n`, `Suggestion #n`). This is the template's numbering, in place of protocol §4's single sequence.

### No Scope Expansion

During verification, do **not** suggest new features, new modules, additional workflows, architecture redesign, or database redesign, unless:

1. the current implementation cannot satisfy the existing specification,
2. there is a critical technical problem, or
3. the requirement is contradictory.

Any other such suggestion is marked **OUT OF SCOPE**, and it never triggers a spec update request.

## Phase 5 — Result, Spec Impact, Recommendation

### Overall status

Derived from the findings, not a judgement call:

| Status | When |
| --- | --- |
| **❌ FAILED** | At least one BLOCKER. |
| **⚠ PASS WITH FIXES** | No BLOCKER, at least one REQUIRED FIX. |
| **✅ PASS** | No BLOCKER, no REQUIRED FIX, and every AC is `MET` (or `UNVERIFIED` with the manual check that closes it listed in the report's §6 Manual Verification). |

IMPROVEMENT and OUT OF SCOPE findings never change the status. An `UNVERIFIED` AC never counts as met. When any remain, write the status as `✅ PASS (n AC pending manual check)`.

### Final recommendation

- **READY FOR MERGE**: status is ✅ PASS.
- **FIX REQUIRED BEFORE MERGE**: status is ⚠ PASS WITH FIXES or ❌ FAILED. List every BLOCKER and REQUIRED FIX by finding number.

### Spec Update Rules

The default is **NO SPEC CHANGE REQUIRED**. Verification changes the specification only for Case 1, and applies that correction itself in [Phase 7](#phase-7--keep-the-ticket-in-step); Case 2 is never applied here.

Report **SPEC UPDATE REQUIRED** only for:

| Case | Example | Action |
| --- | --- | --- |
| **1. Specification error**: the spec contradicts an existing business rule, is impossible to implement, or contradicts itself. | The spec says "Users can delete records", but the business rule is "Records must be archived". | This skill corrects the spec and the plan in place in Phase 7 (Minor change, no new version). No `/webkit-specify` run. |
| **2. Approved requirement change**: a stakeholder changed the requirement. | The stakeholder changes the workflow. | Not applied here. Create a new spec version with `/webkit-specify` (Major change) once the stakeholder approves. |

Normal bug fixes **never** change the spec or create a version: missing validation, wrong API response, UI alignment issue, typo, query optimization. Fix the implementation only.

A SPEC UPDATE REQUIRED decision always names the Case, the **Changed Sections** (section name and reason), and whether it was **Applied**. Findings are graded against the spec as it stood when this run started; the Case 1 correction is applied after the report is written.

## Phase 6 — Write the Report

Fill [verification-report.md](../../template/verification-report.md) per protocol §3. Where this skill's results go:

| Result | Template section |
| --- | --- |
| Changed files grouped in Phase 1 | Metadata → Implementation Scope |
| Overall status (Phase 5) | §1 Overall Status |
| Phase 2 comparison, one row per area; the AC count and every AC not `MET` | §2 Specification Compliance |
| BLOCKER, REQUIRED FIX, IMPROVEMENT, OUT OF SCOPE findings (Phase 4) | §3 Findings |
| Phase 3 security checks | §4 Security Review |
| Phase 3 performance checks | §5 Performance Review |
| Tests in the diff and their run result; manual checks, including every `UNVERIFIED` AC with the reason it is not yet run | §6 Testing Review |
| Spec Update Rules decision (Phase 5) | §7 Specification Impact Decision |
| Final recommendation (Phase 5), with the required fixes listed by finding number | §8 Final Recommendation |

Persist it per protocol §4 as **`verify.md`**, beside the spec (`<kind>` = `verify`); the run row is **Verification Run**, its date **Verification Date**. Skill-specific:

- A **legacy** portal spec has no ticket folder: write to `.agents/reports/<domain>-<feature>-verify-<YYYYMMDD>.md` and say why. Never write `verify.md` into a portal folder, and never allocate a ticket.
- After a [fix pass](../../rules/conditional/ticket-numbering.md#fix-pass) (`vN.k`), its `✅ FIXED` Resolution lines are claims to re-test, not evidence: a finding that is not really fixed comes back as a new finding.

## Phase 7 — Keep the Ticket in Step

Runs after the report is saved. These are the documents the next session reads; updating them now is what spares a `/webkit-specify` run, and a second verify run, later. Skip a step whose file the ticket does not have. A legacy portal spec (report in `.agents/reports/`): Step 1 only.

**Step 1 — Apply a Case 1 correction.** Only when §7 is SPEC UPDATE REQUIRED **Case 1**. Follow `/webkit-specify`'s [Minor change](../webkit.specify/SKILL.md#minor-change-update-in-place-no-new-version) rules exactly:

1. Edit only the **Changed Sections** §7 names, and only to state the rule the business already has. Keep IDs stable.
2. Add a §16 Change Log row under the **current** version, type `Minor`: `<the correction>` · `Spec error found by verify run vN (Case 1)` · the sections. **Specification Version** unchanged. An older header-format `specs.md` (no §16): add a `<!-- Changelog -->` line instead, without bumping `v<N>`.
3. Bring `plan.md` in step per [Keep the plan in step](../webkit.specify/SKILL.md#keep-the-plan-in-step): edit or append **unticked** tasks only, bump **Plan Revision**, add a §10 row. A ticked task is never edited; changed finished work is a new task.
4. Fill §7's **Applied** line in `verify.md`.

Case 2 is never applied: write `Applied: No — …` and leave the spec alone.

**Step 2 — Tick what this run proved.** In `plan.md`, tick each unticked task whose **Done when** this run confirmed with `file:line` or command evidence (a previous session may have built it without ticking). Set **Plan Status** to `In Progress`, or `Done` when every task is ticked or retired. Never untick: a ticked task whose Done When fails is a finding.

**Step 3 — Close the ticket when it is finished**, per [Closing a ticket](../../rules/conditional/ticket-numbering.md#closing-a-ticket): spec **Status** and **Plan Status** → `Done` only when every condition holds.

**Step 4 — Update task.md** per protocol §5. This skill's rows: the §1 Verify row (`vN — <status>`); replace this report's unticked §3 items with this run's BLOCKER / REQUIRED FIX findings (ticked items stay as history); §2 ticks from Step 2; §4 pending manual checks; Metadata after Steps 1 and 3; **Next step** `/webkit-fix <ticket> --verify` when anything required is open.

## Anti-Patterns

| Anti-pattern | Why it fails |
| --- | --- |
| Reading the code before the spec | You read the spec as a description of what you already saw. |
| "Looks correct" as evidence | Not falsifiable; a missing implementation also looks correct. |
| Checking only the happy path | Edge cases are where specs are violated. |
| Skipping the absence sweep | A rule that was never written leaves no code to review. |
| Requesting a spec version for a bug fix | Bug fixes change the implementation only. |
| Grading against an open question or a rejected option | Only decided, written requirements bind the code. |
| Trusting a `✅ FIXED` line from a fix pass | It records the fixer's own check; re-test the finding. |
| Passing a requirement you could not check | `UNVERIFIED` with a reason is useful; a false `MET` is worse than no report. |

## Follow-up Commands

Always include the saved report path and the updated `task.md` path, and say what Phase 7 changed in the spec and the plan (or that it changed nothing):

- Fix the BLOCKER and REQUIRED FIX findings, on the ticket's existing branch: `/webkit-fix <ticket> --verify`. IMPROVEMENT findings only if the user names them. The fix marks them FIXED in this report and recomputes its status.
- Only for **Case 2** (a stakeholder changed a requirement): `/webkit-specify <ticket> amend per .agents/specs/<project>/<ticket>/verify.md` (Major version). Case 1 is already applied.
- Root cause of one finding: `/webkit-investigate <target_path> <Finding #2 from .agents/specs/<project>/<ticket>/verify.md>`
- Code quality beyond the spec: `/webkit-code-review <ticket>`
- When Phase 7 Step 3 closed the ticket (`Done`): `/webkit-summarize <ticket>`, to compress the ticket's history into `summary.md` for later sessions.
- After fixes: **no re-run needed.** `/webkit-fix` closes the findings here as a fix pass. Re-run only when its Fix Summary says a re-run is needed, or when a fresh adversarial pass is wanted before merge.
