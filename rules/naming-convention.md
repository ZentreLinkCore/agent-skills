# Naming Convention Standards

## Purpose
This document defines casing formats, file suffixes, and variables naming rules to ensure naming consistency across the codebase.

## Scope
Applicable to all component files, controller classes, model entities, database columns, styling utilities, and scripts.

## Responsibilities
- **AI Agent**: Discovers the naming convention in adjacent folders (e.g. PascalCase vs. kebab-case for component files) and conforms to it.
- **Developer/User**: Resolves any legacy naming conflicts or styling standards inconsistencies.

## Actionable Rules
1. **Naming Convention Detection**: Check file lists in the active module directory before creating a component or class.
  - If components use kebab-case (e.g. `user-table.vue`), name new files in kebab-case.
  - If components use PascalCase (e.g. `UserTable.vue`), name new files in PascalCase.
2. **Variable Casing**:
  - **JavaScript/TypeScript**: Standardize on `camelCase` for variable and function names (e.g., `isLoading`, `fetchDataList`).
  - **PHP/Database**: Use `snake_case` for properties, table columns, and array keys (e.g., `$employee_id`, `created_at`).
  - **Constants**: Use `UPPER_SNAKE_CASE` (e.g., `STATUS_ACTIVE`).
3. **Class and File Suffixes**: Match existing class suffix styles (e.g., `*Controller.php`, `*Request.php`, `*Resource.php`, `use*` for hooks and composables).

## Best Practices
- **Explicit Relationships**: Database foreign keys must match the singular parent table name followed by `_id` (e.g., `user_id`).
- **Verbs for Actions**: Prefix functions with appropriate action verbs (e.g., `getData`, `saveRecord`, `deleteItem`).

## AI Behavior Expectations
- **Auto-Detection Match**: The agent must never impose its default naming casing (e.g., PascalCase) if kebab-case is standard in that folder.
- **Incremental Consistency**: Name local variables and classes to blend seamlessly with surrounding methods.
