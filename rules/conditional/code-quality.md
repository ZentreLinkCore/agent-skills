# Code Quality: style, naming, edits, files, comments

How code is written and changed in any language and layer. The essentials are in [project-gate.md §4](../core/project-gate.md#4-working-discipline); read this file when a convention is unclear. **Match the target folder and file over any default here.**

## 1. Style

- **Discover before writing.** Read adjacent files for indentation, quotes, semicolons, and brace placement, and mirror them exactly. Do not introduce a formatter style of your own.
- **Single responsibility.** One job per function, method, and class. Past ~40 lines of logic, assess a split.
- **Descriptive names**, no cryptic abbreviations. Verb-prefixed functions (`getData`, `saveRecord`, `deleteItem`).
- **Strict types** where the language has them: TypeScript interfaces, PHP typed properties and return types.
- **Fail early.** Validate inputs, parameters, and authorization at the top of a function to avoid nesting.
- **DRY.** Never duplicate a helper; extract it to a shared module ([system-awareness.md §4](./system-awareness.md#4-no-duplicate-logic)).

## 2. Naming

- **Detect the folder's convention first.** Components in kebab-case (`user-table.vue`) → name new ones in kebab-case; PascalCase (`UserTable.vue`) → PascalCase. Never impose your default.
- **JavaScript / TypeScript**: `camelCase` variables and functions (`isLoading`, `fetchDataList`).
- **PHP and database**: `snake_case` properties, columns, and array keys (`$employee_id`, `created_at`).
- **Constants**: `UPPER_SNAKE_CASE` (`STATUS_ACTIVE`).
- **Suffixes**: match the existing ones (`*Controller.php`, `*Request.php`, `use*` for hooks and composables).
- **Relationship columns** follow the project's database convention ([database.md](./database.md)); the two projects differ.

## 3. Editing existing files

1. **Check the file exists** before writing it.
2. **Insert only what is missing**: the method, route, property, or class string. Never rewrite a class, template, or layout that a targeted insert can change.
3. **Preserve** surrounding methods, business calculations, configuration, developer notes, comments, and docstrings, unless the task is to change them.
4. **Minimal diffs.** No reorganizing folders, moving files, or touching unrelated files.
5. **Check the edit compiles** with its neighbours (imports, exports, loops) before reporting it done.

## 4. Files and folders

- **Follow the discovered structure.** Inspect the layout (Laravel paths, the frontend module layout in [frontend-vue.md](./frontend-vue.md) / [frontend-react.md](./frontend-react.md)) and create files only inside existing folders. Never create a folder because a template elsewhere has one.
- **No structure contamination.** Frontend files stay in the client directories; backend classes under their `app/` namespaces; shared helpers are never copied into a feature folder.
- **Use the project's path aliases** (`@/...`) consistently.
- **Scratch files** (logs, throwaway scripts) go in `.agents/scratch/` or an ignored folder, never the project root.
- **Ticket documents** are a real handoff between skills, not scratch output: their locations and names are fixed by [ticket-numbering.md §5](./ticket-numbering.md#5-the-file-contract).

## 5. Comments and documentation

- **Explain why, not what**: non-obvious decisions, business exceptions, performance trade-offs, integration details. Prefer clear names to long comments.
- **Docstrings**: JSDoc for components, composables, hooks, and helpers; PHPDoc for controllers, models, Queries, and Handlers, with parameters and return shapes. New controllers and helpers get them.
- **Keep API notes in step** with route and validation changes.
- **New env variables or dependencies**: document them in the project README (`.env.example` and setup commands).
- **Never remove** existing comments, docstrings, or developer notes during an edit.
