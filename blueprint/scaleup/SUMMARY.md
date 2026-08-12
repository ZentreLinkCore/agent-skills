# ScaleUP Blueprint Summary

A condensed reference to the ScaleUP blueprint. Every claim here is drawn from the documents under [docs/](./docs/) — read the linked source when you need the detail, and treat the source as authoritative if the two ever disagree.

**ScaleUP** is a Business Operating System and Business Community Platform developed by **ZentreLink**.

---

## The Product in One Paragraph

Businesses grow through a fragmented set of disconnected tools — one for networking, one for operations, one for planning. ScaleUP closes that gap by combining professional networking with business management in a single platform, split into two connected experiences: a **free Community Platform** every registered user gets by default, and a **subscription-based Organization Workspace** unlocked only when a user chooses to create an Organization. It is explicitly *not* accounting software and *not* a general social network. See [PRODUCT_VISION.md](./docs/PRODUCT_VISION.md).

---

## Two Experiences

| | Community Platform | Organization Workspace |
| :--- | :--- | :--- |
| **Cost** | Free, always | Subscription, per Organization |
| **Required?** | Default for every user | Opt-in |
| **Purpose** | Connect | Manage, measure, plan, grow |
| **Contains** | Profiles, feed, posts, comments, reactions, connections, following, messaging, opportunities | Dashboard, sales, expenses, transactions, customers, products, planning, analytics, reports, team |
| **Visibility** | Public / community | Private to the organization |
| **Specs** | [specifications/community/](./docs/specifications/community/) | [business/](./docs/specifications/business/), [planning/](./docs/specifications/planning/), [analytics/](./docs/specifications/analytics/) |

The boundary between them is a product invariant, not a phase: new capability is added by deepening each experience, never by moving the free/paid line. See [PLATFORM_ARCHITECTURE.md](./docs/PLATFORM_ARCHITECTURE.md) and [ADR-003](./docs/decisions/ADR-003-community-vs-workspace.md).

---

## Business Model

**Individuals are free.** Every registered user is an Individual by default, with unrestricted community access, networking, messaging, and opportunity discovery. The value of the network comes from its size and diversity, so participation is never gated.

**Organizations pay.** A subscription belongs to the **Organization**, not the user — a user with three organizations relates to three separate subscriptions. It unlocks the workspace: business management, planning, analytics, reports, and team collaboration.

Two reinforcing loops: free access grows the network; organizations joining to manage their business bring teams and activity back into that network. The free tier is a durable product in its own right, not a conversion funnel. See [BUSINESS_MODEL.md](./docs/BUSINESS_MODEL.md) and [ADR-002](./docs/decisions/ADR-002-subscription-model.md).

**Plans** — Starter, Professional, Business, Enterprise, billed monthly or yearly. Names and pricing are not final; access is controlled by **entitlements**, never by hard-coded plan names. See [SUBSCRIPTION_PLANS.md](./docs/specifications/subscription/SUBSCRIPTION_PLANS.md) and [FEATURE_ENTITLEMENTS.md](./docs/specifications/subscription/FEATURE_ENTITLEMENTS.md).

**Subscription lifecycle** — `Not Subscribed → Trial → Active → Past Due → Suspended → Cancelled → Expired`, with a grace period and defined feature access per state. See [SUBSCRIPTION_LIFECYCLE.md](./docs/specifications/subscription/SUBSCRIPTION_LIFECYCLE.md).

---

## Core Model

**A User and an Organization are separate first-class entities.** A User is a person; an Organization is a business. The link between them is an **Organization Membership**, so one user may belong to many organizations without fragmenting their identity. Not every user is a business owner — the model must accommodate employees, consultants, investors, mentors, and freelancers. See [ADR-004](./docs/decisions/ADR-004-user-organization-separation.md) and [PLATFORM_ENTITIES.md](./docs/PLATFORM_ENTITIES.md).

Ownership determines access:

| Owner | Entities |
| :--- | :--- |
| **User** | Personal profile, personal posts, connections, messages |
| **Organization** | Organization profile, members, organization posts, subscription, business data, goals, KPIs, reports, workspace settings |
| **Platform** | Notifications, opportunities, community feed, discovery, search |

**Organization roles** — Owner, Administrator, Manager, Member, Viewer. Permissions are evaluated per organization: a user's rights in one organization say nothing about their rights in another, and community permissions are independent of organization permissions entirely. See [ORGANIZATION_ROLES.md](./docs/specifications/organization/ORGANIZATION_ROLES.md) and [PERMISSION_MATRIX.md](./docs/PERMISSION_MATRIX.md).

---

## Design Principles

Nine principles govern product decisions ([DESIGN_PRINCIPLES.md](./docs/DESIGN_PRINCIPLES.md)). The load-bearing ones:

1. **Community first** — the free experience must stand alone, never feel like a waiting room.
2. **Organizations are opt-in** — nothing may imply an Individual is "incomplete" without one.
3. **A clear line between free and paid** — ambiguity here erodes trust on both sides.
4. **One identity, two contexts** — the workspace layers onto a user's identity; it is never a second account.
5. **Business-focused content, always** — every community feature is judged against business growth, not engagement.
6. **Operate on data, not guesswork** — workspace modules show the data behind a decision.
7. **Progressive depth** — complexity reveals itself as a business's needs grow.
8. **Built to extend** — new modules must not disturb the core.
9. **Ecosystem value over feature value** — judge features by network density and opportunity flow, not standalone usage.

---

## Technical Architecture

API-first, with web and mobile consuming shared backend services so business rules and security stay centralized ([ADR-001](./docs/decisions/ADR-001-platform-architecture.md)).

| Layer | Technology | Document |
| :--- | :--- | :--- |
| Web | React + TypeScript + Vite | [FRONTEND_ARCHITECTURE.md](./docs/FRONTEND_ARCHITECTURE.md) |
| Mobile | React Native + TypeScript | [MOBILE_ARCHITECTURE.md](./docs/MOBILE_ARCHITECTURE.md) |
| API | Laravel (PHP) | [API_ARCHITECTURE.md](./docs/API_ARCHITECTURE.md), [BACKEND_ARCHITECTURE.md](./docs/BACKEND_ARCHITECTURE.md) |
| Database | MySQL | [DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md), [DATABASE_DOMAIN_MODEL.md](./docs/DATABASE_DOMAIN_MODEL.md) |

The web application carries the full experience and targets desktop/tablet productivity. Mobile is deliberately narrower — community, messaging, notifications, monitoring, and quick actions — rather than a port of the workspace.

The schema defines roughly 73 tables across 13 groups: identity, organizations, invitations, subscriptions, community, messaging, notifications, opportunities, business, planning, analytics, reports, and security. **Organization isolation is the non-negotiable constraint** — every organization-owned row is scoped by organization, and no path may exist by which one organization's private data becomes reachable from another. See [DEVELOPMENT_ARCHITECTURE.md](./docs/DEVELOPMENT_ARCHITECTURE.md).

---

## Roadmap

Phases are organized by capability, not by dates. See [PRODUCT_ROADMAP.md](./docs/PRODUCT_ROADMAP.md) and the execution view in [ScaleUP-Blueprint.md](./ScaleUP-Blueprint.md).

| Phase | Focus | Goal |
| :--- | :--- | :--- |
| **1 — Foundation** | Accounts, profiles, feed, connections, messaging, notifications, opportunity discovery | Real value without ever creating an Organization |
| **2 — Activation** | Organization creation, subscriptions, business dashboard, core management, team | A reason to convert, backed by operational value |
| **3 — Depth** | Sales, expenses, transactions, reports, analytics, planning, goals & KPIs | Move from operating on ScaleUP to planning through it |
| **4 — Expansion** | Deeper community↔organization integration, expanded opportunity types, new modules | Compound ecosystem value |

**MVP priority** ([ScaleUP-Blueprint.md](./ScaleUP-Blueprint.md)): authentication, individual accounts and profiles, community feed and connections, organization creation and subscription, business dashboard, sales, expenses, and reports — then goals, planning, and opportunities.

**Current status** — Phase 0 is complete (brand, vision, mission, landing page, repository, documentation, roadmap). Outstanding: logo, color system, design system.

---

## Specification Domains

Functional specifications live under [docs/specifications/](./docs/specifications/), grouped by domain. Each directory has a `README.md` listing its documents and stating the constraint that decides what belongs there.

| Domain | Scope | Subscription |
| :--- | :--- | :---: |
| [core/](./docs/specifications/core/) | Authentication, user profiles, notifications, search | No |
| [community/](./docs/specifications/community/) | Feed, posts, comments, reactions, connections, following, messaging, opportunities, organization discovery | No |
| [organization/](./docs/specifications/organization/) | Creation, workspace, profile, membership, invitations, roles, settings | Mixed |
| [subscription/](./docs/specifications/subscription/) | Overview, plans, lifecycle, entitlements, payments, billing | Mixed |
| [business/](./docs/specifications/business/) | Dashboard, sales, expenses, transactions, customers, products | Yes |
| [planning/](./docs/specifications/planning/) | Strategic plans, objectives, goals, KPIs, milestones, action plans, budgets | Yes |
| [analytics/](./docs/specifications/analytics/) | Dashboard, reports, insights, forecasting, business health | Yes |
| [security/](./docs/specifications/security/) | Authorization, account security, data privacy, audit logging | N/A |
| [future/](./docs/specifications/future/) | AI assistant, marketplace, investment platform, mentorship | N/A |

The layering matters: **business** records what happened, **planning** states what is intended, **analytics** compares and interprets the two. Analytics is a read layer and must never become the system of record. See [specifications/README.md](./docs/specifications/README.md) for the document template and conventions.

---

## Decisions on Record

| ADR | Decision |
| :--- | :--- |
| [ADR-001](./docs/decisions/ADR-001-platform-architecture.md) | API-first architecture — React web, React Native mobile, Laravel API, MySQL |
| [ADR-002](./docs/decisions/ADR-002-subscription-model.md) | Individuals free; subscriptions belong to the Organization, not the User |
| [ADR-003](./docs/decisions/ADR-003-community-vs-workspace.md) | Two distinct but connected experiences, separated for privacy, UX, and permissions |
| [ADR-004](./docs/decisions/ADR-004-user-organization-separation.md) | User and Organization are separate entities, linked by Membership |

---

## Where to Start

- **Understanding the product** — [PRODUCT_VISION.md](./docs/PRODUCT_VISION.md), then [PLATFORM_ARCHITECTURE.md](./docs/PLATFORM_ARCHITECTURE.md).
- **Scoping a feature** — find its domain in [specifications/](./docs/specifications/), read that domain's `README.md` first.
- **Building** — [DEVELOPMENT_ARCHITECTURE.md](./docs/DEVELOPMENT_ARCHITECTURE.md), then the architecture document for your layer.
- **Data work** — [DATABASE_DOMAIN_MODEL.md](./docs/DATABASE_DOMAIN_MODEL.md) before [DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md).
- **Design** — [design/scaleup-branding.md](./design/scaleup-branding.md).
- **Full documentation map** — [docs/README.md](./docs/README.md).
