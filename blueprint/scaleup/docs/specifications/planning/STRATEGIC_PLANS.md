# Strategic Plans Specification

## Purpose

The Strategic Plans module allows organizations to define their long-term direction and organize major business priorities.

Its purpose is to connect the organization's vision with structured objectives, goals, KPIs, milestones, and action plans.

---

## Overview

A Strategic Plan represents a high-level plan for achieving specific business outcomes within a defined period.

A strategic plan may contain:

- Vision or direction
- Strategic priorities
- Objectives
- Goals
- KPIs
- Milestones
- Action Plans

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

- Create strategic plan
- Define strategic priorities
- Set planning period
- Link objectives
- Track overall progress
- Publish internal plan
- Archive plan

### Future Scope

- Strategy templates
- SWOT analysis
- Competitor analysis
- Scenario planning
- AI strategy recommendations

---

## Main Flow

```text
Create Strategic Plan
    ↓
Define Direction
    ↓
Set Strategic Priorities
    ↓
Create Objectives
    ↓
Define Goals and KPIs
    ↓
Set Milestones
    ↓
Create Action Plans
    ↓
Monitor Progress
```

---

## Strategic Plan Information

Potential fields:

- Plan Name
- Description
- Planning Period
- Vision
- Strategic Priorities
- Owner
- Status
- Objectives
- KPIs
- Milestones

---

## Plan Status

- Draft
- Active
- Completed
- Archived

---

## Rules

- Every strategic plan belongs to an organization.
- A strategic plan must have a defined planning period.
- Strategic priorities should be connected to measurable outcomes where possible.
- Objectives and goals must belong to the same organization.
- Only authorized users may modify strategic plans.
- Historical plans should remain available for reference.

---

## Relationships

```text
Strategic Plan
    ↓
Strategic Priorities
    ↓
Objectives
    ↓
Goals
    ↓
KPIs
    ↓
Milestones
    ↓
Action Plans
```

---

## Permissions

| Action | Owner | Admin | Manager | Member | Viewer |
| :--- | :---: | :---: | :---: | :---: | :---: |
| View Plan | ✅ | ✅ | ✅ | Based on Permission | ✅/❌ |
| Create Plan | ✅ | ✅ | ✅ | Based on Permission | ❌ |
| Edit Plan | ✅ | ✅ | ✅ | Based on Permission | ❌ |
| Archive Plan | ✅ | ✅ | Based on Permission | ❌ | ❌ |

---

## Success Criteria

Organizations should be able to transform their long-term business direction into an organized strategy that can be measured and executed over time.