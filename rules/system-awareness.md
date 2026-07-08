# System Awareness Scan

## Purpose
This document is the single canonical definition of the "System Awareness Scan" — the read-only discovery pass the agent must run before generating backend or frontend code. Other rule and skill files reference this document instead of restating it; if you are updating scan steps, update them here only.

## Scope
Applicable to any task that creates or extends a controller, migration, model, route, query/handler class, composable, hook, or API request layer.

## Relationship to Context Loading
This scan is a **read-only exception** to the frontend/backend boundary separation in [Context Loading](./context-loading.md). Reading a Laravel model, migration, or route file to verify field names is always allowed — for both frontend and backend tasks — because it prevents fabricated data shapes ([Anti-Hallucination](./anti-hallucination.md)). The boundary rule still applies to *writing*: a frontend task should not edit backend files (or vice versa) as a side effect of this scan.

## The Scan
1. **Models** — List `app/Models/` and identify entities relevant to the feature. Read `$table`, `$fillable`, `$casts`, and relationships. These are the authoritative field names for queries, validation rules, API resources, and frontend state/mock data — never invent column names.
2. **Migrations** — If a model's fields are ambiguous or incomplete, resolve them against `database/migrations/` (including subdirectories such as `table/`, `alters/`, `views/`, or versioned folders). Treat the `Schema::create()`/`Schema::table()` block as the ground truth for columns, types, nullability, defaults, and indexes.
3. **Routes** — Grep `routes/api.php` by portal keyword (e.g. `tk`, `hr`, `payroll`, `employee`, `manager`) for an existing endpoint covering the feature.
4. **Controllers / Domain classes** — Check `app/Http/Controllers/<portal>/` and `app/Domain/Queries|Handlers/` for an existing implementation.

## Decision Rule (Reuse vs. Create)
Skip the vague "80% match" heuristic — it isn't something an agent can actually measure. Instead:
- **If an existing model/table/route/controller covers the same domain entity or resource**, reuse or extend it. This is the default outcome of the scan.
- **Only create a new migration, model, or route** when the scan turns up nothing covering the domain entity, or when the user has explicitly asked for a new, separate structure.
- **If it's genuinely ambiguous** whether an existing structure covers the need, ask the user rather than guessing either way (see [Anti-Hallucination](./anti-hallucination.md)).

## Frontend Tasks: What "No Backend Yet" Means
Frontend implementation should be grounded in real backend structures when they exist (see [Vue.js Standards](./vue-standards.md)). If the scan finds no matching route yet:
- Shape mock data after the closest existing model's `$fillable`/migration columns if one exists.
- If no related model exists either, use realistic field names derived from the feature requirements and clearly mark the API layer as pending backend implementation (see [Incremental Generation](./incremental-generation.md)) — this is not a blocking condition, just a note for follow-up.

## Backend Tasks: What "No Frontend Yet" Means
Backend implementation does not require a frontend to already exist — API-first and backend-first workflows are valid. If frontend UI/composables already exist, align field names and endpoint shapes with them. If they don't, design the schema from the model/domain requirements described in the prompt and note that the frontend integration is a follow-up step (e.g. via `/webkit.frontend-implement`).

## Output
Before writing code, the agent should be able to state internally:
- **Model(s) reused / created**: e.g. `Timesheet` (reused)
- **Table(s) reused / created**: e.g. `timesheets` (reused)
- **Route(s) reused / created**: e.g. `GET /api/tk/timesheets` (new, added to existing `tk` group)
- **New migration needed**: yes/no, and why

> [!CAUTION]
> If about to write `Schema::create('<table>')` for a table that already exists or is covered by an existing model — stop, re-scan `app/Models/` and `database/migrations/`, and ask the user if still uncertain.
