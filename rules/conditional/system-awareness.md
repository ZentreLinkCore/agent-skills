# System Awareness: verify before referencing, reuse before creating

The single canonical definition of the read-only discovery pass every code-generating task runs first, and of the two rules it protects: **never fabricate** and **never duplicate**. Other files link here instead of restating it; change the scan steps here only.

Applies to any task that creates or extends a controller, migration, model, route, Query / Handler / Action, composable, hook, or API request layer, and to designing mock data or data shapes.

## 1. Never fabricate

Do not invent, assume, or guess any of these. Verify each one exists (Graphify or a targeted search, then the file) before writing it into code, a spec, or a report:

- table schemas and column names · model definitions, relations, scopes
- route URLs and request mappings · controller classes and namespaces
- Query / Handler / Action / service classes · policies, gates, permission rules
- status enums and configuration values · environment keys (`.env`)

Scaffold anything new to match the namespace, file casing, and folder of its closest sibling. **If it cannot be verified with confidence, stop and ask.** No placeholders or hypothetical dependencies in written code: only verified references, or an explicit `(new)` marking that the spec authorized.

## 2. The scan

Steps 1–3 run on the files and grep: model fields, migration columns, and route → controller links are graph blind spots ([code-search.md](./code-search.md)). Step 4 starts with the graph when `graphify-out/graph.json` exists.

1. **Models.** Find the entities in `app/Models/`; read `$table`, `$fillable`, `$casts`, and relationships. These are the authoritative field names for queries, validation, responses, frontend state, and mock data.
2. **Migrations.** Where a model is ambiguous or incomplete, resolve it in `database/migrations/` (including subfolders such as `table/`, `alters/`, `views/`). The `Schema::create()` / `Schema::table()` block is ground truth for columns, types, nullability, defaults, and indexes.
3. **Routes.** Search the `routes/api/` tree (`routes/api.php` is only the orchestrator) by portal or domain keyword for an existing endpoint. `php artisan route:list --path=api` is ground truth for what is registered.
4. **Controllers and Query / Handler / Action classes.** Check the project's controller folder ([backend.md](./backend.md)) and `app/Queries/`, `app/Handlers/`, `app/Actions/`. `app/Domain/` is retired: never look there or write there. With a graph, `graphify explain "<ExactClass>" --all` lists a class's callers and callees faster than grep; it only locates, so read the file to confirm.

This scan is a **read-only exception** to the frontend / backend boundary ([context-budget.md §4](../context-budget.md#4-scope)): reading a model, migration, or route file to get real field names is always allowed and is mandatory for frontend work too. It never authorizes editing across the boundary.

**Output.** Before writing code, be able to state: models reused / created (e.g. `Timesheet`, reused) · tables reused / created · routes reused / created (e.g. `GET /api/timekeeping/timesheets`, new, in the existing group) · whether a new migration is needed, and why.

## 3. Reuse vs. create

- **An existing model, table, route, or controller covers the same domain entity** → reuse or extend it. This is the default outcome.
- **Create** a migration, model, or route only when the scan finds nothing covering the entity, or the user asked for a separate structure.
- **Genuinely ambiguous** → ask; do not guess either way.

> [!CAUTION]
> About to write `Schema::create('<table>')` for a table that exists or that a model already covers, or to register a route for a resource that already has one? Stop, re-scan `app/Models/` and `database/migrations/`, and ask if still unsure. A parallel table or duplicate endpoint is a critical violation.

## 4. No duplicate logic

Before creating a file, search the current module and the shared folders for an existing one of the same kind: components (tables, buttons, modals, forms, lists), Queries / Handlers / Actions, controllers and services, models, FormRequests and validators, policies, gates, middleware, response shapes, utilities (dates, formatting), composables and hooks.

- **Reuse it directly**, or **extend** it (a method, prop, or column) rather than creating a near-copy.
- **Method level too.** Before adding a static method to a Query or Handler, check its sibling classes (and, for period / timesheet / payroll work in (Vue), `App\Queries\PayPeriod\HandlePayPeriodQuery`). Example: `GetTimesheetClosingPeriodsQuery` grew a private copy of a `ROW_NUMBER() OVER (PARTITION BY tk_process_status ...)` query that `HandlePayPeriodQuery::timesheet_periods()` already ran; the shared logic was extracted to `HandlePayPeriodQuery::rawTimesheetPeriods()`, and both call it.
- **One source of truth** for every calculation, rate, and formatting step. A helper a sibling module needs moves to a shared folder; it is never copied. Refuse requests to paste logic from one module into another.

## 5. When the other side does not exist yet

- **Frontend with no backend route yet.** Shape mock data after the closest model's `$fillable` / migration columns. With no related model either, use realistic names from the requirements and mark the api layer as pending backend work. Not blocking; a follow-up note.
- **Backend with no frontend yet.** API-first is valid. If a UI or composable exists, align field names and endpoint shapes with it; otherwise design from the domain model and note frontend integration as the follow-up.
