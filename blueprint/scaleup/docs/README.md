# ScaleUP Documentation

**ScaleUP** is a Business Operating System and Business Community Platform developed by **ZentreLink**.

This directory is the single source of truth for ScaleUP's product vision, business model, platform architecture, functional specifications, and technical architecture. Product documents describe **what** ScaleUP does and why; architecture documents describe **how** it is built.

---

## Start Here

| Document | Purpose |
| :--- | :--- |
| [PRODUCT_VISION.md](./PRODUCT_VISION.md) | Why ScaleUP exists, what it aims to become, and the philosophy behind it |
| [PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md) | The phased path from current state to long-term vision |
| [BUSINESS_MODEL.md](./BUSINESS_MODEL.md) | How ScaleUP creates, delivers, and captures value |
| [PLATFORM_ARCHITECTURE.md](./PLATFORM_ARCHITECTURE.md) | How the Community Platform and Organization Workspace fit together |
| [USER_JOURNEY.md](./USER_JOURNEY.md) | How different users experience ScaleUP, end to end |
| [PLATFORM_ENTITIES.md](./PLATFORM_ENTITIES.md) | The core entities (User, Organization, Subscription, etc.) and who owns what |
| [DESIGN_PRINCIPLES.md](./DESIGN_PRINCIPLES.md) | The product principles that guide every decision |

---

## Two Experiences, One Platform

ScaleUP is composed of two connected experiences:

- **Community Platform (Free)** — every registered user's home base for professional networking, business content, and opportunity discovery.
- **Organization Workspace (Subscription)** — an optional, subscription-based environment unlocked when a user creates an Organization to manage a business.

Every user starts in the Community Platform. The Organization Workspace is opt-in, not a gate. See [PLATFORM_ARCHITECTURE.md](./PLATFORM_ARCHITECTURE.md) for the full breakdown.

---

## Product & Domain

| Document | Purpose |
| :--- | :--- |
| [DOMAIN_MAP.md](./DOMAIN_MAP.md) | The business domains that make up the platform and how they relate |
| [FEATURE_SPECIFICATIONS.md](./FEATURE_SPECIFICATIONS.md) | The functional scope of every major feature, grouped by domain |
| [PERMISSION_MATRIX.md](./PERMISSION_MATRIX.md) | Which roles may perform which actions, across every permission context |

---

## Technical Architecture

| Document | Purpose |
| :--- | :--- |
| [DEVELOPMENT_ARCHITECTURE.md](./DEVELOPMENT_ARCHITECTURE.md) | How web, mobile, API, database, and supporting services fit together |
| [API_ARCHITECTURE.md](./API_ARCHITECTURE.md) | How client applications communicate with platform services |
| [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md) | How the API implements business rules, domain logic, and data access |
| [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) | How the web application is organized |
| [MOBILE_ARCHITECTURE.md](./MOBILE_ARCHITECTURE.md) | How the mobile application is structured |
| [DATABASE_DOMAIN_MODEL.md](./DATABASE_DOMAIN_MODEL.md) | The data entities, ownership, and relationships behind the platform |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | The physical database design derived from the domain model |

---

## Specifications

Functional specifications are grouped by domain under [specifications/](./specifications/). Each domain has a `README.md` listing its documents and stating its design constraint.

| Domain | Scope |
| :--- | :--- |
| [core/](./specifications/core/) | Shared foundation — authentication, profiles, notifications, search |
| [community/](./specifications/community/) | The free Community Platform |
| [organization/](./specifications/organization/) | Creating, administering, and governing an Organization |
| [subscription/](./specifications/subscription/) | Plans, entitlements, payments, billing, lifecycle |
| [business/](./specifications/business/) | Operational business management inside the workspace |
| [planning/](./specifications/planning/) | Strategy, objectives, goals, KPIs, milestones, budgets |
| [analytics/](./specifications/analytics/) | Dashboards, reports, insights, forecasting, business health |
| [security/](./specifications/security/) | Cross-cutting security, authorization, privacy, audit |
| [future/](./specifications/future/) | Proposed and exploratory modules |

See [specifications/README.md](./specifications/README.md) for the specification template and conventions.

---

## Decisions

Structural decisions are recorded as ADRs under [decisions/](./decisions/).

| ADR | Decision |
| :--- | :--- |
| [ADR-001](./decisions/ADR-001-platform-architecture.md) | Platform architecture |
| [ADR-002](./decisions/ADR-002-subscription-model.md) | Organization-based subscription model |
| [ADR-003](./decisions/ADR-003-community-vs-workspace.md) | Community Platform and Organization Workspace separation |
| [ADR-004](./decisions/ADR-004-user-organization-separation.md) | User and Organization separation |

---

## Documentation Structure

```text
docs/
│
├── README.md                     — this file
│
├── PRODUCT_VISION.md             — vision, mission, philosophy
├── PRODUCT_ROADMAP.md            — phased product direction
├── BUSINESS_MODEL.md             — how ScaleUP monetizes and grows
├── PLATFORM_ARCHITECTURE.md      — how the platform is structured
├── USER_JOURNEY.md               — end-to-end experience by user type
├── PLATFORM_ENTITIES.md          — core entities and ownership model
├── DESIGN_PRINCIPLES.md          — principles guiding product decisions
├── DOMAIN_MAP.md                 — business domains and their boundaries
├── FEATURE_SPECIFICATIONS.md     — functional scope of major features
├── PERMISSION_MATRIX.md          — roles and permitted actions
│
├── DEVELOPMENT_ARCHITECTURE.md   — overall technical organization
├── API_ARCHITECTURE.md           — client-to-service communication
├── BACKEND_ARCHITECTURE.md       — backend domain logic and data access
├── FRONTEND_ARCHITECTURE.md      — web application structure
├── MOBILE_ARCHITECTURE.md        — mobile application structure
├── DATABASE_DOMAIN_MODEL.md      — data entities and ownership
├── DATABASE_SCHEMA.md            — physical database design
│
├── specifications/               — functional specifications by domain
│   ├── README.md                 — specification template and conventions
│   ├── core/                     — shared foundation
│   ├── community/                — community platform features
│   ├── organization/             — organization & workspace administration
│   ├── subscription/             — plans, entitlements, payments, billing
│   ├── business/                 — business management
│   ├── planning/                 — strategy, goals, KPIs, budgets
│   ├── analytics/                — dashboards, reports, insights
│   ├── security/                 — cross-cutting security requirements
│   └── future/                   — proposed and exploratory modules
│
└── decisions/                    — architecture decision records (ADRs)
```

---

## How to Use This Documentation

- **New to ScaleUP?** Read [PRODUCT_VISION.md](./PRODUCT_VISION.md), then [PLATFORM_ARCHITECTURE.md](./PLATFORM_ARCHITECTURE.md).
- **Scoping a feature?** Find its domain under [specifications/](./specifications/) before writing a new spec, and follow [specifications/README.md](./specifications/README.md).
- **Building it?** Start from [DEVELOPMENT_ARCHITECTURE.md](./DEVELOPMENT_ARCHITECTURE.md), then the architecture document for your layer.
- **Making a structural decision?** Record it under [decisions/](./decisions/) using the existing ADRs as a template.
- **Proposing something new?** Draft it under [specifications/future/](./specifications/future/) first.
