# Execution Strategy

## Purpose
This document establishes protocols for workspace searching, folder analysis, and implementation checking to minimize scan overhead and optimize token usage.

## Scope
Applicable to all search commands, directory traversals, and file scanning activities performed by the AI agent.

## Responsibilities
- **AI Agent**: Follows the defined search order and stops scanning immediately when a suitable implementation is discovered.
- **Developer/User**: Requests project-wide scans only when explicitly required.

## Actionable Rules
1. **Search Order Priority**: When seeking components, templates, hooks, or assets, follow this strict sequence:
  1. **Current Module**: Search the directory of the target feature.
  2. **Shared/Global Resources**: Check global utilities and shared component folders.
  3. **Sibling Modules**: Scan adjacent modules within the same workspace namespace.
  4. **Current Portal**: Look across adjacent portal directories.
  5. **Entire Project**: Check the whole repository **only** when explicitly requested.
2. **Backend Infrastructure Scan (Mandatory for Any Implementation Task)**: Before writing any feature code — frontend or backend — run the [System Awareness](./system-awareness.md) scan and use its results to drive all implementation decisions. This is a read-only exception to portal/module scope limits below; it does not permit editing across boundaries (see [Context Loading](./context-loading.md)).
3. **Early Exit**: If an existing component or helper clearly covers the core requirement, stop searching and reuse or extend it immediately instead of holding out for a closer or "cleaner" match. Only build new when nothing covers the requirement, or the user explicitly asks for a separate implementation.
4. **No Redundant Scanning**: Never continue searching the repository after finding an acceptable reusable component.
5. **No Repository-Wide Scans**: Never run project-wide greps or file lists for normal implementation tasks.

## Best Practices
- **Exclude System Paths**: Do not scan package directories (e.g. `vendor`, `node_modules`) or cache folders (`storage`, `tmp`).
- **Focus File Inspections**: Limit inspections to files likely to contain relevant code signatures.

## AI Behavior Expectations
- **Immediate Termination**: The agent must abort execution of searches as soon as an acceptable match is found.
- **Minimum Scanning**: Avoid general directory listings; target queries explicitly.
- **Backend Scan Is Not Optional**: Even for purely frontend tasks, the agent must scan `app/Models/` and `routes/api.php` before designing API composables or mock data. Skipping this step risks generating data shapes that contradict the real backend.
