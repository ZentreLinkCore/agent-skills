# ScaleUP Platform Entities

## Overview

ScaleUP is built around a clear separation between:

- Individual identities
- Organizations
- Community interactions
- Organization workspaces
- Subscriptions
- Business operations

The core principle is:

> A User exists independently from an Organization, while an Organization provides a subscription-based workspace for business management.

This document defines the conceptual entities referenced throughout [USER_JOURNEY.md](./USER_JOURNEY.md) and [specifications/](./specifications/). It describes what each entity represents and who owns it — not how it is implemented.

---

## 1. User

Represents an individual person using ScaleUP. A User is the primary identity within the platform.

**Responsibilities**
- Authentication
- Personal profile
- Community participation
- Connections
- Messaging
- Notifications
- Organization membership
- Organization ownership

**Key Relationships**

```text
User
├── Profile
├── Posts
├── Comments
├── Reactions
├── Connections
├── Messages
├── Notifications
├── Organization Memberships
└── Organizations Owned
```

---

## 2. User Profile

Represents the professional identity of a User.

**Information**
- Name
- Profile Photo
- Headline
- Biography
- Location
- Industry
- Skills
- Professional Interests
- Experience
- Social / Professional Links

The profile is community-facing and is separate from an organization's internal business information.

---

## 3. Organization

Represents a business, company, startup, professional organization, or other group operating within ScaleUP. An Organization is optional.

**Characteristics**
- Owned by one or more authorized users
- Can have multiple members
- Has a public-facing organization profile
- Has a private organization workspace
- Requires an active subscription for paid workspace capabilities

**Key Relationships**

```text
Organization
├── Owners
├── Members
├── Subscription
├── Public Profile
├── Posts
├── Opportunities
├── Business Data
├── Goals
├── Reports
└── Workspace Settings
```

---

## 4. Organization Membership

Represents the relationship between a User and an Organization. A User may belong to multiple Organizations.

**Example**

```text
John Doe
├── Organization Membership → ABC Coffee       Role: Owner
└── Organization Membership → XYZ Consulting   Role: Finance Manager
```

**Membership Information**
- User
- Organization
- Role
- Status
- Joined Date
- Permissions

---

## 5. Organization Role

Defines what a User can access or perform inside an Organization.

Possible initial roles:
- Owner
- Administrator
- Manager
- Accountant
- Member
- Viewer

Roles should be extensible so organizations can eventually define custom permissions.

---

## 6. Subscription

Represents the commercial relationship between an Organization and ScaleUP. Subscriptions belong to Organizations rather than individual users.

**Subscription Information**
- Organization
- Plan
- Status
- Start Date
- Renewal Date
- Billing Cycle
- Member Limit
- Feature Entitlements

**Subscription States**
- Trial
- Active
- Past Due
- Suspended
- Cancelled
- Expired

See [BUSINESS_MODEL.md](./BUSINESS_MODEL.md) and [ADR-002](./decisions/ADR-002-subscription-model.md).

---

## 7. Organization Profile

Represents the public-facing identity of an Organization. This is different from the private Organization Workspace.

**Public Information**
- Organization Name
- Logo
- Cover Image
- Industry
- Description
- Location
- Website
- Followers
- Public Posts
- Public Updates
- Public Opportunities

Private financial and operational information must never be exposed through the public profile unless intentionally published.

---

## 8. Organization Workspace

Represents the authenticated private environment used by organization members.

**Workspace Areas**

```text
Organization Workspace
├── Dashboard
├── Business Management
├── Planning
├── Analytics
├── Reports
├── Team Management
└── Organization Settings
```

The workspace operates within an organization context.

---

## 9. Post

Represents a piece of user- or organization-generated community content.

A Post may belong to:
- A User
- An Organization

**Examples**
- Business Update
- Question
- Achievement
- Announcement
- Opportunity
- Industry Insight
- Discussion

**Relationships**

```text
Post
├── Author
├── Comments
├── Reactions
└── Attachments
```

---

## 10. Comment

Represents a response to a Post. Comments support community discussion and engagement.

**Relationships**

```text
Comment
├── Author
├── Post
└── Parent Comment (optional)
```

The optional parent comment enables future threaded discussions.

---

## 11. Reaction

Represents a User's reaction to community content.

Initial reactions may include:
- Like
- Celebrate
- Support
- Insightful

The reaction system should be extensible.

---

## 12. Connection

Represents a professional relationship between two Users.

A connection has a lifecycle:

```text
Pending → Accepted → Connected
```

Possible future states:
- Declined
- Blocked
- Removed

Connections are separate from organization membership.

---

## 13. Follow

Represents a User's relationship with an Organization or future community entity. Following does not grant private access.

**Example**

```text
John Doe → Follows → ABC Coffee
```

The user may receive public updates from the organization.

---

## 14. Message

Represents a private communication between users or permitted participants.

**Future Scope**
- One-to-One Messaging
- Group Messaging
- Organization Conversations
- Business Opportunity Discussions

Messaging permissions must respect user and organization privacy rules.

---

## 15. Notification

Represents a system-generated user notification.

**Examples**
- Connection Request
- New Message
- Post Reaction
- Comment
- Organization Invitation
- Subscription Event
- Business Alert
- Opportunity Update

**Delivery Channels**
- In-App
- Email
- Push

---

## 16. Opportunity

Represents a business-related opportunity published to the ScaleUP ecosystem.

Possible types:
- Partnership
- Investment
- Collaboration
- Mentorship
- Hiring
- Business Service
- Event
- Project

An Opportunity can be published by a User or Organization depending on the feature rules.

---

## 17. Business Data

Represents internal operational and financial information belonging to an Organization.

**Examples**
- Sales
- Expenses
- Transactions
- Customers
- Products
- Financial Records

Business data belongs to the Organization and must be isolated from the public community layer.

---

## 18. Goal

Represents a measurable objective created by an Organization.

**Examples**
- Increase Revenue
- Reduce Expenses
- Open a New Branch
- Acquire New Customers

**Goal Information**
- Title
- Description
- Target
- Current Progress
- Deadline
- Owner
- Status

---

## 19. KPI

Represents a measurable business performance indicator.

**Examples**
- Revenue Growth
- Profit Margin
- Customer Growth
- Sales Conversion
- Expense Ratio

KPIs belong to an Organization and may be displayed through organization analytics.

---

## 20. Report

Represents an analytical or business report generated for an Organization.

Reports may include:
- Financial Reports
- Sales Reports
- Expense Reports
- Performance Reports
- Goal Reports
- Executive Reports

Reports may be generated manually or automatically.

---

## 21. Opportunity Interest

Represents a user's or organization's interest in an Opportunity.

**Example**

```text
Opportunity → Interest → User / Organization
```

Possible states:
- Submitted
- Viewed
- In Discussion
- Accepted
- Declined
- Closed

---

## 22. Business Context

Many ScaleUP entities must operate within a specific context. There are three important contexts:

**Platform Context** — used for:
- User Profile
- Community
- Connections
- Messaging
- Public Opportunities

**Organization Context** — used for:
- Business Management
- Team
- Planning
- Analytics
- Reports

**Subscription Context** — used for:
- Feature access
- Member limits
- Billing
- Organization entitlements

---

## 23. Entity Relationship Overview

```text
                         SCALEUP
                            │
             ┌──────────────┴──────────────┐
             │                              │
          USER                          ORGANIZATION
             │                              │
      ┌──────┼──────┐               ┌───────┼───────────┐
      │      │      │               │       │           │
   Profile Posts Connections     Members Subscription Workspace
      │      │      │               │                    │
      │      │      │               │           ┌────────┼─────────┐
      │      │      │               │           │        │         │
      │      │      │               │       Business  Planning  Analytics
      │      │      │               │        Data                  │
      │      │      │               │           │               Reports
      │      │      │               │           │
      └──────┴──────┴───────────────┘           │
                                                 │
                                          Goals / KPIs
```

---

## 24. Core Ownership Rules

**User-Owned**
- Personal Profile
- Personal Posts
- Personal Connections
- Personal Messages

**Organization-Owned**
- Organization Profile
- Organization Members
- Organization Posts
- Subscription
- Business Data
- Goals
- KPIs
- Reports
- Workspace Settings

**Shared / Platform-Level**
- Notifications
- Opportunities
- Community Feed
- Discovery
- Search

Access must always follow the ownership and permission context of the entity.

---

## 25. Core Platform Principle

ScaleUP follows one foundational rule:

> People own identities. Organizations own businesses. Membership connects people to organizations. Subscriptions unlock organization capabilities.

This separation allows ScaleUP to support:
- Individuals without organizations
- Employees working for organizations
- Owners managing organizations
- Users belonging to multiple organizations
- Public business networking
- Private business operations
- Subscription-based organization workspaces
