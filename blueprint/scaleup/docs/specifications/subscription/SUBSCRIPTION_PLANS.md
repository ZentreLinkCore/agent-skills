# Subscription Plans Specification

## Purpose

The Subscription Plans module defines the plans available to organizations and the capabilities included in each plan.

Its purpose is to provide a predictable and scalable pricing model for organizations of different sizes and business needs.

---

## Overview

Subscription plans define:

- Price
- Billing cycle
- Feature entitlements
- Usage limits
- Member limits
- Storage limits
- Support level

The final plan names and pricing may change as ScaleUP evolves.

---

## Initial Plan Structure

The platform may support:

- Starter
- Professional
- Business
- Enterprise

A free individual tier exists outside the Organization subscription model.

---

## Plan Comparison

| Capability | Starter | Professional | Business | Enterprise |
| :--- | :---: | :---: | :---: | :---: |
| Organization Workspace | ✅ | ✅ | ✅ | ✅ |
| Business Management | ✅ | ✅ | ✅ | ✅ |
| Planning | ✅ | ✅ | ✅ | ✅ |
| Basic Analytics | ✅ | ✅ | ✅ | ✅ |
| Advanced Analytics | ❌ | ✅ | ✅ | ✅ |
| Advanced Reports | ❌ | ✅ | ✅ | ✅ |
| Team Collaboration | ✅ | ✅ | ✅ | ✅ |
| Custom Permissions | ❌ | ❌ | ✅ | ✅ |
| Multiple Workspaces / Branches | ❌ | Limited | ✅ | ✅ |
| API Access | ❌ | ❌ | ✅ | ✅ |
| Priority Support | ❌ | ❌ | ✅ | ✅ |
| Dedicated Support | ❌ | ❌ | ❌ | ✅ |
| Custom Integrations | ❌ | ❌ | Limited | ✅ |

The final entitlements must be maintained separately from the pricing presentation.

---

## Billing Cycles

Plans may support:

- Monthly
- Yearly

Annual billing may provide a discounted rate where applicable.

---

## Rules

- Each organization may have one active subscription plan at a time.
- Only authorized organization users may change plans.
- Plan changes must follow defined billing rules.
- Features must be controlled by entitlements rather than hard-coded plan names.
- A plan may have usage limits.
- Enterprise plans may support custom agreements.

---

## Plan Availability

Plans may have states:

- Active
- Hidden
- Deprecated

A deprecated plan should remain available to existing subscribers when required by migration policy.

---

## Plan Changes

Possible plan changes:

```text
Starter
   ↓
Professional
   ↓
Business
   ↓
Enterprise
```

The platform must define how upgrades and downgrades affect:

- Billing
- Existing data
- Feature access
- Usage limits

---

## Trial Period

Future plans may support a trial period.

Trial rules may define:

- Duration
- Included features
- Usage limits
- Conversion to paid subscription
- Trial expiration

---

## Enterprise Plans

Enterprise plans may support:

- Custom pricing
- Custom features
- Custom member limits
- Service agreements
- Dedicated support
- Custom integrations

---

## Edge Cases

- Organization exceeds plan limits.
- Plan becomes unavailable to new customers.
- Existing customer is on a deprecated plan.
- Organization downgrades while using premium features.
- Organization upgrades during an active billing cycle.

---

## Success Criteria

Organizations should be able to clearly understand available plans and select a subscription that matches their business needs.
