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

---

## 2. Data Flow & Contract (read-only)

```text
payroll_run_detail.basic_pay ──(join)── payroll_run ── payroll_period (year_end = :year, monthly grouping)
        │                        accountjob.hdate (hire) / employee status (separation) → months worked
        ▼
13TH MONTH PRO-RATE  ──►  per employee: total_basic (YTD), months_worked, thirteenth_month = total_basic / 12
                      ──►  totals footer, export
```

Sources:
- **`payroll_run_detail.basic_pay`** summed across the year's periods (join `payroll_run` → `payroll_period` filtered by `year_end`). Basic only — exclude OT/allowances/holiday premium (13th month is on **basic**).
- **`accountjob.hdate`** (hire date) and employee status for months-worked display and to bound the range.
- **`vw_accounts_details`** for employee display.

> **Confirm in the System Awareness scan:** whether "basic salary" for 13th month should come from `payroll_run_detail.basic_pay` (actual earned) or `accountjob.salary × months` — the statutory basis is **actual basic earned**, so default to summing `basic_pay`. Flag if the company policy differs (e.g. includes fixed allowances).

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

Extends `App\Domain\Queries\Query`, static `execute($params = [])`. Params: `year` (default current), optional `search`/`unit`. Steps:
1. Resolve `year`; collect `payroll_period` ids for `year_end = year`.
2. Bulk-load `payroll_run_detail` for those periods joined to `vw_accounts_details` + `accountjob`, grouped by `idacct`.
3. Per employee: `total_basic = Σ basic_pay`; `months_worked` = distinct months with basic (or from `hdate`→year-end); `thirteenth_month = round(total_basic / 12, 2)`.
4. `totals` across the set (headcount, Σ total_basic, Σ thirteenth_month).
5. Return `{ year, years, employees: [{ empid, fullname, unit, hire_date, months_worked, total_basic, thirteenth_month }], totals, count }`.

Bulk queries, no N+1.

---

## 5. Frontend Design

- **Header** — title + **year** select + stat cards (Headcount / Total Basic YTD / Total 13th-Month Liability) + **Export** (CSV/print).
- **Table** — Employee, Hire Date, Months Worked, **Total Basic (YTD)**, **13th Month (÷12)** (emphasized), row action → per-month basic breakdown (optional). Peso via `formatCurrency`; totals footer. Global `<Pagination>` (client-side), `<TableSkeleton>`, `<EmptyState>`.
- **Filters:** search (name/empid), department — client-side, debounced; year is the primary axis and re-fetches.
- Composable mirrors [ytd_report.md](./ytd_report.md) §5.

---

## 6. Edge Cases, Testing & Build Order

- **Mid-year hire/separation:** fewer months of basic → smaller numerator; `months_worked` shows the transparency. No manual proration factor needed.
- **Basic-only rule:** exclude OT/allowances/holiday/night-diff from the numerator — only `basic_pay`.
- **No data for the year:** empty state, zero totals.
- **Relationship to the 13th-Month Pay run:** this is a **projection/review** report; the actual disbursement is the `payroll_processing/13thmonth_pay` run — keep them consistent (same basic source).
- **Testing:** PHPUnit — `total_basic` sums basic only; `÷12` rounding; mid-year hire yields correct smaller amount; `year` filter; totals. Vitest — year switch, filter/pagination, export.
- **Build order (design-first):** Gate 1 hard-coded design for review → Gate 2 `GetThirteenthMonthProRateQuery` + controller + route, swap api to live. Depends on `payroll_run_detail` ([timesheet_summary.md](./timesheet_summary.md)).
