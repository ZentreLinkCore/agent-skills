# Webkit Refactor Record

<!--
TEMPLATE: refactor-report (used by /webkit-refactor)

Generic fill rules: .agents/rules/conditional/skill-protocol.md §3.
1. Regression Evidence lists only checks that were actually RUN, with their real result. A check that was not run
   is written as "Not run — <reason>", never as passing.
2. A refactor does not change behavior. Anything that did change is stated in §5, never hidden.
-->

## Metadata

<!-- Ticket: an F#### ticket with no ticket folder records "F#### (project)" (the report then lives in .agents/reports/);
     one with a matching T##### folder records both. -->

| Field | Value |
| --- | --- |
| Ticket | {{T#####}} ({{project}}) |
| Branch | {{branch}} |
| Refactor Goal | {{what was cleaned up and why, in one line}} |
| Source | {{user request / code-review Finding #n / other}} |
| Refactor Date | {{YYYY-MM-DD}} |
| Refactor Run | v{{N}} — {{what this pass changed, or "initial"}} |

---

## 1. Summary

### Refactor Status

<!-- Choose one:
     ✅ BEHAVIOR PRESERVED — every check passed before and after; API payloads identical.
     ⚠ PRESERVED WITH UNVERIFIED AREAS — every check run passed, but some area could not be checked (list it in §5).
     ❌ REGRESSION DETECTED — a check fails after the refactor and was not restored; fix with
        /webkit-fix <ticket> --refactor or revert the step. -->

{{✅ BEHAVIOR PRESERVED | ⚠ PRESERVED WITH UNVERIFIED AREAS | ❌ REGRESSION DETECTED}}

### Summary

{{One to three sentences: what was restructured, and what it improves.}}

---

## 2. Scope

- **In scope:** {{files, classes, components restructured}}
- **Out of scope:** {{what was deliberately left alone; details in §7}}

---

## 3. What Moved Where

<!-- One row per moved or extracted piece of logic. "Why" cites the project rule or pattern it now follows. -->

| Before | After | Why |
| --- | --- | --- |
| `{{path/to/File.php:120-180}}` {{inline logic}} | `{{app/Queries/<Domain>/<Name>.php}}` | {{rule, e.g. thin-controller rule in backend.md §1}} |

---

## 4. Duplication Removed

<!-- Each local copy replaced by a shared component, helper, or class, and the check that proved the shared one
     covers every behavior of the copy (props, states, edge cases). "None." when nothing was consolidated. -->

| Removed Copy | Replaced By | Coverage Check |
| --- | --- | --- |
| `{{path/to/local-copy}}` | `{{path/to/shared}}` | {{how equivalence was confirmed}} |

---

## 5. Regression Evidence

<!-- The project's own checks, run before the change (baseline) and after it. Only checks this project defines
     (including a frontend runner this run set up per testing.md); never claim a runner it does not have. -->

| Check | Command | Before | After |
| --- | --- | --- | --- |
| {{PHP syntax}} | `{{php -l <file>}}` | {{PASS / FAIL / Not run — reason}} | {{PASS / FAIL / Not run — reason}} |
| {{Backend tests}} | `{{vendor/bin/phpunit --filter ...}}` | {{result}} | {{result}} |
| {{Frontend typecheck / build}} | `{{npm run typecheck}}` | {{result}} | {{result}} |

- **API payloads:** {{"Identical" — endpoints compared and how / "N/A — no endpoint touched"}}
- **Behavior change:** {{"None" / exactly what changed, and why it was not restored}}
- **Unverified areas:** {{areas that could not be checked, and why — or "None"}}

---

## 6. Files Changed

- **Modified:** {{`path`, …, or "None"}}
- **Added:** {{`path`, …, or "None"}}
- **Deleted:** {{`path`, …, or "None"}}

---

## 7. Deliberately Not Done

<!-- Drift or cleanup noticed and left alone, each with its reason: out of scope · needs a spec decision ·
     would change behavior (→ /webkit-investigate or /webkit-fix) · separate ticket. -->

- {{item}} — {{reason}}

<!-- Run history -->
