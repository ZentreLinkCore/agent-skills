# Spec — Timekeeping Change Shift Applications

> **Kind:** Extension & Greenfield — Complete UI and backend endpoint wiring for the Timekeeping Change Shift Applications module.
> **Portal:** **Timekeeping** (`/api/timekeeping/...` routes, `timekeeping/applications/change-shift` frontend module).
> **Route:** `/timekeeping/applications/change-shift` (`tk_applications_change_shift`).
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules.md](../../rules/hrms-rules.md), [ui-design.md](../../rules/ui-design.md).
> **System Awareness:** Models Reused (`AppChangeShift`, `Timesheet`, `Shift`, `PayPeriod`); Tables Reused (`app_shift`, `timesheets`, `shifts`, `payperiods`, `accounts`); Routes Created (`routes/api/timekeeping.php`); New migration: No (table `app_shift` already exists).

---

## 1. Purpose

The **Timekeeping Change Shift Applications** module enables timekeepers and HR administrators to view, search, filter, file, audit, approve, reject, and batch-process employee requests to alter work schedules, swap shifts, or adjust core hours for specific work dates. It bridges employee schedule adjustments directly into timesheet processing while maintaining an immutable audit log.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Timesheet Schedule Synchronization on Approval

**Option A — Automatic Real-Time Synchronization (Recommended)**
- Upon approving a Change Shift request (`status = 1`), `ProcessChangeShiftHandler` immediately updates the matching date's record in `timesheets` with `newshiftid` and triggers a recalculation of rendered hours.

| Pros | Cons |
|---|---|
| Eliminates schedule discrepancies between approved shift applications and attendance timesheets. | Slightly longer execution time inside the approval transaction. |
| Prevents incorrect tardiness or undertime penalties in payroll cutoff processing. | Requires handling edge cases where no timesheet row exists yet for that date. |

**Option B — Deferred Manual Sync**
- Approval only updates `app_shift.status = 1`. Timesheet schedule updates occur only when the timekeeper manually re-processes the entire pay period timesheet.

| Pros | Cons |
|---|---|
| Keeps the approval endpoint minimal and fast. | Risk of inconsistent timesheet reports if timesheets are locked before re-processing. |

**Recommendation:** **Option A.** Automatic real-time synchronization ensures single source of truth and prevents payroll errors during cutoff lock.

---

### Decision 2: Application Entry Mechanism (Modal Capabilities)

**Option A — Unified Modal with Dual Filing Modes (Recommended)**
- A single modal offering two tabs: **Single Employee Change Shift** (change 1 employee's shift for a date) and **Shift Swap** (swap shifts between 2 employees for a date).

| Pros | Cons |
|---|---|
| High efficiency for timekeepers managing shift changes and team swaps in a single screen. | Slightly more complex modal state management. |
| Reuses shift selection components and validation logic. | |

**Option B — Single-Employee Filing Only**
- The modal only allows filing for one employee at a time. Shift swaps must be handled manually by creating two separate requests.

| Pros | Cons |
|---|---|
| Simpler form layout. | Tedious for timekeepers managing mutual employee shift swaps. |

**Recommendation:** **Option A.** Unified modal supporting both direct schedule changes and mutual employee shift swaps.

---

### Decision 3: Application Status State Representation

**Option A — 4-State Integer Mapping (Recommended)**
- Uses the integer column `app_shift.status`: `0: Pending`, `1: Approved`, `2: Disapproved`, `3: Cancelled`. Integrated directly with global `StatusBadge`.

| Pros | Cons |
|---|---|
| Matches existing migration schema comment (`0: pending, 1: approved, 2: disapproved`). | Requires label mapping in frontend DTOs (`0 -> Pending`, `1 -> Approved`, etc.). |
| High database indexing performance on `tinyInteger`. | |

**Option B — String Status Codes**
- Converts DB column to string values (`"PENDING"`, `"APPROVED"`, `"REJECTED"`).

| Pros | Cons |
|---|---|
| Human readable in raw database queries. | Breaks existing migration schema and current queries (`where('status', 1)`). |

**Recommendation:** **Option A.** Aligns with existing `app_shift` table definition and project query standards.

---

### Decision 4: Data Table Interaction & Drag-to-Scroll UX

**Option A — Responsive Data Table with Mouse Drag-to-Scroll (Recommended)**
- Wide table view wrapped in an `overflow-x-auto` container with mouse drag-to-scroll tracking (`cursor-grab active:cursor-grabbing select-none`), status badges, search/filter bar, department filter, pay period filter, and action dropdowns.

| Pros | Cons |
|---|---|
| Strictly adheres to `ui-design.md` rule #32 for wide data tables. | Requires mouse tracking event handlers in table composable. |
| Excellent user experience on wide screen sizes with detailed column sets. | |

**Recommendation:** **Option A.** Standard for all HRMS data tables.

---

## 3. Database

### Reused Table: `app_shift`

| Column | Type | Nullable | Index / Comment | Description |
|---|---|---|---|---|
| `id` | `bigint` | No | Primary | Unique application ID |
| `docnumber` | `varchar(255)` | Yes | | Generated tracking number (`CS-YYYYMM-XXXX`) |
| `idacct` | `integer` | No | Indexed | Employee Account ID (`accounts.id`) |
| `oldshiftid` | `integer` | No | Indexed | Previous Shift ID (`shifts.id`) |
| `newshiftid` | `integer` | No | Indexed | New Requested Shift ID (`shifts.id`) |
| `date` | `date` | Yes | Indexed | Target shift change date (`YYYY-MM-DD`) |
| `remarks` | `text` | Yes | | Reason / justification for change |
| `file` | `varchar(255)` | Yes | | Attachment file path (optional) |
| `idpayperiod` | `integer` | Yes | Indexed | Pay period ID |
| `approvers` | `json` | Yes | | Approvers sequence & status JSON |
| `cancelby` | `integer` | Yes | Indexed | Account ID of canceller |
| `cancel_at` | `datetime` | Yes | | Timestamp of cancellation |
| `cancel_reason` | `text` | Yes | | Reason for cancellation |
| `date_approve` | `datetime` | Yes | Indexed | Timestamp of approval/disapproval |
| `status` | `tinyint` | No | Default `0` | `0: Pending, 1: Approved, 2: Disapproved, 3: Cancelled` |
| `created_at` | `timestamp` | Yes | | Record creation timestamp |
| `updated_at` | `timestamp` | Yes | | Record modification timestamp |

---

## 4. Backend

### Controller: `App\Http\Controllers\tk\ChangeShiftController`

Located at `app/Http/Controllers/tk/ChangeShiftController.php`. Extends `App\Http\Controllers\Controller`.

```php
namespace App\Http\Controllers\tk;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Exception;
use App\Queries\Shift\GetChangeShiftApplicationsQuery;
use App\Queries\Shift\GetChangeShiftMetricsQuery;
use App\Handlers\Shift\SubmitChangeShiftHandler;
use App\Handlers\Shift\ProcessChangeShiftHandler;

class ChangeShiftController extends Controller
{
    public function index(Request $request)
    {
        try {
            $data = GetChangeShiftApplicationsQuery::execute($request->all());
            return response()->json($data);
        } catch (Exception $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    public function metrics(Request $request)
    {
        try {
            $data = GetChangeShiftMetricsQuery::execute($request->all());
            return response()->json($data);
        } catch (Exception $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    public function store(Request $request)
    {
        try {
            $data = SubmitChangeShiftHandler::execute($request->all());
            return response()->json(['message' => 'Change shift application submitted successfully', 'data' => $data]);
        } catch (Exception $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    public function process(Request $request)
    {
        try {
            $data = ProcessChangeShiftHandler::execute($request->all());
            return response()->json(['message' => 'Application status updated successfully', 'data' => $data]);
        } catch (Exception $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }
}
```

### Queries & Handlers

- `App\Queries\Shift\GetChangeShiftApplicationsQuery`: Returns paginated applications with employee name, department, old shift details, new shift details, document number, date, status, and remarks.
- `App\Queries\Shift\GetChangeShiftMetricsQuery`: Computes total count, pending count, approved count, and rejected/cancelled count for top overview metric cards.
- `App\Handlers\Shift\SubmitChangeShiftHandler`: Wraps creation in `DB::transaction`. Generates unique `docnumber`, checks for duplicate pending requests on the same date, and creates `AppChangeShift` row.
- `App\Handlers\Shift\ProcessChangeShiftHandler`: Wraps status change in `DB::transaction`. Updates `status`, `date_approve`, `cancel_reason`. On approval (`status = 1`), updates matching `timesheets` row with `newshiftid`.

### Route Registration: `routes/api/timekeeping.php`

Add inside `routes/api/timekeeping.php` under the `/timekeeping` prefix:

```php
use App\Http\Controllers\tk\ChangeShiftController;

// Change Shift Application Routes
Route::get('/applications/change-shift', [ChangeShiftController::class, 'index']);
Route::get('/applications/change-shift/metrics', [ChangeShiftController::class, 'metrics']);
Route::post('/applications/change-shift/save', [ChangeShiftController::class, 'store']);
Route::post('/applications/change-shift/process', [ChangeShiftController::class, 'process']);
```

---

## 5. Frontend

### Directory & File Structure

Location: `resources/views/web/src/module/timekeeping/applications/pages/change_shift/`

```
change_shift/
├── index.ts                           # Barrel exports
├── api/change_shift.api.ts            # Service layer (useChangeShiftApi)
├── composables/useChangeShift.ts      # Reactive state & actions
├── pages/ChangeShift.vue              # Main container view page
├── components/                        # Subcomponents
│   ├── ChangeShiftHeader.vue          # Header banner & action actions
│   ├── ChangeShiftMetrics.vue         # 4-card overview metrics
│   ├── ChangeShiftFilters.vue         # Search bar, status tabs, department dropdown
│   ├── ChangeShiftTable.vue           # Drag-to-scroll applications table
│   └── ChangeShiftModal.vue           # Application submission / swap modal
└── types/types.change_shift.ts        # TypeScript DTOs & Interfaces
```

### API Contract (`api/change_shift.api.ts`)

```ts
import http from '@/app/axios/axiosInstance';

export function useChangeShiftApi() {
  return {
    getApplications: async (params: Record<string, any> = {}): Promise<any> => {
      const response = await http.get('api/timekeeping/applications/change-shift', { params });
      return response.data;
    },
    getMetrics: async (params: Record<string, any> = {}): Promise<any> => {
      const response = await http.get('api/timekeeping/applications/change-shift/metrics', { params });
      return response.data;
    },
    submitApplication: async (payload: Record<string, any>): Promise<any> => {
      const response = await http.post('api/timekeeping/applications/change-shift/save', payload);
      return response.data;
    },
    processApplication: async (payload: Record<string, any>): Promise<any> => {
      const response = await http.post('api/timekeeping/applications/change-shift/process', payload);
      return response.data;
    },
  };
}
```

### UI & Styling Guidelines (Timekeeping `blue-600`)

- **Accent Theme**: Primary portal color `blue-600` for active tab buttons, search focus rings, table header highlights, and modal submit buttons.
- **Header Banner**: `HeaderBanner` component with `portal="timekeeping"`, icon `mdi-account-edit-outline`, title `"Change Shift Applications"`, description `"Manage employee schedule adjustments, shift swap requests, and timekeeping shift updates."`.
- **Metrics Overview Cards**:
  1. *Total Requests* (Blue icon)
  2. *Pending Approval* (Amber icon)
  3. *Approved Shifts* (Emerald icon)
  4. *Disapproved / Cancelled* (Rose icon)
- **Table Controls**: Search input with clear button, status filter tabs (`All`, `Pending`, `Approved`, `Disapproved`), department filter dropdown, pay period filter dropdown, and mouse drag-to-scroll support (`@mousedown="startDrag"`).

---

## 6. Business Rules & Edge Cases

### HRMS Domain Rules

1. **Pay Period Lock Guard**: Cannot submit or process change shift requests for pay periods that are locked (`status = 1` in `payperiods` or `period_lock`).
2. **Duplicate Request Prevention**: An employee cannot have more than 1 pending change shift request on the exact same date (`idacct` + `date` + `status = 0`).
3. **Shift Validation**: Both `oldshiftid` and `newshiftid` must reference valid active shift templates in `shifts` table.
4. **Timesheet Sync on Approval**: When approved (`status = 1`), the system automatically syncs `newshiftid` into `timesheets` for that employee & date.

### Edge Cases

| Edge Case | Risk | Resolution |
|---|---|---|
| Locked Pay Period | Unintended modifications to locked payroll cutoff. | Backend throws error `"Cannot modify shift applications for locked pay period."` |
| No Timesheet Row Exists | Approval fails to update timesheet. | Handler automatically creates a base timesheet entry if missing for that date. |
| Employee Shift Swap Collision | Two employees swapping to the same target shift. | Dual-swap transaction validates both employees' current schedules before swapping. |
| Disapproval / Cancellation | Status reverted or cancelled. | Log `date_approve` and `cancel_reason`; keep historical `oldshiftid` in timesheet. |

---

## 7. Build Order

1. **Backend Foundation (Gate 2)**
   - Create `App\Queries\Shift\GetChangeShiftApplicationsQuery` and `GetChangeShiftMetricsQuery`.
   - Create `App\Handlers\Shift\SubmitChangeShiftHandler` and `ProcessChangeShiftHandler`.
   - Create `App\Http\Controllers\tk\ChangeShiftController` and register routes in `routes/api/timekeeping.php`.

2. **Frontend UI Mockup & Gate 1 (Static Design-First)**
   - Create DTOs in `types/types.change_shift.ts`.
   - Implement `api/change_shift.api.ts` with mock toggle capability.
   - Build `composables/useChangeShift.ts`.
   - Construct subcomponents (`ChangeShiftHeader.vue`, `ChangeShiftMetrics.vue`, `ChangeShiftFilters.vue`, `ChangeShiftTable.vue`, `ChangeShiftModal.vue`).
   - Assemble `pages/ChangeShift.vue` with Timekeeping `blue-600` accent, responsive grid, status badges, and drag-to-scroll table.

3. **Gate 2 Dynamic Data Wiring**
   - Connect `useChangeShift.ts` to live `useChangeShiftApi()` endpoints.
   - Test search, filter, submission modal, and status approval flow.

---

## 8. Out of Scope (Future Specs)

- Automatic biometric re-calculation trigger on shift change approval (covered under Timesheet Processing module).
- Email / SMS notification dispatching on approval (handled by global notification queue).
