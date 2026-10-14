---
name: webkit-specify
description: |
  Writes a feature's spec and implementation plan before any code exists: `.agents/specs/<project>/T#####/spec.md` (what, with Given/When/Then acceptance criteria), `plan.md` (files and tasks in build order), and `task.md` (the progress tracker every later skill keeps current). Never touches application code. Bugs go to /webkit-investigate; writing the code is /webkit-implement.
  Trigger: "/webkit-specify", "write a spec", "specify this feature", "new feature request", "acceptance criteria", "implementation plan"
  Use when: a new feature, or a change to a ticket's intended behavior, must be pinned down before anyone builds it.
---

# Webkit Specify

Creates the implementation blueprint **before** coding. The spec becomes the single source of truth for the feature: developers implement from it, reviewers check against it, and it is not redesigned after the fact. The goal is no repeated redesign, no conflicting suggestions, and no endless spec revisions after implementation.

Process: understand the requirement → analyze the existing project → generate the spec from the template → derive the implementation plan from the spec → lock the intended behavior → implementation executes the plan, and review checks against the spec.

Three files, three jobs: **`spec.md` says WHAT** (requirements, contracts, acceptance criteria) and is what reviewers check against; **`plan.md` says HOW and IN WHAT ORDER** (files, tasks, dependencies) and is what `/webkit-implement` executes and ticks off; **`task.md` says WHAT IS DONE** (every task and finding with its checkbox, what the ticket waits on, a log of each skill run), and every later skill keeps it current.

> [!IMPORTANT]
> **This skill MUST NOT modify application files.** No controllers, migrations, routes, components, or composables. Its only output is `spec.md`, `plan.md`, and `task.md` in the ticket folder.

---

## Authority Boundary

This skill owns **only** writing and maintaining the feature specification (`spec.md`) and its implementation plan (`plan.md`), and creating the ticket's tracker (`task.md`) ([authority-boundary.md](../../rules/authority-boundary.md)). It does not perform another skill's responsibility. Tasks that belong to another workflow stage:

- writing or changing application code → `/webkit-implement`
- reviewing an implementation → `/webkit-verify`, `/webkit-code-review`
- investigating a bug → `/webkit-investigate`

If a task belongs to another stage: **stop, report it, and do not continue** that task. Report it as `Authority boundary: <the task> belongs to /webkit-<skill>. Not done here.` Do not compensate for another skill, and do not generate work outside this authority.

---

## Inputs

| Form | Meaning |
| --- | --- |
| `/webkit-specify <request>` | New feature, or an update to the ticket that already covers it (Phase 5 finds it). |
| `/webkit-specify <target_path> <request>` | Same, with the code location the feature lives in. |
| `/webkit-specify T##### <request>` | Work on that existing ticket. |
| `/webkit-specify T##### --plan` | Generate `plan.md` for a ticket whose spec has none (tickets written before the plan existed), or regenerate a stale one. Runs Phase 2 and Phase 4, then saves `plan.md` and creates or re-syncs `task.md` (Phase 5, Step 3); the spec is read, never edited. |

---

## Workflow Integration

```text
          /webkit-specify <request>
                     │
   Phase 1  Requirement understanding
   Phase 2  Existing project analysis (read-only)
   Phase 3  Fill .agents/template/feature-specification.md   → spec
   Phase 4  Fill .agents/template/implementation-plan.md     → plan (derived from the spec)
   Phase 5  Persist → .agents/specs/<project>/T#####/spec.md
                    → .agents/specs/<project>/T#####/plan.md
                    → .agents/specs/<project>/T#####/task.md   (from the plan)
                     │
                     ▼
   spec.md = source of truth (locked)  ·  plan.md = build order  ·  task.md = what is done
                     │
                     ▼
             webkit-implement
   (executes plan.md task by task: backend first → frontend integration)
                     │
                     ▼
     webkit.verify · webkit.code-review → webkit.fix
   (check against the spec — never redesign it; each run updates task.md)
```

The spec and the plan are **files on disk**. The implement and review skills usually run in a new session with no memory of this conversation; they can only follow what was persisted. The same ticket folder later receives `verify.md` and `code-review.md`, and `task.md` records each of those runs. Numbering and folder rules are canonical in [ticket-numbering.md](../../rules/ticket-numbering.md).

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
| Framework and version | `composer.json`, `package.json` | §8 Architecture; plan §1 |
| Installed libraries | `composer.json`, `package.json` | §8, §14; plan §1 |
| Architecture and folder structure | `app/`, `routes/`, `resources/`, `src/` | §8 Architecture; plan §1, §3 |
| Existing patterns and conventions | the closest existing feature; [.agents/rules/](../../rules/) | §8, §14; plan §1 Reference implementation |
| Database structure | models (`$table`, `$fillable`, `$casts`, relations), migrations | §8 Database |
| Endpoints and backend classes | route files, controllers, Query / Handler / Action classes | §8 Backend; plan §2 |
| Frontend modules | pages, components, composables, api, stores | §8 Frontend; plan §2 |
| Check commands | `composer.json` / `package.json` scripts, test config | §12; plan §1 Checks |

Rules:

- **Reuse before create.** If an existing model, table, route, controller, or component covers the same domain entity, spec it as **Reused** or **Extended**. Never spec a parallel table or a duplicate endpoint. Spec something **New** only when the scan finds nothing, or the user explicitly asked for a separate one.
- **Record the search.** Note what you searched and what it found for every component, class, and table: these become the plan's §2 Reuse Map, so `/webkit-implement` does not repeat the scan blind.
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
| §5 User Flow | Every flow as numbered steps (User Action → System Behavior → Expected Result), plus its failure paths. |
| §6 Functional Requirements | One `FR-xx` block per behavior, each verified by at least one AC. |
| §7 Non Functional Requirements | All five categories. **Performance** covers database optimization, query impact (N+1, indexes), caching, and large data handling (pagination, chunking). |
| §8 Technical Design | The existing pattern found in Phase 2. Every component, class, and table marked Reused / Extended / New. Exact request / response / error contracts. |
| §9 Implementation Plan | The template's pointer line to `plan.md`, unchanged. No tasks in the spec: the plan is written in Phase 4. |
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

## Phase 4 — Generate the Implementation Plan

Fill the template [.agents/template/implementation-plan.md](../../template/implementation-plan.md) from the finished spec and the Phase 2 scan. Same format rules as Phase 3: no added, removed, renamed, or reordered sections; follow the header fill rules, then delete every guide comment; no `{{`, no blank cell.

The plan **derives**; it never decides. Every task traces to an ID in the spec, and every file, class, and route it names is one §8 already named.

| Section | Must hold |
| --- | --- |
| Metadata | Same project, ticket, and feature as the spec; **Based on Spec Version** = the spec's Specification Version; Plan Revision `1`; Plan Status `Ready` (or `Draft` while the spec has Open Questions). |
| §1 Technical Context | The facts from Phase 2 that `/webkit-implement` would otherwise re-discover: project, stack, HTTP client, state, DB conventions, design system, the reference sibling feature, and the exact check commands. |
| §2 Reuse Map | One row per §8 component, class, and table: the search actually run, what it found, and REUSE / EXTEND / CREATE. A CREATE row says why nothing fit. |
| §3 File Change Map | Every file touched, Create or Modify, in task order. Nothing the spec does not need. |
| §4–§7 Phases | Preparation → Backend → Frontend Integration → Validation. Tasks in dependency order (migration → model → Query / Handler / Action → controller → route → api layer → state → components → pages → route registration). Each task: Files, Change (exact: methods, columns, keys, props), Covers, Depends on, Done when. |
| §8 Acceptance Walk | Every AC in spec §10, how it is exercised (test or manual MT-xx), and the task that delivers it. |
| §9 Commands for the User | Migrations, seeders, package installs, env keys, native rebuilds: everything `/webkit-implement` must not run itself, in order, with rollback. |
| §10 Plan Change Log | `1 · <today> · <spec version> · Created plan · All`. |

Rules:

- **Coverage check before saving.** Every FR in §6 is in some task's Covers; every AC in §10 is in the Acceptance Walk. A gap means a missing task, or a requirement nobody can build: find out which.
- **A gap in the spec is fixed in the spec.** If planning shows the spec is missing something a task needs (no contract for an endpoint the flow calls, a table with no columns), correct the spec in Phase 3 first, then plan it. Never fill the gap inside the plan.
- **Task size.** One file, or one tightly coupled change (a route and its controller method). A task too big to check with one Done When is two tasks.
- **No requirements, no rationale.** The plan cites `FR-xx` / `AC-xx` / `D-xx` and never restates them. The why lives in spec §15.

**`--plan` mode** (`/webkit-specify T##### --plan`): resolve the ticket, read its spec in full (`spec.md`, or `specs.md` on older tickets), run Phase 2, then this phase. Do **not** edit the spec, even where it is weak; a spec problem that blocks a task is reported as `Specification clarification required: <section> — <what is missing>`, and the plan is saved as `Draft`. An older spec whose §9 (or Build Order) already lists tasks: start from that list and refine it to file level; the spec's list stays as it is, and `plan.md` supersedes it for `/webkit-implement`. An older spec with no FR / AC IDs: cite its section headings instead, and say so in the plan's §10 row. If a `plan.md` already exists, update it per [Keep the plan in step](#keep-the-plan-in-step) instead of overwriting it, keeping every ticked task.

---

## Phase 5 — Persist the Spec and the Plan (MANDATORY)

Displaying them in chat is not enough; `/webkit-implement` and the review skills run in separate sessions.

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

**Step 3 — Write the files.**

- Paths: `.agents/specs/<project>/<ticket>/spec.md`, `.agents/specs/<project>/<ticket>/plan.md`, and `.agents/specs/<project>/<ticket>/task.md` (e.g. `.agents/specs/<project>/T00003/plan.md`). Exactly these names: no ticket number, date, feature name, or portal in the filename; the folder already names the ticket.
- Write the spec first, then the plan, then `task.md`. Spec and plan are both or neither: a spec saved without its plan leaves `/webkit-implement` to plan from scratch.
- **`task.md`** is filled from [the task-tracker template](../../template/task-tracker.md): Metadata from the spec and plan; §1 with the Specify row filled, `0/<N> tasks` for Implement, `—` for every other stage, and Next step `/webkit-implement <ticket>`; §2 lists every plan TASK as `- [ ] TASK-xx — <title>` under its phase (a task blocked by an Open Question ends `— BLOCKED (Q-xx)`); §3 `None yet.`; §4 the Open Questions and §9 Commands for the User; §5 one line for this run. It is a view of the plan: it never holds a task the plan does not.
- A ticket created before this skill holds its spec as `specs.md`. That file **is** the spec: update it under its existing name and never create a second spec beside it. Its plan is still `plan.md`.
- Do not create `verify.md` or `code-review.md`. An empty placeholder reads as "already verified".
- An existing `task.md` is updated in place, never overwritten: its ticks, §3 findings, and §5 log are other skills' history ([task.md upkeep](../../rules/ticket-numbering.md#taskmd-upkeep)).

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

### Keep the plan in step

Every spec change ends by checking `plan.md` in the same ticket folder. The rules are in the plan's §10 header; in short:

| Spec change | Plan update |
| --- | --- |
| Minor, plan unaffected (wording, a message the plan does not quote) | None. |
| Minor, plan affected (a new edge case, a validation rule, a renamed component) | Edit or append the affected tasks, bump **Plan Revision**, add a §10 row. **Based on Spec Version** unchanged. |
| Major | Bring the plan to the new version: append tasks for new work, retire dropped tasks with ~~strikethrough~~, set **Based on Spec Version** to the new version, bump **Plan Revision**, add a §10 row. |
| None (the plan itself was wrong: a bad path, a missing task, a wrong order) | Plan-only correction: edit in place, bump **Plan Revision**, add a §10 row. The spec is untouched. |

**Never edit or untick a task already ticked `[x]`.** `/webkit-implement` ticks tasks as it finishes them, so a ticked task describes code that exists. A change to finished work is a **new** task at the end of its phase (`TASK-14 — Extend SaveLeaveHandler for the v1.1 approval step`). If the ticket has no `plan.md` yet, create one with Phase 4.

Then bring `task.md` in step: Metadata (spec version, plan revision and status), the §1 Specify row, §2 to match the plan (new tasks unticked, retired ones struck through, ticks untouched), §4, and one §5 line. A Major change on a `Done` ticket reopens it: spec Status `In Review`, Plan Status `In Progress`.

---

## After Specification Creation

The spec is now the source of truth.

1. The developer reads the spec.
2. The developer implements it with `/webkit-implement`, which executes `plan.md` task by task (backend first, then frontend integration) and ticks each task as it is done.
3. The reviewer checks the implementation against the acceptance criteria (`/webkit-verify`) and code quality (`/webkit-code-review`). Reviews check against the spec, not the plan.
4. Issues found are recorded without a `/webkit-specify` run: `/webkit-fix` writes each fixed finding into §14 **Review findings** (a Minor change), and `/webkit-verify` applies a proven spec error (Case 1) to the spec and the plan itself. They do not restart the specification. Only a requirement change (Case 2) comes back here.
5. `task.md` shows, at any point, which tasks are done, which findings are still open, and what the ticket is waiting on.

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

End by stating the ticket and the three saved paths, with the plan's size, e.g. "Spec, plan, and tracker saved as `T00003` → `.agents/specs/<project>/T00003/spec.md`, `plan.md` (14 tasks, 9 files), and `task.md`; implement it on branch `T00003`." Name any Open Question that keeps either file in `Draft`. Then suggest:

- Build it (executes `plan.md`: backend first, then frontend integration): `/webkit-implement <ticket>`
- Conformance against the spec: `/webkit-verify <ticket>` (writes `verify.md` in the same folder)
- Diff review: `/webkit-code-review <ticket>` (writes `code-review.md` in the same folder)

This skill creates no branch; `/webkit-implement` branches on the ticket number ([git-workflow.md](../../rules/git-workflow.md#step-3--derive-the-branch-name)).
