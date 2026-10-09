---
name: webkit-specify
description: >
  Specification phase (Spec Kit style). Turns a feature request into ONE implementation-ready blueprint
  before any code is written: overview, scope, user flow, functional and non-functional requirements,
  technical design, phased implementation plan, Given/When/Then acceptance criteria, edge cases, testing,
  security. Grounded in the actual project, and written from the template
  `.agents/template/feature-specification.md`. Allocates (or reuses) the ticket folder and writes
  `.agents/specs/<project>/T#####/spec.md`; never touches application code. The spec is the locked
  source of truth for `/webkit-implement`, `/webkit-verify`, and
  `/webkit-code-review`: minor corrections update it in place, and only a major change creates a new version.
  Triggered by `/webkit-specify <request>`, `/webkit-specify <target_path> <request>`, or
  `/webkit-specify T##### <request>` to work on an existing ticket.
---

# Webkit Specify

Creates the implementation blueprint **before** coding. The spec becomes the single source of truth for the feature: developers implement from it, reviewers check against it, and it is not redesigned after the fact. The goal is no repeated redesign, no conflicting suggestions, and no endless spec revisions after implementation.

Process: understand the requirement → analyze the existing project → generate the spec from the template → lock the intended behavior → implementation and review reference the same file.

> [!IMPORTANT]
> **This skill MUST NOT modify application files.** No controllers, migrations, routes, components, or composables. Its only output is the spec file in the ticket folder.

---

## Authority Boundary

This skill owns **only** writing and maintaining the feature specification (`spec.md`) ([authority-boundary.md](../../rules/authority-boundary.md)). It does not perform another skill's responsibility. Tasks that belong to another workflow stage:

- writing or changing application code → `/webkit-implement`
- reviewing an implementation → `/webkit-verify`, `/webkit-code-review`
- investigating a bug → `/webkit-investigate`

If a task belongs to another stage: **stop, report it, and do not continue** that task. Report it as `Authority boundary: <the task> belongs to /webkit-<skill>. Not done here.` Do not compensate for another skill, and do not generate work outside this authority.

---

## Inputs

| Form | Meaning |
| --- | --- |
| `/webkit-specify <request>` | New feature, or an update to the ticket that already covers it (Phase 4 finds it). |
| `/webkit-specify <target_path> <request>` | Same, with the code location the feature lives in. |
| `/webkit-specify T##### <request>` | Work on that existing ticket. |

---

## Workflow Integration

```text
          /webkit-specify <request>
                     │
   Phase 1  Requirement understanding
   Phase 2  Existing project analysis (read-only)
   Phase 3  Fill .agents/template/feature-specification.md
   Phase 4  Persist → .agents/specs/<project>/T#####/spec.md
                     │
                     ▼
        Spec = source of truth (locked)
                     │
                     ▼
             webkit-implement
     (backend first → frontend integration)
                     │
                     ▼
     webkit.verify · webkit.code-review
   (check against the spec — never redesign it)
```

The spec is a **file on disk**. The implement and review skills usually run in a new session with no memory of this conversation; they can only follow what was persisted. The same ticket folder later receives `verify.md` and `code-review.md`. Numbering and folder rules are canonical in [ticket-numbering.md](../../rules/ticket-numbering.md).

---

## Phase 1 — Requirement Understanding

Identify:

- Feature name
- Problem being solved
- User / business purpose
- Expected outcome
- Target users (roles, portals)
- Dependencies (features, services, or data that must already exist)

When information is missing:

- Make a reasonable assumption based on the current project, and record it in §15 **Assumptions** (`A-xx`) with its impact if wrong.
- Do **not** stop unless the gap is critical: the answer changes the data model, a user flow, or who may do what, and the project gives no evidence either way. Then ask once, with all critical questions together.
- Never invent a business rule silently. An unconfirmed rule is an assumption or an **Open Question** (`Q-xx`).

---

## Phase 2 — Existing Project Analysis (Mandatory, Read-Only)

**Resolve the project first.** Run [Which Project Am I In?](../../rules/project-profile.md) and state the answer, then read only that project's sections. The projects differ on framework, module layout, route grouping, and database conventions, and a spec written against the wrong one is handed to `/webkit-implement` as truth.

Then inspect:

| Check | Where | Feeds |
| --- | --- | --- |
| Framework and version | `composer.json`, `package.json` | §8 Architecture |
| Installed libraries | `composer.json`, `package.json` | §8, §14 |
| Architecture and folder structure | `app/`, `routes/`, `resources/`, `src/` | §8 Architecture |
| Existing patterns and conventions | the closest existing feature; [.agents/rules/](../../rules/) | §8, §14 |
| Database structure | models (`$table`, `$fillable`, `$casts`, relations), migrations | §8 Database |
| Endpoints and backend classes | route files, controllers, Query / Handler / Action classes | §8 Backend |
| Frontend modules | pages, components, composables, api, stores | §8 Frontend |

Rules:

- **Reuse before create.** If an existing model, table, route, controller, or component covers the same domain entity, spec it as **Reused** or **Extended**. Never spec a parallel table or a duplicate endpoint. Spec something **New** only when the scan finds nothing, or the user explicitly asked for a separate one.
- **Real names only.** Every table, column, class, route, and component named in the spec either exists (verified here) or is marked **(new)**.
- If project information cannot be detected, use only the prompt context and record that limit as an assumption in §15.

---

## Phase 3 — Generate the Specification

Fill the template [.agents/template/feature-specification.md](../../template/feature-specification.md).

- The template is the format. Do not add, remove, rename, or reorder its sections.
- Follow the fill rules in its header comment, then delete that comment and every other guide comment.
- A finished spec contains no `{{`, no blank cell, and no vague wording. A section that does not apply says `N/A — <reason>`.

What each section must hold:

| Section | Must hold |
| --- | --- |
| Metadata | Project, ticket, feature, today's date, version `1.0`, status `Draft`. |
| §1–3 Overview, Objective, Background | One line each for what / why / problem; measurable success criteria (`SC-xx`). |
| §4 Scope | **Not Included** lists anything a developer could assume is in scope, with a reason. |
| §5 User Flow | Every flow as User → Action → Validation → Processing → Result, plus its failure paths. |
| §6 Functional Requirements | One `FR-xx` block per behavior, each verified by at least one AC. |
| §7 Non Functional Requirements | All five categories. **Performance** covers database optimization, query impact (N+1, indexes), caching, and large data handling (pagination, chunking). |
| §8 Technical Design | The existing pattern found in Phase 2. Every component, class, and table marked Reused / Extended / New. Exact request / response / error contracts. |
| §9 Implementation Plan | Preparation → Backend → Frontend → Testing, in dependency order. Each phase: Goal, Tasks (citing FR / AC), Expected Output. |
| §10 Acceptance Criteria | See the rules below. |
| §11 Edge Cases | Invalid input, empty data / empty states, permission, failure, unexpected behavior (data conflicts, concurrency, double submit, retry replay). |
| §12 Testing Strategy | What is tested, the expected test cases, and the manual verification steps, each mapped to AC. |
| §13 Security Considerations | Authentication, authorization (per role, with the rejection response), validation (per field), data protection, and API security (IDOR, mass assignment, rate limits). |
| §14 Implementation Notes | Conventions, files not to change, pitfalls, config, deploy / rollback. |
| §15 Assumptions and Decisions | Phase 1 assumptions, the technical decisions made in this phase, open questions. |
| §16 Change Log | `1.0 · <today> · Initial · Created specification`. |

### Acceptance criteria rules

- **Mechanically verifiable.** Exact inputs and exact results: values, status codes, response keys, messages. "The request fails gracefully" is a bad row; "`422` with `{"message": "End date must be after start date"}`" is a good one.
- **Coverage.** At least one AC per FR, per NFR, and per edge case.
- **Self-contained.** Checkable against a running system without reading the implementation.
- **Stable IDs.** `AC-01`, `AC-02`, … `/webkit-verify` reuses them as claim IDs.

### Technical decisions

Choose the option that fits the existing project pattern and record it in §15 **Technical Decisions** with the alternatives rejected and the reason. Do not present option menus or pros/cons tables. A choice that is business policy rather than a technical default (who may approve, what a fee is) is never picked for the user: record it as an **Open Question**.

### Output style

Priority: **Clarity > Completeness > Length.** Avoid:

- Explanations without implementation value
- Repeating information. State it once and reference it by ID or section.
- Generic advice
- Unnecessary alternatives

---

## Phase 4 — Persist the Spec (MANDATORY)

Displaying the spec in chat is not enough; `/webkit-implement` and the review skills run in separate sessions.

**Step 1 — Resolve the project folder.** Restate the Phase 2 answer as the project's lower-case folder name under `.agents/specs/`. Ticket numbers are per project; allocating in the wrong folder collides with real work there.

**Step 2 — Reuse or allocate the ticket, in this order.**

1. **The user named a ticket** (`/webkit-specify T00007 ...`, or a path inside `T00007/`) → use `.agents/specs/<project>/T00007/`. Create it only if genuinely absent, and say so.
2. **A ticket already covers this feature** → use it and follow [Changing an Existing Spec](#changing-an-existing-spec). Check before allocating; this covers ticket folders and legacy portal folders:

   ```bash
   grep -ril '<feature name or route>' ".agents/specs/$project" --include='*.md' 2>/dev/null
   ```

   A hit in a **legacy** portal spec (`.agents/specs/<project>/<portal>/<feature>.md`): say so and ask whether to edit it in place or migrate it into a new ticket. Never silently duplicate a spec ([duplicate-prevention.md](../../rules/duplicate-prevention.md)).
3. **Nothing matches** → allocate the next number in that project. Scan the disk; never guess from memory or chat history:

   ```bash
   project="<project>"   # the folder name resolved in Step 1

   max=$(find ".agents/specs/$project" -maxdepth 1 -type d -name 'T[0-9][0-9][0-9][0-9][0-9]' 2>/dev/null \
         | sed 's#.*/T##' | sort -n | tail -1)
   next=$(printf 'T%05d' $(( ${max:-0} + 1 )))
   mkdir -p ".agents/specs/$project/$next"   # claim it before writing anything
   echo "$project/$next"
   ```

   Always `max + 1`, never the first free gap: a retired number stays retired.

**Step 3 — Write the file.**

- Path: `.agents/specs/<project>/<ticket>/spec.md` (e.g. `.agents/specs/<project>/T00003/spec.md`). Exactly `spec.md`: no ticket number, date, feature name, or portal in the filename; the folder already names the ticket.
- A ticket created before this skill holds its spec as `specs.md`. That file **is** the spec: update it under its existing name and never create a second spec beside it.
- Do not create `verify.md` or `code-review.md`. An empty placeholder reads as "already verified".

---

## Changing an Existing Spec

Once written, the spec is locked. Classify every change before editing.

- Do **not** create a new version because of an implementation review.
- Do **not** rewrite the whole spec for a small correction.
- Do **not** suggest architectural changes again unless there is a real requirement conflict.

### Minor change: update in place, no new version

Examples: UI adjustment, naming correction, validation improvement, bug fix, missing edge case, correcting a specification error found by `/webkit-verify` (the spec misstated a rule the business already had).

1. Edit only the affected sections: §14 Implementation Notes, §8 Technical Design (implementation details), §10 Acceptance Criteria, and §11 for a new edge case.
2. Add a §16 Change Log row under the **current** version, type `Minor`.
3. Leave **Specification Version** unchanged and every other section untouched.

### Major change: new version

Examples: completely different feature behavior, new user flow, database redesign, breaking API change, different business requirement.

1. Increment the version: `1.0` → `1.1` → `1.2`. Same file; the history lives inside it.
2. Update **Specification Version** in Metadata.
3. Update the affected sections. Keep IDs stable: append new ones, and retire removed ones with ~~strikethrough~~ and a reason.
4. Add a §16 Change Log row, type `Major`, with the reason, the impact, and the changed sections.
5. If the spec was `Approved` or `In Progress`, set Status to `In Review` until the user approves the new version.

**When unsure:** a change is Major only if it alters a user flow (§5), the data model (§8 Database), an API contract (§8 Backend), or a business requirement (§4, §6) **because a stakeholder changed it**. Everything else is Minor, including a correction where the spec never matched the business rule in the first place.

**Older specs** (written before this template: a `> **Version:** v<N>` header and no Metadata table) keep their own format. A minor change edits in place and adds a `<!-- Changelog -->` line without bumping. A major change bumps `v<N>` the same way.

---

## After Specification Creation

The spec is now the source of truth.

1. The developer reads the spec.
2. The developer implements it phase by phase (§9) with `/webkit-implement`: backend first, then frontend integration.
3. The reviewer checks the implementation against the acceptance criteria (`/webkit-verify`) and code quality (`/webkit-code-review`).
4. Issues found update §14 Implementation Notes as a minor change. They do not restart the specification.

## Review Rules

These bind every review of an implementation built from this spec: `/webkit-verify` (which applies them as its No Scope Expansion and Spec Update Rules), `/webkit-code-review`, and any adversarial review.

Do not ask "Should we redesign this?". Check:

- Does the implementation follow the specification?
- Are the acceptance criteria satisfied?
- Are the edge cases handled?
- Are the security requirements met?

Recommend a spec modification only when:

- a requirement is impossible to implement as written,
- the specification contradicts itself, or
- a major requirement is missing.

Such a modification is then classified Minor or Major as described above.

---

## Follow-up Commands

End by stating the ticket and the saved path, e.g. "Spec saved as `T00003` → `.agents/specs/<project>/T00003/spec.md`; implement it on branch `T00003`." Then suggest:

- Build it (backend first, then frontend integration): `/webkit-implement <ticket>`
- Conformance against the spec: `/webkit-verify <ticket>` (writes `verify.md` in the same folder)
- Diff review: `/webkit-code-review <ticket>` (writes `code-review.md` in the same folder)

This skill creates no branch; `/webkit-implement` branches on the ticket number ([git-workflow.md](../../rules/git-workflow.md#step-3--derive-the-branch-name)).
