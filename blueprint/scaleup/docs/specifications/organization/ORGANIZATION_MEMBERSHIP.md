# Organization Membership Specification

## Purpose

The Organization Membership module manages the relationship between individual users and organizations.

Its purpose is to allow organizations to collaborate with multiple users while maintaining clear ownership, roles, permissions, and membership status.

---

## Overview

A user may belong to multiple organizations.

Membership connects an Individual Account to an Organization but does not change or replace the user's personal identity.

---

## Main Flow

```text
User Invited
    ↓
Invitation Accepted
    ↓
Membership Created
    ↓
Role Assigned
    ↓
Organization Access Granted
```

---

## Rules

- A membership must belong to one user and one organization.
- A user may have memberships in multiple organizations.
- A membership must have a defined status.
- A membership must have an assigned role.
- Removing membership removes organization access.
- Removing a user from one organization must not affect their membership in other organizations.
- An organization must always retain at least one owner.

---

## Membership States

```text
Invited
    ↓
Active
```

Additional states:

- Suspended
- Removed
- Declined

---

## Permissions

Membership permissions are determined by the user's organization role.

A membership alone does not grant unrestricted organization access.

---

## Success Criteria

Organizations should be able to manage members securely while users can participate in multiple organizations with independent roles and access levels.