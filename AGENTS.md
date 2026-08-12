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
19. [Project Profile](./rules/project-profile.md) - **Read this first for any implementation.** Verified ground-truth architecture. Covers **two codebases** — start at its "Which Project Am I In?" section, which detects SubHRMS (Vue 3) vs ScaleUP (React 19) from `package.json` and tells you which sections apply. Shared: top-level Query/Handler/Action pattern (`App\Queries`, `App\Handlers`, `App\Actions` — `app/Domain/` is retired), no API Resources. Project-specific: database conventions (**opposite** in each), route organization, frontend layout, HTTP client import. Follow it instead of re-detecting.

## Specs

Feature designs live in [.agents/specs/](./specs/) (under project/repo-specific folders e.g. [.agents/specs/scaleup/](./specs/scaleup/) or [.agents/specs/subhrms/](./specs/subhrms/)). **When a spec exists for the feature you're building, it is the primary source of truth** — the implement skills read it and build to it (tables, queries, handlers, routes, API contract on the backend; layout, components, filters, pagination, types on the frontend). The spec supersedes ad-hoc design decisions; only a rule in [.agents/rules/](./rules/) overrides it, and any genuine conflict should be flagged.

## Workflow Skills

For end-to-end feature work, prefer the skills in [.agents/skills/](./skills/) over ad-hoc edits — they encode the rules above into a concrete sequence:

1. [webkit.investigate](./skills/webkit.investigate/SKILL.md) - Root-cause analysis and a written plan. Never edits files.
2. [webkit.frontend-implement](./skills/webkit.frontend-implement/SKILL.md) - **Gate 1 (design-first):** Vue/React pages, components, composables, built with **hard-coded data** so the design is validated against the spec before any backend work.
3. [webkit.backend-implement](./skills/webkit.backend-implement/SKILL.md) - **Gate 2:** Laravel controllers, models, migrations, routes — then **adds the dynamic data**, swapping the hard-coded frontend api methods for live calls.
4. [webkit.fix](./skills/webkit.fix/SKILL.md) - Applies an approved fix from an investigation report.
5. [webkit.refactor](./skills/webkit.refactor/SKILL.md) - Behavior-preserving cleanup and restructuring.
6. [webkit.migrate](./skills/webkit.migrate/SKILL.md) - Migrates a feature FROM this HRMS INTO a sibling target project (default `hrms_react`, React + plain-Laravel) and **implements it there**, matching the target's conventions. Two paths: `/webkit.migrate <source_path> <target_path>` (asa kuhaon → asa e-migrate). Flow is the invariant (data/API/rules/state machine identical); stack is the variable (Vue→React, Domain Q/H→plain controllers). Read-only on the source; writes the blueprint to `.agents/migrations/` and the implementation into the target.

**Typical spec-driven flow:** write/read the spec in `.agents/specs/` → `webkit.frontend-implement` builds the **hard-coded design** → user validates the design (add / adjust / OK) → `webkit.backend-implement` builds the backend and **wires the dynamic data** → `webkit.fix` or `webkit.refactor` as needed. (`webkit.investigate` up front for bug/RCA work.)
