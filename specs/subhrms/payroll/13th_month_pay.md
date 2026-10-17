# Spec — 13th Month Pay (payroll processing cycle)

> **Kind:** Greenfield (page is a 4-line placeholder). Sibling cycle of Regular Cycle — reuses the processing infrastructure in [timesheet_summary.md](./timesheet_summary.md).
> **Portal:** Payroll. **Routes:** `payroll/13th-month-pay` (`payroll_13th_month_pay`, summary roster + processing actions) and `payroll/13th-month-details` (`payroll_13th_month_details`, full per-employee breakdown) — see §4.
> **`payroll_run.cycle = '13th'`.**
> **Computation source:** [13th_month_pro_rate.md](./13th_month_pro_rate.md) (the review report).
> **Conventions:** [.agents/rules/project-gate.md](../../../rules/core/project-gate.md), [hrms-rules](../../../rules/conditional/payroll.md).

---

## 1. Purpose

**13th Month Pay** is the annual statutory disbursement run. It **computes** each employee's 13th-month pay and posts it as an actual payroll run (`cycle='13th'`) that flows to Closing and Payslip. The computation is the same one the [13th Month Pro-rate report](./13th_month_pro_rate.md) previews:

```text
13th Month Pay = (Σ BASIC salary earned Jan–Dec) ÷ 12     (pro-rated naturally by months worked)
```

This page is where payroll **reviews the computed amounts and disburses** them (the report is read-only; this writes the run).

---

## 2. Data Flow (delta vs Regular Cycle)

```text
payroll_run_detail.basic_pay across the year (year_end)       ──►  Pro Rate
payroll_run_detail.absent_deduction across the year             ──►  Absent Amount
payroll_run_detail.undertime_deduction across the year          ──►  Undertime Amount
payroll_run_detail.late_deduction across the year                ──►  Late Amount
accountjob.salary × 12                                            ──►  Basic Rate (full annual rate)
HR-entered manual adjustment                                       ──►  Retro (default 0)

Total Annual Salary = Pro Rate + Retro − Absent Amount − Undertime Amount − Late Amount
Gross Amount         = Total Annual Salary ÷ 12
Non-Taxable          = min(Gross Amount, ₱90,000 statutory exemption)
Taxable              = max(0, Gross Amount − ₱90,000)
Withholding Tax       = Taxable × 12%
Net Pay              = Gross Amount − Withholding Tax
        ▼
13TH MONTH PAY  ──►  payroll_run (cycle='13th') / payroll_run_detail
                     (basic_pay/gross_pay = Gross Amount, absent_deduction = Absent Amount,
                      undertime_deduction = Undertime Amount, late_deduction = Late Amount,
                      adjustments = Retro, withholding_tax/total_deductions = tax, net_pay = Net Pay)
                ──►  Payroll Closing → Payslip
```

- **Pro Rate = actual basic earned** (sum `basic_pay` across the year's processed regular-cycle runs), consistent with the pro-rate report — do not include OT/allowances.
- **Absent Amount / Undertime Amount / Late Amount** = sum of `absent_deduction` / `undertime_deduction` / `late_deduction` respectively, across the same regular-cycle runs this year. Each shown once, under the Deductions group — all three reduce the numerator.
- **Retro** has no automated derivation (no Domain class computes a peso amount from `salary_history`) — it is a **manual, HR-entered adjustment**, keyed by empid, defaulting to 0. This mirrors the existing `separation_pay` pattern in `ProcessFinalPayHandler` ("policy-driven; HR adjusts externally"). Persisted into the existing `adjustments` column on `payroll_run_detail` (unused for cycle `13th` otherwise).
- **Tax:** the first ₱90,000 of 13th-month + other benefits is tax-exempt (BIR); tax only the excess over Gross Amount (not over Pro Rate/Total Basic directly).
- No new migration/columns: Basic Rate, Pro Rate, Total Annual Salary, Non-Taxable, Taxable are derived values persisted into the existing `breakdown_json` column for audit trail.

---

## 3. Backend (reuse + delta)

- **Roster query (`cycle='13th'`):** `GetThirteenthMonthPayRosterQuery` — for a selected **year** (not a single cutoff), lists active + eligible employees with the full breakdown above (`basic_rate`, `pro_rate`, `retro`, `absent_amount`, `undertime_amount`, `late_amount`, `total_annual_salary`, `non_taxable`, `taxable`, `gross_amount`, `tax_on_excess`, `net_pay`) plus processed status against the `13th` run. Pending rows preview the formula with `retro = 0` (editable by HR before processing); processed rows show the persisted values.
- **Process handler (`cycle='13th'`):** `ProcessThirteenthMonthPayHandler` — accepts `emp_ids[]`, `year`, and `retro` (map of `empid => amount`). Upserts one `payroll_run_detail` per selected employee per the formula above, under a `payroll_run` keyed to the year's `ThirteenthMonthPeriod` + `cycle='13th'`.
- Routes: `api/payroll/13th-month/{roster,process,years}` (`PayrollProcessingController::thirteenthMonthRoster/processThirteenthMonth/years`).

---

## 4. Frontend — split across two pages (Processing = summary, Details = full breakdown)

Mirrors how **Final Pay** and **Regular Cycle** keep their processing roster lean (Employee, a couple of key amounts, Status, Actions) — the full computation drill-down lives elsewhere (a modal for those two cycles). 13th Month's breakdown has too many columns for a modal, so it gets its own page instead.

**Processing page** — `payroll/13th-month-pay` (`payroll_13th_month_pay`) → [13thMonthPay.vue](../../../resources/views/web/src/module/payroll/payroll_processing/pages/13thmonth_pay/13thMonthPay.vue), table: [ThirteenthMonthRosterTable.vue](../../../resources/views/web/src/module/payroll/payroll_processing/components/ThirteenthMonthRosterTable.vue).

- Summary columns only: Employee, Hire Date, Months Worked, 13th Month (Gross), Deductions (withholding tax), Net Pay, Status, Actions.
- Actions: **Process** (single, Pending rows) and **View Details** (navigates to the Details page, passing `?empid=` so it opens pre-filtered to that employee).
- Select + **Process Selected / Process All** + batched progress. Retro is NOT editable here — bulk/selected processing always uses `retro = 0` unless it was already set via the Details page.
- Header has a "Full Details View" link to the Details page (no employee filter).

**Details page** — `payroll/13th-month-details` (`payroll_13th_month_details`) → [13thMonthDetails.vue](../../../resources/views/web/src/module/payroll/payroll_processing/pages/13thmonth_pay/13thMonthDetails.vue), table: [ThirteenthMonthDetailsTable.vue](../../../resources/views/web/src/module/payroll/payroll_processing/components/ThirteenthMonthDetailsTable.vue).

- Full grouped-header breakdown table matching the payroll template:
  - **Annual Rate:** Basic Rate, Pro Rate
  - **Adjustment:** Retro (editable input, Pending rows only — this is the ONLY place Retro is set)
  - **Deductions:** Absent Amount, Undertime Amount, Late Amount
  - **13th Month Pay:** Total Annual Salary, Applicable Months, Non-Taxable, Taxable, Gross Amount, Withholding Tax, Net Pay
- Plus Employee, Hire Date, Status, Actions (Process single/selected/all — same as Processing, so HR can tweak Retro and process from here directly).
- "Back to Processing" link in the header.

Both pages independently call `use13thMonthPay()` and fetch their own roster on mount — no shared cross-page reactive state (Pinia) needed; navigating between them is a normal full-page transition that refetches current server state. Stat cards (Headcount / Total 13th-Month / Total Net) and year selector are duplicated on both pages, consistent with how Final Pay/Regular Cycle/etc. are each fully self-contained pages in this module.

---

## 5. Edge Cases, Testing & Build Order

- **Consistency with the pro-rate report:** the disbursed amount must equal the report's computed amount (same `basic_pay` source) — no drift.
- **Mid-year hire/separation:** fewer months of basic → smaller amount, naturally.
- **Tax exemption:** apply the statutory tax-exempt ceiling; tax only the excess.
- **Overlap with Bonus/Special:** if a 13th-month was already entered via [bonus_special.md](./bonus_special.md), warn to avoid double-payment.
- **Once per year:** the `13th` run is unique per `(idpayperiod, cycle)` — anchor it to a single disbursement period per year.
- **Testing:** PHPUnit — `Σ basic ÷ 12`, exemption/tax on excess, mid-year proration, disbursement matches report, closed-period block. Vitest — year switch, roster, process flow.
- **Build order (design-first):** Gate 1 hard-coded design (year-scoped roster) → Gate 2 reuse/extend the 13th-month computation + process handler (`cycle='13th'`), wire live. Depends on `payroll_run_detail` + the pro-rate computation ([13th_month_pro_rate.md](./13th_month_pro_rate.md)).
