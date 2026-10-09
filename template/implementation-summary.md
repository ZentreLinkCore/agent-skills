# Webkit Implementation Summary

<!--
TEMPLATE: implementation-summary (used by /webkit-implement)

Printed in chat at the end of /webkit-implement; it is not saved as a file.
Fill rules. Delete this comment and every other guide comment from the printed summary.
1. Follow this structure exactly. Do not create a custom format, add sections, remove sections, or reorder them.
2. Replace every {{PLACEHOLDER}}. A finished summary contains no "{{".
3. Never leave a field blank. Write "None" for an empty list, or "N/A — <reason>".
4. Only what was actually built. No speculative improvements, no feature suggestions, no spec changes.
-->

## Metadata

| Field | Value |
| --- | --- |
| Project | {{project}} |
| Ticket | {{T#####}} |
| Branch | {{branch}} |
| Specification | `.agents/specs/{{project}}/{{T#####}}/spec.md` — version {{x.y}} |

---

## Implementation Summary

- **Backend:** {{what was built}}
- **Frontend:** {{what was built}}
- **Database:** {{migrations and schema changes, or "None"}}
- **Shared Components:** {{shared components added or extended, or "None"}}

---

## Reused Components

- **Components:** {{list, or "None"}}
- **Services:** {{Queries / Handlers / Actions reused or extended, or "None"}}
- **Models:** {{list, or "None"}}
- **Helpers:** {{list, or "None"}}
- **Utilities:** {{list, or "None"}}

---

## New Files

<!-- One line per created file, with the Reuse Ledger's CREATE reason: why nothing existing fit. -->

- `{{path}}` — {{why nothing existing fit}}

---

## Updated Files

- `{{path}}` — {{what changed}}

---

## Notes

<!-- Only when necessary: migrations the user must run, acceptance criteria that could not be exercised and why,
     a spec-vs-rule conflict, or "Specification clarification required" items. Otherwise "None". -->

{{notes, or "None"}}
