# Frontend: rules for every stack

Read this, then **one** stack file: [frontend-vue.md](./frontend-vue.md) for `<source-path>` (Vue), [frontend-react.md](./frontend-react.md) for `<source-path>` (React), or [mobile.md](./mobile.md) for an Expo app. Confirm the stack against [project-gate.md](../core/project-gate.md) rather than re-detecting it; check `package.json` only when the gate does not settle it.

## 1. Data comes from the real backend

- **Before writing a composable, hook, or api-layer function, run the [System Awareness scan](./system-awareness.md)** (read-only, allowed during frontend work). Read the model's `$fillable` and the route file for the endpoint.
- **State and filter names mirror the backend fields** (`issue_type` → `issueType` / `issue_type`, not a renamed alias). Mock data uses the real column names, never generic `name` / `title` / `value` unless those are the columns.
- **Endpoint strings come from real routes**, with the project's real URL prefix. No route yet: shape the call after the closest model and mark the api layer pending backend work ([system-awareness.md §5](./system-awareness.md#5-when-the-other-side-does-not-exist-yet)).
- **Shared types match the shaping Query** on the backend.

## 2. Layering

- The api layer is the only place that calls the HTTP client. A composable / hook imports the api function; a component or page never calls the client directly.
- Use the project's HTTP client exactly as its stack file says. **The two web clients unwrap differently**: a second `.data` on an already-unwrapped body is a bug.
- Auth failures (401 / 419) are already handled centrally in each project. Never add per-module logout handling.

## 3. Reuse the design system

- Search the design system before building any component, using the generic name (`Badge`, `Modal`, `Table`). Reuse or extend; never a local near-copy ([system-awareness.md §4](./system-awareness.md#4-no-duplicate-logic)).
- Styling, tokens, accents, dark mode, and layout: [ui-design.md](./ui-design.md).

## 4. Behavior every page needs

- **States**: loading, error, empty, and data, each rendered with the project's existing loader, empty-state, and error components.
- **Performance**: lazy-load routes and heavy views; debounce request-firing inputs (~300 ms); clean up timers, observers, listeners, and subscriptions on unmount ([performance.md](./performance.md)).
- **Security**: escape output; no unsanitized HTML injection; no tokens or PII in browser storage ([security-baseline.md](../core/security-baseline.md)).
- **Tests**: unit tests for utils, mocked-client tests for composables / hooks and api functions, component tests for pages ([testing.md §Frontend](./testing.md#frontend)).
- **Edits**: change only the tags, script lines, or class strings the task needs; never replace a whole template for a small change.
