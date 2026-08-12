# ADR-001: Platform Architecture

## Status

Accepted

---

## Date

2026-08-12

---

## Context

ScaleUP is designed as a long-term Business Operating System and Business Community Platform.

The platform will support:

- Community
- Organizations
- Business Management
- Planning
- Analytics
- Subscriptions
- Mobile access
- Future ecosystem services

The platform must support multiple client applications while maintaining centralized business rules and security.

---

## Decision

ScaleUP will use an API-first architecture with:

- **Web:** React + TypeScript + Vite
- **Mobile:** React Native + TypeScript
- **Backend API:** Laravel (PHP)
- **Database:** MySQL relational database

The web and mobile applications will consume shared backend services.

```text
React Web
     \
      \
       Laravel API
      /
React Native
      |
      ↓
    MySQL
```

---

## Repository Structure

The project will initially use a monorepo-style structure:

```text
scaleup/
├── apps/
│   ├── web/
│   ├── mobile/
│   └── api/
│
├── docs/
└── packages/
```

Shared packages will only be created when there is a genuine need for shared code.

---

## Consequences

### Positive

- Shared business rules across Web and Mobile clients.
- Centralized authentication and authorization.
- Easier support for future clients, public APIs, and integrations.
- Independent UI development and deployment cycles for Web and Mobile.
- Clear architectural separation between presentation and core business logic.

### Negative

- Requires explicit API contracts and serialization between clients and backend.
- More independent projects and build toolchains to maintain.
- Mobile and Web have separate UI implementations rather than unified code sharing.

---

## Alternatives Considered

### React Embedded Directly in Laravel

Rejected as the primary long-term architecture because ScaleUP requires a separate mobile client and a standalone, reusable API.

### Vue + Laravel + Ionic

Considered because of existing team Vue experience, but React + React Native provides a more unified frontend ecosystem for the long-term cross-platform strategy.

### Flutter + Laravel

Considered, but React Native was selected to keep the web and mobile frontend ecosystem closer together in TypeScript.

---

## Result

The API-first React + React Native + Laravel architecture is the accepted foundation for ScaleUP.
