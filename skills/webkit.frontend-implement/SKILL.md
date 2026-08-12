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

## Phase 0 — Branch Gate (BLOCKING)

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

The current setup is **Vue 3 `<script setup>` + Composition API + Tailwind** (cached in [Project Profile](../../rules/project-profile.md)) — after a quick confirm (see Architecture Discovery Phase), work top-to-bottom. If the project actually uses a different framework, follow that instead; the steps below assume the cached Vue setup:

1. **Does a similar module already exist?** Find the closest `resources/views/web/src/module/<portal>/<feature>/` and mirror its layout exactly. New features use the **TS structure**: `index.ts` barrel + `route/ api/ composables/ pages/ components/` (+ `types/ utils/ store/` when needed). If the closest sibling is still on the **legacy** layout (`script/ webRoute.js`, plain JS), match that folder instead — don't mix conventions within a module.
2. **Does a global component cover the UI need?** (see the global list in the profile) → use it without importing. Else check other modules for a reusable one → import it. Only then build local.
3. **Design-first: hard-code the data source regardless of whether the route exists.** Put static, real-field-name data in `api/<feature>.api.ts` with a `TODO(backend)` comment, so the design can be validated first. Live wiring (`http.get/post("api/<url-prefix>/...")`, minding `timekeeping` ≠ `tk`) is Gate 2's job (`/webkit.backend-implement`) — do it here only if the user explicitly asks to wire live now.
4. **State** → `composables/use<Feature>.ts` with typed `ref`/`reactive`, debounced search (`@/src/utils/debounce`, 300ms), cleanup in `onUnmounted`. Add a Pinia `store/<feature>.store.ts` only when state is shared across pages/components.
5. **Route** → add `route/<feature>.routes.ts` (default-export `RouteRecordRaw[]`, lazy `() => import('../pages/...')`). It is auto-registered by the portal's `useApiWebRoute.ts` glob — do NOT edit the aggregator.
6. **Barrel** → export the feature's surface (composables, api hook, routes) from `index.ts`.
7. **Styling** → Tailwind only, portal accent color for this portal (see UI section), `bg-white dark:bg-slate-800` cards, dark-mode classes on everything.
8. **Table Drag-to-Scroll & ID Formatting** → Wide data tables MUST support mouse drag-to-scroll on their `overflow-x-auto cursor-grab active:cursor-grabbing select-none` container (`@mousedown="startDrag"` with window `mousemove`/`mouseup` tracking). Statutory ID columns (SSS, PhilHealth, Pag-IBIG) MUST be formatted as straight, left-aligned, non-wrapping monospace text (`font-mono text-xs font-bold whitespace-nowrap flex items-center gap-1.5`) with an icon (`shrink-0`).

---

## Architecture Discovery Phase (Follow the Existing Setup)

**Governing rule: follow whatever framework, state solution, and styling the project actually uses right now — never impose a stack of your own.** This skill is framework-aware (Vue, React, Next, Angular, plain JS); it detects what exists and matches it.

To save re-detecting on every run, [Project Profile](../../rules/project-profile.md) records the *cached result* of that detection. **As of the last profile update, detection resolves to:**

| Aspect | Current setup |
|---|---|
| Framework | Vue 3 `<script setup>` + Composition API |
| Folder org | Module-based, per-feature: `module/<portal>/<feature>/{route,api,composables,pages,components}` + `index.ts` barrel (+ `types,utils,store` on demand) |
| Routing | Vue Router; `route/<feature>.routes.ts` (`RouteRecordRaw[]`), auto-aggregated by each portal's `useApiWebRoute.ts` via `import.meta.glob('./*/route/*.routes.ts')` |
| State | Composables (`composables/use<Feature>.ts`); Pinia `store/` only when state is shared across pages |
| API layer | `api/<feature>.api.ts` → `use<Feature>Api()`, `import http from '@/app/axios/axiosInstance'` (imported, not global; returns `AxiosResponse`, so `return response.data`) |
| Styling | Tailwind CSS (+ portal accent colors, dark mode) |
| Files | **TypeScript** (`.ts`) + `.vue` |

> **Mid-migration:** the project is moving JS → TS. Newer modules (most of `hr/`) use the TS structure above; older ones still have the legacy layout (`script/useApiRequest.js` + `use<Module>.js`, `webRoute.js`, plain JS), and some contain both. **Rule of thumb:** new feature → TS structure; extending a legacy module → match that folder's existing files.

The profile is a shortcut, not a lock. Precedence when they disagree:
1. **The target folder / closest sibling module wins.** If it uses a different convention (e.g. an older module on the Options API), match that folder.
2. **If the project genuinely uses a different framework than the profile says** (e.g. you find a React/`.jsx` app, or `package.json` shows `react`/`next`/`@angular`), follow *that* framework's idioms — do not force Vue. Then flag the drift and update the profile so the cache is correct next time.
3. **Only when there's no signal either way** do you fall back to the profile's cached answer (Vue).

The one thing you must NOT do is introduce a framework/state/styling system the project doesn't already use anywhere.

**Quick confirm step** (cheap — do it, don't skip): glance at `package.json` and the target/sibling folder's file extensions to confirm the profile still matches before scaffolding. If it does (the normal case), proceed on the cached answer above without a deeper hunt.

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

### 1. Vue.js Project Pattern (Composition API + `<script setup>` + TypeScript — current standard)

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

### 2. React / Next.js Project Pattern (Functional Hooks + TypeScript/JSX)

```
<module_name>/
├── components/           # React sub-components (.jsx or .tsx)
├── pages/                # Main page components (e.g., <ModuleName>.jsx)
├── hooks/                # React custom hooks (e.g., use<ModuleName>.js)
├── services/             # React API request hooks or client calls (e.g., useApiRequest.ts)
└── routes.js             # Route configurations
```

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
  - **Portal-Specific Accent Colors**: All layout accent classes, welcome banner gradients, button styles (hovers/active borders), and active sidebar link classes MUST be synchronized based on the target portal theme:
    - **Employee**: Amber/Orange (e.g. `bg-amber-600`, `from-amber-700 via-amber-600 to-orange-600`, `active-class="nav-link-active-employee"`)
    - **Manager**: Red (e.g. `bg-red-600`, `from-red-700 via-red-650 to-rose-600`, `active-class="nav-link-active-manager"`)
    - **HR**: Emerald (e.g. `bg-emerald-600`, `from-emerald-700 via-emerald-600 to-teal-600`, `active-class="nav-link-active-hr"`)
    - **Timekeeping**: Blue (e.g. `bg-blue-600`, `from-blue-700 via-blue-600 to-indigo-600`, `active-class="nav-link-active-timekeeping"`)
    - **Payroll**: Cyan (e.g. `bg-cyan-600`, `from-cyan-700 via-cyan-600 to-sky-600`, `active-class="nav-link-active-payroll"`)
    - **Admin**: Slate (e.g. `bg-slate-700`, `from-slate-700 via-slate-600 to-zinc-700`, `active-class="nav-link-active-admin"`)
    Avoid using hardcoded values of other portals unless they represent standard semantic states (e.g., Red for errors/alerts, Emerald for active check-ins, Amber for warnings).
  - Responsive alignment (flex layouts, responsive grids).

### 5. Reusable & Global Components Guideline
The authoritative list of globally-registered components, directives, utils, and composables is in [Project Profile](../../rules/project-profile.md). Do not guess whether something is global — check that list.
- **Prioritize Reuse**: Always check for existing global or cross-module components before writing components locally:
  - **Codebase Search**: grep for pre-existing UI modules or table representations (e.g., `TimesheetTable`, `EmployeeSelector`, `LeavesCredit` panels).
  - **Cross-Module Imports**: If a reusable component is found in another module, import it directly instead of copying its code.
  - **Use WITHOUT importing (globally registered in `main.js`)**: `CSelect` (dropdowns), `Pagination`, `Spinner` / `Loading` (loaders), `VDatePicker`, `StatusBadge` (all state indicators — Active/Inactive, Approved/Pending/Rejected), `EmptyState` (zero-record states), `TableSkeleton` (tabular loading states).
  - **Must be IMPORTED (not global)**: `Modal` from `@/src/components/Modal.vue` — do not write custom backdrop overlays. `LoadingState`, and anything else not in the global list above.
- **Global Utilities**: Leverage shared functions in `@/src/utils/` instead of writing custom inline parsing/formatting logic:
  - `debounce` (from `@/src/utils/debounce`): Debouncing text inputs.
  - `throttle` (from `@/src/utils/throttle`): Throttling fast-firing scroll/resize events.
  - `formatDate`, `daysBetween`, `timeAgo` (from `@/src/utils/dateFormatter`): Managing dates, calculating leave durations, and relative log timestamps.
  - `formatCurrency`, `parseCurrency` (from `@/src/utils/currency`): Formatting currency rates (e.g. PHP `₱12,500.00`) and payroll parsing.
- **Global Composables**:
  - `useLocalStorage` (from `@/src/composables/useLocalStorage`): For persistent reactive state syncing (like saving active tabs, table views, or search filter states).
- **Custom Directives**:
  - `v-click-outside` (registered globally): For closing custom dropdowns, select options, and context menus when clicking outside the bound element. No manual import or registration is needed.
- **Creating New Global Components**: If you are implementing a modular page and realize a component is general-purpose enough to be useful elsewhere (e.g. a custom date range picker, user profile card, file uploader widget), create it inside `resources/views/web/src/components/` (for Web portal) or the corresponding mobile components directory. Make sure to:
  - Follow the styling patterns of other components in that folder.
  - Document its props and usage so other components/pages can easily consume it.

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

Automated Vitest execution is out of scope for this skill for now. Still confirm the following before considering the work done:
1. **Syntax/Lint Check**: The new/edited components and composables have no syntax errors and match the project's linting config if one is detected.
2. **Render Sanity Check**: The new page/component mounts without console errors and the route resolves.
3. **Manual Verification Steps**: Give the user concrete steps to navigate to the new page and confirm the expected UI/behavior, including both light/dark mode if relevant.

---

## Close the Loop

1. **Update the Report (if one was loaded)**: Check off the corresponding item(s) in the report's "High-Level Implementation Plan" checklist (`[ ]` → `[x]`) and append a short "Resolution" note (what was built, and the date) so `.agents/reports/<file>.md` stays current.
2. **Present the design for validation (Gate 1 exit)**: State plainly that the page is built with **hard-coded data** and list which `api/<feature>.api.ts` methods are still stubbed (`TODO(backend)`). Give the user concrete steps to view the page and ask them to confirm the design against the spec — what to **add / adjust / remove** — before any backend work.
3. **Suggested Next Step (Gate 2)**: Once the user is happy with the design, tell them to run `/webkit.backend-implement <target_path> <prompt>` to add the dynamic data (create/verify the tables, queries, handlers, routes per the spec, and replace the hard-coded api methods with live calls). Point to [Git Workflow Standards](../../rules/git-workflow.md) for a Conventional Commit message (e.g. `feat(payroll): add payroll processing page (design)`). Do not stage or commit automatically.
