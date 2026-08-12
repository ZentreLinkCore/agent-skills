# Business Dashboard Specification

## Purpose

The Business Dashboard provides organizations with a centralized overview of their current business condition and performance.

Its purpose is to help business owners and authorized members quickly understand what is happening in the business without reviewing individual records.

---

## Overview

The dashboard is the primary landing page of the Organization Workspace.

It aggregates information from business modules such as:

- Sales
- Expenses
- Transactions
- Goals
- KPIs
- Reports
- Business Insights

The dashboard is organization-specific.

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

- Business summary
- Revenue overview
- Expense overview
- Profit overview
- Transaction activity
- Business trends
- Goal progress
- KPI summary
- Recent activity
- Quick actions

### Future Scope

- AI business insights
- Forecasting
- Custom dashboards
- Personalized dashboards
- Advanced benchmarking
- Industry comparisons

---

## Main Flow

```text
Open Organization Workspace
        ↓
Verify Organization Context
        ↓
Load Dashboard Data
        ↓
Calculate / Retrieve Business Metrics
        ↓
Display Business Overview
        ↓
User Explores Detailed Modules
```

---

## Dashboard Sections

### Business Health

Provide a high-level indicator of current business performance.

Example:

```text
Business Health
91%
Healthy
```

The calculation methodology should be defined separately.

### Revenue

Show relevant revenue information.

Examples:

- Current Period Revenue
- Previous Period Revenue
- Revenue Growth
- Revenue Trend

### Expenses

Show:

- Current Period Expenses
- Previous Period Expenses
- Expense Change
- Major Expense Categories

### Profit

Show:

- Gross Profit where applicable
- Net Profit where applicable
- Profit Margin where supported
- Profit Trend

### Goals

Display:

- Active Goals
- Goal Progress
- Upcoming Deadlines
- Completed Goals

### KPIs

Display important organization-defined KPIs.

### Recent Activity

May include:

- New Sales
- New Expenses
- Updated Goals
- Team Activity
- Business Events

### Quick Actions

Examples:

- Record Sale
- Record Expense
- Add Customer
- Add Product
- Create Goal
- View Reports

---

## Rules

- Dashboard data must belong to the active organization.
- Metrics must reflect the organization's defined business rules.
- Users may only see information permitted by their role.
- Financial metrics must use consistent calculation rules.
- Dashboard values should clearly indicate the reporting period.
- Cached information must not present misleading stale data where freshness is critical.

---

## Date and Period Context

The dashboard should clearly identify the current reporting period.

Examples:

```text
August 1 – August 31, 2026
```

Users may be able to switch between:

- Today
- This Week
- This Month
- This Quarter
- This Year
- Custom Range

---

## Permissions

Dashboard visibility depends on organization membership and permissions.

Sensitive widgets may be restricted based on role or entitlement.

---

## Empty State

For a newly created organization:

```text
Your business dashboard is ready.

Start by recording your first sale or expense
to begin building your business insights.
```

---

## Error State

If dashboard data cannot be loaded:

- Clearly indicate that data is temporarily unavailable.
- Allow retry.
- Do not display incorrect or partially misleading totals.

---

## Performance Rules

- Dashboard loading should avoid unnecessary requests.
- Heavy analytics should be processed efficiently.
- Expensive calculations may use cached or precomputed results.
- Loading states should be presented for slow sections.

---

## Edge Cases

- Organization has no transactions.
- Organization has transactions but no sales.
- Organization has expenses but no revenue.
- User has limited access to financial data.
- Reporting period contains incomplete data.
- Dashboard data is temporarily unavailable.
- Organization subscription no longer provides advanced analytics.

---

## Success Criteria

The Business Dashboard should allow an authorized organization user to understand the business condition and identify important actions within a short period of time without navigating through multiple modules.
