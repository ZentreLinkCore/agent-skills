---
name: webkit-frontend-implement
description: >
  Generates and implements modular base structure folder and files for frontend modules.
  Detects the target framework (Vue, React, etc.) based on package.json, file extensions, or config files, and scaffolds appropriately.
  Focuses primarily on the frontend UI, setting up pages, components, hooks/composables, and routes.
  ALWAYS connects to existing backend models, tables, and API routes — never creates new database tables or endpoints
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
4. **Load Investigation Report (if referenced)**: If the prompt names or links a report, or `.agents/reports/` has one matching the target module, read it and use its scope/dependency analysis to inform the implementation plan — don't assume this skill has access to an earlier `webkit.investigate` conversation.
5. **Mandatory Architecture Discovery**: Before generating any code or folder, perform the Architecture Discovery step to identify the framework, directories, routing, state, API layer, and style patterns.
6. **Mandatory System Awareness**: Before designing API calls or data shapes, run the scan defined in [System Awareness](../../rules/system-awareness.md) to understand what backend data is already available. The frontend design MUST be driven by existing backend structures where they exist. Never assume a new table is needed without first verifying no existing model satisfies the requirement.
7. **Check for Global & Cross-Module Reusable Components**: Before implementing component files, check if there are global/shared components already defined in the project. Import and reuse these components directly instead of creating duplicate local copies.
8. **Identify Potential Global Components**: If the current feature includes a component that is highly reusable, consider creating it inside the global/shared components directory as a global component and importing/registering it as needed.
9. Generate the complete frontend folder structure and UI views matching the discovered framework, connecting to real or realistic API shapes derived from existing backend models.
10. **Strict Rules Adherence**: The generated code and files must strictly adhere to the guidelines defined in the [.agents/rules/](../../rules/) directory, specifically [Vue.js Standards](../../rules/vue-standards.md), [Naming Convention Standards](../../rules/naming-convention.md), and [UI & Design Standards](../../rules/ui-design.md).

---

## Branch Discipline

Before scaffolding anything, confirm work is happening on a `feature/` branch per [Git Workflow Standards](../../rules/git-workflow.md), not directly on `main`/`master`. If already on a correctly-named branch for this module, continue there instead of creating a new one.

---

## Decision Playbook

The current setup is **Vue 3 `<script setup>` + Composition API + Tailwind** (cached in [Project Profile](../../rules/project-profile.md)) — after a quick confirm (see Architecture Discovery Phase), work top-to-bottom. If the project actually uses a different framework, follow that instead; the steps below assume the cached Vue setup:

1. **Does a similar module already exist?** Find the closest `resources/views/web/src/module/<portal>/<module>/` and mirror its `pages/ components/ script/ webRoute.js` layout exactly.
2. **Does a global component cover the UI need?** (see the global list in the profile) → use it without importing. Else check other modules for a reusable one → import it. Only then build local.
3. **Does the backend route exist?** (System Awareness scan)
   - Yes → `useApiRequest.js` calls `http.get/post("api/<url-prefix>/...")` for real. Mind `timekeeping` ≠ `tk`.
   - No → mock in `useApiRequest.js` with field names from the model's `$fillable`, comment the pending endpoint, and suggest `/webkit.backend-implement` as follow-up.
4. **State** → `use<ModuleName>.js` composable with `ref`/`reactive`, debounced search (`@/src/utils/debounce`, 300ms), cleanup in `onUnmounted`.
5. **Route** → add the module's entry to `webRoute.js` with a lazy `() => import(...)`.
6. **Styling** → Tailwind only, portal accent color for this portal (see UI section), `bg-white dark:bg-slate-800` cards, dark-mode classes on everything.

---

## Architecture Discovery Phase (Follow the Existing Setup)

**Governing rule: follow whatever framework, state solution, and styling the project actually uses right now — never impose a stack of your own.** This skill is framework-aware (Vue, React, Next, Angular, plain JS); it detects what exists and matches it.

To save re-detecting on every run, [Project Profile](../../rules/project-profile.md) records the *cached result* of that detection. **As of the last profile update, detection resolves to:**

| Aspect | Current setup |
|---|---|
| Framework | Vue 3 `<script setup>` + Composition API |
| Folder org | Module-based: `module/<portal>/<module>/{pages,components,script}` + `webRoute.js` |
| Routing | Vue Router, lazy `() => import(...)` in `webRoute.js` |
| State | Plain composables (`use<Module>.js`) — no Pinia/Vuex |
| API layer | `import http from '@/app/axios/axiosInstance'` (imported, not global) |
| Styling | Tailwind CSS (+ portal accent colors, dark mode) |
| Files | JavaScript + `.vue` (not TypeScript) |

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

- **If a matching route already exists**: use it as the API endpoint in `useApiRequest.js`. Do NOT generate a new endpoint unless backend implementation is also being done in the same task.
- **If no matching route exists yet**: this is not a blocker (see [System Awareness](../../rules/system-awareness.md)) — use realistic mock data shaped after the closest existing model's fields, and note in a code comment that the backend endpoint is pending.

> [!CAUTION]
> If you are about to create mock data with field names that do not exist in any model or migration, STOP. Re-scan to find the correct model or ask the user to confirm the new table is intentional.

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

### 1. Vue.js Project Pattern (Composition API + `<script setup>`)

```
<module_name>/
├── components/           # Vue sub-components (.vue)
├── pages/                # Main Vue views/pages (e.g., <ModuleName>.vue)
├── script/               # Composable files and API requests
│   ├── useApiRequest.js  # API request functions utilizing global client
│   └── use<ModuleName>.js # Composable state machine managing filters, lists, and actions
└── webRoute.js           # Route configuration for dynamic route importing
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

### 1. Routes Definition (`webRoute.js` / `routes.js`)
Export a default array or route list for the module's pages.
- **For Vue**:
```javascript
export default [
  {
    path: '<portal_name>/<module_name>',
    name: '<portal_name>_<module_name>',
    component: () => import('@/src/module/<portal_name>/<module_name>/pages/<ModuleName>.vue'),
    meta: { title: '<Module Title>' }
  }
];
```
- **For React**: Export standard React routes matching the project's routing system (e.g. React Router config).

### 2. API Request Layer (`useApiRequest.js`)
Create functions to communicate with the backend. This project's verified conventions ([Project Profile](../../rules/project-profile.md)):
- **Import the HTTP client** — it is NOT globally bound: `import http from '@/app/axios/axiosInstance';`. Interceptors + error handling are already wired inside that instance.
- **Endpoint strings** are lowercase `api/<url-prefix>/<...>` using the **URL prefix** from the profile's portal table. Timekeeping is **`api/timekeeping/...`**, never `api/tk/...`.
- **System Awareness First**: Before writing API functions, run the [System Awareness](../../rules/system-awareness.md) scan. If a matching route already exists in `routes/api.php`, wire the real endpoint directly — no mock.
- **Mock Setup (fallback only)**: Use mock data ONLY when no backend route exists yet. Mock field names MUST match the actual model `$fillable` / migration columns — never invent field names. Add a comment noting the intended endpoint.

Real endpoint (route exists):
```javascript
import http from '@/app/axios/axiosInstance';

export function useApiRequest() {
  return {
    getData: async (params = {}) => {
      const response = await http.get("api/<url-prefix>/<module_endpoint>", { params });
      return response.data;
    },
    saveData: async (payload = {}) => {
      const response = await http.post("api/<url-prefix>/<module_endpoint>/save", payload);
      return response.data;
    }
  };
}
```

Mock fallback (backend route pending — field names mirror `<ModelName>` `$fillable`):
```javascript
export function useApiRequest() {
  return {
    // TODO: replace with http.get("api/<url-prefix>/<module_endpoint>") once the route is registered
    getData: async (params = {}) => ({
      data: [{ id: 1, /* real model columns here */ created_at: '2026-06-19' }],
      total: 1
    })
  };
}
```

### 3. State Management (Vue Composable or React Custom Hook)
Manage reactive states, active filters, loading indicators, and actions:
- **For Vue**: Use Vue's reactive refs and watchers in `use<ModuleName>.js`.
- **For React**: Use custom hook state (`useState`, `useEffect`, `useMemo`) in `hooks/use<ModuleName>.js`.

```javascript
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useApiRequest } from "./useApiRequest";
import { debounce } from "@/src/utils/debounce";

export function use<ModuleName>() {
  const route = useRoute();
  const apiRequest = useApiRequest();

  const isLoading = ref(false);
  const dataList = ref({ data: [] });
  const totalItems = ref(0);
  const isModalOpen = ref(false);

  // Filter States
  const searchQuery = ref('');
  const selectedStatus = ref('');

  // Create a debounced function for fetching data
  const debouncedFetch = debounce((params) => {
    fetchData(params);
  }, 300);

  // Watch search query with debounce to prevent excessive API calls
  watch(searchQuery, (newVal) => {
    debouncedFetch({
      search: newVal,
      status: selectedStatus.value,
      page: 1
    });
  });

  // Watch non-text filters for immediate update
  watch(selectedStatus, (newVal) => {
    fetchData({
      search: searchQuery.value,
      status: newVal,
      page: 1
    });
  });

  async function fetchData(params = {}) {
    isLoading.value = true;
    try {
      const res = await apiRequest.getData(params);
      dataList.value = res.data || { data: [] };
      totalItems.value = res.total || 0;
    } catch (err) {
      console.error(err);
    } finally {
      isLoading.value = false;
    }
  }

  onMounted(() => {
    fetchData({
      page: route.query.page || 1
    });
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
    selectedStatus
  };
}
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
  - **Dynamic Route Importing**: Always dynamic-import page components in route files (`webRoute.js` / `routes.js`) using `() => import(...)`.
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
2. **Suggested Next Step**: If the API layer used mock data because no backend route existed yet (see System Awareness Phase), tell the user to run `/webkit.backend-implement <target_path> <prompt>` next to implement it. Otherwise, point to [Git Workflow Standards](../../rules/git-workflow.md) for a Conventional Commit message (e.g. `feat(hr): add employee masterlist page`). Do not stage or commit automatically.
