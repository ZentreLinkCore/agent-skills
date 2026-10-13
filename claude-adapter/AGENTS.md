# Agent Rules

Portable entry point for **any** coding agent (Claude Code, Antigravity/Gemini, Cursor, Copilot). Deliberately small: everything below is always true, and everything else is linked and read **only when the task touches it**. Loading the full rule library on every turn costs ~1,650 lines and is mostly content for the project you are not in.

---

## 1. Which project am I in? (READ FIRST)

One rule set, **two codebases**. They share a backend pattern; their frontends and **database conventions are incompatible**. Applying the wrong half produces code that looks plausible and is wrong.

Each project is named by its **source path in your system setup** (e.g. `src/<repo>`). `<source-path>` below stands for that path; the stack in parentheses — (Vue) or (React) — tells the two projects apart.

Check `package.json`:

| Dependencies | Project | Frontend |
| :--- | :--- | :--- |
| `vue`, `pinia`, `vue-router` | **`<source-path>` (Vue)** | Vue 3 + Composition API |
| `react`, `react-dom`, `react-router-dom` | **`<source-path>` (React)** | React 19 + hooks/Context |

Secondary tells: `<source-path>` (React) has `app/Models/Organization.php` and `.agents/blueprint/scaleup/`; `<source-path>` (Vue) has `app/Models/Employee.php` and payroll/timekeeping domain content.

**State the resolved project before generating anything.**

## 2. The differences that bite

| | `<source-path>` (Vue) | `<source-path>` (React) |
| :--- | :--- | :--- |
| Foreign keys | **Never** `->foreign()` — index only, integrity in Query/Handler | **Real** FKs: `foreignId()->constrained()` |
| Relationship column | `id`-prefixed: `idacct`, `idpayperiod` | `<parent>_id`: `organization_id` |
| Soft delete | a `status` column (`0/1`) | `softDeletes()` / `deleted_at` |
| Modules | `module/<portal>/<feature>/` | `module/<domain>/` — **no portals** |
| Routes | per-**portal** file; `tk` namespace ≠ `timekeeping` URL prefix | per-**domain** file |
| Controllers | `app/Http/Controllers/<portal>/` (lowercase) | `app/Http/Controllers/<Domain>/` (PascalCase) |
| Design system | globally-registered Vue components | `src/components/ui/` + barrel — **import them** |
| HTTP client | `@/app/axios/axiosInstance` → returns `AxiosResponse`, use `.data` | `@/app/axios/http` → **already unwrapped** |
| JS tests | Vitest | **none configured** — use `npm run typecheck`, `npm run build` |

> The database rows are **direct opposites**. Never carry one project's rule into the other.

## 3. True in both

- **Thin controllers + Query/Handler/Action**, static `execute()`: reads in `app/Queries/<Domain>/`, writes in `app/Handlers/<Domain>/`, reusable sub-steps in `app/Actions/<Domain>/`. `<Domain>` is PascalCase.
- **`app/Domain/` is retired and does not exist.** Do not write there — and do not read an empty search of it as proof that nothing exists. Search `app/Queries/` and `app/Handlers/`.
- **No API Resources.** Return `response()->json(...)` inside `try/catch`; errors as `['message' => $e->getMessage()]` with a status code.
- **Reuse before creating.** Before writing a component, hook, util, Query, or Handler, search for an existing one — using a path that exists and the *generic* name (`Badge`, not just `StatusBadge`). An empty result from a wrong path is not evidence of absence.
- **Never invent** a column, route, model, or env key. Verify against `app/Models/`, `database/migrations/`, and `routes/api/`.

## 4. Read only when the task touches it

Full rules live in [`.agents/rules/`](./.agents/rules/). Do not preload them.

| Task | Read |
| :--- | :--- |
| Migrations, models, controllers, routes, Query/Handler | `laravel-standards.md`, `system-awareness.md` |
| Full architecture detail for either project | `project-profile.md` |
| Vue components (Vue projects only) | `vue-standards.md` |
| Styling, portals, statutory ID columns (projects with portals) | `ui-design.md` |
| Payroll, timekeeping, leave, statutory math | `hrms-rules.md` |
| Auth, permissions, input handling, uploads | `security.md` |
| Lists, dashboards, N+1 risk, debounce, pagination | `performance.md` |
| Branching, commits, the branch gate | `git-workflow.md` |
| New files/folders, or avoiding duplicates | `project-structure.md`, `duplicate-prevention.md` |
| Editing an existing file (minimal diffs) | `incremental-generation.md` |
| Writing tests | `testing.md` |
| App version bumps, CHANGELOG, `versioning.mode` (`.agents/config/<project>.yml`) | `versioning.md` |

Always-on essentials — read if unsure: `authority-boundary.md` (each `/webkit-*` skill owns only its own stage: stop and report anything else), `anti-hallucination.md`, `duplicate-prevention.md`, `context-loading.md`, `execution-strategy.md`, `coding-standards.md`, `naming-convention.md`.

## 5. Specs, blueprint, workflows

- **[`.agents/specs/`](./.agents/specs/)** — feature designs, one **ticket folder** per feature inside its project: `specs/<project>/T00001/`, … each holding up to seven fixed-name documents: `spec.md` (the spec, from [`.agents/template/feature-specification.md`](./.agents/template/feature-specification.md); `specs.md` on tickets created before `/webkit-specify`), `plan.md` (the implementation plan `/webkit-implement` executes, from [`.agents/template/implementation-plan.md`](./.agents/template/implementation-plan.md)), `investigation.md` (root cause), `refactor.md` (what was restructured), `verify.md` (spec conformance), `code-review.md` (diff review), `design-review.md` (visual review). A ticket needs only the ones its work produced. Numbers are allocated `max + 1` **per project** by `/webkit-specify`, `/webkit-investigate`, or `/webkit-refactor` — the three entry points; every other skill resolves an existing ticket. The work is branched as bare `T00001`. Older specs still sit in portal folders beside them and are still valid — **search both**, and grep ticket folders' *contents*, since their names carry no feature name. Convention: [`.agents/rules/ticket-numbering.md`](./.agents/rules/ticket-numbering.md). **When a spec exists for what you are building, it is the primary source of truth** and supersedes ad-hoc design. Only a rule overrides it; flag genuine conflicts.
- **[`.agents/blueprint/`](./.agents/blueprint/)** — product blueprints, one folder per project; governs *behavior* (the rules govern *how to express it in code*). Start at `docs/README.md`.
- **[`.agents/skills/`](./.agents/skills/)** — end-to-end workflows: specify → implement (backend first, then frontend integration) → verify → fix, plus investigate, refactor, code-review, design-review, document, migrate. In Claude Code these are `/webkit-*` commands. **In other agents, read the `SKILL.md` directly** and follow it — the content is tool-neutral.

## 6. Before you write

1. Resolve the project (§1) and say which.
2. Scan before creating: `app/Models/`, `database/migrations/`, `routes/api/`. Reuse what exists.
3. Work on a branch, not `main`.
4. Match the surrounding file's conventions over any general guidance here.
