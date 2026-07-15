# Spec — YTD Report (Year-to-Date payroll report)

> **Kind:** Greenfield read-only report (page is a 4-line placeholder). Reads persisted payroll history; mirrors [payroll_summary.md](./payroll_summary.md).
> **Portal:** Payroll. **Route:** `payroll/payroll-reports/ytd-report` (`payroll_payroll_reports_ytd_report`) — already registered → [ytd_report/YTDReport.vue](../../../resources/views/web/src/module/payroll/reports/pages/payroll_reports/ytd_report/YTDReport.vue).
> **Conventions:** [.agents/rules/project-profile.md](../../rules/project-profile.md) (Domain Query/Handler, no API Resources).

---

## 1. Purpose

The **YTD Report** shows each employee's **year-to-date** payroll totals — cumulative earnings, deductions, and net pay across all processed pay periods in a calendar year — with per-employee drill-down and period breakdown. Payroll and employees use it for tax reconciliation, loan/benefit verification, and annualization inputs.

It reads the persisted `payroll_run_detail` produced by Payroll Processing ([timesheet_summary.md](./timesheet_summary.md)); it computes **no new payroll**, only **aggregates** across the year.

---

## 2. Data Flow & Contract (read-only)

```text
payroll_run_detail ──(join)── payroll_run ──(join)── payroll_period (filter: year_end = :year)
        │
        ▼
YTD REPORT  ──►  per employee: Σ gross, Σ each deduction (SSS/PhilHealth/Pag-IBIG/tax/loans), Σ net
             ──►  per-period breakdown (drill-down), YTD totals footer, export
```

Source: `payroll_run_detail` (fields per [timesheet_summary.md](./timesheet_summary.md) §6.2) joined to `payroll_run` → `payroll_period` (filter by `year_end`), and `vw_accounts_details` for employee display. Only **processed** periods contribute; typically **closed** (`pay_process_status = 1`) periods are the reportable set (offer a toggle to include drafts).

---

## 3. Target Files

Frontend (fill the reserved page folder, self-contained sub-structure like the timekeeping report pages):
```
resources/views/web/src/module/payroll/reports/pages/payroll_reports/ytd_report/
├── index.ts
├── YTDReport.vue
├── api/ytd_report.api.ts            # useYtdReportApi()
├── composables/useYtdReport.ts      # year + filters + client pagination + export
├── types/types.ytd_report.ts
└── components/{YTDReportHeader.vue, YTDReportTable.vue}   # + reuse a breakdown modal
```

Backend (Domain pattern):
```
app/Domain/Queries/Payroll/GetYtdReportQuery.php        # NEW
app/Http/Controllers/payroll/PayrollReportsController.php # add method
routes/api.php → Route::get('/payroll-reports/ytd', [PayrollReportsController::class, 'ytd']);
```

---

## 4. Backend — `GetYtdReportQuery`

Extends `App\Domain\Queries\Query`, static `execute($params = [])`. Params: `year` (default current), plus optional `search`/`unit`. Steps:
1. Resolve the target `year`; list `payroll_period` ids where `year_end = year` (optionally only `pay_process_status = 1`).
2. Bulk-load `payroll_run_detail` for those periods, joined to `vw_accounts_details`, grouped by `idacct`.
3. Per employee, sum `gross_pay`, each deduction column, `total_deductions`, `net_pay`; keep a per-period array for drill-down.
4. Compute grand `totals` across the set.
5. Return `{ year, years: [...distinct year_end], employees: [...], totals, count }`.

Response mirrors [payroll_summary.md](./payroll_summary.md) §5.3 (add `year`/`years`). Bulk queries, no N+1.

---

## 5. Frontend Design

- **Header** — title + **year** select (from `years`) + stat cards (Headcount / YTD Gross / YTD Deductions / YTD Net) + **Export** (CSV/print).
- **Table** — Employee, YTD Gross, YTD SSS / PhilHealth / Pag-IBIG / Tax / Loans, YTD Total Deductions, **YTD Net**, row action → **breakdown modal** (per-period rows for the year). Peso via `formatCurrency`; wide table scrolls in its own `overflow-x-auto`. Totals footer from `totals`. Global `<Pagination>` (client-side), `<TableSkeleton>`, `<EmptyState>`.
- **Filters:** search (name/empid), department — client-side over the loaded year set (debounced); year is the primary axis and re-fetches. Totals reflect the filtered set (label when filtered).
- **Composable** mirrors [useTimesheetSummary](../../../resources/views/web/src/module/timekeeping/timesheet_reports/pages/timesheet_summary/composables/useTimesheetSummary.ts) (year instead of period range).

---

## 6. Edge Cases, Testing & Build Order

- **No processed data for the year:** empty state, zero totals.
- **Include-draft toggle:** default to closed periods only; document the toggle rather than silently mixing.
- **Mid-year hire / separation:** YTD naturally reflects only periods with details — no special handling.
- **Testing:** PHPUnit — `GetYtdReportQuery` sums per employee across a year, `year` filter, totals; empty year. Vitest — year switch refetch, filter+pagination, export contents.
- **Build order (design-first):** Gate 1 hard-coded design (header/table/breakdown) for review → Gate 2 `GetYtdReportQuery` + controller + route, swap api to live. Depends on `payroll_run_detail` ([timesheet_summary.md](./timesheet_summary.md)).
