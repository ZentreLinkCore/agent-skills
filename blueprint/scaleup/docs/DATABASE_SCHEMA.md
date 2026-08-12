# ScaleUP Database Schema

## Purpose

The Database Schema defines the physical data structure of the ScaleUP platform based on the domain model.

Its purpose is to provide a consistent, secure, and scalable relational database design that supports:

- Individual accounts
- Community
- Organizations
- Subscriptions
- Business Management
- Planning
- Analytics
- Security
- Future platform expansion

---

## Database Strategy

ScaleUP uses a relational database model.

### Initial Multi-Tenancy Strategy

ScaleUP will initially use:

> **Single Database + Shared Tables + Organization Scoping**

Organization-owned records must contain an `organization_id` or have a reliable organization relationship.

```text
Single Database
        │
        ├── User Data
        ├── Community Data
        ├── Organization A Data
        ├── Organization B Data
        ├── Organization C Data
        └── Platform Data
```

Organization-owned data must always be filtered by the active organization context.

---

## Core Principles

### User and Organization Separation

A User represents a person.

An Organization represents a business or group.

They must remain separate entities.

### Organization Isolation

Organization-owned records must never be accessible across organizations without explicit authorization.

### Referential Integrity

Relationships should use foreign keys where appropriate.

### Historical Integrity

Historical business records must preserve important values even when related master data changes.

### Auditability

Important actions and changes should be traceable.

### Extensibility

The schema should support future domains without requiring a complete redesign.

---

## 1. Identity Tables

### users

Stores the primary identity of every ScaleUP user.

**Key Fields:**
- `id`
- `first_name`
- `last_name`
- `email`
- `email_verified_at`
- `password`
- `status`
- `last_login_at`
- `created_at`
- `updated_at`
- `deleted_at`

**Rules:**
- `email` must be unique.
- Authentication secrets must be securely stored.
- Deleted accounts should use the platform's defined deletion policy.

### user_profiles

Stores professional profile information.

**Key Fields:**
- `id`
- `user_id`
- `profile_photo`
- `headline`
- `bio`
- `location`
- `industry`
- `job_title`
- `website`
- `visibility`
- `created_at`
- `updated_at`

**Relationship:**
```text
users
1 ─── 1
user_profiles
```

### user_settings

Stores user-specific preferences.

**Key Fields:**
- `id`
- `user_id`
- `theme`
- `language`
- `timezone`
- `notification_preferences`
- `privacy_preferences`
- `created_at`
- `updated_at`

### user_sessions

Stores active or historical authentication sessions where required.

**Key Fields:**
- `id`
- `user_id`
- `session_identifier`
- `device_name`
- `ip_address`
- `user_agent`
- `last_activity_at`
- `expires_at`
- `created_at`
- `updated_at`

---

## 2. Organization Tables

### organizations

Stores organizations created within ScaleUP.

**Key Fields:**
- `id`
- `name`
- `slug`
- `type`
- `industry`
- `country`
- `description`
- `status`
- `timezone`
- `currency`
- `created_at`
- `updated_at`
- `deleted_at`

**Rules:**
- `slug` should be unique where used for public URLs.
- Organization status must be controlled.
- Organization records must not be exposed unless visibility allows it.

### organization_profiles

Stores public-facing organization information.

**Key Fields:**
- `id`
- `organization_id`
- `logo`
- `cover_image`
- `public_description`
- `website`
- `contact_email`
- `contact_number`
- `location`
- `visibility`
- `created_at`
- `updated_at`

**Relationship:**
```text
organizations
1 ─── 1
organization_profiles
```

### organization_members

Connects users to organizations.

**Key Fields:**
- `id`
- `organization_id`
- `user_id`
- `role_id`
- `status`
- `joined_at`
- `created_at`
- `updated_at`
- `deleted_at`

**Relationship:**
```text
users
N ─── M
organizations

through organization_members
```

**Rules:**
- A user may belong to multiple organizations.
- A membership is unique per user and organization.
- At least one active owner must exist per organization.
- Recommended unique constraint: `unique (organization_id, user_id)`

### organization_roles

Stores organization roles.

**Key Fields:**
- `id`
- `organization_id`
- `name`
- `description`
- `is_system_role`
- `created_at`
- `updated_at`

System roles may include:
- Owner
- Administrator
- Manager
- Accountant
- Member
- Viewer

System roles carry a null `organization_id` and `is_system_role = true`, so a single set is shared by every organization rather than copied into each one. A non-null `organization_id` marks a custom role belonging to that one organization.

Future custom roles may be organization-specific.

### permissions

Stores available platform permissions.

**Key Fields:**
- `id`
- `name`
- `description`
- `module`
- `action`
- `created_at`
- `updated_at`

Examples:
- `business.sales.view`
- `business.sales.create`
- `business.sales.update`
- `business.sales.delete`
- `planning.goals.view`
- `planning.goals.create`
- `analytics.view`
- `reports.export`

### role_permissions

Associates roles with permissions.

**Key Fields:**
- `id`
- `role_id`
- `permission_id`
- `created_at`

**Relationship:**
```text
organization_roles
N ─── M
permissions

through role_permissions
```

---

## 3. Organization Invitations

### organization_invitations

Stores invitations sent to potential organization members.

**Key Fields:**
- `id`
- `organization_id`
- `invited_by`
- `email`
- `role_id`
- `token`
- `status`
- `expires_at`
- `accepted_at`
- `created_at`
- `updated_at`

**Statuses:**
- `pending`
- `accepted`
- `declined`
- `expired`
- `revoked`

---

## 4. Subscription Tables

### subscription_plans

Stores available ScaleUP subscription plans.

**Key Fields:**
- `id`
- `name`
- `slug`
- `description`
- `billing_interval`
- `price`
- `currency`
- `status`
- `created_at`
- `updated_at`

Possible plans:
- Starter
- Professional
- Business
- Enterprise

### subscriptions

Stores organization subscriptions.

**Key Fields:**
- `id`
- `organization_id`
- `plan_id`
- `status`
- `trial_ends_at`
- `starts_at`
- `current_period_start`
- `current_period_end`
- `cancel_at_period_end`
- `cancelled_at`
- `created_at`
- `updated_at`

**Relationship:**
```text
organizations
1 ─── N
subscriptions
```

Historical subscriptions should be retained where required.

### entitlements

Stores available feature entitlements.

**Key Fields:**
- `id`
- `key`
- `name`
- `description`
- `type`
- `created_at`
- `updated_at`

Examples:
- `organization.workspace`
- `business.sales`
- `business.expenses`
- `planning.goals`
- `analytics.advanced`
- `reports.custom`
- `integrations.api`

### plan_entitlements

Associates subscription plans with entitlements.

**Key Fields:**
- `id`
- `plan_id`
- `entitlement_id`
- `value`
- `created_at`
- `updated_at`

`value` may represent:
- Enabled / Disabled
- Numeric limit
- Text configuration
- JSON configuration

---

## 5. Community Tables

### posts

Stores posts created by users or organizations.

**Key Fields:**
- `id`
- `author_type`
- `author_id`
- `post_type`
- `content`
- `visibility`
- `status`
- `published_at`
- `edited_at`
- `created_at`
- `updated_at`
- `deleted_at`

**Polymorphic Ownership:**
`author_type` may represent:
- `user`
- `organization`

This allows both individuals and organizations to publish content.

### post_attachments

Stores files attached to posts.

**Key Fields:**
- `id`
- `post_id`
- `file_name`
- `file_path`
- `mime_type`
- `file_size`
- `sort_order`
- `created_at`
- `updated_at`

### post_mentions

Stores mentions within posts.

**Key Fields:**
- `id`
- `post_id`
- `mentioned_user_id`
- `created_at`

Future support may include organization mentions.

### comments

Stores comments on posts.

**Key Fields:**
- `id`
- `post_id`
- `user_id`
- `parent_id`
- `content`
- `status`
- `edited_at`
- `created_at`
- `updated_at`
- `deleted_at`

`parent_id` allows threaded replies.

### reactions

Stores user reactions to supported content.

**Key Fields:**
- `id`
- `user_id`
- `reactable_type`
- `reactable_id`
- `reaction_type`
- `created_at`
- `updated_at`

Recommended unique constraint:
`unique (user_id, reactable_type, reactable_id)`

### connections

Stores professional relationships between users.

**Key Fields:**
- `id`
- `requester_id`
- `recipient_id`
- `status`
- `accepted_at`
- `created_at`
- `updated_at`

**Rules:**
- A user cannot connect with themselves.

### follows

Stores one-way following relationships.

**Key Fields:**
- `id`
- `user_id`
- `followable_type`
- `followable_id`
- `created_at`

Supported targets:
- `user`
- `organization`

Recommended unique constraint:
`unique (user_id, followable_type, followable_id)`

---

## 6. Messaging Tables

### conversations

Stores private conversations.

**Key Fields:**
- `id`
- `type`
- `created_at`
- `updated_at`

Possible types:
- `direct`
- `group`
- `organization`

### conversation_participants

Associates users with conversations.

**Key Fields:**
- `id`
- `conversation_id`
- `user_id`
- `joined_at`
- `left_at`
- `created_at`
- `updated_at`

### messages

Stores messages.

**Key Fields:**
- `id`
- `conversation_id`
- `sender_id`
- `body`
- `status`
- `sent_at`
- `edited_at`
- `created_at`
- `updated_at`
- `deleted_at`

---

## 7. Notification Tables

### notifications

Stores user notifications.

**Key Fields:**
- `id`
- `user_id`
- `type`
- `title`
- `message`
- `notifiable_type`
- `notifiable_id`
- `read_at`
- `created_at`
- `updated_at`

### notification_preferences

Stores notification preferences.

**Key Fields:**
- `id`
- `user_id`
- `category`
- `channel`
- `enabled`
- `created_at`
- `updated_at`

---

## 8. Opportunity Tables

### opportunities

Stores business opportunities.

**Key Fields:**
- `id`
- `owner_type`
- `owner_id`
- `type`
- `title`
- `description`
- `industry`
- `location`
- `status`
- `deadline`
- `published_at`
- `created_at`
- `updated_at`
- `deleted_at`

`owner_type` may be:
- `user`
- `organization`

### opportunity_interests

Stores interest submitted by users or organizations.

**Key Fields:**
- `id`
- `opportunity_id`
- `interested_type`
- `interested_id`
- `status`
- `message`
- `created_at`
- `updated_at`

Possible statuses:
- `interested`
- `under_review`
- `in_discussion`
- `accepted`
- `declined`
- `closed`

---

## 9. Business Tables

All business tables must include `organization_id` either directly or through a guaranteed organization relationship.

### customers

**Key Fields:**
- `id`
- `organization_id`
- `type`
- `name`
- `company_name`
- `email`
- `phone`
- `address`
- `industry`
- `status`
- `notes`
- `created_at`
- `updated_at`
- `deleted_at`

### products

**Key Fields:**
- `id`
- `organization_id`
- `type`
- `name`
- `description`
- `sku`
- `category_id`
- `default_price`
- `currency`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

### product_categories

**Key Fields:**
- `id`
- `organization_id`
- `name`
- `description`
- `created_at`
- `updated_at`
- `deleted_at`

### sales

**Key Fields:**
- `id`
- `organization_id`
- `customer_id`
- `reference_number`
- `sale_date`
- `status`
- `subtotal`
- `discount`
- `tax`
- `total`
- `currency`
- `notes`
- `created_by`
- `created_at`
- `updated_at`
- `deleted_at`

### sale_items

Stores individual products or services within a sale.

**Key Fields:**
- `id`
- `sale_id`
- `product_id`
- `description`
- `quantity`
- `unit_price`
- `discount`
- `tax`
- `total`
- `created_at`
- `updated_at`

**Relationship:**
```text
sales
1 ─── N
sale_items
```

Historical `unit_price` must remain unchanged even if the product's current price changes.

### expenses

**Key Fields:**
- `id`
- `organization_id`
- `category_id`
- `vendor_name`
- `expense_date`
- `amount`
- `currency`
- `payment_method`
- `reference_number`
- `description`
- `status`
- `created_by`
- `created_at`
- `updated_at`
- `deleted_at`

### expense_categories

**Key Fields:**
- `id`
- `organization_id`
- `name`
- `description`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

### transactions

Stores unified financial activity.

**Key Fields:**
- `id`
- `organization_id`
- `source_type`
- `source_id`
- `transaction_type`
- `transaction_date`
- `amount`
- `currency`
- `status`
- `reference_number`
- `description`
- `created_at`
- `updated_at`

Possible `source_type`:
- `sale`
- `expense`
- `refund`
- `payment`
- `adjustment`

---

## 10. Planning Tables

### strategic_plans

**Key Fields:**
- `id`
- `organization_id`
- `name`
- `description`
- `vision`
- `start_date`
- `end_date`
- `status`
- `owner_id`
- `created_at`
- `updated_at`
- `deleted_at`

### objectives

**Key Fields:**
- `id`
- `organization_id`
- `strategic_plan_id`
- `title`
- `description`
- `owner_id`
- `priority`
- `start_date`
- `end_date`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

### goals

**Key Fields:**
- `id`
- `organization_id`
- `objective_id`
- `title`
- `description`
- `goal_type`
- `target_value`
- `current_value`
- `unit`
- `start_date`
- `deadline`
- `owner_id`
- `priority`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

### kpis

**Key Fields:**
- `id`
- `organization_id`
- `name`
- `description`
- `category`
- `measurement_type`
- `unit`
- `target_value`
- `frequency`
- `owner_id`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

### budgets

**Key Fields:**
- `id`
- `organization_id`
- `name`
- `start_date`
- `end_date`
- `status`
- `currency`
- `created_by`
- `created_at`
- `updated_at`
- `deleted_at`

### budget_items

**Key Fields:**
- `id`
- `budget_id`
- `category`
- `planned_amount`
- `actual_amount`
- `variance`
- `created_at`
- `updated_at`

### milestones

**Key Fields:**
- `id`
- `organization_id`
- `goal_id`
- `objective_id`
- `title`
- `description`
- `owner_id`
- `start_date`
- `deadline`
- `priority`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

### action_plans

**Key Fields:**
- `id`
- `organization_id`
- `goal_id`
- `objective_id`
- `milestone_id`
- `title`
- `description`
- `owner_id`
- `start_date`
- `deadline`
- `priority`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

### action_plan_items

**Key Fields:**
- `id`
- `action_plan_id`
- `title`
- `description`
- `assigned_to`
- `deadline`
- `priority`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

---

## 11. Analytics Tables

Analytics should primarily derive from operational data. Not every dashboard metric requires its own permanent table.

### analytics_snapshots

May be used for expensive aggregated calculations.

**Key Fields:**
- `id`
- `organization_id`
- `metric`
- `period_start`
- `period_end`
- `value`
- `metadata`
- `created_at`
- `updated_at`

Examples:
- `revenue`
- `expenses`
- `profit`
- `customer_growth`
- `goal_completion`

### business_health_snapshots

Stores historical business health results where required.

**Key Fields:**
- `id`
- `organization_id`
- `score`
- `status`
- `period_start`
- `period_end`
- `factors`
- `created_at`
- `updated_at`

### forecasts

Stores generated forecasts where persistence is required.

**Key Fields:**
- `id`
- `organization_id`
- `metric`
- `period_start`
- `period_end`
- `forecast_value`
- `confidence`
- `methodology`
- `generated_at`
- `created_at`
- `updated_at`

Forecast data must remain separate from actual business records.

---

## 12. Reports Tables

### reports

**Key Fields:**
- `id`
- `organization_id`
- `type`
- `name`
- `parameters`
- `status`
- `generated_by`
- `generated_at`
- `expires_at`
- `created_at`
- `updated_at`

### report_exports

Stores generated export files.

**Key Fields:**
- `id`
- `report_id`
- `format`
- `file_path`
- `file_size`
- `status`
- `created_at`
- `expires_at`

---

## 13. Security Tables

### audit_logs

Stores system and user audit history. Audit logs should be append-oriented.

**Key Fields:**
- `id`
- `user_id`
- `organization_id`
- `event_type`
- `action`
- `resource_type`
- `resource_id`
- `result`
- `ip_address`
- `user_agent`
- `metadata`
- `created_at`

### security_events

Stores security-specific events.

**Key Fields:**
- `id`
- `user_id`
- `organization_id`
- `event_type`
- `severity`
- `ip_address`
- `user_agent`
- `metadata`
- `resolved_at`
- `created_at`

---

## 14. Architectural Standards & Design Rules

### Common Columns

Most mutable application entities should follow a common timestamp pattern:
- `id`
- `created_at`
- `updated_at`

Entities requiring lifecycle control may also include:
- `deleted_at`

### UUID / Identifier Strategy

The final identifier strategy should be consistent across the entire platform.

Potential approaches:
- UUID
- ULID
- Auto-increment integer

For externally exposed identifiers, the platform should avoid predictable identifiers where enumeration could expose sensitive information.

### Organization Scoping

All organization-owned tables should use `organization_id` directly whenever practical.

Examples:
- `sales.organization_id`
- `expenses.organization_id`
- `customers.organization_id`
- `products.organization_id`
- `goals.organization_id`
- `kpis.organization_id`
- `reports.organization_id`

This allows:
- Efficient filtering
- Clear ownership
- Easier authorization
- Simpler analytics
- Better organization isolation

### Foreign Key Rules

Foreign keys should be used where appropriate to maintain referential integrity.

Examples:
```text
sales.organization_id      → organizations.id
sales.customer_id          → customers.id
sale_items.sale_id         → sales.id
sale_items.product_id      → products.id
```

### Indexing Strategy

Indexes should prioritize common access patterns:

- **Organizations:** `organizations.slug`, `organizations.status`
- **Membership:** `organization_members.organization_id`, `organization_members.user_id`
- **Community:** `posts.author_id`, `posts.created_at`, `posts.visibility`, `comments.post_id`, `reactions.reactable_id`, `connections.requester_id`, `connections.recipient_id`
- **Business:** `sales.organization_id`, `sales.sale_date`, `expenses.organization_id`, `expenses.expense_date`, `transactions.organization_id`, `transactions.transaction_date`, `customers.organization_id`, `products.organization_id`
- **Planning:** `goals.organization_id`, `goals.deadline`, `kpis.organization_id`, `budgets.organization_id`, `milestones.organization_id`

### Composite Indexes

Frequently combined filters may use composite indexes.

Examples:
- `(organization_id, created_at)`
- `(organization_id, sale_date)`
- `(organization_id, expense_date)`
- `(organization_id, status)`

The final indexes must be based on actual query patterns and measured performance.

### Soft Delete Strategy

Soft deletion should be used where historical relationships must be preserved.

Potential soft-deleted entities:
- Users
- Organizations
- Posts
- Customers
- Products
- Sales
- Expenses
- Goals
- Opportunities

Not every table should use soft deletion automatically.

### Data Retention

Retention policies should eventually be defined for:
- User accounts
- Messages
- Business records
- Financial records
- Audit logs
- Reports
- Subscription records
- Deleted content

Retention requirements may vary by business and jurisdiction.

### Encryption

Sensitive data should receive appropriate protection.

Potentially sensitive categories:
- Personal information
- Financial information
- Authentication information
- Security events
- Billing information

Sensitive secrets must never be stored in plain text.

### Database Transactions

Multi-record business operations should use database transactions when consistency is required.

Example:
```text
Create Sale
    ↓
Create Sale Items
    ↓
Create Transaction
    ↓
Commit

(Rollback on failure)
```

### Concurrency

The system must consider concurrent updates to:
- Sales
- Expenses
- Subscriptions
- Goals
- Inventory in the future
- Memberships

Concurrency controls should prevent lost updates and inconsistent records.

### Reporting and Historical Data

Historical values must remain accurate.

Example:
```text
Product Current Price: ₱500
Historical Sale Unit Price: ₱450
```

Updating the product's current price must not change the historical sale price.

### Future Database Expansion

The schema should allow future modules such as:
- Investment
- Mentorship
- Marketplace
- AI
- Integrations
- Inventory
- CRM
- HR
- Payroll

without changing the core `User ── Organization ── Membership ── Subscription` relationship.

---

## Success Criteria

The database schema should provide:

- Clear ownership
- Strong organization isolation
- Referential integrity
- Historical accuracy
- Efficient querying
- Auditability
- Future extensibility
- Reliable support for web and mobile clients
