# Security Specifications

Security specifications cover the principles, controls, and requirements used to protect ScaleUP users, organizations, business data, and platform resources. Security is a cross-cutting concern: it applies to every other specification domain rather than describing a product surface of its own.

---

## Specifications

| Document | Purpose |
| :--- | :--- |
| [SECURITY_OVERVIEW.md](./SECURITY_OVERVIEW.md) | The security objectives, principles, and responsibilities shared platform-wide |
| [AUTHORIZATION.md](./AUTHORIZATION.md) | What authenticated users are permitted to access and perform |
| [ACCOUNT_SECURITY.md](./ACCOUNT_SECURITY.md) | Protections for individual accounts beyond basic authentication |
| [DATA_PRIVACY.md](./DATA_PRIVACY.md) | How personal and organization information is collected, used, and protected |
| [AUDIT_LOGGING.md](./AUDIT_LOGGING.md) | The record of security-sensitive and business-critical actions |

---

## Design Constraint

These specifications state requirements every other domain must satisfy — they do not define features. Identity verification itself belongs to [core/AUTHENTICATION.md](../core/AUTHENTICATION.md); this scope begins once a user is authenticated. Organization isolation is non-negotiable: no specification may introduce a path by which one organization's private data becomes reachable from another.

See [PERMISSION_MATRIX.md](../../PERMISSION_MATRIX.md) for the concrete role-to-capability mapping.
