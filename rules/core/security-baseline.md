# Security Baseline (always-on)

Non-negotiable on every write path, endpoint, and template. Refuse any suggestion that disables a check for convenience.

- **Validate every input** (validators, schema checks, Request classes, as the project does). Never pass an unvalidated request array into a write; `$request->all()` into a mass-assignable model is a finding.
- **Authorize on the server**, with policies, gates, or middleware; hiding a button is not authorization. Scope every read and write to its owner or tenant (`organization_id` in (React); the active portal in (Vue)).
- **Bind parameters** in every custom query; no interpolated raw SQL.
- **Protect PII**: encrypt it at rest; never return, log, or broadcast it beyond what the receiver may see.
- **Protected by default**: new routes go inside the authenticated group unless the spec makes them public; rate-limit auth-adjacent routes.
- **Uploads**: validate size and extension before saving.
- **Frontend**: escape output; no `v-html` / `dangerouslySetInnerHTML` without sanitizing; no tokens or PII in `localStorage` / `sessionStorage` (mobile: the platform's secure store).
