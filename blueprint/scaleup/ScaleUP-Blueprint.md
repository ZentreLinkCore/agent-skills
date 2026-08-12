# 🏗️ ScaleUP Blueprint

> Aligned with [`docs/`](./docs/README.md) — ScaleUP is a Business Operating System and Business Community Platform developed by ZentreLink, built on two connected experiences: the free **Community Platform** and the subscription-based **Organization Workspace**. See [`docs/PRODUCT_VISION.md`](./docs/PRODUCT_VISION.md) and [`docs/PLATFORM_ARCHITECTURE.md`](./docs/PLATFORM_ARCHITECTURE.md).

## Phase 0 — Foundation
**Goal:** Define what ScaleUP is.

**Complete**
- ✅ Brand Name
- ✅ Vision
- ✅ Mission
- ✅ Landing Page
- ✅ GitHub Repository
- ✅ README
- ✅ Product Documentation (`docs/`)
- ✅ Product Roadmap

**Next**
- [ ] Logo
- [ ] Color System
- [ ] Design System

---

## Phase 1 — Product Discovery
**Goal:** Define exactly what ScaleUP will solve.

### Target Users
- **Individuals** (free, no Organization required) — professionals, founders-to-be, mentors, investors
- Startup Owners
- Small Business Owners
- Medium Businesses
- Organizations (subscription)
- Investors, Mentors & Partners (community-first participants)

### Core Problems
Business owners and professionals struggle to:
- Build a professional network around their business goals
- Discover business opportunities and partnerships
- Track business performance
- Organize financial records
- Plan business growth
- Make informed decisions

### Core Solution
ScaleUP provides one platform, split into two experiences:
- A free **Community Platform** to Connect
- A subscription **Organization Workspace** to Manage, Analyze, Plan, and Grow

---

## Phase 2 — System Architecture

### Business Modules

```
ScaleUP

Community Platform (Free)
├── Individual Accounts
├── User Profiles
├── Community Feed
├── Business Connections
├── Messaging
├── Notifications
└── Opportunities

Organization Workspace (Subscription)
├── Organizations
├── Business Dashboard
├── Business Management
│   ├── Sales
│   ├── Expenses
│   └── Transactions
├── Planning
│   ├── Goals
│   ├── Business Plans
│   └── KPIs
├── Reports
├── Analytics
├── Team Management
└── Organization Settings

Future
├── Investment
├── Mentorship
└── Marketplace
```

Every user is an Individual by default and lives in the Community Platform. Creating an Organization is optional and requires an active subscription — see [ADR-002](./docs/decisions/ADR-002-subscription-model.md).

---

## Phase 3 — UX Blueprint
Before coding. Draw screens.

```
Landing
   ↓
Register / Login
   ↓
Individual Profile Setup   ← every user lands here (free)
   ↓
Community Feed, Connections, Opportunities   ← default home
   ↓
[Optional] Create Organization → Subscribe
   ↓
Business Setup
   ↓
Dashboard
   ↓
Sales
   ↓
Expenses
   ↓
Reports
   ↓
Settings
```

*Every page.* The Community track (Landing → Feed) must stand on its own — the Organization track is a branch, not the main path.

---

## Phase 4 — Database Design
Don't code. Design database.

```
Users
Profiles
Connections
Posts (Community Feed)
Opportunities
Organizations
Business Members
Products
Customers
Sales
Expenses
Transactions
Goals
Reports
Subscriptions
```

*Relationships.* Note the split: `Users`, `Profiles`, `Connections`, `Posts`, `Opportunities` belong to the free Community Platform; `Organizations`, `Business Members`, and everything under it are gated by an active `Subscription`.

---

## Phase 5 — Design System
Don't use random UI. Create your own UI Standard:

- Typography
- Spacing
- Colors
- Buttons
- Inputs
- Tables
- Cards
- Charts
- Icons
- Forms
- Modals
- Navigation
- Dark Mode
- Responsive Rules

See [`design/scaleup-branding.md`](./design/scaleup-branding.md) for the full design brief.

---

## Phase 6 — MVP
Solve the two problems that define ScaleUP's identity: a professional home for every user, and a way to formally manage a business.

```
Register → Individual Profile → Community Feed → Connections
                                        ↓
                         [Optional] Create Organization
                                        ↓
                          Dashboard → Sales → Expenses → Reports
```

- Community (profile, feed, connections) ships in the MVP — it is the default experience, not a later phase.
- Business Planning, deep Analytics, and Investment stay out of the MVP.

---

## Phase 7 — Version 2
- Business Planning
- Goals
- KPIs
- Growth Tracking
- Forecasting

---

## Phase 8 — Version 3
- Advanced Community: Discussions, Business Groups, Events
- Organization Directory
- Knowledge Sharing
- Deeper Messaging & Notifications

---

## Phase 9 — Version 4
- Investment
- Proposal Posting
- Funding
- Partnership
- Business Events

---

## Folder Blueprint

```
ScaleUP
├── 📁 .agents
│   └── 📁 blueprint
│       └── 📁 scaleup
│           ├── ScaleUP-Blueprint.md
│           ├── 📁 design
│           ├── 📁 docs
│           └── 📁 roadmap
├── 📁 frontend
├── 📁 backend
├── 📁 mobile
├── 📁 database
├── 📁 api
└── 📁 assets
```

---

## Documentation

Product documentation lives in [`docs/`](./docs/README.md), structured as:

```
docs
├── README.md
├── PRODUCT_VISION.md
├── PRODUCT_ROADMAP.md
├── BUSINESS_MODEL.md
├── PLATFORM_ARCHITECTURE.md
├── USER_JOURNEY.md
├── PLATFORM_ENTITIES.md
├── DESIGN_PRINCIPLES.md
│
├── specifications/
│   ├── core/
│   ├── community/
│   ├── organization/
│   ├── business/
│   └── future/
│
└── decisions/
    ├── ADR-001-platform-architecture.md
    ├── ADR-002-subscription-model.md
    └── ADR-003-community-vs-workspace.md
```

---

## MVP Priority

**⭐⭐⭐⭐⭐**
- Authentication
- Individual Accounts & Profiles (Community Platform)
- Community Feed & Connections
- Organizations (creation & subscription)
- Business Dashboard
- Sales
- Expenses
- Reports

**⭐⭐⭐⭐**
- Goals
- Planning
- Opportunities

**⭐⭐⭐**
- Community Discussions & Groups

**⭐⭐**
- Investment

---

## Long-Term Vision

```
ScaleUP

Year 1 → Community & Identity Foundation (free)
Year 2 → Business Management (subscription activation)
Year 3 → Business Planning & Intelligence
Year 4 → Business Community Depth
Year 5 → Investment & Opportunity Ecosystem
Year 6+ → Complete Business Operating System
```
