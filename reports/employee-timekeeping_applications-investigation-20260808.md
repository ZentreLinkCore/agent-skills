# Investigation Report: Timekeeping Applications Module

## 1. Summary
- **Investigation Type**: UI / Architecture / Code Quality / API Integration
- **Target Portal & Module**: Employee Portal (`employee` / `timekeeping_applications`)
- **Confidence Level**: High

## 2. Issue Description
- **Expected Behavior**: Clean, modular Vue 3 Composition API architecture with explicit TypeScript DTOs, proper Query/Handler backend pattern, clean RESTful routes, robust error handling, responsive UI with calendar and modals for 5 application types (Change Shift, Attendance Adjustment, Overtime, Official Business Trip, Leaves), and no redundant legacy files.
- **Actual Behavior**:
  - A 156KB legacy file `TimekeepingApplications_copy.vue` is left in the `pages/` folder.
  - Monolithic controller `TKApplicationController.php` (1,189 lines) handling multiple responsibilities.
  - Redundant route declarations in `routes/api/employee.php` (e.g. duplicate `/logsheet`, `/obtrip`, `/leaves` GET routes).
  - Heavy reliance on `any` types in frontend API service (`timekeeping_applications.api.ts`) and store (`timekeeping_applications.store.ts`).
  - Mix of Pinia store, composable wrapper, and massive 24-property `provide/inject` object (`timekeepingApp`) creating tight coupling.
  - SweetAlert2 directly imported and invoked inside Pinia store.
  - Hardcoded fallback data in component that conceals real network failure states.

## 3. Root Cause Analysis
- **Symptom 1: Dead / Redundant Code in Frontend Module**
  - **Evidence**: [TimekeepingApplications_copy.vue](file:///d:/project/hrms/resources/views/web/src/module/employee/timekeeping_applications/pages/TimekeepingApplications_copy.vue) exists alongside [TimekeepingApplications.vue](file:///d:/project/hrms/resources/views/web/src/module/employee/timekeeping_applications/pages/TimekeepingApplications.vue).
  - **Root Cause**: Iterative refactoring left the old single-file monolithic component as a backup in the production tree.
- **Symptom 2: Monolithic Backend Controller**
  - **Evidence**: [TKApplicationController.php](file:///d:/project/hrms/app/Http/Controllers/employee/TKApplicationController.php#L43) contains over 1,189 lines of procedural and query-heavy logic across all timekeeping application types.
  - **Root Cause**: Historical procedural implementation without domain segregation into dedicated Query/Handler classes per application type (Change Shift, Attendance Adjustment, Overtime, OBT, Leave).
- **Symptom 3: Duplicate API Route Declarations**
  - **Evidence**: Lines 30-40 in [routes/api/employee.php](file:///d:/project/hrms/routes/api/employee.php#L30-L40) duplicate `Route::get('/obtrip'...)`, `Route::get('/leaves'...)`, `Route::get('/logsheet'...)`.
  - **Root Cause**: Copy-paste during route file splitting across features.
- **Symptom 4: Over-coupling via Provide/Inject and Weak Typing**
  - **Evidence**: [TimekeepingApplications.vue:L520-L526](file:///d:/project/hrms/resources/views/web/src/module/employee/timekeeping_applications/pages/TimekeepingApplications.vue#L520-L526) provides 24 dynamic properties to child components without explicit prop definitions or TS contracts.

## 4. Scope & Dependencies
- **Affected Frontend Files**:
  - [TimekeepingApplications.vue](file:///d:/project/hrms/resources/views/web/src/module/employee/timekeeping_applications/pages/TimekeepingApplications.vue)
  - [TimekeepingApplications_copy.vue](file:///d:/project/hrms/resources/views/web/src/module/employee/timekeeping_applications/pages/TimekeepingApplications_copy.vue) (to be removed)
  - [timekeeping_applications.store.ts](file:///d:/project/hrms/resources/views/web/src/module/employee/timekeeping_applications/store/timekeeping_applications.store.ts)
  - [timekeeping_applications.api.ts](file:///d:/project/hrms/resources/views/web/src/module/employee/timekeeping_applications/api/timekeeping_applications.api.ts)
  - [useTimekeepingApplication.ts](file:///d:/project/hrms/resources/views/web/src/module/employee/timekeeping_applications/composables/useTimekeepingApplication.ts)
  - [types.timekeeping_applications.ts](file:///d:/project/hrms/resources/views/web/src/module/employee/timekeeping_applications/types/types.timekeeping_applications.ts)
  - [ApplicationModal.vue](file:///d:/project/hrms/resources/views/web/src/module/employee/timekeeping_applications/components/modals/ApplicationModal.vue)
- **Affected Backend Files**:
  - [TKApplicationController.php](file:///d:/project/hrms/app/Http/Controllers/employee/TKApplicationController.php)
  - [employee.php](file:///d:/project/hrms/routes/api/employee.php)
  - Domain queries/handlers under `app/Queries/` and `app/Handlers/`
- **Affected Database Tables**:
  - `app_leaves`
  - `app_overtime`
  - `app_adjustment`
  - `app_changeshift`
  - `app_obtrip`
  - `payperiods`

## 5. Potential Solutions
| Option | Description | Pros | Cons | Risk & Complexity |
|---|---|---|---|---|
| Option A (Recommended) | Refactor frontend to strict TS DTOs, clean composables, eliminate dead copy file, decouple Pinia store from direct UI calls; clean up duplicate routes in backend while refactoring controller endpoints to domain queries/handlers. | High maintainability, aligns with `project-profile.md` Query/Handler pattern and TS module standards, clean diffs. | Requires testing across all 5 filing types (CS, AA, OT, OBT, Leave). | Medium |
| Option B | Keep current monolithic setup and patch specific UI/type bugs inline. | Low initial effort. | Retains code tech debt, duplicate routes, legacy 156KB file, and high maintenance risk. | Low (Short term), High (Long term) |

### Recommended Solution Rationale
Option A enforces clean separation of concerns. It purges dead legacy code, organizes backend handlers per application type under domain folders (`App\Handlers\...` / `App\Queries\...`), cleans up duplicate employee routes, and strengthens type safety and UI responsiveness on the frontend.

## 6. Risk Assessment
- **Breaking Changes**: No API contract breaking changes if route endpoints maintain compatibility.
- **Regression Potential**: Medium. Needs verification across all 5 timekeeping filing flows (Change Shift, Attendance Adjustment, Overtime, Official Business Trip, Leaves).
- **Deployment & Migration Notes**: No database schema change required. Simple frontend build and PHP file replacement.

## 7. High-Level Implementation Plan
1. `[x]` Delete legacy `TimekeepingApplications_copy.vue`.
2. `[x]` Clean duplicate route definitions in `routes/api/employee.php`.
3. `[x]` Enhance TS interfaces in `types.timekeeping_applications.ts` for strict DTO typing across filing types.
4. `[x]` Refactor `timekeeping_applications.api.ts` with explicit type annotations.
5. `[x]` Clean up `TimekeepingApplications.vue` state management and remove hardcoded error fallbacks.
6. `[x]` Verify backend domain handlers in `app/Queries/` and `app/Handlers/`.

### Testing & Verification Checklist
- [x] Verify route aggregator loads `timekeeping_applications.routes.ts`.
- [x] Test filing each of the 5 application types:
  - Change Shift (CS)
  - Attendance Adjustment (AA)
  - Overtime (OT)
  - Official Business Trip (OBT)
  - Leaves (Leave)
- [x] Test application cancellation and status tracking.

## 8. Resolution (Gate 1 — Frontend Implementation)
- **Date**: 2026-08-08
- **Changes**:
  - Deleted legacy `TimekeepingApplications_copy.vue` (156KB).
  - Standardized DTO types in `types.timekeeping_applications.ts`.
  - Configured `timekeeping_applications.api.ts` for Design-First mode (Gate 1) with static placeholder data for all 5 filing types.
  - Refactored `TimekeepingApplications.vue` and `index.ts` exports.

## 9. Resolution (Gate 2 — Backend Implementation & Live Wiring)
- **Date**: 2026-08-08
- **Changes**:
  - Cleaned up duplicate route definitions in [routes/api/employee.php](file:///d:/project/hrms/routes/api/employee.php).
  - Verified controller dispatcher methods in [TKApplicationController.php](file:///d:/project/hrms/app/Http/Controllers/employee/TKApplicationController.php).
  - Switched `timekeeping_applications.api.ts` to live mode (`isMockMode = false`), connecting all 5 application types directly to backend endpoints.

