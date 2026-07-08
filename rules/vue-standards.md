# Vue.js Standards

## Purpose
This document defines coding styles, architectural patterns, and quality guidelines for Vue.js frontend development.

## Scope
Applicable to all Vue components (`.vue`), composables, and frontend scripts inside the project.

## Responsibilities
- **AI Agent**: Discovers existing Vue conventions (Options API vs. Composition API, Vue 2 vs. Vue 3, Pinia vs. Vuex, JS vs. TS) before writing code.
- **Developer/User**: Resolves any version-related or library-related build configurations.

## Actionable Rules
1. **Composition API & `<script setup>`**: By default, use Vue 3 `<script setup>` with Composition API unless adjacent files in the target folder implement the Options API or Vue 2 structure.
2. **Naming and Structure**: Use PascalCase for all component filenames (e.g., `CustomTable.vue`). Follow the existing directory structures for pages, sub-components, composables, and routes.
3. **Props and Emits Validation**: Define strict validation rules for all component props using `defineProps`. Explicitly declare emitted events using `defineEmits` in kebab-case.
4. **Scoped Styling**: Always scope CSS rules (`<style scoped>`) when styling is not handled by Tailwind CSS or active UI frameworks.
5. **Backend Field Awareness Before Composable Design**: Before writing any composable (`use<Module>.js`) or API request layer (`useApiRequest.js`), run the scan defined in [System Awareness](./system-awareness.md) to derive accurate data shapes. Use model field names as state variable names and table column names in filter params — never invent field names that don't exist in the backend. Mock data field names MUST match actual model `$fillable` columns, not generic placeholders like `name`, `title`, or `value`, unless those are the real column names. This read-only backend lookup is allowed even though frontend and backend edits stay separated (see [Context Loading](./context-loading.md)).

## Best Practices
- **Standardize Reactivity**: Prefer `ref` for general reactivity. Use `reactive` only for grouping form data or search filter objects. Do not destructure reactive objects directly.
- **Avoid Global Event Buses**: Use standard Vue props, emits, or Pinia/Vuex state stores instead of custom event emitters to manage states across remote parent-child component layers.
- **Mirror Backend Fields**: State variable names in composables should mirror the backend model's `$fillable` keys where possible (e.g., if the model has `issue_type`, the composable filter state should also be `issueType` / `issue_type`, not a renamed alias).

## AI Behavior Expectations
- **Framework Detection**: Inspect dependencies in `package.json` to verify Vue versions, active routing, and state manager models.
- **Incremental Code Updates**: Edit only the specific component tags, script variables, or style lines required. Do not replace entire templates when making minor changes.
- **Model-Driven Composables**: Before generating `useApiRequest.js` or `use<Module>.js`, the agent must read the corresponding Laravel model's `$fillable` and scan `routes/api.php`. The composable's data shapes and endpoint URLs must be grounded in verified backend structures.
