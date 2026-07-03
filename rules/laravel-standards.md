# Laravel Standards

## Purpose
This document defines coding standards, database safety, and optimization patterns for Laravel backend development, focusing on project-specific architectural alignment.

## Scope
Applicable to all backend components, including Controllers, Models, FormRequests, Migrations, Seeders, Eloquent Resources, Services, Repositories, Actions, and Routes.

## Responsibilities
- **AI Agent**: Performs mandatory architecture discovery on the Laravel codebase and mirrors the active design patterns exactly.
- **Developer/User**: Configures database connections and executes migrations in staging or production.

## Actionable Rules
1. **Mandatory Architecture Discovery**: Before writing backend code, inspect the Laravel workspace to detect:
  - **Overall Architecture**: Domain query/handler, Service layer, Repository pattern, Action classes, or standard MVC.
  - **Validation Pattern**: FormRequests, inline validations, custom validators, or DTO validations.
  - **API Response Pattern**: Eloquent API Resources (`JsonResource`), response wrappers, success/error traits, or raw JsonResponses.
  - **Database Access Pattern**: Direct Eloquent queries, Repositories, query builders, or custom scopes.
  - **Route Organization**: Grouping, middleware prefixes, route naming conventions, and API versioning.
2. **Mandatory System Awareness Before Any Migration or Model**: Before creating any migration, model, controller, query class, or handler, scan the existing backend:
  - List `app/Models/` and read candidate models — check `$table`, `$fillable`, `$casts`, and relationships.
  - If the model's fields are ambiguous, scan the corresponding migration in `database/migrations/` (including subdirs: `table/`, `F00013/`, `alters/`, `views/`).
  - Read `routes/api.php` to verify no existing endpoint already covers the feature.
  - Check `app/Http/Controllers/<portal>/` and `app/Domain/` for existing controller/query/handler classes.
  - **Only proceed with new file generation if this scan confirms no existing implementation satisfies the requirement.**
3. **Architecture Lock**: Conform strictly to the detected architecture. Never introduce another architectural pattern, move files to a new pattern, or mix Repositories with Domain patterns unless the codebase already implements both.
4. **Database Safety & Optimization**:
  - **Reuse Before Create**: If an existing Eloquent model and its table already cover the feature's data, use them directly. Do NOT create a parallel table.
  - **No Duplicate Tables**: Never generate `Schema::create('<table>')` if that table already exists in any migration file. Search before creating.
  - Do NOT run migrations automatically. Scaffold migration files and Eloquent models and request the user to run them.
  - Include indexes, foreign key constraints, soft deletes, and timestamps on tables.
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
- **System Awareness Before Creation**: The agent must scan `app/Models/`, `database/migrations/`, `routes/api.php`, and `app/Http/Controllers/` before generating any new file. Skipping this step is a violation.
- **Minimal Route Diff**: When registering routes, append to matching groupings instead of recreating routing blocks.
- **Stop on Existing Match**: If an existing model, table, or controller already covers the requirement, the agent must reuse it and must NOT generate a new parallel implementation.
