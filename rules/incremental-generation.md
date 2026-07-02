# Incremental Generation

## Purpose
This document defines procedures for editing existing source files safely, ensuring minimal changes and preserving existing code structures, logic, and configurations.

## Scope
Applicable to all file modifications, refactorings, merges, and code insertions.

## Responsibilities
- **AI Agent**: Generates minimal diffs, checks file existence before editing, and preserves developer comments.
- **Developer/User**: Reviews diff blocks and validates merges against staging branch tests.

## Actionable Rules
1. **Safety Existence Checks**: Verify if the target file already exists in the workspace.
2. **Update Missing Sections Only**: If the file exists, inject only the required methods, routes, properties, or styles. Never rewrite entire classes or layouts if a simple insert can accomplish the task.
3. **Preserve Surrounding Context**: Do not delete or rewrite surrounding methods, styling classes, or business calculations unless requested.
4. **No Overwriting of Custom Configurations**: Preserve developer notes, configuration adjustments, and user comment blocks.
5. **Minimal Diffs standard**: Design changes to be as small and targeted as possible. Avoid reorganizing folders, moving files, or refactoring unrelated files.

## Best Practices
- **Conform to Existing Formatting**: Match the file's current spacing, quotes, semicolons, and bracket layout.
- **Test Incremental Edits**: Verify changes compile without breaking adjacent code loops or exports.

## AI Behavior Expectations
- **Targeted Replacements**: The agent must target modifications to specific lines. Avoid replacing entire files to make minor edits.
- **Dry Runs**: Validate syntax correctness before outputting final diff ranges.
