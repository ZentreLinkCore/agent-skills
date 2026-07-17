# Spec — 13th Month Pro-rate (report)

> **Kind:** Greenfield read-only report (page is a 4-line placeholder). Reads persisted payroll history; mirrors [payroll_summary.md](./payroll_summary.md) / [ytd_report.md](./ytd_report.md).
> **Portal:** Payroll. **Route:** `payroll/payroll-reports/13th-month-pro-rate` (`payroll_payroll_reports_13th_month_pro_rate`) — already registered → [13th_month_pro_rate/13thMonthProRate.vue](../../../resources/views/web/src/module/payroll/reports/pages/payroll_reports/13th_month_pro_rate/13thMonthProRate.vue).
> **Conventions:** [.agents/rules/project-profile.md](../../rules/project-profile.md), [hrms-rules](../../rules/hrms-rules.md).

---

## 1. Purpose

The **13th Month Pro-rate** report computes each employee's statutory 13th-month pay for a calendar year, **pro-rated by months actually worked**. Per Philippine law:

```text
13th Month Pay = (Total BASIC salary earned Jan–Dec) ÷ 12
```

Pro-ration falls out naturally from summing only the basic pay the employee actually earned (a mid-year hire or separation simply has fewer months of basic in the numerator). The report shows the computation transparently (months worked, total basic, ÷12 result) so payroll can review before running the actual **13th Month Pay** payroll ([payroll_processing/pages/13thmonth_pay](../../../resources/views/web/src/module/payroll/payroll_processing/pages/13thmonth_pay/13thMonthPay.vue)).

It **reads** persisted `payroll_run_detail`; it computes a projection, it does not persist a payroll run.

**Independent of the processing run — pure monitoring.** A **13th Month Pay processing** feature already exists and is fully wired end-to-end, not a placeholder: `payroll_processing/13thmonth_pay` → `GetThirteenthMonthPayRosterQuery` / `ProcessThirteenthMonthPayHandler` (`app/Domain/Queries|Handlers/Payroll/`), gated by a dedicated `ThirteenthMonthPeriod` record (`payroll_13th_month_period` table, `pay_process_status` lock) and persisting to `payroll_run`/`payroll_run_detail` with `cycle = '13th'` (routes `GET /13th-month/roster`, `POST /13th-month/process`, `GET /13th-month/years` in `routes/api/payroll.php`). **This report must not depend on any of that.** It must not touch `ThirteenthMonthPeriod` (no `firstOrCreate`, no lock/gate check) and must not read the persisted `cycle='13th'` run. It always independently recomputes the pro-rated projection from **regular-cycle** payroll data, so it behaves identically whether the actual 13th-month run hasn't started yet, is mid-year, or has already been processed and closed — it's a standing monitoring view, not a step in the processing workflow.

**But it must reuse the same math.** Per [duplicate-prevention](../../rules/duplicate-prevention.md) (no duplicate calculation engines), the pro-ration formula must mirror the *preview branch* of `GetThirteenthMonthPayRosterQuery` verbatim: same `basic_pay` sum over regular-cycle `payroll_run_detail`, same salary×months-worked fallback when no regular-cycle data exists yet, same hire-date-based `months_worked` derivation (including the half-month deduction for hires after the 15th). Keep both formulas in lockstep if either changes — do not call that query directly (it carries the period side-effect and status gating this report must avoid); write an independent, read-only query that copies its calculation steps only.

---

## 2. Data Flow & Contract (read-only)

```text
payroll_run_detail.basic_pay ──(join, cycle='regular')── payroll_run ── payroll_period (year_end = :year)
        │                        accountjob.hdate (hire) / employee status (separation) → months worked
        ▼
13TH MONTH PRO-RATE  ──►  per employee: total_basic (YTD), months_worked, thirteenth_month = total_basic / 12
                      ──►  totals footer, export

  ✗ NOT sourced from: payroll_13th_month_period, or any payroll_run where cycle = '13th'
    (that's the processing run's own persisted output — this report never reads it)
```

Sources:

- **`payroll_run_detail.basic_pay`** summed across the year's **regular-cycle** periods only (join `payroll_run` where `cycle = 'regular'` → `payroll_period` filtered by `year_end`) — same filter `GetThirteenthMonthPayRosterQuery` uses for its preview calculation. Basic only — exclude OT/allowances/holiday premium (13th month is on **basic**).
- **Fallback**: if `total_basic <= 0` for an employee (no regular-cycle payroll processed yet this year) but they have a salary on `accountjob`, fall back to `salary × months_worked` — mirrors the processing query's fallback so the two never disagree.
- **`accountjob.hdate`** (hire date) and employee status for months-worked display and to bound the range. Mid-year hire: `months_worked = 12 - hire_month + 1`, minus `0.5` if hired after the 15th of that month; `0` if hired in a future year.
- **`vw_accounts_details`** for employee display.

Resolved (per the System Awareness scan of `GetThirteenthMonthPayRosterQuery`): "basic salary" for 13th month is `payroll_run_detail.basic_pay` (actual earned, regular cycle only), with the salary×months fallback above for employees not yet on a processed regular payroll this year. This matches the statutory basis (**actual basic earned**) and keeps this report numerically consistent with the processing feature without depending on it.

---

## 3. Target Files

Frontend (reserved page folder):
```
resources/views/web/src/module/payroll/reports/pages/payroll_reports/13th_month_pro_rate/
├── index.ts
├── 13thMonthProRate.vue
├── api/thirteenth_month.api.ts          # useThirteenthMonthApi()
├── composables/useThirteenthMonth.ts    # year + filters + client pagination + export
├── types/types.thirteenth_month.ts
└── components/{ThirteenthMonthHeader.vue, ThirteenthMonthTable.vue}
```

Backend (Domain pattern):
```
app/Domain/Queries/Payroll/GetThirteenthMonthProRateQuery.php  # NEW
app/Http/Controllers/payroll/PayrollReportsController.php       # add method
routes/api/payroll.php → Route::get('/payroll-reports/13th-month-pro-rate', [PayrollReportsController::class, 'thirteenthMonth']);
```

---

## 4. Backend — `GetThirteenthMonthProRateQuery`

Extends `App\Domain\Queries\Query`, static `execute($params = [])`. Params: `year` (default current), optional `search`/`unit`. **A separate, read-only query** — it must NOT call `GetThirteenthMonthPayRosterQuery` and must NOT touch `ThirteenthMonthPeriod`/`payroll_13th_month_period` or any `payroll_run` with `cycle = '13th'`. Steps (mirroring that query's preview-calculation branch only):

1. Resolve `year`. No period lookup, no `firstOrCreate`, no lock/gate check.
2. Bulk-load active employees (`vw_accounts_details`) + `accountjob` (hire date, salary) + `payroll_run_detail` summed `basic_pay`, grouped by `idacct`, joined through `payroll_run` **where `cycle = 'regular'`** → `payroll_period` where `year_end = year`.
3. Per employee:
   - `months_worked`: `12` by default; if `hdate.year === year`, `12 - hire_month + 1`, minus `0.5` if hired after the 15th; `0` if hired in a future year.
   - `total_basic = Σ basic_pay` (regular cycle only); if `<= 0` and the employee has a salary, fall back to `salary × months_worked`.
   - `thirteenth_month = round(total_basic / 12, 2)`.
4. `totals` across the set (headcount, Σ total_basic, Σ thirteenth_month).
5. Return `{ year, years, employees: [{ empid, fullname, unit, hire_date, months_worked, total_basic, thirteenth_month }], totals, count }`.

Bulk queries, no N+1. No writes, no side effects — safe to call at any point in the year regardless of processing status.

---

## 5. Frontend Design

- **Header** — title + **year** select + stat cards (Headcount / Total Basic YTD / Total 13th-Month Liability) + **Export** (CSV/print).
- **Table** — Employee, Hire Date, Months Worked, **Total Basic (YTD)**, **13th Month (÷12)** (emphasized), row action → per-month basic breakdown (optional). Peso via `formatCurrency`; totals footer. Global `<Pagination>` (client-side), `<TableSkeleton>`, `<EmptyState>`.
- **Filters:** search (name/empid), department — client-side, debounced; year is the primary axis and re-fetches.
- Composable mirrors [ytd_report.md](./ytd_report.md) §5.

---

## 6. Edge Cases, Testing & Build Order

- **Mid-year hire/separation:** fewer months of basic → smaller numerator; `months_worked` shows the transparency, including the half-month deduction for hires after the 15th (same rule as processing). No manual proration factor needed.
- **Basic-only rule:** exclude OT/allowances/holiday/night-diff from the numerator — only `basic_pay`, regular cycle only.
- **No regular-cycle data yet for a hire:** fall back to `salary × months_worked` (same fallback as processing) instead of showing zero.
- **No data for the year:** empty state, zero totals.
- **Relationship to the 13th-Month Pay processing run:** intentionally **decoupled** — this report never reads `ThirteenthMonthPeriod`, `pay_process_status`, or the persisted `cycle='13th'` run, and has no side effects, so it renders the same way whether the processing run hasn't started, is mid-year, or is already closed. It's a standing monitoring/projection view, not a step in that workflow. Consistency with the eventual disbursement comes from sharing the same computation formula (see §1, §4) — if `GetThirteenthMonthPayRosterQuery`'s formula changes, update this query to match.
- **Testing:** PHPUnit — `total_basic` sums basic (regular cycle) only; salary×months fallback; `÷12` rounding; mid-year hire (incl. half-month rule) yields correct smaller amount; `year` filter; totals; confirm no query touches `ThirteenthMonthPeriod` or `cycle='13th'` data. Vitest — year switch, filter/pagination, export.
- **Build order (design-first):** Gate 1 hard-coded design for review → Gate 2 `GetThirteenthMonthProRateQuery` + controller + route, swap api to live. Depends on `payroll_run_detail` ([timesheet_summary.md](./timesheet_summary.md)).
