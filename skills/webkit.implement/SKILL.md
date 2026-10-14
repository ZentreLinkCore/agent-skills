---
name: webkit-implement
description: |
  Builds an approved ticket by executing its `plan.md` task by task (backend first, then frontend), reusing existing code before creating any, then applies the SemVer step from `.agents/config/<project>.yml`. Never changes the spec or the scope; stops with "Specification clarification required" when the spec falls short.
  Trigger: "/webkit-implement", "implement the ticket", "build the spec", "execute the plan", "start coding T#####"
  Use when: a ticket already has spec.md and plan.md and the code should now be written on its branch.
---

# Webkit Implement

Acts as a senior software engineer implementing an approved specification. The implementation **must follow the specification exactly**: this skill turns the spec into production-ready code, backend first, then frontend integration.

It is **not** responsible for creating new features, modifying requirements, expanding scope, updating the specification, or introducing personal architectural preferences. **The specification is the single source of truth.**

---

## Authority Boundary

This skill owns **only** turning an approved specification into code ([authority-boundary.md](../../rules/authority-boundary.md)). It does not perform another skill's responsibility. Tasks that belong to another workflow stage:

- writing, completing, or changing the spec → `/webkit-specify` (report **Specification clarification required**)
- reviewing the result → `/webkit-verify`, `/webkit-code-review`, `/webkit-design-review`
- applying review findings → `/webkit-fix`
- investigating an unrelated bug → `/webkit-investigate`

If a task belongs to another stage: **stop, report it, and do not continue** that task. Report it as `Authority boundary: <the task> belongs to /webkit-<skill>. Not done here.` Do not compensate for another skill, and do not generate work outside this authority.

---

## Inputs

| Form | Meaning |
| --- | --- |
| `/webkit-implement T#####` | Implement that ticket's spec on that ticket's branch. |
| `/webkit-implement <branch-name>` | Implement on that branch; the branch names the ticket (`T00004`, `T00004-<slug>`, `F0135`). |
| `/webkit-implement` | Implement the spec of the ticket named by the current branch. |

---

## Workflow Integration

```text
   webkit-specify  →  spec.md  (WHAT — .agents/specs/<project>/T#####/spec.md)
                   →  plan.md  (HOW / ORDER — same folder)
                          │
                          ▼
                  webkit-implement          ← you are here
       executes plan.md: backend first → frontend integration
                    → version detection (SemVer bump + CHANGELOG)
                          │
               ┌──────────┴──────────┐
               ▼                     ▼
         webkit-verify       webkit-code-review
               └──────────┬──────────┘
                          ▼
                     webkit.fix
```

---

## Primary Responsibilities

Implement the approved specification by following the existing project architecture and reusing existing components, services, utilities, models, APIs, and patterns. Avoid unnecessary duplication. **Always prefer extending an existing implementation over creating a new one.**

## Development Mindset

Before writing code, always ask:

- Can existing code be reused?
- Does similar functionality already exist?
- Can this be extended instead?
- Will this introduce technical debt?
- Does this follow the project standards?
- Is there a simpler implementation?

---

## Phase 0 — Project Gate (BLOCKING)

> [!CAUTION]
> **Resolve which project you are in before anything else.** This workspace holds projects with different frameworks, HTTP clients, design systems, and **opposite database conventions**. Code written to the other project's conventions looks idiomatic and is wrong; it surfaces as "nothing reusable exists" followed by a duplicate.

Run [Which Project Am I In?](../../rules/project-profile.md) (read `composer.json` / `package.json` and the secondary tells), **state the resolved project in your first message**, and read only that project's sections of the profile.

Read these from your project's section before writing code; they differ between projects, and the database rows are direct opposites:

| Aspect | What the profile tells you |
| --- | --- |
| Frontend | Framework, state solution (composables or hooks + context), file extensions |
| Foreign keys | Whether DB-level foreign keys are forbidden (index the column, enforce integrity in the Query / Handler) or required (`foreignId()->constrained()`) |
| Relationship columns | The naming style (`id`-prefixed or `<parent>_id`) |
| Soft delete | A `status` column, or `softDeletes()` / `deleted_at` |
| Routes | Route files grouped per portal or per domain, and any namespace-vs-URL-prefix differences |
| Controller namespace | `app/Http/Controllers/<portal>/` or `app/Http/Controllers/<Domain>/` |

> [!IMPORTANT]
> Where this skill and the profile disagree, **the profile wins**: it is maintained, and the examples here only illustrate shape. Where the profile and the code disagree, **the closest sibling module wins**; flag the drift and offer to update the profile.

## Phase 0.5 — Branch Gate (BLOCKING)

> [!CAUTION]
> **Do not create or edit a single application file until this is done.** Run the [Mandatory Branch Gate](../../rules/git-workflow.md#mandatory-branch-gate-for-implementing-skills): if the current branch is `main` / `master`, **create and switch to the ticket's branch now**. Creating it is compliance, not a decision that needs approval. Confirming has repeatedly failed: the agent sees `master`, notes it, and implements anyway.

- **The branch is the ticket number**: bare `T00001`, matching the spec folder character for character, so `/webkit-verify` and `/webkit-code-review` find the spec from the branch alone.
- **Invoked with a ticket or branch** that exists on the remote: fetch and analyze it first ([ticket-numbering.md §8](../../rules/ticket-numbering.md#8-resolving-a-ticket-argument-to-its-branch)), then check it out instead of creating a new name. When several branches match (`F0135`, `F0135-fixed`, `f0135`), **stop and ask**.
- **Already on the ticket's branch**: continue there. One ticket, one branch. On a branch for different work, or detached HEAD: **stop and ask**.
- A legacy portal spec with no ticket: use `feature/<domain>-<feature-kebab>` ([git-workflow.md](../../rules/git-workflow.md) Rule 1) and say why.

```bash
git rev-parse --abbrev-ref HEAD    # where am I?
git status --short                 # what am I carrying over?
git checkout -b T00001             # the ticket from the spec
```

Committing remains the user's call.

---

## Phase 1 — Load Context

1. **The specification.** Resolve it ([ticket-numbering.md](../../rules/ticket-numbering.md) §4): `.agents/specs/<project>/T#####/spec.md` (`specs.md` on older tickets; a legacy portal spec at `.agents/specs/<project>/<portal>/<feature>.md` is also valid). **Read it in full.**
   - **No spec** → stop. This skill implements an approved specification; suggest `/webkit-specify`.
   - **Status is not `Approved`** → say so, and ask the user to confirm the spec is ready before writing code.
   - **Open Questions (§15) block something you must build** → stop with **Specification clarification required** (see [below](#if-the-specification-is-incomplete)).
2. **The implementation plan.** `.agents/specs/<project>/T#####/plan.md`, written by `/webkit-specify` from [the implementation-plan template](../../template/implementation-plan.md). **Read it in full.**
   - **Stale plan**: its **Based on Spec Version** differs from the spec's **Specification Version** → stop with **Specification clarification required**: `plan.md is based on spec v<x>, the spec is v<y>; update it with /webkit-specify <ticket> --plan`. A stale plan omits the work the new version added.
   - **No plan** (tickets specified before plans existed, legacy portal specs): continue, and plan from the spec's §9 (older specs: Build Order) and §8 as in [Phase 3](#phase-3--follow-the-plan). Say so in the first message and suggest `/webkit-specify <ticket> --plan` for next time.
   - **Some tasks already ticked `[x]`**: a previous session got that far. Resume at the first unticked task, after spot-checking that the files the ticked tasks name exist.
3. **The ticket's other documents.** Read `investigation.md`, `verify.md`, and `code-review.md` in the ticket folder if they exist; they are context, not new requirements.
4. **The existing project.** Start from the plan's §1 Technical Context, then confirm it against the profile and the reference implementation it names: framework and file extensions, folder structure, existing modules, APIs and route files, services / Query / Handler / Action classes, components and the design system, state solution, HTTP client, and database design. Where §1 and the code disagree, the code wins; record it as plan drift.

What the spec binds:

| Spec section | Binds |
| --- | --- |
| §4 Scope | What to build, and what must **not** be built (Not Included). |
| §5, §6 User Flow, Functional Requirements | The behavior, step by step. |
| §8 Technical Design | Components, classes, routes, tables, columns, and the exact request / response / error contracts. |
| §7, §11, §13 Non-functional, Edge Cases, Security | Build obligations, not background: authorization and its rejection response, validation per field, double-submit and retry guards, error shapes, performance limits. |
| §10 Acceptance Criteria | The literal values, status codes, and messages `/webkit-verify` will check. Build to the rows, not a paraphrase. |
| §15 Technical Decisions | Binding choices. |

What the plan binds (it **derives** from the spec and adds no requirement; where the two disagree, the spec wins):

| Plan section | Binds |
| --- | --- |
| §2 Reuse Map | The starting rows of your Reuse Ledger (Phase 2). |
| §3 File Change Map | The files to create or modify. A file outside it needs a Reuse Ledger row and a plan-drift note. |
| §4–§7 Phases and tasks | Task order, each task's files and exact change, and its Done When. |
| §8 Acceptance Walk | How each AC is exercised in Phase 6. |
| §9 Commands for the User | What you list for the user and never run yourself (migrations, seeders, installs, env keys). |

Older specs use other section names (Business Rules, Permissions, Non-Functional & Failure-Mode Checklist, Build Order, Definition of Done); map them to the rows above. A spec whose §9 still holds a task list (written before plans existed) and has no `plan.md`: that §9 is the plan. Once a `plan.md` exists, it supersedes that list.

---

## Phase 2 — Analyze Existing Code

Search for reusable code before implementing. Review services, components, models, controllers, queries, actions, utilities, validation, and database tables, and for each need ask: *can this be reused? can it be extended? can it replace duplicate logic?* Only create new code when no suitable implementation exists.

**Backend.** Run the [System Awareness](../../rules/system-awareness.md) scan (models → migrations → routes → controllers → Query / Handler / Action classes). Existing model or table covers the data → reuse it, never a new migration. Existing controller or route covers the module → add a method, never a parallel controller or duplicate route.

> [!CAUTION]
> **`app/Domain/` is retired.** Queries, Handlers, and Actions live at `app/Queries/<Domain>/`, `app/Handlers/<Domain>/`, `app/Actions/<Domain>/` (`<Domain>` is a PascalCase domain folder, never a portal). Searching `app/Domain/` returns nothing, which reads as "nothing exists" and ends in a duplicate in a dead namespace.

**Frontend.** In this order, stopping at the first acceptable match:

1. The current module.
2. **The design system**: list the components directory your profile documents and read its barrel export. Never skipped; it prevents this skill's most expensive mistake.
3. Sibling modules (import a shared component; do not copy it).
4. Shared utilities, hooks, and composables (formatting, debounce, dates, currency, storage).

**Search semantically.** A solution is often named for another domain or generically: `EmployeeTable` → `MemberTable` → `DataTable` → `Table`; `StatusBadge` → `Badge` → `Chip`; `CSelect` → `Select` → `Dropdown`. **Never search for a name you remember**: a component name from the other project returns nothing and produces a duplicate. A raw `<button>`, `<input>`, `<select>`, `<table>`, or hand-rolled modal is a reuse failure whenever the design system ships that primitive.

**Budget.** Search targeted directories, not the whole repo; read at most two full files at once. When the budget runs out, use the best match found. Exhaustion means *unknown*, not *nothing exists*: never quietly create.

### Reuse Ledger (MANDATORY)

A new file is a claim that nothing reusable exists, and that claim needs evidence. **Start from the plan's §2 Reuse Map** and re-confirm each row against the current code (the plan may be days old): a `Found` file that no longer exists, or a match the plan missed, overrides the plan and is recorded as plan drift. Before creating **any** controller, Query, Handler, Action, model, migration, request, component, page, composable / hook, util, type, or api file, record:

| Artifact | Searched | Found | Decision |
| --- | --- | --- | --- |
| `<what you are about to create>` | `<the actual path / grep, including generic-name variants; the path must exist>` | `<file, or NONE>` | `REUSE` / `EXTEND` / `CREATE — <why nothing fit>` |

- `CREATE` with no recorded search is a violation. If there is no row, the file should not exist.
- A migration is the highest-stakes `CREATE`: its row names the models and tables checked.
- The `CREATE` rows become the **New Files** list of the implementation summary.

---

## Phase 3 — Follow the Plan

Execute `plan.md` task by task, in its order: the plan's Preparation tasks, then its Backend tasks (built per this skill's Phase 4), its Frontend Integration tasks (Phase 5), and its Validation tasks (Phase 6). **The backend is always completed before frontend integration.**

- **One task at a time.** Make the task's change in the files it names, check its **Done when**, then tick it in `plan.md` (`- [ ]` → `- [x]`) **and** in `task.md` §2. Set **Plan Status** to `In Progress` when you tick the first task and to `Done` when the last one is ticked. Ticking and Plan Status are the **only** edits you make to the plan: they are how the next session knows where to resume.
- **Never tick a task whose Done When you could not confirm.** Leave it unticked and name it, with the reason, in the summary's Notes.
- **Do not reorder** unless a dependency the plan missed forces it; record the reorder as plan drift.
- **Plan drift** is any place the plan cannot be followed as written: a path that does not exist, a Reuse Map row the code contradicts, a missing step a spec FR / AC needs, a wrong order. Follow the **spec** (it binds; the plan only derives from it), make the smallest deviation that satisfies it, and list every drift in the summary's Notes so `/webkit-specify` corrects the plan. Do not rewrite the plan yourself.
- **A task the spec does not justify** is not built: report it as **Specification clarification required**.

**No `plan.md`** (older tickets): build an internal plan from the spec's §9 (or Build Order) and §8 instead: backend tasks, frontend tasks, shared tasks, in dependency order (migration → model → Query / Handler → controller and route → frontend api layer → state → pages and components). Do not expose it unless the user asks, and do not save it; writing `plan.md` belongs to `/webkit-specify`.

---

## Phase 4 — Backend Implementation

Implement only what the specification defines.

**Database**

- Migrations, schema updates, and indexes (`->index()` on relationship and frequently filtered columns, plus timestamps), using **your project's FK and soft-delete style** (from the profile, Phase 0).
- Never create a migration for a table that exists: search `database/migrations/` for `Schema::create('<table>')` first.
- **Never run migrations automatically.** List them in the summary; the user runs them.

**Business logic**

| Layer | Location | Shape |
| --- | --- | --- |
| Query (reads) | `app/Queries/<Domain>/Get<X>Query.php` | `extends Query`, static `execute($params = [])`, eager loading, pagination |
| Handler (writes) | `app/Handlers/<Domain>/Save<X>Handler.php` | `extends Handler`, static `execute()`, inside `DB::transaction` |
| Action | `app/Actions/<Domain>/` | Only where the domain already uses Actions, or a step is genuinely reused |

**API**

- Endpoints in the existing group file `routes/api/<group>.php`, with the controller's `use` import in that same file; never a new loader in `routes/api.php`.
- Thin controllers: call the Query / Handler, `try/catch (Exception $e)`, return `response()->json(...)`. **This project uses no API Resources**: never scaffold a `JsonResource`.
- Validation follows the sibling controller (inline by default; a FormRequest only where the controller already uses one), covering every rule in spec §13.
- Authorization on the server, with the exact rejection status and body the spec gives.
- Response and error shapes match spec §8 field by field.

**Models**: relationships, scopes, and casts the spec needs, on the existing model where one exists.

**Events, jobs, policies**: only when the specification requires them.

**Domain calculations** (payroll, overtime, leave credits): follow the spec and [hrms-rules.md](../../rules/hrms-rules.md) for exact rates; never hard-code ad-hoc numbers.

**Testing**: add the tests [testing.md](../../rules/testing.md) requires for changed business logic, where the project has a test runner.

Full worked examples of each layer, in this codebase's exact style, are in [project-profile.md](../../rules/project-profile.md); open the closest sibling class before writing.

---

## Phase 5 — Frontend Integration

Begin only after the backend is ready. Implement the pages, components, forms, state, API integration, validation, and loading / error / empty states the spec defines.

- **Module layout**: match the closest sibling module exactly (the profile says whether modules nest under a portal or a domain). Routes, an api layer, state, pages, and a barrel; `types/`, `utils/`, `store/` only when needed. New files in TypeScript where the project has adopted it.
- **API layer**: one `use<Feature>Api()` factory. **Import the HTTP client the profile names**: the projects use different clients, and one already unwraps `response.data` (a second `.data` gives `undefined`, not an error). Endpoint strings come from the routes you just registered, never a guess.
- **State**: pages and components call the state composable / hook; the state layer calls the api hook; nothing calls the HTTP client directly. Debounce search inputs at 300 ms with the shared helper; clean up timers, listeners, and subscriptions on unmount. Never introduce a state library the project does not use.
- **Routes**: lazy-import pages; where an aggregator auto-registers module routes, do not edit it.
- **Validation** matches the backend rules and shows the backend's error messages.
- **States**: loading, error (the spec's error responses, not only success), empty, and permission-based visibility (hide or disable per the spec's authorization table).
- **Components**: reuse the design system; never duplicate a component. A component general enough for other modules goes in the shared components directory.
- **Styling**: Tailwind and your project's tokens only. Every color has its `dark:` counterpart; cards and tables use `bg-white dark:bg-slate-800`. Accent colors follow the profile: per-portal accents ([ui-design.md](../../rules/ui-design.md)) where the project has portals, otherwise the project's theme tokens.
- **Where [ui-design.md](../../rules/ui-design.md)'s table rules apply** (projects with portals): wide tables support drag-to-scroll; statutory ID columns (SSS, PhilHealth, Pag-IBIG) are left-aligned, non-wrapping monospace with an icon.

---

## Phase 6 — Integration Validation

Before finishing, verify:

- The frontend connects correctly to the backend (the endpoint resolves: `php artisan route:list --path=api`).
- Frontend validation matches backend validation.
- API responses, including error responses, are handled correctly.
- Loading, error, and empty states exist.
- Permission handling works for every role in the spec, including the roles that must be rejected.
- Edited PHP files parse (`php -l <file>`); the frontend typechecks / builds where the project has those scripts.
- Walk the §10 Acceptance Criteria, using the plan's §8 Acceptance Walk for how each is exercised: check each row your code owns literally (status code, message, value), especially the rejection rows. Name any row you could not exercise and why.
- Every `plan.md` task is ticked, or named in the summary's Notes with the reason it is not.
- `task.md` is current, per [task.md upkeep](../../rules/ticket-numbering.md#taskmd-upkeep): §2 matches the plan's ticks, the §1 Implement row reads `<done>/<total> tasks`, §4 lists the plan's §9 Commands for the User still to run, **Next step** is `/webkit-verify <ticket>` (or the first unticked task's blocker), and §5 has one line for this run. A ticket with a spec but no `task.md`: create it from [the task-tracker template](../../template/task-tracker.md) first.

---

## Phase 7 — Version Detection

Runs once Phase 6 passes, and only then: a version bump describes finished work. Follow [versioning.md](../../rules/versioning.md) exactly; in short:

1. **Read the mode** from `.agents/config/<project>.yml` → `versioning.mode`. No file or no key → `recommend`. `off` → skip this phase.
2. **Per target** (each independently versioned app the config lists): find what changed since the branch's base in that app's own repo. Nothing under its paths → `NONE`, no bump.
3. **Classify** from the spec's intent and the diff's reach: breaking → **MAJOR**, new capability → **MINOR**, fix → **PATCH**, refactor / docs / tests only → **NONE**. Cite the spec IDs and files that decided it.
4. **Compute** the next version from the **base** version, never the working tree, so a re-run on the same branch never bumps twice.
5. **`auto`**: write the version files, raise the build numbers, and add the CHANGELOG entry. **`recommend`**: change nothing; report the version and the exact edits. Either way, an ambiguous result, or a MAJOR the spec does not declare, is reported as `recommend` only.

The version files and the CHANGELOG are the only files this phase touches. They are not plan tasks and are never plan drift. It never commits, tags, builds, publishes, or changes a server-side minimum version.

---

## Implementation Principles

- **Reuse first.** Existing components, services, helpers, queries, actions, hooks, utilities, validation, and middleware before anything new.
- **Simplicity.** The simplest implementation that satisfies the spec: no unnecessary abstractions, premature optimization, over-engineering, or speculative design.
- **Consistency.** The project's naming, architecture, folder structure, coding style, and dependency pattern ([.agents/rules/](../../rules/)). Never introduce a different architecture unless the spec explicitly requires it.
- **Performance.** No N+1 queries (eager load), duplicate requests, repeated calculations, unnecessary rendering, large payloads (select only needed columns, paginate, chunk), or blocking operations. Optimize only where there is measurable value.
- **Security.** Input validation, authorization, authentication, output sanitization, and secure defaults; no mass assignment from unfiltered input; no secrets or PII in responses or logs.
- **Maintainability.** Readable, small, modular, testable, predictable.
- **Incremental changes.** When a file exists, change only what the spec needs: preserve developer comments, business logic, formatting, imports, and existing methods. Generate the smallest diff; never overwrite working files.

## Restrictions

Do **not**:

- create new requirements,
- modify the specification,
- modify the plan beyond ticking tasks and setting Plan Status,
- expand scope or invent missing features,
- rewrite the architecture,
- duplicate existing code,
- replace project patterns with personal preference,
- ignore reusable implementations.

## If the Specification Is Incomplete

If implementation cannot continue because the specification is incomplete, ambiguous, or contradictory:

1. **Stop.**
2. Report **Specification clarification required**, naming the spec section and exactly what is missing.
3. Do not invent behavior and do not guess business logic. The spec owner resolves it with `/webkit-specify`.

A problem in the **plan** alone (the spec is clear) is not a stop: follow the spec and record it as plan drift ([Phase 3](#phase-3--follow-the-plan)). Only a stale plan stops the run.

Where the spec and a rule in [.agents/rules/](../../rules/) genuinely conflict, follow the rule and report the conflict in the summary's Notes.

---

## Completion Checklist

Before implementation is complete, confirm:

- ✓ Backend completed
- ✓ Frontend integrated
- ✓ Existing code reused where appropriate
- ✓ No unnecessary duplication
- ✓ Validation implemented
- ✓ Authorization implemented
- ✓ Error handling implemented
- ✓ Empty states implemented
- ✓ Project conventions followed
- ✓ Every `plan.md` task ticked, or listed in Notes with its reason
- ✓ Version detected per target: bumped (`auto`), recommended, `NONE`, or `off`
- ✓ Specification satisfied

---

## Output — Implementation Summary

End by printing the summary in chat, filled from the template [.agents/template/implementation-summary.md](../../template/implementation-summary.md). Follow its exact structure (Metadata, Implementation Summary, Reused Components, New Files (each with its Reuse Ledger CREATE reason), Updated Files, Version, Notes, including every plan drift) and delete its guide comments. It is not saved as a file.

Do not stage or commit. Suggest a Conventional Commit message per [git-workflow.md](../../rules/git-workflow.md) whose type matches the Phase 7 level (e.g. `feat(payroll): add payroll processing` for MINOR; `feat(<scope>)!:` with a `BREAKING CHANGE:` footer for MAJOR).

---

## Follow-up Commands

- Check the implementation against the spec: `/webkit-verify <ticket>`
- Review the code quality: `/webkit-code-review <ticket>`
- Review the visual layer: `/webkit-design-review <ticket>`
