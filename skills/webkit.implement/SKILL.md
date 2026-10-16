---
name: webkit-implement
description: |
  Builds an approved ticket by executing its `plan.md` task by task (backend first, then frontend), each change with its test (unit, feature, schema or component; it sets up a frontend test runner where an app has none), reusing existing code before creating any, then applies the SemVer step from `.agents/config/<project>.yml`. Never changes the spec or the scope; stops with "Specification clarification required" when the spec falls short.
  Trigger: "/webkit-implement", "implement the ticket", "build the spec", "execute the plan", "start coding T#####"
  Use when: a ticket already has spec.md and plan.md and the code should now be written on its branch.
---

# Webkit Implement

Acts as a senior software engineer implementing an approved specification. The implementation **must follow the specification exactly**: this skill turns the spec into production-ready code, backend first, then frontend integration.

It is **not** responsible for creating new features, modifying requirements, expanding scope, updating the specification, or introducing personal architectural preferences. **The specification is the single source of truth.**

Shared steps (gates, ticket resolution, templates, `task.md`, code-writing runs) follow [skill-protocol.md](../../rules/conditional/skill-protocol.md). **Authority:** executing an approved plan into code (its only `plan.md` edits are task ticks and Plan Status, mirrored in `task.md`), then the version bump and CHANGELOG. Spec changes → `/webkit-specify` (report **Specification clarification required**); reviews → `/webkit-verify`, `/webkit-code-review`, `/webkit-design-review`; applying review findings → `/webkit-fix`; an unrelated bug → `/webkit-investigate`.

## Inputs

| Form | Meaning |
| --- | --- |
| `/webkit-implement T#####` | Implement that ticket's spec on that ticket's branch. |
| `/webkit-implement <branch-name>` | Implement on that branch; the branch names the ticket (`T00004`, `T00004-<slug>`, `F0135`). |
| `/webkit-implement` | Implement the spec of the ticket named by the current branch. |

## Context Loading Priority

1. **`task.md`** (read `summary.md` first if it exists): ticked tasks, what the ticket waits on, the next step.
2. **`context.md` and `touched-files.md`**, if `/webkit-context` wrote them: the verified files to modify, create, and reuse. **Respect the Do NOT touch list**: a task that needs a listed file is a [Specification clarification required](#if-the-specification-is-incomplete) stop, never a silent edit. `dependency-map.md` only when a task changes a node with callers.
3. **`plan.md`**: Metadata, §1 Technical Context, §2 Reuse Map, and the current phase's unticked tasks; §8–§9 at Phase 6. **`spec.md`**: Metadata and §15 (the Phase 1 gates), then only the sections a task cites ([what binds](#phase-1--load-context)); §10 at Phase 6. No `plan.md`: the spec is the plan, so read it in full.
4. **The task's files**, at the lines it changes, and the plan's §1 reference implementation. Reuse searches: Graphify first ([context-budget.md §2](../../rules/context-budget.md#2-find-code-graphify-first-then-targeted-search)), then the [Phase 2](#phase-2--analyze-existing-code) order.

Rules: the [router](../../rules/rule-router.md) rows for each task's layer, when that task starts; [versioning.md](../../rules/conditional/versioning.md) at Phase 7 only. Templates: [implementation-summary.md](../../template/implementation-summary.md) at output time; [task-tracker.md](../../template/task-tracker.md) only when `task.md` is missing. **Avoid:** the whole spec or every plan phase up front, whole modules or directories, other tickets, resolved findings in old reports, the whole blueprint, re-reading a rule already applied.

## Development Mindset

Follow the existing architecture, reuse existing components, services, utilities, models, APIs, and patterns, and **always prefer extending an existing implementation over creating a new one**. Before writing code, ask: Can existing code be reused? Does similar functionality already exist? Can this be extended instead? Will this introduce technical debt? Does this follow the project standards? Is there a simpler implementation?

---

## Phase 0 — Project Gate (BLOCKING)

Per protocol §1: **state the resolved project in your first message**, and read only its sections of each rule ([project-gate.md §2](../../rules/core/project-gate.md#2-the-differences-that-bite) lists what differs). Code written to the other project's conventions looks idiomatic and is wrong; it surfaces as "nothing reusable exists", followed by a duplicate.

> [!IMPORTANT]
> Skill vs. rule: **the rule wins** (it is maintained; the examples here only illustrate shape). Rule vs. code: **the closest sibling module wins**; flag the drift and offer to update the rule. Exception, (React): code on the [Known drift](../../rules/conditional/backend.md#6-source-path-react-known-drift) table follows its right-hand column, not the sibling.

## Phase 0.5 — Branch Gate (BLOCKING)

> [!CAUTION]
> **Do not create or edit a single application file until this is done.**

Per protocol §1: a ticket or branch argument is fetched and analyzed first ([ticket-numbering.md §8](../../rules/conditional/ticket-numbering.md#8-resolving-a-ticket-argument-to-its-branch)), then the [Mandatory Branch Gate](../../rules/core/git-workflow.md#mandatory-branch-gate-for-implementing-skills) runs. This skill's own case: a legacy portal spec with no ticket branches as `feature/<domain>-<feature-kebab>` ([git-workflow.md](../../rules/core/git-workflow.md) Rule 1); say why.

---

## Phase 1 — Load Context

1. **The specification**, resolved per protocol §1: `.agents/specs/<project>/T#####/spec.md` (`specs.md` on older tickets; a legacy portal spec at `.agents/specs/<project>/<portal>/<feature>.md` is also valid). Its Metadata and §15 first:
   - **No spec** → stop. This skill implements an approved specification; suggest `/webkit-specify`.
   - **Status is not `Approved`** → say so, and ask the user to confirm the spec is ready before writing code.
   - **Open Questions (§15) block something you must build** → stop with **Specification clarification required** (see [below](#if-the-specification-is-incomplete)).
2. **The implementation plan**, `plan.md` in the same folder (written by `/webkit-specify` from [the implementation-plan template](../../template/implementation-plan.md)): Metadata, §1, §2, and the current phase's tasks.
   - **Stale plan**: its **Based on Spec Version** differs from the spec's **Specification Version** → stop with **Specification clarification required**: `plan.md is based on spec v<x>, the spec is v<y>; update it with /webkit-specify <ticket> --plan`. A stale plan omits the work the new version added.
   - **No plan** (tickets specified before plans existed, legacy portal specs): continue, read the spec in full, and plan from its §9 (older specs: Build Order) and §8 as in [Phase 3](#phase-3--follow-the-plan). Say so in the first message and suggest `/webkit-specify <ticket> --plan` for next time.
   - **Some tasks already ticked `[x]`**: a previous session got that far. Resume at the first unticked task, after spot-checking that the files the ticked tasks name exist.
3. **The ticket's other documents**: `investigation.md`, `verify.md`, `code-review.md` if they exist (or `summary.md`, which replaces them), at their status and open findings: context, not new requirements.
4. **The existing project.** Start from the plan's §1 Technical Context and confirm it against the rules and the reference implementation it names: framework and file extensions, folders, modules, route files, Query / Handler / Action classes, design system, state, HTTP client, database design. Where §1 and the code disagree, the code wins; record it as plan drift.

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

Search for reusable code before implementing: services, components, models, controllers, queries, actions, helpers, hooks, utilities, validation, middleware, and tables. For each need ask: *can this be reused? extended? can it replace duplicate logic?* Create only when nothing fits.

**Code graph.** When `graphify-out/graph.json` exists, start each search with `graphify explain "<ExactName>" --all` (a class, method, composable, or component) to see where it lives and who uses it, and `graphify affected` before changing a shared class. Record the command in the Reuse Ledger's *Searched* column. It locates; the file proves: read the hit before deciding `REUSE` or `EXTEND`. A `CREATE` still needs a grep, because a node missing from a stale graph is not proof that nothing exists, and its blind spots ([context-budget.md §2](../../rules/context-budget.md#2-find-code-graphify-first-then-targeted-search)) are grep-only. No graph → the targeted searches below.

**Backend.** Run the [System Awareness](../../rules/conditional/system-awareness.md#2-the-scan) scan (models → migrations → routes → controllers → Query / Handler / Action classes). Existing model or table covers the data → reuse it, never a new migration. Existing controller or route covers the module → add a method, never a parallel controller or duplicate route.

> [!CAUTION]
> **`app/Domain/` is retired** ([project-gate.md §3](../../rules/core/project-gate.md#3-true-in-every-project)). Queries, Handlers, and Actions live at `app/Queries/<Domain>/`, `app/Handlers/<Domain>/`, `app/Actions/<Domain>/` (`<Domain>` is a PascalCase domain folder, never a portal). Searching `app/Domain/` returns nothing, which reads as "nothing exists" and ends in a duplicate in a dead namespace.

**Frontend.** In this order, stopping at the first acceptable match:

1. The current module.
2. **The design system**: list the components directory your stack's frontend rule documents and read its barrel export. Never skipped; it prevents this skill's most expensive mistake.
3. Sibling modules (import a shared component; do not copy it).
4. Shared utilities, hooks, and composables (formatting, debounce, dates, currency, storage).

**Search semantically.** A solution is often named for another domain or generically: `EmployeeTable` → `MemberTable` → `DataTable` → `Table`; `StatusBadge` → `Badge` → `Chip`; `CSelect` → `Select` → `Dropdown`. **Never search for a name you remember**: a component name from the other project returns nothing and produces a duplicate. A raw `<button>`, `<input>`, `<select>`, `<table>`, or hand-rolled modal is a reuse failure whenever the design system ships that primitive.

**Budget** per [context-budget.md §3](../../rules/context-budget.md#3-read-limits). When it runs out, use the best match found. Exhaustion means *unknown*, not *nothing exists*: never quietly create.

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
- **A task that needs a file on `touched-files.md`'s Do NOT touch list** is not built either: stop with **Specification clarification required**, naming the file and the reason the list gives.

**No `plan.md`** (older tickets): build an internal plan from the spec's §9 (or Build Order) and §8 instead: backend tasks, frontend tasks, shared tasks, in dependency order (migration → model → Query / Handler → controller and route → frontend api layer → state → pages and components). Do not expose it unless the user asks, and do not save it; writing `plan.md` belongs to `/webkit-specify`.

---

## Phase 4 — Backend Implementation

Implement only what the specification defines, in the shape of the closest sibling class (worked examples: [backend.md §1–§2](../../rules/conditional/backend.md#1-query--handler--action-all-projects)).

- **Database** ([database.md](../../rules/conditional/database.md)): migrations, schema updates, and indexes (`->index()` on relationship and frequently filtered columns, plus timestamps) in your project's FK, relationship-column, and soft-delete style. No migration for a table that exists (search `database/migrations/` for `Schema::create('<table>')` first). **Never run migrations**: list them in the summary for the user. Feature and schema tests migrate a **disposable** `*_test` database only ([testing.md](../../rules/conditional/testing.md#backend-phpunit)); that is not running the migrations.
- **Business logic** ([backend.md §1](../../rules/conditional/backend.md#1-query--handler--action-all-projects)): reads in `app/Queries/<Domain>/Get<X>Query.php` (`extends Query`, static `execute($params = [])`, eager loading, pagination); writes in `app/Handlers/<Domain>/Save<X>Handler.php` (`extends Handler`, static `execute()`, inside `DB::transaction`); an Action in `app/Actions/<Domain>/` only where the domain already uses Actions or a step is genuinely reused.
- **API** ([backend.md §2–§4](../../rules/conditional/backend.md#2-controllers-and-responses-all-projects)): endpoints in the existing group file `routes/api/<group>.php`, with the controller's `use` import there, never a second loader for an existing group; thin controllers (Query / Handler call, `try/catch (Exception $e)`, `response()->json(...)`, never a `JsonResource`); validation as your project's section and the sibling controller do it, covering every rule in spec §13; authorization on the server with the exact rejection status and body the spec gives; response and error shapes matching spec §8 field by field.
- **Models**: the relationships, scopes, and casts the spec needs, on the existing model where one exists. **Events, jobs, policies**: only when the spec requires them.
- **Domain calculations** (payroll, overtime, leave credits): the spec and [payroll.md](../../rules/conditional/payroll.md) for exact rates; never ad-hoc numbers.
- **Tests, with each task** (protocol §6, [testing.md](../../rules/conditional/testing.md#every-code-change-ships-with-a-test-mandatory)): a unit test for pure logic, a feature test for each Handler, Query, and endpoint (response shape, validation, authorization both ways), a schema test for each migration. Use the task's **Test** line (a plan without one still gets the test); write it with the change, run it, tick the task only when it passes.

---

## Phase 5 — Frontend Integration

Begin only after the backend is ready. Implement the pages, components, forms, state, API integration, validation, and loading / error / empty states the spec defines, per [frontend.md](../../rules/conditional/frontend.md) and your stack's file ([frontend-vue.md](../../rules/conditional/frontend-vue.md) / [frontend-react.md](../../rules/conditional/frontend-react.md)).

- **Module layout**: match the closest sibling module exactly (portal or domain nesting per the stack file): routes, an api layer, state, pages, a barrel; `types/`, `utils/`, `store/` only when needed; TypeScript where the project has adopted it.
- **API layer**: one `use<Feature>Api()` factory on **the HTTP client the stack file names**. One client already unwraps `response.data`: a second `.data` gives `undefined`, not an error. Endpoint strings come from the routes you just registered, never a guess.
- **State**: pages and components call the state composable / hook, which calls the api hook; nothing calls the HTTP client directly. Debounce search inputs at 300 ms with the shared helper; clean up timers, listeners, and subscriptions on unmount. No state library the project does not use.
- **Routes**: lazy-import pages; never edit an aggregator that auto-registers module routes.
- **Validation** matches the backend rules and shows the backend's error messages.
- **States**: loading, error (the spec's error responses, not only success), empty, and permission-based visibility (hide or disable per the spec's authorization table).
- **Components**: reuse the design system, never a duplicate; one general enough for other modules goes in the shared components directory.
- **Tests, with each task** ([testing.md](../../rules/conditional/testing.md#frontend)): every util, composable / hook, api function, component, and page you add or change. No runner in this app yet → set one up first, exactly as [testing.md](../../rules/conditional/testing.md#setting-up-a-missing-frontend-runner-one-time-done-by-the-skill) says (dev dependencies only, proven by the first test), and record it in Notes.
- **Styling** ([ui-design.md](../../rules/conditional/ui-design.md)): Tailwind and your project's tokens only; every color with its `dark:` counterpart; cards and tables `bg-white dark:bg-slate-800`; per-portal accents (§3) where the project has portals, otherwise the theme tokens. With portals, wide tables drag-to-scroll (§2) and statutory ID columns (SSS, PhilHealth, Pag-IBIG) are left-aligned, non-wrapping monospace with an icon (§4).

---

## Phase 6 — Integration Validation

Before finishing, verify:

- The frontend connects correctly to the backend (the endpoint resolves: `php artisan route:list --path=api`).
- Frontend validation matches backend validation.
- API responses, including error responses, are handled correctly.
- Loading, error, and empty states exist.
- Permission handling works for every role in the spec, including the roles that must be rejected.
- Edited PHP files parse (`php -l <file>`); the frontend typechecks where the project has the script, and `node .agents/scripts/check-changed.mjs` is clean (only the changed files; never the full `npm run build`: [testing.md](../../rules/conditional/testing.md#frontend-build-check-changed-files-only)).
- **Every test added in this run passes**, together with the existing tests of the areas touched: `php artisan test --testsuite=Unit`, the feature tests on a disposable database ([testing.md](../../rules/conditional/testing.md#backend-phpunit)), and each frontend app's `npm test`. A test that could not run leaves its task unticked, named in Notes with the command that runs it.
- Walk the §10 Acceptance Criteria, using the plan's §8 Acceptance Walk for how each is exercised: check each row your code owns literally (status code, message, value), especially the rejection rows. Name any row you could not exercise and why.
- Every `plan.md` task is ticked, or named in the summary's Notes with the reason it is not.
- The code graph is current: when `graphify-out/graph.json` exists, run `graphify update .` so the next skill sees this run's code (AST only, no API cost; never commit `graphify-out/`).
- `task.md` is current (protocol §5): §2 matches the plan's ticks, the §1 Implement row reads `<done>/<total> tasks`, §4 lists the plan's §9 Commands for the User still to run, and **Next step** is `/webkit-verify <ticket>` (or the first unticked task's blocker).

---

## Phase 7 — Version Detection

Runs once Phase 6 passes, and only then: a version bump describes finished work. Follow [versioning.md](../../rules/conditional/versioning.md) exactly (read it now, not before): mode, targets, base, computation, `auto` / `recommend`, CHANGELOG.

This skill's decision: classify each target from the **spec's intent** and the diff's reach, citing the spec IDs and files that decided it. A MAJOR the spec does not declare, or an ambiguous result, is reported as `recommend` only. The version files and the CHANGELOG are the only files this phase touches; they are not plan tasks and are never plan drift.

---

## Implementation Principles

- **Simplicity**: the simplest implementation that satisfies the spec; no unnecessary abstraction, premature optimization, over-engineering, or speculative design.
- **Consistency** ([code-quality.md](../../rules/conditional/code-quality.md)): the project's naming, architecture, folders, style, and dependency pattern; never a different architecture unless the spec explicitly requires it.
- **Performance** ([performance.md](../../rules/conditional/performance.md)): no N+1 (eager load), duplicate requests, repeated calculations, needless renders, large payloads (needed columns, paginate, chunk), or blocking operations; optimize only where the value is measurable.
- **Security** ([security-baseline.md](../../rules/core/security-baseline.md)): validation, authorization, authentication, output sanitization, secure defaults; no mass assignment from unfiltered input; no secrets or PII in responses or logs.
- **Maintainability**: readable, small, modular, testable, predictable.
- **Incremental** ([code-quality.md §3](../../rules/conditional/code-quality.md#3-editing-existing-files)): in an existing file change only what the spec needs, preserving developer comments, business logic, formatting, imports, and methods; the smallest diff; never overwrite working files.

## Restrictions

Do **not** create new requirements, modify the specification, modify the plan beyond ticking tasks and setting Plan Status, expand scope or invent missing features, rewrite the architecture, duplicate existing code, replace project patterns with personal preference, or ignore reusable implementations.

## If the Specification Is Incomplete

If implementation cannot continue because the specification is incomplete, ambiguous, or contradictory, or a task needs a file on the Do NOT touch list:

1. **Stop.**
2. Report **Specification clarification required**, naming the spec section (or the listed file) and exactly what is missing.
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

End by printing the summary in chat, filled from [implementation-summary.md](../../template/implementation-summary.md) per protocol §3. It is not saved as a file. Each New File carries its Reuse Ledger CREATE reason; Notes list every plan drift.

Do not stage or commit (protocol §6). Suggest a Conventional Commit message whose type matches the Phase 7 level ([versioning.md §7](../../rules/conditional/versioning.md#7-report)), e.g. `feat(payroll): add payroll processing` for MINOR; `feat(<scope>)!:` with a `BREAKING CHANGE:` footer for MAJOR.

---

## Follow-up Commands

- Check the implementation against the spec: `/webkit-verify <ticket>`
- Review the code quality: `/webkit-code-review <ticket>`
- Review the visual layer: `/webkit-design-review <ticket>`
