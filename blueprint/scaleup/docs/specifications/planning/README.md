# Planning Specifications

Planning specifications cover how organizations set direction, define measurable targets, allocate resources, and track execution inside the Organization Workspace. Planning is where a business decides what it intends to achieve; [business](../business/) records what it actually did.

---

## Specifications

| Document | Purpose |
| :--- | :--- |
| [PLANNING_OVERVIEW.md](./PLANNING_OVERVIEW.md) | The Business Planning domain and the principles shared by every module below |
| [STRATEGIC_PLANS.md](./STRATEGIC_PLANS.md) | Long-term direction and the organization of major business priorities |
| [OBJECTIVES.md](./OBJECTIVES.md) | The strategic outcomes an organization intends to achieve |
| [GOALS.md](./GOALS.md) | Measurable outcomes targeted within a specific period |
| [KPIS.md](./KPIS.md) | Key Performance Indicators that measure business performance |
| [MILESTONES.md](./MILESTONES.md) | Checkpoints within goals, objectives, and strategic plans |
| [ACTION_PLANS.md](./ACTION_PLANS.md) | The concrete actions required to achieve planned outcomes |
| [BUDGETS.md](./BUDGETS.md) | Planned income and expenses for defined periods |

---

## Design Constraint

Everything in this scope requires an active Organization subscription. Planning modules describe intent and targets — they must never be the system of record for actual business activity, which belongs in [specifications/business](../business/). Comparison between planned and actual values is the responsibility of [specifications/analytics](../analytics/).

See [PLATFORM_ARCHITECTURE.md](../../PLATFORM_ARCHITECTURE.md) for how planning fits into the Organization Workspace.
