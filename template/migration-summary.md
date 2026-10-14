# Webkit Migration Summary

<!--
TEMPLATE: migration-summary (used by /webkit-migrate)

Printed in chat at the end of /webkit-migrate; it is not saved as a file (the contract is the saved record).
Fill rules. Delete this comment and every other guide comment from the printed summary.
1. Follow this structure exactly. Do not create a custom format, add sections, remove sections, or reorder them.
2. Replace every {{PLACEHOLDER}}. A finished summary contains no "{{".
3. Never leave a field blank. Write "None" for an empty list, or "N/A — <reason>".
4. Only what was actually migrated. No speculative improvements, no feature suggestions.
-->

## Metadata

| Field | Value |
| --- | --- |
| Source | {{source repo}} — `{{source_path}}` |
| Target | {{target repo}} — `{{target_path}}` |
| Target Branch | {{branch}} |
| Ticket | {{T##### (project), or "None"}} |
| Contract | `.agents/migrations/{{portal-or-domain}}-{{feature}}-{{YYYYMMDD}}.md` (run v{{N}}) |

---

## Implemented in the Target

- **Backend:** {{controllers / read and write layers / routes built}}
- **Frontend:** {{pages / components / hooks / page registration built}}
- **Database:** {{migrations scaffolded and not run, or "None — reused `<table>`"}}
- **Registrations:** {{route-file and router entries added}}
- **Tests:** {{target test files added, per .agents/rules/testing.md, with their run result; a runner set up in the target is also named in Notes}}

---

## Reused Target Components

- **Models / tables:** {{list, or "None"}}
- **Routes / controllers:** {{list, or "None"}}
- **Components:** {{design-system components used, or "None"}}
- **Hooks / utilities:** {{list, or "None"}}

---

## New Files

<!-- One line per created target file, with the contract §11 CREATE reason: why nothing in the target fit. -->

- `{{target path}}` — {{why nothing in the target fit}}

---

## Updated Files

- `{{target path}}` — {{what changed}}

---

## Parity

- **Result:** {{PARITY CONFIRMED | PARITY WITH GAPS}}
- **Checked:** {{n of m contract items equal; static checks run and their results}}
- **Gaps:** {{each differing or unchecked item and why, or "None"}}

---

## Notes

<!-- Only when necessary: migrations the user must run in the target, dependencies the target still lacks, drift
     between the spec and the source code, profile drift in the target, contract items that could not be verified.
     Otherwise "None". -->

{{notes, or "None"}}

---

## Completion Status

<!-- Choose one. MIGRATION COMPLETED requires PARITY CONFIRMED. Migrations still waiting for the user to run them go
     in Notes; they do not make the migration partial. PARTIALLY COMPLETED names exactly which contract items were not
     migrated or are not at parity, and why. -->

{{MIGRATION COMPLETED | PARTIALLY COMPLETED}}

**Reason:** {{reason}}
