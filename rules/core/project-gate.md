# Project Gate (always-on)

One kit, several codebases. They share a backend pattern, but their frontends and **database conventions are incompatible**: the wrong project's rule produces code that looks right and is wrong.

**Paths:** every rule link in the always-on files resolves inside the project's `.agents/rules/` (`core/`, `conditional/`, or the root), even when the file was loaded as a copy from `.claude/rules/`.

## 1. Which project am I in? (READ FIRST)

Each project is named by its source path in your setup (`<source-path>`); the stack in parentheses tells them apart. Check the root `package.json`:

| Root `package.json` has | Project | Specs folder | Frontend |
| :--- | :--- | :--- | :--- |
| `vue`, `pinia`, `vue-router` | `<source-path>` (Vue) | `.agents/specs/subhrms/` | Vue 3 + Composition API |
| `react`, `react-dom`, `react-router-dom` | `<source-path>` (React) | `.agents/specs/scaleup/` | React 19 + hooks/Context |
| no root `package.json`; `backend/` (Laravel) + `mobapp/` (Expo) | `<source-path>` (Expo) | `.agents/specs/queuemic/` | React Native / Expo |

Secondary tells: (React) has `app/Models/Organization.php` and `.agents/blueprint/scaleup/`; (Vue) has `app/Models/Employee.php` and payroll/timekeeping content. (Expo) has no recorded profile: derive its conventions from sibling files, and use the verified facts in [mobile.md](../conditional/mobile.md) and [realtime.md](../conditional/realtime.md).

**State the resolved project before generating anything.** Then read only that project's sections of any conditional rule.

## 2. The differences that bite

| | (Vue) | (React) |
| :--- | :--- | :--- |
| Foreign keys | **Never** `->foreign()`: index only; integrity in Query/Handler | **Real** FKs: `foreignId()->constrained()` |
| Relationship column | `id`-prefixed: `idacct`, `idpayperiod` | `<parent>_id`: `organization_id` |
| Soft delete | a `status` column (`0/1`) | `softDeletes()` / `deleted_at` |
| Modules | `module/<portal>/<feature>/` | `module/<domain>/`: **no portals** |
| Routes | per-**portal** file; `tk` namespace ≠ `timekeeping` URL prefix | per-**domain** file |
| Controllers | `app/Http/Controllers/<portal>/` (lowercase) | `app/Http/Controllers/<Domain>/` (PascalCase) |
| Validation | inline `Request $request`; FormRequests rare | FormRequests are the norm |
| Design system | globally-registered Vue components | `src/components/ui/` + barrel: **import them** |
| HTTP client | `@/app/axios/axiosInstance` → `AxiosResponse`, return `.data` | `@/app/axios/http` → **already unwrapped** |

> [!CAUTION]
> The database rows are **direct opposites**. Never carry one project's rule into the other.

## 3. True in every project

- **Thin controllers + Query/Handler/Action**, static `execute()`: reads in `app/Queries/<Domain>/`, writes in `app/Handlers/<Domain>/`, reusable sub-steps in `app/Actions/<Domain>/`. `<Domain>` is PascalCase. Detail: [backend.md](../conditional/backend.md).
- **`app/Domain/` is retired and does not exist.** Never write there, and never read an empty search of it as proof that nothing exists.
- **No API Resources.** `response()->json(...)` inside `try/catch`; errors as `['message' => $e->getMessage()]` with a status code.

## 4. Working discipline

- **Never fabricate** a table, column, route, model, namespace, permission, or env key. Verify against `app/Models/`, `database/migrations/`, and `routes/api/` before referencing it; if you cannot, **ask**. Procedure: [system-awareness.md](../conditional/system-awareness.md).
- **Reuse before creating.** Search for an existing component, hook, util, Query, or Handler first, with a path that exists and the generic name (`Badge`, not only `StatusBadge`). An empty result from a wrong path is not evidence of absence.
- **Spend context deliberately**: Graphify before grep, summaries before raw history, exact lines before whole files ([context-budget.md](../context-budget.md)). Load only the rules the [rule router](../rule-router.md) picks.
- **Edits**: the smallest diff that does the job; match the surrounding file's style and casing; keep comments and developer notes. Detail: [code-quality.md](../conditional/code-quality.md).
- **Build-check only what changed.** Never run the full `npm run build` as a check (minutes, and a 6 GB heap on (Vue)): `node .agents/scripts/check-changed.mjs` compiles just the changed files, in seconds. The full build runs only when the user asks, or when `vite.config.*`, `package.json`, the entry file, or global CSS changed ([testing.md](../conditional/testing.md#frontend-build-check-changed-files-only)).
- **Work on a branch, never `main`/`master`** ([git-workflow.md](./git-workflow.md)). Committing is the user's call.
