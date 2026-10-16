---
name: webkit-refactor
description: |
  Behavior-preserving restructuring toward a stated goal: remove duplication, move logic into the project's Query / Handler / Action and component patterns, use the design system, delete dead code. Proved by the project's own checks and tests before and after (a characterization test first where none covers the code); writes `refactor.md`. Never fixes bugs or changes routes, APIs or schema.
  Trigger: "/webkit-refactor", "refactor", "clean up", "remove duplication", "dead code", "consolidate"
  Use when: the code works but should be restructured without changing what it does.
---

# Webkit Refactor

Acts as a senior software engineer restructuring existing code **without changing its behavior**. The goal is code that is easier to maintain: less duplication, logic in the right layer, shared components instead of local copies, no dead code.

This skill only restructures. It is **not** responsible for:

- fixing bugs (`/webkit-fix`; a bug's root cause is found by `/webkit-investigate`),
- adding or changing features (`/webkit-specify` → `/webkit-implement`),
- reviewing code (`/webkit-code-review`) or checking the spec (`/webkit-verify`),
- changing the specification.

> [!IMPORTANT]
> **Behavior is the contract.** Routes, request and response shapes, database schema, model events, business results, and visible UI behavior stay exactly as they are. A change to any of them is not a refactor.

---

## Authority Boundary

This skill owns **only** behavior-preserving restructuring toward the stated goal ([authority-boundary.md](../../rules/authority-boundary.md)). It does not perform another skill's responsibility. Tasks that belong to another workflow stage:

- fixing a bug or changing a business result → `/webkit-investigate`, then `/webkit-fix`
- new behavior → `/webkit-specify`, then `/webkit-implement`
- reviewing the code → `/webkit-code-review`

If a task belongs to another stage: **stop, report it, and do not continue** that task. Report it as `Authority boundary: <the task> belongs to /webkit-<skill>. Not done here.` Do not compensate for another skill, and do not generate work outside this authority.

---

## Inputs

| Form | Meaning |
| --- | --- |
| `/webkit-refactor <target_path> <goal>` | Restructure that file or module toward the stated goal. |
| `/webkit-refactor T##### <goal>` | Clean up within that ticket (usually its own implementation), on its branch. |
| `/webkit-refactor T##### --code-review Finding #n` | Apply named maintainability findings from the ticket's `code-review.md` (duplication, large functions, dead code, inconsistent patterns). |

The goal must be specific ("extract the leave-credit calculation shared by the two controllers"), not "clean up this module".

---

## Workflow Integration

```text
   user goal · code-review.md (maintainability findings)
                     │
                     ▼
            /webkit-refactor            ← you are here
                     │
   baseline checks → small behavior-preserving steps → same checks again
                     │
                     ▼
   refactor.md  (.agents/specs/<project>/T#####/refactor.md)
                     │
          ┌──────────┴──────────────┐
          ▼                         ▼
   /webkit-code-review       /webkit-fix <ticket> --refactor
   (review the result)       (only if REGRESSION DETECTED)
```

---

## Core Rules

- **No behavior change.** If a step would change behavior, it is not done here: record it under Deliberately Not Done and point to `/webkit-investigate` or `/webkit-fix`.
- **No scope expansion.** Only the stated goal. Other drift you notice is recorded, not fixed.
- **Evidence, not reading.** The project's own checks run **before** (baseline) and **after**; a refactor verified only by reading is verified by nobody.
- **Reuse first.** Move logic into existing classes, helpers, and design-system components before creating new ones.
- **Small steps.** One move at a time, checked as you go; never a rewrite-everything diff.
- **The spec is not edited.** It describes the behavior that must be preserved.

## Refactor Mindset

Ask:

- What exactly is being improved, and which project rule or pattern does the result follow?
- Does a shared component, helper, Query, or Handler already do this?
- Does the shared version cover **every** behavior of the local copy?
- Which callers, payloads, or UI states could notice this change?
- Which check proves nothing changed?

---

## Phase 0 — Gates (BLOCKING)

**Project gate.** Run [Which Project Am I In?](../../rules/project-profile.md), **state the resolved project in your first message**, and read only that project's sections. Refactoring toward the other project's conventions introduces drift under the banner of removing it, and every line looks idiomatic.

**Ticket.** Resolve or allocate it before the branch, so both carry the same number ([ticket-numbering.md](../../rules/ticket-numbering.md) §2, §4):

1. **On a `T#####` branch, or the input names a ticket** → that ticket. Cleaning up a ticket's own implementation belongs in that ticket.
2. **An existing ticket already covers this code** → use it ([ticket-numbering.md](../../rules/ticket-numbering.md) §3):

   ```bash
   grep -ril '<module|route|table|class>' ".agents/specs/$project" --include='*.md' 2>/dev/null
   ```

3. **A standalone cleanup with no ticket** → this skill starts that workstream, so allocate the next number in the project:

   ```bash
   project="<project>"   # the folder name resolved in the project gate

   max=$(find ".agents/specs/$project" -maxdepth 1 -type d -name 'T[0-9][0-9][0-9][0-9][0-9]' 2>/dev/null \
         | sed 's#.*/T##' | sort -n | tail -1)
   next=$(printf 'T%05d' $(( ${max:-0} + 1 )))
   mkdir -p ".agents/specs/$project/$next"   # claim it before writing anything
   echo "$project/$next"
   ```

   Always `max + 1`, never the first free gap.

**Branch gate.** Run the [Mandatory Branch Gate](../../rules/git-workflow.md#mandatory-branch-gate-for-implementing-skills) **before editing any file**:

- A ticket argument that exists on the remote: fetch and analyze its branch first ([ticket-numbering.md §8](../../rules/ticket-numbering.md#8-resolving-a-ticket-argument-to-its-branch)); when several branches match, **stop and ask**.
- On `main` / `master`: create and switch to `T#####` now.
- Cleaning up a ticket's own implementation: stay on that ticket's branch; never open a second one.
- On a branch for different work, or detached HEAD: **stop and ask**.

---

## Phase 1 — Load Context

1. **The goal and the target**: the path, the stated goal, or the named code-review findings (read `code-review.md` for their location and recommendation).
2. **The ticket's documents**: its spec (the behavior to preserve), and any `investigation.md`, `verify.md`, or `code-review.md` for context. A report is optional.
3. **The rules the target touches**: [laravel-standards.md](../../rules/laravel-standards.md) for PHP; your project's frontend standards ([vue-standards.md](../../rules/vue-standards.md) for Vue, your project's section of [project-profile.md](../../rules/project-profile.md) for React); [duplicate-prevention.md](../../rules/duplicate-prevention.md).
4. **The callers**: every place that uses what you are about to move (grep the class, method, component, and route), so nothing is left pointing at the old location. When `graphify-out/graph.json` exists, start with `graphify explain "<ExactName>" --all`, then grep anyway: the graph misses route → method links, string references, and globally-registered components, and a missed caller is a regression. After the last step, run `graphify update .` so the graph shows the new locations.

---

## Phase 2 — Baseline

Before changing anything, run the checks the project actually has and record the results:

- PHP: `php -l <file>` for files you will touch; `php artisan test --filter <area>` (PHPUnit exists in both projects; feature tests on a disposable database per [testing.md](../../rules/testing.md#backend-phpunit)).
- Frontend: `npm test -- <path>`, `npm run typecheck`, `npm run build` where defined.
- **No test covers the code you will move → write one now** (a characterization test: it pins today's behavior, including its odd cases), per [testing.md](../../rules/testing.md#every-code-change-ships-with-a-test-mandatory): a unit test for pure logic, a feature test for an endpoint, Handler, or Query, a component test for a frontend piece (a frontend app with no runner gets one set up first). It must pass **before** the first move; it is the proof the refactor changed nothing. A refactor of untested code proved only by typecheck is not proved.
- **API payloads**: for every endpoint whose code you will touch, capture the response shape now (e.g. `php artisan tinker --execute="..."` against a read-only call, or the existing test's assertion).

A check that already fails at baseline is recorded as failing; it is not this refactor's job to fix it.

---

## Phase 3 — Plan the Restructure

List each move: what goes from where to where, and which rule the result follows.

| Scenario | Target |
| --- | --- |
| Repeated validation, computation, or query logic | One shared Query, Handler, Action, trait, or helper; on the frontend, the shared composable / hook or util your project uses |
| Heavy inline controller logic | `app/Queries/<Domain>/` (reads) and `app/Handlers/<Domain>/` (writes), per [laravel-standards.md](../../rules/laravel-standards.md); the controller stays thin |
| Oversized page or template | Components in the module's `components/` folder, following the project's component conventions |
| Hand-rolled button, modal, select, table, or formatter | The design-system component or shared util that already provides it |
| Dead code, unreachable branches, commented-out blocks, stray debug output | Deleted |
| Performance without behavior change (N+1, repeated calculation) | Eager loading, memoized values; same results, fewer queries |

> [!CAUTION]
> **`app/Domain/` is retired and does not exist on disk.** Do not move code into it, and do not conclude "no existing Query" from an empty search of it: search `app/Queries/` and `app/Handlers/`. Correcting a stale `App\Domain\...` namespace in a file you touch is part of the refactor.

**Before consolidating a duplicate**, confirm the shared version covers **every** behavior of the local copy (props, states, edge cases). A "duplicate" with an extra behavior is a feature: collapsing it changes behavior. Either fold that capability into the shared component, or leave the copy and record why.

---

## Phase 4 — Apply in Small Steps

- One move at a time; run the relevant check after each.
- Update every caller found in Phase 1; leave no reference to the old location.
- Preserve developer comments, business reasoning, and copyright markers; update PHPDoc / JSDoc to match changed signatures.
- Keep state reactivity intact (Vue refs / computed; React state identity and hook dependency arrays) and database transactions intact (`DB::transaction` stays around the same writes).
- Never introduce a new library, pattern, or folder hierarchy the project does not already use.

---

## Phase 5 — Regression Check

Run the **same** checks as the baseline and compare:

- every check that passed before still passes,
- API payloads are identical for every touched endpoint,
- no visible UI behavior changed,
- no caller still references a moved or deleted symbol.

If a check fails because of this refactor, **restore the behavior** (adjust the step, or revert it). Never leave a behavior change in place silently.

**Refactor Status:**

| Status | When |
| --- | --- |
| **✅ BEHAVIOR PRESERVED** | Every check passed before and after; payloads identical. |
| **⚠ PRESERVED WITH UNVERIFIED AREAS** | Every check run passed, but some area could not be checked (named in the record). |
| **❌ REGRESSION DETECTED** | A check still fails after the refactor and could not be restored. Hand it to `/webkit-fix <ticket> --refactor`, or revert. |

---

## Phase 6 — Write the Record

Fill the template [.agents/template/refactor-report.md](../../template/refactor-report.md). Follow its exact structure: no custom format, no added, removed, renamed, or reordered sections. Follow the fill rules in its header comment, then delete every guide comment except the `<!-- Run history -->` marker.

### Persist the record (MANDATORY)

- Write to `.agents/specs/<project>/<ticket>/refactor.md`: exactly that filename ([ticket-numbering.md](../../rules/ticket-numbering.md) §5).
- An `F####` ticket with no ticket folder ([ticket-numbering.md §8.4](../../rules/ticket-numbering.md#84-where-the-report-goes)): write to `.agents/reports/<scope>-refactor-<YYYYMMDD>.md` and name the branch in the Metadata.
- A second cleanup on the same ticket **updates the file in place**. Before overwriting, append the previous run's **Refactor Run** value with its date and status (e.g. `- v1 — 2026-10-08 — extracted leave-credit Query — ✅ BEHAVIOR PRESERVED`) to the list under `<!-- Run history -->`. Then increment the Metadata **Refactor Run** row and set **Refactor Date** to today.
- End your message with the status, the ticket, and the record path. Do not stage or commit; suggest a Conventional Commit message per [git-workflow.md](../../rules/git-workflow.md) (e.g. `refactor(hr): extract shared leave-credit calculation`).

---

## Restrictions

Do **not**:

- fix bugs or change business results, even ones you notice (record them under Deliberately Not Done),
- add features or expand scope beyond the stated goal,
- change routes, request / response shapes, database schema, model events, or visible UI behavior,
- edit the specification,
- introduce a different architecture, library, or folder structure (the dev-only test runner [testing.md](../../rules/testing.md#setting-up-a-missing-frontend-runner-one-time-done-by-the-skill) sets up is the one exception),
- report a check as passing that was not run.

---

## Anti-Patterns

| Anti-pattern | Why it fails |
| --- | --- |
| No baseline before editing | Nothing proves behavior held; a failure afterwards may have been there all along. |
| Fixing a bug "while I'm here" | The behavior change hides inside a refactor and skips review. Use `/webkit-fix`. |
| Collapsing a "duplicate" that had an extra behavior | A silent feature removal. Check coverage first. |
| One huge rewrite diff | Regressions cannot be traced to a step. |
| Moving code into `app/Domain/` | A retired, dead namespace. |
| Leaving callers on the old location | The refactor compiles in one place and breaks in another. |
| Reporting unrun checks as passing | A false baseline; the record becomes untrustworthy. |

---

## Follow-up Commands

- Review the result: `/webkit-code-review <ticket>`
- Status ❌ REGRESSION DETECTED: `/webkit-fix <ticket> --refactor`, or revert the step
- A bug noticed during the refactor: `/webkit-investigate <ticket> <issue>`
