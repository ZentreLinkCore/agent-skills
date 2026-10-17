# Spec — Final Pay Processing (timekeeping) — restructure & redesign to the new layout

> **Kind:** Restructure + redesign of an **existing, working** feature to the current layout/design system. **Behavior-preserving** — keep the workflow, change the structure and look.
> **Portal:** Timekeeping (`tk` namespace / `timekeeping` URL prefix + module folder). **Accent: blue** (per [project-profile](../../../rules/core/project-gate.md) portal colors — the current page wrongly uses teal).
> **Route:** `timekeeping/final-pay-processing` (`finalpay_processing`) — already registered.
> **Current state:** fully-built module at [finalpay_processing/](../../../resources/views/web/src/module/timekeeping/finalpay_processing/) — 412-line monolith page, 230-line composable, 5 components, **fully-mocked** api.
> **Downstream:** the payroll [Final Pay](../payroll/final_pay.md) cycle (this page endorses separated employees to payroll).
> **Conventions:** [project-profile](../../../rules/core/project-gate.md), [ui-design](../../../rules/conditional/ui-design.md), [vue-standards](../../../rules/conditional/frontend-vue.md).

---

## 1. Purpose

Final Pay Processing is the timekeeper's audit workspace for **separated employees** (resignation / termination / retirement): it validates final attendance, verifies convertible leave balances (encashment), computes LWOP deductions, runs a sign-off checklist, and drives a workflow that endorses a clean final-pay file to Payroll.

The feature **works today** but is on the **old layout**: an inline breadcrumb, teal accent (should be timekeeping blue), old `Spinner`, hand-rolled status badges, a 412-line page mixing structure + presentation, and — most visibly — **dozens of invalid Tailwind-v4 shades that render faint/unreadable** (same defect fixed on the Payslip page). This spec restructures it into the modern module + design system **without changing the workflow or the numbers**.

---

## 2. What to Preserve (behavior — do NOT change)

Everything functional stays identical — this is a re-skin + re-structure:

- **Master–detail layout:** left = separated-employees directory (search + status/reason filters); right = validation workspace for the selected employee.
- **Workflow state machine:** `Draft → Under Review → Returned for Correction → Validated → Endorsed to Payroll → Completed`, with the state-dependent action buttons (Return / Validate / Endorse / Complete) and the remarks modal on each transition. Keep the exact statuses and transitions from [useFinalpayProcessing.ts](../../../resources/views/web/src/module/timekeeping/finalpay_processing/composables/useFinalpayProcessing.ts).
- **Tabs:** Attendance / Leaves / Audit Timeline ([AttendanceValidationTab](../../../resources/views/web/src/module/timekeeping/finalpay_processing/components/AttendanceValidationTab.vue), [LeaveValidationTab](../../../resources/views/web/src/module/timekeeping/finalpay_processing/components/LeaveValidationTab.vue), [WorkflowTimeline](../../../resources/views/web/src/module/timekeeping/finalpay_processing/components/WorkflowTimeline.vue)).
- **Checklist gating:** [ChecklistPanel](../../../resources/views/web/src/module/timekeeping/finalpay_processing/components/ChecklistPanel.vue) — Validate stays disabled until all checklist items are complete (`checklistCompleteness`).
- **Computations:** leave-encashment preview (`convertible credits × dailyRate`, tax over threshold, net) and LWOP days — keep the composable's `leaveEncashmentDetails` math exactly.
- **Actions:** Export (xlsx) and the sticky action footer summary (Total Encashable Credits / LWOP Deductions).
- **Data source:** the composable + (mocked) api stay as the state layer; the redesign is presentation + structure.

---

## 3. The New Layout (what changes)

### 3a. Design system adoption
- **`HeaderBanner`** ([components/HeaderBanner.vue](../../../resources/views/web/src/components/HeaderBanner.vue), `portal="timekeeping"`) replacing the hand-rolled breadcrumb + title block — matches the Payslip/entries pages.
- **Timekeeping blue accent** everywhere the page currently uses teal (`from-blue-700 via-blue-600 to-indigo-600`, `bg-blue-600`, `text-blue-600 dark:text-blue-400`, `nav-link-active-timekeeping`). No teal.
- **Global components:** `StatusBadge` for the workflow status (replace the inline `getStatusBadgeClass` switch), `EmptyState` for the empty directory, `Loading`/`TableSkeleton` for load states (replace old `Spinner`), `Modal` (already used) for the remarks dialog.
- **Valid Tailwind-v4 tokens only.** The page is littered with **undefined shades that render faint** — `slate-450/455/550/655/750/850`, `teal-650/655`, `purple-650`, `rose-455/650`, `emerald-450/650`, `border-slate-750`, `bg-teal-500/4`, `py-0.2`, etc. Replace **all** of them with defined tokens (`slate-400/500/600/700/800`, blue accent, etc.), exactly as done in the Payslip redesign. This is the single biggest readability win.
- **Dark mode** correct on every element; premium card styling (`bg-white dark:bg-slate-800`, `border-slate-200/60 dark:border-slate-700`, `shadow-sm`, rounded-2xl).

### 3b. Restructure the 412-line page into components
Break `FinalPayProcessing.vue` into focused pieces (keep the composable as the single state source):

```
finalpay_processing/
├── pages/FinalPayProcessing.vue          # thin: HeaderBanner + <SeparatedEmployeeList> + <ValidationWorkspace>
├── composables/useFinalpayProcessing.ts  # KEEP (tidy types; behavior unchanged)
├── api/finalpay_processing.api.ts         # KEEP mocked (design-first); mark endpoints TODO(backend)
├── types/types.finalpay_processing.ts     # expand to real interfaces (drop `any`)
└── components/
    ├── SeparatedEmployeeList.vue          # NEW — left directory: search + filters + list cards + EmptyState
    ├── ValidationWorkspace.vue            # NEW — right: profile + tabs + checklist + action footer
    ├── EmployeeProfileSummary.vue         # KEEP (restyle to blue + valid tokens)
    ├── AttendanceValidationTab.vue        # KEEP (restyle)
    ├── LeaveValidationTab.vue             # KEEP (restyle)
    ├── WorkflowTimeline.vue               # KEEP (restyle)
    ├── ChecklistPanel.vue                 # KEEP (restyle)
    ├── FinalPayActionFooter.vue           # NEW — sticky footer: summary + state-dependent buttons
    └── WorkflowActionModal.vue            # NEW — the remarks/confirm modal (extract from the page)
```

### 3c. UI polish (within the same layout)
- Employee list cards: readable name/id/position, clear **separation-reason** chip + **status** `StatusBadge`, selected state in blue; keyboard/hover affordances.
- Tabs: blue active underline, `Transition` preserved.
- Sticky action footer: clearer summary tiles (Encashable Credits / LWOP), blue primary actions, disabled Validate with tooltip until checklist complete.
- Responsive: 4/8 split on `xl`, stacks on smaller screens; the list scrolls in its own container.

---

## 4. Backend (note — currently mocked)

The api ([finalpay_processing.api.ts](../../../resources/views/web/src/module/timekeeping/finalpay_processing/api/finalpay_processing.api.ts)) is **fully mock**. This spec is a **frontend** restructure/redesign — keep the mock (design-first). Wiring real data is a separate follow-up whose shape the mock already defines:
- `GetSeparatedEmployeesQuery` (tk) — separated employees + their attendance/leave/checklist/audit payload. **Now live** (not mock). Its `attendance` object's keys MUST match [AttendanceInfo](../../../resources/views/web/src/module/timekeeping/finalpay_processing/types/types.finalpay_processing.ts) exactly (`tardiness`, `missingLogs`, `exceptions`, `nightDiff`, `holidayWork`, `absences`, `undertime`, `overtime`, `lastAttendanceDate`) — a key-name drift silently renders the tab empty. It also returns `attendance.dailyLogs` (raw `timesheet` rows: date, timeIn/Out, actualHours, late, absent) → the **Daily Time Records (DTR)** table, **scoped to the final cutoff**: the `payroll_period` covering the employee's `last_working_day`, from `period_start` through that last day (with `cutoffStart`/`cutoffEnd`/`lastWorkingDay` in the payload). Lets the timekeeper see exactly which days/hours to pay for the final cutoff.
- `UpdateFinalPayChecklistHandler` / `UpdateFinalPayWorkflowStatusHandler` (tk) — persist checklist + workflow transitions with remarks.
- Export endpoint for the xlsx.
Register under the `timekeeping` URL prefix (`api/timekeeping/final-pay/...`, **not** `tk`). Endorsement should hand the validated file to the payroll [Final Pay](../payroll/final_pay.md) cycle.

---

## 5. Edge Cases & Rules

1. **Behavior parity:** the redesign must not change any status, transition, checklist gate, or computed amount — diff the workflow before/after.
2. **Invalid shades:** zero undefined Tailwind tokens remain (grep for `slate-450|455|550|655|750|850|teal-650|purple-650|rose-455|rose-650|emerald-450|emerald-650`).
3. **Accent consistency:** blue only; no teal/purple except where a status semantically needs a distinct color (use valid tokens).
4. **Checklist gate:** Validate disabled until all items checked (unchanged).
5. **Empty/loading:** use `EmptyState` / `Loading` (no bare `Spinner`).
6. **Authorization:** timekeeper role; separated-employee data is sensitive ([hrms-rules](../../../rules/conditional/payroll.md) §4).

---

## 6. Build Order (design-first)

**Gate 1 — `webkit.frontend-implement` / redesign (hard-coded, for review):**
1. Expand `types/` to real interfaces (remove `any`).
2. Extract `SeparatedEmployeeList`, `ValidationWorkspace`, `FinalPayActionFooter`, `WorkflowActionModal`; slim `FinalPayProcessing.vue` to composition + `HeaderBanner`.
3. Restyle every component to the new layout — blue accent, `HeaderBanner`, `StatusBadge`/`EmptyState`/`Loading`, valid tokens, dark mode. Keep the composable + mock api.
4. **Review** side-by-side with the old page: same workflow, same numbers, new look; confirm no invalid shades and readable status/amounts.

**Gate 2 — `webkit.backend-implement` (later, optional):** implement the `tk` queries/handlers above and swap the mocked api methods for live `api/timekeeping/final-pay/...` calls (same response shapes), then wire endorsement into the payroll Final Pay cycle.

> This mirrors the Payslip page redesign (readability fix + structure) and the design-first flow in [AGENTS.md](../../AGENTS.md). It is behavior-preserving — prefer the [webkit.refactor](../../skills/webkit.refactor/SKILL.md) discipline for the extract/restyle steps.
