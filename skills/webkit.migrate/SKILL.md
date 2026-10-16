---
name: webkit-migrate
description: |
  Moves a feature from the repo it runs in into a named sibling project on a different stack and implements it there: business rules, contracts, states and validation stay identical; framework, state layer, HTTP client and design system follow the target. Writes the contract to `.agents/migrations/`. Never edits the source, runs migrations or commits.
  Trigger: "/webkit-migrate", "migrate this feature", "port this to", "move this feature into", "rebuild it in the new project"
  Use when: an existing feature must exist in another project, built in that project's own conventions.
---

# Webkit Migrate

Acts as a senior engineer moving a feature from the repo it is invoked in into a sibling project on a different stack, and **implementing it there**. Source and target are sibling directories in the same workspace, so the target is a real, writable path, not a handoff document.

It is **not** responsible for:

- building a feature from a spec inside the repo you are in (`/webkit-implement`),
- writing or changing a specification (`/webkit-specify`),
- fixing source defects found along the way (`/webkit-investigate`, then `/webkit-fix`),
- restructuring the source or the target beyond what the migration needs (`/webkit-refactor`),
- reviewing the result (`/webkit-code-review`, `/webkit-verify`, `/webkit-design-review`).

> [!IMPORTANT]
> **Migrating is not porting files line by line.** Extract *what the feature does and the contract it obeys* from the source, then rebuild that behavior in the target's own idioms. If the migrated feature computes the same numbers, moves through the same states, and exposes the same API contract, the migration succeeded, even though the code looks nothing like the source.

---

## Authority Boundary

This skill owns **only** moving an existing feature into the named target project with identical flow ([authority-boundary.md](../../rules/authority-boundary.md)). It does not perform another skill's responsibility. Tasks that belong to another workflow stage:

- new behavior that the source does not have → `/webkit-specify` in the target
- fixing a bug in the source → `/webkit-investigate` in the source
- reviewing the migrated code → `/webkit-verify`, `/webkit-code-review` in the target

If a task belongs to another stage: **stop, report it, and do not continue** that task. Report it as `Authority boundary: <the task> belongs to /webkit-<skill>. Not done here.` Do not compensate for another skill, and do not generate work outside this authority.

---

## Inputs

| Form | Meaning |
| --- | --- |
| `/webkit-migrate <source_path> <target_path>` | Migrate the feature at `<source_path>` in the repo you are in into `<target_path>` in the sibling target repo. |
| `/webkit-migrate <source_path>` | Same, but ask which project and which path to migrate into. Never pick a target yourself. |

- `<source_path>`: what to migrate. A frontend module folder, or a backend surface: a controller, `app/Queries/<Domain>/`, `app/Handlers/<Domain>/`.
- `<target_path>`: where it lands, e.g. `../<target-repo>/<pages-dir>/<portal-or-domain>/<feature>/`.

---

## Workflow Integration

```text
   source feature (the repo you are in)  +  spec.md · investigation.md, if any
                          │  read-only · System Awareness scan on the source
                          ▼
                   /webkit-migrate                ← you are here
                          │  target profile · System Awareness scan on the target
                          ▼
   contract  (.agents/migrations/<portal-or-domain>-<feature>-<YYYYMMDD>.md)
                          │
                          ▼
   implemented in the target repo: backend first → frontend integration
                          │
                          ▼
   parity check against the contract (same numbers, states, endpoints)
                          │
               ┌──────────┴──────────┐
               ▼                     ▼
   /webkit-code-review        /webkit-verify          (run in the target repo)
```

---

## Core Rules

- **Flow is the invariant, stack is the variable.** The contract (left column below) comes out identical; everything in the right column follows the target.
- **Write-scope exception: read-only on the source, write into the target.** Every other skill is confined to the repo it runs in. This skill deliberately writes into the sibling target. On the source side the only write is the contract under `.agents/migrations/`; the source feature is never edited. Inside the target, the **target's** rules apply, never the source's.
- **Ground both sides.** The contract comes from the source's spec and code; every reuse or create decision in the target comes from the target scan. Never invent a column, endpoint, status, or rule ([anti-hallucination.md](../../rules/anti-hallucination.md)). What cannot be verified is asked about.
- **No duplicates in the target.** The target has its own database and routes. A table that exists in the source does not exist in the target until the target scan shows it ([duplicate-prevention.md](../../rules/duplicate-prevention.md)).
- **No scope expansion.** Migrate the feature as it behaves today. Source defects are recorded in the contract, not fixed and not silently copied; behavior the source lacks is not added.
- **Carry compliance rules intact.** Money, tax, payroll, leave, and access-separation rules are correctness-critical: reproduce them exactly and flag them compliance-sensitive.

| Must come out identical (the flow / contract) | Expected to differ (follows the target's stack) |
| --- | --- |
| Business rules and calculations: formulas, rates, thresholds, rounding | Backend architecture: Query / Handler classes or logic in the controller |
| Data contract: field names, types, units, nullability, enum and status values | ORM usage and migrations, in the target's database and migration style |
| API contract: path, method, params, request / response JSON, status codes | HTTP client: the one the target's profile names |
| State machine: every status and the trigger of each transition | Frontend framework, e.g. Vue single-file components → React components |
| Validation rules and error messages | State layer: composables / Pinia ↔ Context / hooks |
| Authorization and access-separation rules | Routing: auto-aggregated module routes or a central router |
| UI behavior: filters, pagination mode, debounce, loading / empty / error states, status → badge map | Design system and styling |
| Money, date, and number formatting semantics | Utility locations, file naming, import aliases |

## Migration Mindset

Ask:

- What does this feature do, independent of how it is built?
- Which states does a record move through, and what triggers each transition?
- Which numbers must come out identical, and what rounds them?
- What does the target already have for this entity, endpoint, or component?
- Which target pattern expresses this source pattern?
- Given only the contract, would the target behave identically to the source?

---

## Phase 0 — Gates (BLOCKING)

> [!CAUTION]
> **Resolve which repo is which before reading a single feature file.** This skill ships in more than one repo, each with its own `.agents/` copy (separate directories, not symlinks), and each copy drifts independently. Extracting from the wrong source produces a contract for files that do not exist; writing into the wrong target puts code in a repo nobody asked to change.

**Source gate.** The source is **the repo you are invoked from**. Run [Which Project Am I In?](../../rules/project-profile.md) there, **state the resolved project in your first message**, and read only its sections. The source's stack (framework, Query / Handler layout, route grouping) comes from the source's profile.

**Target gate.**

1. Resolve the target from `<target_path>`. **If it is omitted, ask which project and which path to migrate into.** Never pick one, and never infer one from the workspace layout or from an earlier run.
2. Confirm the target repo exists on disk, and resolve its project from its own `composer.json` / `package.json`. Its conventions come from the **target's** profile (Phase 2), never from this repo's.
3. A `<target_path>` inside the source repo is not a migration: stop and suggest `/webkit-implement` or `/webkit-refactor`.

**Confirmation gate.** State both explicitly, *"migrating FROM `<source repo>` (`<source_path>`, <stack>) INTO `<target repo>` (`<target_path>`, <stack>)"*, and **get the user's confirmation before writing anything** in either repo. The write-scope exception makes a wrong target expensive.

**Branch gate (target repo).** After confirmation, run the [Mandatory Branch Gate](../../rules/git-workflow.md#mandatory-branch-gate-for-implementing-skills) **in the target repo**, before creating or editing its first file:

- On `main` / `master`: create and switch to the branch now. `T#####` when the user names a ticket **of the target project** (fetch and analyze it first per [ticket-numbering.md §8](../../rules/ticket-numbering.md#8-resolving-a-ticket-argument-to-its-branch); when several branches match, **stop and ask**); otherwise `feature/<portal-or-domain>-<feature-kebab>` ([git-workflow.md](../../rules/git-workflow.md) Rule 1). Never name it after a source ticket: ticket numbers are per project.
- Already on the branch for this migration: continue there.
- On a branch for different work, or detached HEAD: **stop and ask**.
- Tell the user which uncommitted target changes are carried over; never `git stash`, `reset`, or `clean` them away.

```bash
git -C <target-repo> rev-parse --abbrev-ref HEAD    # where am I in the target?
git -C <target-repo> status --short                 # what am I carrying over?
git -C <target-repo> checkout -b feature/<portal-or-domain>-<feature-kebab>   # or the target ticket, T#####
```

The source repo gets no branch: its only write is the contract. This skill never allocates a ticket ([ticket-numbering.md](../../rules/ticket-numbering.md) §2); it records the one the user names, or "None".

---

## Phase 1 — Load the Source (Read-Only)

1. **Resolve the feature.** Parse `<source_path>` into `<portal-or-domain>` and `<feature>`. Confirm the frontend folder and the backend surface: controllers, `app/Queries/<Domain>/`, `app/Handlers/<Domain>/`, `app/Actions/<Domain>/`.
2. **The spec first.** Ticket folder names carry no feature name, so search their contents, then the legacy portal folders (`.agents/specs/<project>/<portal>/<feature>.md`):

   ```bash
   grep -ril '<feature|route|table>' ".agents/specs/$project" --include='spec.md' --include='specs.md' 2>/dev/null
   ```

   A ticket spec is `.agents/specs/<project>/T#####/spec.md` (`specs.md` on older tickets). Read it in full: it frames the flow, the data contract, and the rules.
3. **Investigation reports.** `.agents/specs/<project>/T#####/investigation.md`, or `.agents/reports/` for pre-ticket ones, for edge cases and gotchas worth carrying over.
4. **Then the code**, end to end: page → state → api layer → route → controller → Query / Handler → model. **Where the spec and the code disagree, the code's runtime behavior wins**; record the drift for the contract's §13.
5. **System Awareness scan, source side** ([system-awareness.md](../../rules/system-awareness.md)): models (`$table`, `$fillable`, `$casts`, relations), their migrations, and the registered routes (`php artisan route:list --path=api`; the URL prefix can differ from the controller namespace, and the source's profile records where). Every contract item is grounded here.
6. **Dependency graph.** Every table, sibling module, shared util, domain rule, scheduled job, and cross-portal or cross-domain touchpoint the feature needs.

> [!CAUTION]
> **`app/Domain/` is retired** in every repo here. Queries, Handlers, and Actions live at `app/Queries/<Domain>/`, `app/Handlers/<Domain>/`, `app/Actions/<Domain>/`. An empty search of `app/Domain/` reads as "nothing exists" and produces a contract missing its backend.

---

## Phase 2 — Discover the Target

**The target's profile**, in this order:

1. The target's own `.agents/rules/project-profile.md`, when it has one: run its Which Project Am I In? section in the target and read only the sections that apply to it.
2. The [Known Target Profile — `hrms_react`](#known-target-profile--hrms_react) below, **only** when the target the user named is `hrms_react`.
3. Otherwise, [Architecture Discovery](#architecture-discovery) against the target.

Then read the target's **closest sibling module**. Where the profile and the code disagree, the sibling wins; record the drift in the contract's §13.

**System Awareness scan, target side.** Scan the target's models, migrations, route files, controllers, Query / Handler classes (if it has them), design-system directory and barrel export, and shared hooks and utils. For every artifact the migrated feature needs, decide **REUSE / EXTEND / CREATE** and record the search behind it (contract §11). If it is genuinely ambiguous whether an existing target structure covers the need, ask. Search targeted directories, not the whole repo; when the budget runs out, the answer is *unknown*, never *nothing exists*.

### Architecture Discovery

For a target with no profile, establish each of these from the target's files before writing code:

| Aspect | Where to look |
| --- | --- |
| Stack | `composer.json`, `package.json`: framework, UI libraries, state library, router |
| Frontend layout | The pages or modules directory, the shared components directory and its barrel, file extensions |
| Path alias | `vite.config.*`, `tsconfig.json` / `jsconfig.json` |
| Routing | How a page is registered: auto-aggregated module routes, or a central router file |
| HTTP client | The instance or wrapper modules import, and whether it already unwraps `response.data` |
| State | Context and hooks, Pinia, Redux, or local state only |
| Backend layout | Controller folders and namespace style; `app/Queries/` / `app/Handlers/` or logic in controllers; FormRequests or inline validation; API Resources or raw JSON |
| Route files | Single `routes/api.php`, per-portal, or per-domain files; the middleware groups |
| Database conventions | Two or three recent migrations: foreign-key style, relationship-column naming, soft-delete style |
| Checks | The `scripts` the target defines (typecheck, build, lint) and its test runner |

### Known Target Profile — `hrms_react`

Reference data, used **only** when the target the user named is `hrms_react` (verified 2024-era sibling). These are the target's conventions: match them, and never import the source's patterns into it. Re-verify against the target on each run; where it has drifted, follow the target's code, note the drift in the contract's §13, and offer to update this table.

| Aspect | `hrms_react` reality |
| --- | --- |
| Frontend framework | **React 18**, `.jsx` function components |
| UI libraries | **MUI (`@mui/material`)**, **PrimeReact**, React-Bootstrap, `@mdi/font` icons |
| Pages location | `resources/views/pages/<portal>/<feature>/` (portals: `admin`, `emp`, `manager`, `hr`, `tk`, `payroll`) |
| Shared components | `resources/views/components/` |
| Routing | **Central** `resources/app/router.jsx` via `createBrowserRouter`; routes registered **manually** (no auto-glob): add the route object there, wrapped in `ProtectedRoute` |
| State | **React Context** (`resources/views/context/ContextProvider.jsx`, `useStateContext`); local state via hooks. No Pinia, no composables |
| HTTP client | **`resources/app/axios.js`**, a single axios instance: import it, never create another |
| Path alias | `@/` → `resources/` (e.g. `@/views/pages/...`, `@/app/axios`) |
| Backend | **Plain Laravel**: controllers in `app/Http/Controllers/<portal>/`, logic mostly **inline in controllers** (no Query / Handler, no Services / Repositories) |
| Routes | **Single `routes/api.php`**, not per-portal files |
| Portal roles | Numbered 1–7 (`admin=1, emp=2, manager=3, hr=4, tk=5, payroll=6`). A source portal named `employee` maps to `emp`, `timekeeping` to `tk` |

---

## Phase 3 — Extract the Portable Contract

Describe the feature in **stack-neutral** terms: behavior and data, never Vue, React, or Laravel syntax. Capture, in order (these are the contract's §1–§9):

1. **Purpose and ownership.** One paragraph, plus the owning portal or domain. Access-separation rules carry over verbatim (e.g. portal separation in [hrms-rules.md](../../rules/hrms-rules.md) §4, where the source follows it).
2. **Flow and state machine.** The numbered steps a user or record moves through. Where there is a lifecycle (e.g. `Filed → Approved → For Clearance → Cleared → Endorsed → Completed`), every status verbatim and **what triggers each transition**: a user action (which role), a scheduled job, or another portal. This is the single most important thing to preserve.
3. **Data contract.** One table per entity: the real field name (from `$fillable` or the migration), type, unit or format, nullability, and source or derivation. Enum and status values verbatim; persisted columns separate from computed fields.
4. **API contract.** One row per endpoint: method, the real URL path, params or body, the success JSON, the error shape and status, and the guard. The target reproduces these exactly, even though its backend is built differently.
5. **Business rules and calculations.** Every formula, rate, threshold, and rounding rule, with its domain source (e.g. grace period, overtime and night-differential rates, the 261 / 313 daily-rate factor, statutory deduction order in [hrms-rules.md](../../rules/hrms-rules.md)). Flag the compliance-sensitive ones.
6. **Validation and authorization.** Required fields, constraints, messages, role and portal guards with their rejection responses, and which writes are transactional.
7. **UI behavior, not implementation.** Pages and their responsibilities; filters and debounce, pagination mode (client or server), sort, search; loading, empty, and error states; the status → badge map; modals and drill-downs; money, date, and number formatting semantics.
8. **Edge cases.** From the spec, the investigation reports, and the guards in the code.
9. **Dependencies and preconditions.** Tables, modules, scheduled jobs, and shared utils the target must also provide.

Every item cites a source `file:line` or a spec section. Drift that changes a number, a status, or an endpoint is raised with the user before Phase 6, not decided silently.

---

## Phase 4 — Translation Map (Source Pattern → Target Pattern)

From the source's and the target's profiles, decide how each source layer becomes a target layer. Keep only the layers this feature uses; they become the contract's §10.

### Frontend: Vue 3 `<script setup>` → React

Use this table when the source is Vue and the target is React. For any other stack pair, build the same table from both profiles before writing code.

| Source (Vue) | Target (React) | Must survive |
| --- | --- | --- |
| `composables/use<Feature>.ts` (`ref` / `reactive` / `computed`) | A `use<Feature>()` hook (`useState` / `useReducer` / `useMemo`) in the feature folder | State and actions map 1:1; a state machine is often clearest as `useReducer`. |
| `api/<feature>.api.ts` importing the source's HTTP client | The target's api layer, importing **the HTTP client the target's profile names** | The same endpoint strings, params, and response handling. Never create a new axios instance. One client unwraps `response.data` already: a second `.data` gives `undefined`, not an error. |
| Pinia `store/` | A React Context provider, or lifted state, only when shared across pages | The same sharing scope as the source. |
| Auto-aggregated `route/<feature>.routes.ts` | The target's page registration: its module route file, or a manual entry in its central router | The same path, guard, and lazy loading. |
| Source design-system components | Target design-system components, mapped by behavior (below) | Behavior, never names. |
| Tailwind classes, portal accent, `dark:` pairs | The target's styling system (its Tailwind tokens, MUI `sx` / theme, or Bootstrap classes) | UI behavior is the contract; the exact styling is the target's. |
| `debounce` (300 ms), `onUnmounted` cleanup | The target's debounce util, the `useEffect` cleanup return | The same interval; every timer, listener, and subscription cleaned up ([performance.md](../../rules/performance.md)). |
| `formatCurrency` / `dateFormatter` | The target's formatting utils, created only when the target scan finds none | The same rounding, currency, and date-format semantics. |

### Backend: architecture mapping

| Source | Target | Must survive |
| --- | --- | --- |
| Thin controller → `Get<X>Query::execute()` in `app/Queries/<Domain>/` | The target's read layer: a Query class where the target has `app/Queries/`, otherwise the controller method (or a private method), as its sibling controllers do | The same computation and output shape. |
| `Save<X>Handler::execute()` in `app/Handlers/<Domain>/`, inside `DB::transaction` | The target's write layer, still inside `DB::transaction` | Transactionality is a data-integrity requirement, not a source detail. |
| Source Eloquent model | The target's model for the entity: reused when the target scan found one, otherwise created in the target's model style | The fields of contract §3. |
| Source migration | A target migration **only** when the target scan found no table, in the target's database conventions (foreign-key style, relationship-column naming, soft delete) | Columns, types, and nullability of §3. Never a parallel table. |
| Raw JSON via `response()->json(...)` | Whatever the target's sibling controllers return, shaped to §4 | The same keys, types, and status codes, error responses included. |
| Route in the source's group file | The route file the target's profile names (single `routes/api.php`, per-portal, or per-domain), under the matching middleware group | The same URL path, method, and guard. |
| Scheduled command (`Schedule::command()`) | The target's scheduler registration | Time-based transitions (e.g. effective-date flips) still fire. |

Record the gotchas on both sides: a source controller namespace that differs from its URL prefix (extract the URL from `route:list`, never from the namespace), and portal, domain, or folder names that differ between the projects.

### Design-system mapping: by behavior, never by name

1. Inventory the components the source feature actually uses, imported **and** globally registered (the source's profile lists the global ones; they appear in templates without an import).
2. Write down the behavior each one provides: searchable select, server pagination, status chip, modal with a focus trap.
3. Find the target component that provides that behavior: list the target's design-system directory and read its barrel export, searching by behavior and generic names (`StatusBadge` → `Badge` → `Chip`; `CSelect` → `Select` → `Dropdown`; `Pagination` → `TablePagination`).
4. No equivalent: compose it from the target's primitives. A raw `<select>`, `<table>`, or hand-rolled modal is a reuse failure whenever the target ships that primitive.

**Never search the target for a source component name.** It returns nothing, which reads as "nothing exists" and produces a duplicate.

---

## Phase 5 — Write the Contract

Fill the template [.agents/template/migration-contract.md](../../template/migration-contract.md). Follow its exact structure: no custom format, no added, removed, renamed, or reordered sections. Follow the fill rules in its header comment, then delete every guide comment except the `<!-- Run history -->` marker. §12 Parity Checklist starts as **NOT CHECKED YET**; Phase 7 fills it. §14 Source Reference lists the source files read in the Phase 1 code walk.

### Persist the contract (MANDATORY)

- Write to `.agents/migrations/<portal-or-domain>-<feature>-<YYYYMMDD>.md` **in the source repo** (the repo you are in), creating the folder if needed. `<portal-or-domain>` and `<feature>` are kebab-case from the source path; the date is today's date from context, never guessed.
- Never write it into `.agents/specs/`: a ticket folder holds only the fixed filenames of [ticket-numbering.md](../../rules/ticket-numbering.md) §5, and a migration contract is not one of them.
- Re-running for the same feature **updates the existing contract in place** (`ls .agents/migrations/<portal-or-domain>-<feature>-*.md`) and keeps its filename. Before overwriting, append the previous run's **Contract Run** value with its date and parity result (e.g. `- v1 — 2026-10-08 — initial — PARITY WITH GAPS`) to the list under `<!-- Run history -->`. Then increment the Metadata **Contract Run** row, set **Contract Date** to today, and write one line on what changed.

---

## Phase 6 — Implement into the Target

Build the feature in the target from the contract, matching the target's profile and its closest sibling module.

**Backend first.**

- **Data.** Reuse the target model and table when the target scan found them. Otherwise scaffold a migration and a model in the target's database conventions (foreign-key style, relationship-column naming, soft delete, indexes, timestamps). **Never run migrations**: list them for the user to run in the target. (Feature and schema tests migrate a **disposable** `*_test` database only, per [testing.md](../../rules/testing.md#backend-phpunit); that is not running the migrations.)
- **Logic.** The target's read and write layers per §10, writes inside `DB::transaction`, returning JSON that matches §4 exactly: keys, types, status codes, and error shapes.
- **Validation and authorization** from §6, enforced on the server, with the same rejection status and body.
- **Routes** in the target's route file and middleware group, with the URL path, method, and guard from §4; confirm with `php artisan route:list --path=api` in the target.
- **Scheduled jobs** from §9 in the target's scheduler.

**Then frontend integration**, once the backend is ready.

- The feature folder at `<target_path>`, laid out like the target's closest sibling module.
- An api layer that imports the target's HTTP client and calls the §4 endpoints verbatim.
- A state hook or composable that holds the §2 flow and transitions.
- The page registered the way the target registers pages, behind its guard.
- The §7 behavior through the §10 design-system mapping: filters and debounce, pagination mode, sort, loading / empty / error states, the status → badge map, modals. Preserve the behavior, not the source markup.

**While building:**

- Every new target file has its row in contract §11 (Searched, Found, Decision) before it is created. A `CREATE` with no recorded search is a violation.
- In existing target files, the smallest diff: preserve comments, imports, unrelated methods, and formatting ([incremental-generation.md](../../rules/incremental-generation.md)).
- Field names, endpoint paths, status values, formulas, and transitions equal the contract. The look, the library, and the layout are the target's.
- **Every backend and frontend piece built in the target ships with its test**, per [testing.md](../../rules/testing.md#every-code-change-ships-with-a-test-mandatory), in the target's own test layout: unit tests for the §5 formulas (same inputs, same rounding as the source), feature tests for the §4 endpoints and §6 rejections, a schema test for each scaffolded migration, component tests for the §7 states. A target frontend with no runner gets one set up first, per testing.md. These tests are the parity proof Phase 7 runs.

---

## Phase 7 — Verify Parity

1. **Tests and static checks in the target.** Run every test added in Phase 6 (feature tests on a disposable database per [testing.md](../../rules/testing.md#backend-phpunit)); `php -l` on every new or edited PHP file; the target's typecheck or lint scripts where it defines them, and `node .agents/scripts/check-changed.mjs` from the target's root instead of its full build ([testing.md](../../rules/testing.md#frontend-build-check-changed-files-only)). Fix what the migration introduced; note checks that were already failing. A test that could not run makes its contract item unchecked in §12.
2. **Contract parity.** Walk §2–§8 against the target: every field traces to §3; every endpoint returns the §4 JSON and status, errors included; every status value and transition matches §2; every formula matches §5 with the same rounding; every validation message and rejection matches §6; every UI state of §7 and edge case of §8 exists. Execute where you can (`route:list`, a read-only `tinker` call, a request against local data); otherwise trace the code path and say so.
3. **Round trip.** Given only the contract, would the target behave identically to the source? Anything implicit is made explicit, in the code and in the contract.
4. **Fill §12** in the same contract run: one row per checked item, then **PARITY CONFIRMED** (every row equal) or **PARITY WITH GAPS** (each differing or unchecked row named).

---

## Restrictions

Do **not**:

- edit the source feature, or any application file in the source repo,
- pick, guess, or default a target the user did not name,
- write anything before the FROM / INTO confirmation, or in the target before its branch gate,
- carry the source's conventions into the target,
- create a model, table, route, or component the target already has,
- invent a field, endpoint, status, or rule the source does not have,
- fix source defects, add behavior, or expand scope,
- write under `app/Domain/` in either repo,
- run migrations, stage, or commit in either repo.

---

## Output — Migration Summary

End by printing the summary in chat, filled from the template [.agents/template/migration-summary.md](../../template/migration-summary.md). Follow its exact structure (Metadata, Implemented in the Target, Reused Target Components, New Files, Updated Files, Parity, Notes, Completion Status) and delete its guide comments. It is not saved as a file; the contract is the saved record.

**MIGRATION COMPLETED** requires PARITY CONFIRMED; otherwise **PARTIALLY COMPLETED**, naming each contract item not migrated or not at parity, and why. Migrations still waiting for the user to run them go in Notes; they do not make the migration partial.

Do not stage or commit in either repo: they are separate git repos, so branches and commits are per project. Suggest a Conventional Commit message for the target per [git-workflow.md](../../rules/git-workflow.md) (e.g. `feat(payroll): migrate payslip view`).

---

## Anti-Patterns

| Anti-pattern | Why it fails |
| --- | --- |
| Porting files line by line | Imports the source's architecture into a target built differently; the result fits neither. |
| Picking the target when `<target_path>` is missing | The write-scope exception puts files in a repo nobody asked to change. |
| Applying the source's conventions inside the target | Database rules, HTTP client, and routing differ between the projects; idiomatic-looking code is wrong. |
| Assuming a source table exists in the target | Separate databases. Skipping the target scan produces a parallel table, or code against a table that is not there. |
| Searching the target for a source component name | Returns nothing and produces a duplicate. Map by behavior. |
| Writing the contract from the spec alone | Users depend on the code's runtime behavior; spec drift becomes a silent behavior change. |
| "Fixing" a source defect during the migration | A behavior change hidden in a migration skips review. Record it in §13. |
| Dropping `DB::transaction` because the target looks simpler | Transactionality is an integrity requirement, not a source detail. |
| Claiming parity without checking each contract item | The parity checklist is the only proof the flow survived. |
| Running migrations or committing in the target | The user's call, in the user's repo. |

---

## Follow-up Commands

Always include the saved contract path:

- Review the migrated code: `/webkit-code-review`, run from the target repo on the target branch.
- Review the visual layer: `/webkit-design-review <target_path>`, run from the target repo.
- Check against a spec, when the target has a ticket and spec for the feature: `/webkit-verify <ticket>` in the target repo. The contract is not a spec.
- A parity gap or source defect recorded in §13: `/webkit-investigate <issue>` in the repo that has it.
- After closing gaps: `/webkit-migrate <source_path> <target_path>` again (the contract's run history records what changed).
