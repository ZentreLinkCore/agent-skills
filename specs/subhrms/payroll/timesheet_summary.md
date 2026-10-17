# Spec — Payroll Processing (Regular Cycle) consuming `timesheet_summary`

> **Status:** Design (page does not yet exist — current `RegularCycle.vue` is a placeholder `<h1>`).
> **Portal:** Payroll (`payroll` controller namespace, `payroll` URL prefix, `payroll` frontend module folder).
> **Upstream:** Timekeeping → Timesheet Processing → **Timesheet Closing (lock)** → Payroll Processing (this spec).
> **Authoritative conventions:** [.agents/rules/project-gate.md](../../../rules/core/project-gate.md). Follow it; do not re-derive the architecture.

---

## 1. Purpose & Context

After Timekeeping finishes computing attendance, the result for each employee is persisted as one row per employee per pay period in the **`timesheet_summary`** table (plus a per-leave-type child table `timesheet_summary_leaves`). When the Timekeeping team **closes/locks** the period, those rows become the frozen input for Payroll.

**Payroll Processing** is the first screen in the Payroll workflow that turns those timekeeping hours into a full payslip. It:

1. Loads the roster of active employees for a selected pay period, joined with their `timesheet_summary` hours and their `accountjob` compensation/statutory setup.
2. Lets the payroll officer **filter, paginate, review and select** employees.
3. **Processes** the selected employees end-to-end — **hours → gross pay → deductions → net pay** — computing each figure from the summary hours × rate factors and the employee's `accountjob` rate (`salary` ÷ `daysmonth`), then persists a payroll run/detail.

> The processing chain is complete: it does not stop at gross pay. Gross (basic + OT + night diff + holiday + leave) is reduced by attendance deductions (late/undertime/absent) and statutory + other deductions (SSS, PhilHealth, Pag-IBIG, withholding tax, loans) to arrive at **net pay** per employee.

This spec defines that page end-to-end (backend + frontend) because it does not exist yet. It deliberately mirrors the existing, working **Timesheet Processing** page ([resources/views/web/src/module/timekeeping/timesheet_processing/](../../../resources/views/web/src/module/timekeeping/timesheet_processing/)) so the two flows feel consistent.

---

## 2. Data Flow

```
Time Recorder / DTR
        │  (raw logs)
        ▼
Timesheet Processing  ──►  timesheet_summary          (per emp/period hours: reg, ot, np, late, ut, leaves…)
   (tk portal)         └─►  timesheet_summary_leaves   (per emp/period/leave-type days)
        │
        ▼
Timesheet Closing (lock)  ──►  payroll_period.tk_process_status = 1   (period frozen for payroll)
        │
        ▼
PAYROLL PROCESSING   ◄── timesheet_summary (+ leaves)   → hours
   (payroll portal)  ◄── accountjob                     → rate (salary ÷ daysmonth), deduct flags, statutory setup
        │            ◄── loans / recurring entries       → other deductions
        │
        │   compute per employee:  hours × rate factors → GROSS
        │                          − attendance deductions (late / undertime / absent)
        │                          − statutory (SSS, PhilHealth, Pag-IBIG, withholding tax) + loans
        │                          = NET PAY
        │
        ├─►  payroll_run          (one run per period/cycle)   [NEW TABLE]
        ├─►  payroll_run_detail   (one payslip line per emp — gross → deductions → net)  [NEW TABLE]
        └─►  payroll_period.pay_process_status = 1  (period marked payroll-processed)
```

### Existing gate columns on `payroll_period` (model `App\Models\PayPeriod`, table `payroll_period`)

Already present — this spec only **reads/writes** them, no migration needed:

| Column | Meaning |
|---|---|
| `tk_process_status` | `0` Open / `1` Closed. **Payroll may only process a period where this = 1.** |
| `pay_process_idacct` | Account that ran payroll processing. |
| `pay_process_date` | Timestamp payroll processing ran. |
| `pay_process_status` | `0` Open / `1` Closed (payroll processed). Written by this feature. |

Source: [database/migrations/table/payroll/2024_11_19_140353_create_payroll_period_table.php](../../../database/migrations/table/payroll/2024_11_19_140353_create_payroll_period_table.php).

---

## 3. Input Data Contracts

Two read-only sources feed the computation: **`timesheet_summary`** supplies the hours; **`accountjob`** supplies the pay rate, deduction flags, and statutory setup.

### 3a. Hours — `timesheet_summary`

Read-only source. Model [app/Models/TimesheetSummary.php](../../../app/Models/TimesheetSummary.php), migration [.../create_timesheet_summary_table.php](../../../database/migrations/table/timesheet/2026_06_21_232831_create_timesheet_summary_table.php).

- **Key:** `idpayperiod` (→ `payroll_period.id`), `idacct` (→ `accounts.id`).
- **Headline hours (decimal 10,2):** `reg_hrs`, `worked_hrs`, `ot_hrs`, `late_hrs`, `ut_hrs`, `leaves`, `absents`.
- **Detailed breakdown (decimal 5,2, nullable)** — grouped by prefix:
  - `h_*` — holiday/premium hours: `h_sh, h_shrd, h_lh, h_lhrd, h_lsh, h_lshrd`
  - `ot_*` — overtime by day-type: `ot_reg, ot_rd, ot_sh, ot_shrd, ot_lh, ot_lhrd, ot_lsh, ot_lshrd`
  - `np_*` — night premium: `np_npreg, np_rd, np_sh, np_shrd, np_lh, np_lhrd, np_lsh, np_lshrd`
  - `npot_*` — night-premium OT: `npot_npot, npot_rd, npot_sh, npot_shrd, npot_lh, npot_lhrd, npot_lsh, npot_lshrd`
  - `adj_aa_* / adj_ot_* / adj_np_* / adj_npot_*` — prior-cutoff late-approved adjustments carried into this cutoff.
- `is_locked` (tinyint) — per-employee lock; when the whole period is closed all rows are `is_locked = 1` (see [LockPeriodHandler](../../../app/Domain/Handlers/Timesheet/LockPeriodHandler.php)).

> The day-type suffixes (`rd`=rest day, `sh`=special holiday, `lh`=legal/regular holiday, `lsh`/`lhrd`/`shrd` = combinations) map to overtime/premium **rate factors** the payroll computation multiplies against. Rate factors live in the payroll maintenance / overtime-rate config (`OvertimeRateController`, `payroll_period.hascontri`, salary rates) — the compute step (§6.3) resolves them per employee.

Per-leave-type breakdown: [app/Models/TimesheetSummaryLeave.php](../../../app/Models/TimesheetSummaryLeave.php) — `idacct, idpayperiod, idleave, leave_alias, leave_type, days, is_carryover`.

### 3b. Rate & statutory setup — `accountjob`

Read-only source. Model [app/Models/AccountJob.php](../../../app/Models/AccountJob.php), migrations [.../create_accountjob_table.php](../../../database/migrations/table/account/2024_08_22_025855_create_accountjob_table.php) + [.../2024_11_19_135430_add_field_to_accountjob.php](../../../database/migrations/alters/accountjob/2024_11_19_135430_add_field_to_accountjob.php). One row per employee, keyed by **`idacct`** (→ `accounts.id`).

**Pay rate:**

| Column | Type | Use in payroll |
|---|---|---|
| `salary` | decimal(15,5) | Monthly basic salary. |
| **`daysmonth`** | string, default `'26.0833'` | **Working days per month — the divisor for the daily rate.** `daily_rate = salary ÷ daysmonth`. (`26.0833 ≈ 313 ÷ 12`, consistent with the 313-day factor in [HRMS Domain Rules §3](../../../rules/conditional/payroll.md).) Cast to float via the model's `CastNumericStrings` trait. |

> **REQUIRED:** the daily-rate divisor MUST be read from `accountjob.daysmonth` for the employee — never a hardcoded constant. Fall back to the column default `26.0833` only when the row's value is null/empty. Hourly rate = `daily_rate ÷ 8`.

**Attendance-deduction flags** (`1` = deduct this component, per employee):

| Column | Deduction it gates |
|---|---|
| `basicpay` | whether basic pay is prorated by worked days |
| `absences` | absent deduction (`absents` × daily_rate) |
| `lates` | late deduction (`late_hrs` × hourly_rate) |
| `undertime` | undertime deduction (`ut_hrs` × hourly_rate) |

**Statutory setup** (amount + which cutoff-half it applies to). `*_period_type` is JSON: `1` = 1st-half, `2` = 2nd-half — so a semi-monthly contribution is only deducted on the matching cutoff:

| Contribution | Columns |
|---|---|
| SSS | `sss_type`, `sss_period_type` (json), `sss_amount` (decimal 15,5) |
| Pag-IBIG | `ibig_type`, `ibig_period_type` (json), `ibig_amount` |
| PhilHealth | `philhealth_type`, `philhealth_period_type` (json), `philhealth_amount` |
| Withholding tax (BIR) | `internal_revenue` (default `'Table-Based'`), `internal_revenue_period_type` (json), `prev_employer` |

Other: `cba` (CBA membership), `sc_stat` (service-charge active 0/1), `payrelease` (`Bank`/…). These influence add-ons/other deductions sourced from the Payroll Entries module.

---

## 4. Target Location (files to create)

Frontend module — follow the TS module layout in project-profile §"Frontend Architecture". Reuse the **existing** `payroll_processing` module folder (it already holds placeholder pages + one routes file):

```
resources/views/web/src/module/payroll/payroll_processing/
├── index.ts                                   # extend barrel: export composable, api, (routes already aggregated)
├── route/payroll_processing.routes.ts         # EXISTS — 'payroll/regular-cycle' already registered
├── api/payroll_processing.api.ts              # NEW — usePayrollProcessingApi()
├── composables/usePayrollProcessing.ts        # NEW — state + filters + pagination + actions
├── types/types.payroll_processing.ts          # NEW — DTOs / interfaces
├── pages/regular_cycle/RegularCycle.vue        # REPLACE placeholder with the real page
└── components/
    ├── PayrollProcessingHeader.vue            # NEW — title + period picker + stat cards
    ├── PayrollProcessingTable.vue             # NEW — roster table w/ selection + hours + gross/deductions/net
    ├── PayslipBreakdownModal.vue              # NEW — per-employee earnings → deductions → net drill-down
    ├── ProcessConfirmModal.vue                # NEW — confirm before running
    └── ProcessingProgressModal.vue            # NEW — batched progress terminal
```

Route already present ([route/payroll_processing.routes.ts](../../../resources/views/web/src/module/payroll/payroll_processing/route/payroll_processing.routes.ts)): path `payroll/regular-cycle`, name `payroll_regular_cycle`. Routing is auto-aggregated by `payroll/useApiWebRoute.ts` — **do not** edit the aggregator.

Backend — Domain Query/Handler + thin controller (project-profile §"Backend Architecture"):

```
app/Domain/Queries/Payroll/GetPayrollProcessingRosterQuery.php       # NEW
app/Domain/Handlers/Payroll/ProcessPayrollHandler.php                # NEW
app/Http/Controllers/payroll/PayrollProcessingController.php         # NEW (thin)
routes/api/payroll.php  →  add beside the sibling payroll routes # ADD routes
```

New tables (migrations under `database/migrations/table/payroll/`):

```
payroll_run           # NEW — header row per period+cycle
payroll_run_detail    # NEW — one computed payslip line per employee
```

---

## 5. Backend Design

### 5.1 Routes — add in the payroll portal file [routes/api/payroll.php](../../../routes/api/payroll.php)

```php
// Payroll Processing (consumes timesheet_summary)
Route::get('/payroll-processing/roster',   [PayrollProcessingController::class, 'roster']);
Route::post('/payroll-processing/process', [PayrollProcessingController::class, 'process']);
Route::get('/payroll-processing/status',   [PayrollProcessingController::class, 'periodStatus']);
Route::post('/payroll-processing/reverse', [PayrollProcessingController::class, 'reverse']); // unprocess a not-yet-closed run
```

- URL prefix is `payroll` (matches namespace, unlike the `tk`/`timekeeping` split). Endpoints: `api/payroll/payroll-processing/...`.
- Match sibling style: explicit per-method `Route::get/post`.

### 5.2 Controller — thin dispatcher

`app/Http/Controllers/payroll/PayrollProcessingController.php`, extends `App\Http\Controllers\Controller`. Each method calls a Query/Handler statically inside `try/catch (Exception $e)` and returns `response()->json(...)`. **No API Resources** (project has zero). Mirror [TimesheetProcessingController] method shape.

```php
public function roster(Request $request)
{
    try {
        $data = GetPayrollProcessingRosterQuery::execute($request->all());
        return response()->json($data);
    } catch (Exception $e) {
        return response()->json(['message' => $e->getMessage()], 400);
    }
}

public function process(Request $request)
{
    try {
        $result = ProcessPayrollHandler::execute($request->all());
        return response()->json($result);
    } catch (Exception $e) {
        return response()->json(['message' => $e->getMessage()], 400);
    }
}
```

### 5.3 Query — `GetPayrollProcessingRosterQuery`

`app/Domain/Queries/Payroll/GetPayrollProcessingRosterQuery.php`, extends `App\Domain\Queries\Query`, static `execute($params = [])`. Directly parallels [GetTimesheetProcessingRosterQuery](../../../app/Domain/Queries/Timesheet/GetTimesheetProcessingRosterQuery.php).

Behaviour:

1. Resolve the pay period via `HandlePayPeriodQuery::handlePeriod($params)` (supports `from`/`to`, `idperiod`, `prev`/`next`, `reload` — the exact same param surface Timesheet Processing already uses). Return `{ period, employees: [], count: 0 }` when none resolves.
2. Derive gate flags from the resolved period:
   - `tk_closed` = `tk_process_status == 1` (payroll input is frozen & valid).
   - `pay_processed` = `pay_process_status == 1` (payroll already run for this period).
3. Fetch active employees from `AccountDetailVW` (`status = 1`), selecting `id, empid, fullname, position, unit, status` + `employee_status.type as employee_type` (left join `employee_status` on `emptype_id`) — identical projection to the timesheet roster.
4. Bulk-fetch `TimesheetSummary::where('idpayperiod', $periodId)->get()->keyBy('idacct')` and `TimesheetSummaryLeave` grouped by `idacct`.
5. Bulk-fetch any existing `payroll_run_detail` for this run, keyed by `idacct`, to surface prior gross/net and a per-employee payroll status.
5b. Bulk-load `accountjob` for the active employees, keyed by `idacct` (`salary`, `daysmonth`, deduct flags, statutory setup). Compute a preview `daily_rate = salary / daysmonth` for display and to flag employees with no rate.
6. Build one row per active employee:
   - Copy headline hours (`reg_hrs, worked_hrs, ot_hrs, late_hrs, ut_hrs, leaves, absents`) and the full detailed-breakdown column set (same field loop as the timesheet roster), defaulting to `0.00` when no summary exists.
   - Include `leave_breakdown[]` (from child table, with live `app_leave` fallback exactly as the timesheet roster does — keep the N+1-avoiding bulk map).
   - Include `salary` and `daily_rate` (from `accountjob`) for the row, `null` when there is no `accountjob`.
   - Derive **`payroll_status`** per employee:
     - `"No Timesheet"` — no `timesheet_summary` row (block from processing).
     - `"No Rate"` — has a summary but no `accountjob` (or no `salary`) — block from processing, prompt to set up compensation.
     - `"Pending"` — has summary + rate, `tk_closed`, not yet in a payroll run.
     - `"Processed"` — has a `payroll_run_detail` row for the run.
     - `"Closed"` — period `pay_process_status == 1` (payroll finalized).
   - `gross_pay` / `net_pay` / `total_deductions` / `last_processed` from the existing detail row when present, else `null`.
7. Return:

```php
return [
    'period'    => $cutoff_period,          // includes tk_process_status, pay_process_status
    'gates'     => ['tk_closed' => $tk_closed, 'pay_processed' => $pay_processed],
    'employees' => $list,
    'count'     => count($list),
];
```

> **Pagination note:** like Timesheet Processing, the roster returns the **full period set** and the frontend paginates client-side (period membership is bounded by headcount, and the officer needs full-set stats + "select all in filter"). If a tenant's headcount makes this heavy, a later revision can switch to server-side `LengthAwarePaginator` — call that out rather than silently truncating.

### 5.4 Handler — `ProcessPayrollHandler`

`app/Domain/Handlers/Payroll/ProcessPayrollHandler.php`, extends `App\Domain\Handlers\Handler`, static `execute($params = [])`. Parallels [ProcessTimesheetsHandler](../../../app/Domain/Handlers/Timesheet/ProcessTimesheetsHandler.php).

Input: `{ emp_ids: string[], period: {...} }` (chunked by the frontend in batches of 10 — see §7.4).

Steps:

1. Validate `emp_ids` non-empty → else `throw new Exception("No employees specified for processing.")`.
2. Resolve period via `HandlePayPeriodQuery::handlePeriod($params['period'])`; throw if missing.
3. **Gate: `tk_process_status` must be `1`.** If not closed → `throw new Exception("Timekeeping for this period is not yet closed. Payroll cannot be processed.")`.
4. **Gate: reject if `pay_process_status == 1`** (already finalized) unless an explicit reprocess flag is passed → `throw new Exception("This pay period's payroll is already closed.")`.
5. Load matching active accounts (`AccountDetailVW::whereIn('empid', $empIds)->where('status', 1)`), pluck `id`s.
6. Bulk-load their `timesheet_summary` rows for the period, keyed by `idacct`. Skip any employee with no summary row (cannot compute pay from nothing) — count as `skipped_no_timesheet`.
7. Resolve the **`payroll_run`** header for `(idpayperiod, cycle='regular')` — find or create.
8. Bulk-load the `accountjob` rows for the employees, keyed by `idacct` — the source of `salary`, `daysmonth`, the deduct flags, and statutory setup. Skip (and count `skipped_no_accountjob`) any employee with no `accountjob` row (cannot compute a rate).
9. Inside `DB::transaction(...)`, for each employee run the **full compute chain (§6.3)** — hours → gross → deductions → net — using that employee's `accountjob.daysmonth` for the daily rate. Then **upsert** one `payroll_run_detail` row (delete-then-insert or `updateOrCreate` on `(idpayrun, idacct)`) holding every earning, every deduction, gross and net. Increment `processed`; record per-emp timing. After the loop, update the `payroll_run` header totals (`headcount`, `total_gross`, `total_net`).
10. Do **not** flip `pay_process_status` here — processing is repeatable/idempotent. Period finalization (`pay_process_status = 1`, `pay_process_idacct`, `pay_process_date`) is a separate **Close/Lock** action (future "Payroll Closing", analogous to Timesheet Closing). Return the run summary so the UI can refresh.
11. Log a `[PAYROLL-PROCESS]` summary line (requested/processed/skipped/timings/db-queries) — copy the instrumentation pattern already in `ProcessTimesheetsHandler`.

Return:

```php
return [
    'idpayrun'              => $run->id,
    'processed'             => $processed,
    'total_gross'          => $run->total_gross,
    'total_net'            => $run->total_net,
    'skipped_no_timesheet'  => $skippedNoTs,
    'skipped_no_accountjob' => $skippedNoAj,
    'skipped_locked'        => $skippedLocked,
];
```

---

## 6. New Persistence

### 6.1 `payroll_run` (header — one per period per cycle)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `idpayperiod` | int, indexed | → `payroll_period.id` |
| `cycle` | varchar | `regular` \| `special` \| `13th` \| `retro` \| `final` \| `year_end` (matches the payroll_processing page set) |
| `status` | tinyint default 0 | 0 Draft/Open, 1 Closed |
| `headcount` | int default 0 | employees in this run |
| `total_gross` | decimal(14,2) default 0 | |
| `total_net` | decimal(14,2) default 0 | |
| `processed_by` | int nullable | account id |
| `processed_at` | timestamp nullable | |
| `timestamps` | | |

Unique index on `(idpayperiod, cycle)`.

### 6.2 `payroll_run_detail` (one computed payslip line per employee)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `idpayrun` | bigint, indexed | → `payroll_run.id` |
| `idpayperiod` | int, indexed | denormalized for direct period queries |
| `idacct` | int, indexed | → `accounts.id` |
| `daily_rate` | decimal(12,4) | `salary ÷ daysmonth` — snapshot of the rate used |
| `hourly_rate` | decimal(12,4) | `daily_rate ÷ 8` — snapshot |
| **Earnings** | | |
| `basic_pay` | decimal(12,2) | `reg_hrs`/`worked_hrs` × rate |
| `ot_pay` | decimal(12,2) | Σ `ot_*` × factors |
| `night_diff_pay` | decimal(12,2) | Σ `np_*`/`npot_*` × factors |
| `holiday_pay` | decimal(12,2) | Σ `h_*` × factors |
| `leave_pay` | decimal(12,2) | from `leaves` / leave breakdown |
| `adjustments` | decimal(12,2) | from `adj_*` columns |
| `gross_pay` | decimal(12,2) | **sum of earnings above** |
| **Attendance deductions** | | |
| `late_deduction` | decimal(12,2) | `late_hrs` × hourly_rate (if `accountjob.lates`) |
| `undertime_deduction` | decimal(12,2) | `ut_hrs` × hourly_rate (if `accountjob.undertime`) |
| `absent_deduction` | decimal(12,2) | `absents` × daily_rate (if `accountjob.absences`) |
| **Statutory deductions** | | |
| `sss` | decimal(12,2) | from `accountjob.sss_amount`, gated by `sss_period_type` vs this cutoff-half |
| `philhealth` | decimal(12,2) | from `accountjob.philhealth_amount`, period-gated |
| `pagibig` | decimal(12,2) | from `accountjob.ibig_amount`, period-gated |
| `withholding_tax` | decimal(12,2) | BIR table on taxable income (gross − SSS − PhilHealth − Pag-IBIG), per `internal_revenue` |
| **Other deductions** | | |
| `loans` | decimal(12,2) | due amortizations from the Payroll Entries loans module |
| `other_deductions` | decimal(12,2) | other recurring entries |
| `total_deductions` | decimal(12,2) | **sum of all deductions above** |
| **Result** | | |
| `net_pay` | decimal(12,2) | **`gross_pay − total_deductions`** |
| `breakdown_json` | json nullable | full itemized computation for the payslip drill-down |
| `timestamps` | | |

Unique index on `(idpayrun, idacct)`.

Models: `App\Models\PayrollRun`, `App\Models\PayrollRunDetail` (plain Eloquent, `$fillable` + `decimal:2` casts, `belongsTo` relations to `PayPeriod`/`Account`) — mirror the `TimesheetSummary` model style.

### 6.3 Compute chain (`ProcessPayrollHandler` internal) — hours → gross → deductions → net

Runs per employee, using **that employee's `accountjob` row**. This is the complete chain — it does **not** stop at gross.

**Step 0 — rate (from `accountjob`, REQUIRED):**

```text
days_month  = (float) accountjob.daysmonth  ?: 26.0833     // MUST come from accountjob.daysmonth
daily_rate  = salary / days_month
hourly_rate = daily_rate / 8
```

**Step 1 — earnings → GROSS:** each category = `Σ(hours_column × day_type_factor × hourly_rate)`, day-type factors from the OT/holiday/night-diff config already maintained in the Payroll portal (`OvertimeRateController`) and the rates in [HRMS Domain Rules §1](../../../rules/conditional/payroll.md) (OT 125%, RD/special 130%, regular holiday 200%, night diff 110%).

```text
gross_pay = basic_pay + ot_pay + night_diff_pay + holiday_pay + leave_pay + adjustments
```

**Step 2 — attendance deductions:** each gated by the matching `accountjob` flag (`lates` / `undertime` / `absences`):

```text
late_deduction       = accountjob.lates      ? late_hrs × hourly_rate : 0
undertime_deduction  = accountjob.undertime  ? ut_hrs   × hourly_rate : 0
absent_deduction     = accountjob.absences   ? absents  × daily_rate  : 0
```

**Step 3 — statutory deductions (period-gated):** apply a contribution only when its `*_period_type` JSON includes the current cutoff-half (derive the half from `payroll_period.period_type` / the cutoff dates). Amounts come from `accountjob.sss_amount` / `philhealth_amount` / `ibig_amount`. Withholding tax uses the BIR table on **taxable income = `gross_pay − sss − philhealth − pagibig`** (per [HRMS Domain Rules §3](../../../rules/conditional/payroll.md)); `internal_revenue = 'Table-Based'` selects the table path.

**Step 4 — other deductions:** due loan amortizations + recurring entries from the **Payroll Entries** module (loans / recurring_entries) for this period.

**Step 5 — totals → NET:**

```text
total_deductions = late_deduction + undertime_deduction + absent_deduction
                 + sss + philhealth + pagibig + withholding_tax + loans + other_deductions
net_pay          = gross_pay − total_deductions
```

Persist every line item (columns) **and** the full itemization (`breakdown_json`) for the payslip drill-down.

> **Confirm during implementation (System Awareness scan):** the canonical source of the OT/holiday day-type **factors** and the **BIR withholding table**, and whether loan amortization is already computed by an existing Payroll Entries query. Reuse those rather than hardcoding — do not invent factor numbers. The one rate rule that is fixed by this spec: the daily-rate divisor is **`accountjob.daysmonth`**.

---

## 7. Frontend Design

Mirror [useTimesheetProcessing.ts](../../../resources/views/web/src/module/timekeeping/timesheet_processing/composables/useTimesheetProcessing.ts) and [TimesheetProcessing.vue](../../../resources/views/web/src/module/timekeeping/timesheet_processing/pages/TimesheetProcessing.vue) — same UX, payroll data.

### 7.1 API layer — `api/payroll_processing.api.ts`

Import the shared axios instance (`@/app/axios/axiosInstance` — it is NOT global). Endpoints use the `payroll` URL prefix:

```ts
import http from '@/app/axios/axiosInstance';

export function usePayrollProcessingApi() {
  return {
    getRoster: async (params = {}) => {
      const res = await http.get('api/payroll/payroll-processing/roster', { params });
      return res.data;
    },
    processPayroll: async (empIds: (string|number)[], period = {}) => {
      const res = await http.post('api/payroll/payroll-processing/process', { emp_ids: empIds, period });
      return res.data;
    },
    getPeriodStatus: async (params = {}) => {
      const res = await http.get('api/payroll/payroll-processing/status', { params });
      return res.data;
    },
  };
}
```

### 7.2 Types — `types/types.payroll_processing.ts`

```ts
export interface PayrollProcessingItem {
  empid: string;
  fullname: string;
  position: string;
  unit: string;
  employee_type: string;
  status: number;
  // hours mirrored from timesheet_summary
  reg_hrs: number; worked_hrs: number; ot_hrs: number;
  late_hrs: number; ut_hrs: number; leaves: number; absents: number;
  // rate preview from accountjob (null when no accountjob)
  salary: number | null;
  daily_rate: number | null;
  // computed payroll figures (null until processed)
  gross_pay: number | null;
  total_deductions: number | null;
  net_pay: number | null;
  payroll_status: 'No Timesheet' | 'No Rate' | 'Pending' | 'Processed' | 'Closed';
  last_processed: string | null;
  leave_breakdown: LeaveBreakdownRow[];
  [key: string]: any; // detailed breakdown columns h_*/ot_*/np_*/npot_*/adj_*
}

export interface LeaveBreakdownRow {
  idleave: number | null; leave_alias: string | null;
  leave_type: string | null; days: number; is_carryover: number;
}

export interface PayrollPeriod {
  id?: number | string;
  period_start: string; period_end: string;
  tk_process_status?: number; pay_process_status?: number;
  check_period_flag?: boolean;
  [key: string]: any;
}

export interface PayrollGates { tk_closed: boolean; pay_processed: boolean; }
```

### 7.3 Composable — `composables/usePayrollProcessing.ts`

Copy the structure of `useTimesheetProcessing` verbatim in shape, adapted:

- **State:** `employees`, `isLoading`, `period`, `selectedCutoffPeriod`, `gates` (`tk_closed`, `pay_processed`), `selectedEmpIds`.
- **Filters (reactive):** `searchQuery` (debounced 300ms via `@vueuse/core` `useDebounce`), `selectedDepartment`, `selectedEmployeeType`, `selectedStatus` (`'No Timesheet' | 'No Rate' | 'Pending' | 'Processed' | 'Closed'`). `watch` the filters + `perPage` to reset `currentPage = 1`.
- **Pagination (client-side):** `currentPage`, `perPage` (default 10). Computed `filteredEmployees`, `paginatedEmployees` (`slice((page-1)*perPage, ...)`), `totalPages` (`Math.ceil(len/perPage) || 1`), `paginationData` (`{from, to, total}`). Same as the timesheet composable — reuse the global `<Pagination>` component.
- **Derived sources:** `uniqueDepartments`, `uniqueEmployeeTypes` from the loaded set.
- **Stats (computed):** `{ total, withTimesheet, pending, processed, closed, totalGross, totalDeductions, totalNet }`.
- **Selection:** `isAllSelected` getter/setter — select only rows eligible to process (`payroll_status === 'Pending'`; exclude `No Timesheet`, `No Rate`, `Closed`).
- **Actions:**
  - `fetchRoster(params)` — GET roster; hydrate `employees`, `period`, `gates`; sync `?from&to` to the route query (same URL-driven period navigation as timesheet processing, incl. `onMounted` reading `route.query.from/to` and a `watch(route.query)` re-fetch).
  - `processSelected(empIds)` — batch in chunks of 10, drive `ProcessingProgressModal` (progress %, terminal log lines), POST each chunk, then `fetchRoster()` and clear selection. Copy the batching loop from `useTimesheetProcessing.processSelectedTimesheets`.
  - `resetFilters()`.
- Return the same surface the page binds to.

### 7.4 Page & components

- **`pages/regular_cycle/RegularCycle.vue`** — replace the placeholder. Root layout copies the timesheet page: `relative flex-1 flex flex-col p-4 md:p-6 lg:p-8 space-y-6 bg-slate-50/70 dark:bg-slate-950/40`, header component, then a rounded card (`bg-white/90 dark:bg-slate-800/90 rounded-3xl border ... shadow-sm p-4`) holding the filter bar + table + pagination.
- **`PayrollProcessingHeader.vue`** — page title, `VDatePicker` cutoff-period range (global component), prev/next period buttons, and stat cards (Total / With Timesheet / Pending / Processed / Total Gross / Total Net). Show a prominent **banner when `gates.tk_closed === false`**: "Timekeeping not yet closed for this period — payroll processing is disabled," disabling the Process buttons.
- **Filter bar** — search input (name/ID/position), `<c-select>` for Department, Employee Type, and Status (`No Timesheet / No Rate / Pending / Processed / Closed`); a Reset button shown only when filters are active. Match the exact Tailwind classes from `TimesheetProcessing.vue` lines 5–45.
- **`PayrollProcessingTable.vue`** — columns: checkbox (select), Employee (name + empid + position), Department, hours summary (Reg/OT/Late/UT/Leaves/Absent), Daily Rate, **Gross Pay, Deductions, Net Pay** (peso-formatted via `formatCurrency`), `payroll_status` via global `<StatusBadge>`, last processed, row action (view payslip breakdown). Use global `<Pagination>`, `<TableSkeleton>` while `isLoading`, `<EmptyState>` when empty.
- **`PayslipBreakdownModal.vue`** (row "view breakdown") — imported `Modal`, renders the full computed payslip from `payroll_run_detail` / `breakdown_json`: earnings section (basic, OT, night diff, holiday, leave, adjustments → **gross**), deductions section (late, undertime, absent, SSS, PhilHealth, Pag-IBIG, withholding tax, loans, other → **total deductions**), and **net pay**. Design-first: seed with hard-coded values.
- **Action buttons** (header/toolbar): **Process All (n)** (all `Pending`), **Process Selected (n)**, both disabled when `!gates.tk_closed` or count 0. Confirm via `ProcessConfirmModal.vue`; run via `ProcessingProgressModal.vue` (batched terminal, copy from timesheet `ProcessingProgressModal.vue`).
- Use only globally-registered components without import (`CSelect`, `Pagination`, `Spinner`, `Loading`, `VDatePicker`, `StatusBadge`, `EmptyState`, `TableSkeleton`); import `Modal` from `@/src/components/Modal.vue`.

### 7.5 Barrel — `index.ts`

```ts
export { usePayrollProcessing } from './composables/usePayrollProcessing';
export { usePayrollProcessingApi } from './api/payroll_processing.api';
export { default as payrollProcessingRoutes } from './route/payroll_processing.routes';
```

---

## 8. Filtering, Pagination & Sorting (requirement recap)

- **Filter:** free-text search (name / empid / position), Department, Employee Type, Payroll Status — all client-side over the loaded period set, search debounced 300ms. Filters reset the page to 1.
- **Pagination:** client-side, `perPage` selectable (default 10), via the global `<Pagination>` + `paginationData` `{from, to, total}` — identical mechanics to Timesheet Processing.
- **Sorting:** optional — allow column-header sort on name / gross / status in the table component (client-side comparator); not required for v1.
- **Period navigation:** period is the primary axis — `VDatePicker` range + prev/next, URL-synced (`?from&to`), re-fetch on change.

---

## 9. Edge Cases & Rules

1. **Period not closed in timekeeping** (`tk_process_status != 1`): roster still loads (read-only review), but Process is blocked with a banner. Handler also hard-blocks.
2. **Employee with no `timesheet_summary` row:** shown as `No Timesheet`, not selectable, skipped by the handler (`skipped_no_timesheet`).
3. **Employee with no `accountjob` / no `salary`:** shown as `No Rate`, not selectable, skipped by the handler (`skipped_no_accountjob`) — cannot derive a daily rate. Surface a hint to set up compensation.
4. **`daysmonth` missing/zero on the row:** fall back to the column default `26.0833`; never divide by zero.
5. **Statutory contribution on the wrong cutoff-half:** a contribution whose `*_period_type` does not include the current half is **not** deducted this cutoff (semi-monthly split). Verify the half-derivation against `payroll_period`.
6. **Reprocessing:** processing is idempotent — re-running upserts `payroll_run_detail` and recomputes gross→net. Allowed while `pay_process_status = 0`.
7. **Already-closed payroll** (`pay_process_status = 1`): Process blocked; rows read-only as `Closed`. Requires a separate reverse/unlock action.
8. **Zero-hours employee** (all hours 0 but summary + rate exist): processes to a line with ₱0 gross (and any fixed statutory still applies) — do not skip; absence handling belongs to attendance, not payroll suppression.
9. **Concurrency:** wrap writes in `DB::transaction`; unique `(idpayrun, idacct)` prevents duplicate payslip lines under retry.
10. **Currency formatting:** use `@/src/utils/currency` (`formatCurrency`) for all peso displays.

---

## 10. Security & Performance

- Endpoints sit inside the existing `auth:sanctum` group. Payroll processing is a privileged action — gate the routes/UI to payroll-officer roles per the project's existing authorization approach.
- Bulk-load summaries and leaves (`keyBy`/`groupBy`) — **no N+1** in the roster (retain the live `app_leave` fallback bulk-map from the timesheet roster).
- Batch processing in chunks of 10 from the frontend (matches timesheet processing) to keep each request bounded; server processes inside one transaction per chunk.
- Add `[PAYROLL-PROCESS]` timing/instrumentation logging mirroring `ProcessTimesheetsHandler`.

---

## 11. Testing (per [.agents/rules/conditional/testing.md](../../../rules/conditional/testing.md))

- **PHPUnit** — the money math is critical calculation coverage:
  - `GetPayrollProcessingRosterQuery`: gate flags, `payroll_status` derivation (incl. `No Timesheet` / `No Rate`), hours copied correctly, `daily_rate` preview, employees with/without summaries and with/without `accountjob`.
  - `ProcessPayrollHandler`: blocks when `tk_process_status != 1`; blocks when `pay_process_status == 1`; skips no-timesheet and no-accountjob employees; idempotent upsert; transaction rollback on failure.
  - **Compute chain (highest priority):** `daily_rate = salary / accountjob.daysmonth` (incl. the `26.0833` fallback and no divide-by-zero); gross = Σ earnings; each attendance deduction respects its `accountjob` flag; statutory amounts apply only on the matching cutoff-half; taxable income = gross − SSS − PhilHealth − Pag-IBIG; `net_pay = gross − total_deductions`. Assert against known fixtures end-to-end.
- **Vitest** — `usePayrollProcessing`: filter + pagination computeds, `isAllSelected` excludes ineligible rows (`No Timesheet`/`No Rate`/`Closed`), batching splits into chunks of 10, page resets on filter change, `totalGross`/`totalNet` stats.

---

## 12. Build Order (design-first)

Per the design-first flow ([AGENTS.md](../../AGENTS.md)), the **frontend hard-coded design comes first for review**, then the backend adds dynamic data.

**Gate 1 — `webkit.frontend-implement` (hard-coded, for design review):**
1. Frontend `types/` + `api/payroll_processing.api.ts` returning **hard-coded** roster + payslip data (real field names from §3/§6/§7; seed rows covering every status and a full gross→deductions→net payslip).
2. Composable + page + components (header, table, `PayslipBreakdownModal`, confirm/progress modals); replace the `RegularCycle.vue` placeholder.
3. **Review the design against this spec** — confirm columns, the gross→deductions→net breakdown, filters, pagination, statuses. Adjust here before any backend work.

**Gate 2 — `webkit.backend-implement` (add dynamic data):**

1. Migrations + models: `payroll_run`, `payroll_run_detail`.
2. `GetPayrollProcessingRosterQuery` (joins `timesheet_summary` + `accountjob`) + controller `roster` + route.
3. `ProcessPayrollHandler` with the full **§6.3 compute chain** (rate from `accountjob.daysmonth` → gross → deductions → net) + controller `process` + route.
4. Swap the hard-coded `api/payroll_processing.api.ts` methods for live `http` calls (same shape).
5. Tests — PHPUnit compute-chain coverage first (§11), then Vitest.

> Run the System Awareness scan for the exact OT/holiday **factor source** and **BIR withholding table** before writing §6.3. The daily-rate divisor is fixed by this spec: **`accountjob.daysmonth`**.
