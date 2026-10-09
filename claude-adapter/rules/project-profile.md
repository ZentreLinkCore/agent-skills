# Project Profile — Gate (always-on)

This is the **gate only**. The full profile — both projects' stack, folder layout, design system, HTTP client, database conventions, route organization, and known drift — is canonical at **`.agents/rules/project-profile.md`**. Only this gate stays always-on; the bodies are read on demand so a turn does not pay for the project it is not in.

---

## Which Project Am I In? (READ FIRST)

This workspace holds **two different codebases** sharing one rule set. They share a backend pattern, but their frontends, database conventions, and domain vocabulary are **incompatible**. Applying the wrong half produces code that looks plausible and is wrong.

Each project is named by its **source path in your system setup** (e.g. `src/<repo>`). `<source-path>` below stands for that path; the stack in parentheses — (Vue) or (React) — tells the two projects apart.

**Detect it in one step — check `package.json` dependencies:**

| If you see | Project | Frontend | Then read |
| :--- | :--- | :--- | :--- |
| `vue`, `pinia`, `vue-router` | **`<source-path>` (Vue)** | Vue 3 | the "`<source-path>` (Vue) —" sections of `.agents/rules/project-profile.md` |
| `react`, `react-dom`, `react-router-dom` | **`<source-path>` (React)** | React 19 | the **`<source-path>` (React) Profile** section of `.agents/rules/project-profile.md` |

Secondary tells: `<source-path>` (React) has `.agents/blueprint/scaleup/` and `app/Models/Organization.php`; `<source-path>` (Vue) has payroll/timekeeping domain content and `app/Models/Employee.php`.

**State the resolved project before generating anything.** Then read only that project's section of the canonical profile — never both.

---

## The differences that bite hardest

Enough to stop a wrong assumption; the details are in the canonical file.

| | `<source-path>` (Vue) | `<source-path>` (React) |
| :--- | :--- | :--- |
| Frontend | Vue 3 `<script setup>`, composables, Pinia | React 19 + hooks/Context — **no Pinia/Redux/Zustand** |
| Module layout | `module/<portal>/<feature>/` | `module/<domain>/` — **no portals at all** |
| Foreign keys | **Zero** DB-level FKs — index instead | **Real** FKs — `foreignId()->constrained()` |
| Relationship column | `id`-prefixed (`idacct`) | `<parent>_id` (`organization_id`) |
| Soft delete | a `status` column | `deleted_at` / `softDeletes()` |
| Routes | per-**portal** files; `tk` namespace ≠ `timekeeping` prefix | per-**domain** files |
| JS tests | — | **no Vitest configured** (`npm run typecheck` / `npm run build`) |

> [!CAUTION]
> The database conventions are **direct opposites** and are the easiest thing to get wrong. Never carry one project's rule into the other.

## Both projects share

- **Backend pattern**: thin controllers + `app/Queries/<Domain>/`, `app/Handlers/<Domain>/`, `app/Actions/<Domain>/`, static `execute()`.
- **`app/Domain/` is retired** and exists in neither repo — do not write there, and do not read an empty search of it as proof that nothing exists.
- **No API Resources** — `response()->json(...)` inside `try/catch`.

Anything beyond this table: read `.agents/rules/project-profile.md`.

---

## Working discipline (the rules, without the exposition)

Full versions in [`.agents/rules/`](../../.agents/rules/) — read one only when you need its detail.

**Never fabricate.** Tables, columns, routes, models, namespaces, permissions, env keys — verify each against `app/Models/`, `database/migrations/`, and `routes/api/` before referencing it. If you cannot verify, **ask**; do not guess.

**Scan before creating** (System Awareness): models → migrations → routes → controllers/Queries/Handlers. If something already covers the domain entity, **reuse or extend it**. Only create when the scan finds nothing, or the user asked for a separate one. Never a parallel table, duplicate endpoint, or second copy of business logic.

**Search order, then stop:** current module → shared/design-system → sibling modules → wider area → whole repo *only if asked*. Take the first acceptable match; do not hunt for a better one. **An empty result from a path that does not exist is not evidence of absence** — check the path is real.

**Context budget:** at most 2 full files at once; prefer targeted line ranges. Do not edit backend files during a frontend task or vice versa — the read-only scan above is the one exception.

**Naming:** JS/TS `camelCase`; PHP properties, DB columns, array keys `snake_case`; constants `UPPER_SNAKE_CASE`; FKs `<singular_parent>_id`. **Match the casing the target folder already uses** over any of this.

**Code:** match the surrounding file's style exactly. One responsibility per function (reassess past ~40 lines). Descriptive names, strict types where the language supports them. Validate inputs early to avoid nesting. Never duplicate a helper — extract it.

**Edits:** smallest diff that does the job. Preserve comments, developer notes, and existing logic. Never rewrite a file when editing lines will do.
