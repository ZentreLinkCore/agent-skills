---
name: webkit-backend-implement
description: >
  Generates and implements modular backend setup for Vue.js modules using Laravel, creating controllers,
  domain query/handler classes, registering routes in the matching per-portal file under routes/api/, and integrating the backend endpoints with the frontend components.
  SPEC-DRIVEN: when a spec exists under `.agents/specs/`, that spec is the primary source of truth for the tables, queries, handlers, routes, and API contract to build.
  GATE 2 of the design-first flow: runs AFTER `/webkit.frontend-implement` has built the hard-coded design and the user has validated it — its job is to ADD THE DYNAMIC DATA, replacing the frontend's hard-coded `api/<feature>.api.ts` methods with live HTTP calls.
  ALWAYS scans existing Eloquent models, database migrations, and registered routes before generating anything.
  Never creates a new migration or model when an existing one already covers the feature's data needs.
  Supports dragging folder or file paths into the command to specify the target module.
  Triggered when the user runs the command `/webkit.backend-implement <target_path> <prompt>` or `/webkit.backend-implement <prompt>`.
---

# Webkit Backend Implement

This skill coordinates the backend implementation of a standard Laravel module, setting up controllers, database tables, validations, logic classes, and route entries matching the existing project's architecture, conventions, and patterns.

---

## Overview

When the user requests to implement or scaffold the backend structure of a module (e.g., using `/webkit.backend-implement <target_path> <prompt>` or `/webkit.backend-implement <prompt>`), the agent must:
1. Check if a folder or file path was dragged/passed into the command.
2. If a path is provided, parse it to extract the `<portal_name>` (e.g., `hr`, `employee`, `manager`, `admin`, `payroll`, `timekeeping`) and `<module_name>`.
3. If no path is provided, dynamically resolve the portal and module names from the prompt text or context.
4. **Load the Spec (PRIMARY SOURCE OF TRUTH — check first)**: Look under `.agents/specs/` (including sub-folders like `.agents/specs/<repo_name>/` e.g. `.agents/specs/scaleup/` or `.agents/specs/subhrms/`) for a spec matching the target module/feature. If one exists, **read it in full and build to it** — the tables/columns, Query & Handler classes, controller methods, routes, gating rules, and API contract all come from the spec's backend design. The spec supersedes ad-hoc schema guesses; where the spec and a rule in [.agents/rules/](../../rules/) genuinely conflict, follow the rule and note the conflict. If **no** spec exists, proceed from the prompt/report as before.
5. **Load Investigation Report (if referenced)**: If the prompt names or links a report, or `.agents/reports/` has one matching the target module, read it and use its scope/dependency analysis to inform the implementation plan — don't assume this skill has access to an earlier `webkit.investigate` conversation.
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

## Branch Discipline

Before scaffolding anything, confirm work is happening on a `feature/` branch per [Git Workflow Standards](../../rules/git-workflow.md), not directly on `main`/`master`. If already on a correctly-named branch for this module, continue there instead of creating a new one.

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
3. Related domain classes (in `app/Domain/`)
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

### Incremental Generation
If a file already exists:
- Update only the required sections (e.g. adding a method, field validation, or route binding).
- **Preserve**: Developer comments, business logic, formatting, existing imports, existing methods, and custom configurations.
- Generate the smallest possible diff. Never overwrite working files.

---

## Architecture & Convention Detection

### Laravel Architecture — Already Known
This project's backend architecture is documented in [Project Profile](../../rules/project-profile.md). **Read it and follow it — do not re-detect or introduce a different pattern.** Summary:
- **Thin controllers + Domain Query/Handler** (`app/Domain/Queries/<Domain>/` for reads, `app/Domain/Handlers/<Domain>/` for writes, static `execute()`). Do NOT add Service / Repository / Action classes for standard CRUD.
- **NO API Resources** — return `response()->json(...)` directly inside `try/catch`. Never scaffold a `JsonResource`.
- **Validation** is mostly inline (`$request->all()`); FormRequests are rare and flat in `app/Http/Requests/`.
- **Routes** grouped by portal prefix inside one `auth:sanctum` group. Mind the `tk` (namespace) vs `timekeeping` (URL prefix) gotcha.

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
└── <namespace>/               # e.g., hr, payroll, tk, employee, manager, admin (tk = timekeeping)
    └── <ModuleName>Controller.php # Thin controller: dispatches to Query/Handler in try/catch
app/Http/Requests/             # FormRequests are FLAT here (no portal subfolder) and RARE
└── Store<ModuleName>Request.php  #   only add if the target controller already uses one
app/Domain/
├── Queries/<Domain>/          # Read logic:  Get<X>Query.php   (extends Query, static execute)
└── Handlers/<Domain>/         # Write logic: Save<X>Handler.php (extends Handler, static execute, DB::transaction)
routes/
├── api.php                    # Orchestrator: public routes, auth:sanctum group, per-portal group() loaders
└── api/
    └── <portal>.php           # One file per portal (employee|manager|hr|timekeeping|payroll|admin)
                               #   holds that portal's routes + its own controller `use` imports
```

> There are **no** `app/Http/Resources/` API Resource classes in this project — do not create that directory. See [Project Profile](../../rules/project-profile.md).

---

## Backend Implementation Guidelines

### 1. Database Safety & Optimization
- **Reuse Before Create**: Always complete the System Awareness Phase (Steps 1–2) before deciding to create a new migration. If an existing table covers the requirement, use it directly.
- **Do NOT Run Migrations Automatically**: Generate migration files and Eloquent models only when a new table is confirmed necessary. Explain that migrations must only be run upon explicit user request.
- **No Duplicate Tables**: Never create a migration for a table name that already exists. Search `database/migrations/` for any prior `Schema::create('<table_name>')` definition before generating a new one.
- **Optimization Standard**: Add `->index()` on relationship columns (e.g. `idacct`, `idpayperiod`, `idtranstype`, `idclass`) and frequently filtered columns, plus timestamps. **Do NOT add DB-level foreign key constraints (`->foreign()->references()`)** — this project has **zero** DB-level FKs; enforce referential integrity in the Query/Handler layer and just index the column instead. Adding `->foreign()` has repeatedly broken migrations here (e.g. an FK to a non-existent `account` table when the real one is `accounts`). For soft-delete, match sibling tables — most use a `status` column, not Laravel `SoftDeletes`. Avoid duplicate schema definitions.

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

## Code Templates (This Project's Actual Pattern)

*These mirror the verified conventions in [Project Profile](../../rules/project-profile.md). Before writing, open the closest sibling Query/Handler/Controller for your portal and match it exactly — arg shapes and response wrappers vary slightly per module.*

#### 1. Domain Query (reads) — `app/Domain/Queries/<Domain>/Get<X>Query.php`
```php
<?php

namespace App\Domain\Queries\<Domain>;

use App\Domain\Queries\Query;
use App\Models\<ModelName>;

class Get<ModuleName>Query extends Query
{
    public static function execute($params = [])
    {
        return <ModelName>::query()
            ->with(['relations'])            // eager-load to avoid N+1
            ->paginate($params['entries'] ?? 10);
    }
}
```

#### 2. Domain Handler (writes) — `app/Domain/Handlers/<Domain>/Save<X>Handler.php`
```php
<?php

namespace App\Domain\Handlers\<Domain>;

use App\Domain\Handlers\Handler;
use App\Models\<ModelName>;
use Illuminate\Support\Facades\DB;

class Save<ModuleName>Handler extends Handler
{
    public static function execute($params = [])
    {
        return DB::transaction(function () use ($params) {
            return <ModelName>::updateOrCreate(
                ['id' => $params['id'] ?? null],
                $params
            );
        });
    }
}
```

#### 3. Controller (thin dispatcher) — `app/Http/Controllers/<namespace>/<ModuleName>Controller.php`
```php
<?php

namespace App\Http\Controllers\<namespace>;   // e.g. tk, hr, payroll, employee, manager, admin

use App\Http\Controllers\Controller;
use App\Domain\Queries\<Domain>\Get<ModuleName>Query;
use App\Domain\Handlers\<Domain>\Save<ModuleName>Handler;
use Illuminate\Http\Request;
use Exception;

class <ModuleName>Controller extends Controller
{
    public function index(Request $request)
    {
        try {
            $data = Get<ModuleName>Query::execute($request->all());
            return response()->json(['data' => $data]);      // NO API Resource wrapper
        } catch (Exception $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    public function store(Request $request)                   // inline validation is the norm; add a FormRequest only if the module already uses one
    {
        try {
            $result = Save<ModuleName>Handler::execute($request->all());
            return response()->json($result);
        } catch (Exception $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }
}
```

#### 4. Route — add inside the matching portal file `routes/api/<portal>.php`
```php
// in routes/api/timekeeping.php (loaded by api.php under prefix('timekeeping') + auth:sanctum).
// Add the controller `use` import at the top of THIS file, then the routes:
Route::get('/<module_endpoint>', [<ModuleName>Controller::class, 'index']);
Route::post('/<module_endpoint>/save', [<ModuleName>Controller::class, 'store']);

// Standard CRUD → prefer apiResource, with custom domain actions beside it:
Route::apiResource('<resource>', <ModuleName>Controller::class)->only(['index', 'store', 'update', 'destroy']);
Route::post('/<resource>/{id}/<action>', [<ModuleName>Controller::class, '<action>']);
```
Do NOT add routes to `routes/api.php` for an existing portal — it only holds the per-portal `group()` loaders. Remember: Timekeeping's file is `routes/api/timekeeping.php` and its URL prefix is **`timekeeping`** even though the controller namespace is `tk`.

---

## Decision Playbook

Work top-to-bottom; stop at the first branch that applies.

1. **Does a Model + table already cover this entity?** (System Awareness scan)
   - Yes → reuse it. Skip migration/model creation entirely.
   - No → scaffold migration + model (indexes on FKs + filtered columns, `SoftDeletes`, timestamps). Do NOT run the migration — tell the user to.
2. **Does a route for this resource already exist in the portal file (`routes/api/<portal>.php`)?**
   - Yes → add a method to the existing controller; wire it to a new/existing Query or Handler. Do NOT add a duplicate route.
   - No → add the route inside the correct portal file (+ its `use` import there). Never a new top-level group or a new portal loader in `api.php`.
3. **Read or write?**
   - Read → `Get<X>Query` under `app/Domain/Queries/<Domain>/`.
   - Write → `Save<X>Handler` (or `Update.../Delete...`) under `app/Domain/Handlers/<Domain>/`, wrapped in `DB::transaction`.
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
2. **Route Sanity Check**: The new/modified route sits in the correct `routes/api/<portal>.php` file (with its `use` import added there), doesn't collide with an existing URI, and — confirm with `php artisan route:list --path=api` — resolves under the right prefix with `auth:sanctum`.
3. **Manual Verification Steps**: Give the user concrete steps to hit the new endpoint (e.g. via curl/Postman) and confirm the response shape matches the API Resource / JSON structure implemented.

---

## Close the Loop

1. **Update the Report (if one was loaded)**: Check off the corresponding item(s) in the report's "High-Level Implementation Plan" checklist (`[ ]` → `[x]`) and append a short "Resolution" note (what was built, and the date) so `.agents/reports/<file>.md` stays current.
2. **Confirm the dynamic swap**: State which `api/<feature>.api.ts` methods are now live and that the page renders on real data with the same shape as the validated design. Call out any field that changed shape from the hard-coded version.
3. **Suggested Next Step**: If no frontend existed for this module, tell the user to run `/webkit.frontend-implement <target_path> <prompt>` to build the design against these endpoints. Otherwise, point to [Git Workflow Standards](../../rules/git-workflow.md) for a Conventional Commit message (e.g. `feat(payroll): wire payroll processing to live data`). Do not stage or commit automatically.
