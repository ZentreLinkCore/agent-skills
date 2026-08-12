# Subscription Lifecycle Specification

## Purpose

The Subscription Lifecycle module defines how an organization's subscription moves between states from creation through renewal, cancellation, suspension, and expiration.

Its purpose is to ensure predictable access to paid organization capabilities throughout the subscription lifecycle.

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
Cancelled
      ↓
Expired
```

---

## State Definitions

### Not Subscribed

The organization has no active subscription.

Organization workspace access is unavailable unless a valid trial or entitlement exists.

### Trial

The organization has temporary access to included features before payment or during a promotional period.

### Active

The organization has a valid subscription and access to entitled features.

### Past Due

A scheduled payment has failed or remains outstanding.

### Suspended

Paid organization capabilities have been restricted because of unresolved subscription issues.

### Cancelled

The organization or authorized user has requested cancellation.

Access may remain available until the end of the paid billing period depending on policy.

### Expired

The subscription has reached the end of its access period and has not been renewed.

---

## Lifecycle Flows

### New Subscription

```text
Not Subscribed
    ↓
Plan Selected
    ↓
Payment / Trial
    ↓
Active / Trial
```

### Renewal

```text
Active
    ↓
Renewal Date
    ↓
Payment Successful
    ↓
Active
```

### Failed Renewal

```text
Active
    ↓
Renewal Attempt
    ↓
Payment Failed
    ↓
Past Due
    ↓
Payment Recovered
    ↓
Active
```

### Suspension

```text
Past Due
    ↓
Grace Period Exceeded
    ↓
Suspended
```

### Cancellation

```text
Active
    ↓
Cancellation Requested
    ↓
End of Billing Period
    ↓
Cancelled / Expired
```

---

## Rules

- Only authorized organization users may request cancellation.
- Subscription state must be determined by billing and payment events.
- Paid feature access must follow current subscription state.
- A cancelled subscription may remain active until the end of the paid billing period if policy allows.
- Suspended organizations must have restricted access according to platform rules.
- Subscription reactivation must follow defined payment and account rules.
- Historical subscription records must be retained according to retention policy.

---

## Grace Period

A grace period may be provided for failed payments.

During the grace period:

- The organization may retain access.
- Billing users receive payment reminders.
- New subscription changes may be restricted where appropriate.

---

## Feature Access by State

| State | Organization Workspace | Paid Features |
| :--- | :---: | :---: |
| Not Subscribed | ❌ | ❌ |
| Trial | ✅ | Based on Trial |
| Active | ✅ | ✅ |
| Past Due | ✅ / Policy | Based on Policy |
| Suspended | Restricted | ❌ |
| Cancelled | Until End Date / Policy | Based on End Date |
| Expired | Restricted | ❌ |

---

## Notifications

Lifecycle events may generate:

- Trial started
- Trial ending
- Subscription activated
- Renewal reminder
- Payment failed
- Grace period started
- Subscription suspended
- Cancellation confirmed
- Subscription expired
- Reactivation confirmed

---

## Edge Cases

- Payment succeeds after suspension.
- User cancels during a grace period.
- Subscription is reactivated before expiration.
- Trial expires without payment.
- Organization changes plans during cancellation.
- Payment provider sends duplicate events.
- Subscription status update is delayed.

---

## Success Criteria

Every organization subscription should have a predictable lifecycle with clear transitions, access rules, notifications, and recovery processes.