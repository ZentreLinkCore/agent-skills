# Goals Specification

## Purpose

The Goals module allows organizations to define measurable outcomes they want to achieve within a specific period.

Its purpose is to turn business intentions into measurable targets that can be assigned, tracked, and evaluated.

---

## Overview

A Goal represents a specific desired outcome for an organization.

A goal may be connected to:

- Strategic Plan
- Objective
- KPI
- Milestone
- Action Plan

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

- Create goals
- Edit goals
- Assign goal owners
- Set targets
- Set deadlines
- Track progress
- Update status
- Archive goals

### Future Scope

- Goal templates
- Automated goal recommendations
- AI-generated goals
- Goal forecasting
- Team goal hierarchies

---

## Main Flow

```text
Create Goal
    ↓
Define Target
    ↓
Assign Owner
    ↓
Set Deadline
    ↓
Track Progress
    ↓
Complete / Archive
```

---

## Goal Information

Potential fields:

- Goal Title
- Description
- Goal Type
- Target Value
- Current Value
- Unit
- Start Date
- Deadline
- Owner
- Priority
- Status
- Related Objective
- Related KPI

---

## Goal Types

Examples:

- Revenue Growth
- Expense Reduction
- Customer Growth
- Product Launch
- Branch Expansion
- Operational Improvement
- Employee Growth
- Custom

---

## Goal Status

```text
Draft
  ↓
Active
  ↓
Completed
```

Additional states:

- On Hold
- Overdue
- Cancelled
- Archived

---

## Rules

- Every goal belongs to an organization.
- Every active goal should have a target or measurable outcome.
- A goal may have an assigned owner.
- Deadline must not occur before the start date.
- Only authorized users may modify goals.
- Completed goals should retain historical information.
- Goal progress must use consistent calculation rules.

---

## Progress

Goals may support:

```text
Current Value
+
Target Value
=
Progress
```

Example:

```text
Revenue Target

Current: ₱350,000
Target: ₱500,000

Progress: 70%
```

---

## Permissions

| Action | Owner | Admin | Manager | Member | Viewer |
| :--- | :---: | :---: | :---: | :---: | :---: |
| View Goals | ✅ | ✅ | ✅ | Based on Permission | ✅/❌ |
| Create Goal | ✅ | ✅ | ✅ | Based on Permission | ❌ |
| Edit Goal | ✅ | ✅ | ✅ | Based on Permission | ❌ |
| Complete Goal | ✅ | ✅ | ✅ | Based on Permission | ❌ |
| Archive Goal | ✅ | ✅ | Based on Permission | ❌ | ❌ |

---

## Notifications

- Goal assigned
- Goal approaching deadline
- Goal completed
- Goal overdue
- Goal status changed

---

## Edge Cases

- Goal owner leaves organization.
- Goal deadline passes without completion.
- Related KPI is removed.
- Goal target changes after progress has been recorded.
- Organization subscription changes.

---

## Success Criteria

Organizations should be able to define meaningful targets, assign responsibility, measure progress, and evaluate whether business goals are being achieved.
