# Coding Standards

## Purpose

This document defines general coding standards and code hygiene guidelines to ensure maintainability, readability, and consistency across both frontend and backend systems.

## Scope

Applicable to all files and directories in the workspace, spanning all languages (PHP, JavaScript, TypeScript, CSS, HTML, etc.) and layers.

## Responsibilities

- **AI Agent**: Must discover the existing code style before writing or modifying files.
- **Developer/User**: Defines project-specific formatting guidelines if not auto-detected.

## Actionable Rules

1. **Discover Coding Conventions First**: Inspect adjacent files to identify indentation (e.g., 2 spaces vs. 4 spaces), quotation styles (single vs. double), semicolons, and curly brace placements. Mirror the style exactly.
2. **SRP (Single Responsibility Principle)**: Keep functions, methods, and classes focused on one task. If a function exceeds 40 lines of logic, assess if it should be split.
3. **Expressive Naming**: Use self-descriptive names for variables, methods, and files. Avoid cryptic abbreviations.
4. **Strict Type Hinting**: Use strict type hints and return declarations where supported by the language (e.g., TypeScript interfaces, PHP typed properties and return types).

## Best Practices

- **DRY (Don't Repeat Yourself)**: Never duplicate helper functions or logic. Prioritize refactoring reusable logic to shared folders or modules.
- **Fail Early**: Validate inputs, parameters, and authorizations at the beginning of functions to minimize nesting and conditional branches.

## AI Behavior Expectations

- **Style Alignment**: The agent must format its changes to match the surrounding codebase's style without introducing custom code-formatter structures.
- **Incremental Diffs**: Generate only the minimal required edits. Never rewrite an entire file if editing a subset of lines is sufficient.
