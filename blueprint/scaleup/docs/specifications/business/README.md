# Business Specifications

Business specifications cover the operational and analytical capabilities available inside the Organization Workspace once a subscription is active.

## Scope

- **Business Dashboard** — the consolidated view of business performance and activity.
- **Business Management** — core operational tools for running the business.
- **Sales, Expenses & Transactions** — financial activity tracking.
- **Reports** — structured reporting across business activity.
- **Analytics** — data-driven insight into performance and trends.
- **Business Planning** — deliberate planning of business direction.
- **Goals & KPIs** — defining and tracking measurable business objectives.

## Design Constraint

Everything in this scope requires an active Organization subscription. These capabilities should be designed to compound with each other — a Report should be able to draw from Analytics, Analytics from Financial Management, and so on — rather than existing as isolated tools.

See [PLATFORM_ARCHITECTURE.md](../../PLATFORM_ARCHITECTURE.md) for how these modules compose the Organization Workspace.
