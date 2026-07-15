# Spec — 13th Month Pay (payroll processing cycle)

> **Kind:** Greenfield (page is a 4-line placeholder). Sibling cycle of Regular Cycle — reuses the processing infrastructure in [timesheet_summary.md](./timesheet_summary.md).
> **Portal:** Payroll. **Route:** `payroll/13th-month-pay` (`payroll_13th_month_pay`) — already registered → [13thmonth_pay/13thMonthPay.vue](../../../resources/views/web/src/module/payroll/payroll_processing/pages/13thmonth_pay/13thMonthPay.vue).
> **`payroll_run.cycle = '13th'`.**
> **Computation source:** [13th_month_pro_rate.md](./13th_month_pro_rate.md) (the review report).
> **Conventions:** [.agents/rules/project-profile.md](../../rules/project-profile.md), [hrms-rules](../../rules/hrms-rules.md).

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
payroll_run_detail.basic_pay across the year (year_end)  ──►  13th-month per employee (Σ basic ÷ 12)
        │  minus tax on the taxable excess (> ₱90,000 statutory exemption)
        ▼
13TH MONTH PAY  ──►  payroll_run (cycle='13th') / payroll_run_detail (gross=13th, deductions=tax, net)
                ──►  Payroll Closing → Payslip
```

- **Numerator = actual basic earned** (sum `basic_pay` across the year's processed runs), consistent with the pro-rate report — do not include OT/allowances.
- **Tax:** the first ₱90,000 of 13th-month + other benefits is tax-exempt (BIR); tax only the excess. Confirm the exact threshold/basis in the System Awareness scan; don't hardcode a number the config already holds.

---

## 3. Backend (reuse + delta)

- **Roster query (`cycle='13th'`):** for a selected **year** (not a single cutoff), list active + eligible employees with their computed `total_basic`, `months_worked`, and `thirteenth_month` (reuse the logic in `GetThirteenthMonthProRateQuery` from [13th_month_pro_rate.md](./13th_month_pro_rate.md)) plus their processed status against the `13th` run.
- **Process handler (`cycle='13th'`):** upsert one `payroll_run_detail` per selected employee — `gross = thirteenth_month`, `withholding_tax = tax on excess over exemption`, `net = gross − tax`; under a `payroll_run` keyed to the disbursement period + `cycle='13th'`. Generalize the shared `ProcessPayrollHandler` `cycle` param, or add a dedicated `ProcessThirteenthMonthHandler` since the numerator is annual (not per-cutoff).
- Routes: `api/payroll/13th-month/{roster,process}` (or the shared processing endpoints with `cycle='13th'` + `year`).

---

## 4. Frontend (reuse the Regular Cycle page, year-scoped)

Mirror the Regular Cycle processing page ([timesheet_summary.md](./timesheet_summary.md) §7) with a **year** selector instead of a cutoff range. Roster table columns: Employee, Months Worked, Total Basic (YTD), **13th Month (÷12)**, Tax on Excess, **Net**, status; select + **Process Selected / Process All** + batched progress + payslip breakdown. Stat cards: Headcount / Total 13th-Month / Total Net. Cyan accent, valid tokens, dark mode.

---

## 5. Edge Cases, Testing & Build Order

- **Consistency with the pro-rate report:** the disbursed amount must equal the report's computed amount (same `basic_pay` source) — no drift.
- **Mid-year hire/separation:** fewer months of basic → smaller amount, naturally.
- **Tax exemption:** apply the statutory tax-exempt ceiling; tax only the excess.
- **Overlap with Bonus/Special:** if a 13th-month was already entered via [bonus_special.md](./bonus_special.md), warn to avoid double-payment.
- **Once per year:** the `13th` run is unique per `(idpayperiod, cycle)` — anchor it to a single disbursement period per year.
- **Testing:** PHPUnit — `Σ basic ÷ 12`, exemption/tax on excess, mid-year proration, disbursement matches report, closed-period block. Vitest — year switch, roster, process flow.
- **Build order (design-first):** Gate 1 hard-coded design (year-scoped roster) → Gate 2 reuse/extend the 13th-month computation + process handler (`cycle='13th'`), wire live. Depends on `payroll_run_detail` + the pro-rate computation ([13th_month_pro_rate.md](./13th_month_pro_rate.md)).
