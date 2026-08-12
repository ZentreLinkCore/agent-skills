# ScaleUP Documentation

**ScaleUP** is a Business Operating System and Business Community Platform developed by **ZentreLink**.

This directory is the single source of truth for ScaleUP's product vision, business model, platform architecture, and functional specifications. It is written for product, design, and business stakeholders — implementation details and technology choices are intentionally out of scope.

---

## Start Here

| Document | Purpose |
|---|---|
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

## Documentation Structure

```
docs/
│
├── README.md                     — this file
├── PRODUCT_VISION.md             — vision, mission, philosophy
├── PRODUCT_ROADMAP.md            — phased product direction
├── BUSINESS_MODEL.md             — how ScaleUP monetizes and grows
├── PLATFORM_ARCHITECTURE.md      — how the platform is structured
├── USER_JOURNEY.md               — end-to-end experience by user type
├── PLATFORM_ENTITIES.md          — core entities and ownership model
├── DESIGN_PRINCIPLES.md          — principles guiding product decisions
│
├── specifications/               — functional specifications by domain
│   ├── core/                     — shared foundation (identity, notifications, messaging)
│   ├── community/                 — community platform features
│   ├── organization/             — organization & workspace administration
│   ├── business/                 — business management & intelligence
│   └── future/                   — proposed and exploratory modules
│
└── decisions/                    — architecture decision records (ADRs)
```

## How to Use This Documentation

- **New to ScaleUP?** Read [PRODUCT_VISION.md](./PRODUCT_VISION.md), then [PLATFORM_ARCHITECTURE.md](./PLATFORM_ARCHITECTURE.md).
- **Scoping a feature?** Find its domain under `specifications/` before writing a new spec.
- **Making a structural decision?** Record it under `decisions/` using the existing ADRs as a template.
- **Proposing something new?** Draft it under `specifications/future/` first.
