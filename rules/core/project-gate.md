# Project Gate (always-on)

One kit, several codebases whose **database conventions are incompatible**: the wrong project's rule produces code that looks right and is wrong. Paths below are relative to the project's `.agents/rules/`, even when this file is a copy in `.claude/rules/`.

## 1. Which project am I in? (READ FIRST)

| Root `package.json` has | Project | Specs folder |
| :--- | :--- | :--- |
| `vue`, `pinia`, `vue-router` | `<source-path>` (Vue): Vue 3 | `.agents/specs/subhrms/` |
| `react`, `react-dom`, `react-router-dom` | `<source-path>` (React): React 19 | `.agents/specs/scaleup/` |
| none; `backend/` (Laravel) + `mobapp/` (Expo) | `<source-path>` (Expo) | `.agents/specs/queuemic/` |

Tells: (React) has `app/Models/Organization.php` and `.agents/blueprint/scaleup/`; (Vue) has `app/Models/Employee.php` and payroll content. (Expo) has no recorded profile: follow its sibling files and `conditional/mobile.md`, `realtime.md`. **State the project before generating anything**, then read only its sections of any rule.

## 2. The differences that bite

| | (Vue) | (React) |
| :--- | :--- | :--- |
| Foreign keys | **never** `->foreign()`: `->index()`, integrity in Query/Handler | **real**: `foreignId()->constrained()` |
| Relationship column | `idacct`, `idpayperiod` | `organization_id` |
| Soft delete | `status` column (0/1) | `softDeletes()` / `deleted_at` |
| Modules | `module/<portal>/<feature>/` | `module/<domain>/`, no portals |
| Routes | per-portal file; `tk` namespace ≠ `timekeeping` URL prefix | per-domain file |
| Controllers | `Controllers/<portal>/` (lowercase) | `Controllers/<Domain>/` (PascalCase) |
| Validation | inline `Request`; FormRequests rare | FormRequests are the norm |
| Design system | globally-registered Vue components | `src/components/ui/` barrel: import them |
| HTTP client | `axiosInstance` → `AxiosResponse`: return `.data` | `http` → already unwrapped |

The database rows are **direct opposites**: never carry one project's rule into the other.

## 3. True in every project

- Thin controllers calling static `execute()` classes: Queries (reads), Handlers (writes), Actions (reusable sub-steps) in `app/{Queries,Handlers,Actions}/<Domain>/` (`conditional/backend.md`).
- `app/Domain/` is retired: never write there, and never read an empty search of it as proof.
- No API Resources: `response()->json(...)` in `try/catch`; errors as `['message' => $e->getMessage()]` with a status.

## 4. Working discipline

- **Never fabricate** a table, column, route, model, namespace, permission, or env key: verify it in `app/Models/`, `database/migrations/`, `routes/api/`, or ask (`conditional/system-awareness.md`).
- **Reuse before creating**: search a path that exists, by the generic name (`Badge`, not only `StatusBadge`). An empty result from a wrong path proves nothing.
- **Smallest diff**, in the surrounding file's style and casing; keep comments and developer notes (`conditional/code-quality.md`).
- **Build-check only what changed**: `node .agents/scripts/check-changed.mjs`, never the full `npm run build` unless the user asks or the bundle config changed (`conditional/testing.md`).
