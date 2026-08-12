# Subscription Specifications

Subscription specifications cover the commercial model that unlocks the Organization Workspace — plans, entitlements, payments, billing, and the lifecycle a subscription moves through.

---

## Specifications

| Document | Purpose |
| :--- | :--- |
| [SUBSCRIPTION_OVERVIEW.md](./SUBSCRIPTION_OVERVIEW.md) | The organization-based subscription model and the rules shared by every module below |
| [SUBSCRIPTION_PLANS.md](./SUBSCRIPTION_PLANS.md) | The plans available to organizations and what each includes |
| [SUBSCRIPTION_LIFECYCLE.md](./SUBSCRIPTION_LIFECYCLE.md) | How a subscription moves between states from creation through expiration |
| [FEATURE_ENTITLEMENTS.md](./FEATURE_ENTITLEMENTS.md) | Which capabilities a plan grants, and how access is evaluated |
| [PAYMENTS.md](./PAYMENTS.md) | The payment process that activates and maintains a subscription |
| [BILLING.md](./BILLING.md) | Billing information, invoices, cycles, and billing status |

---

## Design Constraint

Subscriptions belong to Organizations, never to individual users — Community Platform access is always free. Nothing in this scope may gate a Community capability documented in [specifications/community](../community/).

See [BUSINESS_MODEL.md](../../BUSINESS_MODEL.md) for the commercial rationale and [ADR-002](../../decisions/ADR-002-subscription-model.md) for the underlying decision.
