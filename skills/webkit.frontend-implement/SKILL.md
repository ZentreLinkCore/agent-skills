---
name: webkit-frontend-implement
description: >
  Generates and implements modular base structure folder and files for frontend modules.
  SPEC-DRIVEN: when a spec exists under `.agents/specs/`, that spec is the primary source of truth for the layout, components, filters, pagination, types, and API contract.
  DESIGN-FIRST: builds the UI with HARD-CODED / static placeholder data first (no live API calls) so the design can be validated against the spec BEFORE any backend wiring — dynamic data is added later by `/webkit.backend-implement`.
  Detects the target framework (Vue, React, etc.) based on package.json, file extensions, or config files, and scaffolds appropriately.
  Focuses primarily on the frontend UI, setting up pages, components, hooks/composables, and routes.
  ALWAYS aligns to existing backend models, tables, and API routes — never creates new database tables or endpoints
  unless explicitly instructed and confirmed that no existing implementation covers the need.
  Supports dragging folder or file paths into the command to specify the target module.
  Triggered when the user runs the command `/webkit.frontend-implement <target_path> <prompt>` or `/webkit.frontend-implement <prompt>`.
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

**Where the hard-coded data lives:** put it in the `api/<feature>.api.ts` hook so the swap to live calls later is a one-file change. Each method returns static data synchronously (wrapped in a resolved promise) instead of calling `http`.

```typescript
// api/<feature>.api.ts — DESIGN-FIRST: hard-coded data, no live calls yet.
// Field names MUST match the spec's data contract / model $fillable — never invented.
// TODO(backend): /webkit.backend-implement replaces these with http.get/post("api/<url-prefix>/...").
export function use<Feature>Api() {
  return {
    getRoster: async (_params: Record<string, any> = {}): Promise<any> => ({
      period: { period_start: '2026-07-01', period_end: '2026-07-15', tk_process_status: 1 },
      employees: [
        { empid: 'EMP001', fullname: 'Juan Dela Cruz', unit: 'Finance', reg_hrs: 88, ot_hrs: 4, gross_pay: 15000, payroll_status: 'Pending' },
        // …enough rows to exercise pagination + every status the spec defines
      ],
      count: 1,
    }),
  };
}
```

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

## Execution Strategy (Performance Optimized)

The agent MUST minimize workspace scanning and token consumption.

### Search Order
1. Current module directory.
2. Shared global components (`resources/views/web/src/components/` or React components folder).
3. Sibling feature modules.
4. Current portal modules.
5. Entire frontend project (ONLY if explicitly requested).

- **Early Exit**: If a reusable component clearly covers the core requirement, reuse it immediately unless the user explicitly requests a new/separate implementation. Never keep searching for a "better" match once one is found.
- Never scan the entire frontend unless explicitly requested.

---

## Workspace Inspection Budget

To reduce unnecessary token usage, limit the number of files scanned in a single turn.

### Maximum Files to Inspect:
- **Framework Detection**: 5 files
- **Component Discovery**: 20 files
- **Route Discovery**: 5 files
- **API Layer**: 5 files
- **Utility Discovery**: 10 files

If the budget is exceeded:
1. Stop scanning.
2. Use the best matching implementation already discovered.
3. **If nothing was discovered, say so — do not quietly create.** Budget exhaustion means *unknown*, not *nothing exists*. Name what you searched for, record `CREATE — search incomplete` in the Reuse Ledger, and flag it at hand-off so the user can point you at the right file. A truncated search that silently becomes a new component is the exact path this budget must not create.

> The design system is **never** the thing you skip for budget. Reading one components directory and its barrel is a single cheap call, and it prevents the most expensive mistake in this skill.

---

## Context Loading Strategy

Only load context that is required.

### Context Priority
Current file → Current folder → Shared components → Related module → Portal → Entire workspace (explicit request only)

- **Token Protection**: Never load more than 2 full files simultaneously unless performing a merge or refactor operation. Prefer targeted snippets over full-file context whenever possible.
- Never load unrelated modules or inspect backend files when implementing frontend code.
- Never inspect mobile code when implementing web, and vice-versa.

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

## Framework-Agnostic Setup Examples

Adapt the structure, file naming, and coding syntax to the detected project framework:

### 1. SubHRMS — Vue.js Pattern (Composition API + `<script setup>` + TypeScript)

> **Applies to SubHRMS only.** If Phase 0 resolved ScaleUP, skip to §2 — none of the paths below exist there.

```
<feature>/
├── index.ts                        # Public API barrel — re-exports composables, api hook, routes
├── route/<feature>.routes.ts       # RouteRecordRaw[] (default export); auto-registered by the portal glob
├── api/<feature>.api.ts            # use<Feature>Api() — API service layer
├── composables/use<Feature>.ts     # reactive state machine (filters, lists, actions)
├── pages/<Feature>.vue             # main view(s), PascalCase
├── components/                     # Vue sub-components (.vue)
├── types/types.<feature>.ts        # TS interfaces / DTOs / enums (add when the feature has real shapes)
├── utils/<feature>.utils.ts        # feature-specific helpers (add when needed)
└── store/<feature>.store.ts        # Pinia store (add ONLY when state is shared across pages/components)
```

> `types/`, `utils/`, and `store/` are **on-demand** — create them only when the feature needs them (see Folder Generation Rules). Every new feature needs `route/`, `api/`, `composables/`, `pages/`, and `index.ts`.

**Legacy layout** (older modules, plain JS — match it only when extending such a module):
```
<module_name>/
├── components/           # Vue sub-components (.vue)
├── pages/                # Main views (e.g., <ModuleName>.vue)
├── script/               # useApiRequest.js + use<ModuleName>.js
└── webRoute.js           # default-exported route array
```

### 2. ScaleUP — React Pattern (Functional Hooks + TypeScript)

> **Applies to ScaleUP only.** Confirm the exact layout against the **ScaleUP Profile** in [project-profile.md](../../rules/project-profile.md) — it is the source of truth; the sketch below only shows the shape. Note the web root is `resources/views/web/` (**not** `.../web/src/`), and modules are grouped by **domain** — there are no portals.

```text
module/<domain>/
├── index.jsx                     # barrel — exports routes, components, hooks
├── route/<domain>.routes.tsx     # AppRouteObject[]; loaded by the master router
├── useApiWebRoute.ts             # module route aggregator (where the module has one)
├── api/<domain>.api.ts           # use<Domain>Api() service hook
├── pages/                        # route-level components
├── components/                   # sub-components
└── hooks/ context/ guards/       # state, providers, and route guards as needed
```

- **File extensions**: `.tsx` for anything containing JSX, `.ts` otherwise. **New work is TypeScript — do not add new `.jsx`/`.js` files**, even when the sibling files in the module are still `.jsx`.
- **State** is React Context + hooks. There is no Pinia, Redux, or Zustand — do not introduce one.
- **Design system** lives at `src/components/ui/` with a barrel export. Read it before writing any component (see §5).
- **HTTP client** is the `http` wrapper (`@/app/axios/http`), which returns the **already-unwrapped** body — do not add another `.data`. Rejections normalize to `ApiError`; narrow with `isApiError()`.

---

## Frontend Implementation Guidelines

### 1. Routes Definition (`route/<feature>.routes.ts`)
Default-export a typed `RouteRecordRaw[]`. **Do NOT touch the portal aggregator** — `<portal>/useApiWebRoute.ts` globs `./*/route/*.routes.ts` eagerly, so a new route file is auto-registered.
- **For Vue** (TS, current standard):
```typescript
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '<portal_name>/<feature-kebab>',
    name: '<portal_name>_<feature>',
    component: () => import('../pages/<Feature>.vue'), // relative to the feature root
    meta: { title: '<Feature Title>' },
  },
];

export default routes;
```
- **Legacy modules**: keep using `webRoute.js` (default-exported array) if that's what the module already has.
- **For React**: Export standard React routes matching the project's routing system (e.g. React Router config).

### 2. API Service Layer (`api/<feature>.api.ts`)
Create a `use<Feature>Api()` factory returning async methods. This project's verified conventions ([Project Profile](../../rules/project-profile.md)):
- **Import the HTTP client** — it is NOT globally bound: `import http from '@/app/axios/axiosInstance';`. Interceptors, auth-token attach, HTML guard, and 401/419 handling are already wired inside that instance. Methods get the full `AxiosResponse`, so `return response.data`.
- **Composables call the api hook**, never `http` directly.
- **Endpoint strings** are lowercase `api/<url-prefix>/<...>` using the **URL prefix** from the profile's portal table. Timekeeping is **`api/timekeeping/...`**, never `api/tk/...`.
- **System Awareness First**: Before writing API functions, run the [System Awareness](../../rules/system-awareness.md) scan. If a matching route already exists in the portal's route file (`routes/api/<portal>.php`), wire the real endpoint directly — no mock.
- **Mock Setup (fallback only)**: Use mock data ONLY when no backend route exists yet. Mock field names MUST match the actual model `$fillable` / migration columns — never invent field names. Add a comment noting the intended endpoint.

Real endpoint (route exists):
```typescript
import http from '@/app/axios/axiosInstance';

export function use<Feature>Api() {
  return {
    getData: async (params: Record<string, any> = {}): Promise<any> => {
      const response = await http.get('api/<url-prefix>/<endpoint>', { params });
      return response.data;
    },
    saveData: async (payload: Record<string, any> = {}): Promise<any> => {
      const response = await http.post('api/<url-prefix>/<endpoint>/save', payload);
      return response.data;
    },
  };
}
```

Mock fallback (backend route pending — field names mirror `<ModelName>` `$fillable`):
```typescript
export function use<Feature>Api() {
  return {
    // TODO: replace with http.get("api/<url-prefix>/<endpoint>") once the route is registered
    getData: async (_params: Record<string, any> = {}): Promise<any> => ({
      data: [{ id: 1, /* real model columns here */ created_at: '2026-06-19' }],
      total: 1,
    }),
  };
}
```

### 3. State Management (`composables/use<Feature>.ts`)
Manage reactive states, active filters, loading indicators, and actions. Import the api hook from `../api/<feature>.api`. Use a Pinia `store/<feature>.store.ts` only when the state must be shared across multiple pages/components; otherwise keep it in the composable.
- **For Vue**: typed reactive refs and watchers in `composables/use<Feature>.ts`.
- **For React**: Use custom hook state (`useState`, `useEffect`, `useMemo`) in `hooks/use<Feature>.ts`.

```typescript
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { use<Feature>Api } from '../api/<feature>.api';
import { debounce } from '@/src/utils/debounce';

export function use<Feature>() {
  const route = useRoute();
  const api = use<Feature>Api();

  const isLoading = ref(false);
  const dataList = ref<{ data: any[] }>({ data: [] });
  const totalItems = ref(0);
  const isModalOpen = ref(false);

  // Filter states
  const searchQuery = ref('');
  const selectedStatus = ref('');

  const debouncedFetch = debounce((params: Record<string, any>) => {
    fetchData(params);
  }, 300);

  // Debounce text search to avoid excessive API calls
  watch(searchQuery, (newVal) => {
    debouncedFetch({ search: newVal, status: selectedStatus.value, page: 1 });
  });

  // Non-text filters update immediately
  watch(selectedStatus, (newVal) => {
    fetchData({ search: searchQuery.value, status: newVal, page: 1 });
  });

  async function fetchData(params: Record<string, any> = {}) {
    isLoading.value = true;
    try {
      const res = await api.getData(params);
      dataList.value = res.data || { data: [] };
      totalItems.value = res.total || 0;
    } catch (err) {
      console.error(err);
    } finally {
      isLoading.value = false;
    }
  }

  onMounted(() => {
    fetchData({ page: route.query.page || 1 });
  });

  onUnmounted(() => {
    debouncedFetch.cancel();
  });

  return {
    fetchData,
    isLoading,
    dataList,
    totalItems,
    isModalOpen,
    searchQuery,
    selectedStatus,
  };
}
```

### 3b. Public API Barrel (`index.ts`)
Re-export the feature's public surface so other modules import from the feature root, not deep paths:
```typescript
export { use<Feature> } from './composables/use<Feature>';
export { use<Feature>Api } from './api/<feature>.api';
export { default as <feature>Routes } from './route/<feature>.routes';
// export type { ... } from './types/types.<feature>';  // when a types/ file exists
```

### 4. UI Components & Layouts
- **View/Page Files**: Main page files should go in the `pages/` directory (e.g., `pages/<ModuleName>.vue` for Vue, or `pages/<ModuleName>.jsx` / `pages/<ModuleName>.tsx` for React).
- **Framework Standards**: Always use `<script setup>` and composition hooks for Vue. For React, use modern functional components, hooks, and proper type definitions if TypeScript is used.
- **Breadcrumbs**: Include a styled breadcrumb navigation mapping the module path (e.g., `<PORTAL_NAME> / <ModuleName>`).
- **Premium Aesthetics**:
  - Grid & list view toggling with state persistence via `localStorage`.
  - Search inputs with modern icons (like `mdi-magnify`).
  - Loading states using a shared `<LoadingState>` component.
  - Floating action buttons for mobile layouts (`lg:hidden`).
  - **Premium Tailwind gradients, subtle shadows, and borders**: Use premium aesthetics.
  - **Card Background & Border Standard (Dark Mode Pop)**: All layout cards, panel blocks, and table containers must use `bg-white dark:bg-slate-800` backgrounds (rather than `dark:bg-slate-900` which blends flatly into the body background in dark mode), paired with borders using `border-slate-200/60 dark:border-slate-700` and soft shadow styling (e.g., `shadow-sm` or `shadow-md`).
  - **Portal-Specific Accent Colors** *(SubHRMS only — ScaleUP has no portals; use its theme tokens and skip this table)*: All layout accent classes, welcome banner gradients, button styles (hovers/active borders), and active sidebar link classes MUST be synchronized based on the target portal theme:
    - **Employee**: Amber/Orange (e.g. `bg-amber-600`, `from-amber-700 via-amber-600 to-orange-600`, `active-class="nav-link-active-employee"`)
    - **Manager**: Red (e.g. `bg-red-600`, `from-red-700 via-red-650 to-rose-600`, `active-class="nav-link-active-manager"`)
    - **HR**: Emerald (e.g. `bg-emerald-600`, `from-emerald-700 via-emerald-600 to-teal-600`, `active-class="nav-link-active-hr"`)
    - **Timekeeping**: Blue (e.g. `bg-blue-600`, `from-blue-700 via-blue-600 to-indigo-600`, `active-class="nav-link-active-timekeeping"`)
    - **Payroll**: Cyan (e.g. `bg-cyan-600`, `from-cyan-700 via-cyan-600 to-sky-600`, `active-class="nav-link-active-payroll"`)
    - **Admin**: Slate (e.g. `bg-slate-700`, `from-slate-700 via-slate-600 to-zinc-700`, `active-class="nav-link-active-admin"`)
    Avoid using hardcoded values of other portals unless they represent standard semantic states (e.g., Red for errors/alerts, Emerald for active check-ins, Amber for warnings).
  - Responsive alignment (flex layouts, responsive grids).

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

### 6. System Design & Performance Optimization Guidelines
- **Lazy Loading**:
  - **Dynamic Route Importing**: Always dynamic-import page components in route files (`route/<feature>.routes.ts`; legacy `webRoute.js` / `routes.js`) using `() => import(...)`.
  - **Async/Lazy Components**: For large, heavy, or secondary components (e.g., Modals, Charts, rich editors, document viewers), load them asynchronously (Vue: `defineAsyncComponent()`, React: `React.lazy()`) to reduce initial package size.
  - **Images & Media**: Use native `loading="lazy"` on all off-screen images to save network bandwidth and speed up page rendering.
- **Search & Input Optimization (Debouncing/Throttling)**:
  - **Debounced Inputs**: When text input triggers dynamic searches, lists, or suggestions, always apply a debounce (usually 300ms) to wait until the user stops typing before making API calls.
  - **Throttling UI Listeners**: Limit execution frequency of scroll, resize, or drag events using throttling to keep frame rates steady.
- **Resource Management & Memory Leak Prevention**:
  - **Lifecycle Cleanup**: Always clean up timeouts, intervals, resize observers, custom event listeners, and subscriptions inside `onUnmounted` (Vue) or the cleanup function of `useEffect` (React) to avoid memory leaks.
  - **API Request Cancellation**: Cancel pending requests when filters change or when the component unmounts using `AbortController` to avoid race conditions and save network bandwidth.
- **Data Rendering & Computations**:
  - **Pagination**: Implement pagination for lists and grids to avoid high-volume payload rendering issues.
  - **Virtual Scrolling**: Use virtual list rendering for non-paginated lists with hundreds of elements to keep the DOM clean.
  - **Memoization**: Cache heavy values using computed properties (`computed` in Vue) or memoization hooks (`useMemo`, `useCallback` in React) to prevent recalculating on every redraw.

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
