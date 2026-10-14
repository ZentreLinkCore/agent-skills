# Task Tracker — {{FEATURE_NAME}}

<!--
TEMPLATE: task-tracker (task.md — created by /webkit-specify beside spec.md and plan.md; kept current by
/webkit-implement, /webkit-verify, /webkit-fix, /webkit-code-review and /webkit-design-review)

The one page that answers "what is done, what is still open, what comes next" for this ticket. It is a VIEW: the
sources stay plan.md (tasks), the reports (findings) and spec.md (status, open questions). Where this file and a
source disagree, the source wins, and the next skill that touches this file re-syncs it from the source.

Fill rules. Delete this comment and every other guide comment from the finished file.
1. Keep this structure. Do not add, remove, rename, or reorder sections.
2. Replace every {{PLACEHOLDER}}. A finished file contains no "{{". Never leave a cell blank: "—" for a stage
   that has not run yet.
3. One line per item. Detail lives in the source file; this file names the item by its ID.
4. Each skill updates only: its own row in §1 (plus Done / Next step), the items it owns in §2–§4, the Metadata
   Last Updated row, and one new line at the TOP of §5. A §5 line is never edited or deleted.
5. A ticked item is never unticked. Work that turns out wrong comes back as a new finding in §3.
-->

## Metadata

| Field | Value |
| --- | --- |
| Ticket | {{T#####}} ({{project}}) |
| Feature | {{FEATURE_NAME}} |
| Branch | `{{T#####}}` |
| Spec | [spec.md](./spec.md) — version {{x.y}}, status {{SPEC_STATUS}} |
| Plan | [plan.md](./plan.md) — revision {{n}}, status {{PLAN_STATUS}} |
| Last Updated | {{YYYY-MM-DD}} by `/webkit-{{skill}}` |

---

## 1. Progress

<!-- One row per stage. Result: the stage's own status, copied from its file (e.g. "v5.1 — ✅ PASS (after fix pass
     v5.1)", "v2 — CHANGES REQUIRED", "12/34 tasks"). Next step: exactly one command, or "None — ticket Done". -->

| Stage | File | Last Run | Result |
| --- | --- | --- | --- |
| Specify | spec.md · plan.md | {{YYYY-MM-DD}} | Spec v{{x.y}} {{SPEC_STATUS}} · plan rev {{n}}, {{N}} tasks |
| Implement | plan.md | — | 0/{{N}} tasks |
| Verify | verify.md | — | — |
| Code review | code-review.md | — | — |
| Design review | design-review.md | — | — |
| Fix | — | — | — |

**Done:** {{done}}/{{N}} tasks · {{fixed}}/{{required}} required findings fixed

**Next step:** `{{/webkit-implement T#####}}`

---

## 2. Plan Tasks

<!-- Mirrors every TASK in plan.md, in plan order, under the plan's four phases, with the same checkbox state.
     A retired task keeps its ~~strikethrough~~. A task blocked by an Open Question ends "— BLOCKED (Q-xx)".
     A phase with no tasks says "None." -->

### Preparation

- [ ] TASK-01 — {{title}}

### Backend

- [ ] TASK-02 — {{title}}

### Frontend Integration

- [ ] TASK-03 — {{title}}

### Validation

- [ ] TASK-04 — {{title}}

---

## 3. Findings to Fix

<!-- The required findings of every report in this folder: verify BLOCKER / REQUIRED FIX, code-review and
     design-review CRITICAL / HIGH, investigation Fix Plan steps, refactor regressions; plus any lower item the user
     named for a fix. Format:
       - [ ] verify v5 #1 — BLOCKER — <one-line problem> (`path/file.php:42`)
     /webkit-fix ticks it and appends "— fixed <YYYY-MM-DD>" (or "— already resolved <YYYY-MM-DD>").
     A re-run of the review replaces its own unticked items with its new run's; ticked items stay as history.
     Optional findings are counted on the last line, never listed. "None yet." before the first review. -->

None yet.

**Optional, not scheduled:** {{e.g. "verify: 3 improvements · code-review: 2 MEDIUM, 1 LOW", or "None"}}

---

## 4. Waiting On

<!-- What keeps the ticket from Done that no skill can finish by itself: spec §15 Open Questions, ACs pending a
     manual check (verify §6), plan §9 Commands for the User not yet run, a spec still Draft / In Review.
     "Nothing." when empty. -->

- {{Q-01 — <question> — blocks TASK-xx}}

---

## 5. Activity Log

<!-- Newest first. One line per skill run: date · command · what changed · resulting status. -->

- {{YYYY-MM-DD}} · `/webkit-specify {{request}}` · Created spec v{{x.y}} and plan rev {{n}} ({{N}} tasks, {{M}} files) · spec {{SPEC_STATUS}}
