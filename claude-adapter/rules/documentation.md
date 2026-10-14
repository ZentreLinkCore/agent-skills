# Documentation Standards

## Purpose

This document outlines conventions for writing inline comments, structural docstrings, API summaries, and environment setup guidelines.

## Scope

Applicable to all comments, markdown files, README files, docstrings, and configuration instructions in the repository.

## Responsibilities

- **AI Agent**: Documents classes, parameters, and return shapes in code comments, and updates guides when environment variables change.
- **Developer/User**: Updates operational user guides and keeps architecture maps aligned.

## Actionable Rules

1. **Focus on the "Why"**: Avoid comments that restate what the code is doing. Write inline comments to explain non-obvious code changes, business exceptions, performance trade-offs, or integration details.
2. **Standardize Docstrings**:
   - **JavaScript/TypeScript**: Use standard **JSDoc** for components, composables, hooks, and helpers. Define parameters and return types.
   - **PHP**: Use standard **PHPDoc** for controllers, routes, models, and queries.
3. **API Document Mapping**: Keep parameter details and payload descriptions synchronized with changes in routes and request validations.
4. **Environment Setup updates**: If new variables are introduced in `.env.example` or package dependencies change in configuration managers, document these changes in the project README.

## Best Practices

- **Self-Documenting Code**: Prefer clean code architecture and clear variable names over writing long inline comments to explain convoluted blocks.
- **Keep README Build-Ready**: Keep local repository build commands up to date.

## AI Behavior Expectations

- **Preserve Documentation**: Never remove or erase comments, docstrings, or developer notes during edits.
- **Auto-Generate Docstrings**: When generating new controllers or helper utilities, add clean docstrings outlining prop validations and return details.
