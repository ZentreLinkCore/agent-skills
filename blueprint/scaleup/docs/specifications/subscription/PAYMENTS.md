# Payments Specification

## Purpose

The Payments module manages the payment process required to activate and maintain organization subscriptions.

Its purpose is to provide a secure and reliable payment flow while keeping payment information separate from ScaleUP business data.

---

## Overview

Payments are initiated through the organization's subscription process and are handled through an approved payment provider.

ScaleUP should not store sensitive payment credentials directly unless explicitly required and securely supported.

---

## Actors

- Organization Owner
- Authorized Billing User
- Payment Provider
- ScaleUP System

---

## Scope

### In Scope

- Payment initiation
- Payment confirmation
- Payment status
- Failed payments
- Payment retries
- Refund status
- Payment records

### Future Scope

- Multiple payment methods
- Saved payment methods
- Automatic payment retries
- Regional payment providers
- Enterprise invoicing

---

## Payment Flow

```text
Select Plan
    ↓
Review Billing
    ↓
Start Payment
    ↓
Payment Provider
    ↓
Payment Result
    ↓
Update Subscription
```

---

## Payment States

```text
Initiated
    ↓
Processing
    ↓
Succeeded
```

Alternative states:

- Failed
- Cancelled
- Refunded
- Partially Refunded
- Pending

---

## Rules

- Payment credentials must be handled securely.
- ScaleUP should use a compliant payment provider.
- Payment status must not be considered successful until confirmed by the payment provider.
- Subscription activation must depend on confirmed payment or an approved trial.
- Duplicate payment processing must be prevented.
- Payment records must be associated with the correct organization and subscription.
- Failed payments must not incorrectly activate paid features.

---

## Payment Failure

When payment fails:

```text
Payment Failed
    ↓
Notify Billing User
    ↓
Retry / Update Payment Method
    ↓
Payment Succeeds
```

The organization may remain active during a defined grace period depending on the billing policy.

---

## Refunds

Refunds may be:

- Full
- Partial

Refund processing must update the associated payment and billing records.

---

## Permissions

| Action | Owner | Admin | Other Members |
| :--- | :---: | :---: | :---: |
| Initiate Subscription Payment | ✅ | Based on Permission | ❌ |
| Retry Failed Payment | ✅ | Based on Permission | ❌ |
| View Payment Status | ✅ | Based on Permission | ❌ |
| Request Refund | ✅ | Based on Permission | ❌ |

---

## Security

- Payment data must be handled by compliant payment infrastructure.
- Sensitive card information must not be exposed through ScaleUP.
- Payment confirmations must be verified.
- Payment events should be auditable.

---

## Notifications

- Payment initiated
- Payment successful
- Payment failed
- Payment refunded
- Payment requires attention

---

## Edge Cases

- Payment provider times out.
- User closes payment flow before completion.
- Payment succeeds but callback is delayed.
- Duplicate payment request occurs.
- Payment is later refunded.
- Subscription status and payment status become temporarily inconsistent.

---

## Success Criteria

Organizations should be able to securely complete subscription payments and have their subscription status accurately reflect confirmed payment results.