# Webkit Code Review Report

<!--
TEMPLATE: code-review-report (used by /webkit-code-review)

Generic fill rules: .agents/rules/conditional/skill-protocol.md §3. What to report and how to grade it: the skill's
Phases 2–4. A severity with no findings keeps its heading and says "None."
1. Finding numbers are unique across CRITICAL, HIGH, MEDIUM, and LOW (#1, #2, … continuing from one severity
   into the next), so "Finding #3" always names one issue.
2. Every CRITICAL, HIGH, MEDIUM, and LOW finding ends with "- **Resolution:** Open". /webkit-fix replaces that line
   when it handles the finding (✅ FIXED / ✅ FIXED (traced) / ✅ ALREADY RESOLVED / ❌ NOT FIXED, with evidence)
   and recomputes the verdict, the Final Recommendation and the Review Run row as a fix pass (vN.k). See
   ticket-numbering.md §5 "Fix pass".
-->

## Metadata

<!-- Ticket: "None — <reason>" for a change with no ticket (the report then lives in .agents/reports/). -->

| Field | Value |
| --- | --- |
| Ticket | {{T#####}} ({{project}}) |
| Branch | {{branch}} (base `{{base}}`, {{n}} files changed, +{{added}}/-{{removed}} lines) |
| Reviewer Role | Senior Developer Review |
| Review Date | {{YYYY-MM-DD}} |
| Review Run | v{{N}} — {{what changed since the previous run, or "initial"}} |

---

## Summary

### Overall Code Quality

<!-- Choose one, derived from Findings:
     any CRITICAL or HIGH → CHANGES REQUIRED · only MEDIUM / LOW → APPROVED WITH COMMENTS · none (INFO only) → APPROVED.
     After a /webkit-fix pass, count only the findings still open, and end the verdict "(after fix pass vN.k)". -->

{{APPROVED | APPROVED WITH COMMENTS | CHANGES REQUIRED}}

### Summary

{{One to three sentences: is this change mergeable, and what is the single most consequential problem.}}

---

## Changed Areas

<!-- What changed and why, per area. API routes and request/response changes go under Backend; configuration,
     environment, and tests under Other. "None" when an area is untouched. -->

- **Frontend:** {{pages / components / stores changed, or "None"}}
- **Backend:** {{controllers / classes / routes / API changes, or "None"}}
- **Database:** {{migrations / tables / columns / indexes, or "None"}}
- **Other:** {{configuration, environment, tests, scripts, or "None"}}

---

## Findings

<!-- Within each severity, list in fix order (dependency-first). -->

### CRITICAL

<!-- Must fix before merge: security vulnerability, data corruption, application crash, cross-tenant leak,
     wrong money. -->

#### Finding #1

- **Finding:** {{area — one-line title, e.g. "Security — member query not scoped to the organization"}}
- **File:** [`{{path/to/file.php}}`]({{path/to/file.php}}#L{{42}})
- **Line:** {{42}}
- **Issue:** {{what is wrong, and the failure: inputs or state → wrong outcome}}
- **Why It Matters:** {{the consequence if it ships}}
- **Recommended Fix:** {{the concrete change: construct, and what it becomes}}
- **Resolution:** Open

### HIGH

<!-- Should fix before merge: major bug, incorrect business logic, performance issue with measurable impact. -->

#### Finding #2

- **Finding:** {{area — one-line title}}
- **File:** [`{{path/to/file.php}}`]({{path/to/file.php}}#L{{42}})
- **Line:** {{42}}
- **Issue:** {{what is wrong, and the failure: inputs or state → wrong outcome}}
- **Why It Matters:** {{the consequence if it ships}}
- **Recommended Fix:** {{the concrete change}}
- **Resolution:** Open

### MEDIUM

<!-- Recommended improvement: maintainability issue, code duplication, error handling improvement. -->

#### Finding #3

- **Finding:** {{area — one-line title}}
- **File:** [`{{path/to/file.php}}`]({{path/to/file.php}}#L{{42}})
- **Line:** {{42}}
- **Issue:** {{what is wrong, citing the project rule or pattern it breaks}}
- **Recommendation:** {{the change}}
- **Resolution:** Open

### LOW

<!-- Minor suggestion backed by a project rule: naming, formatting, small cleanup. -->

#### Finding #4

- **Finding:** {{area — one-line title}}
- **File:** [`{{path/to/file.php}}`]({{path/to/file.php}}#L{{42}})
- **Line:** {{42}}
- **Suggestion:** {{the change}}
- **Resolution:** Open

### INFO

<!-- Observations only; no action required from this change. Also the place for:
     "Pre-existing: …" (a problem next to the diff that the diff did not cause),
     "Not reviewed: …" (files skipped and why), and
     "Specification clarification required: …" (a requirement question; the spec is not modified). -->

- **Observation:** {{observation}}

---

## Positive Feedback

<!-- Good implementation decisions worth keeping, specific to this change. -->

- {{e.g. "Validation is centralized in StoreLeaveRequest instead of repeated in the controller."}}

---

## Final Recommendation

<!-- Keep exactly one option. READY TO MERGE when Overall Code Quality is APPROVED or APPROVED WITH COMMENTS;
     FIX REQUIRED when it is CHANGES REQUIRED. -->

### READY TO MERGE

**Conditions:** No CRITICAL or HIGH findings.

### FIX REQUIRED

**Fix before merge:**

1. {{Finding #n — one-line action}}
2. {{Finding #n — one-line action}}

<!-- Run history -->
