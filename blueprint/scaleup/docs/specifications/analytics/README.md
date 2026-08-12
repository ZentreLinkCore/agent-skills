# Analytics Specifications

Analytics specifications cover how ScaleUP turns recorded business activity and planning data into information organizations can act on — dashboards, reports, insights, forecasts, and health indicators inside the Organization Workspace.

---

## Specifications

| Document | Purpose |
| :--- | :--- |
| [ANALYTICS_OVERVIEW.md](./ANALYTICS_OVERVIEW.md) | The Analytics & Reporting domain and the principles shared by every module below |
| [DASHBOARD.md](./DASHBOARD.md) | The visual summary of organization performance indicators |
| [REPORTS.md](./REPORTS.md) | Structured and exportable representations of business information |
| [PERFORMANCE_INSIGHTS.md](./PERFORMANCE_INSIGHTS.md) | Meaningful patterns, changes, and observations within organization data |
| [FORECASTING.md](./FORECASTING.md) | Estimates of future performance from historical, current, and planning data |
| [BUSINESS_HEALTH.md](./BUSINESS_HEALTH.md) | A summarized assessment of the organization's current business condition |

---

## Design Constraint

Everything in this scope requires an active Organization subscription. Analytics is a **read** layer: it consumes data owned by [specifications/business](../business/) and [specifications/planning](../planning/) and must never become the system of record for it. Derived values — insights, forecasts, health scores — must be presented as interpretations, not as authoritative business facts.

See [PLATFORM_ARCHITECTURE.md](../../PLATFORM_ARCHITECTURE.md) for how analytics fits into the Organization Workspace.
