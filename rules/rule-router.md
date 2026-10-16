# Rule Router (always-on)

Decides which rules a task needs. Load the always-on set once per session, add only the rows your task or diff matches, and inside each file read only your project's sections ([project-gate.md](./core/project-gate.md)).

## Always loaded

[core/project-gate.md](./core/project-gate.md) · [core/authority-boundary.md](./core/authority-boundary.md) · [core/git-workflow.md](./core/git-workflow.md) · [core/security-baseline.md](./core/security-baseline.md) · [context-budget.md](./context-budget.md) · this router.

Everything in [`conditional/`](./conditional/) is loaded **only** when a row below matches.

## By task

| Task | Load from `conditional/` |
| :--- | :--- |
| Running any `/webkit-*` skill | [skill-protocol.md](./conditional/skill-protocol.md): the shared steps; it names the [ticket-numbering.md](./conditional/ticket-numbering.md) section each step needs |
| Laravel API change: controller, route, Query / Handler / Action, validation | [backend.md](./conditional/backend.md), [database.md](./conditional/database.md), [testing.md](./conditional/testing.md) |
| Migration, model, table, column, index | [database.md](./conditional/database.md), [testing.md](./conditional/testing.md) (schema test) |
| Before creating any file, table, route, or API call; designing data shapes or mock data | [system-awareness.md](./conditional/system-awareness.md) |
| Web frontend: page, component, composable / hook, api layer, state | [frontend.md](./conditional/frontend.md), then **one of** [frontend-vue.md](./conditional/frontend-vue.md) / [frontend-react.md](./conditional/frontend-react.md); [testing.md](./conditional/testing.md) |
| Styling, theme tokens, accents, dark mode, layout | [ui-design.md](./conditional/ui-design.md) |
| React Native / Expo app | [mobile.md](./conditional/mobile.md), [frontend.md](./conditional/frontend.md), [testing.md](./conditional/testing.md) |
| Realtime: broadcast event, channel, Echo / Reverb / Pusher client | [realtime.md](./conditional/realtime.md), plus the backend or client rule for the side you touch |
| Payroll, timekeeping, leave, statutory math, portal access ((Vue) only) | [payroll.md](./conditional/payroll.md) |
| Lists, dashboards, loops over queries, search inputs, large data | [performance.md](./conditional/performance.md) |
| Writing or editing code, creating files or folders, docstrings | [code-quality.md](./conditional/code-quality.md), only when the essentials in project-gate §4 do not settle it |
| Writing or updating tests | [testing.md](./conditional/testing.md) |
| Version bump, CHANGELOG, `versioning.mode` | [versioning.md](./conditional/versioning.md) |

## By files in a diff (reviews, fixes)

| Path touched | Load |
| :--- | :--- |
| `database/migrations/**`, `app/Models/**` | database.md |
| `app/Http/Controllers/**`, `app/Http/Requests/**`, `routes/api/**`, `app/Queries/**`, `app/Handlers/**`, `app/Actions/**` | backend.md |
| `*.vue`, `resources/views/web/**` in (Vue) | frontend.md, frontend-vue.md; ui-design.md when templates or classes change |
| `*.tsx` / `*.ts` under `resources/views/web/` in (React) | frontend.md, frontend-react.md; ui-design.md when JSX or classes change |
| `resources/views/mobapp/**`, `mobapp/**` | mobile.md |
| `app/Events/**`, `routes/channels.php`, `config/broadcasting.php`, `**/echo.ts` | realtime.md |
| `tests/**`, `*.test.ts(x)` | testing.md |
| `resources/css/theme.css` | ui-design.md |
| Payroll / timekeeping / leave modules, Queries, or Handlers ((Vue)) | payroll.md |
| `package.json`, `app.json`, `CHANGELOG.md` version fields | versioning.md |

## Not for every task

[ticket-numbering.md](./conditional/ticket-numbering.md) and [versioning.md](./conditional/versioning.md) are procedures: read the section a skill step names, when that step runs. Product blueprints (`.agents/blueprint/<project>/`) govern **behavior**: read the one specification the feature needs, never the whole folder.
