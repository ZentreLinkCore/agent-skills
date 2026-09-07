# Agent Rules — Rule Library Index

> [!IMPORTANT]
> **Start at the repo-root [`AGENTS.md`](../AGENTS.md), not here.** That file is the portable entry point every agent should load: the project gate, the conventions that are always true, and a table telling you which rule to open for which task. This file is just the index of what lives in [`.agents/rules/`](./rules/).

**Do NOT preload all of these.** The library is ~1,000 lines, and in either project roughly a third of it describes the *other* one — Vue rules in a React repo, portal rules where there are no portals. Loading it all on every turn is the single largest avoidable context cost here, and wrong-project content in context is what causes agents to build to the wrong stack.

**Read a rule when the task touches it** (the root `AGENTS.md` table maps task → rule):

1. [Coding Standards](./rules/coding-standards.md) - Clean code, formatting, and DRY guidelines.
2. [Vue.js Standards](./rules/vue-standards.md) - Composition API, state, components. **SubHRMS only** — ScaleUP is React.
3. [Laravel Standards](./rules/laravel-standards.md) - Controllers, models, FormRequests, migrations, routes.
4. [UI & Design Standards](./rules/ui-design.md) - Theme, colors, grids, dark mode, cards. **Portal-specific parts are SubHRMS only.**
5. [Performance Standards](./rules/performance.md) - Lazy loading, memory cleanup, DB query scaling.
6. [Security Standards](./rules/security.md) - CSRF, input validation, policies, rate-limiting, encryption.
7. [Project Structure Standards](./rules/project-structure.md) - File and folder layouts across backend and frontend.
8. [Naming Convention Standards](./rules/naming-convention.md) - Casing for components, variables, tables, models, classes.
9. [Git Workflow Standards](./rules/git-workflow.md) - Branch names, Conventional Commits, the mandatory branch gate.
10. [Testing Standards](./rules/testing.md) - PHPUnit targets, mocking, critical-calculation coverage. **ScaleUP configures no JS test runner** — use `npm run typecheck` / `npm run build`.
11. [Documentation Standards](./rules/documentation.md) - Inline JSDoc/PHPDoc comments and API schemas.
12. [HRMS Domain Rules](./rules/hrms-rules.md) - Overtime, late logs, SSS/PhilHealth/Pag-IBIG, rate factors, portal separation. **SubHRMS only.**
13. [Execution Strategy](./rules/execution-strategy.md) - Workspace search order and scan optimization.
14. [Context Loading](./rules/context-loading.md) - Focus scoping and token safety limits.
15. [Duplicate Prevention](./rules/duplicate-prevention.md) - Logic and file reuse rules.
16. [Incremental Generation](./rules/incremental-generation.md) - Minimal diffs and safe file modification.
17. [Anti-Hallucination](./rules/anti-hallucination.md) - Constraints against fabricated routes, tables, or variables.
18. [System Awareness](./rules/system-awareness.md) - The canonical models/migrations/routes discovery scan. Update scan steps here only.
19. [Ticket Numbering](./rules/ticket-numbering.md) - The `T#####` convention: how a number is allocated **per project**, which skills may allocate, the five fixed filenames inside the ticket folder, and the ticket-named branch. Read it before writing a spec or a report, or before branching.
20. [Project Profile](./rules/project-profile.md) - Verified ground-truth architecture for **both** codebases. Open it when you need detail beyond the root `AGENTS.md` summary — then read **only** your project's sections. Shared: top-level Query/Handler/Action (`App\Queries`, `App\Handlers`, `App\Actions` — `app/Domain/` is retired), no API Resources. Project-specific: database conventions (**opposite** in each), route organization, frontend layout, HTTP client.

## Specs

Feature designs live in [.agents/specs/](./specs/) under their project, one **ticket folder** per feature — `T00001`, `T00002`, … allocated by `/webkit.spec` and holding all three documents for that work:

```text
.agents/specs/subhrms/T00001/        # scaleup has its own T00001 — numbers are PER PROJECT
├── specs.md            ← /webkit.spec
├── investigation.md    ← /webkit.investigate
├── refactor.md         ← /webkit.refactor
├── verify.md           ← /webkit.verify
└── code-review.md      ← /webkit.code-review
```

A ticket does not need all five. A feature ticket may have no `investigation.md`; a bug ticket usually has no `specs.md`. What is present tells you what has been done. **`/webkit.spec`, `/webkit.investigate`, and `/webkit.refactor` allocate a ticket** when their work has none — they are the three entry points; every other skill resolves the existing one.

The work is then implemented on a branch named after the ticket — bare `T00001`, matching the folder exactly, so any later skill can read the branch and find the spec. The format, the per-project increment, the fixed filenames, and the branch rule are canonical in [ticket-numbering.md](./rules/ticket-numbering.md) — read it before writing a spec or a report, or before branching.

Specs written before this convention still live in portal folders beside the ticket folders (e.g. [.agents/specs/subhrms/](./specs/subhrms/), [.agents/specs/scaleup/](./specs/scaleup/)); they remain valid and must still be found by spec discovery, so **search ticket folders and portal folders**. Ticket folder names carry no feature name — grep their contents (`grep -ril '<feature>' .agents/specs/<project> --include='*.md'`), not their names.

**When a spec exists for the feature you're building, it is the primary source of truth** — the implement skills read it and build to it (tables, queries, handlers, routes, API contract on the backend; layout, components, filters, pagination, types on the frontend). The spec supersedes ad-hoc design decisions; only a rule in [.agents/rules/](./rules/) overrides it, and any genuine conflict should be flagged.

## Workflow Skills

For end-to-end feature work, prefer the skills in [.agents/skills/](./skills/) over ad-hoc edits — they encode the rules above into a concrete sequence:

1. [webkit.investigate](./skills/webkit.investigate/SKILL.md) - Root-cause analysis and a written plan. Never edits application code; allocates the bug's ticket and writes `investigation.md` into it.
2. [webkit.frontend-implement](./skills/webkit.frontend-implement/SKILL.md) - **Gate 1 (design-first):** Vue/React pages, components, composables, built with **hard-coded data** so the design is validated against the spec before any backend work.
3. [webkit.backend-implement](./skills/webkit.backend-implement/SKILL.md) - **Gate 2:** Laravel controllers, models, migrations, routes — then **adds the dynamic data**, swapping the hard-coded frontend api methods for live calls.
4. [webkit.fix](./skills/webkit.fix/SKILL.md) - Applies an approved fix from an investigation report.
5. [webkit.refactor](./skills/webkit.refactor/SKILL.md) - Behavior-preserving cleanup and restructuring, recorded in `refactor.md` in the ticket folder — what moved where, the duplication removed, and the regression checks that prove behavior held.
6. [webkit.migrate](./skills/webkit.migrate/SKILL.md) - Migrates a feature FROM this HRMS INTO a sibling target project (default `hrms_react`, React + plain-Laravel) and **implements it there**, matching the target's conventions. Two paths: `/webkit.migrate <source_path> <target_path>` (asa kuhaon → asa e-migrate). Flow is the invariant (data/API/rules/state machine identical); stack is the variable (Vue→React, Domain Q/H→plain controllers). Read-only on the source; writes the blueprint to `.agents/migrations/` and the implementation into the target.
7. [webkit.verify](./skills/webkit.verify/SKILL.md) - **ADVERSARIAL spec-conformance check.** Tries to PROVE the implementation does NOT match its spec, rather than confirming that it does: every spec claim starts UNPROVEN and needs `file:line` evidence to pass. Hunts the three things a normal review misses — rules silently never coded (absence), rules coded backwards (inversion), and code the spec never authorized (unspecced additions). Never edits code; writes the conformance report to `verify.md` in the spec's own ticket folder and hands confirmed findings to `webkit.fix`.
8. [webkit.code-review](./skills/webkit.code-review/SKILL.md) - Reviews the **diff** (uncommitted changes, or a branch vs its base) for correctness bugs, security holes, N+1s, duplication, and violations of the rules above — each with a cited rule, a CRITICAL/HIGH/MEDIUM/LOW severity, and a concrete suggested fix. Complements `webkit.verify`: verify asks *does this match the spec*, this asks *is this code any good*. Never edits code; writes the review to `code-review.md` in the change's ticket folder (or to `.agents/reports/` when the change has no ticket).

**Typical spec-driven flow:** `webkit.spec` allocates the ticket folder and writes `.agents/specs/<project>/T#####/specs.md` → the implementing skills branch on `T#####` → `webkit.frontend-implement` builds the **hard-coded design** → user validates the design (add / adjust / OK) → `webkit.backend-implement` builds the backend and **wires the dynamic data** → **`webkit.verify` proves the result actually matches the spec**, **`webkit.code-review` checks the diff is good code** → `webkit.fix` or `webkit.refactor` as needed. (`webkit.investigate` up front for bug/RCA work.)

> [!IMPORTANT]
**Every implementing skill starts with a BLOCKING branch gate.** `webkit.frontend-implement`, `webkit.backend-implement`, `webkit.fix`, and `webkit.refactor` must run the [Mandatory Branch Gate](./rules/git-workflow.md#mandatory-branch-gate-for-implementing-skills) and **create** a branch before touching a file — not merely confirm one is needed. Committing stays the user's call; the gate only guarantees the work is isolated and revertible.

> [!IMPORTANT]
> `webkit.verify` is the gate that keeps spec-driven development honest. Without it, "the spec was implemented" is an assumption nobody ever tested — which is exactly how the ScaleUP organization layer drifted from its own blueprint. Run it before considering a spec done.
