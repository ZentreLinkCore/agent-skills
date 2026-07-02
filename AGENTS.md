# HRMS Agent Rules & Customizations

This workspace contains specialized coding, design, and business rules located in the [.agents/rules/](./rules/) directory.

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


