# Webkit Fix Summary

<!--
TEMPLATE: fix-summary (used by /webkit-fix)

Printed in chat at the end of /webkit-fix; it is not saved as a file.
Fill rules. Delete this comment and every other guide comment from the printed summary.
1. Follow this structure exactly. Do not create a custom format, add sections, remove sections, or reorder them.
2. Replace every {{PLACEHOLDER}}. A finished summary contains no "{{".
3. Never leave a field blank. Write "None" for an empty list, or "N/A — <reason>".
4. Only the approved fixes from the source report. No speculative improvements, no suggested additional work.
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
