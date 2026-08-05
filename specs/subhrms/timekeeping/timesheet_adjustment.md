# Spec — Timesheet Adjustment (Unified Adjustment Report)

> **Kind:** Standalone module in `module/timekeeping/timesheet_adjustment/` — leaves `timekeeping/applications` untouched and cleans up the orphaned `TimesheetAdjustmentController` / `adjustment_processing` stubs.
> **Portal:** **Timekeeping** (`/api/timekeeping/timesheet-adjustments` backend routes, `timekeeping/timesheet_adjustment` frontend module).
> **Route:** `/timekeeping/timesheet-adjustment` (`tk_timesheet_adjustment`) — directly linked to the Timekeeping Sidebar menu under *Timekeeping > Reports > Timesheet Adjustment*.
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [ui-design.md](../../rules/ui-design.md), [vue-standards.md](../../rules/vue-standards.md), [duplicate-prevention.md](../../rules/duplicate-prevention.md).
> **System Awareness:** Models reused (`AppAdjustment`, `AppChangeShift`, `AppOvertime`, `AppOfficialBusinessTrip`, `AppLeave`, `AccountDetailVW`, `PayPeriod`); Tables reused only (`app_adjustment`, `app_shift`, `app_overtime`, `app_obt`, `app_leave`); Routes: `GET /api/timekeeping/timesheet-adjustments` (+ `/statistics`, `/{id}`); New migration: **no**.

---

## 1. Purpose

"Timesheet Adjustment" was requested as a dedicated page for Timekeepers to review all adjustment-type applications (shift changes, logsheet/biometric corrections, overtime, official business trips, leaves) in one unified audit view.

Key findings & scope:
1. **The `timekeeping/applications` module stays 100% untouched.** The Applications hub (Change Shift, Logsheet, Overtime, OBT, Leaves, Cancelled, Duty Roster) is already complete.
2. **Timesheet Adjustment gets its own standalone module folder** under `module/timekeeping/timesheet_adjustment/`.
3. **Route `/timekeeping/timesheet-adjustment`** maps directly to the active link in the Timekeeping Sidebar (`useSidebarLinks.ts` under *Reports > Timesheet Adjustment*).
4. **The page shows all 5 adjustment types, all statuses (pending + approved + disapproved), in one unified audit table** for Timekeeping.

---

## 2. Design Decisions

### Decision 1: Standalone Module Structure vs Modifying Applications
- **Standalone Module**: Built directly in `module/timekeeping/timesheet_adjustment/`. Keeps the `applications` hub clean and untouched, giving Timesheet Adjustment its dedicated subfolder and router file.

### Decision 2: Backend Query Architecture
- **Unified Read-Only Query**: A single backend query (`GetAllApplicationsQuery` or `GetTimesheetAdjustmentsQuery`) returning a normalized union of `app_adjustment`, `app_shift`, `app_overtime`, `app_obt`, and `app_leave` records.
- **Route**: `GET /api/timekeeping/timesheet-adjustments` (plus `/statistics` and `/{id}`).

### Decision 3: Read-Only Audit View
- **Fully Read-Only**: Displays adjustment details, employee info, category badges, status badges, and approval chain timeline. Does not duplicate write paths (submit/approve/reject remain handled through line-manager / Approval Request flows).

---

## 3. Database

No new tables/columns — 100% reused across existing tables:

| Table | Model | Role |
|---|---|---|
| `app_adjustment` | `AppAdjustment` | Logsheet / punch corrections |
| `app_shift` | `AppChangeShift` | Change Shift filings |
| `app_overtime` | `AppOvertime` | Overtime claims |
| `app_obt` | `AppOfficialBusinessTrip` | Official Business Trip filings |
| `app_leave` | `AppLeave` | Leave filings |
| `vw_accounts_details` | `AccountDetailVW` | Employee join (name, empid, unit, position) |
| `payroll_period` | `PayPeriod` | Pay period join |

---

## 4. Backend Strategy (Gate 2)

- **`GET /api/timekeeping/timesheet-adjustments`**: Returns paginated union of all 5 tables with parameters `search`, `status`, `department`, `category`, `page`, `per_page`.
- **`GET /api/timekeeping/timesheet-adjustments/statistics`**: Returns metrics `{ total, pending, approved, disapproved }`.
- **`GET /api/timekeeping/timesheet-adjustments/{id}`**: Returns detailed record with parsed `approvers` JSON timeline.

---

## 5. Frontend Architecture (Gate 1 - Built)

The module is implemented in its dedicated subfolder:

```
module/timekeeping/timesheet_adjustment/
├── index.ts                                   # Barrel re-export
├── route/timesheet_adjustment.routes.ts        # Route: /timekeeping/timesheet-adjustment
├── api/timesheet_adjustment.api.ts           # API service with design-first mock data & TODO(backend)
├── types/types.timesheet_adjustment.ts         # TypeScript interfaces & DTOs
├── composables/useTimesheetAdjustment.ts             # State machine (filters, pagination, modal, drag-to-scroll)
├── pages/TimesheetAdjustment.vue               # Main view component
└── components/
    ├── TimesheetAdjustmentMetrics.vue        # Summary metrics cards
    ├── TimesheetAdjustmentFilters.vue        # Search bar & dropdown filters
    ├── TimesheetAdjustmentTable.vue          # Drag-to-scroll wide data table
    └── TimesheetAdjustmentDetailsModal.vue   # Detailed view modal
```

- **Route Registration**: `route/timesheet_adjustment.routes.ts` defines `path: 'timekeeping/timesheet-adjustment'`, auto-discovered by `module/timekeeping/useApiWebRoute.ts`.

---

## 6. Business Rules & Edge Cases

| Case | Handling |
|---|---|
| Filter by Category | Filters by `category` (`change-shift`, `logsheet`, `overtime`, `obt`, `leaves`, or `all`). |
| Filter by Status | Filters by status (`0` Pending, `1` Approved, `2` Disapproved, or `all`). |
| Wide Data Table | Drag-to-scroll enabled via `@mousedown="startDrag"`. |
| Details View | Displays category-specific particulars and approver chain timeline. |

---

## 7. Build Order

1. **Gate 1 (Frontend — Completed)**:
   - Built standalone module in `module/timekeeping/timesheet_adjustment/`.
   - Registered `/timekeeping/timesheet-adjustment` route.
   - Restored `timekeeping/applications` module to its original untouched state.
2. **Gate 2 (Backend — Ready)**:
   - Implement `GetTimesheetAdjustmentsQuery` union backend for `/api/timekeeping/timesheet-adjustments`.
   - Wire live HTTP endpoints in `api/timesheet_adjustment.api.ts`.
