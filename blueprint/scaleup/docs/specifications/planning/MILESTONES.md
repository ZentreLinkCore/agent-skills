# Milestones Specification

## Purpose

The Milestones module allows organizations to define important checkpoints within goals, objectives, and strategic plans.

Its purpose is to break larger business outcomes into meaningful stages that can be tracked and evaluated.

---

## Overview

A Milestone represents a significant point of progress toward a larger business outcome.

Example:

```text
Goal:
Open New Branch

Milestones:
1. Secure Location
2. Complete Renovation
3. Hire Staff
4. Launch Branch
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

- Create milestone
- Assign owner
- Set deadline
- Track status
- Link milestone to goal or objective
- Complete milestone
- Archive milestone

### Future Scope

- Automated milestone updates
- Dependencies
- Milestone templates
- Progress forecasting

---

## Main Flow

```text
Create Milestone
    ↓
Assign Owner
    ↓
Set Deadline
    ↓
Track Progress
    ↓
Complete Milestone
```

---

## Milestone Information

Potential fields:

- Title
- Description
- Owner
- Start Date
- Deadline
- Status
- Related Goal
- Related Objective
- Priority

---

## Status

- Not Started
- In Progress
- Completed
- Overdue
- Cancelled
- Archived

---

## Rules

- Every milestone belongs to an organization.
- A milestone should be associated with a meaningful business target where applicable.
- Deadlines must be valid.
- Only authorized users may update milestone status.
- Completed milestones must remain traceable.
- Milestones may not be completed without satisfying required conditions where workflows are defined.

---

## Permissions

| Action | Owner | Admin | Manager | Member | Viewer |
| :--- | :---: | :---: | :---: | :---: | :---: |
| View Milestones | ✅ | ✅ | ✅ | Based on Permission | ✅/❌ |
| Create Milestone | ✅ | ✅ | ✅ | Based on Permission | ❌ |
| Edit Milestone | ✅ | ✅ | ✅ | Based on Permission | ❌ |
| Complete Milestone | ✅ | ✅ | ✅ | Based on Permission | ❌ |

---

## Notifications

- Milestone assigned
- Milestone approaching deadline
- Milestone completed
- Milestone overdue

---

## Success Criteria

Organizations should be able to break larger objectives into clear checkpoints and monitor meaningful progress toward completion.