---
name: webkit-verify
description: >
  Adversarial review of a completed implementation against its approved specification
  (`.agents/specs/<project>/T#####/spec.md`). Checks whether the implementation followed the spec, whether every
  requirement is complete, and whether hidden functional, edge-case, security, performance, or maintainability
  problems exist. Every claim needs `file:line` evidence. Classifies each finding BLOCKER / REQUIRED FIX /
  IMPROVEMENT / OUT OF SCOPE, gives an overall result of PASS / PASS WITH FIXES / FAILED, a spec-impact verdict,
  and a READY FOR MERGE / FIX REQUIRED BEFORE MERGE recommendation. Not a planning or redesign command: it never
  adds requirements, never edits code or the spec, and writes only `verify.md` into the ticket folder, filled from
  the template `.agents/template/verification-report.md`.
  Triggered by `/webkit-verify <ticket-number or branch-name>`, or `/webkit-verify` alone for the current branch.
---

# Webkit Verify

Reviews the completed implementation against its specification. It answers:

- Did the implementation follow the approved specification?
- Are all requirements completed?
- Are there hidden problems?
- Are there security, performance, usability, or maintainability risks?

This is **not** a feature planning command, **not** a redesign command, and **not** a place to introduce new requirements. The specification remains the source of truth.

> [!IMPORTANT]
> **This skill MUST NOT modify application code or the spec.** Its only output is `verify.md` in the spec's ticket folder. Fixing is `/webkit-fix`'s job; changing the spec is `/webkit-specify`'s, and only under the [Spec Update Rules](#spec-update-rules).

---

## Authority Boundary

This skill owns **only** checking the implementation against its specification, and reporting ([authority-boundary.md](../../rules/authority-boundary.md)). It does not perform another skill's responsibility. Tasks that belong to another workflow stage:

- fixing the code → `/webkit-fix`
- changing the spec → `/webkit-specify`
- reviewing general code quality → `/webkit-code-review`

If a task belongs to another stage: **stop, report it, and do not continue** that task. Report it as `Authority boundary: <the task> belongs to /webkit-<skill>. Not done here.` Do not compensate for another skill, and do not generate work outside this authority.

---

## Inputs

| Form | Meaning |
| --- | --- |
| `/webkit-verify T#####` | Verify that ticket's spec against that ticket's branch. |
| `/webkit-verify <branch-name>` | Verify that branch; the branch names the ticket (`T00004`, `T00004-<slug>`, `F0135`). |
| `/webkit-verify` | Verify the current branch (or the uncommitted workspace) against its ticket's spec. |

---

## Workflow Integration

```text
   spec.md  (.agents/specs/<project>/T#####/spec.md)
                 │
        webkit-implement (backend → frontend)
                 │
                 ▼
          webkit-verify            ← you are here
                 │
                 ▼
   verify.md  (.agents/specs/<project>/T#####/verify.md)
                 │
       ┌─────────┴───────────┐
       ▼                     ▼
   webkit.fix           webkit-specify
 (BLOCKER, REQUIRED     (only when Spec Impact =
  FIX findings)          SPEC UPDATE REQUIRED)
```

The report is a file on disk; `/webkit-fix` usually runs in a new session and can only act on what was saved.

---

## Reviewer Posture

Think like a strict reviewer trying to break the implementation.

1. **Default to not met.** A requirement is unproven until you can point at the `file:line` that implements it. "I saw nothing wrong" is what a missing implementation looks like.
2. **Try to refute, not confirm.** Ask "what would this look like if it were broken, and does it look like that?"
3. **Never trust the code's account of itself.** A comment, a method name, or a variable called `$isAuthorized` is not authorization. Read the body, follow the call, check the caller actually calls it.
4. **Absence is the main target.** The most common failure is a spec rule that was never written. It is found only by walking the spec and asking "where is this?" for each rule.
5. **Every finding is falsifiable.** State concrete inputs or state → the wrong outcome. If you cannot, it is not a finding: mark the requirement `UNVERIFIED` and say why.
6. **Spec, not preference.** Do not compare against personal preference. Style, naming taste, and "I would have done it differently" are not findings.

---

## Phase 1 — Load Context

1. **Resolve the project** with [Which Project Am I In?](../../rules/project-profile.md) and state it. Ticket numbers are per project, so `T00004` exists in both.
2. **Resolve the ticket and its spec** ([ticket-numbering.md](../../rules/ticket-numbering.md) §4):
   - Ticket argument → `.agents/specs/<project>/T#####/spec.md` (`specs.md` on tickets created before `/webkit-specify`).
   - Branch argument, or no argument → the branch name gives the ticket (`git rev-parse --abbrev-ref HEAD` for the current one).
   - Otherwise grep the project's specs for the module, route, or table:

     ```bash
     grep -ril '<feature|route|table|module>' ".agents/specs/$project" --include='*.md' 2>/dev/null
     ```

   - A legacy portal spec (`.agents/specs/<project>/<portal>/<feature>.md`) is still a valid spec to verify against.

   **State the ticket and the evidence for it in your first message.** If no spec exists, **stop and say so**, and suggest `/webkit-specify`. Inventing a standard to judge against is the failure this skill exists to prevent.
3. **Read the spec completely, before any code.** Note its version and Status from the Metadata table. A spec that is not `Approved` is still verified; record its Status in the report header.
4. **Resolve the implementation under review**:
   - **Branch** (ticket or branch argument): fetch and analyze it **without checking it out**, per [ticket-numbering.md §8](../../rules/ticket-numbering.md#8-resolving-a-ticket-argument-to-its-branch) (§8.3). When several branches match, stop and ask.
   - **Current workspace**: `git status --short` plus the branch diff against its base.

   ```bash
   base=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/master)
   git log "$base".."$branch" --oneline
   git diff "$base"..."$branch" --stat     # three dots: only what the branch changed
   ```

5. **Group the changed files** and review each group: Frontend, Backend, Database (migrations, seeders), API (routes, request/response contracts), Configuration (`config/`, `.env.example`, feature flags), Tests.
6. **Separate decided from open.** §15 Technical Decisions, `DECIDED` blocks, and accepted recommendations are binding. §15 Open Questions and unresolved option tables are **not**: code may do either, so they are never findings.
7. **Respect sanctioned drift.** Read the "Known drift" table in [project-profile.md](../../rules/project-profile.md) before flagging code that differs from its neighbours to follow the spec.

---

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

**Absence sweep (do not skip).** For every FR, edge case, and authorization rule, answer in writing *"where would the code be if this existed?"* and look there. Hunt for:

- rules with no enforcement anywhere,
- edge cases with no guard, branch, or catch,
- validation named in the spec but missing from the request class or handler,
- side effects the spec requires (notifications, audit entries) that nothing emits,
- permission rules with no check that reads them.

**Reverse direction.** Code the spec never authorized is a deviation too: endpoints, columns, or response fields with no spec counterpart; items listed in Not Included; `TODO`, stubbed returns, or hard-coded values where real logic is specified; a `try/catch` that hides a failure by returning mock data.

---

## Phase 3 — Adversarial Review

### Functional correctness

- Does the feature work according to the spec?
- Are all required flows implemented?
- Are validations correct?
- Are permissions enforced, for both halves: the allowed role can, **and every other role cannot**?

### Edge cases

- Empty data
- Invalid inputs (null, empty, too long, wrong type, out of range)
- Duplicate actions (double submit, retry replay, concurrent edits)
- Failed requests (database error, external service down, timeout; partial writes outside a transaction)
- Unexpected user behavior (back button, stale page, direct URL access)

### Security

- Authorization (including scoping every query to the tenant / owner, not just the one you looked at)
- Authentication
- Data exposure (fields returned or logged that should not be)
- Input validation
- API protection (IDOR, mass assignment, rate limits, CSRF)

### Performance

- Slow queries (N+1, missing indexes, unbounded `get()`)
- Unnecessary API calls
- Large data handling (pagination, chunking)
- Missing optimization the spec's §7 targets require

### Maintainability

- Code consistency with the existing project patterns and [.agents/rules/](../../rules/)
- Duplicate logic
- Future maintenance problems with a concrete consequence

Judge maintainability against the project's own patterns, never taste. Deep code-quality review belongs to `/webkit-code-review`.

### Verify by execution where you can

Reading shows what the code says; running shows what it does. Use `php artisan tinker --execute="..."`, `php artisan route:list`, `vendor/bin/phpunit`, `npm run typecheck` / `npm run build`, and negative `grep -rn` searches for what must not exist.

> [!CAUTION]
> Never run a destructive command (`migrate:fresh`, truncation, seeding over data) against a database you have not confirmed is disposable. Ask first.

---

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
- Every BLOCKER and REQUIRED FIX names its location (`file:line`), the expected vs actual behavior, and a concrete fix: which file, which construct, what it becomes. Specific enough for `/webkit-fix` to act on without re-deriving the analysis.
- List findings in fix order: dependency-first within each category (if fixing one needs another's migration, that one comes first).
- Number BLOCKER and REQUIRED FIX findings in one sequence (`Finding #1`, `#2`, … continuing from BLOCKER into REQUIRED FIX), so a number always names one issue. Improvements and out-of-scope suggestions are numbered separately (`Improvement #n`, `Suggestion #n`).

### No Scope Expansion

During verification, do **not** suggest new features, new modules, additional workflows, architecture redesign, or database redesign, unless:

1. the current implementation cannot satisfy the existing specification,
2. there is a critical technical problem, or
3. the requirement is contradictory.

Any other such suggestion is marked **OUT OF SCOPE**, and it never triggers a spec update request.

---

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

Verification never updates the specification automatically. The default is **NO SPEC CHANGE REQUIRED**.

Report **SPEC UPDATE REQUIRED** only for:

| Case | Example | Action |
| --- | --- | --- |
| **1. Specification error**: the spec contradicts an existing business rule, is impossible to implement, or contradicts itself. | The spec says "Users can delete records", but the business rule is "Records must be archived". | Correct the spec in place with `/webkit-specify` (Minor change, no new version). |
| **2. Approved requirement change**: a stakeholder changed the requirement. | The stakeholder changes the workflow. | Create a new spec version with `/webkit-specify` (Major change). |

Normal bug fixes **never** change the spec or create a version: missing validation, wrong API response, UI alignment issue, typo, query optimization. Fix the implementation only.

A SPEC UPDATE REQUIRED decision always names the Case and the **Changed Sections** (section name and reason).

---

## Phase 6 — Write the Report

Fill the template [.agents/template/verification-report.md](../../template/verification-report.md). The output **must** follow its exact structure: do not create a custom format, and do not add, remove, rename, or reorder sections. Follow the fill rules in its header comment, then delete every guide comment except the `<!-- Run history -->` marker.

Where this skill's results go in the template:

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

### Persist the report (MANDATORY)

- Write to `.agents/specs/<project>/<ticket>/verify.md`, beside the spec: exactly that filename, no date or feature name ([ticket-numbering.md](../../rules/ticket-numbering.md) §5).
- A **legacy** portal spec has no ticket folder: write to `.agents/reports/<domain>-<feature>-verify-<YYYYMMDD>.md` and say why. Never write `verify.md` into a portal folder, and never allocate a ticket; allocating is `/webkit-specify`'s job.
- Re-verifying **overwrites the file in place**. Before overwriting, append the previous run's **Verification Run** value with its date and status (e.g. `- v1 — 2026-10-08 — initial — ❌ FAILED`) to the list under `<!-- Run history -->` at the bottom. Then increment the version in the Metadata **Verification Run** row, set **Verification Date** to today, and write one line on what changed ("Findings #2–#3 fixed; Finding #1 still open").
- Every `file:line` must be a real, current location.

---

## Anti-Patterns

| Anti-pattern | Why it fails |
| --- | --- |
| Reading the code before the spec | You read the spec as a description of what you already saw. |
| "Looks correct" as evidence | Not falsifiable; a missing implementation also looks correct. |
| Trusting names and comments | They are the first thing to drift from behavior. |
| Checking only the happy path | Edge cases are where specs are violated. |
| Skipping the absence sweep | A rule that was never written leaves no code to review. |
| Suggesting new features or a redesign | Scope expansion. Mark it OUT OF SCOPE. |
| Requesting a spec version for a bug fix | Bug fixes change the implementation only. |
| Grading against an open question or a rejected option | Only decided, written requirements bind the code. |
| Fixing what you find | The report no longer matches any commit. |
| Passing a requirement you could not check | `UNVERIFIED` with a reason is useful; a false `MET` is worse than no report. |

---

## Follow-up Commands

Always include the saved report path:

- Fix the BLOCKER and REQUIRED FIX findings, on the ticket's existing branch: `/webkit-fix <ticket> --verify`. IMPROVEMENT findings only if the user names them.
- Only when Specification Impact is SPEC UPDATE REQUIRED: `/webkit-specify <ticket> amend per .agents/specs/<project>/<ticket>/verify.md` (Case 1 → Minor correction, Case 2 → Major version).
- Root cause of one finding: `/webkit-investigate <target_path> <Finding #2 from .agents/specs/<project>/<ticket>/verify.md>`
- Code quality beyond the spec: `/webkit-code-review <ticket>`
- After fixes: `/webkit-verify <ticket>` again (the run history records what changed).
