# Customers Specification

## Purpose

The Customers module allows organizations to maintain structured records of the people or entities that purchase their products or services.

Its purpose is to provide a centralized customer reference for sales, business analysis, and future customer relationship capabilities.

---

## Overview

A Customer belongs to an organization.

A customer may be:

- Individual
- Company
- Organization
- Other business entity

Customer information can be referenced by sales and future CRM capabilities.

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

- Create customer
- View customer
- Edit customer
- Archive customer
- Search customers
- Filter customers
- Customer details
- Customer relationship to sales

### Future Scope

- Customer communication
- CRM
- Customer segmentation
- Customer lifecycle
- Customer portal
- Customer analytics
- Customer support

---

## Main Flow

```text
Create Customer
    ↓
Enter Customer Information
    ↓
Validate Data
    ↓
Save Customer
    ↓
Customer Available
    ↓
Reference in Sales and Business Records
```

---

## Customer Information

Potential information:

- Customer Type
- Name
- Company Name
- Email
- Contact Number
- Address
- Industry
- Notes
- Status

---

## Customer Types

Possible types:

- Individual
- Business
- Organization

---

## Customer Status

Possible statuses:

- Active
- Inactive
- Archived

---

## Rules

- Every customer belongs to one organization.
- A customer record must not be accessible across organizations.
- Duplicate customer prevention should be considered.
- Customer records should not be permanently deleted when historical business records depend on them unless explicitly allowed.
- Archiving should be preferred where historical relationships must be maintained.
- Contact information must follow privacy requirements.

---

## Permissions

| Action | Owner | Admin | Manager | Member | Viewer |
| :--- | :---: | :---: | :---: | :---: | :---: |
| View Customers | ✅ | ✅ | ✅ | Based on Permission | ✅/❌ |
| Create Customer | ✅ | ✅ | ✅ | Based on Permission | ❌ |
| Edit Customer | ✅ | ✅ | ✅ | Based on Permission | ❌ |
| Archive Customer | ✅ | ✅ | Based on Permission | ❌ | ❌ |
| Export Customers | ✅ | ✅ | Based on Permission | Based on Permission | Based on Permission |

---

## Sales Relationship

A customer may have multiple sales records.

```text
Customer
   ↓
Sales
   ├── Sale 1
   ├── Sale 2
   └── Sale 3
```

Customer information may be used to provide:

- Sales history
- Purchase summaries
- Customer activity

---

## Privacy

Customer information is organization-owned business data and must not be exposed to public community users.

---

## Edge Cases

- Customer is archived while historical sales exist.
- Duplicate customer is created.
- Customer changes company information.
- User loses access to customer records.
- Customer information is incomplete.
- Organization is archived.

---

## Success Criteria

Organizations should be able to maintain a reliable customer directory that supports sales tracking and provides a foundation for future customer relationship capabilities.
