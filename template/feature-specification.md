# Feature Specification — {{FEATURE_NAME}}

<!--
TEMPLATE: feature-specification (used by /webkit-specify)

Fill rules. Delete this comment and every other guide comment from the finished spec.
1. Replace every {{PLACEHOLDER}}. A finished spec contains no "{{".
2. Never leave a section, row, or cell blank. If it does not apply, write "N/A — <reason>".
3. Be exact: real names, literal values, status codes, limits, messages. Banned words: "should", "might",
   "maybe", "etc.", "as needed", "appropriate", "TBD".
4. Use the names that exist in the codebase (tables, columns, classes, routes, components). Never invent one.
   Anything that does not exist yet is marked **(new)**.
5. IDs are stable once written: SC-, FR-, NFR-, AC-, EC-, A-, D-, Q-. Never renumber. Retire an ID with
   ~~strikethrough~~ and a reason; do not reuse it.
6. Keep the layers apart:
   - Requirements (WHAT): §1–7, §10, §11, §13
   - Technical design (HOW): §8
   - Plan (IN WHAT ORDER): plan.md in this ticket folder, from implementation-plan.md; §9 only points to it
   - Decisions (WHY): §15
7. This file is the single source of truth. Implementation follows it and review checks against it. Minor
   corrections are edited in place; only a major change creates a new version (see §16).
-->

## Metadata

<!-- Specification Version starts at 1.0 and changes only on a Major change (§16).
     Status values: Draft | In Review | Approved | In Progress | Done | Superseded.
     "Approved" requires §15 Open Questions to be empty. "Superseded" names the replacing ticket. -->

| Field | Value |
| --- | --- |
| Project Name | {{PROJECT_NAME}} |
| Ticket Number | {{TICKET_NUMBER}} |
| Feature Name | {{FEATURE_NAME}} |
| Created Date | {{YYYY-MM-DD}} |
| Specification Version | {{VERSION}} |
| Status | {{STATUS}} |

---

## 1. Overview

- **What is being built:** {{one sentence}}
- **Problem it solves:** {{one sentence}}
- **Why this feature exists:** {{one sentence: who needs it and what they gain}}

---

## 2. Objective

### Main Goals

1. {{goal}}

### Expected Outcome

{{The observable end state after release: what a user can do, or what the system does, that it could not before.}}

### Success Criteria

<!-- Each criterion is a number, a threshold, or a yes/no check, and names how it is measured. -->

| ID | Criterion | Target | Measured By |
| --- | --- | --- | --- |
| SC-01 | {{criterion}} | {{target}} | {{query / test / metric / manual check}} |

---

## 3. Background and Motivation

- **Current limitation:** {{what happens today, and where: screen, route, or file}}
- **Business or technical reason:** {{reason}}
- **Why this solution is needed:** {{why this approach instead of the status quo or the obvious alternative; full trade-offs go in §15}}

---

## 4. Scope

### Included

- {{screen / endpoint / data change / behavior}}

### Not Included

<!-- List anything a developer could reasonably assume is in scope. Each item gives a reason or the ticket it moves to. -->

- {{item}} — {{reason, or "deferred to {{TICKET}}"}}

---

## 5. User Flow

<!-- One flow per actor or entry point. Every flow lists its failure paths. -->

### Flow 1 — {{flow name}} ({{actor / role}})

**Entry point:** {{page, route, or trigger}}

| Step | User Action | System Behavior | Expected Result |
| --- | --- | --- | --- |
| 1 | {{action}} | {{behavior}} | {{result}} |
| 2 | {{action}} | {{behavior}} | {{result}} |

**Failure paths:**

- Step {{n}}, when {{condition}}: {{system behavior}} → {{result the user sees}}

---

## 6. Functional Requirements

<!-- One block per required behavior. Every FR is covered by at least one AC in §10. -->

### FR-01 — {{short name}}

- **Requirement ID:** FR-01
- **Description:** {{what the system must do}}
- **Expected Behavior:** {{exact inputs, outputs, state changes, and messages}}
- **Verified by:** {{AC-01, AC-02}}

---

## 7. Non Functional Requirements

<!-- Every row has a measurable target or "N/A — <reason>". Add rows as needed; keep the five categories. -->

| ID | Category | Requirement | Target / Limit |
| --- | --- | --- | --- |
| NFR-01 | Security | {{requirement; details in §13}} | {{target}} |
| NFR-02 | Performance | {{e.g. list endpoint response time}} | {{e.g. p95 < 500 ms with 10,000 rows}} |
| NFR-03 | Scalability | {{e.g. data growth, concurrent users}} | {{target}} |
| NFR-04 | Maintainability | {{e.g. follows existing module pattern}} | {{reference file or rule}} |
| NFR-05 | Reliability | {{e.g. double-submit, retry, partial failure}} | {{guard and expected outcome}} |

---

## 8. Technical Design

### Architecture

- **Where it fits:** {{module / portal / layer}}
- **Pattern followed:** {{existing pattern}} — reference: `{{path/to/similar/feature}}`

| Component | Status | Path |
| --- | --- | --- |
| {{name}} | {{Reused / Extended / New}} | `{{path}}` |

### Frontend

**Pages and components**

| Name | Path | Status | Responsibility |
| --- | --- | --- | --- |
| {{ComponentName}} | `{{path}}` | {{Reused / Extended / New}} | {{responsibility}} |

**State**

| State | Location | Shape | Updated When |
| --- | --- | --- | --- |
| {{name}} | {{store / composable / local}} | `{{type}}` | {{event}} |

**API interaction**

| Trigger | Endpoint | Loading State | On Success | On Error |
| --- | --- | --- | --- | --- |
| {{user action / mount}} | `{{METHOD /path}}` | {{UI}} | {{UI}} | {{UI and message}} |

### Backend

**Endpoints**

| Method | Route | Route Name | Handler | Access |
| --- | --- | --- | --- | --- |
| {{GET}} | `{{/api/...}}` | `{{route.name}}` | `{{Controller@method}}` | {{role(s)}} |

**Classes**

| Class | Path | Status | Responsibility |
| --- | --- | --- | --- |
| {{ClassName}} | `{{path}}` | {{Reused / Extended / New}} | {{responsibility}} |

**Request / response contract** — `{{METHOD /path}}`

```jsonc
// Request
{{request body or query params}}
```

```jsonc
// 200 Success
{{response body}}
```

```jsonc
// {{4xx}} Error
{{error body}}
```

**Processing logic**

1. {{step: validate, load, compute, persist, respond}}

### Database

**Tables**

| Table | Status | Purpose |
| --- | --- | --- |
| `{{table}}` | {{Reused / Extended / New}} | {{purpose}} |

**Fields**

| Table.Column | Type | Nullable | Default | Index / Constraint | Notes |
| --- | --- | --- | --- | --- | --- |
| `{{table.column}}` | {{type}} | {{Yes / No}} | {{default}} | {{index}} | {{Reused / New}} |

**Relationships:** {{`parent` 1–N `child` via `child.parent_id`}}

**Migrations**

| Migration | Up | Down (rollback) |
| --- | --- | --- |
| `{{migration_file_name}}` | {{change}} | {{reverse change}} |

**Data backfill / seed:** {{script and the rows it touches, or "N/A — <reason>"}}

### External Services

| Service | Purpose | Interface | Auth | Timeout / Retry | On Failure |
| --- | --- | --- | --- | --- | --- |
| {{service}} | {{purpose}} | {{API / SDK}} | {{method}} | {{values}} | {{behavior}} |

---

## 9. Implementation Plan

<!-- The plan is a separate file so /webkit-implement can execute and tick it without touching the spec. Keep this
     section to the line below; never copy tasks into the spec. -->

Defined in [`plan.md`](./plan.md) in this ticket folder: the file-by-file task list (Preparation → Backend → Frontend → Validation) that `/webkit-implement` executes. The plan cites this spec's IDs and adds no requirement; where the two disagree, this spec wins.

---

## 10. Acceptance Criteria

<!-- Every FR and NFR has at least one row. "Then" is checkable without reading the code:
     literal values, status codes, response keys, messages, row counts. -->

| ID | Covers | Given | When | Then |
| --- | --- | --- | --- | --- |
| AC-01 | FR-01 | {{precondition and data}} | {{action}} | {{exact observable result}} |

---

## 11. Edge Cases

<!-- At least one row per category. Each row is covered by an AC. -->

| ID | Category | Scenario | Expected Handling | AC |
| --- | --- | --- | --- | --- |
| EC-01 | Invalid input | {{e.g. null, empty string, too long, wrong type, out of range}} | {{exact rejection: status + message}} | {{AC-xx}} |
| EC-02 | Empty data | {{scenario}} | {{handling}} | {{AC-xx}} |
| EC-03 | Permission | {{scenario}} | {{handling}} | {{AC-xx}} |
| EC-04 | Failure | {{e.g. DB error, external service down, timeout}} | {{handling}} | {{AC-xx}} |
| EC-05 | Unexpected behavior | {{e.g. double submit, concurrent edit, retry replay, stale data}} | {{guard and outcome}} | {{AC-xx}} |

---

## 12. Testing Strategy

### Unit Testing

| Target | Cases | Covers |
| --- | --- | --- |
| `{{Class::method}}` | {{cases}} | {{AC-xx}} |

### Integration Testing

| Flow / Endpoint | Setup | Assertion | Covers |
| --- | --- | --- | --- |
| `{{METHOD /path}}` | {{data / state}} | {{assertion}} | {{AC-xx}} |

### Manual Testing Scenarios

| # | Precondition | Steps | Expected Result | Covers |
| --- | --- | --- | --- | --- |
| MT-01 | {{precondition}} | {{steps}} | {{result}} | {{AC-xx}} |

**Test command:** `{{command}}`

---

## 13. Security Considerations

### Authentication

- {{required auth mechanism / guard / middleware; unauthenticated response}}

### Authorization

| Role | Allowed | Denied Response |
| --- | --- | --- |
| {{role}} | {{actions}} | {{status + body}} |

### Validation

| Field | Rules | Error Response |
| --- | --- | --- |
| `{{field}}` | {{required, type, length, range, format}} | {{status + message}} |

### Data Protection

- **Sensitive fields:** {{fields, or "N/A — <reason>"}}
- **Exposure rules:** {{never returned / masked / excluded from logs}}
- **Write protection:** {{mass-assignment guard, ownership check}}

### API Security

- **Object access (IDOR):** {{how each record ID in a request is checked against the caller, or "N/A — <reason>"}}
- **Mass assignment:** {{fillable / validated-only fields, or "N/A — <reason>"}}
- **Rate limits:** {{throttle per route, or "N/A — <reason>"}}

---

## 14. Implementation Notes

- **Conventions to follow:** {{rule files / reference implementation}}
- **Do not change:** {{files, behaviors, or contracts that must stay as they are}}
- **Known pitfalls:** {{pitfall}}
- **Config / environment:** {{new keys, flags, env vars}}
- **Deployment / rollback:** {{order of deploy steps; how to roll back}}
- **Review findings:** {{finding → resolution, added as Minor changes after review; "N/A — not yet reviewed" on creation}}

---

## 15. Assumptions and Decisions

### Assumptions

| ID | Assumption | Impact if Wrong | Confirmed By |
| --- | --- | --- | --- |
| A-01 | {{assumption}} | {{impact}} | {{name / "Unconfirmed"}} |

### Technical Decisions

| ID | Decision | Alternatives Rejected | Reason |
| --- | --- | --- | --- |
| D-01 | {{decision}} | {{alternatives}} | {{reason}} |

### Open Questions

<!-- Must be empty before Status = Approved. A resolved question becomes an assumption, a decision, or a requirement. -->

| ID | Question | Owner | Blocks |
| --- | --- | --- | --- |
| Q-01 | {{question}} | {{name}} | {{FR / section}} |

---

## 16. Change Log

> **Versioning**
>
> - **Minor** (UI adjustment, naming correction, validation improvement, bug fix, missing edge case, spec error correction): edit the affected sections in place and add a row under the **current** version. No new version.
> - **Major** (different feature behavior, new user flow, database redesign, breaking API change, different business requirement): increment the version (`1.0` → `1.1`), update **Specification Version** in Metadata, and record the reason, impact, and changed sections.
> - Implementation review never creates a version on its own. Findings go to §14 as a Minor change.

| Version | Date | Type | Change | Reason / Impact | Changed Sections |
| --- | --- | --- | --- | --- | --- |
| 1.0 | {{YYYY-MM-DD}} | Initial | Created specification | — | All |
