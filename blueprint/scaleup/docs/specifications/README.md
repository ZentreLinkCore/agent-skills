# ScaleUP Specifications

This directory holds the functional specifications for ScaleUP, grouped by domain. Each specification describes **what** a module does and the rules it must follow — not how it is implemented. Technology and implementation decisions live in the architecture documents under [docs/](../).

---

## Domains

| Domain | Scope | Requires subscription |
| :--- | :--- | :---: |
| [core/](./core/) | Shared foundation used by both experiences — authentication, profiles, notifications, search | No |
| [community/](./community/) | The free Community Platform — feed, posts, connections, messaging, opportunities | No |
| [organization/](./organization/) | Creating, administering, and governing an Organization | Mixed |
| [subscription/](./subscription/) | Plans, entitlements, payments, billing, and subscription lifecycle | Mixed |
| [business/](./business/) | Operational business management inside the Organization Workspace | Yes |
| [planning/](./planning/) | Strategy, objectives, goals, KPIs, milestones, and budgets | Yes |
| [analytics/](./analytics/) | Dashboards, reports, insights, forecasting, and business health | Yes |
| [security/](./security/) | Cross-cutting security, authorization, privacy, and audit requirements | N/A |
| [future/](./future/) | Proposed and exploratory modules not yet committed | N/A |

Each domain directory has a `README.md` listing its specifications and stating its design constraint.

---

## Document Structure

Specifications follow a common section order so that any document can be read the same way:

| Section | Contents |
| :--- | :--- |
| `Purpose` | What the module does, and why it exists |
| `Overview` | The core concept and how it relates to the rest of the platform |
| `Actors` | Who interacts with the module |
| `Scope` | `In Scope` and `Future Scope` — what is and is not committed |
| *Domain sections* | Flows, information, states, and rules specific to the module |
| `Permissions` | Which roles may perform which actions |
| `Edge Cases` | Conditions the design must account for |
| `Success Criteria` | What "working correctly" means for this module |

Not every specification needs every section, but sections that are present should use these names and appear in this order.

---

## Conventions

- One `#` heading per document, matching the module name — `# <Module> Specification`.
- `##` sections separated by `---`; `###` for subsections.
- `-` for bullets, `` ```text `` for flow and state diagrams.
- `UPPER_SNAKE_CASE.md` filenames; a domain's own overview is named `<DOMAIN>_OVERVIEW.md`.
- Cross-reference other specifications by relative link rather than restating their rules.

---

## Adding a Specification

1. Place it in the domain whose design constraint it satisfies — check the domain `README.md` if unsure.
2. Follow the section order above and the conventions listed here.
3. Add it to the domain `README.md` table.
4. If it does not fit an existing domain, draft it in [future/](./future/) first.

See [../README.md](../README.md) for the wider documentation map.
