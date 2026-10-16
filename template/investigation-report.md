# Webkit Investigation Report

<!--
TEMPLATE: investigation-report (used by /webkit-investigate)

Generic fill rules: .agents/rules/conditional/skill-protocol.md §3.
1. Every claim about the cause is backed by evidence: file:line, a log excerpt, a query result, a command's output,
   or the code path traced. A hypothesis that was not proven is labelled as one.
2. Separate the root cause from the symptom: the root cause explains every observed symptom, and fixing it
   prevents the issue from recurring.
-->

## Metadata

<!-- Investigation Type: Bug | Regression | Performance | Security | Data Integrity | Integration | Environment / Build.
     Severity (impact if left unfixed): CRITICAL | HIGH | MEDIUM | LOW — the same scale as code-review.md.
     Ticket: an F#### ticket with no ticket folder records "F#### (project)" (the report then lives in .agents/reports/);
     one with a matching T##### folder records both. -->

| Field | Value |
| --- | --- |
| Ticket | {{T#####}} ({{project}}) |
| Investigation Type | {{TYPE}} |
| Severity | {{SEVERITY}} — {{one-line reason}} |
| Affected Area | {{portal or domain}} · {{module}} · {{layer: frontend / API / Query-Handler / database / infrastructure}} |
| Branch Analyzed | {{branch and commit, or "working tree at <commit>"}} |
| Investigation Date | {{YYYY-MM-DD}} |
| Investigation Run | v{{N}} — {{what changed since the previous run, or "initial"}} |

---

## 1. Summary

### Root Cause Status

<!-- Choose one:
     ✅ ROOT CAUSE CONFIRMED — reproduced, or proven by the traced code path plus data / logs (confidence High).
     ⚠ PROBABLE ROOT CAUSE — strong evidence, not reproduced (confidence Medium).
     ❌ ROOT CAUSE NOT FOUND — list what was ruled out and what is needed next (confidence Low). -->

{{✅ ROOT CAUSE CONFIRMED | ⚠ PROBABLE ROOT CAUSE | ❌ ROOT CAUSE NOT FOUND}}

### Summary

{{One to three sentences: what is broken, why, and the recommended fix.}}

---

## 2. Issue Description

- **Reported Symptom:** {{what the user or log reported, in their words}}
- **Expected Behavior:** {{what should happen, and the source: spec section, business rule, or previous behavior}}
- **Actual Behavior:** {{what happens instead}}
- **Steps to Reproduce:**
  1. {{step}}
  2. {{step}}
- **Reproduced:** {{YES — how (environment, data, command) / NO — why not}}
- **Frequency and Reach:** {{always / intermittent / under which conditions; which users, roles, or portals}}
- **First Seen:** {{date, release, or commit that introduced it (`git log -S` / `git blame`), or "Unknown"}}

**Error / log excerpt:**

```text
{{exact error message, stack trace, or log lines — or "None"}}
```

---

## 3. Root Cause Analysis

### Investigation Trail

<!-- Every hypothesis considered, including the ones ruled out, so the next person does not re-check them. -->

| # | Hypothesis | Evidence | Result |
| --- | --- | --- | --- |
| H1 | {{hypothesis}} | {{file:line, query, log, or command output}} | {{Confirmed / Ruled out / Unverified}} |

### Root Cause

{{The single underlying defect, stated precisely: which code does what wrong, under which condition.}}

### Evidence

- [`{{path/to/file.php:42}}`]({{path/to/file.php}}#L{{42}}) — {{what this line does wrong}}

### Cause Chain

{{Trigger}} → {{intermediate effect}} → {{observed symptom}}

### Confidence

{{High / Medium / Low}} — {{why: reproduced, traced, or inferred}}

### Specification Check

<!-- One of: "N/A — no spec for this area" · "Code deviates from spec §n (<id>) — fix the code" ·
     "Specification clarification required: <what the spec gets wrong or leaves open>" (do not edit the spec). -->

{{specification check}}

---

## 4. Scope & Impact

### Affected Files

| File | Line(s) | Role in the issue |
| --- | --- | --- |
| `{{path/to/file}}` | {{lines}} | {{root cause / caller / symptom surface}} |

### Affected Data

- **Tables / models:** {{list, or "None"}}
- **Already-affected records:** {{count or estimate, or "None"}}
- **Read-only query to find them:**

```sql
{{SELECT ... — or "N/A — no persisted data affected"}}
```

### Affected Endpoints and Views

- {{`METHOD /api/...` · page or component — or "None"}}

### Dependencies

- {{callers, jobs, reports, or modules that a change at the root cause also affects — or "None"}}

---

## 5. Recommended Solution

### Approach

{{The minimal safe fix at the root cause, not at the symptom. Prefer extending existing code.}}

### Changes

| File | Change |
| --- | --- |
| `{{path/to/file}}` | {{what changes and what it becomes}} |

### Why This Approach

{{reason: fixes the root cause, matches existing patterns, reuses <existing class>, smallest safe change}}

### Alternatives Considered

| Option | Why not chosen |
| --- | --- |
| {{option}} | {{reason}} |

### Data Correction

{{Needed: the script or steps to correct already-affected records, to be run by a person after review — or "Not needed"}}

---

## 6. Risk Assessment

| Risk | Level | Mitigation |
| --- | --- | --- |
| Regression | {{Low / Medium / High}} | {{what could break and how it is checked}} |
| Data / migration | {{Low / Medium / High}} | {{migration or data change, and data-loss risk}} |
| Deployment | {{Low / Medium / High}} | {{order, config, queues, cache}} |
| Rollback | {{Low / Medium / High}} | {{how to revert}} |

---

## 7. Fix Plan

<!-- Dependency order. /webkit-fix ticks these ([ ] → [x]) as it applies them. -->

- [ ] {{step}} — `{{file}}`
- [ ] {{step}} — `{{file}}`

**Effort:** {{trivial (one line) / small (one file) / large (multi-file, migration, or contract change)}}

### Verification Checklist

- [ ] {{automated check the project actually has, e.g. `vendor/bin/phpunit --filter ...`, `npm run typecheck`}}
- [ ] {{the reproduction steps from §2 now produce the expected behavior}}
- [ ] {{regression check on a dependency from §4}}

---

## 8. Other Findings

<!-- Problems found along the way that are NOT this issue's root cause. Each becomes its own ticket;
     none is part of this fix. -->

- {{finding}} — `{{file:line}}` — separate ticket recommended

---

## 9. Resolution

<!-- Filled by /webkit-fix (or whoever applies the fix): what was changed, on which branch / commit, on what date,
     and the verification result. On creation: "Open — not fixed yet." -->

{{Open — not fixed yet.}}

<!-- Run history -->
