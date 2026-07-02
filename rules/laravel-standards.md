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
2. **Architecture Lock**: Conform strictly to the detected architecture. Never introduce another architectural pattern, move files to a new pattern, or mix Repositories with Domain patterns unless the codebase already implements both.
3. **Database Safety & Optimization**:
  - Do NOT run migrations automatically. Scaffold migration files and Eloquent models and request the user to run them.
  - Include indexes, foreign key constraints, soft deletes, and timestamps on tables.
  - Wrap create, update, delete, or batch actions inside database transactions (`DB::transaction`).
4. **Validation Standards**: Match the detected validation style. If FormRequests are standard, create or extend them. Avoid inline validation unless it is the established codebase convention.
5. **API Response Alignment**: Match the discovered API response layout. If API Resources are standard, wrap responses in matching resources. Reuse existing exception and error formatters.
6. **Eager Loading & Scaling**: Prevent N+1 query problems by using `with()`. Use chunking/lazy loads (`chunk()`, `lazy()`) for batch operations.

## Best Practices
- **Eager Loading**: Eager load relationships on list views.
- **Route Groups**: Place new routes inside existing group blocks, inheriting correct middlewares and prefixes.

## AI Behavior Expectations
- **Strict Architecture Discovery**: The agent must inspect the controllers, models, and requests directories first to establish the architectural lock.
- **Minimal Route Diff**: When registering routes, append to matching groupings instead of recreating routing blocks.
