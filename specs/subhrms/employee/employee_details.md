# Spec — Employee Details Module Modernization & Refactoring

> **Kind:** Extension & Architecture Refactoring — Modernizing legacy single-file profile component and fat controller into a clean modular TypeScript frontend and top-level Query/Handler backend.
> **Portal:** **Employee** (`/api/employee/...` routes, `employee_details` frontend module).
> **Route:** `/employee/employee-details` (`employee_employee_details`).
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [ui-design.md](../../rules/ui-design.md), [vue-standards.md](../../rules/vue-standards.md), [laravel-standards.md](../../rules/laravel-standards.md), [hrms-rules.md](../../rules/hrms-rules.md).
> **System Awareness:** Models reused (`Account`, `ChangeRequest`, `TransLog`, `SchoolBackground`, `WorkExperience`, `TrainingModel`, `ExamsTakenModel`, `Awards`, `Unit`); Tables/Views reused (`vw_accounts_details`, `vw_site`, `change_requests`, `trans_logs`); Routes reused (`api/employee/profileDetails`, `api/employee/empOtherDetails`, `api/employee/uploadProfileImage`); New migration: **No**.

---

## 1. Purpose

The `employee_details` module provides employees with a comprehensive view of their profile information: personal details, contact numbers, government IDs, background details (education, work experience, trainings, exams, awards), job assignment, leave entitlements, and compensation/benefits summary. It also enables employees to apply for profile data change requests (with file attachments) and upload/remove their profile picture.

This specification defines the architectural refactoring and visual design modernization of the `employee_details` module to conform strictly to the ground-truth project standards ([project-profile.md](../../rules/project-profile.md)).

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Component & Modal Architecture

**Option A — Decompose into Modular Subcomponents with Vue 3 Teleport Modals (Recommended)**
- Decompose the single 1,288-line `EmployeeDetails.vue` file into focused subcomponents:
  - `ProfileHeaderCard.vue` (Header profile picture, banner, full name, position, action buttons)
  - `GeneralInfoCard.vue` (Personal details, contact information, government ID numbers)
  - `AssignmentCard.vue` (Job information, company & site location details)
  - `CompensationCard.vue` (Leave entitlement accordions, view benefits button)
  - `BackgroundTabsCard.vue` (Educational background, work experience, trainings, exams, awards)
  - `components/modals/` (`ProfileImageModal.vue`, `CompensationBenefitsModal.vue`, `ChangeRequestModal.vue`, `ChangeRequestHistoryModal.vue`, `DependentsModal.vue`)
- Replace legacy jQuery modal triggers (`$("#modal").modal("show")`) with standard Vue 3 props/emits and Teleport dialogs.

| Pros | Cons |
|---|---|
| Eliminates monolithic file, dramatically improves maintainability & readability. | Requires creating 10+ smaller subcomponent files. |
| Reusable, testable components with clear prop contracts. | |
| Removes legacy jQuery dependencies (`$`) from Vue 3 application. | |

**Option B — Keep Single Component File with Inline Templates**
- Retain all template HTML and modals inside `EmployeeDetails.vue`.

| Pros | Cons |
|---|---|
| Single file to inspect. | Extremely difficult to maintain, test, or debug (1,200+ lines). |
| | Violates [vue-standards.md](../../rules/vue-standards.md) component scoping rules. |

**Recommendation:** **Option A**. Decomposing into subcomponents eliminates legacy debt, removes jQuery runtime coupling, and brings the frontend into full alignment with standard Vue 3 Composition API practices.

---

### Decision 2: Frontend State Management & API Layer

**Option A — Dedicated Composable (`useEmployeeDetails.ts`), API Hook (`useEmployeeDetailsApi.ts`), and DTO Types (`employee_details.types.ts`) (Recommended)**
- Create `types/employee_details.types.ts` defining strong interfaces (`UserProfile`, `BackgroundItem`, `LeaveEntitlement`, `AllowanceItem`, `ChangeRequestPayload`, `ChangeRequestItem`).
- Create `api/employee_details.api.ts` wrapping `@/app/axios/axiosInstance`.
- Create `composables/useEmployeeDetails.ts` holding reactive state, table pagination helpers, modal visibility refs, and profile action methods.

| Pros | Cons |
|---|---|
| Full TypeScript type safety across API calls, composables, and components. | Scaffolds 3 helper files (`types/`, `api/`, `composables/`). |
| Decouples UI presentation from HTTP fetching logic. | |
| Consistent pattern with all modernized modules in the codebase. | |

**Option B — Inline Direct Axios Calls in Component**
- Keep direct `http.get` / `http.post` calls inside `<script setup>` in the page component.

| Pros | Cons |
|---|---|
| Fewer files. | Untyped `any` data, code duplication, untestable logic. |

**Recommendation:** **Option A**. Follows `project-profile.md` modular structure standard (`api/`, `composables/`, `types/`, `components/`).

---

### Decision 3: Backend Architecture — Top-Level Query/Handler Delegation

**Option A — Delegate Controller Logic to Top-Level Query and Handler Classes (Recommended)**
- Create `App\Queries\Employee\GetEmployeeProfileQuery` to fetch `vw_accounts_details`, unit, site info, formatted position/job level text, leave entitlement, allowances, and initial background summaries.
- Create `App\Queries\Employee\GetEmployeeBackgroundTableQuery` for paginated/filtered background table data.
- Create `App\Handlers\Employee\SubmitChangeRequestHandler` to encapsulate change request validation, pending request checks, document number generation (`CR0001`), file storage, DB creation, and TransLog logging inside a `DB::transaction`.
- Create `App\Handlers\Employee\UpdateProfileImageHandler` to manage image file upload/removal, public path persistence, DB update, and TransLog logging.
- Refactor `ProfileController.php` to a thin dispatcher.

| Pros | Cons |
|---|---|
| Strictly complies with [project-profile.md](../../rules/project-profile.md) Query/Handler architecture. | Scaffolds 4 new Query/Handler classes. |
| Thin controller (~40 lines total). | |
| Highly testable business logic isolated from HTTP concerns. | |

**Option B — Retain Logic inside `ProfileController.php`**
- Keep 352 lines of inline queries and transactions inside `ProfileController.php`.

| Pros | Cons |
|---|---|
| No new backend files. | Fat controller, difficult to test, violates project architecture guidelines. |

**Recommendation:** **Option A**. Fully aligns backend code with the project's canonical Query/Handler pattern.

---

## 3. Database

### Reused Views & Tables
- **`vw_accounts_details`** (View): Main source of truth for employee profile fields (`empid`, `lname`, `fname`, `mname`, `fullname`, `salutation`, `nickname`, `gender`, `birth_place`, `bdate`, `civil_status`, `dependents`, `profile`, `spouse`, `nationality`, `religion`, `bloodtype`, `height`, `weight`, `wshift`, `laborid`, `wshifttype_id`, `hire_date`, `email`, `contact_number`, `emergency_name`, `emergency_number`, `tin_no`, `bank_acc_no`, `sss_no`, `prc_licence`, `hdmf_no`, `driver_licence`, `philhealth_no`, `passport`, `site`, `salary`, `idpaygrp`, `daysmonth`, `pos_id`, `idlvl`, `unit_id`, `emptype_id`, `address`, `status`, `id`, `addr_street`, `addr_area`, `addr_city`, `addr_prov`, `addr_code`).
- **`vw_site`** (View): Company site info (`name`, `regDesc`, `provDesc`, `citymunDesc`).
- **`change_requests`** (Table): Stores change request records (`docnumber`, `created_by`, `old_data`, `new_data`, `approvers`, `status`, `date_approve`, `remarks`, `file`).
- **`trans_logs`** (Table): Audit trail for change request submissions and profile image changes.
- **`school_backgrounds`**, **`work_experiences`**, **`trainings`**, **`exams_taken`**, **`awards`** (Tables): Reused for background tables.

*No new migrations or schema changes are needed.*

---

## 4. Backend

### 1. Queries (`app/Queries/Employee/`)

- **`GetEmployeeProfileQuery.php`** (`App\Queries\Employee\GetEmployeeProfileQuery`):
  - Signature: `public static function execute($userId = null)`
  - Fetches employee profile from `vw_accounts_details`, resolves unit head via `Unit::head($user->unit_id)`, maps filter texts (`position`, `joblevel`, `classification`, `employee_type`, `nationalityname`, `paygroupname`, `laborname`, `shifttypename`), fetches initial background summaries, leave entitlements via `HandleAccountLeave::getLeaves(...)`, and allowances via `HandleEmployeeAllowance::getAllowances(...)`.
  - Returns `['user' => $user, 'background' => $background, 'leave' => $leave, 'allowance' => $allowance, 'dependents' => $dependents]`.

- **`GetEmployeeBackgroundTableQuery.php`** (`App\Queries\Employee\GetEmployeeBackgroundTableQuery`):
  - Signature: `public static function execute($params = [])`
  - Routes to existing background helpers based on `$params['type']`: `educational_background`, `employment_history`, `trainings_taken`, `exams_taken`, `awards`, `change_req`.
  - Returns `['dataTable' => $dataTable]`.

### 2. Handlers (`app/Handlers/Employee/`)

- **`SubmitChangeRequestHandler.php`** (`App\Handlers\Employee\SubmitChangeRequestHandler`):
  - Signature: `public static function execute($request)`
  - Checks for pending change requests (`status == 0`). If present, throws `ValidationException` (HTTP 422).
  - Inside `DB::transaction()`:
    - Generates next document number (`CR0001`).
    - Handles file attachment persistence to `public_path('assets/documents/activity_events')`.
    - Parses changes payload, maps `old_data` vs `new_data` with field labels.
    - Resolves HR approver IDs (`access_type_id == 4`).
    - Creates `ChangeRequest` record.
    - Logs audit record via `TransLog::logAction(...)`.

- **`UpdateProfileImageHandler.php`** (`App\Handlers\Employee\UpdateProfileImageHandler`):
  - Signature: `public static function execute($request)`
  - Handles profile image removal or upload (PNG, JPG, JPEG, WEBP; max 5MB).
  - Updates `Account::find(Auth::id())->pic`.
  - Logs action to `TransLog`.

### 3. Controller (`app/Http/Controllers/employee/ProfileController.php`)

Thin dispatcher implementation:
```php
namespace App\Http\Controllers\employee;

use App\Http\Controllers\Controller;
use App\Queries\Employee\GetEmployeeProfileQuery;
use App\Queries\Employee\GetEmployeeBackgroundTableQuery;
use App\Handlers\Employee\SubmitChangeRequestHandler;
use App\Handlers\Employee\UpdateProfileImageHandler;
use App\Http\Requests\StoreChangeRequest;
use Illuminate\Http\Request;
use Exception;

class ProfileController extends Controller
{
    public function index(Request $request)
    {
        try {
            $data = GetEmployeeProfileQuery::execute();
            return response()->json($data);
        } catch (Exception $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    public function store(StoreChangeRequest $request)
    {
        try {
            $result = SubmitChangeRequestHandler::execute($request);
            return response()->json($result);
        } catch (Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function fetchTableData(Request $request)
    {
        try {
            $data = GetEmployeeBackgroundTableQuery::execute($request->all());
            return response()->json($data);
        } catch (Exception $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    public function updateProfileImage(StoreChangeRequest $request)
    {
        try {
            $result = UpdateProfileImageHandler::execute($request);
            return response()->json($result);
        } catch (Exception $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }
}
```

### 4. Routes (`routes/api/employee.php`)

Reuses existing route definitions:
```php
Route::get('/profileDetails', [ProfileController::class, 'index']);
Route::post('/profileDetails', [ProfileController::class, 'store']);
Route::post('/empOtherDetails', [ProfileController::class, 'fetchTableData']);
Route::post('/uploadProfileImage', [ProfileController::class, 'updateProfileImage']);
```

---

## 5. Frontend

### Module File Layout
`resources/views/web/src/module/employee/employee_details/`:
```
employee_details/
├── index.ts
├── route/
│   └── employee_details.routes.ts
├── api/
│   └── employee_details.api.ts
├── composables/
│   └── useEmployeeDetails.ts
├── types/
│   └── employee_details.types.ts
├── pages/
│   └── EmployeeDetails.vue
└── components/
    ├── ProfileHeaderCard.vue
    ├── GeneralInfoCard.vue
    ├── AssignmentCard.vue
    ├── CompensationCard.vue
    ├── BackgroundTabsCard.vue
    └── modals/
        ├── ProfileImageModal.vue
        ├── CompensationBenefitsModal.vue
        ├── ChangeRequestModal.vue
        ├── ChangeRequestHistoryModal.vue
        └── DependentsModal.vue
```

### API Contract (`api/employee_details.api.ts`)
```ts
import http from '@/app/axios/axiosInstance';
import type { EmployeeProfileResponse, ChangeRequestPayload } from '../types/employee_details.types';

export function useEmployeeDetailsApi() {
  return {
    getProfile: async (): Promise<EmployeeProfileResponse> => {
      const res = await http.get('api/employee/profileDetails');
      return res.data;
    },
    fetchTableData: async (params: Record<string, any>): Promise<any> => {
      const res = await http.post('api/employee/empOtherDetails', params);
      return res.data;
    },
    submitChangeRequest: async (formData: FormData): Promise<any> => {
      const res = await http.post('api/employee/profileDetails', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    updateProfileImage: async (formData: FormData | { remove: boolean }): Promise<any> => {
      const res = await http.post('api/employee/uploadProfileImage', formData);
      return res.data;
    },
  };
}
```

### Modern Visual Styling Standards
- **Header Banner**: Vibrant indigo/slate gradient with responsive profile avatar container, glassmorphism badges, camera overlay on hover, and modern button groups.
- **Card Containers**: Sleek rounded cards (`rounded-2xl shadow-sm border border-slate-200/80`), dark-mode compatible CSS tokens.
- **Badge Styling**: Soft subtle badges (`bg-emerald-500/10 text-emerald-600`, `bg-amber-500/10 text-amber-600`, `bg-rose-500/10 text-rose-600`).
- **Typography**: Inter / Outfit fonts, clear font hierarchy (`text-xs uppercase tracking-wider font-semibold text-slate-400`).

---

## 6. Business Rules & Edge Cases

| Rule / Edge Case | Business Rule Definition | System Handling |
|---|---|---|
| Single Pending Change Request | An employee can only have **1 pending change request** (`status == 0`) at a time. | `SubmitChangeRequestHandler` checks existing pending CRs; returns HTTP 422 if present. |
| Auto-Document Numbering | Change request doc number follows sequence `CR0001`, `CR0002`, ... | Regex matches highest `CR\d+` docnumber in `change_requests` table and increments. |
| Change Request File Attachment | File attachment is mandatory for change requests. | Frontend validates `file` input before submit; Handler stores file under `assets/documents/activity_events`. |
| Profile Image Constraints | Allowed formats: PNG, JPG, JPEG, WEBP. Max file size: 5MB. | Validated on frontend before upload; Handler validates file upload and updates `pic` column in `accounts`. |
| Soft Delete / Status Handling | Resigned / Inactive status mapped cleanly. | `status=3` -> Resigned, `status=2` -> Inactive, default -> Active. |

---

## 7. Build Order

### Gate 1: Frontend Implementation (Hard-Coded / Static Placeholder Phase)
1. `[ ]` Scaffold TS types in `types/employee_details.types.ts`.
2. `[ ]` Scaffold API service layer in `api/employee_details.api.ts`.
3. `[ ]` Scaffold reactive composable in `composables/useEmployeeDetails.ts`.
4. `[ ]` Scaffold subcomponents (`ProfileHeaderCard.vue`, `GeneralInfoCard.vue`, `AssignmentCard.vue`, `CompensationCard.vue`, `BackgroundTabsCard.vue`, `components/modals/*`).
5. `[ ]` Reassemble `pages/EmployeeDetails.vue` container page with modern styling.
6. `[ ]` Export surface from `index.ts`.

### Gate 2: Backend Implementation & Dynamic Data Wiring
7. `[ ]` Scaffold `App\Queries\Employee\GetEmployeeProfileQuery` and `GetEmployeeBackgroundTableQuery`.
8. `[ ]` Scaffold `App\Handlers\Employee\SubmitChangeRequestHandler` and `UpdateProfileImageHandler`.
9. `[ ]` Refactor `ProfileController.php` to thin Query/Handler dispatcher.
10. `[ ]` Wire dynamic HTTP calls from `useEmployeeDetailsApi` to the backend endpoints.
11. `[ ]` Verify full end-to-end functionality (profile load, background tables, change request, profile image upload).

---

## 8. Out of Scope (Future Specs)

- **HR Change Request Processing Portal**: Spec for HR administrators to review, approve, or reject employee profile change requests (`subhrms/hr/change_requests.md`).
- **Manager Profile View**: Spec for team managers to view subordinate employee profile cards.
