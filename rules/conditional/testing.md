# Testing

Discover the test setup before writing a test (`tests/`, `__tests__/`, `phpunit.xml`, each app's `test` script) and match its libraries and layout.

- **Unit tests** cover logic in isolation from the database and web APIs (calculations, parsers, mappings).
- **Feature tests** cover validation, transactions, endpoints, and authorization guards.
- **Sandbox the database**: transactions or refresh traits, reset after each test.
- **Mock external integrations** (third-party APIs, messaging, file storage).
- **Explicit assertions** on real values and boundaries (empty, null, maximum, division by zero), never a bare true/false; core business computations and access rules first. Updating a calculation also updates the tests that already cover it.

## Every Code Change Ships With a Test (MANDATORY)

Binding on every skill that writes application code: `/webkit-implement`, `/webkit-fix`, `/webkit-refactor`, `/webkit-migrate`. A backend or frontend change is not done until a test proves it **and that test has run**. The test is part of the change: it is never scope expansion, and never an "Additional issue".

Exempt, with `None — <reason>` where a plan or summary asks for the test: changes with no behavior of their own (comments, a config key, a translation string, Tailwind class strings, a route registration already exercised by its endpoint's feature test).

### Backend (PHPUnit)

| What changed | Test to add | Where (follow the existing layout) |
| :--- | :--- | :--- |
| Pure logic: an Action, calculator, parser, formatter, value mapping; anything that runs without database rows | **Unit test**, no database: inputs → outputs, including empty, null, and boundary values | `tests/Unit/<Class>Test.php` |
| A Handler, a Query that reads rows, a controller endpoint | **Feature test** on a disposable database: response keys and status codes, validation messages, the transaction's writes, and authorization both ways (the allowed role passes, **every other role is rejected** with the spec's status) | `tests/Feature/<Domain>/<Subject>Test.php`, extending the project's disposable-database base class (SubHRMS: `Tests\Feature\DisposableDatabaseTestCase`) |
| A migration: new table, column, index, or changed type | **Schema test**: after the migrations run, the table, columns, and index exist (`Schema::hasTable`, `Schema::hasColumns`, `Schema::getIndexes`) | `tests/Feature/<Domain>/<Table>SchemaTest.php` |
| A bug fix | **Regression test**: the defect's failure scenario as a test. It fails on the old code and passes on the fix | Beside the area's existing tests |

Prefer a unit test whenever the logic can run without the database: it runs everywhere and in milliseconds. Do not restructure production code just to make it unit-testable; that is `/webkit-refactor`'s work.

**Running feature and schema tests.** They migrate a database, so they run only against a disposable `*_test` database; the SubHRMS base class skips itself anywhere else. Never point them at a real database, and never edit `.env` to do it.

1. A `*_test` database already configured → run them.
2. None, and Docker is available → start a throwaway MySQL container, create a `<name>_test` database, pass `DB_*` through the process environment, run the tests, then remove the container. Tables the repository's migrations do not create (other modules' legacy tables) may be stubbed in that throwaway database only; list them in the summary.
3. Neither → the test is written but **not run**: report it as `written, not run — <reason>` with the command that runs it. A skipped test is never reported as passing.

### Frontend

| What changed | Test to add |
| :--- | :--- |
| A util, formatter, reducer, or pure helper | Unit test: inputs → outputs, including empty, null, and boundary values |
| A composable or hook | Test with the HTTP client mocked: the calls it makes (endpoint, payload) and the state it exposes on success, error, and empty |
| An api-layer function | HTTP client mocked: method, URL, payload, and the unwrapping the project's client needs (one client is already unwrapped; a second `.data` is a bug) |
| A component or page | Component test: the states the spec defines (loading, error, empty, data), the main interaction, and role-based visibility |

Test files go where the first existing test sits; with none yet, beside the file under test as `<name>.test.ts` (`.test.tsx` for a React component).

### Setting up a missing frontend runner (one-time, done by the skill)

When a frontend change needs a test and the app has no runner (no `test` script, no runner in `devDependencies`), the skill sets one up first, in that app's own folder and repository, on the work's branch:

| App stack | Runner | Install (dev only) | Config | Script |
| :--- | :--- | :--- | :--- | :--- |
| Vue 3 + Vite | Vitest + Vue Test Utils | `npm install -D vitest @vue/test-utils jsdom` | `vitest.config.ts`: `environment: 'jsdom'`, the Vue plugin, and the same `@` alias as the Vite config. Copy the alias; do not load server-only plugins such as `laravel-vite-plugin`. | `"test": "vitest run"` |
| React + Vite | Vitest + Testing Library | `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom` | Same as Vue with the React plugin, plus a setup file importing `@testing-library/jest-dom/vitest` | `"test": "vitest run"` |
| React Native / Expo | jest-expo + React Native Testing Library | `npx expo install jest-expo jest @types/jest @testing-library/react-native -- --save-dev` | `"jest": { "preset": "jest-expo" }` in `package.json` | `"test": "jest"` |

- **Dev dependencies only.** Never add a runtime dependency, and never change the version of a package already installed. Let the package manager resolve versions (`npx expo install` matches them to the Expo SDK). Use the manager the lock file names.
- **Prove it.** The setup is done when the first real test runs green through the new script.
- **Install fails** (peer conflict, no network): restore `package.json` and the lock file to their previous state, fall back to typecheck / lint / the [changed-files build check](#frontend-build-check-changed-files-only), and list the install as a command for the user. Never leave a half-installed runner.
- Record the setup in the run's summary Notes. It is a one-time change per app; later runs use the runner.

### Running and reporting

- Run the tests you added plus the existing tests of the area you touched (`php artisan test --filter <Name>`, `npm test -- <path>`), along with the project's static checks (`php -l`, typecheck, lint, and the [changed-files build check](#frontend-build-check-changed-files-only)).
- A task or fix is done only when its test passes. One whose test could not run stays not done, with the reason and the command.
- A test that already failed before your change is noted, not fixed.
- Never weaken an assertion, skip, or delete a test to get a green run.

### Frontend build check: changed files only

`npm run build` bundles the **whole** app: on SubHRMS it takes about 4 minutes and needs a 6 GB heap. **Never run it as a routine check.** Check only the files that changed, from the project root:

```bash
node .agents/scripts/check-changed.mjs                       # uncommitted changes (the default)
node .agents/scripts/check-changed.mjs --base origin/master  # everything on the branch
node .agents/scripts/check-changed.mjs <file> [<file> ...]   # the named files
```

It runs each changed file under `resources/` through the project's own Vite config, in about 2 seconds, and fails on what `vite build` fails on for those files: a template, script, or style block that does not compile; an import that does not resolve; a named import the target module does not export. That last check also covers the files that import a changed `.ts`/`.js` module or a deleted file, so a rename that breaks an unchanged caller is caught. Report it as `check-changed: N files clean`.

- A spec, plan, task, or skill step that says `npm run build` (or "builds") is satisfied by this check.
- Run the full build **only** when the user asks for it, or when the change reaches the whole bundle: `vite.config.*`, `package.json` or the lock file, the entry (`main.ts` / `main.js`), or `resources/css/app.css`. On SubHRMS run it as `NODE_OPTIONS=--max-old-space-size=6144 npm run build`; the default heap is OOM-killed.
- Neither this check nor `vite build` checks types. Where the project defines `npm run typecheck`, it still runs.
- The script exits `2` when it cannot run (no `node_modules`, no `vite.config`, not a git repo). Report that with its message; do not fall back to the full build on your own.
