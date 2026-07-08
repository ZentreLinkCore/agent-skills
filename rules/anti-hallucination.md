# Anti-Hallucination

## Purpose
This document establishes rules and checks to prevent AI hallucinations, ensuring all database tables, columns, routes, models, permissions, and configurations correspond to actual code in the project.

## Scope
Applicable to all file referencing, variable usage, route mapping, and schema integrations.

## Responsibilities
- **AI Agent**: Verifies the existence of all endpoints, models, tables, and settings before writing them.
- **Developer/User**: Clarifies structural schemas, database fields, and application keys when requested.

## Actionable Rules
1. **Never Fabricate Code Structures**: Do not invent, assume, or guess:
  - Database table schemas or column names.
  - Model definitions or relation filters.
  - Route URLs or request mappings.
  - Controller classes or namespace groupings.
  - Service classes, query files, or handler namespaces.
  - Policy schemas or gate parameters.
  - Permission rules, status enums, or configurations.
  - Environment keys (`.env`).
2. **Verify Before Referencing**: Search the codebase (using grep or direct file reads) to check for the existence of any method, table, or helper before referencing it in code edits.
3. **Mandatory System Awareness Scan**: Before generating any backend code (controller, query, handler, migration, model, or route), run the scan defined in [System Awareness](./system-awareness.md). Only proceed with new file creation if the scan confirms no existing implementation covers the requirement.
4. **Strict Conformity to Project Conventions**: If a new class or script is required, scaffold it strictly matching the namespace, file casing, and directory structure of similar existing classes.
5. **Ask When Unsure**: If schemas, model properties, or configuration variables cannot be verified confidently, stop and ask the user for clarification. Do not guess.

## Best Practices
- **Inspect DB Migrations/Schema Logs**: Read migration files or run database checks to verify actual column names.
- **Inspect API Registrations**: Check routing files (`routes/api.php` or routing files) to verify endpoint layouts.
- **Use Model `$fillable` as Ground Truth**: When building queries, validators, API resources, or frontend mock data, use the model's `$fillable` and `$casts` arrays as the authoritative field list — never invent columns.

## AI Behavior Expectations
- **Clarification Trigger**: The agent must prompt the user with questions if a referenced table, file, or key is missing from the workspace searches.
- **No Mock Assumptions**: Do not use placeholders or hypothetical dependencies; only write verified project references.
- **No New Table Without Proof**: The agent must not generate a `Schema::create()` migration unless it has confirmed — via model/migration scan — that no existing table covers the same data domain. If uncertain, it must ask the user.
