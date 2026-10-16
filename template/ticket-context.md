# Ticket Context — {{FEATURE_NAME}}

<!--
TEMPLATE: ticket-context (context.md — written by /webkit-context before the spec; read first by /webkit-specify,
/webkit-implement and the reviews)

Generic fill rules: .agents/rules/conditional/skill-protocol.md §3.
1. A map, not a design: no schemas, contracts, acceptance criteria, or tasks.
2. Every fact carries file:line evidence. Anything unverified goes to §6 Open Questions, never §3.
3. One line per item. The file lists live in touched-files.md, the chains in dependency-map.md: do not repeat them here.
-->

## Metadata

| Field | Value |
| --- | --- |
| Ticket | {{T#####}} ({{project}}) |
| Feature | {{FEATURE_NAME}} |
| Request | {{the request as the user gave it, one line}} |
| Context Run | v{{N}} — {{YYYY-MM-DD}} — {{what changed since the previous run, or "initial"}} |
| Graphify | {{used — graph built <date> / stale for <area> / absent}} · commands: {{e.g. "query ×3, path ×2, affected ×2"}} |

---

## 1. Purpose (as requested)

{{One paragraph: what the user wants and why, in their terms. Not a spec.}}

## 2. Project Facts That Matter

<!-- Only facts this feature depends on: stack, portal or domain, DB convention, HTTP client, design system, versioned app. -->

- {{fact}} — {{rule or file:line}}

## 3. Key Findings

<!-- What exists today that the feature builds on or collides with. Entry points first (page, route, command). -->

- **Entry point:** {{`resources/views/.../Page.vue` · `GET /api/...`}} — {{file:line}}
- {{finding}} — {{file:line}}

## 4. Rules That Apply

<!-- The router rows this feature will need, so later skills load exactly these. -->

- {{`conditional/backend.md` §3 — portal route file}}

## 5. Risks

- {{risk — why — evidence}}

## 6. Open Questions

<!-- Anything the request leaves open or the code could not confirm. /webkit-specify turns these into assumptions or Q-xx. "None." when empty. -->

- {{question}}

<!-- Run history -->
