# Business Management Specification

## Purpose

The Business Management domain provides organizations with the core capabilities required to record, organize, monitor, and understand their day-to-day business activities.

Its purpose is to give organizations a centralized operational view while creating the foundation for business planning, analytics, and reporting.

---

## Overview

Business Management is available within the private Organization Workspace.

It is organization-owned and organization-scoped.

The domain provides the foundation for:

- Sales
- Expenses
- Transactions
- Customers
- Products
- Business Dashboard
- Future Business Operations

Business Management must remain separate from the public ScaleUP Community.

---

## Actors

- Organization Owner
- Organization Administrator
- Organization Manager
- Organization Member
- Organization Viewer

---

## Scope

### In Scope

- Business dashboard
- Sales tracking
- Expense tracking
- Transaction management
- Customer records
- Product records
- Business summaries
- Operational activity

### Future Scope

- Inventory
- Purchasing
- Suppliers
- Invoicing
- Accounts receivable
- Accounts payable
- Payroll
- CRM
- Point of Sale
- Advanced accounting

---

## Business Context

All business information belongs to a specific organization.

```text
Organization
    ↓
Business Data
    ├── Sales
    ├── Expenses
    ├── Transactions
    ├── Customers
    └── Products
```

A user can only access business information according to the active organization's membership, permissions, and subscription entitlements.

---

## Rules

### Organization Ownership

- Business data must always belong to an organization.
- Business data must not belong directly to an individual user.
- Users access business data through organization membership.
- Business records from one organization must never be visible to another organization.

### Data Isolation

- Organization data must be isolated.
- Queries and business operations must always operate within the active organization context.
- A user with access to multiple organizations must see only the selected organization's data.

### Permissions

- Business actions must respect organization roles and permissions.
- Read access does not automatically grant create, update, or delete access.
- Sensitive business information should require appropriate permissions.

### Subscription

- Business Management requires an eligible Organization Workspace subscription.
- Feature access must follow subscription entitlements.
- Subscription status must not affect ownership of historical business data.

---

## Business Lifecycle

```text
Organization Activated
        ↓
Business Setup
        ↓
Business Records Created
        ↓
Business Activity Recorded
        ↓
Performance Monitored
        ↓
Business Insights
        ↓
Planning & Growth
```

---

## Data Principles

### Accurate

Business records should represent reliable business information.

### Traceable

Important business changes should be auditable where required.

### Consistent

Business calculations and summaries should use consistent rules.

### Organization-Scoped

All business records must belong to the correct organization.

### Extensible

The domain should support future business modules without restructuring its core ownership model.

---

## Permissions

| Capability | Owner | Administrator | Manager | Accountant | Member | Viewer |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| View Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Business Data | ✅ | ✅ | ✅ | ✅ | Based on Permission | ✅/❌ |
| Create Records | ✅ | ✅ | ✅ | ✅ | Based on Permission | ❌ |
| Edit Records | ✅ | ✅ | ✅ | ✅ | Based on Permission | ❌ |
| Delete Records | ✅ | ✅ | Based on Permission | ❌ | ❌ | ❌ |
| Export Data | ✅ | ✅ | Based on Permission | ✅ | Based on Permission | Based on Permission |

---

## Notifications

Business activities may generate notifications for:

- Important business changes
- Goal or KPI events
- Large transaction activity
- Business alerts
- Approval events
- Subscription-related access changes

---

## Edge Cases

- User changes organization while viewing business data.
- User loses organization membership during an active session.
- User's role changes while performing an action.
- Organization subscription expires.
- A business record is referenced by another record that is deleted.
- Organization is suspended or archived.

---

## Success Criteria

Organizations should have a secure and centralized environment where authorized members can record and understand their business activities while maintaining strong data isolation, permission control, and a foundation for future growth features.
