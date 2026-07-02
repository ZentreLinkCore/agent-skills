# Project Structure Standards

## Purpose
This document establishes guidelines for preserving the project's folder organization, module structure, and file locations.

## Scope
Applicable to all files, folders, layouts, routing files, and component locations in the project workspace.

## Responsibilities
- **AI Agent**: Discovers and conforms strictly to the existing project organization (Feature-based, Layered, Atomic Design, Domain-Driven, etc.).
- **Developer/User**: Approves folder migrations or structural restructurings.

## Actionable Rules
1. **Architecture Discovery Blueprints**: Before adding or moving folders, inspect the project's layout (e.g. standard Laravel paths, React source directories, Vue portals).
2. **Directory Alignment**: Create files only within existing folders. If the project places pages under `pages/` and sub-components under `components/`, follow this layout. Do not invent custom layout directories.
3. **No Structure Contamination**:
  - Keep frontend files strictly within designated client directories.
  - Keep backend classes under their appropriate namespace directories (e.g., `app/`).
  - Do not copy or duplicate shared helpers inside local features folders.
4. **Temporary / Scratch Directories**: Save developer logs, test templates, and scratch files in local `.agents/scratch/` or ignore directories — never commit scratch scripts to the project root.

## Best Practices
- **Domain Separation**: Group related files by feature domains where the project implements modular architecture.
- **Explicit Imports**: Use the project's active path aliases (e.g., `@/*`, `~/` or relative imports) consistently.

## AI Behavior Expectations
- **Strict Architecture Lock**: The agent must never create folders simply because they appear in standard templates. Follow the project's discovered structure.
- **Incremental Directory Insertion**: Add files inside the existing hierarchy without rearranging nearby folders.
