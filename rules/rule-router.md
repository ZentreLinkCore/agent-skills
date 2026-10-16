# Rule Router (always-on)

The always-on set is loaded once. Add only the rows your task or diff matches, all from `rules/conditional/`, and inside each read only your project's sections.

## By task

| Task | Load |
| :--- | :--- |
| Any `/webkit-*` skill | `skill-protocol.md` (it names the `ticket-numbering.md` section each step needs) |
| Writing code on a branch (implement, fix, refactor, migrate) | `branch-gate.md` |
| Finding code, callers, or impact | `code-search.md` |
| Laravel API: controller, route, Query / Handler / Action, validation | `backend.md`, `database.md`, `testing.md` |
| Migration, model, table, column, index | `database.md`, `testing.md` |
| Creating a file, table, route, or API call; mock data | `system-awareness.md` |
| Web frontend | `frontend.md`, then `frontend-vue.md` or `frontend-react.md`; `testing.md` |
| Styling, tokens, dark mode, layout | `ui-design.md` |
| React Native / Expo | `mobile.md`, `frontend.md`, `testing.md` |
| Broadcast events, channels, Echo clients | `realtime.md` |
| Payroll, timekeeping, leave, statutory math ((Vue)) | `payroll.md` |
| Lists, dashboards, query loops, large data | `performance.md` |
| Style, naming, editing, files, docstrings, when unsure | `code-quality.md` |
| Tests | `testing.md` |
| Version bump, CHANGELOG | `versioning.md` |

## By files in a diff (reviews, fixes)

| Path | Load |
| :--- | :--- |
| `database/migrations/**`, `app/Models/**` | `database.md` |
| `app/Http/**`, `routes/api/**`, `app/{Queries,Handlers,Actions}/**` | `backend.md` |
| `*.vue`, `resources/views/web/**` in (Vue) | `frontend.md`, `frontend-vue.md`; `ui-design.md` for templates and classes |
| `*.tsx` / `*.ts` in `resources/views/web/` in (React) | `frontend.md`, `frontend-react.md`; `ui-design.md` for JSX and classes |
| `resources/views/mobapp/**`, `mobapp/**` | `mobile.md` |
| `app/Events/**`, `routes/channels.php`, `config/broadcasting.php`, `**/echo.ts` | `realtime.md` |
| `tests/**`, `*.test.ts(x)` | `testing.md` |
| `resources/css/theme.css` | `ui-design.md` |
| Payroll, timekeeping, or leave code ((Vue)) | `payroll.md` |
| Version fields in `package.json`, `app.json`, `CHANGELOG.md` | `versioning.md` |

Procedures (`ticket-numbering.md`, `versioning.md`): read only the section a skill step names, when it runs. Product blueprints: the one specification the feature needs.
