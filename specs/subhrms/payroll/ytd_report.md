# Spec — YTD Report (Year-to-Date payroll report with BIR Tax Annualization)

> **Kind:** Greenfield read-only report page. Reads persisted payroll history; incorporates detailed BIR tax calculations.
> **Portal:** Payroll. **Route:** `payroll/payroll-reports/ytd-report` (`payroll_payroll_reports_ytd_report`) → [ytd_report/YTDReport.vue](../../../resources/views/web/src/module/payroll/reports/pages/payroll_reports/ytd_report/YTDReport.vue).
> **Conventions:** [.agents/rules/project-gate.md](../../../rules/core/project-gate.md) (Domain Query/Handler pattern, no API Resources).

---

## 1. Purpose

The **YTD Report** shows each employee's **year-to-date** payroll totals and detailed **BIR Tax Annualization** computation. This includes cumulative regular earnings, non-taxable benefits, exclusions, taxable current compensation, previous employer histories, and progressive tax calculations (under TRAIN Law) across a calendar year.

It reads the persisted `payroll_run_detail` produced by Payroll Processing, along with previous employer values stored in `ytd_details`. It computes **no new payroll**, only **aggregates** and executes annualization calculations for tax reconciliation.

---

## 2. Data Flow & Contract (read-only)

```text
payroll_run_detail ──(join)── payroll_run ──(join)── payroll_period (filter: year_end = :year)
        │
        ├──(left join)── ytd_details (previous employer details)
        ▼
YTD REPORT  ──►  Per employee: 30 columns mapping identity, earnings, non-taxable benefits,
                 exclusions, taxable current employer, previous employer, and BIR tax calculations.
```

### The 30 Report Columns:
1. **Identity & Grouping:** Payroll Group, Emp No, Employee Name, Department, Tax Status, Employment Type
2. **Gross Earnings:** Annual Gross Income
3. **Non-Taxable Benefits:** 13th Month & Other Benefits (90K limit), De Minimis, Salaries & Other Forms of Comp, Total Non-Taxable
4. **Exclusions:** Gov't Contributions (SSS + PhilHealth + Pag-IBIG) & Union Dues
5. **Taxable Current Employer:** Taxable Basic Salary, 13th Month & Other Benefits, Salaries & Other Compensation, Gross Taxable Amount
6. **Previous Employer Details:** Taxable Compensation, Non-Taxable, Additional Exclusion, 13th Month Exempt, De Minimis, Tax Withheld
7. **BIR Tax Annual Computation:** Taxable Net Income, Bracket Minimum, Excess over Minimum, Tax Rate (%), Tax on Excess, Fixed Tax, Tax Due, Current YTD Withholding Tax, Tax Refund, Tax Payable

---

## 3. Target Files

Frontend:
```
resources/views/web/src/module/payroll/reports/pages/payroll_reports/ytd_report/
├── index.ts
├── YTDReport.vue
├── api/ytd_report.api.ts            # useYtdReportApi() (Axios endpoints)
├── composables/useYtdReport.ts      # year + filters + client pagination + totals calculations
├── types/types.ytd_report.ts        # YtdEmployeeRow, YtdReportTotals, YtdReportResponse interfaces
└── components/
    ├── YTDReportHeader.vue          # Renders search, filter toolbar, and metrics
    ├── YTDReportTable.vue           # Grouped 2-tier horizontal scroll table with click-and-drag
    └── YTDBreakdownModal.vue        # Lists individual periodic paycheck breakdowns
```

Backend:
```
app/Queries/Payroll/GetYtdReportQuery.php                 # Core database query
app/Http/Controllers/payroll/PayrollReportsController.php # ytdReport endpoint
routes/api/payroll.php                                    # Route registration
```

---

## 4. Backend — `GetYtdReportQuery`

Extends `App\Queries\Query`, static `execute($params = [])`. Params: `year` (default current), `include_drafts` (bool), plus optional `search`/`department`. Steps:
1. Resolve the target `year` and years list.
2. Query employees (active plus historical employees with processed payrun rows in the selected year).
3. Gather YTD totals per employee from regular pay cycles.
4. Gather 13th Month Net Pays.
5. Gather Previous Employer values from `ytd_details`.
6. Load period-by-period paycheck breakdowns for modal drill-downs.
7. Compute progressive tax tables under the TRAIN Law (`GetYearEndRosterQuery::computeAnnualTax` progressive tax table).
8. Compute grand totals across the filtered set.
9. Return `{ year, years, employees, totals, count }`.

---

## 5. Frontend Design

- **Header Stat Cards:** Headcount, Annual Gross Income, Annual Tax Due, and Annual Refunds.
- **Grouped Table Headers:** Visual 2-tier table headers grouping columns into:
  - Employee Information
  - Earnings
  - Non-Taxable / Exempt Benefits
  - Exclusions
  - Taxable Current Compensation
  - Previous Employer Details
  - BIR Tax Annual Computation
- **Interaction:** Horizontal drag scrolling, year re-fetch, client-side pagination, and XLS spreadsheet downloads.

---

## 6. Edge Cases & Testing

- **Include-Draft Toggle:** Controls whether unfinalized/draft payroll runs are aggregated.
- **Progressive Tax Details:** Progressive computation details (bracket minimums, rates, fixed taxes) must calculate on the fly for both draft and processed runs to support preview and audit modes.
