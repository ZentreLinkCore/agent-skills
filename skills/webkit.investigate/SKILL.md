---
name: webkit-investigate
description: |
  Finds and proves the root cause of a bug, regression, slowdown, security hole, bad data, failing integration or broken build (file:line evidence, measured impact, minimal fix plan) and writes `investigation.md` for /webkit-fix. Never changes code or data; database access is read-only. A new feature is /webkit-specify.
  Trigger: "/webkit-investigate", "investigate", "root cause", "why is this broken", "regression", "stack trace", "error log", "slow page", "N+1", "wrong data"
  Use when: something is broken or wrong and the cause must be found before anything changes.
---

# Webkit Investigate

Acts as a senior engineer investigating a problem. It finds **why** something is broken, proves it with evidence, measures the impact, and recommends the minimal safe fix, before any code is changed.

This skill only investigates. It is **not** responsible for:

- fixing the problem (that is `/webkit-fix`),
- planning or specifying new features (`/webkit-specify`),
- reviewing a diff (`/webkit-code-review`) or checking spec conformance (`/webkit-verify`),
- general cleanup with no defect behind it (`/webkit-refactor`).

> [!IMPORTANT]
> **This skill MUST NOT modify application code, run migrations, or change data.** Database access is read-only. Its only output is `investigation.md` in the ticket folder.

---

## Authority Boundary

This skill owns **only** finding and proving a root cause, and recommending the fix ([authority-boundary.md](../../rules/authority-boundary.md)). It does not perform another skill's responsibility. Tasks that belong to another workflow stage:

- applying the fix → `/webkit-fix`
- planning new behavior → `/webkit-specify`
- cleanup with no defect behind it → `/webkit-refactor`
- reviewing a diff → `/webkit-code-review`

If a task belongs to another stage: **stop, report it, and do not continue** that task. Report it as `Authority boundary: <the task> belongs to /webkit-<skill>. Not done here.` Do not compensate for another skill, and do not generate work outside this authority.

---

## Inputs

| Form | Meaning |
| --- | --- |
| `/webkit-investigate <issue description>` | Investigate a new issue; reuses the ticket that already covers it, or allocates one. |
| `/webkit-investigate <target_path> <issue description>` | Same, starting from that file or module. |
| `/webkit-investigate T##### <issue description>` | Investigate within that ticket (e.g. a defect found while implementing its feature). |

Useful in the description: the error message or log lines, steps to reproduce, the affected user or record, and when it started.

---

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

---

## Workflow Integration

```text
          /webkit-investigate <issue>
                     │
                     ▼
   investigation.md  (.agents/specs/<project>/T#####/investigation.md)
                     │
          ┌──────────┴──────────────────┐
          ▼                             ▼
     webkit-fix                 webkit-specify → webkit-implement
     (the usual next step,      (only when the issue turns out
      structural causes too)     to need new behavior)
```

The report is a file on disk; `/webkit-fix` usually runs in a new session and can only act on what was saved.

---

## Core Rules

- **Evidence over intuition.** Every statement about the cause cites a file and line, a log excerpt, a query result, or a command's output. An unproven idea is written as a hypothesis, never as the cause.
- **Root cause, not symptom.** The root cause explains every observed symptom, and fixing it prevents recurrence. "The value is null in the view" is a symptom; "the Query drops the `idacct` filter when `status = 0`" is a cause.
- **No scope expansion.** Investigate the reported issue only. Other problems found along the way are listed under Other Findings as separate tickets, never folded into this fix.
- **Read-only.** No code edits, no migrations, no writes to any database. Never run a destructive command; ask before running anything against a database you have not confirmed is disposable.
- **The spec is not rewritten.** If the issue is caused by the spec itself, report **Specification clarification required**.

## Investigation Mindset

Ask:

- What exactly is the symptom, and can I reproduce it?
- What changed recently in this area?
- Which hypotheses explain *all* of the symptoms, and which evidence would rule each one out?
- Is this the root cause, or one more symptom of it?
- Who and what else is affected: other callers, already-saved data, other portals?
- What is the smallest safe change that removes the cause?

---

## Phase 0 — Project Gate (BLOCKING)

Run [Which Project Am I In?](../../rules/project-profile.md), **state the resolved project in your first message**, and read only that project's sections. An investigation that traces a React bug through Vue conventions, or blames the other project's schema rules, sends `/webkit-fix` to the wrong file. The projects have opposite database conventions (foreign keys, relationship-column naming, soft deletes), so a "missing FK" is a finding in one and correct in the other.

---

## Phase 1 — Understand the Issue

Establish and record:

1. **Reported symptom**: exact error message, log lines, screenshot description, or wrong value.
2. **Expected vs actual behavior**, with the source of "expected": a spec section, a business rule ([hrms-rules.md](../../rules/hrms-rules.md)), or how it behaved before.
3. **Steps to reproduce**, the affected user / role / record, frequency, and when it started.
4. **Investigation type** (table above) and **affected area**: portal or domain (per the profile; not every project has portals), module, and layer.
5. **Ticket and spec**: if the area has a spec (`.agents/specs/<project>/T#####/spec.md`, or `specs.md` on older tickets), read the relevant sections; it defines expected behavior.

When the symptom itself cannot be identified (no error, no steps, no affected record), **ask once** for what is missing. Otherwise proceed and record any assumption in the report.

---

## Phase 2 — Reproduce and Gather Evidence

Reproduce before theorizing. Use the cheapest reliable evidence first:

| Evidence | How |
| --- | --- |
| Logs | `storage/logs/laravel.log` (search the error text and timestamp), browser console and network tab described by the user |
| Code path | Trace from the route (`php artisan route:list --path=api/...`) → controller → Query / Handler / Action → model, and from the page → state → api layer |
| Data | Read-only queries (`SELECT` only), `php artisan tinker --execute="..."` for read-only inspection |
| History | `git log --oneline -- <file>`, `git log -S '<code>'`, `git blame -L <a>,<b> <file>` to find when and why the behavior changed |
| Tests and builds | `vendor/bin/phpunit --filter ...`, `npm run typecheck`, `node .agents/scripts/check-changed.mjs <files>`: only the checks the project actually defines (not every project has a JS test runner). The full `npm run build` only when the build itself is what is broken ([testing.md](../../rules/testing.md#frontend-build-check-changed-files-only)) |

Search scope, in order: the affected module → a sibling module with the same pattern → shared helpers, layouts, and traits → the wider project, only when the issue is global ([context-loading.md](../../rules/context-loading.md)). Use repo-relative paths; `app/Domain/` is retired and exists in neither project.

---

## Phase 3 — Root Cause Analysis

1. **List hypotheses** that could explain the symptom.
2. **Test each one** against evidence, and record the result: Confirmed, Ruled out, or Unverified. Keep the ruled-out ones in the report so nobody re-checks them.
3. **State the root cause** precisely: which code does what wrong, under which condition.
4. **Write the cause chain**: trigger → intermediate effect → observed symptom. If a link has no evidence, the cause is not yet confirmed.
5. **Set the status and confidence**:

| Root Cause Status | Confidence | When |
| --- | --- | --- |
| **✅ ROOT CAUSE CONFIRMED** | High | Reproduced, or proven by the traced code path plus data or logs. |
| **⚠ PROBABLE ROOT CAUSE** | Medium | Strong evidence, not reproduced. Say what would confirm it. |
| **❌ ROOT CAUSE NOT FOUND** | Low | List what was ruled out and exactly what is needed next (logs, access, a reproducing record). Do not guess a fix. |

Finally, **check against the spec** when one exists: code deviating from the spec → fix the code; the spec itself wrong or silent → **Specification clarification required**.

---

## Phase 4 — Scope & Impact

- **Affected files**: every file in the cause chain, with line numbers and its role (root cause, caller, symptom surface).
- **Affected data**: tables and models, whether records are already wrong, and a **read-only** query that finds them.
- **Affected endpoints and views**, and the **users, roles, or portals** that hit them.
- **Dependencies**: callers, jobs, reports, and modules that a change at the root cause would also affect ([system-awareness.md](../../rules/system-awareness.md)). When `graphify-out/graph.json` exists, `graphify explain "<ExactName>" --all` on the root-cause method lists its callers and `graphify path "<A>" "<B>"` traces a call chain; confirm each in the file before citing it as evidence, and grep its blind spots (root `AGENTS.md`, **Code graph**).

**Severity** (impact if left unfixed; the same scale as code-review):

| Severity | Applies to |
| --- | --- |
| **CRITICAL** | Data loss or corruption, wrong money, security breach, cross-tenant exposure, system down. |
| **HIGH** | A core flow broken for many users, wrong business result, severe slowdown. |
| **MEDIUM** | A contained bug with a workaround, or a secondary flow broken. |
| **LOW** | Cosmetic, or a rare edge case with negligible impact. |

---

## Phase 5 — Recommended Solution

- **Fix the root cause, not the symptom**, with the **minimal safe change**. Prefer extending existing code: search for the helper, Query, Handler, or component that already does this before proposing anything new ([duplicate-prevention.md](../../rules/duplicate-prevention.md)).
- Follow the project's patterns ([project-profile.md](../../rules/project-profile.md)); never propose an architecture change unless the existing pattern is itself the cause.
- List the exact changes per file, and why this approach.
- Record the alternatives considered and why each was not chosen, briefly. One recommendation, not an option menu.
- If data is already wrong, describe the **data correction** (script or steps) for a person to review and run. Never run it.

---

## Phase 6 — Risk Assessment

For the recommended fix: regression risk, data / migration risk, deployment concerns (order, config, queues, cache), and rollback. Rate each Low / Medium / High with its mitigation.

---

## Phase 7 — Fix Plan

A dependency-ordered checklist (`- [ ]`) of the changes, each naming its file, plus an effort estimate and a verification checklist: the automated checks the project actually has, the reproduction steps from Phase 1 now producing the expected behavior, and a regression check on each dependency. `/webkit-fix` ticks this plan as it applies it.

---

## Phase 8 — Write the Report

Fill the template [.agents/template/investigation-report.md](../../template/investigation-report.md). Follow its exact structure: no custom format, no added, removed, renamed, or reordered sections. Follow the fill rules in its header comment, then delete every guide comment except the `<!-- Run history -->` marker. §9 Resolution starts as "Open — not fixed yet."; `/webkit-fix` fills it.

### Persist the report (MANDATORY)

**Step 1 — Resolve the project folder.** Restate the Phase 0 answer as the project's lower-case folder name under `.agents/specs/`. Ticket numbers are per project.

**Step 2 — Reuse or allocate the ticket.** This skill starts bug work, so it may allocate ([ticket-numbering.md](../../rules/ticket-numbering.md) §2):

1. **The input names a `T#####` ticket, or you are on a `T#####` branch** → write there. A defect found while implementing a feature belongs to that feature's ticket.
2. **An existing ticket already covers this issue** → update its `investigation.md` in place:

   ```bash
   grep -ril '<issue|module|route|table>' ".agents/specs/$project" --include='*.md' 2>/dev/null
   ```

3. **An `F####` ticket** (the remote's branch convention) → analyze its branch without checking it out ([ticket-numbering.md §8](../../rules/ticket-numbering.md#8-resolving-a-ticket-argument-to-its-branch), Steps 1–4). It normally has no ticket folder, so write to `.agents/reports/<scope>-investigation-<YYYYMMDD>.md` and name the branch in the Metadata.
4. **Nothing matches** → allocate the next number in that project. Scan the disk; never guess:

   ```bash
   project="<project>"   # the folder name resolved in Step 1

   max=$(find ".agents/specs/$project" -maxdepth 1 -type d -name 'T[0-9][0-9][0-9][0-9][0-9]' 2>/dev/null \
         | sed 's#.*/T##' | sort -n | tail -1)
   next=$(printf 'T%05d' $(( ${max:-0} + 1 )))
   mkdir -p ".agents/specs/$project/$next"   # claim it before writing anything
   echo "$project/$next"
   ```

   Always `max + 1`, never the first free gap. A bug ticket with no spec is normal.

**Step 3 — Write the file.**

- Write to `.agents/specs/<project>/<ticket>/investigation.md`: exactly that filename.
- One issue per ticket. A second, unrelated defect is listed under Other Findings and gets its own ticket, never a second report in this folder.
- Re-investigating **updates the file in place**. Before overwriting, append the previous run's **Investigation Run** value with its date and status (e.g. `- v1 — 2026-10-08 — initial — ⚠ PROBABLE ROOT CAUSE`) to the list under `<!-- Run history -->`. Then increment the Metadata **Investigation Run** row, set **Investigation Date** to today, and write one line on what changed.
- **Create no branch.** This skill writes no application code; the `T#####` branch appears when `/webkit-fix` picks the ticket up.
- State the ticket number in your closing message, so the user can hand that one token to the next skill.

---

## Anti-Patterns

| Anti-pattern | Why it fails |
| --- | --- |
| Naming a cause without evidence | `/webkit-fix` then fixes a guess, and the bug stays. |
| Fixing the symptom (a null check in the view) | The cause keeps producing bad data elsewhere. |
| Dropping ruled-out hypotheses from the report | The next person re-investigates them from scratch. |
| Guessing a fix when the root cause is not found | Report ❌ ROOT CAUSE NOT FOUND and what is needed next. |
| Bundling unrelated problems into one fix | One issue per ticket; list the rest under Other Findings. |
| Planning a feature inside an investigation | That is `/webkit-specify`'s job. |
| Editing code or running a data fix "to check" | The investigation becomes a change nobody reviewed. |
| Citing the other project's conventions | A correct pattern in one project is a defect in the other. |

---

## Follow-up Commands

Always include the saved report path:

- Apply the fix (the usual next step): `/webkit-fix <ticket> --investigation`. It branches on `<ticket>` and fills §9 Resolution.
- Cleanup with no behavior change left after the fix (duplication, drift): `/webkit-refactor <ticket> <goal>`
- The issue needs new behavior rather than a fix: `/webkit-specify <ticket> <description>`, then `/webkit-implement <ticket>`
- Root cause not found: rerun `/webkit-investigate <ticket>` once the missing logs, access, or reproducing record are available.
