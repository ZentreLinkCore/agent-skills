# Frontend: `<source-path>` (Vue)

**Applies to `<source-path>` (Vue) only.** Read [frontend.md](./frontend.md) first. Verified stack: Vue 3 `<script setup>` + Composition API, Vue Router, Tailwind CSS, Vite, **TypeScript**. Root: `resources/views/web/src/`; the `@` alias points there.

## 1. Module layout

New features use the TypeScript layout in `resources/views/web/src/module/<portal>/<feature>/`:

```text
<feature>/
├── index.ts                        # public barrel: re-exports composables, api hook, routes
├── route/<feature>.routes.ts       # RouteRecordRaw[] (default export)
├── api/<feature>.api.ts            # use<Feature>Api(): the service layer
├── composables/use<Feature>.ts     # reactive state + actions
├── pages/<Feature>.vue             # main view(s), PascalCase
├── components/                     # sub-components (.vue)
├── utils/<feature>.utils.ts        # feature helpers, when needed
├── types/types.<feature>.ts        # interfaces / DTOs / enums, when the feature has real shapes
└── store/<feature>.store.ts        # Pinia store, ONLY when state is shared across pages
```

- State lives in **composables** by default. Pinia is for shared / global state (auth) and per-feature `store/` files only when state must outlive one page tree. `types/` and `store/` are added on demand.
- **Legacy modules** use `script/useApiRequest.js` + `use<Module>.js`, `webRoute.js`, plain JS. Extending one: match its sibling files. Creating a feature: the TS layout. Mid-migration folders with both: prefer the `.ts` files.

## 2. Routing is auto-aggregated

Each portal's `<portal>/useApiWebRoute.ts` globs every module's route file (`import.meta.glob('./*/route/*.routes.ts', { eager: true })`), so a `route/<feature>.routes.ts` that default-exports `RouteRecordRaw[]` registers itself. **Do not edit the aggregator.**

```ts
import type { RouteRecordRaw } from 'vue-router';
const routes: RouteRecordRaw[] = [
  { path: '<portal>/<feature-kebab>', name: '<portal>_<feature>',
    component: () => import('../pages/<Feature>.vue'), meta: { title: '<Feature Title>' } },
];
export default routes;
```

## 3. HTTP client: import it, it is not global

```ts
import http from '@/app/axios/axiosInstance';

export function use<Feature>Api() {
  return {
    getData: async (params: Record<string, any> = {}): Promise<any> => {
      const response = await http.get('api/<prefix>/<endpoint>', { params });
      return response.data;
    },
  };
}
```

- Interceptors, the auth token, the HTML guard, and 401 / 419 handling are already wired (`axiosInstance` / `axiosInterceptors` / `axiosApiErrors`). Callers get the full `AxiosResponse`: **return `response.data`**.
- Composables import the api hook (`import { use<Feature>Api } from '../api/<feature>.api'`).
- Endpoints are lowercase `api/<prefix>/<...>` with the **URL prefix** from the portal table in [backend.md §3](./backend.md#3-source-path-vue-controllers-validation-routes): `api/timekeeping/...`, never `api/tk/...`.

Barrel (`index.ts`):

```ts
export { use<Feature> } from './composables/use<Feature>';
export { use<Feature>Api } from './api/<feature>.api';
export { default as <feature>Routes } from './route/<feature>.routes';
```

## 4. What already exists

- **Globally registered, use without importing** (`resources/views/web/main.js`): `CSelect`, `Pagination`, `Spinner`, `Loading`, `VDatePicker`, `StatusBadge`, `EmptyState`, `TableSkeleton`. Directives: `v-click-outside`, `v-offcanvas-back`.
- **Import these** (they exist but are not global): `Modal` (`@/src/components/Modal.vue`), `LoadingState`, the `TableSkeleton` variants under `components/`. Anything not in the global list is imported.
- **Shared utils** (`@/src/utils/`): `debounce`, `throttle`, `dateFormatter`, `currency` (`formatCurrency` / `parseCurrency`), `constants`, `theme`, `useFileUpload`, `formatNumberInput`.
- **Shared composables** (`@/src/composables/`): `useLocalStorage`, `useResponsive`, `useCalendar`, `useSidebarLinks`, `useInitialProfile`.

## 5. Vue rules

- `<script setup>` + Composition API, unless the target folder uses the Options API or Vue 2 style.
- Component filenames in **PascalCase**.
- `defineProps` with strict validation; `defineEmits` declared explicitly, event names in kebab-case.
- `<style scoped>` when styling is not Tailwind or a UI framework.
- `ref` by default; `reactive` only to group form data or filter objects; never destructure a reactive object.
- No global event buses: props, emits, or a Pinia store.
- **Tests**: no frontend test runner yet (no `test` script, no Vitest). The first skill that needs one sets up Vitest per [testing.md](./testing.md#setting-up-a-missing-frontend-runner-one-time-done-by-the-skill).
