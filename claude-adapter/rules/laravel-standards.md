# Laravel Standards

## Purpose

This document defines coding standards, database safety, and optimization patterns for Laravel backend development, focusing on project-specific architectural alignment.

## Scope

Applicable to all backend components, including Controllers, Models, FormRequests, Migrations, Seeders, Eloquent Resources, Services, Repositories, Actions, and Routes.

## Responsibilities

- **AI Agent**: Performs mandatory architecture discovery on the Laravel codebase and mirrors the active design patterns exactly.
- **Developer/User**: Configures database connections and executes migrations in staging or production.

## Actionable Rules

1. **Architecture Is Already Known — Follow the Profile**: This project's backend architecture is documented in [Project Profile](./project-profile.md). Do not re-derive it from scratch or introduce a different pattern. The verified facts:
   - **Overall Architecture**: Thin controllers + **Query/Handler/Action** pattern. Classes live at the **top level of `app/`** — `app/Queries/<Domain>/` (`App\Queries`), `app/Handlers/<Domain>/` (`App\Handlers`), and `app/Actions/<Domain>/` (`App\Actions`) — all with static `execute()`. **The `app/Domain/` folder is retired; never write under it or reference `App\Domain\...`.** Queries = reads, Handlers = write "conductor", **Actions = optional focused/reusable sub-steps** a Handler delegates to only when its logic gets large or is reused elsewhere. Do NOT add Repository/Action classes for trivial work — keep small handlers inline. See [Project Profile](./project-profile.md) for the full pattern.
   - **Validation Pattern**: Mostly inline (`Request $request` → `$request->all()`). FormRequests are rare and live **flat** in `app/Http/Requests/`. Only add one if the target controller already uses one.
   - **API Response Pattern**: Raw `response()->json(...)` inside `try/catch`. **There are ZERO API Resources / `JsonResource` classes — do NOT create them.** Success: `response()->json($data)` or `response()->json(['data' => $data])`; error: `response()->json(['message' => $e->getMessage()], 400)`.
   - **Database Access Pattern**: Direct Eloquent inside Query/Handler classes.
   - **Route Organization**: One `auth:sanctum` group, sub-grouped by portal prefix. Mind the **`tk` namespace vs `timekeeping` URL prefix** gotcha — see the profile's portal table.
   - Still run the [System Awareness](./system-awareness.md) scan for the specific models, columns, and routes your feature touches.
2. **Mandatory System Awareness Before Any Migration or Model**: Before creating any migration, model, controller, query class, or handler, run the scan defined in [System Awareness](./system-awareness.md). Only proceed with new file generation if this scan confirms no existing implementation satisfies the requirement. This does not require a frontend to already exist — backend/API-first work is valid.
3. **Architecture Lock**: Conform strictly to the detected architecture. Never introduce another architectural pattern, move files to a new pattern, or mix Repositories with Domain patterns unless the codebase already implements both.
4. **Database Safety & Optimization**:
   - **Reuse Before Create**: If an existing Eloquent model and its table already cover the feature's data, use them directly. Do NOT create a parallel table.
   - **No Duplicate Tables**: Never generate `Schema::create('<table>')` if that table already exists in any migration file. Search before creating.
   - Do NOT run migrations automatically. Scaffold migration files and Eloquent models and request the user to run them.
   - **Index relationship columns — do NOT add DB-level foreign key constraints.** This codebase has **zero** DB-level FKs (`->foreign()->references()`); referential integrity is enforced in the **Query/Handler layer**, not the database. On every relationship column (e.g. `idacct`, `idpayperiod`, `idtranstype`, `idclass`) add a plain `->index()` instead of `->foreign()`. Adding `->foreign()` has repeatedly broken migrations here (e.g. an `idacct` FK referencing a non-existent `account` table — the real table is `accounts`) and contradicts the established convention.
   - **Migration File Location Rules**:
     - **New Table Creation**: Place new table creation migrations (`Schema::create`) in their matching domain folder under `database/migrations/table/<table-name><domain>/` (or top-level `database/migrations/` if timestamped flat migrations are used).
     - **Alter Migrations**: All table alteration / modification migrations (`Schema::table`) MUST be saved in `database/migrations/alters/<domain_or_feature>/`.
   - Include **timestamps** on tables. For "soft delete", match sibling tables in the same domain: most use a **`status` column** (e.g. `0=Disable/Inactive, 1=Active`) rather than Laravel `SoftDeletes`. Only add the `SoftDeletes` trait if the sibling tables already use it.
   - Wrap create, update, delete, or batch actions inside database transactions (`DB::transaction`).
5. **Validation Standards**: Match the detected validation style. If FormRequests are standard, create or extend them. Avoid inline validation unless it is the established codebase convention.
6. **API Response Alignment**: Match the discovered API response layout. If API Resources are standard, wrap responses in matching resources. Reuse existing exception and error formatters.
7. **Eager Loading & Scaling**: Prevent N+1 query problems by using `with()`. Use chunking/lazy loads (`chunk()`, `lazy()`) for batch operations.

## Best Practices

- **Eager Loading**: Eager load relationships on list views.
- **Route Groups**: Place new routes inside existing group blocks, inheriting correct middlewares and prefixes.
- **Model `$fillable` as Source of Truth**: Use the model's `$fillable` and `$casts` to drive FormRequest rules, API Resource fields, and query `select()` columns.

## AI Behavior Expectations

- **Strict Architecture Discovery**: The agent must inspect the controllers, models, and requests directories first to establish the architectural lock.
- **System Awareness Before Creation**: The agent must scan `app/Models/`, `database/migrations/`, the `routes/api/` tree (per-portal route files + the `routes/api.php` orchestrator), and `app/Http/Controllers/` before generating any new file. Skipping this step is a violation.
- **Minimal Route Diff**: When registering routes, append to matching groupings instead of recreating routing blocks.
- **Stop on Existing Match**: If an existing model, table, or controller already covers the requirement, the agent must reuse it and must NOT generate a new parallel implementation.
