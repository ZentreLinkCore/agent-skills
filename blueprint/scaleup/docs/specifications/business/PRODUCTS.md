# Products Specification

## Purpose

The Products module allows organizations to maintain structured records of the products or services they offer.

Its purpose is to provide a centralized product catalog that can be referenced by sales, reporting, and future inventory capabilities.

---

## Overview

A Product represents a product or service offered by an organization.

A product may contain:

- Name
- Description
- Type
- SKU
- Unit
- Price
- Status
- Category

Products belong exclusively to their organization.

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

- Create product
- View product
- Edit product
- Archive product
- Search products
- Filter products
- Product categories
- Product pricing
- Product relationship to sales

### Future Scope

- Inventory
- Stock levels
- Warehouses
- Suppliers
- Purchasing
- Product variants
- Barcode management
- Product bundles

---

## Main Flow

```text
Create Product
    ↓
Enter Product Information
    ↓
Validate Data
    ↓
Save Product
    ↓
Product Available
    ↓
Reference in Sales
```

---

## Product Information

Potential information:

- Product Name
- Description
- Product Type
- SKU
- Category
- Unit
- Default Price
- Currency
- Status
- Notes

---

## Product Types

Initial types:

- Product
- Service

Future types may include:

- Subscription
- Bundle
- Digital Product

---

## Product Status

Possible statuses:

- Active
- Inactive
- Archived

---

## Rules

- Every product belongs to one organization.
- Products must not be accessible across organizations.
- Product names and identifiers should follow organization-defined uniqueness rules.
- A product referenced by historical sales should not be permanently removed without considering historical data integrity.
- Archiving should be preferred over deletion when historical references exist.
- Changing the current product price must not automatically rewrite historical sales values.

---

## Permissions

| Action | Owner | Admin | Manager | Member | Viewer |
| :--- | :---: | :---: | :---: | :---: | :---: |
| View Products | ✅ | ✅ | ✅ | Based on Permission | ✅/❌ |
| Create Product | ✅ | ✅ | ✅ | Based on Permission | ❌ |
| Edit Product | ✅ | ✅ | ✅ | Based on Permission | ❌ |
| Archive Product | ✅ | ✅ | Based on Permission | ❌ | ❌ |
| Export Products | ✅ | ✅ | Based on Permission | Based on Permission | Based on Permission |

---

## Sales Relationship

Products may be referenced by sales records.

```text
Product
   ↓
Sales
   ├── Sale 1
   ├── Sale 2
   └── Sale 3
```

Historical sales should preserve the values applicable at the time of the sale.

---

## Pricing

The product may have a default current price.

The default price should be used as a reference and must not overwrite historical transaction values.

Future pricing capabilities may include:

- Multiple price levels
- Customer-specific pricing
- Promotional pricing
- Currency-specific pricing

---

## Privacy

Product information is organization-owned business data unless intentionally published through supported public features.

---

## Edge Cases

- Product is archived while historical sales exist.
- Product price changes after previous sales.
- Duplicate SKU is entered.
- Product category is removed.
- User loses product management permission.
- Product is referenced by a pending sale.

---

## Success Criteria

Organizations should be able to maintain a reliable catalog of products and services that can support sales operations and serve as the foundation for future inventory and commerce capabilities.
