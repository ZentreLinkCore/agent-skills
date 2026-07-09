# HRMS Agent Rules & Customizations

This workspace contains specialized coding, design, and business rules located in the [.agents/rules/](./rules/) directory, plus a set of end-to-end workflow skills in [.agents/skills/](./skills/).

The agent MUST read, load, and follow these rules files:

1. [Coding Standards](./rules/coding-standards.md) - Clean code, formatting, and DRY guidelines.
2. [Vue.js Standards](./rules/vue-standards.md) - Rules for Composition API, state, and components.
3. [Laravel Standards](./rules/laravel-standards.md) - Rules for controllers, models, FormRequests, and API resources.
4. [UI & Design Standards](./rules/ui-design.md) - Theme guidelines, colors, grids, dark mode, card styling, and animations.
5. [Performance Standards](./rules/performance.md) - Lazy loading, lazy routes, memory cleanup, and DB query scaling.
6. [Security Standards](./rules/security.md) - CSRF, input validation, DB policies, rate-limiting, and encryption.
7. [Project Structure Standards](./rules/project-structure.md) - File and folder layouts across backend and frontend.
8. [Naming Convention Standards](./rules/naming-convention.md) - Casing standards for components, variables, tables, models, and classes.
9. [Git Workflow Standards](./rules/git-workflow.md) - Branch names, Conventional Commits, and PR merging guidelines.
10. [Testing Standards](./rules/testing.md) - PHPUnit and Vitest targets, mocking guidelines, and critical calculations coverage.
11. [Documentation Standards](./rules/documentation.md) - Inline JSDoc/PHPDoc comments and API schemas.
12. [HRMS Domain Rules](./rules/hrms-rules.md) - Overtime, late logs, SSS/PhilHealth/Pag-IBIG compliance, salary rate factors, and portal separations.
13. [Execution Strategy](./rules/execution-strategy.md) - Workspace search order and scan optimization guidelines.
14. [Context Loading](./rules/context-loading.md) - Focus scoping and token safety limitations.
15. [Duplicate Prevention](./rules/duplicate-prevention.md) - Logic and file reuse rules.
16. [Incremental Generation](./rules/incremental-generation.md) - Guidelines for minimal diffs and safe file modification.
17. [Anti-Hallucination](./rules/anti-hallucination.md) - Constraints to reduce fabricated routes, databases, or variables.
18. [System Awareness](./rules/system-awareness.md) - The canonical models/migrations/routes discovery scan referenced by the rules and skills above; update scan steps here only.
19. [Project Profile](./rules/project-profile.md) - **Read this first for any implementation.** Verified ground-truth architecture of THIS codebase: Domain Query/Handler pattern, no API Resources, portal route prefixes (`tk` namespace vs `timekeeping` URL), frontend module layout, HTTP client import, globally-registered components. Follow it instead of re-detecting.

## Workflow Skills

For end-to-end feature work, prefer the skills in [.agents/skills/](./skills/) over ad-hoc edits — they encode the rules above into a concrete sequence:

1. [webkit.investigate](./skills/webkit.investigate/SKILL.md) - Root-cause analysis and a written plan. Never edits files.
2. [webkit.backend-implement](./skills/webkit.backend-implement/SKILL.md) - Laravel controllers, models, migrations, routes.
3. [webkit.frontend-implement](./skills/webkit.frontend-implement/SKILL.md) - Vue/React pages, components, composables.
4. [webkit.fix](./skills/webkit.fix/SKILL.md) - Applies an approved fix from an investigation report.
5. [webkit.refactor](./skills/webkit.refactor/SKILL.md) - Behavior-preserving cleanup and restructuring.

Typical flow: `webkit.investigate` → `webkit.backend-implement` and/or `webkit.frontend-implement` (either order — see [System Awareness](./rules/system-awareness.md) for how each handles the other layer not existing yet) → `webkit.fix` or `webkit.refactor` as needed.
