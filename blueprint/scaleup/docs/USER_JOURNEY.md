# ScaleUP User Journey

## Overview

ScaleUP provides two connected experiences:

1. **Community Platform** — a free, professional and business-focused social environment for individuals.
2. **Organization Workspace** — a subscription-based environment for organizations to manage their business, teams, planning, and performance.

Every user starts with an Individual Account. Creating or joining an Organization is optional. See [PLATFORM_ARCHITECTURE.md](./PLATFORM_ARCHITECTURE.md) for how the two experiences fit together, and [PLATFORM_ENTITIES.md](./PLATFORM_ENTITIES.md) for the entities referenced throughout these journeys.

---

## 1. Visitor Journey

A visitor can explore ScaleUP before creating an account.

```text
Landing Page
    ↓
Explore ScaleUP
    ↓
Learn About Platform
    ↓
View Features / Pricing
    ↓
Register or Sign In
```

#### Visitor Goals
- Understand what ScaleUP provides.
- Explore the business community concept.
- Learn about organization features.
- Review available subscription plans.
- Create an account when ready.

---

## 2. Individual Registration Journey

Every new user begins as an Individual Account.

```text
Register
    ↓
Verify Email
    ↓
Complete Profile
    ↓
Welcome to ScaleUP
    ↓
Enter Community
```

#### Individual Account

An individual account does not require an organization. The user can immediately access community-oriented features.

#### Individual Capabilities
- Create a professional profile
- Browse the community feed
- Publish posts
- Comment and react
- Connect with other users
- Follow organizations
- Discover opportunities
- Send and receive messages
- Receive notifications
- Explore public organization profiles

---

## 3. Individual Community Journey

After registration, users are brought into the ScaleUP Community.

```text
Community Feed
    ↓
Discover Content
    ↓
Interact
    ↓
Connect
    ↓
Follow Organizations
    ↓
Discover Opportunities
```

The Community is intended to become the primary discovery and networking layer of ScaleUP.

---

## 4. Create Organization Journey

An individual can create an organization when they want to establish a business workspace.

```text
Individual Account
    ↓
Create Organization
    ↓
Enter Organization Information
    ↓
Choose Subscription Plan
    ↓
Complete Subscription
    ↓
Organization Created
    ↓
Organization Workspace
```

#### Organization Creation

The user provides information such as:
- Organization Name
- Industry
- Country
- Business Type
- Business Size
- Description
- Contact Information

The organization remains inactive until the required subscription process is completed.

---

## 5. Organization Subscription Journey

Creating an organization introduces the subscription flow.

```text
Create Organization
    ↓
Choose Plan
    ↓
Review Plan
    ↓
Subscription / Payment
    ↓
Subscription Activated
    ↓
Organization Workspace Unlocked
```

#### Subscription Controls

The subscription determines access to organization capabilities. An organization may have different plans with different:
- Member limits
- Business features
- Storage limits
- Analytics capabilities
- Planning capabilities
- Reporting capabilities

See [BUSINESS_MODEL.md](./BUSINESS_MODEL.md) and [ADR-002](./decisions/ADR-002-subscription-model.md) for the reasoning behind this gate.

---

## 6. Organization Owner Journey

The organization creator becomes the initial organization owner.

```text
Organization Created
    ↓
Organization Owner
    ↓
Configure Organization
    ↓
Invite Members
    ↓
Set Roles & Permissions
    ↓
Use Organization Workspace
```

#### Organization Owner Responsibilities
- Manage organization settings
- Manage members
- Assign roles
- Manage subscription
- Access business information
- Manage organization content
- Configure workspace settings

---

## 7. Join Organization Journey

Users do not need to create their own organization to participate in an existing organization.

```text
Individual Account
    ↓
Receive Invitation
    ↓
Review Invitation
    ↓
Accept
    ↓
Become Organization Member
    ↓
Access Assigned Workspace
```

A user may belong to multiple organizations. For example:

```text
John Doe

├── ABC Coffee          Role: Owner
├── XYZ Consulting       Role: Finance Manager
└── Startup Group        Role: Member
```

---

## 8. Organization Workspace Journey

After entering an organization, the user works inside the organization's environment.

```text
Organization Workspace
    ↓
Dashboard
    ↓
Business Management
    ↓
Planning
    ↓
Analytics
    ↓
Reports
    ↓
Team Collaboration
```

Access depends on the user's role and organization permissions.

---

## 9. Organization Switching Journey

Users who belong to multiple organizations can switch between them.

```text
Current Organization
    ↓
Organization Switcher
    ↓
Select Organization
    ↓
Load Selected Workspace
```

The user's community identity remains the same while the active organization context changes.

---

## 10. Community ↔ Organization Journey

ScaleUP connects the public community experience with organization workspaces.

```text
Individual
    ↓
Discover Organization
    ↓
View Public Organization Profile
    ↓
Follow / Connect
    ↓
View Organization Posts
    ↓
Discover Opportunity
```

The public organization profile may expose selected information without exposing private organization data.

---

## 11. Opportunity Journey

Users and organizations may discover business-related opportunities.

```text
Discover Opportunity
    ↓
View Details
    ↓
Express Interest / Engage
    ↓
Connect with Owner
    ↓
Continue Discussion
```

Future opportunity types may include:
- Partnership
- Investment
- Collaboration
- Mentorship
- Hiring
- Business Services
- Events
- Projects

---

## 12. Account Lifecycle

```text
Visitor
    ↓
Registered Individual
    ↓
Verified Individual
    ↓
Optional Organization Creator
    ↓
Organization Owner
```

A user can also follow a shorter path:

```text
Visitor
    ↓
Registered Individual
    ↓
Organization Member
```

...without ever creating an organization.

---

## 13. Account and Organization Separation

The following principles apply throughout ScaleUP:

- **User** — represents a person.
- **Organization** — represents a business, company, startup, team, or other organization.
- **Membership** — represents a user's relationship with an organization.
- **Subscription** — belongs to the organization and controls access to paid workspace capabilities.

A user account must not be dependent on an organization. See [PLATFORM_ENTITIES.md](./PLATFORM_ENTITIES.md#24-core-ownership-rules) for the full ownership model.

---

## 14. Core Journey Principle

ScaleUP follows a simple progression:

```text
Discover
    ↓
Join
    ↓
Connect
    ↓
Create or Join an Organization
    ↓
Manage
    ↓
Plan
    ↓
Grow
    ↓
Connect to Greater Opportunities
```

The Community is the entry point. The Organization Workspace is the business operating environment. Together, they form the ScaleUP ecosystem.
