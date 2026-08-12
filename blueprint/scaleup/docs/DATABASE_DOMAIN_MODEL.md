# ScaleUP Database Domain Model

## Purpose

The Database Domain Model defines the major data entities and relationships required to support the ScaleUP platform.

Its purpose is to establish clear ownership, organization isolation, and relationships before implementation of the physical database schema.

---

## Core Principle

ScaleUP follows this ownership model:

```text
User
    ↓
Individual Identity

Organization
    ↓
Business Identity

Membership
    ↓
Connects User to Organization

Subscription
    ↓
Belongs to Organization
```

---

## Core Entities

### User

Represents an individual person using ScaleUP.

Primary responsibilities:

- Authentication
- Personal identity
- Community participation
- Organization membership

Relationships:

```text
User
├── Profile
├── Sessions
├── Posts
├── Comments
├── Reactions
├── Connections
├── Following
├── Messages
├── Notifications
└── Organization Memberships
```

### User Profile

Represents the professional information of a User.

Relationship:

```text
User
1 ─── 1
User Profile
```

### Organization

Represents a business, company, startup, team, or other organization.

Relationships:

```text
Organization
├── Profile
├── Memberships
├── Subscription
├── Posts
├── Opportunities
├── Sales
├── Expenses
├── Transactions
├── Customers
├── Products
├── Goals
├── Objectives
├── KPIs
├── Budgets
├── Strategic Plans
├── Milestones
├── Action Plans
└── Reports
```

### Organization Profile

Represents the public-facing identity of an organization.

```text
Organization
1 ─── 1
Organization Profile
```

### Organization Membership

Associates a User with an Organization.

```text
User
  │
  │
  └── Organization Membership
             │
             │
             ▼
       Organization
```

A User may have multiple Organization Memberships.

An Organization may have multiple Users.

```text
User
N ─── M
Organization

through:

Organization Membership
```

### Organization Roles

Membership contains role information.

Examples:

- Owner
- Administrator
- Manager
- Accountant
- Member
- Viewer

Role configuration should support future granular permissions.

### Subscription

A Subscription belongs to an Organization.

```text
Organization
1 ─── 1
Subscription
```

A subscription references a Plan.

```text
Subscription
N ─── 1
Plan
```

Historical subscription records may be retained depending on lifecycle requirements.

### Subscription Entitlements

Entitlements determine which capabilities an organization can access.

```text
Organization
    ↓
Subscription
    ↓
Plan
    ↓
Entitlements
```

Entitlements should be independent of application feature implementation.

---

## Community Entities

### Post

A Post may be authored by:

- User
- Organization

The model must distinguish the author context.

```text
User
   ↓
Post

Organization
   ↓
Post
```

A post has:

- Comments
- Reactions
- Visibility
- Optional attachments
- Optional mentions

### Comment

A Comment belongs to a Post.

```text
Post
1 ─── N
Comments
```

A comment is authored by a User.

### Reaction

A Reaction belongs to a supported content item.

Initially:

```text
User
   ↓
Reaction
   ↓
Post / Comment
```

### Connection

A Connection represents a relationship between two Users.

```text
User
N ─── M
User

through a Connection entity.
```

### Following

Following represents a one-way relationship.

A User may follow:

- User
- Organization

```text
User
  ↓
Following
  ↓
User / Organization
```

### Message

A Message belongs to a Conversation.

```text
Conversation
1 ─── N
Messages
```

A Conversation contains one or more Participants.

### Notification

A Notification belongs to a User.

```text
User
1 ─── N
Notifications
```

A notification may reference another platform resource.

---

## Opportunity Entities

### Opportunity

An Opportunity may be owned by:

- User
- Organization

```text
User / Organization
        ↓
    Opportunity
```

### Opportunity Interest

Represents interest submitted by:

- User
- Organization

```text
Opportunity
1 ─── N
Opportunity Interests
```

---

## Business Entities

All business entities belong to an Organization.

```text
Organization
    │
    ├── Sales
    ├── Expenses
    ├── Transactions
    ├── Customers
    └── Products
```

### Sale

Represents a sales event.

Possible relationships:

```text
Organization
    ↓
Sale
├── Customer
└── Product
```

### Expense

Represents a business expense.

```text
Organization
    ↓
Expense
└── Expense Category
```

### Transaction

Represents a unified record of business financial activity.

Transactions may reference their source record.

```text
Sale
  ↓
Transaction

Expense
  ↓
Transaction
```

### Customer

A Customer belongs to one Organization.

```text
Organization
1 ─── N
Customers
```

A Customer may have multiple Sales.

### Product

A Product belongs to one Organization.

```text
Organization
1 ─── N
Products
```

A Product may be referenced by multiple Sales.

Historical sales must preserve transaction-specific pricing information.

---

## Planning Entities

### Strategic Plan

Belongs to an Organization.

```text
Organization
1 ─── N
Strategic Plans
```

### Objective

Belongs to an Organization and may belong to a Strategic Plan.

```text
Strategic Plan
1 ─── N
Objectives
```

### Goal

Belongs to an Organization and may be linked to an Objective.

```text
Objective
1 ─── N
Goals
```

### KPI

Belongs to an Organization and may be associated with Goals or Objectives.

### Budget

Belongs to an Organization.

### Milestone

Belongs to an Organization and may be associated with Goals or Objectives.

### Action Plan

Belongs to an Organization and may be associated with Goals, Objectives, or Milestones.

### Planning Relationship

```text
Strategic Plan
    ↓
Objective
    ↓
Goal
    ↓
KPI
    ↓
Milestone
    ↓
Action Plan
```

Not every relationship must be mandatory.

---

## Analytics Entities

Analytics should generally derive information from operational and planning entities instead of duplicating source data unnecessarily.

Sources may include:

- Sales
- Expenses
- Transactions
- Customers
- Products
- Goals
- KPIs
- Budgets
- Milestones

Analytics may maintain derived or aggregated data where necessary for performance.

### Report

A Report belongs to an Organization.

Reports may reference:

- Reporting period
- Report type
- Filters
- Generated user
- Source data

---

## Audit Entities

### Audit Log

An Audit Log records important system and security actions.

Possible references:

- User
- Organization
- Resource
- Action
- Timestamp
- Result

Audit logs should be treated as append-oriented records.

---

## Ownership Rules

### User-Owned

- User Profile
- Personal Posts
- Personal Comments
- Personal Reactions
- Connections
- Personal Messages

### Organization-Owned

- Organization Profile
- Memberships
- Subscription
- Business Data
- Planning Data
- Analytics Data
- Reports
- Organization Posts
- Organization Opportunities

### Shared Platform

- Notifications
- Search Indexes
- Platform Events

---

## Organization Isolation

Every organization-owned entity must contain or derive a reliable organization context.

Example:

```text
Organization
   ↓
Sales
   ↓
Expenses
   ↓
Transactions
```

A request for organization data must always verify:

1. Current User
2. Active Organization
3. Membership
4. Role
5. Permission

---

## Multi-Organization Model

A User may belong to multiple organizations.

```text
User
│
├── Membership → Organization A
│
├── Membership → Organization B
│
└── Membership → Organization C
```

Each membership may have a different role:

- Organization A → Owner
- Organization B → Manager
- Organization C → Viewer

---

## Public vs Private Data

### Public

- Public User Profile
- Public Organization Profile
- Public Posts
- Public Opportunities

### Private

- Business Records
- Planning Records
- Reports
- Financial Information
- Internal Team Information
- Subscription and Billing Information

Database access patterns must preserve this boundary.

---

## Soft Deletion

Soft deletion or archival should be considered for entities where historical relationships must remain available.

Potential candidates:

- Organization
- Organization Membership
- Customer
- Product
- Post
- Opportunity
- Business Records

The final deletion strategy should be determined per domain.

---

## Historical Integrity

Historical business records should preserve important values at the time they occurred.

Examples:

- Sale price should not change when the product's current price changes.
- Historical customer references should remain understandable after customer archival.
- Historical reports should remain reproducible where required.

---

## Auditability

Business-critical entities should support appropriate audit tracking.

Potential audited resources:

- Organization
- Membership
- Roles
- Subscription
- Sales
- Expenses
- Transactions
- Planning records
- Sensitive settings

---

## Data Classification

Each entity should have a defined privacy classification.

Possible classifications:

- Public
- Community
- Organization Private
- Sensitive
- Highly Sensitive

---

## Future Entities

The model should accommodate future domains without changing the ownership principles.

Potential future entities:

- Investment Proposal
- Investor Profile
- Mentorship Program
- Mentor Profile
- Marketplace Listing
- AI Conversation
- External Integration
- Enterprise Account

---

## Conceptual Relationship Map

```text
                              USER
                               │
               ┌───────────────┼────────────────┐
               │               │                │
            PROFILE          POSTS         CONNECTIONS
               │               │
               │            COMMENTS
               │               │
               │           REACTIONS
               │
               └────── ORGANIZATION MEMBERSHIP
                              │
                              ▼
                        ORGANIZATION
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
     SUBSCRIPTION         WORKSPACE          PUBLIC PROFILE
          │                   │
          │          ┌────────┼─────────┐
          │          │        │         │
          │       BUSINESS  PLANNING  ANALYTICS
          │          │        │         │
          │          │        │         └── REPORTS
          │          │        │
          │       SALES      GOALS
          │       EXPENSES   OBJECTIVES
          │       TRANSACTIONS KPIs
          │       CUSTOMERS  BUDGETS
          │       PRODUCTS   MILESTONES
          │                  ACTION PLANS
          │
          └── ENTITLEMENTS

COMMUNITY
   │
   ├── FOLLOWING
   ├── MESSAGING
   └── OPPORTUNITIES
```

---

## Database Principles

### Clear Ownership

Every record must have a clearly defined owner.

### Organization Isolation

Organization data must remain isolated.

### Referential Integrity

Relationships must prevent orphaned or inconsistent records where appropriate.

### Historical Accuracy

Business history must remain reliable even when current master data changes.

### Extensibility

The model should allow new domains to be introduced without redesigning core identity and organization relationships.

---

## Success Criteria

The conceptual database model should provide a stable foundation for implementing ScaleUP while preserving user identity, organization isolation, subscription ownership, business data integrity, privacy, and future extensibility.
