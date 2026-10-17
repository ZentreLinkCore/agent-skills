# Spec — Payroll Summary (payroll register report)

> **Status:** Design (route path already reserved; page + backend do not exist yet).
> **Portal:** Payroll (`payroll` controller namespace, `payroll` URL prefix, `payroll` frontend module folder).
> **Upstream:** Payroll Processing → (Payroll Closing) → **Payroll Summary** (this spec, read-only).
> **Models on:** the timekeeping **Timesheet Summary** report ([timesheet_reports/pages/timesheet_summary](../../../resources/views/web/src/module/timekeeping/timesheet_reports/pages/timesheet_summary/)) — same read-only report UX (period picker, stat cards, filter, pagination), payroll figures.
> **Authoritative conventions:** [.agents/rules/project-gate.md](../../../rules/core/project-gate.md). Follow it; do not re-derive the architecture.

---

## 1. Purpose & Context

Once **Payroll Processing** ([timesheet_summary.md](./timesheet_summary.md)) has computed payslips into `payroll_run_detail`, payroll needs a **read-only register** that shows, for a selected pay period, every employee's full payroll line — **earnings → gross → deductions → net** — with period totals, filtering, pagination, and export.

**Payroll Summary** is that report. It is the payroll mirror of the timekeeping **Timesheet Summary** report (which lists processed hours per employee for a period). It:

1. Loads all **processed** employees for a selected pay period from `payroll_run_detail`.
2. Displays per-employee earnings, gross, itemized deductions, and net pay.
3. Aggregates period totals (headcount, total gross, total deductions, total net, and per-statutory totals).
4. Supports search / department / employee-type filters, client-side pagination, and export (CSV / print — the payroll register).

It performs **no writes** — purely a report over persisted payroll data.

> The Payroll routes already reserve this page: `payroll/payroll-reports/payroll-summary` → `reports/pages/payroll_reports/payroll_summary/PayrollSummary.vue` (see [reports.routes.ts](../../../resources/views/web/src/module/payroll/reports/route/reports.routes.ts)). The component file does not exist yet — this spec fills it in.

---

## 2. Data Flow

```text
Payroll Processing  ──►  payroll_run          (header: period, cycle, totals, status)
   (payroll portal)  ──►  payroll_run_detail   (per-emp: earnings, gross, deductions, net)
        │
        ▼
PAYROLL SUMMARY   ◄── payroll_run(_detail) for the selected period   (READ ONLY)
  (payroll reports) ◄── vw_accounts_details                          → name / position / unit / type
        │
        ├─►  per-employee register rows (earnings → gross → deductions → net)
        ├─►  period totals (gross / deductions / net + per-statutory)
        └─►  export (CSV / print)
```

No gate is required to *view* the report, but rows only exist once processing has produced `payroll_run_detail`. When the period is **closed** (`pay_process_status = 1`) the data is final; when still open it reflects the latest (repeatable) processing run.

---

## 3. Input Data Contract (read-only)

Primary source: **`payroll_run_detail`** joined to **`payroll_run`** (for the period/cycle/status) and **`vw_accounts_details`** (for employee display fields). Both payroll tables are defined in [timesheet_summary.md](./timesheet_summary.md) §6.

Per-row fields consumed (from `payroll_run_detail`):

- **Identity/rate:** `idacct`, `daily_rate`, `hourly_rate`
- **Earnings:** `basic_pay`, `ot_pay`, `night_diff_pay`, `holiday_pay`, `leave_pay`, `adjustments`, **`gross_pay`**
- **Deductions:** `late_deduction`, `undertime_deduction`, `absent_deduction`, `sss`, `philhealth`, `pagibig`, `withholding_tax`, `loans`, `other_deductions`, **`total_deductions`**
- **Result:** **`net_pay`**, `breakdown_json` (for the row drill-down)

Employee display (from `vw_accounts_details`, joined on `id = payroll_run_detail.idacct`): `empid`, `fullname`, `position`, `unit`, `employee_type` (via `employee_status`), `status`.

Period resolution: `HandlePayPeriodQuery::handlePeriod($params)` (same `from`/`to`/`idperiod`/`prev`/`next`/`period`/`reload` surface every other payroll/timesheet period page uses).

---

## 4. Target Location (files to create)

The route already lives in the payroll **reports** module. Build the feature under the reserved page folder (mirror the timekeeping report page's self-contained sub-structure):

```
resources/views/web/src/module/payroll/reports/pages/payroll_reports/payroll_summary/
├── index.ts                                   # barrel for this report page
├── PayrollSummary.vue                          # NEW — replaces the reserved (missing) component
├── api/payroll_summary.api.ts                  # NEW — usePayrollSummaryApi()
├── composables/usePayrollSummary.ts            # NEW — mirror useTimesheetSummary
├── types/types.payroll_summary.ts              # NEW
└── components/
    ├── PayrollSummaryHeader.vue                # NEW — period picker + stat cards + export
    ├── PayrollSummaryTable.vue                 # NEW — register table (earnings→gross→deductions→net)
    └── PayslipBreakdownModal.vue               # (reuse the one from payroll_processing if suitable)
```

> Route already registered in [reports.routes.ts](../../../resources/views/web/src/module/payroll/reports/route/reports.routes.ts): path `payroll/payroll-reports/payroll-summary`, name `payroll_payroll_reports_payroll_summary`. The aggregator auto-registers it — do **not** edit it. Just create the `PayrollSummary.vue` component the route imports.

Backend:

```
app/Domain/Queries/Payroll/GetPayrollSummaryQuery.php           # NEW
app/Http/Controllers/payroll/PayrollReportsController.php       # NEW (or add method to an existing payroll reports controller if one exists)
routes/api/payroll.php  →  add beside the sibling payroll routes  # ADD route
```

---

## 5. Backend Design

### 5.1 Route — add in the payroll portal file [routes/api/payroll.php](../../../routes/api/payroll.php)

```php
// Payroll Summary (payroll register report)
Route::get('/payroll-reports/payroll-summary', [PayrollReportsController::class, 'payrollSummary']);
```

Resolves to `api/payroll/payroll-reports/payroll-summary`. (If a payroll reports controller already exists from a sibling report, add the method there instead of a new controller — confirm via System Awareness.)

### 5.2 Controller — thin dispatcher

```php
public function payrollSummary(Request $request)
{
    try {
        $data = GetPayrollSummaryQuery::execute($request->all());
        return response()->json($data);
    } catch (Exception $e) {
        return response()->json(['message' => $e->getMessage()], 400);
    }
}
```

### 5.3 `GetPayrollSummaryQuery`

`app/Domain/Queries/Payroll/GetPayrollSummaryQuery.php`, extends `App\Domain\Queries\Query`, static `execute($params = [])`. Read-only. Behaviour parallels the roster query but reads **persisted** payroll detail (not live compute):

1. Resolve the cutoff via `HandlePayPeriodQuery::handlePeriod($params)`; return `{ period, employees: [], totals: {…zero} }` if none resolves.
2. Find the period's `payroll_run` (`idpayperiod`, `cycle = 'regular'` by default; accept an optional `cycle` param). If no run, return an empty set (nothing processed yet).
3. Fetch `payroll_run_detail` for the run, **joined** to `vw_accounts_details` (employee display) — bulk, no N+1. Select the earnings/deductions/net columns + employee fields.
4. Map each row to the API shape (all money fields rounded to 2). Include `breakdown_json` decoded for the drill-down.
5. Compute **`totals`** across the set: `headcount`, `total_gross`, `total_deductions`, `total_net`, and per-component sums (`sss`, `philhealth`, `pagibig`, `withholding_tax`, `loans`, plus earnings subtotals) for the register footer.
6. Return:

```php
return [
    'period'    => $cutoff_period,   // includes pay_process_status so UI can show Final vs Draft
    'run'       => ['id' => $run->id, 'cycle' => $run->cycle, 'status' => $run->status],
    'employees' => $rows,
    'totals'    => $totals,
    'count'     => count($rows),
];
```

> **Pagination note:** like the Timesheet Summary report, the query returns the **full processed set** for the period and the frontend paginates client-side (bounded by headcount; the register needs full-set totals + export). If headcount makes this heavy, a later revision can switch to server-side `LengthAwarePaginator` — call it out, don't silently truncate.

---

## 6. Frontend Design

Mirror [useTimesheetSummary.ts](../../../resources/views/web/src/module/timekeeping/timesheet_reports/pages/timesheet_summary/composables/useTimesheetSummary.ts), [timesheet_summary.api.ts](../../../resources/views/web/src/module/timekeeping/timesheet_reports/pages/timesheet_summary/api/timesheet_summary.api.ts), and the summary table/header — same report UX, payroll figures.

### 6.1 API layer — `api/payroll_summary.api.ts`

```ts
import http from '@/app/axios/axiosInstance';

export function usePayrollSummaryApi() {
  return {
    getPayrollSummary: async (params = {}) => {
      const res = await http.get('api/payroll/payroll-reports/payroll-summary', { params });
      return res.data;
    },
  };
}
```

### 6.2 Types — `types/types.payroll_summary.ts`

```ts
export interface PayrollSummaryRow {
  empid: string;
  fullname: string;
  position: string;
  unit: string;
  employee_type: string;
  daily_rate: number;
  // earnings
  basic_pay: number; ot_pay: number; night_diff_pay: number;
  holiday_pay: number; leave_pay: number; adjustments: number;
  gross_pay: number;
  // deductions
  late_deduction: number; undertime_deduction: number; absent_deduction: number;
  sss: number; philhealth: number; pagibig: number; withholding_tax: number;
  loans: number; other_deductions: number;
  total_deductions: number;
  // result
  net_pay: number;
  breakdown_json?: Record<string, any> | null;
}

export interface PayrollSummaryTotals {
  headcount: number;
  total_gross: number; total_deductions: number; total_net: number;
  sss: number; philhealth: number; pagibig: number; withholding_tax: number; loans: number;
}

export interface PayrollSummaryPeriod {
  id?: number | string;
  period_start: string; period_end: string;
  pay_process_status?: number; check_period_flag?: boolean;
  [key: string]: any;
}
```

### 6.3 Composable — `composables/usePayrollSummary.ts`

Copy `useTimesheetSummary` shape:

- **State:** `rows`, `totals`, `isLoading`, `period`, `selectedCutoffPeriod`, `run` (id/cycle/status).
- **Filters (reactive):** `searchQuery` (debounced 300ms via `@vueuse/core` `useDebounce`), `selectedDepartment`, `selectedEmployeeType`. `watch` filters + `perPage` → reset `currentPage = 1`.
- **Pagination (client-side):** `currentPage`, `perPage` (default 10); computed `filteredRows`, `paginatedRows`, `totalPages`, `paginationData` `{from, to, total}` — identical mechanics to the timesheet summary composable.
- **Derived:** `uniqueDepartments`, `uniqueEmployeeTypes`.
- **Stats:** expose the backend `totals` (recomputed client-side over `filteredRows` so totals reflect the active filter, matching how the timesheet summary recomputes `stats`).
- **Actions:** `fetchSummary(params)` — GET, hydrate `rows`/`totals`/`period`/`run`, sync `?from&to` to the route (same `onMounted` + `watch(route.query)` URL-driven navigation). `resetFilters()`. `exportCsv()` (client-side CSV of the filtered rows) and/or print.

### 6.4 Page & components

- **`PayrollSummary.vue`** — root layout copies the timekeeping report page; payroll accent (cyan). Header + card container holding the filter bar, register table, pagination. Show a **Final / Draft** badge from `period.pay_process_status` (Closed = Final).
- **`PayrollSummaryHeader.vue`** — title, `VDatePicker` period range + prev/next, stat cards (Headcount / Total Gross / Total Deductions / Total Net), and an **Export** button (CSV / print).
- **Filter bar** — search (name/ID/position), `<c-select>` Department + Employee Type, Reset when active. Match the timesheet summary/processing filter classes.
- **`PayrollSummaryTable.vue`** — register columns: Employee (name + empid + position), Department, Daily Rate, earnings group (Basic / OT / Night Diff / Holiday / Leave / Adj), **Gross**, deductions group (Late / UT / Absent / SSS / PhilHealth / Pag-IBIG / Tax / Loans / Other), **Total Deductions**, **Net Pay** — all peso via `formatCurrency`. A **totals footer row** from `totals`. Row action opens `PayslipBreakdownModal`. Wide table scrolls inside its own `overflow-x-auto` container. Use global `<Pagination>`, `<TableSkeleton>` while loading, `<EmptyState>` ("No processed payroll for this period") when empty.
- Use globally-registered components without import (`CSelect`, `Pagination`, `Spinner`, `VDatePicker`, `StatusBadge`, `EmptyState`, `TableSkeleton`); import `Modal` for the breakdown.

### 6.5 Barrel — `index.ts`

```ts
export { usePayrollSummary } from './composables/usePayrollSummary';
export { usePayrollSummaryApi } from './api/payroll_summary.api';
```

---

## 7. Filtering, Pagination & Export (requirement recap)

- **Filter:** search (name / empid / position), Department, Employee Type — client-side over the loaded period set, search debounced 300ms; filters reset page to 1 and recompute totals.
- **Pagination:** client-side, `perPage` selectable (default 10), global `<Pagination>` + `paginationData` `{from, to, total}`.
- **Sorting:** optional column-header sort on name / gross / net (client-side); not required for v1.
- **Export:** CSV of the currently filtered set + browser print (payroll register). Peso formatting via `@/src/utils/currency`.
- **Period navigation:** `VDatePicker` range + prev/next, URL-synced (`?from&to`), re-fetch on change.

---

## 8. Edge Cases & Rules

1. **Period not processed** (no `payroll_run` / no details): empty state, zero totals — do not error.
2. **Open vs. closed period**: show a **Draft** badge when `pay_process_status = 0` (figures may change on re-processing) and **Final** when `= 1`.
3. **Re-processing changed figures**: the report always reflects the latest persisted `payroll_run_detail`; no caching of stale numbers.
4. **Filtered totals**: the totals footer reflects the **filtered** set (matches Timesheet Summary behavior), not the whole period — label it clearly when a filter is active.
5. **Cycle**: defaults to `regular`; if special/13th/final runs exist for the period, accept a `cycle` param (future — the register is per run).
6. **Read-only**: this page never writes; no lock/process actions here (those live in Payroll Processing / Payroll Closing).
7. **Authorization**: payroll register exposes compensation — restrict to payroll-portal roles ([security](../../../rules/core/security-baseline.md), [hrms-rules](../../../rules/conditional/payroll.md) §4 portal separation).

---

## 9. Testing (per [.agents/rules/conditional/testing.md](../../../rules/conditional/testing.md))

- **PHPUnit** — `GetPayrollSummaryQuery`: returns rows only when a `payroll_run` exists; correct join to employee fields; money fields rounded; `totals` sum correctly (gross/deductions/net + per-statutory); empty set for an unprocessed period; period resolution honors `from`/`to`/`idperiod`.
- **Vitest** — `usePayrollSummary`: filter + pagination computeds; totals recompute over the filtered set; CSV export contains the filtered rows; URL-driven period navigation; Draft/Final badge from `pay_process_status`.

---

## 10. Build Order (design-first)

Per the design-first flow ([AGENTS.md](../../AGENTS.md)) — frontend hard-coded design first for review, then backend adds dynamic data.

**Gate 1 — `webkit.frontend-implement` (hard-coded, for review):**

1. `types/` + `api/payroll_summary.api.ts` returning **hard-coded** rows + totals (real field names from §3/§5; seed a full register with several employees, all earning/deduction columns populated, and matching totals).
2. Composable + `PayrollSummary.vue` + components (header w/ export, register table w/ totals footer, breakdown modal).
3. **Review the design against this spec** — register columns, gross→deductions→net, totals footer, Draft/Final badge, export. Adjust before backend work.

**Gate 2 — `webkit.backend-implement` (add dynamic data):**

1. `GetPayrollSummaryQuery` (join `payroll_run_detail` + `payroll_run` + `vw_accounts_details`) + controller method + route.
2. Swap the hard-coded api method for the live `http` call (same shape).
3. Tests — PHPUnit totals/join coverage first, then Vitest.

> Depends on the `payroll_run` / `payroll_run_detail` tables from [timesheet_summary.md](./timesheet_summary.md) (Payroll Processing) — build that first. Reuse the timekeeping Timesheet Summary report as the frontend template.
