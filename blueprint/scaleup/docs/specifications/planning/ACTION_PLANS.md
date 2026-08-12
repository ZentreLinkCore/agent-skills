# Action Plans Specification

## Purpose

The Action Plans module allows organizations to define concrete actions required to achieve goals, objectives, and strategic priorities.

Its purpose is to turn planning into execution by assigning responsibilities, deadlines, and measurable activities.

---

## Overview

An Action Plan contains one or more actionable tasks associated with a business goal, objective, milestone, or strategic plan.

Example:

```text
Goal:
Increase Monthly Revenue by 20%

Action Plan:
1. Launch New Campaign
2. Contact Existing Customers
3. Introduce New Product Bundle
4. Review Weekly Sales Results
```

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

- Create action plans
- Create actions
- Assign responsibility
- Set deadlines
- Track status
- Add notes
- Link to goals and milestones
- Complete actions

### Future Scope

- Task dependencies
- Recurring actions
- Automated task generation
- Integrations with project management tools
- AI-generated action plans

---

## Main Flow

```text
Define Goal / Objective
    ↓
Create Action Plan
    ↓
Define Actions
    ↓
Assign Owners
    ↓
Set Deadlines
    ↓
Execute Actions
    ↓
Track Completion
```

---

## Action Information

Potential fields:

- Action Title
- Description
- Owner
- Priority
- Start Date
- Deadline
- Status
- Related Goal
- Related Milestone
- Notes

---

## Action Status

- Not Started
- In Progress
- Completed
- Blocked
- Cancelled
- Overdue

---

## Rules

- Every action belongs to an organization.
- Each action should have a responsible user where applicable.
- Deadlines must be valid.
- Users may only modify actions they are authorized to manage.
- Completed actions must remain traceable.
- An action may be blocked when a required dependency is incomplete.

---

## Permissions

| Action | Owner | Admin | Manager | Accountant | Member | Viewer |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| View Actions | ✅ | ✅ | ✅ | ✅ | Based on Permission | ✅/❌ |
| Create Action | ✅ | ✅ | ✅ | ❌ | Based on Permission | ❌ |
| Edit Action | ✅ | ✅ | ✅ | ❌ | Based on Permission | ❌ |
| Complete Action | ✅ | ✅ | ✅ | ❌ | Based on Permission | ❌ |
| Assign Action | ✅ | ✅ | ✅ | ❌ | Based on Permission | ❌ |

---

## Notifications

- Action assigned
- Action deadline reminder
- Action overdue
- Action completed
- Action blocked

---

## Edge Cases

- Assigned user leaves organization.
- Action deadline passes.
- Related goal is cancelled.
- Action is blocked by incomplete milestone.
- User loses permission after assignment.

---

## Success Criteria

Organizations should be able to turn strategic plans and business goals into actionable work with clear ownership, deadlines, and measurable completion.
