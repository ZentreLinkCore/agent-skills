# ADR-003: Community Platform and Organization Workspace Separation

## Status

Accepted

---

## Date

2026-08-12

---

## Context

ScaleUP evolved from a business-management concept into a broader Business Growth Platform.

The platform now needs to support both:

- Public/community business interaction
- Private internal business management

Combining these into one undifferentiated experience could create privacy, UX, and permission problems.

---

## Decision

ScaleUP will maintain two distinct but connected experiences:

### Community Platform

A professional business network for individuals and organizations.

### Organization Workspace

A private environment for organizations to manage their business.

```text
ScaleUP
│
├── Community Platform
│   ├── Profiles
│   ├── Feed
│   ├── Posts
│   ├── Connections
│   ├── Messaging
│   └── Opportunities
│
└── Organization Workspace
    ├── Business Management
    ├── Planning
    ├── Analytics
    ├── Reports
    └── Team Management
```

---

## Public vs Private Boundary

### Public

- User Profile
- Organization Profile
- Public Posts
- Public Opportunities

### Private

- Financial Data
- Business Records
- Planning
- Analytics
- Reports
- Internal Team Data
- Billing Information

---

## Consequences

### Positive

- Clear and intuitive user experience tailored for either social engagement or high-focus business operations.
- Stronger, unambiguous privacy boundaries.
- Easier and cleaner authorization/permission model.
- Community can grow and engage users independently.
- Organization workspace can evolve rapidly into a full-featured Business OS.

### Negative

- Requires explicit context switching between community and organization modes.
- Duplicate conceptual entities (such as public organization profile versus private organization workspace) must be clearly distinguished and managed.

---

## Result

Community and Organization Workspace will remain separate product contexts connected through shared identities, organizations, and opportunities.