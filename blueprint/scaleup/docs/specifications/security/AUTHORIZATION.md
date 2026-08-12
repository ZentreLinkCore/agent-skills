# Authorization Specification

## Purpose

The Authorization module controls what authenticated users are allowed to access and perform within ScaleUP.

Its purpose is to ensure that authentication alone does not grant access to resources beyond the user's permissions.

---

## Overview

Authorization operates after authentication and evaluates access based on context.

```text
Authenticated User
        ↓
Organization Context
        ↓
Membership
        ↓
Role
        ↓
Permission
        ↓
Resource Ownership
        ↓
Access Decision
```

---

## Authorization Contexts

### Platform Context

Controls access to:

- User profile
- Community content
- Connections
- Messaging
- Public opportunities

### Organization Context

Controls access to:

- Organization workspace
- Members
- Business data
- Planning
- Analytics
- Reports

### Subscription Context

Controls access to:

- Paid organization features
- Usage limits
- Advanced capabilities

---

## Rules

- Authentication does not automatically grant resource access.
- Every protected resource must have an authorization check.
- Authorization must be evaluated within the active organization context.
- A user's permissions in one organization must not grant access to another organization.
- Public resources may be accessed without organization membership when permitted.
- Private resources require explicit authorization.
- Subscription entitlements must be evaluated separately from user permissions.

---

## Permission Evaluation

```text
User Authenticated?
      ↓
Organization Selected?
      ↓
Membership Valid?
      ↓
Role Valid?
      ↓
Permission Granted?
      ↓
Subscription Entitlement Available?
      ↓
Resource Accessible?
```

A failed security check must result in access denial.

---

## Resource Ownership

Resources should be associated with their appropriate owner.

Examples:

- User-owned content → User
- Organization-owned content → Organization
- Organization business data → Organization

---

## Cross-Organization Protection

A user belonging to multiple organizations must never access another organization's private resources unless they have valid membership and permission for that organization.

---

## Permission Changes

When a user's role or membership changes:

- New permissions must take effect according to platform policy.
- Removed permissions must no longer provide access.
- Active sessions may require permission refresh.

---

## Administrative Access

Platform administrators may have elevated access only for explicitly authorized administrative purposes.

Administrative access should be:

- Restricted
- Auditable
- Justified
- Limited to necessary resources

---

## Edge Cases

- User is removed from an organization during an active session.
- User changes organization context.
- User role is downgraded.
- Subscription expires.
- Resource is deleted after authorization is granted.
- Organization is suspended.

---

## Success Criteria

No user should be able to access or modify a resource beyond the permissions granted by their identity, organization membership, role, and applicable subscription entitlements.