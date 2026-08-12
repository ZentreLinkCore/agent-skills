# Subscription Overview Specification

## Purpose

The Subscription module defines the commercial model used by ScaleUP to provide paid Organization Workspace capabilities.

Its purpose is to control access to organization-level features while maintaining a clear separation between the free Community Platform and the subscription-based Organization Workspace.

---

## Overview

ScaleUP uses an organization-based subscription model.

Individual accounts can use the Community Platform without requiring a subscription.

Creating an organization starts the subscription process.

The subscription belongs to the organization, not to the individual user.

```text
Individual Account
      ↓
Create Organization
      ↓
Select Subscription
      ↓
Activate Subscription
      ↓
Organization Workspace
```

---

## Actors

- Individual User
- Organization Owner
- Organization Administrator
- System
- Billing System
- Payment Provider

---

## Scope

### In Scope

- Organization subscriptions
- Subscription plans
- Subscription status
- Billing cycle
- Feature access
- Renewals
- Cancellations
- Payment status
- Subscription entitlements

### Future Scope

- Usage-based billing
- Add-ons
- Custom enterprise contracts
- Regional pricing
- Promotional plans
- Partner plans

---

## Business Model

### Individual Account

Free access to:

- Professional profile
- Community Feed
- Connections
- Following
- Messaging
- Public organization discovery
- Public opportunities

### Organization

Subscription-based access to:

- Organization Workspace
- Business Management
- Planning
- Analytics
- Reports
- Team Collaboration
- Organization-specific capabilities

---

## Rules

### Subscription Ownership

- A subscription belongs to an organization.
- Individual users do not own organization subscriptions.
- Only authorized organization users may manage the organization's subscription.
- A user may manage subscriptions for multiple organizations if authorized.

### Subscription Access

- Organization Workspace access depends on subscription status.
- Feature access depends on the organization's subscription entitlements.
- Subscription status must be evaluated before protected organization features are accessed.

### Community Access

- A subscription is not required to maintain an Individual Account.
- Subscription status must not remove basic community identity unless the account itself is restricted.
- Public community interactions remain separate from private organization capabilities.

---

## Subscription States

```text
Not Subscribed
    ↓
Trial
    ↓
Active
    ↓
Past Due
    ↓
Suspended
    ↓
Cancelled / Expired
```

---

## Permissions

| Action | Owner | Admin | Manager | Member | Viewer |
| :--- | :---: | :---: | :---: | :---: | :---: |
| View Subscription | ✅ | Based on Permission | ❌ | ❌ | ❌ |
| Change Plan | ✅ | Based on Permission | ❌ | ❌ | ❌ |
| Update Billing Information | ✅ | Based on Permission | ❌ | ❌ | ❌ |
| Cancel Subscription | ✅ | ❌ | ❌ | ❌ | ❌ |
| View Billing History | ✅ | Based on Permission | ❌ | ❌ | ❌ |

---

## Privacy

Subscription and billing information is private organization information.

It must not be exposed through:

- Public organization profiles
- Community posts
- Public search
- Public opportunities

---

## Notifications

Subscription-related events may generate:

- Subscription activated
- Payment successful
- Payment failed
- Renewal reminder
- Plan changed
- Subscription cancelled
- Subscription expired
- Subscription suspended

---

## Edge Cases

- Organization exists without a completed subscription.
- Payment succeeds but subscription activation fails.
- Subscription expires while a user is inside the workspace.
- User loses subscription management permission.
- Organization is archived while a subscription remains active.
- Payment provider becomes unavailable.

---

## Success Criteria

The subscription system should clearly separate free individual participation from paid organization capabilities and consistently control access to subscription-based features.