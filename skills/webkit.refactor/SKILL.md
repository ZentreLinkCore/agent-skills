---
name: webkit-refactor
description: |
  Behavior-preserving restructuring toward a stated goal: remove duplication, move logic into the project's Query / Handler / Action and component patterns, use the design system, delete dead code. Proved by the project's own checks and tests before and after (a characterization test first where none covers the code); writes `refactor.md`. Never fixes bugs or changes routes, APIs or schema.
  Trigger: "/webkit-refactor", "refactor", "clean up", "remove duplication", "dead code", "consolidate"
  Use when: the code works but should be restructured without changing what it does.
---

# Webkit Refactor

Acts as a senior software engineer restructuring existing code **without changing its behavior**. The goal is code that is easier to maintain: less duplication, logic in the right layer, shared components instead of local copies, no dead code.

> [!IMPORTANT]
> **Behavior is the contract.** Routes, request and response shapes, database schema, model events, business results, and visible UI behavior stay exactly as they are. A change to any of them is not a refactor.

Shared steps (gates, ticket resolution, templates, report persistence, code-writing runs) follow [skill-protocol.md](../../rules/conditional/skill-protocol.md). **Authority:** behavior-preserving restructuring toward the stated goal. Fixing a bug or changing a business result → `/webkit-investigate`, then `/webkit-fix`; new behavior → `/webkit-specify`, then `/webkit-implement`; reviewing the code → `/webkit-code-review`; checking the spec → `/webkit-verify`. The specification is never changed here.

## Inputs

| Form | Meaning |
| --- | --- |
| `/webkit-refactor <target_path> <goal>` | Restructure that file or module toward the stated goal. |
| `/webkit-refactor T##### <goal>` | Clean up within that ticket (usually its own implementation), on its branch. |
| `/webkit-refactor T##### --code-review Finding #n` | Apply named maintainability findings from the ticket's `code-review.md` (duplication, large functions, dead code, inconsistent patterns). |

The goal must be specific ("extract the leave-credit calculation shared by the two controllers"), not "clean up this module".

## Context Loading Priority

1. **`task.md`** (read `summary.md` first if it exists).
2. **`context.md`** (if it exists): its `touched-files.md` §5 Tests names the area's existing tests for the Phase 2 baseline, and `dependency-map.md` §3 Callers That Must Keep Working is a starting list for Phase 1's callers.
3. **`spec.md` only for the behavior to preserve**: the sections describing the code being moved, in Phase 1. No `plan.md`. A `--code-review Finding #n` input: only those findings in `code-review.md` (location and recommendation). An `investigation.md` or `verify.md` only for what it says about the target; a report is optional.
4. **The target and its callers**: Graphify first (`affected` on what moves; [context-budget.md §2](../../rules/context-budget.md#2-find-code-graphify-first-then-targeted-search)), then targeted `rg` for the class, method, component, and route.

Rules: per the [router](../../rules/rule-router.md), for the files the target touches, plus [system-awareness.md §4](../../rules/conditional/system-awareness.md#4-no-duplicate-logic) always (consolidation is this skill's main move). The template at Phase 6. **Avoid:** reading modules beyond the target and its callers, unrelated reports, all project documentation or the whole blueprint, re-reading rules.

## Core Rules

- **No behavior change.** If a step would change behavior, it is not done here: record it under Deliberately Not Done and point to `/webkit-investigate` or `/webkit-fix`.
- **No scope expansion.** Only the stated goal. Other drift you notice is recorded, not fixed.
- **Evidence, not reading.** The project's own checks run **before** (baseline) and **after**; a refactor verified only by reading is verified by nobody.
- **Reuse first.** Move logic into existing classes, helpers, and design-system components before creating new ones.
- **Small steps.** One move at a time, checked as you go; never a rewrite-everything diff.
- **The spec is not edited.** It describes the behavior that must be preserved.

**Mindset:** What exactly is being improved, and which project rule or pattern does the result follow? Does a shared component, helper, Query, or Handler already do this? Does the shared version cover **every** behavior of the local copy? Which callers, payloads, or UI states could notice this change? Which check proves nothing changed?

## Phase 0 — Gates (BLOCKING)

Run protocol §1. The project gate matters here: refactoring toward the other project's conventions introduces drift under the banner of removing it, and every line looks idiomatic.

**Ticket.** Resolve or allocate it before the branch, so both carry the same number ([ticket-numbering.md §2–§3](../../rules/conditional/ticket-numbering.md#2-allocating-a-number-the-increment)):

1. **On a `T#####` branch, or the input names a ticket** → that ticket. Cleaning up a ticket's own implementation belongs in that ticket.
2. **An existing ticket already covers this code** → use it (§3).
3. **A standalone cleanup with no ticket** → this skill starts that workstream: allocate the next number per §2.

**Branch gate** per protocol §1, **before editing any file**. Refactor-specific: cleaning up a ticket's own implementation stays on that ticket's branch, never a second one; a standalone cleanup branches on the `T#####` it just allocated.

## Phase 1 — Load Context

Load per Context Loading Priority: the goal and the target (the path, the stated goal, or the named code-review findings), and the spec's behavior to preserve.

**Find every caller** of what you are about to move (the class, method, component, and route): `graphify explain "<ExactName>" --all` (and `affected --depth 2`) first, then targeted `rg` for each symbol **anyway**: the graph misses route → method links, string references, and globally-registered components, and a missed caller is a regression. Nothing may be left pointing at the old location.

## Phase 2 — Baseline

Before changing anything, run the checks the project actually has and record the results:

- PHP: `php -l <file>` for files you will touch; `php artisan test --filter <area>` (PHPUnit exists in both projects; feature tests on a disposable database per [testing.md](../../rules/conditional/testing.md#backend-phpunit)).
- Frontend: `npm test -- <path>` and `npm run typecheck` where defined; after each move, `node .agents/scripts/check-changed.mjs` (only the changed files; never the full `npm run build`: [testing.md](../../rules/conditional/testing.md#frontend-build-check-changed-files-only)).
- **No test covers the code you will move → write one now** (a characterization test: it pins today's behavior, including its odd cases), per [testing.md](../../rules/conditional/testing.md#every-code-change-ships-with-a-test-mandatory): a unit test for pure logic, a feature test for an endpoint, Handler, or Query, a component test for a frontend piece (a frontend app with no runner gets one set up first). It must pass **before** the first move; it is the proof the refactor changed nothing. A refactor of untested code proved only by typecheck is not proved.
- **API payloads**: for every endpoint whose code you will touch, capture the response shape now (e.g. `php artisan tinker --execute="..."` against a read-only call, or the existing test's assertion).

A check that already fails at baseline is recorded as failing; it is not this refactor's job to fix it.

## Phase 3 — Plan the Restructure

List each move: what goes from where to where, and which rule the result follows.

| Scenario | Target |
| --- | --- |
| Repeated validation, computation, or query logic | One shared Query, Handler, Action, trait, or helper; on the frontend, the shared composable / hook or util your project uses |
| Heavy inline controller logic | `app/Queries/<Domain>/` (reads) and `app/Handlers/<Domain>/` (writes), per [backend.md §1](../../rules/conditional/backend.md#1-query--handler--action-all-projects); the controller stays thin |
| Oversized page or template | Components in the module's `components/` folder, following the project's component conventions |
| Hand-rolled button, modal, select, table, or formatter | The design-system component or shared util that already provides it |
| Dead code, unreachable branches, commented-out blocks, stray debug output | Deleted |
| Performance without behavior change (N+1, repeated calculation) | Eager loading, memoized values; same results, fewer queries |

> [!CAUTION]
> **`app/Domain/` is retired and does not exist on disk.** Do not move code into it, and do not conclude "no existing Query" from an empty search of it: search `app/Queries/` and `app/Handlers/`. Correcting a stale `App\Domain\...` namespace in a file you touch is part of the refactor.

**Find the shared version** with Graphify first (`explain --all` on candidate names, `query --seed` only to find a label, then `affected` on the candidate to see who already uses it), then targeted search ([context-budget.md §2](../../rules/context-budget.md#2-find-code-graphify-first-then-targeted-search)).

**Before consolidating a duplicate**, confirm the shared version covers **every** behavior of the local copy (props, states, edge cases). A "duplicate" with an extra behavior is a feature: collapsing it changes behavior. Either fold that capability into the shared component, or leave the copy and record why.

## Phase 4 — Apply in Small Steps

Code-writing discipline per protocol §6. Refactor-specific:

- One move at a time; run the relevant check after each.
- Update every caller found in Phase 1; leave no reference to the old location.
- After the last move, when `graphify-out/graph.json` exists, run `graphify update .` so the graph shows the new locations (never commit `graphify-out/`).
- Preserve developer comments, business reasoning, and copyright markers; update PHPDoc / JSDoc to match changed signatures.
- Keep state reactivity intact (Vue refs / computed; React state identity and hook dependency arrays) and database transactions intact (`DB::transaction` stays around the same writes).

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

## Phase 6 — Write the Record

Fill [refactor-report.md](../../template/refactor-report.md) per protocol §3, and persist it per protocol §4 as **`refactor.md`** (`<kind>` = `refactor` in `.agents/reports/` names). Skill-specific:

- An `F####` ticket with no ticket folder ([ticket-numbering.md §8.4](../../rules/conditional/ticket-numbering.md#84-where-the-report-goes)): write to `.agents/reports/<scope>-refactor-<YYYYMMDD>.md` and name the branch in the Metadata.
- A second cleanup on the same ticket **updates the file in place** (protocol §4): the run row is **Refactor Run**, its date **Refactor Date** (e.g. `- v1 — 2026-10-08 — extracted leave-credit Query — ✅ BEHAVIOR PRESERVED`).
- End with the status, the ticket, and the record path (protocol §7), and a suggested Conventional Commit message (protocol §6), e.g. `refactor(hr): extract shared leave-credit calculation`.

## Restrictions

Beyond the core rules and the contract above:

- Never introduce a different architecture, library, pattern, or folder hierarchy the project does not already use. The one exception: the dev-only test runner [testing.md](../../rules/conditional/testing.md#setting-up-a-missing-frontend-runner-one-time-done-by-the-skill) sets up.
- Never report a check as passing that was not run: it fakes the baseline, and the record becomes untrustworthy.

## Anti-Patterns

| Anti-pattern | Why it fails |
| --- | --- |
| No baseline before editing | Nothing proves behavior held; a failure afterwards may have been there all along. |
| Fixing a bug "while I'm here" | The behavior change hides inside a refactor and skips review. Use `/webkit-fix`. |
| One huge rewrite diff | Regressions cannot be traced to a step. |
| Leaving callers on the old location | The refactor compiles in one place and breaks in another. |

## Follow-up Commands

- Review the result: `/webkit-code-review <ticket>`
- Status ❌ REGRESSION DETECTED: `/webkit-fix <ticket> --refactor`, or revert the step
- A bug noticed during the refactor: `/webkit-investigate <ticket> <issue>`
