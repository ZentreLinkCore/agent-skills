# Budgets Specification

## Purpose

The Budgets module allows organizations to plan expected income and expenses for defined periods.

Its purpose is to support financial planning by comparing planned amounts with actual business performance.

---

## Overview

A Budget represents a financial plan for an organization over a defined period.

Budgets may include:

- Expected Revenue
- Planned Expenses
- Categories
- Department or Area
- Monthly Targets
- Annual Targets

---

## Actors

- Organization Owner
- Organization Administrator
- Organization Manager
- Organization Member
- Organization Viewer

---

## Scope

### In Scope

- Create budget
- Define budget period
- Set planned revenue
- Set planned expenses
- Categorize budget items
- Compare budget vs actual
- Track budget usage
- Archive budgets

### Future Scope

- Budget templates
- Automated forecasting
- Department budgets
- Approval workflows
- Scenario budgets
- AI budget recommendations

---

## Main Flow

```text
Create Budget
    ↓
Define Period
    ↓
Set Planned Amounts
    ↓
Save Budget
    ↓
Record Actual Business Activity
    ↓
Compare Planned vs Actual
```

---

## Budget Information

Potential fields:

- Budget Name
- Budget Period
- Category
- Planned Amount
- Actual Amount
- Variance
- Owner
- Status

---

## Budget Status

- Draft
- Active
- Closed
- Archived

---

## Rules

- Every budget belongs to an organization.
- Budget periods must be valid.
- Planned values must use the organization's configured currency.
- Actual amounts should be derived from relevant business records where supported.
- Historical budgets must remain traceable.
- Only authorized users may modify budgets.

---

## Budget vs Actual

The platform should support comparison between planned and actual values.

Example:

```text
Marketing Budget

Planned: ₱100,000
Actual: ₱82,000
Variance: ₱18,000
```

---

## Permissions

| Action | Owner | Admin | Manager | Member | Viewer |
| :--- | :---: | :---: | :---: | :---: | :---: |
| View Budgets | ✅ | ✅ | ✅ | Based on Permission | ✅/❌ |
| Create Budget | ✅ | ✅ | ✅ | Based on Permission | ❌ |
| Edit Budget | ✅ | ✅ | ✅ | Based on Permission | ❌ |
| Close Budget | ✅ | ✅ | Based on Permission | ❌ | ❌ |

---

## Notifications

- Budget approaching limit
- Budget exceeded
- Budget period ending
- Budget created or updated

---

## Edge Cases

- Actual spending exceeds planned amount.
- Budget period closes with incomplete data.
- Expense category changes.
- User loses budget permission.
- Subscription no longer includes advanced budgeting.

---

## Success Criteria

Organizations should be able to create financial plans, monitor spending against expectations, and use budget information to improve business decisions.