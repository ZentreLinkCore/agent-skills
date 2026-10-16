# Webkit Design Review Report

<!--
TEMPLATE: design-review-report (used by /webkit-design-review)

Generic fill rules: .agents/rules/conditional/skill-protocol.md §3.
1. Every finding names what the user actually sees and the authority it breaks (ui-design.md §n, theme token
   with file:line, WCAG AA, or "inferred from N sibling files"). No taste, no "feels dated".
2. Finding numbers are unique across CRITICAL, HIGH, MEDIUM, and LOW (#1, #2, … continuing from one severity into
   the next), so "Finding #3" always names one issue.
3. Fit findings and Modern Enhancement Ideas never mix. Ideas are optional and never change the verdict.
4. Every CRITICAL, HIGH, MEDIUM, and LOW finding ends with "- **Resolution:** Open". /webkit-fix replaces that line
   when it handles the finding (✅ FIXED / ✅ FIXED (traced) / ✅ ALREADY RESOLVED / ❌ NOT FIXED, with evidence)
   and recomputes the verdict, the Final Recommendation and the Review Run row as a fix pass (vN.k). See
   ticket-numbering.md §5 "Fix pass".
-->

## Metadata

<!-- Ticket: "None — <reason>" for a change with no ticket (the report then lives in .agents/reports/). -->

| Field | Value |
| --- | --- |
| Ticket | {{T#####}} ({{project}}) |
| Branch | {{branch}} (base `{{base}}`) |
| Project | {{project}} — resolved via {{evidence, e.g. "vue + pinia in package.json"}} |
| Portal | {{portal, or "N/A — project has no portals"}} |
| Scope | {{path or diff}} — {{n}} files |
| Design Sources Read | {{`.agents/rules/conditional/ui-design.md`, `resources/css/theme.css:<lines>`, …}} |
| Reviewer Role | Senior Designer Review |
| Review Date | {{YYYY-MM-DD}} |
| Review Run | v{{N}} — {{what changed since the previous run, or "initial"}} |

---

## Summary

### Overall Design Fit

<!-- Choose one, derived from Findings:
     any CRITICAL or HIGH → CHANGES REQUIRED · only MEDIUM / LOW → APPROVED WITH COMMENTS · none (INFO only) → APPROVED.
     Modern Enhancement Ideas never change this.
     After a /webkit-fix pass, count only the findings still open, and end the verdict "(after fix pass vN.k)". -->

{{APPROVED | APPROVED WITH COMMENTS | CHANGES REQUIRED}}

### Summary

{{One to three sentences: does this belong in this product, and what is the single worst visual problem.}}

---

## Fit Review

<!-- Within each severity, list in fix order (dependency-first; findings in one file that should be one edit
     are listed next to each other). -->

### CRITICAL

<!-- Content unreadable or invisible in a supported mode; an interactive control that cannot be seen or reached. -->

#### Finding #1

- **Finding:** {{dimension — one-line title, e.g. "Contrast — badge label invisible in dark mode"}}
- **File:** [`{{path/to/Component.vue}}`]({{path/to/Component.vue}}#L{{42}})
- **Line:** {{42}}
- **Issue:** {{what is wrong}}
- **What the User Sees:** {{the visible symptom, in which mode / at which breakpoint / in which portal}}
- **Authority:** {{ui-design.md §n · theme.css:NN · WCAG AA · inferred from N siblings}}
- **Recommended Fix:** `{{exact before}}` → `{{exact after}}`
- **Resolution:** Open

### HIGH

<!-- WCAG AA text-contrast failure; missing dark-mode variant on a color-bearing element; the wrong portal's accent;
     a mandated pattern (drag-to-scroll, statutory-ID format) absent. -->

#### Finding #2

- **Finding:** {{dimension — one-line title}}
- **File:** [`{{path/to/Component.vue}}`]({{path/to/Component.vue}}#L{{42}})
- **Line:** {{42}}
- **Issue:** {{what is wrong}}
- **What the User Sees:** {{the visible symptom}}
- **Authority:** {{authority}}
- **Recommended Fix:** `{{exact before}}` → `{{exact after}}`
- **Resolution:** Open

### MEDIUM

<!-- Hardcoded value where a token exists; a duplicated component; an off-scale spacing value; a broken breakpoint. -->

#### Finding #3

- **Finding:** {{dimension — one-line title}}
- **File:** [`{{path/to/Component.vue}}`]({{path/to/Component.vue}}#L{{42}})
- **Line:** {{42}}
- **Issue:** {{what is wrong, citing the token or rule}}
- **What the User Sees:** {{the visible symptom}}
- **Authority:** {{authority}}
- **Recommendation:** `{{exact before}}` → `{{exact after}}`
- **Resolution:** Open

### LOW

<!-- Naming, class ordering, a missing micro-transition, a stale comment in a token file. -->

#### Finding #4

- **Finding:** {{dimension — one-line title}}
- **File:** [`{{path/to/Component.vue}}`]({{path/to/Component.vue}}#L{{42}})
- **Line:** {{42}}
- **What the User Sees:** {{the visible symptom}}
- **Authority:** {{authority}}
- **Suggestion:** {{the change}}
- **Resolution:** Open

### INFO

<!-- Observations only; no action required from this change. Also the place for:
     "Pre-existing: …" (styling next to the change that the change did not cause, e.g. known framework mixing),
     "Not reviewed: …" (files or states skipped, contrast computed rather than measured), and
     "Specification clarification required: …". -->

- **Observation:** {{observation}}

---

## What's Already Working

<!-- Specific reuse of the design system done right, with file:line. Short and specific; never generic praise. -->

- {{e.g. "`LeaveTable.vue:18` uses `.badge-employee`, which already resolves to the accessible -strong shade."}}

---

## Design-System Drift

<!-- Conflicts BETWEEN sources of truth (ui-design.md vs theme tokens vs component classes). Not the reviewed file's
     fault and never graded against it. Name both locations and which one should change. "None." if none. -->

- {{source A at file:line}} vs {{source B at file:line}} — {{which should change and why}}

---

## Modern Enhancement Ideas

<!-- OPTIONAL. Not fixes, not part of the verdict, never applied by /webkit-fix. Every idea: grounded (date + search
     queries, or "no web search available"), additive (new tokens beside old ones), expressible in the project's
     existing styling system, never contradicting ui-design.md, with a code sketch and a migration cost.
     "None." when nothing is worth proposing. -->

- **Grounded on:** {{YYYY-MM-DD via <queries>, or "no web search available — lower confidence"}}
- **Design concept read as:** {{what this UI is trying to communicate}}

### Idea #1 — {{title}}

- **Why:** {{how it serves the design concept}}
- **Sketch:** `{{@theme addition or class string}}`
- **Migration Cost:** {{n files · additive · incremental or not}}

---

## Final Recommendation

<!-- Keep exactly one option. READY TO MERGE when Overall Design Fit is APPROVED or APPROVED WITH COMMENTS;
     FIX REQUIRED when it is CHANGES REQUIRED. -->

### READY TO MERGE

**Conditions:** No CRITICAL or HIGH findings.

### FIX REQUIRED

**Fix before merge:**

1. {{Finding #n — one-line action}}
2. {{Finding #n — one-line action}}

<!-- Run history -->
