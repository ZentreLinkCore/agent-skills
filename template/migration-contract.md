# Webkit Migration Contract

<!--
TEMPLATE: migration-contract (used by /webkit-migrate)

Fill rules. Delete this comment and every other guide comment from the finished contract — except the
"Run history" marker at the bottom, which stays.
1. Follow this structure exactly. Do not create a custom format, add sections, remove sections, or reorder them.
2. Replace every {{PLACEHOLDER}}. A finished contract contains no "{{".
3. Never leave a field blank. If it does not apply, write "N/A — <reason>". An empty list says "None."
4. Every contract item (flow step, transition, field, endpoint, rule, validation, UI state, edge case) is traced to
   a source file:line or a spec section. Nothing is invented: an item that cannot be verified is asked about,
   never guessed.
5. §1–§9 describe behavior and data in stack-neutral terms: no Vue, React, or Laravel syntax. The stack appears
   only in §10 Translation Decisions and §11 Target Reuse.
6. Where the spec and the source code disagree, the contract follows the code's runtime behavior and lists the
   disagreement in §13.
7. §12 Parity Checklist starts as "NOT CHECKED YET"; it is filled after the target implementation, in the same run.

The migrator must NOT edit the source feature, run migrations, fix source defects, or add behavior the source
does not have. A suspected source defect is recorded in §13, not fixed and not silently copied.
-->

## Metadata

<!-- Ticket: the ticket this migration belongs to, with its project. Ticket numbers are per project, so a source
     ticket is not a target ticket. /webkit-migrate never allocates one: "None — <reason>" when the user named none. -->

| Field | Value |
| --- | --- |
| Source Repo | {{source repo}} ({{stack, e.g. "Vue 3 + Laravel Query / Handler"}}) |
| Source Path | `{{source_path}}` |
| Source Spec | {{`.agents/specs/<project>/T#####/spec.md` (version x.y), or "None — <reason>"}} |
| Target Repo | {{target repo}} ({{stack}}) |
| Target Path | `{{target_path}}` |
| Target Branch | {{branch in the target repo}} |
| Ticket | {{T#####}} ({{project}}) |
| Contract Date | {{YYYY-MM-DD}} |
| Contract Run | v{{N}} — {{what changed since the previous run, or "initial"}} |

---

## 1. Purpose & Ownership

{{One paragraph: what the feature does, and for whom, in behavior terms.}}

- **Owner:** {{portal or domain that owns the feature in the source}} → {{the target's equivalent}}
- **Access rules (carried verbatim):** {{who may see and change what; portal-separation or tenant-scoping guards}} — `{{file:line}}`

---

## 2. Flow & State Machine

### Flow

<!-- The numbered steps a user or record moves through, in behavior terms. -->

1. {{step}} — `{{file:line}}`
2. {{step}} — `{{file:line}}`

### State Machine

<!-- Every status value verbatim, and what triggers each transition: a user action (which role), a scheduled job,
     or another portal / domain. The single most important thing to preserve.
     "N/A — <reason>" when the feature has no lifecycle. -->

| From | To | Trigger | Who / What | Evidence |
| --- | --- | --- | --- | --- |
| `{{status}}` | `{{status}}` | {{action or schedule}} | {{role, job, or portal}} | `{{file:line}}` |

---

## 3. Data Contract

<!-- One table per entity. Field names from the model's $fillable or the migration, never invented. Persisted columns
     and computed fields are marked separately. Repeat the heading and table per entity. -->

### {{Entity}} (`{{table}}`)

| Field | Type | Unit / Format | Nullable | Persisted / Computed | Source / Derivation |
| --- | --- | --- | --- | --- | --- |
| `{{field}}` | {{type}} | {{unit or format}} | {{Yes / No}} | {{Persisted / Computed}} | `{{model or migration file:line}}` · {{formula for computed fields}} |

- **Enum / status values:** {{`value` = meaning, …, or "None"}}

---

## 4. API Contract

<!-- One row per endpoint the feature calls or exposes. The target reproduces these exactly, even though its backend
     is built differently. Paths use the real registered URL prefix (`php artisan route:list --path=api`), not the
     controller namespace. A response shape too large for a cell goes below the table as a ```json block headed
     by its endpoint. -->

| Method | Path | Request (params / body) | Success Response | Errors (status → body) | Auth / Guard | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `{{GET}}` | `{{/api/<prefix>/<resource>}}` | {{params or body}} | {{status + JSON shape}} | {{e.g. 422 → `{message, errors}`}} | {{guard and role}} | `{{route file:line}}` |

---

## 5. Business Rules & Calculations

<!-- Every formula, rate, threshold, and rounding rule, reproduced exactly. Compliance-sensitive: money, tax,
     statutory contributions, payroll, leave, and anything a regulator or an auditor would check. -->

| # | Rule / Formula | Rounding / Units | Compliance-Sensitive | Evidence |
| --- | --- | --- | --- | --- |
| R1 | {{rule or formula, exactly}} | {{rounding, units, currency}} | {{Yes — <why> / No}} | `{{file:line}}` · {{domain rule, if any}} |

---

## 6. Validation & Authorization

### Validation

| Field | Rule | Message | Evidence |
| --- | --- | --- | --- |
| `{{field}}` | {{rule}} | "{{message, verbatim}}" | `{{file:line}}` |

### Authorization

| Action | Allowed | Rejected With | Evidence |
| --- | --- | --- | --- |
| {{action}} | {{roles or portals}} | {{status + body}} | `{{file:line}}` |

- **Transactional writes:** {{which writes run in one transaction and what they cover, or "None"}}

---

## 7. UI Behavior

<!-- Behavior, not implementation: what the user sees and can do. The target's design system decides how it looks. -->

| Page / View | Responsibility | Evidence |
| --- | --- | --- |
| {{page}} | {{what it shows and lets the user do}} | `{{file:line}}` |

- **Filters and search:** {{fields, and the debounce interval}}
- **Pagination:** {{client / server, page size}}
- **Sort:** {{default and options}}
- **Loading / empty / error states:** {{what each one shows}}
- **Status → badge map:** {{`status` → label and color intent}}
- **Modals and drill-downs:** {{what opens, from where, and what it contains}}
- **Formatting:** {{money, date, and number semantics: currency, rounding, date format}}

---

## 8. Edge Cases

<!-- From the spec's edge cases, investigation reports, and guards in the source code. -->

| Case | Expected Behavior | Evidence |
| --- | --- | --- |
| {{case}} | {{behavior}} | `{{file:line}}` or {{spec §n / report path}} |

---

## 9. Dependencies & Preconditions

<!-- Everything outside the feature itself that it needs: tables, sibling modules, shared utils, domain rules,
     scheduled jobs, cross-portal or cross-domain touchpoints. Whether the target has each one is decided in §11. -->

| Dependency | Kind | Why the Feature Needs It | Evidence |
| --- | --- | --- | --- |
| `{{name}}` | {{table / module / scheduled job / shared util / touchpoint}} | {{reason}} | `{{file:line}}` |

---

## 10. Translation Decisions (Source → Target)

<!-- How each source layer the feature uses becomes a target layer, per the target's profile. Only the layers this
     feature uses. "Must Survive" names the contract item the translation preserves. -->

- **Target profile from:** {{the target's own `.agents/rules/project-profile.md` / Known Target Profile — `hrms_react` (re-verified YYYY-MM-DD) / Architecture Discovery}}
- **Closest sibling module in the target:** `{{path}}`

| Layer | Source Pattern | Target Pattern | Must Survive |
| --- | --- | --- | --- |
| {{e.g. State}} | {{source pattern}} | {{target pattern}} | {{§ reference, e.g. "§2 transitions"}} |

### Design-System Mapping

<!-- Mapped by behavior, never by name: inventory what the source feature actually uses (imported or globally
     registered), then the target component that provides the same behavior. -->

| Source Component | Behavior Used | Target Component | Evidence (target path) |
| --- | --- | --- | --- |
| `{{source component}}` | {{behavior}} | `{{target component}}` | `{{target path}}` |

- **Renames between the projects:** {{portal, domain, or folder names that differ, e.g. `employee` → `emp`, or "None"}}

---

## 11. Target Reuse (System Awareness Scan)

<!-- One row per artifact the target needs: model, table, route, controller, Query / Handler, component, hook,
     util, and each §9 dependency. A CREATE with no recorded search is a violation. -->

| Artifact | Searched (target) | Found | Decision |
| --- | --- | --- | --- |
| `{{artifact}}` | `{{path or grep in the target}}` | `{{file, or NONE}}` | {{REUSE / EXTEND / CREATE — <why nothing fit>}} |

- **Migrations for the user to run in the target:** {{list, or "None"}}

---

## 12. Parity Checklist

### Parity Result

<!-- On creation: NOT CHECKED YET. After the target implementation, choose one:
     PARITY CONFIRMED — every row checked and equal.
     PARITY WITH GAPS — a row differs or could not be checked; each one is named in the table. -->

{{NOT CHECKED YET | PARITY CONFIRMED | PARITY WITH GAPS}}

| Contract Item | Source | Target | How Compared | Result |
| --- | --- | --- | --- | --- |
| {{§ reference and item}} | `{{source file:line}}` | `{{target file:line}}` | {{executed request, tinker, traced code path}} | {{Equal / Differs — <how> / Not checked — <reason>}} |

- **Static checks (target):** {{command → result for each, or "Not run — <reason>"}}
- **Round trip:** {{"Given only this contract, the target behaves identically to the source", or what is still implicit}}

---

## 13. Drift & Open Points

<!-- Spec-vs-code disagreements (the contract follows the code), source behavior that looks like a defect (recorded,
     not fixed), dependencies the target still lacks, profile drift in the target, and questions for the user. -->

- {{item}} — `{{file:line}}` — {{decision taken, or the question for the user}}

---

## 14. Source Reference

<!-- Lookup only. Do NOT copy syntax from these files into the target. -->

- **Frontend:** {{`path`, …, or "None"}}
- **Backend:** {{controllers, Queries, Handlers, Actions, or "None"}}
- **Models / tables:** {{list, or "None"}}
- **Routes:** {{`METHOD /api/...` → `route file:line`, or "None"}}

<!-- Run history -->
