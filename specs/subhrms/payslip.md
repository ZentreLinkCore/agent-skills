# Spec — Payslip (Payroll portal) — reuse from Employee, wire to real data, improved design

> **Status:** Design (payroll payslip page is a placeholder `<h1>`; employee payslip exists but is **fully mocked**).
> **Portal:** Payroll (`payroll` controller namespace, `payroll` URL prefix, `payroll` frontend module folder).
> **Upstream:** Payroll Processing → (Payroll Closing) → **Payslip** (this spec, read/generate).
> **Reuse from:** the Employee-portal payslip module ([resources/views/web/src/module/employee/payslip/](../../../resources/views/web/src/module/employee/payslip/)) — the official payslip document already exists there; this spec applies it to Payroll, feeds it **real** `payroll_run_detail` data, and improves the design.
> **Authoritative conventions:** [.agents/rules/project-profile.md](../../rules/project-profile.md). Follow it; do not re-derive the architecture.

---

## 1. Purpose & Context

The **Employee portal** already has a payslip page ([pages/Payslip.vue](../../../resources/views/web/src/module/employee/payslip/pages/Payslip.vue)) with a polished official-payslip document ([PayslipModal.vue](../../../resources/views/web/src/module/employee/payslip/components/PayslipModal.vue)) — company header, employee info, earnings/deductions columns, net-pay hero, signatures, and **Print / PDF** export (via `html2canvas` + `jspdf`). But it is driven **entirely by hard-coded mock data** ([utils/payslip.utils.ts](../../../resources/views/web/src/module/employee/payslip/utils/payslip.utils.ts) `PAYSLIP_PERIODS`, [store/payslip.store.ts](../../../resources/views/web/src/module/employee/payslip/store/payslip.store.ts)) — no backend.

The **Payroll portal** needs a payslip page too, but from the officer's perspective: view / generate / print / release the payslip for **any employee** for a processed period. This spec:

1. **Applies** the existing employee payslip document to the Payroll portal (reuse, don't re-invent the visual).
2. **Wires it to real data** — the computed `payroll_run_detail` rows from Payroll Processing ([timesheet_summary.md](./timesheet_summary.md)) — so both portals stop relying on mock data.
3. **Improves the design** — extract a shared, themeable payslip document, real statutory/earnings mapping, YTD, batch generation & release, and a cleaner officer workflow.

> The Payroll route is already reserved: `payroll/payroll-reports/payslip` → `reports/pages/payroll_reports/payslip/Payslip.vue` (see [reports.routes.ts](../../../resources/views/web/src/module/payroll/reports/route/reports.routes.ts)), currently a placeholder `<h1>`. This spec fills it in.

---

## 2. Data Flow

```text
Payroll Processing  ──►  payroll_run_detail   (per-emp: earnings, gross, deductions, net, breakdown_json)
   (payroll portal)                            [source of truth for the payslip]
        │
        ▼
PAYSLIP (payroll)   ◄── payroll_run(_detail) for a period   → the payslip numbers
  (payroll reports)  ◄── vw_accounts_details               → name / position / unit / photo
        │            ◄── accountjob                          → TIN-ish / pay release (bank), rate
        │            ◄── company profile / signatories       → header + authorized-by
        │
        ├─►  view a single employee's payslip (document)
        ├─►  Print / Download PDF (single)
        └─►  Batch: generate + Release all payslips for the period  (optional: notify employees)

Employee portal payslip  ◄── SAME endpoint, scoped to the logged-in employee (own payslips only)
```

The payslip is a **rendering** of one `payroll_run_detail` row (plus employee + company context). No new payroll math — it reuses the figures Payroll Processing already computed and persisted.

---

## 3. Input Data Contract (read-only)

Primary source: **`payroll_run_detail`** joined to **`payroll_run`** + **`vw_accounts_details`** (+ **`accountjob`** for TIN/bank/rate). Payroll tables defined in [timesheet_summary.md](./timesheet_summary.md) §6.

Mapped into the payslip document:

| Payslip section | Source fields (`payroll_run_detail` unless noted) |
|---|---|
| **Earnings** line items | `basic_pay`, `ot_pay`, `night_diff_pay`, `holiday_pay`, `leave_pay`, `adjustments` (+ allowances/bonuses from Payroll Entries if present) |
| **Gross** | `gross_pay` |
| **Deductions** line items | `late_deduction`, `undertime_deduction`, `absent_deduction`, `sss`, `philhealth`, `pagibig`, `withholding_tax`, `loans`, `other_deductions` |
| **Total deductions** | `total_deductions` |
| **Net pay** | `net_pay` |
| **Itemization / drill-down** | `breakdown_json` |
| **Employee** | `vw_accounts_details`: `empid`, `fullname`, `position`, `unit`, `employee_type` |
| **Pay/bank** | `accountjob.payrelease` (`Bank`/…), bank account (source TBD — confirm in scan), `daily_rate` |
| **Period** | `payroll_period`: `period_start`, `period_end`, `paydate`, `pay_process_status` (Final vs Draft) |

Company header + signatories (name, address, TIN, logo, authorized signatory) come from a company/profile config — **confirm the canonical source in the System Awareness scan** (the employee mock hardcodes "ZentreLink Corp."; the real value must not be hardcoded).

> **Line-item labels:** map only the components that are non-zero into the earnings/deductions arrays (the employee document already dims ₱0 rows). Reuse the `PayslipLineItem` / `PayslipPeriod` shape from [types.payslip.ts](../../../resources/views/web/src/module/employee/payslip/types/types.payslip.ts) so the shared document renders unchanged.

---

## 4. Target Location (files)

### 4a. Extract a shared payslip document (the "improved design" core)

Move the payslip document out of the employee module into a **shared, themeable component** both portals reuse:

```
resources/views/web/src/components/payslip/
├── PayslipDocument.vue        # NEW (extracted + improved from employee PayslipModal.vue)
└── PayslipDocumentModal.vue   # NEW — thin Modal wrapper around PayslipDocument (Print/PDF toolbar)
```

- `PayslipDocument.vue` takes a typed `period: PayslipPeriod` + `employee` + `company` props and an `accent` prop (`'emerald' | 'cyan'`) so it renders in the portal's color (Employee = emerald, Payroll = cyan — per [ui-design](../../rules/ui-design.md) / project-profile portal accents). All hardcoded strings ("ZentreLink Corp.", "JC", "EMP-00142", bank, signatories) become **props**.
- Keep the Print / PDF logic (`html2canvas` + `jspdf`) in the modal wrapper (already a dependency in the employee module).
- **Refactor the employee module** to import the shared document instead of its local `PayslipModal.vue` (behavior-preserving; see [refactor skill](../../skills/webkit.refactor/SKILL.md)). This removes the duplicate and is part of "improved design."

### 4b. Payroll payslip page (reserved route)

Build under the reserved page folder (mirror the report page sub-structure):

```
resources/views/web/src/module/payroll/reports/pages/payroll_reports/payslip/
├── index.ts                        # barrel
├── Payslip.vue                      # NEW — replaces the placeholder <h1>
├── api/payslip.api.ts               # NEW — usePayslipApi()
├── composables/usePayrollPayslip.ts # NEW — employee + period selection, fetch, batch actions
├── types/types.payslip.ts           # NEW — re-export shared PayslipPeriod + payroll-specific DTOs
└── components/
    ├── PayslipRosterPanel.vue      # NEW — period picker + employee list (who has a payslip)
    └── PayslipBatchBar.vue         # NEW — generate / print-all / release-all for the period
```

Route already registered ([reports.routes.ts](../../../resources/views/web/src/module/payroll/reports/route/reports.routes.ts)): path `payroll/payroll-reports/payslip`, name `payroll_payroll_reports_payslip`. Aggregator auto-registers it — do **not** edit it; just create `Payslip.vue`.

### 4c. Backend

```
app/Domain/Queries/Payroll/GetEmployeePayslipQuery.php    # NEW — one employee's payslip for a period
app/Domain/Queries/Payroll/GetPayslipRosterQuery.php      # NEW — employees w/ payslips for a period (list)
app/Domain/Handlers/Payroll/ReleasePayslipsHandler.php    # NEW (optional) — mark released / notify
app/Http/Controllers/payroll/PayrollReportsController.php # add methods (or reuse the payroll reports controller)
app/Models/PayrollRunDetail.php                          # add `released_at` / `released_by` (optional, see §6)
routes/api.php  →  inside the existing Route::prefix('payroll') group  # ADD routes
```

---

## 5. Backend Design

### 5.1 Routes — add inside `Route::prefix('payroll')->group(...)`

```php
// Payslip
Route::get('/payslip/roster',  [PayrollReportsController::class, 'payslipRoster']);   // list for a period
Route::get('/payslip/detail',  [PayrollReportsController::class, 'payslip']);          // one employee's payslip
Route::post('/payslip/release', [PayrollReportsController::class, 'releasePayslips']);  // optional batch release
```

Endpoints resolve to `api/payroll/payslip/...`.

### 5.2 Controller — thin dispatcher

Each method calls a Query/Handler in `try/catch (Exception $e)`, returns `response()->json(...)`. **No API Resources.**

### 5.3 `GetPayslipRosterQuery`

Read-only. Resolve the cutoff via `HandlePayPeriodQuery::handlePeriod($params)`, find the period's `payroll_run`, return the lightweight list of employees who have a `payroll_run_detail` (for the picker): `{ empid, fullname, position, unit, net_pay, released, payslip_id }` + `period`. Reuse the join/bulk pattern from `GetPayrollSummaryQuery` ([payroll_summary.md](./payroll_summary.md) §5.3).

### 5.4 `GetEmployeePayslipQuery`

Read-only. Input: period params + `empid` (or `idacct`). Steps:
1. Resolve the period + `payroll_run`.
2. Load the single `payroll_run_detail` for `(run, idacct)`; throw a clean "No payslip for this period" if absent.
3. Load employee (`vw_accounts_details`) + `accountjob` (bank/TIN/rate) + company/signatory config.
4. **Shape into the `PayslipPeriod` contract** the shared document expects — build `earnings[]` and `deduction_items[]` (label + optional `sub` + amount) from the detail columns (skip/annotate ₱0 lines), set `gross`, `deductions`, `net`, `coverage`, `date_issued`, `status`.
5. Return `{ period: PayslipPeriod, employee: {...}, company: {...}, ytd?: {...} }`.

> **Employee-portal reuse:** the same query, scoped to `$request->user()`'s `idacct` and returning **all** their periods (YTD list), replaces the employee module's mock. Expose an employee-portal route (`api/employee/payslips`) that calls this query with the authenticated employee id — so both portals share one source of truth. (Employee sees only their own; enforce via the auth user, per [security](../../rules/security.md) / [hrms-rules](../../rules/hrms-rules.md) §4.)

### 5.5 `ReleasePayslipsHandler` (optional)

Batch-mark a period's payslips as released so employees can see them in the Employee portal (and optionally trigger a notification). In `DB::transaction`, stamp `released_at` / `released_by` on the run's details (see §6), write nothing else. Gate on `pay_process_status = 1` (only release a **closed** payroll) — recommended.

---

## 6. Persistence (minimal)

No new table required — the payslip renders existing `payroll_run_detail`. **Optional** columns to support "release to employee":

| Column (on `payroll_run_detail`) | Type | Notes |
|---|---|---|
| `released_at` | timestamp nullable | when the payslip became visible to the employee |
| `released_by` | int nullable | payroll officer account id |

If release-tracking isn't in scope for v1, drop these and treat every processed detail as viewable by payroll (employee visibility gated by `pay_process_status`). Flag the decision rather than assuming.

---

## 7. Frontend Design

### 7.1 Shared document — `components/payslip/PayslipDocument.vue` (improved)

Start from [PayslipModal.vue](../../../resources/views/web/src/module/employee/payslip/components/PayslipModal.vue) and improve:

- **Props, not hardcodes:** `period`, `employee` (name, empid, position, unit, photo/initials, TIN, bank), `company` (name, address, TIN, logo), `signatories[]`, `accent`.
- **Theme by portal:** accent-driven classes (`emerald` for Employee, `cyan` for Payroll) instead of hardwired emerald.
- **Real statutory rows:** SSS / PhilHealth / Pag-IBIG / Withholding Tax / Loans / attendance deductions from the detail (the mock's fixed 1125/875/200 becomes real).
- **Design upgrades:** clearer earnings/deductions two-column grid with running subtotals, a net-pay hero, a **YTD strip** (gross/deductions/net to date), a scannable **doc reference** (`DOC-PS-<run>-<empid>`) — optionally a QR encoding the reference for verification, employee day/hours summary (reg/OT/leaves) pulled from the run for transparency, and print-optimized styles (`@media print`) so Print produces a clean one-page document.
- Keep Print (`window.print`) + PDF (`html2canvas`/`jspdf`) in the modal wrapper.

### 7.2 API layer — `api/payslip.api.ts`

```ts
import http from '@/app/axios/axiosInstance';

export function usePayslipApi() {
  return {
    getRoster:  async (params = {}) => (await http.get('api/payroll/payslip/roster', { params })).data,
    getPayslip: async (params = {}) => (await http.get('api/payroll/payslip/detail', { params })).data,
    release:    async (payload = {}) => (await http.post('api/payroll/payslip/release', payload)).data,
  };
}
```

### 7.3 Composable — `composables/usePayrollPayslip.ts`

- **State:** `period`, `selectedCutoffPeriod`, `rosterList` (employees w/ payslips), `selectedEmployee`, `payslip` (the `PayslipPeriod` doc), `company`, `isLoading`, `showDocument`.
- **Filters:** search the roster (name/empid/position), department filter; client-side pagination via global `<Pagination>` (default 10). Period is URL-synced (`?from&to`) with prev/next — same pattern as the other payroll pages.
- **Actions:** `fetchRoster()`, `openPayslip(empid)` (GET detail → open shared `PayslipDocumentModal`), `printCurrent()`, `downloadCurrentPdf()`, and (optional) `releaseAll()` / batch print.

### 7.4 Page — `Payslip.vue`

- Root layout matches the payroll report pages (cyan accent). Header: title + `VDatePicker` period range + prev/next + a **Final/Draft** badge from `pay_process_status`.
- **`PayslipRosterPanel.vue`** — searchable, paginated list of the period's employees (name, position, net pay, released badge). Clicking a row opens the payslip document. Use global `<Pagination>`, `<TableSkeleton>`, `<EmptyState>` ("No processed payroll for this period").
- **`PayslipBatchBar.vue`** — period-level actions: **Generate/Print All**, **Download All (zip/multi-page PDF)**, **Release All** (optional; disabled unless `pay_process_status = 1`).
- **`PayslipDocumentModal.vue`** (shared) — the viewer, `accent="cyan"`, fed real data.
- Globally-registered components used without import (`VDatePicker`, `Pagination`, `StatusBadge`, `Spinner`, `EmptyState`, `TableSkeleton`); the shared document modal imports `Modal`.

### 7.5 Barrel — `index.ts`

```ts
export { usePayrollPayslip } from './composables/usePayrollPayslip';
export { usePayslipApi } from './api/payslip.api';
```

---

## 8. Filtering, Pagination & Export (requirement recap)

- **Filter:** roster search (name / empid / position) + department, client-side, debounced 300ms.
- **Pagination:** client-side roster list, global `<Pagination>`, default 10/page.
- **Export:** single payslip Print + PDF (reused); optional batch Print-All / multi-page PDF / Release-All for the period.
- **Period navigation:** `VDatePicker` + prev/next, URL-synced (`?from&to`).

---

## 9. Edge Cases & Rules

1. **No payslip for the employee/period** (no `payroll_run_detail`): clean "No payslip available" state, not an error.
2. **Draft vs Final:** watermark/badge the document **DRAFT** when `pay_process_status = 0` (numbers may change); **Final** when closed. Only release Final payslips.
3. **Re-processing after view:** the payslip always reflects the latest persisted detail; no stale caching.
4. **Zero-value lines:** dim ₱0 earnings/deductions (existing document behavior); never show negative net without a visible flag.
5. **Company/signatory data:** must come from config, never hardcoded (the mock's "ZentreLink Corp." is placeholder only).
6. **Authorization:** Payroll portal → any employee's payslip (officer role). Employee portal → **own** payslips only, enforced by the authenticated user id. Payslips expose compensation — strict portal separation ([hrms-rules](../../rules/hrms-rules.md) §4).
7. **Print fidelity:** provide `@media print` styles so the browser Print output is a clean single-page payslip (improvement over screen-only styling).

---

## 10. Testing (per [.agents/rules/testing.md](../../rules/testing.md))

- **PHPUnit:**
  - `GetEmployeePayslipQuery`: maps `payroll_run_detail` → `PayslipPeriod` correctly (earnings/deductions/gross/net), throws cleanly when absent, employee-scoped variant returns only the auth user's rows.
  - `GetPayslipRosterQuery`: lists only employees with details for the run; period resolution.
  - `ReleasePayslipsHandler` (if built): blocks unless `pay_process_status = 1`; stamps `released_*`.
- **Vitest:**
  - `usePayrollPayslip`: roster filter/pagination, open payslip fetches detail, Draft/Final badge.
  - `PayslipDocument.vue`: renders earnings/deductions from props, accent theming (emerald vs cyan), ₱0 dimming, YTD strip — snapshot both portals.

---

## 11. Build Order (design-first)

Per the design-first flow ([AGENTS.md](../../AGENTS.md)) — frontend hard-coded design first for review, then backend adds dynamic data.

**Gate 1 — `webkit.frontend-implement` (hard-coded, for review):**

1. Extract & improve **`PayslipDocument.vue`** + `PayslipDocumentModal.vue` (shared), props-driven, themeable; render with **hard-coded** data (reuse the employee mock shape, real field names).
2. Payroll `Payslip.vue` + roster panel + batch bar + composable/api returning **hard-coded** roster & payslip.
3. Refactor the employee module to consume the shared document (behavior-preserving).
4. **Review the improved design** across both portals (emerald + cyan) — layout, YTD, print output, batch actions. Adjust before backend work.

**Gate 2 — `webkit.backend-implement` (add dynamic data):**

1. `GetEmployeePayslipQuery` + `GetPayslipRosterQuery` (+ optional `ReleasePayslipsHandler` and `released_*` columns) + controller methods + routes.
2. Point the **employee** payslip page at the real employee-scoped endpoint (retire `PAYSLIP_PERIODS` mock + Pinia mock store).
3. Swap the payroll hard-coded api methods for live `http` calls (same shape).
4. Tests — PHPUnit mapping/scope coverage first, then Vitest.

> Depends on `payroll_run_detail` from [timesheet_summary.md](./timesheet_summary.md) (Payroll Processing) — build that first. Confirm the canonical **company/signatory** and **employee bank/TIN** sources during the System Awareness scan before wiring §5.4; do not hardcode them.
