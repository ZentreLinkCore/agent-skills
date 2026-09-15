---
name: webkit-backend-implement
description: >
  Builds the Laravel backend — migrations, models, Query/Handler/Action classes, controllers, routes —
  then swaps the frontend's hard-coded api methods for live calls (Gate 2 of the design-first flow,
  after the user validates the Gate 1 design). SPEC-DRIVEN. Scans existing models, migrations, and routes
  first and never creates a duplicate table, model, or endpoint.
  Triggered by `/webkit.backend-implement <ticket>`, `/webkit.backend-implement <target_path> <prompt>`, or `/webkit.backend-implement <prompt>`.
---

# Webkit Backend Implement

This skill coordinates the backend implementation of a standard Laravel module, setting up controllers, database tables, validations, logic classes, and route entries matching the existing project's architecture, conventions, and patterns.

---

## Overview

When the user requests to implement or scaffold the backend structure of a module (e.g., using `/webkit.backend-implement <target_path> <prompt>` or `/webkit.backend-implement <prompt>`), the agent must:
1. Check if a folder or file path was dragged/passed into the command.
2. If a path is provided, parse it to extract the `<portal_name>` (e.g., `hr`, `employee`, `manager`, `admin`, `payroll`, `timekeeping`) and `<module_name>`.
3. If no path is provided, dynamically resolve the portal and module names from the prompt text or context.
4. **Load the Spec (PRIMARY SOURCE OF TRUTH — check first)**: Resolve the project first, then look for a spec matching the target module/feature inside it — **ticket folders first** (`.agents/specs/<project>/T#####/specs.md`), then the legacy portal folders (`.agents/specs/<project>/<portal>/<feature>.md`). One command covers both: `grep -ril '<module|route|table>' .agents/specs/<project> --include='*.md'`. If you are already on a `T#####` branch, that names the ticket outright. Ticket folder names carry no feature name, so grep their contents rather than their names; the spec's `> **Ticket:**` / `> **Portal:**` header confirms the match ([ticket-numbering.md](../../rules/ticket-numbering.md)). If one exists, **read it in full and build to it** — the tables/columns, Query & Handler classes, controller methods, routes, gating rules, and API contract all come from the spec's backend design. The spec supersedes ad-hoc schema guesses; where the spec and a rule in [.agents/rules/](../../rules/) genuinely conflict, follow the rule and note the conflict. If **no** spec exists, proceed from the prompt/report as before.

   **Three spec sections bind this skill specifically** — and the backend owns most of what they demand:
   - **Non-Functional & Failure-Mode Checklist** — this is a build list, not background reading. **Authorization** (who is rejected, and with what status), **concurrency / double-submit** guards, **idempotency on retry**, **error response shape and status codes**, and **input validation boundaries** are all backend obligations. A feature that satisfies only the happy-path contract has not implemented its spec. An `N/A because ...` entry still needs a glance: confirm the stated reason actually holds in the code you are writing.
   - **Acceptance Criteria** (`AC-n` Given/When/Then rows) — the exact status codes, error messages, and computed values your endpoints must return. Build to the literal rows; they are what `/webkit.verify` will check you against, so a paraphrase is a failure you could have avoided.
   - **Definition of Done** — the completion gate. Do not report this gate finished while a DoD box remains unticked without explanation.
5. **Load Investigation Report (if referenced)**: If the prompt names or links a report, read it directly. Otherwise check the ticket folder you just resolved for an `investigation.md` (and `verify.md` / `code-review.md` from earlier passes); `.agents/reports/` holds the pre-ticket archive. Use its scope/dependency analysis to inform the implementation plan — don't assume this skill has access to an earlier `webkit.investigate` conversation.
6. **Confirm the design was validated (Gate 2 precondition)**: This skill is the second gate of the design-first flow. Confirm the hard-coded frontend design exists (from `/webkit.frontend-implement`) and the user has reviewed it. If the frontend design doesn't exist yet, backend/API-first is still valid — but prefer building the design first so the schema is validated against a reviewed UI.
7. **Mandatory Architecture Discovery**: Before generating any backend code or migrations, perform the Architecture Discovery step to identify the project's Laravel design pattern.
8. **Mandatory System Awareness**: Before writing any controller, query, migration, or model, run the scan defined in [System Awareness](../../rules/system-awareness.md) to identify what already exists. The backend implementation MUST reuse existing models and tables. Never create a new migration or model when an existing one already satisfies the data requirement.
9. **Match the Hard-Coded Frontend Contract**: Read the frontend's `api/<feature>.api.ts` (and `types/`) produced in Gate 1. The live endpoints you build MUST return the **same shape** the hard-coded methods returned, so replacing them is a drop-in swap. Any field the design relied on must be produced by the backend (or the mismatch flagged).
10. If and only if no existing model/table covers the requirement (confirmed in Step 8, per the spec), create the Laravel migration and Eloquent model.
11. Scaffold and optimize the queries, controller logic, validations, and routes matching the detected architecture and the spec.
12. **Add the dynamic data (the core job of this gate)**: Update the frontend `api/<feature>.api.ts` — replace each hard-coded / `TODO(backend)` method with a live `http.get/post("api/<url-prefix>/...")` call. Preserve the composable, page, and component logic untouched. If the frontend layer doesn't exist yet, skip this and note `/webkit.frontend-implement` as the follow-up.
13. **Strict Rules Adherence**: The generated code and files must strictly adhere to the guidelines defined in the [.agents/rules/](../../rules/) directory, specifically [Laravel Standards](../../rules/laravel-standards.md), [Naming Convention Standards](../../rules/naming-convention.md), and [HRMS Domain Rules](../../rules/hrms-rules.md).

---

## Spec-Driven & Gate 2 of Design-First

This skill is the **second gate** of the design-first flow. The first gate (`/webkit.frontend-implement`) built the UI with hard-coded data and the user validated the design against the spec. This gate turns that validated design into a working, data-backed feature.

```
Spec (.agents/specs/…)  ──►  GATE 1: /webkit.frontend-implement   ──►  user validates design  ──►  GATE 2: /webkit.backend-implement  ← YOU ARE HERE
                              hard-coded UI                             (add / adjust / OK)          build tables/queries/handlers/routes
                                                                                                     + swap hard-coded api → live calls
```

- **The spec is the blueprint.** Build exactly the tables, columns, Query/Handler classes, controller methods, routes, gating rules, and API response shapes the spec defines. Don't re-derive the schema.
- **The hard-coded frontend contract is the acceptance test.** The live endpoints must return the same shape the Gate-1 `api/<feature>.api.ts` methods returned, so the swap is drop-in. Read that file before designing responses.
- **"Add dynamic data" is the deliverable.** The visible outcome of this gate is: the same validated page, now driven by real DB data instead of hard-coded values.

---

## Phase 0 — Project Gate (BLOCKING)

> [!CAUTION]
> **Resolve which project you are in before you read anything else in this skill.** This workspace holds two Laravel projects whose **database conventions are direct opposites**. Carrying one project's rule into the other produces migrations that look conventional and are wrong — and schema mistakes are the most expensive kind to undo.

Run the **[Which Project Am I In?](../../rules/project-profile.md)** resolution at the top of the profile (read `composer.json` / `package.json` and the secondary tells), then read **only** that project's sections:

| Resolved | Read | Ignore completely |
| :--- | :--- | :--- |
| **SubHRMS** — `vue`, `pinia`; `app/Models/Employee.php` | the `SubHRMS —` sections | the ScaleUP Profile |
| **ScaleUP** — `react`, `react-dom`; `app/Models/Organization.php`, `.agents/blueprint/scaleup/` | the **ScaleUP Profile** section | every `SubHRMS —` section |

**State the resolved project in your first message**, before generating anything.

The differences that will bite hardest, per the profile:

| | SubHRMS | ScaleUP |
| :--- | :--- | :--- |
| Foreign keys | **No DB-level FKs** — index the column instead | **Real FKs** — `foreignId()->constrained()` |
| Relationship columns | `id`-prefixed (`idacct`, `idpayperiod`) | `<parent>_id` (`organization_id`) |
| Soft delete | a `status` column on most tables | `deleted_at` / `softDeletes()` |
| Route grouping | per-**portal** files, `tk` namespace vs `timekeeping` URL prefix | per-**domain** files; **no portals** |
| Controller namespace | `app/Http/Controllers/<portal>/` | `app/Http/Controllers/<Domain>/` (PascalCase) |
| Auth | Sanctum bearer tokens | Sanctum **stateful SPA session** (cookies) |

> [!IMPORTANT]
> **Where this skill and the profile disagree, the profile wins** — it is maintained; this skill's examples are illustrations of *shape*. Any path or convention below that contradicts your project's profile section is stale, and following it will send you looking for classes that do not exist, which reads as "nothing to reuse" and ends in a duplicate.

---

## Phase 0.5 — Branch Gate (BLOCKING)

> [!CAUTION]
> **Do not create or edit a single application file until this is done.** Run the [Mandatory Branch Gate](../../rules/git-workflow.md#mandatory-branch-gate-for-implementing-skills) — read the current branch, and if it is `main`/`master`, **create and switch to the ticket's branch now**. Creating it is compliance with Rule 3, not a decision that needs approval.
>
> **Invoked with a ticket** (`/<skill> F0135`, `/<skill> T00004`)? That ticket names a branch on the remote. **Fetch and analyze it first** — [ticket-numbering.md §8](../../rules/ticket-numbering.md#8-resolving-a-ticket-argument-to-its-branch) — then check it out here rather than deriving a new branch name. Several branches can match one ticket (`F0135`, `F0135-fixed`, `f0135` all exist); when more than one does, **stop and ask**.
>
> This is not "confirm a branch exists". Confirming has repeatedly failed: the agent checks, sees `main`, notes it, and implements anyway. **Create the branch.**

**The branch is the ticket number** — bare `T00001`, matching the spec folder you just loaded (`.agents/specs/<project>/T00001/`) character for character. No prefix, no slug: that exact match is what lets `/webkit.verify` and `/webkit.code-review` find the right spec later from the branch alone.

```bash
git rev-parse --abbrev-ref HEAD          # where am I?
git status --short                       # what am I carrying over?
git checkout -b T00001                   # the ticket from the spec you loaded
```

Working from a spec with **no ticket** (a legacy portal-folder spec) or no spec at all? Fall back to the categorised form — `feature/<domain>-<feature-kebab>` ([git-workflow.md](../../rules/git-workflow.md) Rule 1) — and say which you used and why.

**Already on the ticket's branch?** Continue there — do not open a second one. One ticket, one branch: this gate and the other gate share it. On a branch for *different* work, or detached HEAD? **Stop and ask.** Then state the branch you are on before writing anything.

Committing remains the user's call. This gate only guarantees the work is isolated and revertible.

---

## Execution Strategy (Performance Optimized)

The agent MUST minimize workspace scanning and token consumption.

- **Targeted Scanning**: Search only relevant backend files in the current module's namespace and directories.
- **Early Exit**: Stop searching immediately once a suitable implementation is found. If a reusable component/class clearly covers the core requirement, reuse it immediately rather than continuing to search for something closer, unless the user explicitly requests a new/separate implementation.
- **No Global Scans**: Never perform repository-wide or project-wide analysis unless explicitly requested.
- **Inspect Module-Related Files Only**: Limit file inspection strictly to files that are directly related to the requested module or related domain schemas.

---

## Existing Module Discovery

Before generating any backend code:
- Search for the most similar existing backend module.
- Mirror:
  - Controller structure
  - Service/Repository/Domain pattern
  - Validation approach
  - API response format
  - Route organization
  - Query style
  - Business logic placement
  - Model relationships
- Use the existing module as the implementation template.
- Only deviate when explicitly instructed by the user.

---

## System Awareness Phase (MANDATORY — Run Before Any Code Generation)

Before creating any controller, query class, handler, migration, or model, run the full scan defined in [System Awareness](../../rules/system-awareness.md) (models → migrations → routes → controllers/domain classes). Never create a new database table or Eloquent model if an existing one already covers the feature's data needs — creating redundant tables is a critical error.

For this skill specifically:
- **If a controller or domain class already exists** for the module: add methods to it. Do NOT create a new parallel controller.
- **If a matching route exists**: extend or wire the existing controller method. Do NOT register a duplicate route.

> [!CAUTION]
> If you are about to generate a `Schema::create('...')` migration for a table that already exists or is covered by an existing model — **STOP**. Re-scan `app/Models/` and `database/migrations/`. If still uncertain, ask the user to confirm before proceeding.

---

## Context Loading Strategy

Only load context that is required.

### Search Priority
1. Current module (controllers, queries, handlers)
2. Related model (e.g., `app/Models/<ModelName>.php`)
3. Related domain classes (`app/Queries/<Domain>/`, `app/Handlers/<Domain>/`, `app/Actions/<Domain>/` — **not** `app/Domain/`, which is retired)
4. Controller
5. Routes (`routes/api.php` orchestrator + the per-portal files in `routes/api/`)
6. Request classes (FormRequests)
7. API Resources
8. Policies & Gates
9. Existing frontend API layer (to match field shapes)
10. Entire backend (ONLY if explicitly requested by the user)

- **Token Protection**: Never load more than 2 full files simultaneously unless performing a merge or refactor operation. Prefer targeted snippets over full-file context whenever possible.
- **Scope Restriction**: Never inspect unrelated modules or inspect frontend UI files beyond the request layer.

---

## Workspace Inspection Budget

To reduce unnecessary token usage, limit the number of files scanned in a single turn.

### Maximum Files to Inspect:
- **Controllers**: 10 files
- **Models**: 10 files
- **Domain Queries / Service classes**: 15 files
- **Domain Handlers / Action classes**: 15 files
- **Routes**: 3 files
- **Request Classes (FormRequests)**: 5 files
- **API Resources**: 5 files
- **Policies**: 5 files
- **Migrations**: 5 files

If the budget is exceeded:
1. Stop scanning.
2. Use the best matching implementation already discovered.

---

## Duplicate Prevention & Incremental Generation

### Duplicate Prevention
Before creating any controller, model, request, resource, helper, action, query, policy, service, or migration, check if it already exists.
- Reuse or extend existing classes instead of duplicating logic. Never create parallel duplicates.

### The Reuse Ledger (MANDATORY)

"Check if it already exists" has always been the rule, and parallel classes still get created. The reason is structural: **reuse is merely asserted, while creating a class requires no evidence.** Nothing records what was searched — so a search that found nothing looks exactly like a search that never ran, and a search pointed at a directory that doesn't exist (`app/Domain/`) looks like proof that nothing exists.

Invert the burden, the way `/webkit.verify` does for spec claims: **a new class is a claim that nothing reusable exists, and that claim needs evidence.**

Before creating **any** controller, Query, Handler, Action, model, migration, or FormRequest, record one row:

| Artifact | Searched | Found | Decision |
|---|---|---|---|
| `<class you are about to create>` | `<the actual path/grep you ran — and it must be a path that exists>` | `<file, or NONE>` | `REUSE` / `EXTEND` / `CREATE — <why nothing fit>` |

- **`CREATE` with no recorded search is a violation.** If there is no row, the class should not exist.
- **The searched path must be real.** A row reading *"searched `app/Domain/Queries/` — NONE"* establishes nothing except that you searched a retired directory. Verify the path exists before treating an empty result as absence.
- **Search by domain, not by feature name.** `GetPayrollListQuery` will not match an existing `GetPayrollQuery`. List the domain folder and read the class names in it.
- **A new migration is the highest-stakes `CREATE` in this skill.** A duplicate table is far more expensive than a duplicate class — the ledger row for a migration must name the models and tables you checked.
- **Report the ledger at hand-off**, so a wrong `CREATE` is caught while it is still one file.

### Incremental Generation
If a file already exists:
- Update only the required sections (e.g. adding a method, field validation, or route binding).
- **Preserve**: Developer comments, business logic, formatting, existing imports, existing methods, and custom configurations.
- Generate the smallest possible diff. Never overwrite working files.

---

## Architecture & Convention Detection

### Laravel Architecture — Read It, Don't Recall It
The backend architecture is documented in [Project Profile](../../rules/project-profile.md). **Read your project's sections and follow them — do not re-detect, and do not introduce a different pattern.** What holds for **both** projects:
- **Thin controllers + Query/Handler** with static `execute()` — reads in `app/Queries/<Domain>/` (`App\Queries\<Domain>`), writes in `app/Handlers/<Domain>/` (`App\Handlers\<Domain>`), and `app/Actions/<Domain>/` where the domain already uses Actions. `<Domain>` is a **PascalCase domain folder**, never a lowercase portal.
- **NO API Resources** — return `response()->json(...)` directly inside `try/catch`. Never scaffold a `JsonResource`.
- **Validation** is mostly inline (`$request->all()`); FormRequests are rare and flat in `app/Http/Requests/`.

> [!CAUTION]
> **`app/Domain/` is retired.** These classes live at the **top level of `app/`**. Do not write anything under `app/Domain/`, and do not reference `App\Domain\...` — a few legacy files still carry that stale namespace mid-migration; the target is `App\Queries` / `App\Handlers` / `App\Actions`. This matters for reuse as much as for placement: **searching `app/Domain/` for an existing Query returns nothing because the directory isn't there**, which reads as "none exists" and produces a duplicate class in a dead namespace. Search `app/Queries/` and `app/Handlers/`.

**Route grouping is project-specific** — SubHRMS groups by portal prefix (mind `tk` namespace vs `timekeeping` URL prefix); ScaleUP groups by domain and has no portals. Read your project's routes section before adding one.

### Naming Convention Detection
Follow existing backend casing and class suffixes: `<ModuleName>Controller.php`, `Get<X>Query.php`, `Save<X>Handler.php`, and (only where already used) `Store<ModelName>Request.php`. Do NOT invent `*Resource.php` classes — they don't exist in this project.

---

## Path Parsing Rules (Dragged Folder / File Support)

If a path parameter is passed in the command (e.g. `/webkit.backend-implement @[/Users/.../web/src/module/hr/employees] <prompt>`):
- **Extract Portal Name**: Identify the folder segment immediately following `resources/views/web/src/module/` (e.g., `hr`, `admin`, `employee`, `manager`, `payroll`, `timekeeping`).
- **Extract Module Name**: Identify the next folder segment (e.g., `employees`, `sick_leave_monitoring`).
- **Sub-folder resolution**: If the path points to a component, page, or script inside a module (e.g., `.../module/hr/employees/components`), traverse upwards to resolve the module directory name (`employees`) and the portal name (`hr`).

---

## Target Backend Directory Structure & Setup

The backend logic for the module is structured inside the Laravel framework.

```
database/migrations/           # Database migrations
app/Models/                    # Eloquent models
└── <ModelName>.php            # The Eloquent model representation
app/Http/Controllers/
└── <namespace>/               # SubHRMS: lowercase portal (hr, payroll, tk, employee, manager, admin — tk = timekeeping)
    └── <ModuleName>Controller.php # ScaleUP: PascalCase domain (Auth, Community, Dashboard, Onboarding, Organization)
app/Http/Requests/             # FormRequests are FLAT here (no subfolder) and RARE
└── Store<ModuleName>Request.php  #   only add if the target controller already uses one
app/Queries/<Domain>/          # Read logic:  Get<X>Query.php   (extends Query, static execute)
app/Handlers/<Domain>/         # Write logic: Save<X>Handler.php (extends Handler, static execute, DB::transaction)
app/Actions/<Domain>/          # Where the domain already uses Actions — mirror the Handler's domain folder
routes/
├── api.php                    # Orchestrator: public routes, auth group, per-file group() loaders
└── api/
    └── <group>.php            # SubHRMS: one file per portal (employee|manager|hr|timekeeping|payroll|admin)
                               # ScaleUP: one file per domain (auth|community|dashboard|onboarding|organizations)
                               #   each holds its own routes + its own controller `use` imports
```

> `<Domain>` is a **PascalCase domain folder** (`Payroll`, `Timesheet`, `Leave`, `Organization`, `Community`, …) — never a lowercase portal name. **There is no `app/Domain/` directory**; do not create one. Match the folder the sibling classes for your feature already use.

> There are **no** `app/Http/Resources/` API Resource classes in this project — do not create that directory. See [Project Profile](../../rules/project-profile.md).

---

## Backend Implementation Guidelines

### 1. Database Safety & Optimization
- **Reuse Before Create**: Always complete the System Awareness Phase (Steps 1–2) before deciding to create a new migration. If an existing table covers the requirement, use it directly.
- **Do NOT Run Migrations Automatically**: Generate migration files and Eloquent models only when a new table is confirmed necessary. Explain that migrations must only be run upon explicit user request.
- **No Duplicate Tables**: Never create a migration for a table name that already exists. Search `database/migrations/` for any prior `Schema::create('<table_name>')` definition before generating a new one.
- **Optimization Standard**: Add `->index()` on relationship columns and frequently filtered columns, plus timestamps. Avoid duplicate schema definitions.
- **Foreign keys and soft deletes are OPPOSITE between the two projects.** Getting this backwards produces a migration that looks idiomatic and violates the schema conventions of the project it lands in. Confirm against your project's profile section before writing a column:

| | SubHRMS | ScaleUP |
| :--- | :--- | :--- |
| FK constraints | **Never** `->foreign()->references()` — the project has **zero** DB-level FKs. Index the column and enforce integrity in the Query/Handler layer. Adding one has repeatedly broken migrations here (an FK to a non-existent `account` table when the real one is `accounts`) | **Yes** — real foreign keys, `foreignId()->constrained()` |
| Relationship column | `id`-prefixed: `idacct`, `idpayperiod`, `idtranstype`, `idclass` | `<parent>_id`: `organization_id` |
| Soft delete | a `status` column — match sibling tables, **not** Laravel `SoftDeletes` | `softDeletes()` / `deleted_at` |

### 2. Validation Standards
- This project validates **inline** by default (`Request $request` → `$request->all()`). FormRequests are rare and flat in `app/Http/Requests/`. Only create/extend a FormRequest if the target controller already uses one — otherwise validate inline to match siblings.

### 3. API Response & Exception Formatting
- Return `response()->json($data)` (or `['data' => $data]`) on success and `response()->json(['message' => $e->getMessage()], 400)` on error, inside `try/catch (Exception $e)`. **Do NOT create or use API Resources** — there are none in this project. See [Project Profile](../../rules/project-profile.md).

### 4. Route Grouping
- Inspect existing API routes grouping. Detect prefix rules, version groupings, middleware namespaces, and naming styles.
- Insert new routes in the correct groups. Do not create duplicate routes.

### 5. Performance Standards
- Eager load relationships (`with()`) on queries.
- Select only required columns.
- Eagerly apply pagination for listings.
- Chunk large datasets (`chunk()`, `lazy()`) for batch operations.

---

## Code Shapes

**The full worked examples live in [Project Profile](../../rules/project-profile.md)** — Query, Handler, Action, controller, and route, in this codebase's exact style. Read them there and **open the closest sibling class for your feature before writing**, since arg shapes and response wrappers vary per module. Templates copied into this file drift; the profile is maintained.

The shape in one line each:

| Layer | Location | Shape |
| :--- | :--- | :--- |
| **Query** (reads) | `app/Queries/<Domain>/Get<X>Query.php` | `extends Query`, `public static function execute($params = [])`, eager-load relations, paginate |
| **Handler** (writes) | `app/Handlers/<Domain>/Save<X>Handler.php` | `extends Handler`, static `execute()`, wrapped in `DB::transaction` |
| **Action** (optional) | `app/Actions/<Domain>/` | Static `execute()`. Only when a Handler's logic grows large or a step is reused — do not pre-split small handlers |
| **Controller** | `app/Http/Controllers/<namespace>/` | Thin: call the Query/Handler, `try/catch (Exception $e)`, `response()->json(...)`. **Never** a `JsonResource` |
| **Route** | `routes/api/<group>.php` | Add inside the existing group + its `use` import in that same file. `apiResource` for standard CRUD, explicit routes for domain actions |

`<Domain>` is a **PascalCase domain folder**, never a lowercase portal. `<namespace>` is project-specific (SubHRMS: lowercase portal; ScaleUP: PascalCase domain). Never add routes to `routes/api.php` for an existing group — it only holds the loaders.

---

## Decision Playbook

Work top-to-bottom; stop at the first branch that applies.

1. **Does a Model + table already cover this entity?** (System Awareness scan)
   - Yes → reuse it. Skip migration/model creation entirely.
   - No → scaffold migration + model (indexes on relationship + filtered columns, timestamps, and the **soft-delete and FK style your project uses** — they are opposite between the two, see §1). Do NOT run the migration — tell the user to.
2. **Does a route for this resource already exist in its group file (`routes/api/<group>.php`)?**
   - Yes → add a method to the existing controller; wire it to a new/existing Query or Handler. Do NOT add a duplicate route.
   - No → add the route inside the correct group file (+ its `use` import there). Never a new top-level group or a new loader in `api.php`.
3. **Read or write?** — search `app/Queries/` and `app/Handlers/` for an existing class first; **do not search `app/Domain/`, it does not exist.**
   - Read → `Get<X>Query` under `app/Queries/<Domain>/`.
   - Write → `Save<X>Handler` (or `Update.../Delete...`) under `app/Handlers/<Domain>/`, wrapped in `DB::transaction`.
4. **Controller** → thin method, `try/catch`, `response()->json(...)`. Never a `JsonResource`.
5. **Frontend wiring (add dynamic data)** → if the design-first `api/<feature>.api.ts` (or legacy `useApiRequest.js`) exists, swap each hard-coded / `TODO(backend)` method for `http.get/post("api/<prefix>/...")`, keeping the response shape identical. If not, stop and suggest `/webkit.frontend-implement` first.
6. **Domain calculations** (payroll, OT, leave credits) → follow the spec's compute step and [HRMS Domain Rules](../../rules/hrms-rules.md) for exact rates/factors; do not hardcode ad-hoc numbers.

---

## Target Frontend Connection Setup (Add the Dynamic Data)

This is the core deliverable of Gate 2: replace the hard-coded design data with live calls.

- **Preserve Frontend Logic**: Do NOT rewrite or modify frontend page scripts, composables, components, or UI layouts. They were validated in Gate 1.
- **Update the Request Layer Only**: In `api/<feature>.api.ts` (legacy: `script/useApiRequest.js`), replace each hard-coded / `TODO(backend)` method with a live call. Return `response.data` and keep the **same response shape** the hard-coded method returned so nothing downstream changes.
- **Verify shape parity**: diff the live response against the hard-coded object the frontend expected. Any missing/renamed field is a bug to fix on the backend, not in the page.

```typescript
// api/<feature>.api.ts — Gate 2: hard-coded methods swapped for live calls.
// Endpoint prefix per Project Profile portal table (timekeeping ≠ tk). Response shape unchanged.
import http from '@/app/axios/axiosInstance';

export function use<Feature>Api() {
  return {
    getRoster: async (params: Record<string, any> = {}): Promise<any> => {
      const response = await http.get('api/<url-prefix>/<endpoint>', { params });
      return response.data; // same shape the design-first stub returned
    },
  };
}
```

---

## Verification (Lightweight)

Automated PHPUnit execution is out of scope for this skill for now — pair with `/webkit.fix`'s test-running verification phase when regression coverage is actually needed. Still confirm the following before considering the work done:
1. **Syntax Check**: The new/edited PHP files parse cleanly (e.g. `php -l <file>`) and match the surrounding code's formatting.
2. **Route Sanity Check**: The new/modified route sits in the correct `routes/api/<group>.php` file (with its `use` import added there), doesn't collide with an existing URI, and — confirm with `php artisan route:list --path=api` — resolves under the right prefix and auth middleware.
3. **Acceptance Criteria walk (when the spec has them)**: Take the `AC-n` rows your endpoints own and check each literally — exact status code, exact message, exact computed value. Rows describing rejection (unauthorized, validation failure, conflict, replayed request) are the ones most often skipped and are exactly what `/webkit.verify` hunts for. Name any row you could not exercise, and why.
4. **Non-Functional checklist sweep**: For each category — authorization, concurrency/double-submit, idempotency, error shape, validation boundaries — point at the code that implements it. "The handler looks fine" is not a check; a guard nothing calls is not a guard.
5. **Definition of Done**: Tick the boxes this gate closes; list what remains.
6. **Manual Verification Steps**: Give the user concrete steps to hit the new endpoint (e.g. via curl/Postman) and confirm the response shape matches the JSON structure implemented.

---

## Close the Loop

1. **Update the Report (if one was loaded)**: Check off the corresponding item(s) in the report's "High-Level Implementation Plan" checklist (`[ ]` → `[x]`) and append a short "Resolution" note (what was built, and the date) so `investigation.md` stays current.
2. **Report the Reuse Ledger**: Print the ledger table — every class, migration, and route you created new, what you searched, and why nothing fit. Call out any `CREATE` whose search came back empty, so the user can point you at an existing class before the duplicate sets a precedent.
3. **Confirm the dynamic swap**: State which api methods are now live and that the page renders on real data with the same shape as the validated design. Call out any field that changed shape from the hard-coded version.
4. **Suggested Next Step**: If no frontend existed for this module, tell the user to run `/webkit.frontend-implement <target_path> <prompt>` to build the design against these endpoints. Otherwise, point to [Git Workflow Standards](../../rules/git-workflow.md) for a Conventional Commit message (e.g. `feat(payroll): wire payroll processing to live data`). Do not stage or commit automatically.
