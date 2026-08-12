# ADR-004: User and Organization Separation

## Status

Accepted

---

## Date

2026-08-12

---

## Context

ScaleUP must support diverse types of users across the ecosystem.

Not every user is a business owner. A user may be:

- Entrepreneur
- Employee
- Consultant
- Investor
- Mentor
- Freelancer
- Community participant

Users may also belong to multiple organizations simultaneously.

---

## Decision

A User and Organization are separate first-class entities:

- A **User** represents a person and individual identity.
- An **Organization** represents a business, startup, or team.

The relationship between them is represented through **Organization Membership**.

```text
User
  │
  ├── Membership → Organization A
  ├── Membership → Organization B
  └── Membership → Organization C
```

A User does not need an Organization to use ScaleUP.

---

## Organization Creation & Lifecycle

Creating an Organization is optional:

```text
Individual User
      ↓
Create Organization
      ↓
Subscription
      ↓
Organization Activated
```

The user maintains their Individual Account identity even after creating or joining an organization.

---

## Organization Roles & Permissions

Membership contains roles such as:

- Owner
- Administrator
- Manager
- Member
- Viewer

A user may hold different roles across different organizations:

```text
Organization A → Owner
Organization B → Manager
Organization C → Viewer
```

---

## Security Principle

Organization-owned data must never be accessible simply because a user has a valid ScaleUP account.

Access requires:

```text
Authenticated User
       ↓
Organization Membership
       ↓
Role
       ↓
Permission
```

---

## Consequences

### Positive

- Highly flexible user and account model.
- Seamlessly supports users belonging to multiple organizations.
- Community participation is open to everyone, not just business owners.
- Unambiguous data ownership and legal entity boundaries.
- Enables future ecosystem expansion into investors, mentors, partners, and external specialists.

### Negative

- Membership, context switching, and active organization scoping introduce additional architectural complexity.
- Authorization must always evaluate the active organization context dynamically on every request.

---

## Result

User identity and organization identity will remain strictly separate throughout the ScaleUP architecture.
