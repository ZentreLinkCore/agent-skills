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
  - Controllers, Services, Repositories, Actions
  - Models, Eloquent entities, Database tables
  - Requests (FormRequests, validator schemas)
  - Policies, Gates, middlewares
  - API Resources, JsonResponse structures
  - Utilities, date helpers, formatting libraries
  - Composables, hooks
2. **Reuse & Extension Rules**: If a similar asset exists:
  - Reuse it directly.
  - Extend the existing file (e.g. adding a method, prop, or column) instead of creating a new duplicate file.
3. **No Duplicate Logic**: Never write identical business logic (e.g. calculation engines, rates, formatting steps) in different files. Refer to a single source of truth.
4. **Shared Refactoring**: If a feature-specific helper is needed in a sibling module, refactor it to a global/shared folder instead of duplicating its code.

## Best Practices
- **Conform to Shared Structures**: Check global folders (e.g. `components/`, `utils/`) before starting any feature implementation.
- **Clear Imports**: Use the project's default aliases to import shared files cleanly.

## AI Behavior Expectations
- **Proactive Verification**: The agent must run grep queries to check for existing filenames or helper terms before writing new code blocks.
- **Refusal to Duplicate**: Reject requests to copy and paste logic from one module to another. Use imports or refactor to shared helpers.
