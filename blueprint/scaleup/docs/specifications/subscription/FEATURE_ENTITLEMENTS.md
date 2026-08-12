# Feature Entitlements Specification

## Purpose

The Feature Entitlements module defines which capabilities are available to an organization based on its subscription plan.

Its purpose is to separate subscription plans from application logic and provide a flexible way to control feature access.

---

## Overview

A subscription plan provides a set of entitlements.

An entitlement represents a capability that an organization is allowed to use.

The system should evaluate entitlements instead of checking plan names directly.

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

## Entitlement Categories

### Organization

- `organization.workspace`
- `organization.members`
- `organization.roles`
- `organization.settings`

### Business Management

- `business.dashboard`
- `business.sales`
- `business.expenses`
- `business.transactions`
- `business.customers`
- `business.products`

### Planning

- `planning.goals`
- `planning.kpis`
- `planning.budgets`
- `planning.strategic_plans`
- `planning.milestones`

### Analytics

- `analytics.basic`
- `analytics.advanced`
- `analytics.forecasting`
- `analytics.business_health`

### Reporting

- `reports.basic`
- `reports.advanced`
- `reports.executive`
- `reports.custom`

### Collaboration

- `collaboration.team`
- `collaboration.approvals`
- `collaboration.advanced_permissions`

### Integration

- `integrations.api`
- `integrations.webhooks`
- `integrations.third_party`

---

## Example Plan Entitlements

| Entitlement | Starter | Professional | Business | Enterprise |
| :--- | :---: | :---: | :---: | :---: |
| `organization.workspace` | ✅ | ✅ | ✅ | ✅ |
| `organization.members` | ✅ | ✅ | ✅ | ✅ |
| `business.dashboard` | ✅ | ✅ | ✅ | ✅ |
| `business.sales` | ✅ | ✅ | ✅ | ✅ |
| `business.expenses` | ✅ | ✅ | ✅ | ✅ |
| `planning.goals` | ✅ | ✅ | ✅ | ✅ |
| `planning.kpis` | ❌ | ✅ | ✅ | ✅ |
| `analytics.basic` | ✅ | ✅ | ✅ | ✅ |
| `analytics.advanced` | ❌ | ✅ | ✅ | ✅ |
| `analytics.forecasting` | ❌ | ❌ | ✅ | ✅ |
| `reports.basic` | ✅ | ✅ | ✅ | ✅ |
| `reports.advanced` | ❌ | ✅ | ✅ | ✅ |
| `reports.custom` | ❌ | ❌ | ✅ | ✅ |
| `integrations.api` | ❌ | ❌ | ✅ | ✅ |
| `integrations.third_party` | ❌ | ❌ | Limited | ✅ |
| `collaboration.advanced_permissions` | ❌ | ❌ | ✅ | ✅ |

The actual entitlements may change as the product evolves.

---

## Rules

- Feature access must be evaluated using entitlements.
- The application must not rely solely on plan names.
- Entitlements must be evaluated together with user permissions.
- Having an entitlement does not automatically grant every user in the organization access to the feature.
- Subscription status must be valid before an entitlement is considered active.
- Organization role permissions and subscription entitlements must both allow access.

---

## Access Evaluation

```text
Authenticated User
        ↓
Active Organization
        ↓
Organization Membership
        ↓
Role / Permission Check
        ↓
Subscription Status
        ↓
Entitlement Check
        ↓
Resource / Feature Access
```

### Example

A Professional organization may have:

`analytics.advanced = enabled`

But a Member may still be denied access if their organization role does not permit analytics access:

```text
Subscription ✅
Entitlement ✅
Role Permission ❌
      ↓
Access Denied
```

---

## Usage Limits

Entitlements may also include limits.

Examples:

- Maximum members
- Maximum storage
- Maximum businesses
- Maximum reports
- Maximum API requests

A limit should be represented independently from a simple enabled/disabled flag.

---

## Plan Changes

### Upgrades

```text
Old Plan
    ↓
New Plan
    ↓
Entitlements Recalculated
    ↓
New Features Available
```

### Downgrades

```text
Current Plan
    ↓
New Plan
    ↓
Entitlements Recalculated
    ↓
Restricted Features
```

Existing data must not be deleted simply because a feature becomes unavailable unless explicitly defined by policy.

---

## Expired Subscription

When a subscription expires:

- Paid entitlements become inactive.
- Public community identity may remain available.
- Private business data must remain protected.
- Data retention must follow the platform's subscription and retention policies.

---

## Permissions

Entitlement configuration is generally controlled by platform-level subscription management rather than normal organization users.

Organization users only consume the resulting entitlements.

---

## Edge Cases

- Subscription changes while a feature is actively being used.
- Plan downgrade exceeds a new usage limit.
- Entitlement configuration changes after subscription activation.
- Payment failure changes subscription state.
- Organization has legacy entitlements.
- Feature is deprecated while organizations still have access.

---

## Future Enhancements

- Add-on entitlements
- Usage-based entitlements
- Feature bundles
- Enterprise custom entitlements
- Temporary promotional entitlements

---

## Success Criteria

ScaleUP should be able to add, remove, or modify subscription features without requiring every business feature to be rewritten around specific plan names.