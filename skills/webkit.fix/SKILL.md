---
name: webkit-fix
description: |
  Applies the approved findings of one existing report (code-review, verify, investigation, refactor or design-review) with the smallest safe change and a regression test for each, runs a regression check and the SemVer step, then closes the loop: marks each finding fixed in that report and recomputes its status, ticks plan.md and task.md, and records the fixes in the spec, so the review does not need a re-run. Ends with a Fix Summary. Never re-reviews, adds findings, or changes a requirement.
  Trigger: "/webkit-fix", "apply the fixes", "fix the findings", "fix what the review found", "apply the fix plan"
  Use when: a report in the ticket folder lists required fixes and they should now go into the code.
---

# Webkit Fix

Acts as a senior software engineer implementing **approved fixes**. It resolves the findings of one report produced by `/webkit-code-review`, `/webkit-verify`, `/webkit-investigate`, `/webkit-refactor`, or `/webkit-design-review`.

This skill **must not** perform another review, generate new findings, or introduce new requirements. It **only implements approved fixes**, then records what it fixed in the ticket's documents ([Phase 8](#phase-8--close-the-loop)), so nobody has to re-run the review just to learn that the fixes landed.

---

## Authority Boundary

This skill owns **only** applying the approved fixes of one report ([authority-boundary.md](../../rules/authority-boundary.md)). It does not perform another skill's responsibility. Tasks that belong to another workflow stage:

- reviewing, verifying, or investigating (any new finding) → `/webkit-code-review`, `/webkit-verify`, `/webkit-investigate`
- new behavior or requirement changes → `/webkit-specify`
- cleanup the report did not approve → `/webkit-refactor`

Phase 8's edits to the report, `plan.md`, `spec.md`, and `task.md` are this skill's own bookkeeping ([ticket-numbering.md §5](../../rules/ticket-numbering.md#5-the-file-contract)), not another skill's work: they record what this run fixed and change no requirement.

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
          approved fixes applied on the ticket's branch → regression check → version detection
                                   │
                                   ▼
          close the loop: findings marked FIXED in the report, its status recomputed,
          plan.md + task.md ticked, spec §14 noted, ticket closed when finished
                                   │
                                   ▼
          Fix Summary → next stage (commit, review, merge); no re-run of the source skill
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

**Callers first.** Before editing a method, class, composable, or component, list who calls it: `graphify explain "<ExactName>" --all` when `graphify-out/graph.json` exists, otherwise grep. Read each caller the fix could change (signature, return shape, side effect); those callers are the regression scope of Phase 5. The graph only locates, and its blind spots (root `AGENTS.md`, **Code graph**) are grep-only.

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
- **Every fix ships with a regression test** ([testing.md](../../rules/testing.md#every-code-change-ships-with-a-test-mandatory)): the finding's failure scenario written as a test, a unit test where the logic runs without the database, a feature test on a disposable database for endpoints, Handlers, and authorization, a component test for a frontend fix. Write it first and watch it fail on the current code; then apply the fix and watch it pass. A frontend app with no runner gets one set up first, per testing.md. The test is part of the fix, never an "Additional issue".
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

- PHP: `php -l <file>`, the regression tests you added and the affected area's existing tests (`php artisan test --filter <Name>`; feature tests on a disposable database per [testing.md](../../rules/testing.md#backend-phpunit)), `php artisan route:list --path=api` after a route change.
- Frontend: the regression tests you added and the area's existing tests (`npm test -- <path>`), plus `npm run typecheck` and `npm run build` where defined.
- The finding's own scenario (the report's failure scenario or reproduction steps) now produces the expected result. Its regression test is this check; a scenario that cannot be a test (device-only) is traced instead.

A check that fails because of your change is fixed before moving on; a check that was already failing before your change is noted, not fixed.

After the last fix, when `graphify-out/graph.json` exists, run `graphify update .` so the next skill sees the fixed code (AST only, no API cost; never commit `graphify-out/`).

---

## Phase 6 — Completion Validation

Before completion, confirm:

- ✓ All approved fixes implemented (or each one not implemented is explained)
- ✓ No unnecessary code added
- ✓ No requirement changed in the spec (Phase 8's notes are bookkeeping)
- ✓ No scope expanded
- ✓ Project conventions maintained
- ✓ Each fix's own scenario checked (Phase 5), with a regression test that failed before and passes now: this is the evidence Phase 8 records

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

These version files and the CHANGELOG, plus Phase 8's document updates, are the only edits beyond the report's findings. They are not an "Additional issue", and no review treats them as scope expansion. This phase never commits, tags, builds, or changes a server-side minimum version.

---

## Phase 8 — Close the Loop

Runs once per run, after Phase 7, whenever at least one finding was handled (fixed, already resolved, or not fixed). **Mandatory**: the report, the plan, the spec, and `task.md` are what the next session reads, and leaving them stale is what forced a full re-run of the review just to learn the fixes had landed. Update each from what this run proved, and nothing more.

### Step 1 — Mark each finding in the report

Replace the `- **Resolution:** Open` line of every finding in the Phase 2 list (including any the user named). A report written before that line existed: add it as the finding's last field.

| Outcome | Resolution line | Counts as |
| --- | --- | --- |
| Applied, and the finding's own failure scenario now gives the expected result (Phase 5) | `✅ FIXED — <YYYY-MM-DD>, /webkit-fix: <one-line change> (<file:line>). Test: <test path> (failed before, passes now).` | Closed |
| Applied, but the scenario cannot be executed here (no disposable database, device only); the code path was traced end to end | `✅ FIXED (traced) — <date>, /webkit-fix: <change>. Test: <test path> written, not run (<reason>). Traced: <path>.` | Closed, flagged |
| Phase 1 found it already resolved | `✅ ALREADY RESOLVED — <date>: <evidence>.` | Closed |
| Skipped, blocked, or not applicable as written | `❌ NOT FIXED — <reason>.` | Open |

The edit alone is never evidence: a finding is closed only by its scenario check or its trace. Findings outside this run's list are left exactly as they are. Investigation reports keep their own form instead: tick the applied §7 Fix Plan steps (`[ ]` → `[x]`) and fill §9 Resolution with what changed, the branch, the date, and the check results (older reports: tick the "High-Level Implementation Plan" and append a "Resolution" note).

### Step 2 — Recompute the report's status as a fix pass

Apply the report's own status rule to the findings still **open**, as if the closed ones were gone ([ticket-numbering.md §5 — Fix pass](../../rules/ticket-numbering.md#fix-pass)):

| Report | Recompute | Also update |
| --- | --- | --- |
| `verify.md` | §1 Overall Status: open BLOCKER → ❌ FAILED; open REQUIRED FIX → ⚠ PASS WITH FIXES; neither → ✅ PASS (keep any `(n AC pending manual check)`) | §2, §4, §5 rows whose every FAIL reason is now closed → PASS `(fixed: Finding #n)`; the §2 AC count; §8 → READY FOR MERGE when nothing required is open, else the open findings only |
| `code-review.md` | Overall Code Quality from the open findings | Final Recommendation |
| `design-review.md` | Overall Design Fit from the open findings | Final Recommendation |
| `refactor.md` | ✅ BEHAVIOR PRESERVED once every check that failed in §5 passes again | §5 Regression Evidence, with the after-fix result |

Then record the pass:

1. End the new status with `(after fix pass vN.k)`, so a reader can tell it from a fresh review.
2. Append the current run's line (`- vN — <date> — <what that run found> — <its status>`) under `<!-- Run history -->`.
3. Set the Metadata run row to `vN.k — fix pass <YYYY-MM-DD> by /webkit-fix: Findings #1–#3 fixed; not re-reviewed` (`k` = 1 for the first fix pass on run N).
4. Prepend one sentence to the report's Summary: `Fix pass vN.k (<date>): Findings #1–#3 fixed by /webkit-fix and confirmed by their own scenarios.`

Rewrite nothing else: findings, evidence, and numbering stay as the review wrote them.

### Step 3 — Tick the plan

`plan.md` in the ticket folder: tick each unticked task that a closed finding completes (the finding cites the task, or the task's **Done when** now holds because of this fix). When every task is ticked or retired, set **Plan Status** to `Done`. Ticks and Plan Status only, the same limit `/webkit-implement` works under: no task is added for a fix, because its record is the Resolution line. No `plan.md` → skip.

### Step 4 — Record the fixes in the spec

The spec template already routes review findings to §14 as a Minor change; write them there now instead of waiting for a `/webkit-specify` run:

1. §14 Implementation Notes → **Review findings**: one entry per closed required finding (BLOCKER / REQUIRED FIX, CRITICAL / HIGH, the investigation's root cause), written as the rule the code must keep: `verify v5 #1 — a linked ticket must be the sender's own application → fixed 2026-10-14`. Replace `N/A — not yet reviewed` if it is still there.
2. §16 Change Log: one row under the **current** version, type `Minor`: `Review findings recorded — /webkit-fix <ticket> --<source> (run vN): #1–#3` · Changed Sections `§14`.
3. **Specification Version** unchanged; no other section touched.

An older header-format `specs.md` with no §14: append a `<!-- Changelog -->` line instead. Any other spec edit a fix seems to need is a requirement change: `Authority boundary: spec change belongs to /webkit-specify. Not done here.`

### Step 5 — Close the ticket when it is finished

If the ticket now meets every condition of [Closing a ticket](../../rules/ticket-numbering.md#closing-a-ticket) (verify ✅ PASS, no CRITICAL / HIGH open in the other reports, every task ticked, no Open Questions, spec `Approved` or `In Progress`), set the spec's **Status** and the plan's **Plan Status** to `Done`. Otherwise leave both; `task.md` §4 says what is missing.

### Step 6 — Update task.md

Per [task.md upkeep](../../rules/ticket-numbering.md#taskmd-upkeep): tick the §3 items closed here (append `— fixed <date>` or `— already resolved <date>`); mirror Step 3's ticks in §2; refresh the §1 Fix row and the source report's row (its new status), **Done**, **Next step**, §4, and **Last Updated**; add the §5 line, e.g. `2026-10-14 · /webkit-fix T00001 --verify · Findings #1–#3 fixed · verify.md → ✅ PASS (after fix pass v5.1)`. A ticket with a spec but no `task.md`: create it from [the task-tracker template](../../template/task-tracker.md) first.

A report with no ticket folder (`.agents/reports/…`): Steps 1–2 only.

### When a re-run is still worth it

Recommend re-running the source skill, in the Fix Summary and as `task.md`'s Next step, **only** when:

- the Completion Status is PARTIALLY COMPLETED,
- a fix was applied as an equivalent change rather than as written (Phase 4),
- a BLOCKER or CRITICAL finding could only be closed as `✅ FIXED (traced)`, or
- a fix changed authorization, a schema, or a public API contract beyond the construct the finding cited.

Otherwise the next step is the next stage of the work (commit, the other review, merge), not a re-run.

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
- change a requirement in the spec or create a specification version (the §14 note, the §16 Minor row, and the `Done` status of Phase 8 are the only spec edits),
- rewrite the architecture,
- apply personal preferences,
- silently fix unrelated problems.

---

## Output — Fix Summary

End by printing the summary in chat, filled from the template [.agents/template/fix-summary.md](../../template/fix-summary.md). Follow its exact structure (Metadata, Applied Fixes, Reused Code, Modified Files, Version, Documents Updated (from Phase 8, with whether a re-run is needed), Notes, Completion Status (FIX COMPLETED / PARTIALLY COMPLETED with the reason)) and delete its guide comments. It is not saved as a file; the record that persists is Phase 8's.

Do not stage or commit. Suggest a Conventional Commit message per [git-workflow.md](../../rules/git-workflow.md) (e.g. `fix(tk): correct late computation grace period`).

---

## Follow-up Commands

The report, `plan.md`, `spec.md`, and `task.md` are already up to date (Phase 8): say so, with the report's new status, and point to `task.md` for what is left. Then suggest only what comes next:

- Commit the fixes (the suggested message above).
- The review that has not run yet on this ticket, e.g. `/webkit-code-review <ticket>` after a `--verify` fix.
- After `--investigation`: the verification checklist in its §7, then `/webkit-code-review <ticket>`.
- Re-run the source skill (`/webkit-verify <ticket>`, `/webkit-code-review <ticket>`, `/webkit-design-review <ticket>`) **only** when [a re-run is still worth it](#when-a-re-run-is-still-worth-it); name the trigger.
- Any "Additional issue discovered": `/webkit-investigate <ticket> <issue>` as a separate ticket.
