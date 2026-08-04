# Duplicate Prevention

## Purpose
This document establishes rules to enforce code reuse and prevent duplicate file, utility, helper, or component generation in the repository.

## Scope
Applicable to all file creation, component writing, database structuring, and utility authoring tasks.

## Responsibilities
- **AI Agent**: Proactively searches the workspace for existing logic and reuse patterns before generating code.
- **Developer/User**: Identifies candidate classes or UI modules for refactoring into global assets.

## Actionable Rules
1. **Search Before Creation**: Before creating any new file or class, search the active module and global directories to check for existing:
  - Components (Tables, Buttons, Modals, Forms, Lists)
  - Query classes (`App\Queries\<Domain>`), Handlers (`App\Handlers\<Domain>`), Actions (`App\Actions\<Domain>`) — this project's read/write layer, per [Project Profile](./project-profile.md)
  - Controllers, Services, Repositories
  - Models, Eloquent entities, Database tables
  - Requests (FormRequests, validator schemas)
  - Policies, Gates, middlewares
  - API Resources, JsonResponse structures
  - Utilities, date helpers, formatting libraries
  - Composables, hooks

  This applies at the method level too, not just whole files: before adding a new static method to a Query/Handler class, check sibling classes in the same domain (and `App\Queries\PayPeriod\HandlePayPeriodQuery` for anything period/timesheet/payroll-related) for a method that already does the job. Example: `GetTimesheetClosingPeriodsQuery` initially grew its own private method duplicating a window-function query (`ROW_NUMBER() OVER (PARTITION BY tk_process_status ...)`) that already existed in `HandlePayPeriodQuery::timesheet_periods()`. It was refactored to extract the shared logic into `HandlePayPeriodQuery::rawTimesheetPeriods()`, which both call sites now use.
2. **Reuse & Extension Rules**: If a similar asset exists:
  - Reuse it directly.
  - Extend the existing file (e.g. adding a method, prop, or column) instead of creating a new duplicate file.
3. **No Duplicate Logic**: Never write identical business logic (e.g. calculation engines, rates, formatting steps) in different files. Refer to a single source of truth.
4. **Shared Refactoring**: If a feature-specific helper is needed in a sibling module, refactor it to a global/shared folder instead of duplicating its code.
5. **No Duplicate Database Tables or Endpoints**: Run the [System Awareness](./system-awareness.md) scan before generating any migration or route. Creating a parallel table for data that already has a model, or a duplicate route for a resource that already has one, is a critical violation — extend the existing table/model or controller method instead.

## Best Practices
- **Conform to Shared Structures**: Check global folders (e.g. `components/`, `utils/`) before starting any feature implementation.
- **Clear Imports**: Use the project's default aliases to import shared files cleanly.
- **Model-First Thinking**: When designing a new feature, always ask: *does a model for this entity already exist?* If yes, build on top of it.

## AI Behavior Expectations
- **Proactive Verification**: The agent must run grep queries to check for existing filenames or helper terms before writing new code blocks.
- **Refusal to Duplicate**: Reject requests to copy and paste logic from one module to another. Use imports or refactor to shared helpers.
- **Scan Before Migration or Route Registration**: Run the [System Awareness](./system-awareness.md) scan before any migration or route creation. Generating a migration for an already-existing table, or registering a duplicate route, is a hard violation.
