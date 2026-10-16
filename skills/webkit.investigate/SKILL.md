---
name: webkit-investigate
description: |
  Finds and proves the root cause of a bug, regression, slowdown, security hole, bad data, failing integration or broken build (file:line evidence, measured impact, minimal fix plan) and writes `investigation.md` for /webkit-fix. Never changes code or data; database access is read-only. A new feature is /webkit-specify.
  Trigger: "/webkit-investigate", "investigate", "root cause", "why is this broken", "regression", "stack trace", "error log", "slow page", "N+1", "wrong data"
  Use when: something is broken or wrong and the cause must be found before anything changes.
---

# Webkit Investigate

Acts as a senior engineer investigating a problem. It finds **why** something is broken, proves it with evidence, measures the impact, and recommends the minimal safe fix, before any code is changed.

> [!IMPORTANT]
> **This skill MUST NOT modify application code, run migrations, or change data.** Database access is read-only. Its only output is `investigation.md` in the ticket folder.

Shared steps (gates, ticket resolution, templates, report persistence) follow [skill-protocol.md](../../rules/conditional/skill-protocol.md). **Authority:** finding and proving a root cause, and recommending the fix. Applying it → `/webkit-fix`; planning new behavior → `/webkit-specify`; cleanup with no defect behind it → `/webkit-refactor`; reviewing a diff → `/webkit-code-review`; spec conformance → `/webkit-verify`.

The report is a file on disk: `/webkit-fix` usually runs in a new session and can only act on what was saved.

## Inputs

| Form | Meaning |
| --- | --- |
| `/webkit-investigate <issue description>` | Investigate a new issue; reuses the ticket that already covers it, or allocates one. |
| `/webkit-investigate <target_path> <issue description>` | Same, starting from that file or module. |
| `/webkit-investigate T##### <issue description>` | Investigate within that ticket (e.g. a defect found while implementing its feature). |

Useful in the description: the error message or log lines, steps to reproduce, the affected user or record, and when it started.

## Context Loading Priority

1. **`task.md`**, when the issue sits in a ticket that has one (read `summary.md` first if it exists). A new bug ticket has neither.
2. **`context.md`** (if it exists): its `touched-files.md` is a starting point for the code path, and `dependency-map.md` (Chains, Callers That Must Keep Working) for Phase 4. Leads, not evidence.
3. **`spec.md` only for expected behavior**: the sections covering the symptom, in Phase 1 and for the Phase 3 Specification Check. No `plan.md`. On a re-run, the previous `investigation.md`'s Metadata, status, and Investigation Trail, so ruled-out hypotheses are not re-checked. A code-review finding passed as input: only that finding.
4. **Source, logs, data, and history** at the lines the evidence points to: Graphify first ([context-budget.md §2](../../rules/context-budget.md#2-find-code-graphify-first-then-targeted-search)), then the targeted search order in Phase 2.

Rules: per the [router](../../rules/rule-router.md), for the layers the cause chain crosses. The template at Phase 8. **Avoid:** reading whole modules or whole log files (search the error text and timestamp), unrelated tickets' reports, all project documentation or the whole blueprint, re-reading rules.

## Investigation Types

| Type | Examples |
| --- | --- |
| **Bug** | Wrong result, exception, broken UI behavior, unhandled edge case. |
| **Regression** | Something that used to work and stopped after a change. |
| **Performance** | Slow page or endpoint, N+1 queries, missing index, memory growth, timeouts. |
| **Security** | Authorization bypass, data exposure, injection, missing validation. |
| **Data Integrity** | Wrong, duplicated, missing, or inconsistent records; computed values that do not add up. |
| **Integration** | External service, API, queue, or scheduled job failing or returning unexpected data. |
| **Environment / Build** | Test, typecheck, or build failure; configuration, permission, or container problem. |

A request for a **new feature or enhancement** is not an investigation: say so and suggest `/webkit-specify`. A request to **review code quality** without a defect goes to `/webkit-code-review` or `/webkit-refactor`.

## Core Rules

- **Evidence over intuition.** Every statement about the cause cites a file and line, a log excerpt, a query result, or a command's output. An unproven idea is written as a hypothesis, never as the cause.
- **Root cause, not symptom.** The root cause explains every observed symptom, and fixing it prevents recurrence. "The value is null in the view" is a symptom; "the Query drops the `idacct` filter when `status = 0`" is a cause.
- **No scope expansion.** Investigate the reported issue only. Other problems found along the way are listed under Other Findings as separate tickets, never folded into this fix.
- **Read-only** (the callout above). Never run a destructive command; ask before running anything against a database you have not confirmed is disposable.
- **The spec is not rewritten.** If the issue is caused by the spec itself, report **Specification clarification required**.

**Mindset:** What exactly is the symptom, and can I reproduce it? What changed recently in this area? Which hypotheses explain *all* of the symptoms, and which evidence would rule each one out? Is this the root cause, or one more symptom of it? Who and what else is affected: other callers, already-saved data, other portals? What is the smallest safe change that removes the cause?

## Phase 0 — Gates (BLOCKING)

Run protocol §1: project, ticket, and a ticket argument's branch analyzed **without checkout** ([ticket-numbering.md §8.3](../../rules/conditional/ticket-numbering.md#83-read-only-skills-stop-at-step-4)). No branch gate (Phase 8: no branch is created). Tracing a bug through the other project's conventions sends `/webkit-fix` to the wrong file: the projects have opposite database conventions, so a "missing FK" is a finding in one and correct in the other.

**Ticket.** This skill starts bug work, so it may allocate ([ticket-numbering.md §2–§3](../../rules/conditional/ticket-numbering.md#2-allocating-a-number-the-increment)):

1. **The input names a `T#####` ticket, or you are on a `T#####` branch** → that ticket. A defect found while implementing a feature belongs to that feature's ticket.
2. **An existing ticket already covers this issue** → that ticket; its `investigation.md` is updated in place.
3. **An `F####` ticket** → its branch, analyzed without checkout. It normally has no ticket folder; Phase 8 says where the report goes.
4. **Nothing matches** → allocate the next number per §2. A bug ticket with no spec is normal. A request that is not an investigation (Investigation Types) is redirected instead and gets no ticket.

## Phase 1 — Understand the Issue

Establish and record:

1. **Reported symptom**: exact error message, log lines, screenshot description, or wrong value.
2. **Expected vs actual behavior**, with the source of "expected": a spec section, a business rule ([payroll.md](../../rules/conditional/payroll.md)), or how it behaved before.
3. **Steps to reproduce**, the affected user / role / record, frequency, and when it started.
4. **Investigation type** (table above) and **affected area**: portal or domain (per [project-gate.md](../../rules/core/project-gate.md); not every project has portals), module, and layer.
5. **Spec**: if the area has one (`spec.md`, or `specs.md` on older tickets), its relevant sections define expected behavior.

When the symptom itself cannot be identified (no error, no steps, no affected record), **ask once** for what is missing. Otherwise proceed and record any assumption in the report.

## Phase 2 — Reproduce and Gather Evidence

Reproduce before theorizing. Use the cheapest reliable evidence first:

| Evidence | How |
| --- | --- |
| Logs | `storage/logs/laravel.log` (search the error text and timestamp), browser console and network tab described by the user |
| Code path | `graphify path "<route or page>" "<model>"` first, then confirm in source: the route (`php artisan route:list --path=api/...`) → controller → Query / Handler / Action → model, and the page → state → api layer |
| Data | Read-only queries (`SELECT` only), `php artisan tinker --execute="..."` for read-only inspection |
| History | `git log --oneline -- <file>`, `git log -S '<code>'`, `git blame -L <a>,<b> <file>` to find when and why the behavior changed |
| Tests and builds | `vendor/bin/phpunit --filter ...`, `npm run typecheck`, `node .agents/scripts/check-changed.mjs <files>`: only the checks the project actually defines (not every project has a JS test runner). The full `npm run build` only when the build itself is what is broken ([testing.md](../../rules/conditional/testing.md#frontend-build-check-changed-files-only)) |

**Search:** Graphify first (`explain "<ExactName>" --all` on the classes and methods the symptom names; `query --seed` only to find a label; [context-budget.md §2](../../rules/context-budget.md#2-find-code-graphify-first-then-targeted-search)), then targeted search in this order: the affected module → a sibling module with the same pattern → shared helpers, layouts, and traits → the wider project, only when the issue is global. Use repo-relative paths. The graph is a map, not evidence: every Evidence line cites the source file.

## Phase 3 — Root Cause Analysis

1. **List hypotheses** that could explain the symptom.
2. **Test each one** against evidence, and record the result: Confirmed, Ruled out, or Unverified. Keep the ruled-out ones in the report so nobody re-checks them.
3. **State the root cause** precisely: which code does what wrong, under which condition.
4. **Write the cause chain**: trigger → intermediate effect → observed symptom. `graphify path` between the trigger and the symptom surface finds candidate links; each link's evidence is the source. If a link has no evidence, the cause is not yet confirmed.
5. **Set the status and confidence**:

| Root Cause Status | Confidence | When |
| --- | --- | --- |
| **✅ ROOT CAUSE CONFIRMED** | High | Reproduced, or proven by the traced code path plus data or logs. |
| **⚠ PROBABLE ROOT CAUSE** | Medium | Strong evidence, not reproduced. Say what would confirm it. |
| **❌ ROOT CAUSE NOT FOUND** | Low | List what was ruled out and exactly what is needed next (logs, access, a reproducing record). Do not guess a fix. |

Finally, **check against the spec** when one exists: code deviating from the spec → fix the code; the spec itself wrong or silent → **Specification clarification required**.

## Phase 4 — Scope & Impact

- **Affected files**: every file in the cause chain, with line numbers and its role (root cause, caller, symptom surface).
- **Affected data**: tables and models, whether records are already wrong, and a **read-only** query that finds them.
- **Affected endpoints and views**, and the **users, roles, or portals** that hit them.
- **Dependencies**: callers, jobs, reports, and modules that a change at the root cause would also affect. `graphify explain "<ExactName>" --all` on the root-cause method lists its callers, `graphify affected` widens that, and `graphify path "<A>" "<B>"` traces a call chain; confirm each in the file before citing it as evidence, and grep its blind spots ([context-budget.md §2](../../rules/context-budget.md#2-find-code-graphify-first-then-targeted-search), [system-awareness.md](../../rules/conditional/system-awareness.md)).

**Severity** (impact if left unfixed; the same scale as code-review):

| Severity | Applies to |
| --- | --- |
| **CRITICAL** | Data loss or corruption, wrong money, security breach, cross-tenant exposure, system down. |
| **HIGH** | A core flow broken for many users, wrong business result, severe slowdown. |
| **MEDIUM** | A contained bug with a workaround, or a secondary flow broken. |
| **LOW** | Cosmetic, or a rare edge case with negligible impact. |

## Phase 5 — Recommended Solution

- **Fix the root cause, not the symptom**, with the **minimal safe change**. Prefer extending existing code: search (Graphify first) for the helper, Query, Handler, or component that already does this before proposing anything new ([system-awareness.md §4](../../rules/conditional/system-awareness.md#4-no-duplicate-logic)).
- Follow the project's existing patterns (the router's rules for the layer the fix touches); never propose an architecture change unless the existing pattern is itself the cause.
- List the exact changes per file, and why this approach.
- Record the alternatives considered and why each was not chosen, briefly. One recommendation, not an option menu.
- If data is already wrong, describe the **data correction** (script or steps) for a person to review and run. Never run it.

## Phase 6 — Risk Assessment

For the recommended fix: regression risk, data / migration risk, deployment concerns (order, config, queues, cache), and rollback. Rate each Low / Medium / High with its mitigation.

## Phase 7 — Fix Plan

A dependency-ordered checklist (`- [ ]`) of the changes, each naming its file, plus an effort estimate and a verification checklist: the automated checks the project actually has, the reproduction steps from Phase 1 now producing the expected behavior, and a regression check on each dependency. `/webkit-fix` ticks this plan as it applies it.

## Phase 8 — Write the Report

Fill [investigation-report.md](../../template/investigation-report.md) per protocol §3, and persist it per protocol §4 as **`investigation.md`** (`<kind>` = `investigation` in `.agents/reports/` names). Skill-specific:

- **Where:** the Phase 0 ticket's folder. An `F####` ticket with no ticket folder → `.agents/reports/<scope>-investigation-<YYYYMMDD>.md`, with the branch named in the Metadata ([ticket-numbering.md §8.4](../../rules/conditional/ticket-numbering.md#84-where-the-report-goes)).
- **One issue per ticket.** A second, unrelated defect is listed under Other Findings and gets its own ticket, never a second report in this folder.
- **Re-run** updates the file in place (protocol §4): the run row is **Investigation Run**, its date **Investigation Date**.
- **§9 Resolution** starts as "Open — not fixed yet."; `/webkit-fix` fills it.
- **Create no branch** ([ticket-numbering.md §6](../../rules/conditional/ticket-numbering.md#6-the-branch-is-the-ticket)). This skill writes no application code; the `T#####` branch appears when `/webkit-fix` picks the ticket up.
- End per protocol §7, stating the ticket number so the user can hand that one token to the next skill.

## Anti-Patterns

| Anti-pattern | Why it fails |
| --- | --- |
| Naming a cause without evidence | `/webkit-fix` then fixes a guess, and the bug stays. |
| Fixing the symptom (a null check in the view) | The cause keeps producing bad data elsewhere. |
| Editing code or running a data fix "to check" | The investigation becomes a change nobody reviewed. |

## Follow-up Commands

Always include the saved report path:

- Apply the fix (the usual next step): `/webkit-fix <ticket> --investigation`. It branches on `<ticket>` and fills §9 Resolution.
- Cleanup with no behavior change left after the fix (duplication, drift): `/webkit-refactor <ticket> <goal>`
- The issue needs new behavior rather than a fix: `/webkit-specify <ticket> <description>`, then `/webkit-implement <ticket>`
- Root cause not found: rerun `/webkit-investigate <ticket>` once the missing logs, access, or reproducing record are available.
