# Sales Specification

## Purpose

The Sales module allows organizations to record and monitor sales activity.

Its purpose is to provide an organized record of revenue-generating transactions and support sales analysis, reporting, and business performance monitoring.

---

## Overview

A Sale represents a business revenue event recorded by an organization.

Sales may optionally reference:

- Customer
- Product
- Service
- Quantity
- Price
- Discount
- Tax
- Payment information

The exact accounting treatment of sales will be defined separately if advanced accounting is introduced.

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

- Record sale
- View sales
- Edit sales
- Delete or void sales
- Search sales
- Filter sales
- View sales details
- Sales summary

### Future Scope

- Invoicing
- Recurring sales
- POS integration
- Payment gateway integration
- Sales returns
- Advanced tax handling

---

## Main Flow

```text
Create Sale
    ↓
Enter Sale Details
    ↓
Validate Data
    ↓
Save Sale
    ↓
Update Business Summary
    ↓
Available in Reports and Dashboard
```

---

## Sale Information

Potential information:

- Sale Date
- Customer
- Product / Service
- Quantity
- Unit Price
- Discount
- Tax
- Total Amount
- Payment Status
- Reference Number
- Notes

---

## Rules

- Every sale must belong to an organization.
- Sale amounts must use the organization's configured currency.
- Required fields must be validated before saving.
- A sale cannot belong to another organization.
- Users may only edit or delete sales they are authorized to manage.
- Financial totals must be calculated consistently.
- Historical sales should remain traceable after related master data changes.

---

## Sale Status

Possible statuses:

- Draft
- Completed
- Cancelled
- Voided

The final statuses may depend on future accounting requirements.

---

## Permissions

| Action | Owner | Admin | Manager | Member | Viewer |
| :--- | :---: | :---: | :---: | :---: | :---: |
| View Sales | ✅ | ✅ | ✅ | Based on Permission | ✅/❌ |
| Create Sale | ✅ | ✅ | ✅ | Based on Permission | ❌ |
| Edit Sale | ✅ | ✅ | ✅ | Based on Permission | ❌ |
| Delete / Void Sale | ✅ | ✅ | Based on Permission | ❌ | ❌ |
| Export Sales | ✅ | ✅ | Based on Permission | Based on Permission | Based on Permission |

---

## Customer Relationship

A sale may reference a customer.

If the customer record is deleted or archived, historical sales must remain understandable.

---

## Product Relationship

A sale may reference a product or service.

Historical sales should preserve the relevant transaction values even if the product's current price changes later.

---

## Notifications

Sales may trigger:

- Business activity notifications
- Sales threshold alerts
- Goal progress updates
- Reporting events

---

## Edge Cases

- Sale references deleted customer.
- Sale references archived product.
- Sale contains zero or invalid quantity.
- User attempts to create a sale outside the active organization.
- Sale is modified after reporting.
- User lacks permission to edit financial records.

---

## Success Criteria

Organizations should be able to record and monitor sales accurately and use the resulting data for business summaries, reports, goals, and analytics.
