# Business Specifications

Business specifications cover the operational capabilities available inside the Organization Workspace once a subscription is active. They record what the business does day to day; [analytics](../analytics/) interprets it and [planning](../planning/) directs it.

---

## Specifications

| Document | Purpose |
| :--- | :--- |
| [BUSINESS_OVERVIEW.md](./BUSINESS_OVERVIEW.md) | The Business Management domain and the principles shared by every module below |
| [DASHBOARD.md](./DASHBOARD.md) | The consolidated operational view and landing page of the workspace |
| [SALES.md](./SALES.md) | Recording and monitoring revenue-generating activity |
| [EXPENSES.md](./EXPENSES.md) | Recording, categorizing, and monitoring business spending |
| [TRANSACTIONS.md](./TRANSACTIONS.md) | The centralized record of business financial activity |
| [CUSTOMERS.md](./CUSTOMERS.md) | Structured records of the people or entities that buy from the organization |
| [PRODUCTS.md](./PRODUCTS.md) | The catalog of products and services the organization offers |

---

## Design Constraint

Everything in this scope requires an active Organization subscription. These capabilities should be designed to compound with each other — a Report should be able to draw from Analytics, Analytics from business activity, and so on — rather than existing as isolated tools.

See [PLATFORM_ARCHITECTURE.md](../../PLATFORM_ARCHITECTURE.md) for how these modules compose the Organization Workspace.
