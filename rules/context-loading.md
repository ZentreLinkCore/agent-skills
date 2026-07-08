# Context Loading

## Purpose
This document defines boundaries and limits for loading files into the context window, optimizing token usage and preventing context bloating.

## Scope
Applicable to all file reads, context retrievals, and document inspections.

## Responsibilities
- **AI Agent**: Enforces file loading limits and prioritizes loading targeted snippets over full files.
- **Developer/User**: Guides the agent to inspect specific files if complex refactors are required.

## Actionable Rules
1. **Context Priority Sequence**: When loading context to understand features or track bugs, follow this sequence:
  1. **Current File**: The active document being updated.
  2. **Current Folder**: Adjacent files and helpers inside the feature directory.
  3. **Shared Components / Utilities**: Global modules and reusable assets.
  4. **Related Module**: Sibling features under the active portal.
  5. **Current Portal**: Portal-level configurations and configurations.
  6. **Entire Project**: Loaded **only** if requested.
2. **Token Protection Limits**: Never load more than **2 full files** into the active context window simultaneously unless performing a merge or refactor operation.
3. **Snippet-First Inspections**: Always prefer reading specific line ranges or targeted code snippets (using file boundaries) over loading full-file context.
4. **Strict Boundary Separation (Write Scope)**:
  - Never *edit* backend files as a side effect of a frontend task, or *edit* frontend files as a side effect of a backend task.
  - Never inspect mobile code when implementing web code, and vice-versa.
  - Never inspect unrelated portals or modules unless requested.
  - **Exception — System Awareness Scan**: Read-only lookups of `app/Models/`, `database/migrations/`, and `routes/api.php` are always permitted, even during frontend work, and are in fact mandatory before designing data shapes or API calls. See [System Awareness](./system-awareness.md). This exception covers *reading* only — it never authorizes editing files on the other side of the boundary.

## Best Practices
- **Minimize Context Size**: Exclude comments, markup, or layout files that are unrelated to the logical execution of the task.
- **Targeted Grep**: Use ripgrep with specific patterns to locate definitions instead of scanning file by file.

## AI Behavior Expectations
- **Snippet-Based Reading**: The agent must read specific line boundaries rather than loading the whole file at once.
- **Scope Restriction**: Reject request chains that require loading unrelated directories.
