# Investigation Report: Employee Details Module Refactoring & Design Modernization

## 1. Summary
- **Investigation Type**: UI Modernization / Architecture / Refactoring / API Cleanup
- **Target Portal & Module**: Employee Portal (`employee/employee-details`)
- **Confidence Level**: High

## 2. Issue Description
- **Expected Behavior**: 
  - `employee_details` should be a clean, modular Vue 3 TypeScript feature (`module/employee/employee_details/`) adhering to HRMS project standards: dedicated API service layer (`api/employee_details.api.ts`), custom reactive composable (`composables/useEmployeeDetails.ts`), strict TypeScript interfaces (`types/employee_details.types.ts`), decoupled subcomponents (`ProfileHeader.vue`, `GeneralInfoCard.vue`, `AssignmentCard.vue`, `CompensationCard.vue`, `BackgroundTabsCard.vue`, `ChangeRequestModal.vue`, `ChangeRequestHistoryModal.vue`, `ProfileImageModal.vue`), and modern glassmorphic/card styling.
  - Backend controller (`ProfileController.php`) should be a thin dispatcher delegating read queries and write operations to dedicated Query and Handler classes (`App\Queries\Employee\...` and `App\Handlers\Employee\...`) adhering to the top-level Query/Handler/Action architecture.
- **Actual Behavior**:
  - `EmployeeDetails.vue` is a single monolithic file of 1,288 lines ([EmployeeDetails.vue:L1-1288](file:///d:/project/hrms/resources/views/web/src/module/employee/employee_details/pages/EmployeeDetails.vue#L1-L1288)).
  - Direct `http` client invocations are made inside `EmployeeDetails.vue` ([EmployeeDetails.vue:L912](file:///d:/project/hrms/resources/views/web/src/module/employee/employee_details/pages/EmployeeDetails.vue#L912), [L996](file:///d:/project/hrms/resources/views/web/src/module/employee/employee_details/pages/EmployeeDetails.vue#L996), [L1173](file:///d:/project/hrms/resources/views/web/src/module/employee/employee_details/pages/EmployeeDetails.vue#L1173)) instead of utilizing a dedicated service layer.
  - Uses jQuery modal controls (`$("#profileImageModal").modal("show")`) ([EmployeeDetails.vue:L1025](file:///d:/project/hrms/resources/views/web/src/module/employee/employee_details/pages/EmployeeDetails.vue#L1025)) and imperative DOM manipulations (`window.toggleRequestContent = ...`) ([EmployeeDetails.vue:L1258](file:///d:/project/hrms/resources/views/web/src/module/employee/employee_details/pages/EmployeeDetails.vue#L1258)) rather than Vue 3 reactive state and standard components.
  - Mixes SweetAlert2 (`Swal.fire`) with PrimeVue `useToast`.
  - Backend controller (`ProfileController.php`) contains 352 lines of inline SQL/Query builder logic, raw transaction logic, document number generation (`CR0001`), hardcoded label mapping, file persistence, and manual logging directly inside the controller ([ProfileController.php:L35-350](file:///d:/project/hrms/app/Http/Controllers/employee/ProfileController.php#L35-L350)).
- **Steps to Reproduce / Audit Findings**:
  1. Inspect `resources/views/web/src/module/employee/employee_details/pages/EmployeeDetails.vue`. Note monolithic 1,288 lines combining 5 modals, personal info, background tables, assignment details, compensation modal, and raw jQuery calls.
  2. Inspect `app/Http/Controllers/employee/ProfileController.php`. Note absence of `App\Queries\Employee\...` and `App\Handlers\Employee\...` delegation.

## 3. Root Cause Analysis
- **Symptom**: Legacy monolithic page design, poor maintainability, jQuery dependencies in Vue 3, fat controller violating project architectural guidelines (`project-profile.md`).
- **Discovered Code/Behavior**:
  - Direct HTTP calls in component: [EmployeeDetails.vue:L912](file:///d:/project/hrms/resources/views/web/src/module/employee/employee_details/pages/EmployeeDetails.vue#L912) (`http.get("api/employee/profileDetails")`)
  - Direct jQuery modal triggers: [EmployeeDetails.vue:L1025](file:///d:/project/hrms/resources/views/web/src/module/employee/employee_details/pages/EmployeeDetails.vue#L1025) (`$("#profileImageModal").modal("show")`)
  - Heavy logic in controller: [ProfileController.php:L35-96](file:///d:/project/hrms/app/Http/Controllers/employee/ProfileController.php#L35-L96) (`ProfileController@index`), [ProfileController.php:L98-259](file:///d:/project/hrms/app/Http/Controllers/employee/ProfileController.php#L98-L259) (`ProfileController@store`)
- **Root Cause**:
  - The module was created as a legacy single-file Vue component and flat controller prior to the standard TS modular layout (`index.ts`, `api/`, `composables/`, `components/`, `types/`) and top-level Query/Handler pattern adopted in `project-profile.md`.

## 4. Scope & Dependencies
- **Affected Frontend Files**:
  - `resources/views/web/src/module/employee/employee_details/index.ts`
  - `resources/views/web/src/module/employee/employee_details/pages/EmployeeDetails.vue`
  - `resources/views/web/src/module/employee/employee_details/route/employee_details.routes.ts`
  - New modular files to scaffold under `resources/views/web/src/module/employee/employee_details/`:
    - `api/employee_details.api.ts`
    - `composables/useEmployeeDetails.ts`
    - `types/employee_details.types.ts`
    - `components/ProfileHeaderCard.vue`
    - `components/GeneralInfoCard.vue`
    - `components/AssignmentCard.vue`
    - `components/CompensationCard.vue`
    - `components/BackgroundTabsCard.vue`
    - `components/modals/ProfileImageModal.vue`
    - `components/modals/CompensationBenefitsModal.vue`
    - `components/modals/ChangeRequestModal.vue`
    - `components/modals/ChangeRequestHistoryModal.vue`
    - `components/modals/DependentsModal.vue`
- **Affected Backend Files**:
  - `app/Http/Controllers/employee/ProfileController.php`
  - `routes/api/employee.php`
  - New Query/Handler classes:
    - `app/Queries/Employee/GetEmployeeProfileQuery.php`
    - `app/Queries/Employee/GetEmployeeBackgroundTableQuery.php`
    - `app/Queries/Employee/GetEmployeeChangeRequestsQuery.php`
    - `app/Handlers/Employee/SubmitChangeRequestHandler.php`
    - `app/Handlers/Employee/UpdateProfileImageHandler.php`
- **Affected Database Views / Tables**:
  - `vw_accounts_details`, `vw_site`, `change_requests`, `trans_logs`, `school_backgrounds`, `work_experiences`, `trainings`, `exams_taken`, `awards`

## 5. Potential Solutions
| Option | Description | Pros | Cons | Risk & Complexity |
|---|---|---|---|---|
| Option A (Recommended) | Full Modular Refactor to TS Standard Layout + Top-level Query/Handler Backend | Clean separation of concerns, DRY compliance, Vue 3 reactive state (no jQuery), typed API layer, thin controller, fully matches `project-profile.md`. | Requires creating modular subcomponents and Query/Handler backend classes. | Medium |
| Option B | Partial UI Refactor only (Keep single `.vue` file and fat controller) | Fast to patch minor bugs. | Retains technical debt, monolithic file, jQuery dependencies, non-compliant controller. | High (Debt) |

### Recommended Solution Rationale
Option A strictly aligns the `employee_details` module with the ground-truth project profile (`project-profile.md`), Vue standards (`vue-standards.md`), and Laravel Query/Handler standards (`laravel-standards.md`). It removes legacy jQuery dependencies, introduces TypeScript types, modularizes the UI into clean subcomponents, and delegates backend logic to testable `App\Queries\Employee\` and `App\Handlers\Employee\` classes.

## 6. Risk Assessment
- **Breaking Changes**: No API contract breaking changes; response payloads remain identical (`{ user, background, leave, allowance, dependents }`).
- **Regression Potential**: Low, provided data field mappings (`vw_accounts_details`) and change request payload structures (`changes`, `remarks`, `file`) are preserved.
- **Deployment & Migration Notes**: No database schema migrations required; existing tables and views are reused.

## 7. High-Level Implementation Plan
1. `[x]` **Backend Refactoring (Gate 2 Completed)**:
   - `[x]` Scaffold `GetEmployeeProfileQuery`, `GetEmployeeBackgroundTableQuery`, `SubmitChangeRequestHandler`, and `UpdateProfileImageHandler` under `App\Queries\Employee\` and `App\Handlers\Employee\`.
   - `[x]` Update `ProfileController.php` to delegate all actions to these classes.
   - `[x]` Swap hard-coded stubs in `api/employee_details.api.ts` for live HTTP endpoints (`/api/employee/profileDetails`, `/api/employee/empOtherDetails`, `/api/employee/uploadProfileImage`).
2. `[x]` **Frontend Modular Scaffolding (Gate 1 Completed)**:
   - `[x]` Create `types/employee_details.types.ts` defining DTO shapes.
   - `[x]` Create `api/employee_details.api.ts` using `@/app/axios/axiosInstance` (Hard-coded data phase).
   - `[x]` Create `composables/useEmployeeDetails.ts` handling reactive state, modal state, and API invocation.
   - `[x]` Scaffold subcomponents under `components/` and `components/modals/`.
   - `[x]` Re-assemble `EmployeeDetails.vue` as a clean container page.
   - `[x]` Re-export module surface from `index.ts`.

### Testing & Verification Checklist
- [ ] Run PHPUnit tests: `vendor/bin/phpunit`
- [ ] Verify profile loading via GET `/api/employee/profileDetails`.
- [ ] Verify background table pagination/search via POST `/api/employee/empOtherDetails`.
- [ ] Verify change request submission via POST `/api/employee/profileDetails`.
- [ ] Verify profile image update/removal via POST `/api/employee/uploadProfileImage`.
