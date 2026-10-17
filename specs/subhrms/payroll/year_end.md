# Spec — Year End (payroll processing cycle)

> **Kind:** Greenfield (page is a 4-line placeholder). Sibling cycle of Regular Cycle — reuses the processing infrastructure in [timesheet_summary.md](./timesheet_summary.md).
> **Portal:** Payroll. **Route:** `payroll/year-end` (`payroll_year_end`) — already registered → [year_end/YearEnd.vue](../../../resources/views/web/src/module/payroll/payroll_processing/pages/year_end/YearEnd.vue).
> **`payroll_run.cycle = 'year_end'`.**
> **Conventions:** [.agents/rules/project-gate.md](../../../rules/core/project-gate.md), [hrms-rules](../../../rules/conditional/payroll.md).

---

## 1. Purpose

**Year End** performs the **annual tax annualization** — reconciling each employee's year-to-date withholding tax against the tax actually due on their full-year taxable income, producing a **tax refund** (over-withheld) or **collectible** (under-withheld) that is posted in the final period as a `payroll_run` (`cycle='year_end'`). It is the basis for BIR year-end reporting (2316 / alphalist).

It reads the persisted YTD payroll data (`payroll_run_detail` across the year, and `YtdDetail`) — it does not recompute regular pay, only the **annualized tax adjustment**.

---

## 2. Data Flow (delta vs Regular Cycle)

```text
YTD taxable income (Σ gross − Σ non-taxable − Σ SSS/PhilHealth/Pag-IBIG)   +   YTD tax withheld
        │
        ▼
YEAR END  ── per employee:
          ──   annual_tax_due = BIR annual table on YTD taxable income
          ──   adjustment    = annual_tax_due − Σ tax_withheld_ytd
          ──   adjustment < 0 → REFUND (add to net) ; > 0 → COLLECTIBLE (deduct)
          ──►  payroll_run (cycle='year_end') / payroll_run_detail
          ──►  Payroll Closing → Payslip / BIR 2316 + alphalist
```

Sources: `payroll_run_detail` summed across the year (`payroll_period.year_end`) and/or the [YtdDetail](../../../app/Models/YtdDetail.php) model; the **BIR annual tax table** from Government Routines. Confirm the annual table source in the System Awareness scan — do not hardcode brackets.

---

## 3. Backend (reuse + delta)

- **Roster query (`cycle='year_end'`):** for a selected **year**, list active employees with their YTD taxable income, YTD tax withheld, computed annual tax due, and the **adjustment** (refund/collectible) + processed status against the `year_end` run. Reuse the YTD aggregation from [ytd_report.md](./ytd_report.md).
- **Process handler (`cycle='year_end'`) — dedicated `ProcessYearEndHandler`:** for each selected employee, `annual_tax_due = BIR_annual_table(ytd_taxable)`; `adjustment = annual_tax_due − ytd_tax_withheld`; upsert `payroll_run_detail` where `withholding_tax` carries the adjustment (negative = refund → increases net; positive = collectible → decreases net). Block when `pay_process_status = 1`.
- Routes: `api/payroll/year-end/{roster,process}` (or shared endpoints with `cycle='year_end'` + `year`).

---

## 4. Frontend (reuse the Regular Cycle page, year-scoped)

Mirror the Regular Cycle processing page ([timesheet_summary.md](./timesheet_summary.md) §7) with a **year** selector. Roster columns: Employee, YTD Taxable, YTD Tax Withheld, Annual Tax Due, **Adjustment** (Refund green / Collectible red), Resulting Net, status; select + **Process Selected / Process All** + batched progress + a **tax-annualization breakdown** drill-down. Stat cards: Headcount / Total Refunds / Total Collectibles. Cyan accent, valid tokens, dark mode.

---

## 5. Edge Cases, Testing & Build Order

- **Refund vs collectible sign:** negative adjustment increases net (refund); positive decreases net (collectible) — render clearly with color + sign.
- **Minimum-wage / tax-exempt employees:** zero adjustment; still listed for completeness.
- **Consistency with 2316/alphalist:** the annualized figures must match the BIR year-end reports (Government Routines) — same taxable/withheld source.
- **Mid-year hire/separation:** annualize on actual YTD only (separated employees are typically annualized at Final Pay — avoid double annualization).
- **Once per year:** the `year_end` run is unique per `(idpayperiod, cycle)` — anchor to the final period of the year.
- **Closed period:** block processing.
- **Testing:** PHPUnit — annual tax on YTD taxable, adjustment sign (refund/collectible), exempt = 0, once-per-year uniqueness, closed-period block. Vitest — year switch, roster, annualization breakdown, process flow.
- **Build order (design-first):** Gate 1 hard-coded design (year-scoped roster + breakdown) → Gate 2 `ProcessYearEndHandler` + roster query (YTD aggregation + BIR annual table) + routes, wire live. Depends on `payroll_run_detail`/`YtdDetail`, the YTD aggregation ([ytd_report.md](./ytd_report.md)), and the BIR annual tax table.
