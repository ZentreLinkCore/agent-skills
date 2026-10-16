# Payroll, Timekeeping & Leave (HRMS domain)

**Applies only to projects with payroll and timekeeping (`<source-path>` (Vue)).** Business rules for attendance, leave, payroll computation, and portal separation. The user owns the government rate tables and policy values; the agent follows them and never invents a rate.

## 1. Attendance and late computation

- **Grace period**: 15 minutes. A log beyond it is late from the actual shift start, unless flexi-time is active.
- **Overtime**: pre-approved regular OT **125%**; rest days and special holidays **130%**; regular holidays **200%**.
- **Night differential**: **110%** of the standard rate between 10:00 PM and 6:00 AM.

## 2. Leave credits

- Track accruals (e.g. 1.25 credits / month). Block a request that exceeds the current balance unless it is marked unpaid.
- Credits locked by a request are restored when it is cancelled or rejected.
- Approval is two-step: Supervisor approval, then HR verification.

## 3. Payroll

- **Daily rate**: `Daily Wage = (Monthly Basic Salary × 12) / Factor Rate` (261 or 313 days).
- **Deductions**: SSS, PhilHealth, and Pag-IBIG match the standard tables.
- **Taxable income**: subtract SSS / PhilHealth / Pag-IBIG contributions **before** applying the BIR tax brackets.
- Reuse the existing period and timesheet logic (`App\Queries\PayPeriod\HandlePayPeriodQuery`) rather than re-deriving it ([system-awareness.md §4](./system-awareness.md#4-no-duplicate-logic)).
- Every formula change gets a unit test with boundary values ([testing.md](./testing.md)), and the formula is checked against this file first.

## 4. Portal separation and audit

- Restrict queries and UI strictly by the active portal (Employee, Manager, HR, Timekeeping, Payroll, Admin). Never expose payroll details to the employee portal; managers never alter configuration. Controllers enforce it from the portal prefix.
- Log every edit to payroll records and attendance adjustments.
