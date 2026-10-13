---
name: webkit-fix
description: |
  Applies the approved findings of one existing report (code-review, verify, investigation, refactor or design-review) with the smallest safe change, then runs a regression check and the SemVer step and ends with a Fix Summary. Never re-reviews, adds findings, or edits the spec.
  Trigger: "/webkit-fix", "apply the fixes", "fix the findings", "fix what the review found", "apply the fix plan"
  Use when: a report in the ticket folder lists required fixes and they should now go into the code.
---

# Webkit Fix

Acts as a senior software engineer implementing **approved fixes**. It resolves the findings of one report produced by `/webkit-code-review`, `/webkit-verify`, `/webkit-investigate`, `/webkit-refactor`, or `/webkit-design-review`.

This skill **must not** perform another review, generate new findings, or introduce new requirements. It **only implements approved fixes.**

---

## Authority Boundary

This skill owns **only** applying the approved fixes of one report ([authority-boundary.md](../../rules/authority-boundary.md)). It does not perform another skill's responsibility. Tasks that belong to another workflow stage:

- reviewing, verifying, or investigating (any new finding) → `/webkit-code-review`, `/webkit-verify`, `/webkit-investigate`
- new behavior or spec changes → `/webkit-specify`
- cleanup the report did not approve → `/webkit-refactor`

If a task belongs to another stage: **stop, report it, and do not continue** that task. Report it as `Authority boundary: <the task> belongs to /webkit-<skill>. Not done here.` Do not compensate for another skill, and do not generate work outside this authority.

---

## Inputs

```text
/webkit-fix <ticket-number or branch-name> --<code-review|verify|investigation|refactor|design-review>
```

| Example | Meaning |
| --- | --- |
| `/webkit-fix T00001 --code-review` | Apply the required findings of `T00001`'s `code-review.md`. |
| `/webkit-fix T00001 --verify` | Apply the required findings of `T00001`'s `verify.md`. |
| `/webkit-fix T00007 --investigation` | Apply `T00007`'s investigation fix plan. |
| `/webkit-fix feature/auth --verify` | Apply the verification findings for that branch's work. |
| `/webkit-fix T00001 --code-review Finding #5` | Also apply a finding that is not required by default, because the user named it. |

**No flag given:** if the ticket folder holds exactly one report, use it and say so; if it holds several, ask which one.

---

## Core Principle: The Report Is the Source of Truth

| Flag | Report | Approved fixes | Ignored unless the user names them |
| --- | --- | --- | --- |
| `--code-review` | `code-review.md` | **CRITICAL**, **HIGH** | MEDIUM, LOW, INFO |
| `--verify` | `verify.md` | **BLOCKER**, **REQUIRED FIX** | IMPROVEMENT, OUT OF SCOPE |
| `--investigation` | `investigation.md` | **§5 Recommended Solution** and **§7 Fix Plan** | §8 Other Findings (they are separate tickets) |
| `--refactor` | `refactor.md` | Status **❌ REGRESSION DETECTED**: restore the behavior — the checks failing in **Regression Evidence** and the **Behavior change** it records | Deliberately Not Done |
| `--design-review` | `design-review.md` | **CRITICAL**, **HIGH** findings (the Fix Plan's CRITICAL / HIGH rows in older reports) | MEDIUM, LOW, INFO, Modern Enhancement Ideas (never applied) |

Never invent additional work. A finding the report does not contain is not a fix.

---

## Workflow Integration

```text
   code-review.md · verify.md · investigation.md · refactor.md · design-review.md
                                   │
                                   ▼
              /webkit-fix <ticket> --<source>          ← you are here
                                   │
                                   ▼
          approved fixes applied on the ticket's branch → version detection → Fix Summary
                                   │
                                   ▼
          re-run the source skill to confirm (e.g. /webkit-verify <ticket>)
```

---

## Phase 0 — Gates (BLOCKING)

**Project gate.** Run [Which Project Am I In?](../../rules/project-profile.md), **state the resolved project in your first message**, and read only that project's sections. A fix written to the other project's conventions (database rules, component names, file layout) looks idiomatic and is wrong.

**Branch gate.** Run the [Mandatory Branch Gate](../../rules/git-workflow.md#mandatory-branch-gate-for-implementing-skills) **before editing any file**:

- Fixes for a ticket's findings belong **on that ticket's existing branch** (`T#####`): continue there; never open a separate `bugfix/` branch for them.
- A ticket or branch argument that exists on the remote: fetch and analyze it first ([ticket-numbering.md §8](../../rules/ticket-numbering.md#8-resolving-a-ticket-argument-to-its-branch)), then check it out. When several branches match (`F0135`, `F0135-fixed`, `f0135`), **stop and ask**.
- On `main` / `master`: create and switch to the ticket's branch now (`T#####`, or `bugfix/<domain>-<slug>` / `hotfix/…` for work with no ticket).
- On a branch for different work, or detached HEAD: **stop and ask**.
- **Never** `git checkout -B`, `git reset --hard`, or force-push to make a local branch match the remote: that destroys unpushed work.

---

## Phase 1 — Load Context

1. **Resolve the ticket and the report** for the flag:
   - Ticketed work: `.agents/specs/<project>/T#####/<report>.md`.
   - Work with no ticket folder (an `F####` ticket or a plain branch): the matching report under `.agents/reports/` (`<scope>-review-<date>.md`, `<scope>-verify-<date>.md`, `<scope>-investigation-<date>.md`, `<scope>-refactor-<date>.md`, `<scope>-design-review-<date>.md`; `--code-review` means `-review-` only, never `-design-review-`). Find it by the branch name it records.
   - **No report found → stop.** There is nothing approved to fix; suggest running the skill that produces it.
2. **Read the report completely.** Note its run version and date.
3. **Check the report still applies**: compare the cited `file:line` locations with the current code. Code moved → re-locate the same construct. Finding already resolved → record it as "Already resolved" and do not touch it. Report much older than the branch's latest changes → say so in the summary.
4. **Load the surrounding context**: the cited files at the cited lines, the ticket's spec if one exists (a fix must not contradict it), and the project rules for the layers touched ([.agents/rules/](../../rules/)).
5. **For `--investigation`**: if its Root Cause Status is **❌ ROOT CAUSE NOT FOUND**, stop: there is no approved fix. If it is **⚠ PROBABLE ROOT CAUSE**, apply the plan and note the reduced confidence in the summary.

---

## Phase 2 — Extract Approved Fixes

Build the list from the report only, using the table in [Core Principle](#core-principle-the-report-is-the-source-of-truth):

| Finding Reference | Location | Required Action |
| --- | --- | --- |
| `Finding #2` / `Fix Plan step 3` / … | `path/file.php:42` | the report's fix, verbatim |

- Keep the report's order (it is dependency-first). Findings that share a file and construct are applied as one change.
- Add a lower-severity item only when the user named it in the command.
- Do not reword a required action into a different change.

---

## Phase 3 — Validate Existing Code

Before modifying code, for each fix:

- Can existing code be reused?
- Can existing logic be extended?
- Will this introduce duplication?
- Does another implementation already solve this?

If the fix needs a new column, route, model, or table, run the [System Awareness](../../rules/system-awareness.md) scan first. When an existing structure is simply used wrongly, **fix the usage, not the schema**. Never duplicate code ([duplicate-prevention.md](../../rules/duplicate-prevention.md)).

---

## Phase 4 — Apply Fixes

Implement each fix **exactly as the report describes**, one at a time, in order.

Allowed work: bug fixes, validation fixes, security fixes, performance improvements, logic corrections, code cleanup, and refactoring that the report approved. Nothing unrelated.

Where the fix usually lives ([project-profile.md](../../rules/project-profile.md)):

| Problem is in… | Fix lives in… |
| --- | --- |
| Wrong data returned / query logic | The `Get<X>Query` in `app/Queries/<Domain>/` (**not** `app/Domain/`, which is retired) |
| Wrong write, save, or calculation | The `Save<X>Handler` in `app/Handlers/<Domain>/`, kept inside `DB::transaction` |
| Wrong status code / response shape | The controller method: `try/catch` + `response()->json(...)`; this project uses no API Resources |
| 404 / wrong endpoint | `routes/api/<group>.php`, grouped by portal or by domain per the profile (mind any namespace-vs-URL-prefix difference it records) |
| Wrong value on screen / UI behavior | The module's `pages/` or `components/` file |
| Wrong API call | The module's api layer, using the HTTP client the profile names |
| Wrong payroll / overtime / leave number | The formula, checked against [hrms-rules.md](../../rules/hrms-rules.md) first |

Rules while applying:

- **Smallest diff** that resolves the finding. Preserve imports, unrelated methods, comments, formatting, and business logic ([incremental-generation.md](../../rules/incremental-generation.md)).
- **Report's fix cannot be applied as written** (the approach would break something, or the code changed shape): apply it only if an equivalent change achieves the same thing in substance. Otherwise skip it and explain why; the status becomes PARTIALLY COMPLETED. Never substitute a different design of your own.
- **Additional issue discovered** (a problem the report does not contain): do **not** fix it. Record it in the summary as **"Additional issue discovered — requires separate review"**, with its location. If it blocks an approved fix, stop that fix and mark the status PARTIALLY COMPLETED.

---

## Phase 5 — Regression Check

After each fix, verify:

- the original functionality still works,
- no existing feature was broken,
- validation still works,
- authorization still works,
- API compatibility is maintained (same routes, same response shape),
- no duplicate logic was introduced.

Run the checks the project actually has:

- PHP: `php -l <file>`, `vendor/bin/phpunit --filter <test>` for the affected area, `php artisan route:list --path=api` after a route change.
- Frontend: `npm run typecheck` and `npm run build` where defined. Not every project has a JS test runner; never run or report a test command the project does not define.
- The finding's own scenario (the report's failure scenario or reproduction steps) now produces the expected result.

A check that fails because of your change is fixed before moving on; a check that was already failing before your change is noted, not fixed.

---

## Phase 6 — Completion Validation

Before completion, confirm:

- ✓ All approved fixes implemented (or each one not implemented is explained)
- ✓ No unnecessary code added
- ✓ No specification modified
- ✓ No scope expanded
- ✓ Project conventions maintained

**Close the loop on the report** (`--investigation` only): tick the applied steps in its §7 Fix Plan (`[ ]` → `[x]`) and fill §9 Resolution with what changed, the branch, the date, and the verification result (older reports: tick the "High-Level Implementation Plan" and append a "Resolution" note). The other reports are never edited: confirm them by re-running their skill.

---

## Phase 7 — Version Detection

Runs after Phase 6, once per run, and only if at least one fix was applied. Follow [versioning.md](../../rules/versioning.md) exactly; in short:

1. **Read the mode** from `.agents/config/<project>.yml` → `versioning.mode`. No file or no key → `recommend`. `off` → skip this phase.
2. **Per target**, list everything changed on the branch since its base, in that app's own repo. Nothing under its paths → `NONE`.
3. **Did the defect ship?** For each fixed file, check whether the fixed lines exist in the base ([versioning.md §2 Step 4](../../rules/versioning.md)):
   - **Shipped** (the bug is in a released version: an investigation ticket, a `bugfix/` or `hotfix/` branch) → **PATCH**, plus a CHANGELOG **Fixed** line written from the report's symptom.
   - **Never shipped** (a review finding on work added on this same branch) → no level of its own. The branch keeps the level `/webkit-implement` already gave it: the same version, with no new CHANGELOG line.
4. **Compute from the base**, never from the working tree. A ticket branch that `/webkit-implement` already bumped is re-checked, never bumped again. A PATCH on top of an unreleased MINOR is still the MINOR.
5. **`auto`**: write the version files, build numbers, and the Fixed line. **`recommend`**: change nothing; report the edits.

These version files and the CHANGELOG are the only edits beyond the report's findings. They are not an "Additional issue", and no review treats them as scope expansion. This phase never commits, tags, builds, or changes a server-side minimum version.

---

## Development Principles

- **Minimal change.** The smallest change necessary; never rewrite large sections.
- **Reuse first.** Existing services, components, utilities, validation, and architecture. Never duplicate.
- **Consistency.** The project's architecture, folder structure, coding and naming conventions, and existing patterns.
- **Safety.** Do not break existing behavior, change public APIs, change business logic, or change the database schema unless the approved fix explicitly requires it.

## Restrictions

Do **not**:

- perform another code review, verification, or investigation,
- generate new findings,
- suggest new features or expand scope,
- update specifications or create specification versions,
- rewrite the architecture,
- apply personal preferences,
- silently fix unrelated problems.

---

## Output — Fix Summary

End by printing the summary in chat, filled from the template [.agents/template/fix-summary.md](../../template/fix-summary.md). Follow its exact structure (Metadata, Applied Fixes, Reused Code, Modified Files, Version, Notes, Completion Status (FIX COMPLETED / PARTIALLY COMPLETED with the reason)) and delete its guide comments. It is not saved as a file.

Do not stage or commit. Suggest a Conventional Commit message per [git-workflow.md](../../rules/git-workflow.md) (e.g. `fix(tk): correct late computation grace period`).

---

## Follow-up Commands

Re-run the skill that produced the report to confirm the fixes:

- After `--verify`: `/webkit-verify <ticket>`
- After `--code-review`: `/webkit-code-review <ticket>`
- After `--design-review`: `/webkit-design-review <ticket>`
- After `--investigation`: the verification checklist in its §7, then `/webkit-code-review <ticket>`
- Any "Additional issue discovered": `/webkit-investigate <ticket> <issue>` as a separate ticket
