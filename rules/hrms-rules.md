# HRMS Domain Rules

## Purpose
This document defines business workflows, payroll compliance calculations, timekeeping rules, and portal security restrictions for the Human Resource Management System (HRMS) domain.

## Scope
Applicable to all calculations, forms, databases, policies, and actions dealing with payroll processing, attendance logging, leave approvals, and employee records.

## Responsibilities
- **AI Agent**: Follows BIR tax schedules, SSS/PhilHealth/Pag-IBIG rules, late grace periods, and portal separation controls.
- **Developer/User**: Updates government rate tables, schedules, and policy rules.

## Actionable Rules
1. **Attendance & Late Computations**:
  - **Grace Period**: Standard grace period is 15 minutes. Logs beyond this are computed as late from the actual shift start (unless flexi-time is active).
  - **Overtime Rates**: Pre-approved regular OT (125%), rest days/special holidays (130%), and regular holidays (200%).
  - **Night Differential**: 110% of standard rates applied between 10:00 PM and 6:00 AM.
2. **Leave Credit Management**:
  - Track accruals (e.g. 1.25 credits/month). Block leave requests if current balances are exceeded, unless marked as unpaid.
  - Locked credits must be restored if a request is cancelled or rejected.
3. **Payroll Calculations**:
  - **Daily Rate Calculation**:
    `Daily Wage = (Monthly Basic Salary × 12) / Factor Rate (261 or 313 days)`
  - **Deductions**: SSS, PhilHealth, and Pag-IBIG must match standard tables.
  - **Taxable income**: Subtract SSS/PhilHealth/Pag-IBIG contributions before applying BIR tax brackets.
4. **Portal Separation Security**:
  - Restrict query access and UI components strictly according to the active portal (Employee, Manager, HR, Timekeeping, Payroll, Admin). Never expose payroll details to the employee portal or allow managers to alter configs.

## Best Practices
- **2-Step Leave Approvals**: Require Supervisor approval and HR verification for all leave actions.
- **Audit Trails**: Log any edits to payroll records or attendance adjustments.

## AI Behavior Expectations
- **Mathematical Accuracy**: Double-check all calculation algorithms using automated tests.
- **Access Guard Enforcement**: Validate that controllers restrict queries based on the portal prefix parameters.
