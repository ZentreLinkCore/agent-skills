# ADR-002: Organization-Based Subscription Model

## Status

Accepted

---

## Date

2026-08-12

---

## Context

ScaleUP has two primary experiences:

1. Free Community Platform
2. Subscription-based Organization Workspace

Requiring every user to subscribe would create unnecessary barriers to joining the platform and hinder network effects.

---

## Decision

Individual accounts will be free.

Organizations will use a subscription-based model. The subscription belongs to the Organization rather than the individual User.

```text
Individual Account
       ↓
Free Community
       ↓
Create Organization
       ↓
Select Subscription
       ↓
Organization Workspace
```

---

## Account Model Breakdown

### Individual Account (Free)

Free users may access:

- User Profile
- Community Feed
- Posts
- Connections
- Following
- Messaging
- Public Organization Discovery
- Public Opportunities

### Organization Subscription (Paid)

Organizations may access:

- Organization Workspace
- Business Management
- Planning
- Analytics
- Reports
- Team Collaboration
- Premium Features

---

## Decision on Feature Access

Feature access will be controlled using subscription entitlements rather than directly checking plan names:

```text
Organization
    ↓
Subscription
    ↓
Plan
    ↓
Entitlements
    ↓
Feature Access
```

---

## Consequences

### Positive

- Low barrier for user acquisition and viral community growth.
- Community can grow independently from paid organizations.
- Organizations become the primary, scalable subscription revenue source.
- Flexible pricing model with clear value segmentation.
- Future plans and tiers can change dynamically without rewriting feature logic.

### Negative

- Subscription lifecycle, trials, and cancellations must be carefully managed.
- Entitlement management introduces additional architectural layers.
- Community and organization access boundaries must remain strictly separated.

---

## Alternatives Considered

### Subscription Per User

Rejected because it would discourage free community participation, networking, and user acquisition.

### Everything Free

Rejected because the Organization Workspace, business management tools, and analytics require a sustainable recurring revenue model.

---

## Result

ScaleUP will use a free Individual Account model combined with subscription-based Organizations driven by dynamic feature entitlements.