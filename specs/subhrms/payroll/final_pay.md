# Spec — Final Pay (payroll processing cycle)

> **Kind:** Greenfield (page is a 4-line placeholder). Sibling cycle of Regular Cycle — reuses the processing infrastructure in [timesheet_summary.md](./timesheet_summary.md).
> **Portal:** Payroll. **Route:** `payroll/final-pay` (`payroll_final_pay`) — already registered → [final_pay/FinalPay.vue](../../../resources/views/web/src/module/payroll/payroll_processing/pages/final_pay/FinalPay.vue).
> **`payroll_run.cycle = 'final'`.**
> **Upstream:** the timekeeping **Final Pay Processing** module ([finalpay_processing/FinalPayProcessing.vue](../../../resources/views/web/src/module/timekeeping/finalpay_processing/pages/FinalPayProcessing.vue)) handles attendance/clearance validation for separating employees.
> **Conventions:** [.agents/rules/project-profile.md](../../rules/project-profile.md), [hrms-rules](../../rules/hrms-rules.md).

---

## 1. Purpose

**Final Pay** (last pay / back pay) computes the total amount owed to a **separating** employee (resigned / terminated / end-of-contract) and posts it as a `payroll_run` (`cycle='final'`). It consolidates the last worked salary, pro-rated 13th month, unused leave conversion, and any final adjustments, minus outstanding liabilities (loans, accountable items).

Timekeeping's Final Pay Processing validates attendance/clearance upstream; this payroll page performs the **monetary** computation and disbursement.

---

## 2. Data Flow (delta vs Regular Cycle)

```text
Separated employee (last day)  +  timekeeping final-pay validation (clearance, final attendance)
        │
        ▼
FINAL PAY  ── per employee, sum:
           ──   last-cutoff worked salary (unpaid days × daily rate)
           ──   pro-rated 13th month (Σ basic this year ÷ 12)
           ──   unused leave conversion (leave balance × daily rate)
           ──   final adjustments / separation pay (if any)
           ── minus  outstanding loan balances + accountabilities
           ── = FINAL NET PAY
           ──►  payroll_run (cycle='final') / payroll_run_detail
           ──►  Payroll Closing → Payslip (final)
```

Rate basis: `accountjob.daysmonth` daily rate ([timesheet_summary.md](./timesheet_summary.md) §6.3 Step 0). Loan balances from [loans.md](./loans.md) (`payroll_loan.balance`). Leave balance from the leave ledger. Tax on the taxable components per BIR.

**HR accountabilities feed (built):** the exit-clearance amounts flagged "With Accountability" flow in via [GetClearanceAccountabilitiesQuery](../../../app/Domain/Queries/hr/GetClearanceAccountabilitiesQuery.php) (`{ total, items:[{area, description, amount}] }`, sourced from `employee_clearance`) — HR records them, Payroll subtracts them (no double entry). Already surfaced in the TK Final Pay Processing endorsement view (`payroll.outstandingAdjustments` + `accountabilitiesTotal`); the Payroll `ProcessFinalPayHandler` should call the same query for the deduction line.

---

## 3. Backend (reuse + delta)

- **Roster query (`cycle='final'`):** list employees flagged **separated / for final pay** (from the employee status + the timekeeping final-pay validation), with their computed components (last salary, 13th pro-rate, leave conversion, loan payoff) and processed status against the `final` run.
- **Process handler (`cycle='final'`) — dedicated `ProcessFinalPayHandler`:** for each selected employee, assemble the components above into `payroll_run_detail` — earnings (last salary + 13th + leave conversion + separation pay), deductions (remaining loan balances + tax + accountabilities), `net = earnings − deductions`. Mark linked loans paid/closed. Block when `pay_process_status = 1`.
- Routes: `api/payroll/final-pay/{roster,process}` (or shared endpoints with `cycle='final'`).
- **Post-process (closing + payslip) is cycle-aware:** on process, `ProcessFinalPayHandler` advances the HR `employee_separation.status → Completed`. The payslip layer takes a `cycle` param (default `'regular'`) — `GetPayslipRosterQuery`, `GetEmployeePayslipQuery`, and `ReleasePayslipsHandler` join `payroll_run` and scope details to that cycle's run, so **final payslips view/release independently of regular**. Final release is **period-independent**: gated on the final run being processed (`processed_at`), NOT on the regular period lock (`pay_process_status`). Payroll **Closing** stays regular-only (locks the `regular` run + period); it does not lock the `final` run. **Frontend:** the shared Payslip page has a **Cycle CSelect** (Regular / Final Pay) — `usePayrollPayslip` holds a `cycle` ref forwarded to roster/detail/release; switching to Final refetches the periods via `GetPayrollClosingPeriodsQuery` with `cycle='final'` (which lists only periods that have a **processed** final run, `payroll_run.processed_at`).

---

## 4. Frontend (reuse the Regular Cycle page + component drill-down)

Mirror the Regular Cycle processing page ([timesheet_summary.md](./timesheet_summary.md) §7), with a **final-pay breakdown** panel/modal itemizing each component. Roster columns: Employee, Last Day, Reason, Final Earnings, Deductions (loans/tax), **Final Net**, status; select + **Process Selected / Process All** + batched progress. Filters: search, department, separation reason. Optionally reuse the timekeeping [FinalPayProcessing](../../../resources/views/web/src/module/timekeeping/finalpay_processing/pages/FinalPayProcessing.vue) checklist/timeline components for the clearance view. Cyan accent, valid tokens, dark mode.

---

## 5. Edge Cases, Testing & Build Order

- **Clearance gate:** only process employees whose timekeeping final-pay validation/clearance is complete; block or warn otherwise.
- **Loan payoff:** deduct full outstanding `payroll_loan.balance`; mark loans closed on final pay.
- **Leave conversion:** convert only convertible/unused credits per policy ([hrms-rules](../../rules/hrms-rules.md)).
- **Negative net:** if liabilities exceed pay, surface a flagged negative result for HR review (do not silently zero).
- **13th pro-rate:** same basic source as [13th_month_pay.md](./13th_month_pay.md) — no double count if already disbursed.
- **Closed period:** block processing.
- **Testing:** PHPUnit — component assembly (last salary + 13th + leave − loans − tax), loan payoff/closure, negative-net flag, clearance gate, closed-period block. Vitest — roster + final-pay breakdown + process flow.
- **Build order (design-first):** Gate 1 hard-coded design (roster + component breakdown) → Gate 2 `ProcessFinalPayHandler` + roster query (separated employees, loan/leave sources) + routes, wire live. Depends on `payroll_run_detail`, [loans.md](./loans.md), the leave ledger, and the timekeeping final-pay validation.
