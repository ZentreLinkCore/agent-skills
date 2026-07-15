# Spec — Payroll Period (payroll master data)

> **Kind:** Redesign / migrate to the modern TS module + UI over the **existing** backend. Master-data CRUD; shares the pattern in [chart_of_account.md](./chart_of_account.md) with period-specific fields.
> **Portal:** Payroll. **Route:** `payroll/payroll-periods` (`payroll_payroll_periods`) — already registered.
> **Current state:** legacy monolith [maintenance/pages/payroll_periods/PayrollPeriods.vue](../../../resources/views/web/src/module/payroll/maintenance/pages/payroll_periods/PayrollPeriods.vue) (~1,250 lines).

---

## 1. Purpose

Payroll Period defines every pay cutoff — start/end dates, pay date, month/year-end flags, contribution flag, period type, grace hour, and day/head counts. It is the backbone the entire timekeeping + payroll flow resolves against ([`payroll_period`](../../../database/migrations/table/payroll/2024_11_19_140353_create_payroll_period_table.php), consumed everywhere via `HandlePayPeriodQuery`). This spec **modernizes** the legacy CRUD page into the current TS module + clean UI, **reusing the existing backend endpoint unchanged**.

---

## 2. Backend Contract (EXISTING — reuse as-is)

Controller [PayPeriodController](../../../app/Http/Controllers/payroll/PayPeriodController.php), model [PayPeriod](../../../app/Models/PayPeriod.php) (table `payroll_period`). `apiResource('payPeriod', ...)` + `POST uploadPayPeriod`.

| Endpoint | Notes |
|---|---|
| `GET api/payroll/payPeriod` | params: `startdate`, `enddate`, `paydate`, `status`, `year` (→ `year_end`), `entries`; server-side paginated |
| `POST/PUT api/payroll/payPeriod[/{id}]` | body: `period`, `startdate`, `enddate`, `paydate`, `monthend`, `yearend`, `hascontri`, `period_type`, `grace_hour`, `daysno`, `headno` |
| `DELETE api/payroll/payPeriod/{id}` | |
| `POST api/payroll/uploadPayPeriod` | Excel import |

**Model fields:** `period`, `period_start`, `period_end`, `paydate`, `month_end`, `year_end`, `hascontri`, `period_type`, `grace_hour`, `daysno`, `headno`, plus the process-gate columns (`tk_process_*`, `pay_process_*`) and `status` (0 Open by default on create). `uuid` is auto-generated on create.
**List response:** `{ list, payrollperiod: <paginator>, column }`. **Store response:** `{ success, message, payperiod? }` — validate via `success` flag. `startdate`, `enddate`, `paydate` are **each unique**.

> **Read-only gate columns:** `tk_process_status` / `pay_process_status` are written by Timesheet Closing / [Payroll Closing](./payroll_closing.md), **not** by this maintenance page. Display them (Open/Closed badges) but do not edit them here.

---

## 3. Target Files (modern TS module)

Rebuild per the canonical layout ([chart_of_account.md](./chart_of_account.md) §3):
`PayrollPeriods.vue` + `api/payroll_periods.api.ts` (`usePayrollPeriodsApi`) + `composables/usePayrollPeriods.ts` + `types/types.payroll_periods.ts` + `components/{PayrollPeriodsTable, PayrollPeriodFormModal, PayrollPeriodUploadModal}.vue`. Drop `main_payroll.css`; valid Tailwind only, cyan accent, dark mode.

---

## 4. Frontend Design (deltas vs the canonical CRUD)

- **Table columns:** Period label, Cutoff (start – end), Pay Date, Year, Period Type, Contribution (`hascontri` badge), Days/Head no., **TK Status** + **Pay Status** (Open/Closed badges from the gate columns, read-only), Actions (edit/delete).
- **Form modal:** `period`, `startdate` + `enddate` (`VDatePicker` range), `paydate` (date), `monthend`/`yearend` toggles, `hascontri` toggle, `period_type` select, `grace_hour`, `daysno`, `headno`. Inline validation: required dates, **unique** start/end/paydate (surface server `message` on `success:false`).
- **Filters:** `year` select (primary), `status`, `startdate`/`enddate`/`paydate`, `entries` — server-side, debounced. Year filter is the main axis (periods are many).
- **Guards:** discourage editing/deleting a period whose `pay_process_status = 1` (closed payroll) — warn before allowing, since downstream data references it.
- Server pagination, upload/duplicate handling, `StatusBadge`, `VDatePicker`, `Modal`, `Pagination`, `TableSkeleton`, `EmptyState`.

---

## 5. Edge Cases & Build Order

1. **Unique dates** — start/end/paydate collisions return `success:false`; surface the message.
2. **Gate columns are read-only here** — never write `tk_/pay_process_status` from this page.
3. **Deleting a referenced period** — block/warn if the period has timesheet/payroll data or is closed.
4. **`uuid`** — auto-set server-side; no client handling.
5. Server-side pagination; delete confirmation; payroll-portal only ([hrms-rules](../../rules/hrms-rules.md) §4).
6. **Build order (design-first):** Gate 1 hard-coded design (types/api/composable/page/modals) for review → Gate 2 wire the existing `payPeriod` apiResource (no migration/model work). Vitest for the composable (year filter refetch, unique-date error surface, pagination).
