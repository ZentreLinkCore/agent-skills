# Organization Creation Specification

## Purpose

The Organization Creation module allows an individual ScaleUP user to create an organization and establish a subscription-based Organization Workspace.

Its purpose is to provide a controlled transition from the free Community Platform into the paid business environment of ScaleUP.

---

## Overview

Organizations are optional within ScaleUP.

Every user begins as an Individual Account and may continue using the Community Platform without creating an organization.

When a user chooses to create an organization, they enter the organization creation and subscription flow.

An organization is only activated after the required creation and subscription requirements are completed.

---

## Actors

- Individual User
- Organization Owner
- System
- Subscription Service

---

## Scope

### In Scope

- Start organization creation
- Enter organization information
- Select organization type
- Configure basic organization profile
- Select subscription plan
- Complete subscription
- Activate organization
- Assign creator as initial owner
- Open Organization Workspace

### Future Scope

- Organization verification
- Business registration verification
- Import organization data
- Guided business setup
- AI-assisted organization setup
- Organization templates

---

## Preconditions

Before creating an organization:

- User must have a valid ScaleUP account.
- User must be authenticated.
- User must satisfy account verification requirements.
- User must be allowed to create an organization according to platform policy.

---

## Main Flow

```text
Individual Account
    ↓
Create Organization
    ↓
Enter Organization Information
    ↓
Review Information
    ↓
Select Subscription Plan
    ↓
Complete Subscription
    ↓
Activate Organization
    ↓
Assign Creator as Owner
    ↓
Open Organization Workspace
```

---

## Organization Information

### Required Information

- Organization Name
- Organization Type
- Industry
- Country
- Primary Business Description

### Optional Information

- Logo
- Cover Image
- Website
- Business Email
- Contact Number
- Location
- Business Size
- Public Description

---

## Organization Types

Initial organization types may include:

- Business
- Startup
- Company
- Nonprofit
- Professional Organization
- Community
- Other

The list should remain configurable.

---

## Subscription Requirement

Creating an organization triggers the subscription process.

The user must:

1. Select an available subscription plan.
2. Review plan details.
3. Provide required billing information.
4. Complete payment or eligible trial activation.
5. Confirm the subscription.

The organization is activated only when the required subscription condition has been satisfied.

---

## Rules

### Organization Identity Rules

- Each organization must have a unique platform identifier.
- Organization name uniqueness should follow the platform's defined policy.
- An organization must have at least one owner.
- The organization creator becomes the initial owner.
- A user may create multiple organizations if permitted by the subscription plan or platform policy.

### Account Separation Rules

- Creating an organization does not replace the user's Individual Account.
- The creator remains an individual user.
- The organization becomes a separate entity linked to the user through ownership or membership.
- Community activity remains associated with the user's personal identity unless intentionally published as an organization.

### Subscription Rules

- An organization requires an eligible subscription to access paid workspace capabilities.
- Subscription status controls organization workspace access.
- Subscription ownership belongs to the organization.
- Personal subscription status must not be confused with organization subscription status.
- Plan restrictions must be enforced when creating or managing an organization.

### Activation Rules

- An organization must not become active until required creation and subscription conditions are satisfied.
- Failed or incomplete subscription processes must not create an accessible active workspace.
- Cancelled or expired subscriptions may restrict workspace access according to subscription policy.

### Ownership Rules

- The organization creator becomes the initial Owner.
- Ownership must remain associated with at least one authorized user.
- Ownership transfer must follow defined organization policies.
- The platform must prevent removal of the final organization owner.

---

## Permissions

| Action | Visitor | Individual User | Org Owner | Org Admin |
| :--- | :---: | :---: | :---: | :---: |
| Start Organization Creation | ❌ | ✅ | ❌ | ❌ |
| Enter Organization Information | ❌ | ✅ | ✅ | ✅ |
| Select Subscription | ❌ | ✅ | ✅ | ❌ |
| Complete Organization Setup | ❌ | ✅ | ✅ | Based on Permission |
| Activate Organization | ❌ | ✅ | ✅ | ❌ |
| Manage Organization After Creation | ❌ | ❌ | ✅ | Based on Permission |

---

## Organization Creation States

```text
Not Started
    ↓
Draft
    ↓
Pending Subscription
    ↓
Payment Processing
    ↓
Active
```

Possible additional states:

- Payment Failed
- Suspended
- Cancelled
- Expired
- Archived

---

## Failure Scenarios

The creation process should handle:

- Invalid organization information
- Duplicate organization name where restricted
- Subscription payment failure
- Subscription cancellation before activation
- Session expiration
- Network failure
- User abandoning the creation flow
- Invalid or unavailable subscription plan

---

## Draft Handling

- The platform may preserve incomplete organization creation data.
- A user may return to continue the setup without restarting the entire process.
- Draft information must only be visible to the user who created it.

---

## Post-Creation Flow

After successful activation:

```text
Organization Activated
    ↓
Welcome / Setup
    ↓
Organization Workspace
    ↓
Configure Organization
    ↓
Invite Team
    ↓
Begin Business Management
```

The user should be able to access the Community Platform independently from the Organization Workspace.

---

## Notifications

Organization creation may generate:

- Organization created confirmation
- Subscription activated confirmation
- Payment confirmation
- Workspace ready notification
- Setup reminders

---

## Privacy

- Organization creation information must be treated according to its intended visibility.
- Private setup information must not automatically become public.
- Public organization information should only be exposed after the organization is active and the relevant information is marked as public.

---

## Edge Cases

- User starts organization creation and exits before payment.
- User completes payment but organization activation fails.
- User retries after a successful payment.
- User's subscription is activated but workspace provisioning fails.
- User attempts to create an organization while an existing creation process is still pending.
- User loses account access during organization creation.
- Organization creation is completed but the creator's session expires.
- User reaches a subscription limit for organization creation.

---

## Success Criteria

An eligible individual user should be able to create an organization, select and activate an appropriate subscription, become its initial owner, and enter a functioning Organization Workspace without losing or replacing their individual ScaleUP identity.