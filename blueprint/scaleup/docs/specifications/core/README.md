# Core Specifications

Core specifications cover the shared foundation used by both the Community Platform and the Organization Workspace. Every capability documented here applies regardless of whether a user has created an Organization.

---

## Specifications

| Document | Purpose |
| :--- | :--- |
| [AUTHENTICATION.md](./AUTHENTICATION.md) | Secure identity and account access — registration, login, verification, and password management |
| [USER_PROFILE.md](./USER_PROFILE.md) | The professional identity every user builds, independent of any Organization |
| [NOTIFICATION.md](./NOTIFICATION.md) | How users stay informed of relevant activity across both experiences |
| [SEARCH.md](./SEARCH.md) | Unified discovery of people, organizations, posts, and opportunities |

---

## Design Constraint

Core specifications are the dependency layer for [specifications/community](../community/) and [specifications/organization](../organization/). A capability belongs here if it is used by both experiences rather than belonging exclusively to one.

See [PLATFORM_ARCHITECTURE.md](../../PLATFORM_ARCHITECTURE.md) for how these pieces fit into the overall platform.
