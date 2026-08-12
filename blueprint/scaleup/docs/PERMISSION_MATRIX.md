# ScaleUP Permission Matrix

## Overview

ScaleUP uses separate permission contexts for:

1. **Platform / Community**
2. **Organization**
3. **Subscription**

A user's community permissions are independent from their organization permissions.

Organization permissions determine what a member can access or perform inside a specific organization.

---

# 1. Platform Roles

All users begin as individuals.

There is no requirement for a user to own or belong to an organization.

### Individual Capabilities

| Capability                        | Individual |
| --------------------------------- | ---------: |
| Manage own profile                |          ✅ |
| View community feed               |          ✅ |
| Create personal posts             |          ✅ |
| Comment                           |          ✅ |
| React                             |          ✅ |
| Manage connections                |          ✅ |
| Follow organizations              |          ✅ |
| View public organization profiles |          ✅ |
| Send messages                     |          ✅ |
| Discover opportunities            |          ✅ |
| Create organization               |         ✅* |

`*` Creating an organization starts the organization subscription flow.

---

# 2. Organization Roles

Initial organization roles:

* Owner
* Administrator
* Manager
* Member
* Viewer

---

# 3. Organization Access Matrix

| Capability                   | Owner | Administrator | Manager |              Member | Viewer |
| ---------------------------- | ----: | ------------: | ------: | ------------------: | -----: |
| View organization workspace  |     ✅ |             ✅ |       ✅ |                   ✅ |      ✅ |
| View dashboard               |     ✅ |             ✅ |       ✅ |                   ✅ |      ✅ |
| View business data           |     ✅ |             ✅ |       ✅ | Based on permission |    ✅/❌ |
| Create business records      |     ✅ |             ✅ |       ✅ |                 ✅/❌ |      ❌ |
| Edit business records        |     ✅ |             ✅ |       ✅ |                 ✅/❌ |      ❌ |
| Delete business records      |     ✅ |             ✅ | Limited |                   ❌ |      ❌ |
| View reports                 |     ✅ |             ✅ |       ✅ |                 ✅/❌ |    ✅/❌ |
| Manage goals                 |     ✅ |             ✅ |       ✅ |                 ✅/❌ |      ❌ |
| Manage KPIs                  |     ✅ |             ✅ |       ✅ |                 ✅/❌ |      ❌ |
| Invite members               |     ✅ |             ✅ |     ✅/❌ |                   ❌ |      ❌ |
| Manage member roles          |     ✅ |             ✅ |       ❌ |                   ❌ |      ❌ |
| Remove members               |     ✅ |             ✅ |       ❌ |                   ❌ |      ❌ |
| Manage organization settings |     ✅ |             ✅ |       ❌ |                   ❌ |      ❌ |
| Manage subscription          |     ✅ |           ✅/❌ |       ❌ |                   ❌ |      ❌ |
| Cancel organization          |     ✅ |             ❌ |       ❌ |                   ❌ |      ❌ |

`✅/❌` indicates a capability that should eventually be configurable through granular permissions.

---

# 4. Ownership Rules

## Owner

The Owner has the highest level of organization authority.

### Can

* Manage organization
* Manage subscription
* Manage administrators
* Manage members
* Manage roles
* Access all business data
* Configure organization settings
* Transfer ownership
* Cancel organization subscription

---

# 5. Administrator

Administrators manage day-to-day organization administration.

### Can

* Manage members
* Invite users
* Assign allowed roles
* Manage organization settings
* Access business features based on assigned permissions

### Cannot

* Transfer ownership unless explicitly permitted
* Perform owner-only subscription or account actions unless granted

---

# 6. Manager

Managers oversee operational activities within assigned areas.

### Typical Access

* Dashboard
* Business data
* Sales
* Expenses
* Planning
* Reports
* Team activities

Manager access should become configurable per organization.

---

# 7. Member

Members perform assigned operational activities.

### Typical Access

* View assigned business areas
* Create permitted records
* Edit permitted records
* Participate in organization collaboration

Members should not automatically receive access to sensitive financial or administrative features.

---

# 8. Viewer

Viewers have read-only access.

### Typical Access

* View dashboard
* View approved business records
* View approved reports
* View selected organization information

### Restrictions

* No editing
* No deleting
* No member management
* No subscription management

---

# 9. Community Permissions

Organization roles do not automatically control community permissions.

### User

| Community Action                 | Permission |
| -------------------------------- | ---------: |
| View feed                        |          ✅ |
| Create post                      |          ✅ |
| Comment                          |          ✅ |
| React                            |          ✅ |
| Connect                          |          ✅ |
| Follow organization              |          ✅ |
| Send message                     |          ✅ |
| View public organization profile |          ✅ |

Community actions remain tied to the user's personal identity.

---

# 10. Organization Content Permissions

Organizations may publish public-facing content while keeping internal data private.

| Action                     | Owner | Admin | Manager |              Member | Viewer |
| -------------------------- | ----: | ----: | ------: | ------------------: | -----: |
| Create organization post   |     ✅ |     ✅ |       ✅ | Based on permission |      ❌ |
| Edit own organization post |     ✅ |     ✅ |       ✅ |                 ✅/❌ |      ❌ |
| Delete organization post   |     ✅ |     ✅ |     ✅/❌ |                   ❌ |      ❌ |
| Publish announcement       |     ✅ |     ✅ |     ✅/❌ |                   ❌ |      ❌ |
| Publish opportunity        |     ✅ |     ✅ |     ✅/❌ |                 ✅/❌ |      ❌ |

---

# 11. Subscription Permissions

Subscription status controls whether an organization can access paid workspace capabilities.

### Active Subscription

Organization may access subscribed features.

### Trial

Organization may access the features included within the trial period.

### Past Due

Access depends on the defined billing policy.

### Suspended

Organization workspace access is restricted according to the suspension policy.

### Cancelled / Expired

Access to paid features is removed or restricted according to the retention policy.

---

# 12. Permission Principles

### Least Privilege

Users should only receive the access required to perform their responsibilities.

### Organization Isolation

A user may belong to multiple organizations, but organization data must remain isolated.

### Context-Based Access

Permissions are evaluated within the currently selected organization.

### Sensitive Data Protection

Financial, administrative, and operational information should require appropriate permissions.

### Role Extensibility

The initial roles are defaults. The permission model should support more granular permissions in the future.

---

# 13. Multi-Organization Example

A user may have different permissions in different organizations.

```text
John Doe

ABC Coffee
Role: Owner

XYZ Consulting
Role: Finance Manager

Startup Group
Role: Viewer
```

His access is evaluated independently for each organization.

For example:

```text
ABC Coffee
→ Full administrative access

XYZ Consulting
→ Financial and reporting access

Startup Group
→ Read-only access
```

---

# 14. Permission Evaluation Principle

Every organization request should conceptually follow:

```text
Authenticated User
        ↓
Active Organization
        ↓
Membership
        ↓
Role
        ↓
Permission
        ↓
Resource Ownership
        ↓
Access Granted / Denied
```

This ensures that users can only access resources allowed by both their organization membership and assigned permissions.

---

# 15. Future Permission Extensions

The permission system may later support:

* Custom Roles
* Feature-Level Permissions
* Module-Level Permissions
* Record-Level Permissions
* Department-Level Access
* Approval Permissions
* Financial Permissions
* Audit Permissions
* Temporary Permissions
* Delegated Access
