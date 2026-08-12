# ScaleUP Permission Matrix

## Overview

ScaleUP uses separate permission contexts for:

1. **Platform / Community**
2. **Organization**
3. **Subscription**

A user's community permissions are independent from their organization permissions.

Organization permissions determine what a member can access or perform inside a specific organization.

---

## 1. Platform Roles

All users begin as individuals.

There is no requirement for a user to own or belong to an organization.

#### Individual Capabilities

| Capability | Individual |
| :--- | :---: |
| Manage own profile | ✅ |
| View community feed | ✅ |
| Create personal posts | ✅ |
| Comment | ✅ |
| React | ✅ |
| Manage connections | ✅ |
| Follow organizations | ✅ |
| View public organization profiles | ✅ |
| Send messages | ✅ |
| Discover opportunities | ✅ |
| Create organization | ✅* |

`*` Creating an organization starts the organization subscription flow.

---

## 2. Organization Roles

Initial organization roles:

- Owner
- Administrator
- Manager
- Accountant
- Member
- Viewer

Roles are listed in descending order of authority. Accountant sits between Manager
and Member: broader than a Member on financial records, narrower than a Manager in
that it never touches members, settings, or the subscription.

---

## 3. Organization Access Matrix

| Capability | Owner | Administrator | Manager | Accountant | Member | Viewer |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| View organization workspace | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View business data | ✅ | ✅ | ✅ | ✅ | ✅ | ✅/❌ |
| Create business records | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit business records | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete business records | ✅ | ✅ | Limited | ❌ | ❌ | ❌ |
| View reports | ✅ | ✅ | ✅ | ✅ | ✅/❌ | ✅/❌ |
| Export reports | ✅ | ✅ | ✅ | ✅ | ✅/❌ | ✅/❌ |
| View analytics | ✅ | ✅ | ✅ | ✅ | ✅/❌ | ✅/❌ |
| Manage goals | ✅ | ✅ | ✅ | ❌ | ✅/❌ | ❌ |
| Manage KPIs | ✅ | ✅ | ✅ | ❌ | ✅/❌ | ❌ |
| Invite members | ✅ | ✅ | ✅/❌ | ❌ | ❌ | ❌ |
| Manage member roles | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Remove members | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage organization settings | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View billing and invoices | ✅ | ✅/❌ | ❌ | ✅ | ❌ | ❌ |
| Manage subscription | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Cancel organization | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

`✅/❌` indicates a capability that should eventually be configurable through granular permissions.

`Limited` indicates a capability restricted in scope rather than granted outright.

### Seeded Defaults

Until the granular permission system exists, every `✅/❌` cell is seeded as **denied**, with two deliberate exceptions recorded in [`schema_correction.md`](../../../specs/scaleup/organization/schema_correction.md):

- **Member** receives `Create` and `Edit business records`. A Member "performs assigned organization activities" — a read-only Member is a Viewer.
- **Manage subscription** is Owner-only. Spending money is not delegable by default, so it is withheld from Administrator.
- **Accountant** receives `View billing and invoices`. Recording the ScaleUP subscription as a business expense — and substantiating it for tax — requires the invoice, so withholding it would block the role's core responsibility. Read-only: changing, paying for, or cancelling the plan stays Owner-only. Note this is deliberately *not* hierarchical — an Administrator's authority is over people and settings, not the books.

Seeded permission counts: Owner 21, Administrator 18, Manager 14, Accountant 12, Member 8, Viewer 6.

---

## 4. Ownership Rules

### Owner

The Owner has the highest level of organization authority.

#### Can

- Manage organization
- Manage subscription
- Manage administrators
- Manage members
- Manage roles
- Access all business data
- Configure organization settings
- Transfer ownership
- Cancel organization subscription

---

## 5. Administrator

Administrators manage day-to-day organization administration.

#### Can

- Manage members
- Invite users
- Assign allowed roles
- Manage organization settings
- Access business features based on assigned permissions

#### Cannot

- Transfer ownership unless explicitly permitted
- Perform owner-only subscription or account actions unless granted

---

## 6. Manager

Managers oversee operational activities within assigned areas.

#### Typical Access

- Dashboard
- Business data
- Sales
- Expenses
- Planning
- Reports
- Team activities

Manager access should become configurable per organization.

---

## 7. Accountant

Accountants record and report on the organization's financial activity.

#### Typical Access

- Dashboard
- Sales, expenses, and transactions — view, create, and edit
- Customers and products
- Analytics
- Reports, including export
- View goals and KPIs
- View subscription billing, invoices, and billing history

#### Restrictions

- No deleting or voiding financial records — history is corrected by entry, not erased
- No member management
- No organization settings
- No changing, paying for, or cancelling the subscription — billing is **readable**, not manageable
- No managing goals or KPIs

---

## 8. Member

Members perform assigned operational activities.

#### Typical Access

- View assigned business areas
- Create permitted records
- Edit permitted records
- Participate in organization collaboration

Members should not automatically receive access to sensitive financial or administrative features.

---

## 9. Viewer

Viewers have read-only access.

#### Typical Access

- View dashboard
- View approved business records
- View approved reports
- View selected organization information

#### Restrictions

- No editing
- No deleting
- No member management
- No subscription management

---

## 10. Community Permissions

Organization roles do not automatically control community permissions.

#### User

| Community Action | Permission |
| :--- | :---: |
| View feed | ✅ |
| Create post | ✅ |
| Comment | ✅ |
| React | ✅ |
| Connect | ✅ |
| Follow organization | ✅ |
| Send message | ✅ |
| View public organization profile | ✅ |

Community actions remain tied to the user's personal identity.

---

## 11. Organization Content Permissions

Organizations may publish public-facing content while keeping internal data private.

| Action | Owner | Admin | Manager | Accountant | Member | Viewer |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Create organization post | ✅ | ✅ | ✅ | ❌ | Based on permission | ❌ |
| Edit own organization post | ✅ | ✅ | ✅ | ❌ | ✅/❌ | ❌ |
| Delete organization post | ✅ | ✅ | ✅/❌ | ❌ | ❌ | ❌ |
| Publish announcement | ✅ | ✅ | ✅/❌ | ❌ | ❌ | ❌ |
| Publish opportunity | ✅ | ✅ | ✅/❌ | ❌ | ✅/❌ | ❌ |

---

## 12. Subscription Permissions

Subscription status controls whether an organization can access paid workspace capabilities.

#### Active Subscription

Organization may access subscribed features.

#### Trial

Organization may access the features included within the trial period.

#### Past Due

Access depends on the defined billing policy.

#### Suspended

Organization workspace access is restricted according to the suspension policy.

#### Cancelled / Expired

Access to paid features is removed or restricted according to the retention policy.

---

## 13. Permission Principles

#### Least Privilege

Users should only receive the access required to perform their responsibilities.

#### Organization Isolation

A user may belong to multiple organizations, but organization data must remain isolated.

#### Context-Based Access

Permissions are evaluated within the currently selected organization.

#### Sensitive Data Protection

Financial, administrative, and operational information should require appropriate permissions.

#### Role Extensibility

The initial roles are defaults. The permission model should support more granular permissions in the future.

---

## 14. Multi-Organization Example

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

## 15. Permission Evaluation Principle

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

## 16. Future Permission Extensions

The permission system may later support:

- Custom Roles
- Feature-Level Permissions
- Module-Level Permissions
- Record-Level Permissions
- Department-Level Access
- Approval Permissions
- Financial Permissions
- Audit Permissions
- Temporary Permissions
- Delegated Access
