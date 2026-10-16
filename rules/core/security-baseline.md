# Security Baseline (always-on)

Non-negotiable on every write path, endpoint, and template. The agent enforces these; the user owns credentials, access rules, and production encryption settings. Refuse any suggestion that disables a check for convenience.

## Backend

- **Validate every input** through validators, schema checks, or Request classes (match the project: [backend.md](../conditional/backend.md)). Never pass an unvalidated request array into a write; `$request->all()` into a mass-assignable model is a finding.
- **Authorize on the server.** Apply policies, gates, or route middleware so users only read and modify what they may. Hiding a button is not authorization. Scope every read and write to its owner or tenant (`organization_id` in (React); the active portal in (Vue): [payroll.md](../conditional/payroll.md)).
- **Bind parameters** in every custom or dynamic query. No interpolated raw SQL.
- **Protect PII**: encrypt it before storage; never return it, log it, or broadcast it beyond what the receiver is authorized to see.
- **Protected by default**: new routes sit inside the authenticated middleware group unless the spec makes them public; rate-limit auth-adjacent routes.
- **File uploads**: validate size and extension before saving.

## Frontend

- Escape output. No `v-html` / `dangerouslySetInnerHTML` unless the content is explicitly sanitized.
- No credentials, tokens, or PII in clear text in `localStorage` / `sessionStorage` (mobile: use the platform's secure store).
