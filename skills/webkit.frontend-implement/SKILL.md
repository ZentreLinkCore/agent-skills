---
name: webkit-frontend-implement
description: >
  Scaffolds and implements a frontend module — pages, components, hooks/composables, routes, api layer.
  DESIGN-FIRST: builds the UI with HARD-CODED data so the design can be validated against the spec BEFORE
  any backend wiring (Gate 1; `/webkit.backend-implement` adds the live data). SPEC-DRIVEN when a spec
  exists under `.agents/specs/`. Detects the project and framework, reuses the existing design system
  instead of duplicating it, and never invents backend fields, tables, or endpoints.
  Triggered by `/webkit.frontend-implement <target_path> <prompt>` or `/webkit.frontend-implement <prompt>`.
---

# Webkit Frontend Implement

This skill coordinates the generation of standard web frontend modules, folders, pages, and components, matching the existing project's architecture, conventions, and style.

---

## Overview

When the user requests to implement or scaffold the frontend structure of a module (e.g., using `/webkit.frontend-implement <target_path> <prompt>` or `/webkit.frontend-implement <prompt>`), the agent must:
1. Check if a folder or file path was dragged/passed into the command.
2. If a path is provided, parse it to extract the `<portal_name>` (e.g., `hr`, `employee`, `manager`, `admin`, `payroll`, `timekeeping`) and `<module_name>`.
3. If no path is provided, dynamically resolve the portal and module names from the prompt text or context.
4. **Load the Spec (PRIMARY SOURCE OF TRUTH — check first)**: Look under `.agents/specs/` (including sub-folders like `.agents/specs/<repo_name>/` e.g. `.agents/specs/scaleup/` or `.agents/specs/subhrms/`) for a spec matching the target module/feature (by filename, title, portal, or the connection point it documents). If one exists, **read it in full and let it drive the implementation** — folder structure, page layout, components, filters, pagination, sorting, TS types, stats, and the API contract all come from the spec. The spec supersedes ad-hoc design guesses; where the spec and a rule in [.agents/rules/](../../rules/) genuinely conflict, follow the rule and note the conflict. If **no** spec exists, proceed from the prompt/report as before.

   **Three spec sections bind this skill specifically** — read them before building, not at review time:
   - **Acceptance Criteria** (`AC-n` Given/When/Then rows) — the frontend owns every row describing rendered state: empty, loading, error, validation messages, disabled controls, per-role visibility. Seed the hard-coded data so **each** such row is visibly exercised in the design.
   - **Non-Functional & Failure-Mode Checklist** — the Authorization row decides what this UI must hide or disable per role; the error-shape row decides what the page renders on failure, not just on success. A design that only draws the happy path fails its own spec.
   - **Definition of Done** — the completion gate. Do not report the design as finished while a DoD box covering UI behavior is unticked.
5. **Load Investigation Report (if referenced)**: If the prompt names or links a report, or `.agents/reports/` has one matching the target module, read it and use its scope/dependency analysis to inform the implementation plan — don't assume this skill has access to an earlier `webkit.investigate` conversation.
6. **Mandatory Architecture Discovery**: Before generating any code or folder, perform the Architecture Discovery step to identify the framework, directories, routing, state, API layer, and style patterns.
7. **Mandatory System Awareness**: Before designing data shapes, run the scan defined in [System Awareness](../../rules/system-awareness.md) so the hard-coded design uses **real field names** (from the spec's data contract and/or existing models). Never invent field names — even for hard-coded placeholder data. Never assume a new table is needed without first verifying no existing model satisfies the requirement.
8. **Design-First (Hard-Coded) Build**: Implement the UI with **hard-coded / static placeholder data only** — no live HTTP calls. This is the default mode of this skill now (see [Design-First (Hard-Coded) Mode](#design-first-hard-coded-mode)). The goal is to render the design so the user can confirm it matches the spec and flag anything to add/adjust **before** any backend work.
9. **Check for Global & Cross-Module Reusable Components**: Before implementing component files, check if there are global/shared components already defined in the project. Import and reuse these components directly instead of creating duplicate local copies.
10. **Identify Potential Global Components**: If the current feature includes a component that is highly reusable, consider creating it inside the global/shared components directory as a global component and importing/registering it as needed.
11. Generate the complete frontend folder structure and UI views matching the discovered framework and the spec, populated with hard-coded data shaped after real model/spec fields.
12. **Strict Rules Adherence**: The generated code and files must strictly adhere to the guidelines defined in the [.agents/rules/](../../rules/) directory, specifically [Vue.js Standards](../../rules/vue-standards.md), [Naming Convention Standards](../../rules/naming-convention.md), and [UI & Design Standards](../../rules/ui-design.md).

---

## Spec-Driven & Design-First — How This Skill Runs Now

The frontend flow has two gates. This skill owns **Gate 1 only**.

```
Spec (.agents/specs/…)  ──►  GATE 1: /webkit.frontend-implement   ──►  user validates design  ──►  GATE 2: /webkit.backend-implement
                              build UI with HARD-CODED data              (add / adjust / OK)          wire dynamic/live data
```

1. **The spec drives the design.** If a spec exists for the target feature, its layout/components/filters/pagination/types/API-contract are the blueprint. Do not redesign around it.
2. **Build hard-coded first.** Render the full design using static placeholder data (see below). No live API. This lets the user confirm the design is correct — what to add, remove, or adjust — cheaply, before any DB/endpoint work.
3. **Hand off to backend.** Only after the user validates the design does `/webkit.backend-implement` run to add dynamic data (replacing the hard-coded values with live calls).

### Design-First (Hard-Coded) Mode

This is the **default** behavior of this skill. Even when the backend route already exists, build the design against hard-coded data first unless the user explicitly says "wire it live now."

**Where the hard-coded data lives:** in the feature's **api layer**, so swapping to live calls later is a one-file change. Each method returns static data wrapped in a resolved promise instead of calling the HTTP client, and carries a `TODO(backend)` comment naming the endpoint it will become.

**Rules for the hard-coded build:**
- **Real field names only.** Shape every placeholder object after the spec's data contract (or the model `$fillable` from the System Awareness scan). Invented fields are a critical error even in mock data.
- **Cover the states the spec defines.** Seed enough rows/variants to visibly exercise pagination, every filter, empty state, and each status badge/branch — so design gaps surface now.
- **Everything else is real.** Composable, filters (debounced search), client/server pagination shape, components, routes, types, styling, dark mode — all built for real per the spec. Only the *data source* is stubbed.
- **Keep the swap trivial.** Composables call the api hook (never inline the mock in the component), so backend wiring only touches `api/<feature>.api.ts`.
- **Flag it clearly.** Leave the `TODO(backend)` comment on each stubbed method and tell the user, at hand-off, exactly which methods are still hard-coded.

### Present the design for validation

After the hard-coded build renders cleanly, explicitly ask the user to review the design against the spec and confirm before any backend work: *what to add, what to adjust, what's missing.* Do **not** proceed to live wiring on your own — that is Gate 2 (`/webkit.backend-implement`).

---

## Phase 0 — Project Gate (BLOCKING)

> [!CAUTION]
> **Resolve which project you are in before you read anything else in this skill.** This workspace holds two projects with different frameworks, folder layouts, HTTP clients, and design systems. Building React work to Vue conventions — or hunting for a component library that belongs to the *other* repo — is the most common failure of this skill, and it does not surface as an error. It surfaces as *"no reusable component exists"*, followed by a hand-built duplicate of a component that was sitting in the design system the whole time.

Run the **[Which Project Am I In?](../../rules/project-profile.md)** resolution at the top of the profile (read `package.json` dependencies), then read **only** that project's sections:

| Resolved | Read | Ignore completely |
| :--- | :--- | :--- |
| **SubHRMS** — `vue`, `pinia`, `vue-router` | the `SubHRMS —` sections of the profile | the ScaleUP Profile |
| **ScaleUP** — `react`, `react-dom`, `react-router-dom` | the **ScaleUP Profile** section at the end of the profile | every `SubHRMS —` section |

**State the resolved project in your first message**, before generating anything.

> [!IMPORTANT]
> **The profile is the source of truth for every project-specific detail** — module layout, the reusable component list, the HTTP client, state solution, routing, file extensions, styling. This skill deliberately does **not** restate them, because a second copy drifts, and a drifted copy is exactly what sends the agent searching for components that do not exist. Any concrete example below that names a framework is an illustration of the *shape* of the work — never a list to go searching for in the other project.

---

## Phase 0.5 — Branch Gate (BLOCKING)

> [!CAUTION]
> **Do not create or edit a single application file until this is done.** Run the [Mandatory Branch Gate](../../rules/git-workflow.md#mandatory-branch-gate-for-implementing-skills) — read the current branch, and if it is `main`/`master`, **create and switch to a `feature/` branch now**. Creating it is compliance with Rule 3, not a decision that needs approval.
>
> This is not "confirm a branch exists". Confirming has repeatedly failed: the agent checks, sees `main`, notes it, and implements anyway. **Create the branch.**

```bash
git rev-parse --abbrev-ref HEAD          # where am I?
git status --short                       # what am I carrying over?
git checkout -b feature/<domain>-<feature-kebab>
```

Already on a correctly-named branch for this work? Continue there — do not open a second one. On a branch for *different* work, or detached HEAD? **Stop and ask.** Then state the branch you are on before writing anything.

Committing remains the user's call. This gate only guarantees the work is isolated and revertible.

---

## Decision Playbook

Work top-to-bottom, against the project resolved in **Phase 0** — not against a remembered stack.

1. **Does a similar module already exist?** Find the closest sibling module **at the path your project's profile section documents**, and mirror its layout exactly. Do not guess the path: SubHRMS nests modules under a *portal* (`module/<portal>/<feature>/`), ScaleUP nests them under a *domain* (`module/<domain>/`) and has **no portals at all**. Searching the wrong shape returns nothing and reads as "there is no sibling to mirror," which is how duplicates get built. If the closest sibling uses an older convention (legacy JS layout, Options API, `.jsx` in a TS module), match that folder rather than mixing conventions inside one module.
2. **Does the design system already cover the UI need?** Open the reusable-component list in **your project's profile section** and check it before writing any component. Do **not** search for component names from memory or from this skill's examples — if the name you are grepping for belongs to the other project, you will find nothing and build a duplicate of a component that already exists. Order: design system → another module's shared component (import it) → only then build local. Record the result in the Reuse Ledger.
3. **Design-first: hard-code the data source regardless of whether the route exists.** Put static, real-field-name data in `api/<feature>.api.ts` with a `TODO(backend)` comment, so the design can be validated first. Live wiring (`http.get/post("api/<url-prefix>/...")`, minding `timekeeping` ≠ `tk`) is Gate 2's job (`/webkit.backend-implement`) — do it here only if the user explicitly asks to wire live now.
4. **State** → the state pattern your project's profile documents (composables, or hooks + context), with debounced search (300ms) from the **shared** debounce helper and cleanup on unmount. Reach for a shared store only when state genuinely spans pages, and only if the project already has one — never introduce a state library.
5. **Route** → add the module route file your project uses, lazily importing the page. Check whether an aggregator picks it up automatically; where it does, **do NOT edit the aggregator**.
6. **Barrel** → export the feature's public surface (state hook/composable, api hook, routes) from the module barrel.
7. **Styling** → Tailwind only, using your project's theme tokens and dark-mode conventions from the profile. *(SubHRMS: per-portal accent colors, see the UI section below. ScaleUP has no portals — use its theme provider's tokens instead.)*
8. **Table Drag-to-Scroll & Statutory ID Formatting** *(SubHRMS/HRMS only — skip entirely in ScaleUP)* → Wide data tables MUST support mouse drag-to-scroll on their `overflow-x-auto cursor-grab active:cursor-grabbing select-none` container (`@mousedown="startDrag"` with window `mousemove`/`mouseup` tracking). Statutory ID columns (SSS, PhilHealth, Pag-IBIG) MUST be formatted as straight, left-aligned, non-wrapping monospace text (`font-mono text-xs font-bold whitespace-nowrap flex items-center gap-1.5`) with an icon (`shrink-0`).

---

## Architecture Discovery Phase (Follow the Existing Setup)

**Governing rule: follow whatever framework, state solution, and styling the project actually uses right now — never impose a stack of your own.** This skill is framework-aware (Vue, React, Next, Angular, plain JS); it detects what exists and matches it.

Phase 0 already resolved **which** project you are in. Now read that project's stack from [Project Profile](../../rules/project-profile.md) and fill in this table from its sections — do not fill it in from memory, and do not carry an answer over from the other project:

| Aspect | Where the answer lives |
|---|---|
| Framework + file extensions | Your project's `Stack` section |
| Folder org (module path, subfolder names) | Your project's frontend-architecture / layout section |
| Routing (route file name, aggregation) | same |
| State (hooks/context, composables, store) | same — **never introduce a state library the project doesn't already use** |
| API layer (client import, unwrapping, error type) | your project's HTTP-client section — the two projects import *different* clients with *different* return shapes |
| Styling + design system location | your project's styling / component sections |

> [!WARNING]
> The two projects differ on every row above, and several differences are silent rather than loud — an HTTP client that already unwraps `response.data` versus one that doesn't produces no error, just `undefined` at render time. Copying a row from the other project is not a style slip; it is a bug.

Precedence when the profile and the code disagree:
1. **The target folder / closest sibling module wins.** If it uses an older convention than the profile documents, match that folder — don't mix conventions inside a module.
2. **The code wins over the profile.** If `package.json` or the file extensions contradict the profile section you're reading, you resolved the wrong project — go back to Phase 0. If the profile is genuinely stale, follow the code, then **flag the drift and offer to update the profile** so the next run is correct.
3. Only when there is no signal either way, ask rather than assume.

The one thing you must NOT do is introduce a framework, state solution, or styling system the project doesn't already use anywhere.

**Quick confirm step** (cheap — do it, don't skip): glance at `package.json` and the target/sibling folder's file extensions to confirm the resolved project before scaffolding.

---

## System Awareness Phase (MANDATORY — Run Before Any Code Generation)

Before generating any API call shapes, mock data, state fields, or UI columns, run the full scan defined in [System Awareness](../../rules/system-awareness.md) (models → migrations → routes). The frontend implementation MUST be driven by existing backend structures where they exist — never design a UI around assumed or fabricated data models.

Once the scan is done, map backend fields to UI directly:

| Backend Field | UI Usage |
|---|---|
| Model `$fillable` or migration columns | Table columns, form fields, filter options |
| `$casts` types | Date pickers, number inputs, toggles |
| Relationship names | Dropdowns, nested panels, linked records |

In **Design-First (Hard-Coded) Mode** (the default), the scan is used to get **field names right**, not to wire endpoints:
- **Whether or not a matching route exists**: seed `api/<feature>.api.ts` with hard-coded data using real field names (from the spec's data contract and/or model `$fillable`), and mark each method `TODO(backend)`. Endpoint wiring is deferred to Gate 2 (`/webkit.backend-implement`).
- **If a matching route already exists** and the user explicitly asks to wire live now: use it as the endpoint in `api/<feature>.api.ts` (legacy modules: `script/useApiRequest.js`). Otherwise leave it hard-coded.

> [!CAUTION]
> If you are about to create hard-coded/mock data with field names that do not exist in the spec's data contract, any model, or any migration, STOP. Re-scan to find the correct fields or ask the user to confirm the new shape is intentional.

---

## Architecture Lock & Folder Generation Rules

### Architecture Lock
- The existing project architecture is always the absolute source of truth.
- **NEVER**: Create a new folder hierarchy, reorganize files, move existing files, introduce a different architecture, or migrate project organizations.
- Always extend the existing architecture. If uncertain, search for adjacent modules to see how they are structured.

### Folder Generation Rules
- Do not generate new subfolders simply because they exist in a standard skill template.
- Only create subfolders when:
  1. The project already uses them.
  2. They are absolutely required.
  3. The user explicitly requests them.
- Otherwise, place new files directly inside the existing project folders.

---

## Existing Module & Pattern Discovery

### Existing Module Discovery
Before creating a new module, search for similar existing modules.
- Identify the folder layout, file naming casing, helper composables, page wrappers, API files, and state handlers of the closest existing module.
- Mirror the existing module implementation. Use the closest existing module as the template.

### Existing Pattern Detection
Before generating, detect the existing styles and code shapes for:
- Component pattern (functional vs. class-based, options vs. composition)
- Page wrapper layouts
- Composable / Hook pattern
- API request pattern
- Form validations and validation wrappers
- Modal / Dialog overlays
- Table grids and lists
- Filter / Search input layouts
- Layout patterns

---

## Search Discipline & Inspection Budget

Search in this order and **stop at the first acceptable match** — never keep hunting for a "better" one:

1. Current module directory
2. **The design system / shared components** — never skipped for budget; it is one cheap read and prevents this skill's most expensive mistake
3. Sibling feature modules
4. Other modules in the same area
5. Entire frontend — only if explicitly requested

**Per-turn budget:** ~5 files for framework/route/api checks, ~20 for component discovery, ~10 for utilities. Load at most 2 full files at once; prefer targeted line ranges. Never inspect backend files beyond the read-only System Awareness scan, unrelated modules, or mobile code during web work.

**When the budget runs out:** stop and use the best match found. **If nothing was found, say so — do not quietly create.** Exhaustion means *unknown*, not *nothing exists*: name what you searched, record `CREATE — search incomplete` in the Reuse Ledger, and flag it at hand-off. A truncated search that silently becomes a new component is exactly what this budget must prevent.

---

## Intelligent Search & Duplication Prevention

### Intelligent Similarity Search
Before creating new files, search by semantic similarity.
Example translation flow for matching:
`EmployeeTable` → `UsersTable` → `MemberTable` → `StaffTable` → `PersonnelTable`

If one already exists, reuse or extend it. Do not generate duplicates.

### Duplicate Prevention
Before creating components, pages, hooks, composables, API files, or utilities, search existing files.
If one exists:
1. Reuse or extend it.
2. Never generate duplicate files or redundant business logic.

### Confidence Evaluation
Before generating code, determine the confidence score:
- **High**: Existing implementation found. Reuse.
- **Medium**: Similar implementation found. Adapt.
- **Low**: No implementation exists. Generate from scratch.

### The Reuse Ledger (MANDATORY)

Everything above has always said "reuse first" — and duplicates still get built. The reason is structural, not a lapse in discipline: **reuse is merely asserted, while creating a file requires no evidence at all.** Nothing records what was searched, so a search that found nothing looks exactly like a search that never ran, and both end the same way — a new file.

Invert the burden, the way `/webkit.verify` does for spec claims: **a new file is a claim that nothing reusable exists, and that claim needs evidence.**

Before creating **any** component, page, hook, composable, util, type, or api file, record one row:

| Artifact | Searched | Found | Decision |
|---|---|---|---|
| `<what you are about to create>` | `<the actual command or glob you ran, including the generic-name variants>` | `<path, or NONE>` | `REUSE` / `EXTEND` / `CREATE — <why nothing fit>` |

- **`CREATE` with no recorded search is a violation**, not a shortcut. If there is no row, the file should not exist.
- **"Found nothing" only counts after searching the generic name.** A row that searched `StatusBadge` but never `Badge`, or `CSelect` but never `Select`, has not established absence — it has established that you searched the other project's vocabulary.
- **A `CREATE` reason must survive review.** *"No existing component supports multi-select"* is a reason. *"None found"* after one literal grep is not.
- **Report the ledger at hand-off.** The user sees, in one table, everything built new and why. That is the moment a wrong `CREATE` costs one line to fix instead of surviving as the module's local convention.

A ledger row costs a sentence. A duplicated component is permanent — the next agent reads it as the established pattern and copies it again.

---

## Technology Stack & Styling Detection

### API Layer Detection
Before creating API requests, detect the existing API integration layer (Axios instance, fetch wrapper, TanStack Query, custom hooks, or raw composables).
- Reuse the detected client. Do not introduce a new API request abstraction.

### State Management Detection
Detect the existing state management library (Pinia, Vuex, Redux, Zustand, or Context API).
- Continue using the detected state solution. Never introduce another state library.

### Styling Detection
Detect the existing UI/CSS styling solution (Tailwind CSS, Bootstrap, PrimeVue, Vuetify, MUI, Ant Design, CSS Modules, or SCSS).
- Use only the detected styling approach. Never mix UI libraries or introduce new visual systems unless requested.

---

## Path Parsing Rules (Dragged Folder / File Support)

If a path parameter is passed in the command (e.g. `/webkit.frontend-implement @[/Users/.../web/src/module/hr/employees] <prompt>`):
- **Extract Portal Name**: Identify the folder segment immediately following `resources/views/web/src/module/` (e.g., `hr`, `admin`, `employee`, `manager`, `payroll`, `timekeeping`).
- **Extract Module Name**: Identify the next folder segment (e.g., `employees`, `sick_leave_monitoring`).
- **Sub-folder resolution**: If the path points to a component, page, or script inside a module (e.g., `.../module/hr/employees/components`), traverse upwards to resolve the module directory name (`employees`) and the portal name (`hr`).

---

## Module Layout

**The exact folder layout is project-specific — read it from [Project Profile](../../rules/project-profile.md)**, not from memory. SubHRMS nests modules under a *portal*; ScaleUP nests them under a *domain* and has no portals, with the web root at `resources/views/web/` (not `.../web/src/`).

Rules that hold in both:

- Every feature needs routes, an api layer, state, pages, and a barrel. `types/`, `utils/`, and `store/` are **on demand** — create them only when the feature needs them.
- **Match the closest sibling module exactly.** If it uses an older convention than the profile documents, follow the folder, not the profile — never mix conventions inside one module.
- **New work is TypeScript** where the project has adopted it — `.tsx` for anything containing JSX, `.ts` otherwise. Do not add new `.jsx`/`.js` files even when the sibling files are still `.jsx`.

---

## Frontend Implementation Guidelines

### 1–3. Routes, API Layer, State, Barrel

**The concrete shape of these four files is project-specific and lives in [Project Profile](../../rules/project-profile.md)** — route file name and export type, the HTTP client to import and whether it unwraps `response.data`, hooks vs composables, barrel contents. Read your project's section rather than a template here; a template in this file is a copy that goes stale, which is how the wrong client and the wrong folder shape get used.

What holds regardless of project:

- **Routes** — lazily import the page (`() => import(...)`). If an aggregator auto-registers module route files, **do not edit the aggregator**.
- **API layer** — one `use<Feature>Api()` factory of async methods. **Import the client the profile names**; do not construct a new axios instance, and do not add a second `.data` to a client that already unwraps. Endpoint strings come from the real registered route (verify it), never from a guess.
- **State** — pages and components call the state hook/composable; **the state layer calls the api hook; nothing calls the HTTP client directly.** Debounce text-search inputs at 300ms using the shared helper, and clean up timers/listeners/subscriptions on unmount. Add a shared store only if the project already has one and the state truly spans pages.
- **Barrel** — re-export the feature's public surface (state hook, api hook, routes) so consumers import from the module root, not deep paths.
- **Types** — mirror real backend field names from the System Awareness scan. Never invent a field, even in placeholder data.

### 4. UI Components & Layouts

- **Pages** go in `pages/`, sub-components in `components/`, using the project's component style (`<script setup>` for Vue; functional components + hooks for React).
- **Cards, panels, and table containers**: `bg-white dark:bg-slate-800` with `border-slate-200/60 dark:border-slate-700` and a soft shadow. Avoid `dark:bg-slate-900` — it flattens into the body background in dark mode.
- **Dark mode on everything.** Every color class needs its `dark:` counterpart.
- **Accent colors are project-specific.** SubHRMS uses per-portal accents (the full table is in [ui-design.md](../../rules/ui-design.md)); ScaleUP has no portals — use its theme tokens. Do not hardcode another portal's color except for semantic states (red = error, amber = warning).
- **Expected polish**: breadcrumbs, responsive grids, `localStorage`-persisted view toggles, shared loading/empty states (from the design system — not hand-rolled), and mobile floating actions.

### 5. Reusable & Global Components Guideline

> [!CAUTION]
> **Never search for a component by a name you remember.** The two projects have entirely different design systems, and a name from the wrong one returns zero results — which reads as *"nothing reusable exists"* and produces a hand-built duplicate of a component that was already there. **List the design-system directory and read its barrel export before writing any component.** That takes one command and is the single highest-value step in this skill.

**How to find what already exists** — in this order, always:

1. **The design system.** Open the components directory your project's profile section documents and read its barrel/index export. That is the authoritative inventory — not this skill, not memory. Anything in it is reused, never rebuilt.
2. **Registration style.** Check how your project consumes them: globally registered (use without importing) or explicitly imported from a barrel. Using the wrong style produces an unresolved-component error, not a duplicate — noisy, and quick to fix.
3. **Cross-module components.** Grep sibling modules for a component solving the same job; import it rather than copying it.
4. **Shared utilities, hooks, and composables.** Before writing inline formatting, debouncing, date, currency, or storage logic, check the shared utils/hooks location in the profile. Re-implementing a shared helper inline is the same defect as duplicating a component, and it is easier to miss in review.

**Semantic search, not literal search.** A component solving your problem is often named for a different domain. Translate before concluding nothing exists: `EmployeeTable` → `UsersTable` → `MemberTable` → `DataTable` → `Table`; `StatusBadge` → `Badge` → `Chip` → `Tag`; `CSelect` → `Select` → `Dropdown` → `Combobox`. Search the **generic** name too — design systems name things generically.

**Primitives count.** A raw `<button>`, `<input>`, `<select>`, `<table>`, or a hand-rolled modal backdrop in a page file is a reuse failure whenever the design system ships that primitive — even though nothing errors and the page looks fine. If you are about to write one, check the design system first and record the check in the Reuse Ledger.

- **Creating a new shared component**: if a component is general-purpose enough to be useful elsewhere (date-range picker, profile card, file uploader), create it in the shared components directory your profile documents rather than locally. Follow the styling patterns of the components already in that folder, and document its props so others can consume it.

### 6. Performance

Full detail in [performance.md](../../rules/performance.md). Non-negotiable here:

- **Lazy-load** route pages (`() => import(...)`) and heavy secondary components (modals, charts, editors). `loading="lazy"` on off-screen images.
- **Debounce** text inputs that trigger requests (300ms) using the shared helper; throttle scroll/resize.
- **Clean up** timers, intervals, observers, listeners, and subscriptions on unmount. Cancel in-flight requests when filters change.
- **Paginate** lists; memoize derived values rather than recomputing per render.

---

## Incremental Generation & Updates

Before modifying any existing frontend files:
- Verify if the target file exists.
- If it exists, update only the missing blocks or inject new handlers. Never overwrite working UI layouts or complete page modules.
- **Preserve**: Existing business logic, custom layout setups, developer comments, formatting styles, and file imports.
- Generate only the missing pieces to keep modifications minimal.

---

## Verification (Lightweight)

Automated JS test execution is out of scope for this skill for now (and ScaleUP configures no test runner at all). Still confirm the following before considering the work done:
1. **Syntax/Lint Check**: The new/edited components and state files have no syntax errors and match the project's linting config if one is detected. Where the project enforces TypeScript, run its typecheck script — do not reference a test runner the project doesn't have.
2. **Render Sanity Check**: The new page/component mounts without console errors and the route resolves.
3. **Acceptance Criteria walk (when the spec has them)**: Go through the `AC-n` rows that describe UI state and confirm each is *visibly reachable* in the hard-coded design — empty, error, validation, and per-role variants included. List any row the design cannot yet exercise; that is a design gap to settle now, while it is still cheap.
4. **Definition of Done**: Tick the DoD boxes this gate owns, and name the ones that remain for `/webkit.backend-implement`.
5. **Manual Verification Steps**: Give the user concrete steps to navigate to the new page and confirm the expected UI/behavior, including both light/dark mode if relevant.

---

## Close the Loop

1. **Update the Report (if one was loaded)**: Check off the corresponding item(s) in the report's "High-Level Implementation Plan" checklist (`[ ]` → `[x]`) and append a short "Resolution" note (what was built, and the date) so `.agents/reports/<file>.md` stays current.
2. **Report the Reuse Ledger**: Print the ledger table — every artifact you created new, what you searched, and why nothing fit. If you reused or extended existing components, say which. This is the user's cheapest opportunity to catch a duplicate before it becomes the module's convention.
3. **Present the design for validation (Gate 1 exit)**: State plainly that the page is built with **hard-coded data** and list which api methods are still stubbed (`TODO(backend)`). Give the user concrete steps to view the page and ask them to confirm the design against the spec — what to **add / adjust / remove** — before any backend work.
4. **Suggested Next Step (Gate 2)**: Once the user is happy with the design, tell them to run `/webkit.backend-implement <target_path> <prompt>` to add the dynamic data (create/verify the tables, queries, handlers, routes per the spec, and replace the hard-coded api methods with live calls). Point to [Git Workflow Standards](../../rules/git-workflow.md) for a Conventional Commit message (e.g. `feat(payroll): add payroll processing page (design)`). Do not stage or commit automatically.
