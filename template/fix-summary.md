# Webkit Fix Summary

<!--
TEMPLATE: fix-summary (used by /webkit-fix)

Printed in chat at the end of /webkit-fix; it is not saved as a file.
Generic fill rules: .agents/rules/conditional/skill-protocol.md §3. Template-specific:
1. Only the approved fixes from the source report. No speculative improvements, no suggested additional work.
2. Documents Updated lists what Phase 8 (Close the Loop) actually wrote. "No change — <reason>" for a document it
   left alone; "N/A — <reason>" for one the ticket does not have.
-->

## Metadata

| Field | Value |
| --- | --- |
| Project | {{project}} |
| Ticket | {{T#####, F####, or "None"}} |
| Branch | {{branch}} |
| Fix Source | {{code-review / verify / investigation / refactor / design-review}} — `{{report path}}` (run v{{N}}) |

---

## Applied Fixes

<!-- One entry per implemented fix, in the order applied. The reference is the report's own id
     (Finding #n, Fix Plan step n, or the failed regression check). -->

1. **{{Finding reference}}**
   - **Files Modified:** `{{path}}`, `{{path}}`
   - **Summary:** {{what was changed}}
   - **Regression Test:** `{{test path}}` — {{fails on the old code, passes on the fix; or "written, not run — <reason>"; or "None — <reason>" for a change with no behavior}}

---

## Reused Code

- **Services:** {{Queries / Handlers / Actions reused or extended, or "None"}}
- **Components:** {{list, or "None"}}
- **Helpers:** {{list, or "None"}}
- **Utilities:** {{list, or "None"}}
- **Validation:** {{list, or "None"}}

---

## Modified Files

- `{{path}}`

---

## Version

<!-- From Phase 7 (.agents/rules/conditional/versioning.md §7). One row per target; "Versioning: off" when the mode is off.
     Shipped: "Yes" (defect in the base → PATCH), "No — unreleased work on this branch" (no bump of its own),
     or "—" for a target the fix did not touch. -->

| Target | Defect Shipped | Level | Version | Build Numbers | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| {{target}} | {{Yes / No — unreleased work on this branch / —}} | {{PATCH / branch level kept / NONE}} | {{1.1.0 → 1.1.1, or "unchanged (1.1.0)"}} | {{versionCode 2 → 3, or "—"}} | {{applied (auto) / recommended / none}} | {{finding refs; base check}} |

**CHANGELOG:** {{`<path>` — Fixed line added under `## [x.y.z]`, or "None — <reason>"}}

**Before release:** {{every `warnings` and `after_release` line of each bumped target, or "None"}}

---

## Documents Updated

| Document | Change |
| --- | --- |
| `{{report path}}` | {{n}} findings closed ({{Finding #1–#3}}) · {{status before}} → {{status after}} · run v{{N}} → v{{N}}.{{k}} |
| `plan.md` | {{TASK-xx ticked · Plan Status → Done, or "No change — <reason>"}} |
| `spec.md` | {{§14 Review findings +n · §16 Minor row · Status → Done, or "No change — <reason>"}} |
| `task.md` | {{n findings ticked · Next step: <command>}} |

**Re-run of the source skill needed:** {{"No — every fix confirmed by its own scenario", or "Yes — `/webkit-<skill> <ticket>` — <the Phase 8 trigger that applies>"}}

---

## Notes

<!-- Only implementation decisions directly related to the approved fixes, plus: findings already resolved, fixes
     that could not be applied and why, checks that could not be run, and every
     "Additional issue discovered — requires separate review" with its location. Otherwise "None". -->

{{notes, or "None"}}

---

## Completion Status

<!-- Choose one. PARTIALLY COMPLETED names exactly which approved fixes were not implemented, and why. -->

{{FIX COMPLETED | PARTIALLY COMPLETED}}

**Reason:** {{reason}}
