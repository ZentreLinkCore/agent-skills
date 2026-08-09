# Spec — Timekeeping Applications Improvement & Refactoring

> **Kind:** Extension & Architecture Refactoring
> **Portal:** **Employee** (`/api/employee/...` routes, `timekeeping_applications` frontend module).
> **Route:** `/employee/timekeeping-applications` (`employee_timekeeping_applications`).
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules.md](../../rules/hrms-rules.md), [vue-standards.md](../../rules/vue-standards.md), [laravel-standards.md](../../rules/laravel-standards.md), [ui-design.md](../../rules/ui-design.md).
> **System Awareness:**
> - **Models Reused:** `AppChangeShift`, `AppAdjustment`, `AppOvertime`, `AppOfficialBusinessTrip`, `AppLeave`, `PayPeriod`, `Timesheet`, `AccountDetailVW`.
> - **Tables Reused:** `app_changeshift`, `app_adjustment`, `app_overtime`, `app_obtrip`, `app_leaves`, `payperiods`, `timesheets`.
> - **Routes Reused:** `api/employee/shift_schedule`, `api/employee/view_application`, `api/employee/generate_schedule`, `api/employee/submit_application`, `api/employee/cancel_application`, `api/employee/checkExistingLogs`, `api/employee/getLeavesCredit`, `api/employee/application-status`, `api/employee/application-details`.
> - **New Migration Needed:** No (Reuses existing domain schemas).

---

## 1. Purpose

The **Timekeeping Applications** module allows employees to view, file, track, and manage their timekeeping-related requests within the active pay period cutoff. It supports 5 application types:
1. **Change Shift (CS)**
2. **Attendance Adjustment (AA)**
3. **Overtime (OT)**
4. **Official Business Trip (OBT)**
5. **Leaves (Leave)**

This specification defines the modern architectural design, frontend DTO typing, backend route consolidation, UI design enhancements, and business rule guardrails to eliminate legacy tech debt and provide a state-of-the-art employee self-service experience.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Frontend State Management Architecture

**Option A — Composable-driven State with Pinia Store as Data Layer (Recommended)**
- Keep reactive state and business logic inside `useTimekeepingApplication.ts` composable, delegating API calls to `timekeeping_applications.api.ts` and using Pinia `useTimekeepingApplicationsStore` solely for global shared state. Avoid heavy 24-property `provide/inject` anti-patterns by explicitly passing props and typed emit events to child components.

| Pros | Cons |
|---|---|
| • Clear component prop contracts and explicit event flows.<br>• Eliminates magic `provide/inject` dynamic properties.<br>• Clean separation of UI composables from API services. | • Requires updating event emitters in child tab/modal components. |

**Option B — Monolithic Provide/Inject Everything**
- Continue passing 24 dynamic properties via `provide('timekeepingApp', {...})` to all descendant components.

| Pros | Cons |
|---|---|
| • No need to update child component prop definitions. | • High coupling, fragile debugging, no type safety for injected dependencies. |

**Recommendation:** **Option A**. Strong typing, explicit props/emits, and clean composables align with [vue-standards.md](../../rules/vue-standards.md).

---

### Decision 2: Legacy File Cleanup Strategy

**Option A — Purge `TimekeepingApplications_copy.vue` Immediately (Recommended)**
- Delete the 156KB legacy backup file `TimekeepingApplications_copy.vue` from `pages/`.

| Pros | Cons |
|---|---|
| • Decreases repository clutter.<br>• Prevents confusion and accidental edits to dead code. | • None (file is unreferenced in routes and builds). |

**Option B — Keep Backup File in Directory**
- Retain `TimekeepingApplications_copy.vue` as a historical reference.

| Pros | Cons |
|---|---|
| • Retains legacy reference in place. | • Increases bundle scan overhead and pollutes workspace searches. |

**Recommendation:** **Option A**. Unused legacy files violate project hygiene.

---

### Decision 3: Backend Controller Structure & Route Cleanup

**Option A — Clean Thin Controller Dispatcher + Duplicate Route Scrubbing (Recommended)**
- Remove duplicate route declarations from `routes/api/employee.php`. Keep `TKApplicationController.php` methods focused on dispatching requests statically to existing domain Queries (`HandleChangeShiftQuery`, `HandleAttendanceAdjustmentQuery`, `HandleOvertimeQuery`, `HandleOfficialBusinessTripQuery`, `HandleLeavesQuery`).

| Pros | Cons |
|---|---|
| • Cleans route registry and prevents duplicate execution.<br>• Adheres to `project-profile.md` thin-controller + Query/Handler pattern. | • Requires testing all route endpoints across 5 filing types. |

**Option B — Leave Duplicate Routes and Inline Controller Queries**
- Keep existing duplicate routes in `routes/api/employee.php` and procedural logic.

| Pros | Cons |
|---|---|
| • Zero backend file changes. | • Maintains duplicate route entries and high complexity in `TKApplicationController.php`. |

**Recommendation:** **Option A**. Maintains standard Laravel routing and clean Query/Handler patterns.

---

### Decision 4: Calendar Date-Click Filing Entry Point (UI Redesign, Ref: `image_0.png`)

**Option A — Two-Step "Type Selector" Modal Before the Detailed Form (Recommended)**
- Clicking a date on the dashboard `CalendarComponent` (left column of the 2-column layout) applies a subtle selected-day highlight, then immediately opens a new **Application Type Selector** modal/drawer over a dimmed overlay. The employee picks one of 5 large, color-coded type cards and fills a minimal draft (date, reason, optional attachment) before pressing **"Proceed to Detailed Form"**, which hands the draft off into the existing tabbed `ApplicationModal.vue` pre-filled on the matching tab.

| Pros | Cons |
|---|---|
| • Matches the approved dashboard mockup (`image_0.png`) and modern B2B SaaS aesthetic.<br>• Large icon+description cards remove the need to memorize what CS/AA/OT/OBT/Leave abbreviations mean.<br>• Reuses existing per-tab form components (`ChangeShift.vue`, `Leaves.vue`, etc.) for validation — no duplicated business logic. | • Adds one extra modal transition between date-click and the actual form.<br>• Requires a small `ApplicationDraft` hand-off contract between the two modals. |

**Option B — Keep Direct Tabbed Modal on Date-Click (current behavior)**
- Clicking a date opens `ApplicationModal.vue` directly on a default tab (`cs`), relying on the horizontal tab pills for the employee to switch type.

| Pros | Cons |
|---|---|
| • No new component, zero extra click. | • Default tab rarely matches intent; abbreviation-only tab pills are less discoverable than icon+description cards; doesn't match the new visual reference. |

**Recommendation:** **Option A**. See §5 "Date-Click Filing Flow" for the full interaction spec.

---

## 3. Database

Reuses existing domain tables without schema modifications.

| Table Name | Primary Purpose | Key Status Values |
|---|---|---|
| `app_changeshift` | Shift change requests | `0=Pending`, `1=Approved`, `2=Declined`, `3=Cancelled` |
| `app_adjustment` | Attendance clocking adjustments | `0=Pending`, `1=Approved`, `2=Declined`, `3=Cancelled` |
| `app_overtime` | Overtime hours requests | `0=Pending`, `1=Approved`, `2=Declined`, `3=Cancelled` |
| `app_obtrip` | Official business trip filings | `0=Pending`, `1=Approved`, `2=Declined`, `3=Cancelled` |
| `app_leaves` | Leave application filings | `0=Pending`, `1=Approved`, `2=Declined`, `3=Cancelled` |
| `payperiods` | Pay period cutoff definitions | `status=1` (Active cutoff), `period_start`, `period_end` |

---

## 4. Backend Architecture

### Controller
- **`App\Http\Controllers\employee\TKApplicationController`**
  - Thin action methods wrapping execution in `try/catch` and returning raw JSON `response()->json(...)`.

### Handlers & Queries (Domain Pattern)
- `App\Queries\ChangeShift\HandleChangeShiftQuery`
- `App\Queries\AttendanceAdjustment\HandleAttendanceAdjustmentQuery`
- `App\Queries\Overtime\HandleOvertimeQuery`
- `App\Queries\OfficialBusinessTrip\HandleOfficialBusinessTripQuery`
- `App\Queries\Leave\HandleLeavesQuery`
- `App\Handlers\AccountLeave\HandleAccountLeave`
- `App\Handlers\ApplicationStatus\HandleApplicationStatus`

### API Endpoint Contracts (`routes/api/employee.php`)

```text
GET  /api/employee/shift_schedule       -> TKApplicationController@index
POST /api/employee/view_application     -> TKApplicationController@view_application
POST /api/employee/submit_application   -> TKApplicationController@submit_application
POST /api/employee/cancel_application   -> TKApplicationController@cancel_application
POST /api/employee/checkExistingLogs    -> TKApplicationController@checkExistingLogs
POST /api/employee/getLeavesCredit      -> TKApplicationController@leavesCredit
GET  /api/employee/application-status   -> ApplicationStatusController@index
POST /api/employee/application-details  -> TKApplicationController@applicationDetails
```

---

## 5. Frontend Architecture

### Module File Layout
```text
resources/views/web/src/module/employee/timekeeping_applications/
├── index.ts
├── api/
│   └── timekeeping_applications.api.ts
├── composables/
│   └── useTimekeepingApplication.ts
├── types/
│   └── types.timekeeping_applications.ts
├── route/
│   └── timekeeping_applications.routes.ts
├── store/
│   └── timekeeping_applications.store.ts
├── utils/
│   └── timekeeping_applications.utils.ts
├── pages/
│   └── TimekeepingApplications.vue
└── components/
    ├── modals/
    │   ├── ApplicationModal.vue
    │   └── ApplicationTypeSelectorModal.vue   # NEW — date-click entry step (§5 Date-Click Filing Flow)
    ├── shared/
    │   ├── FormSkeleton.vue
    │   ├── TabDetailView.vue
    │   └── TabListView.vue
    └── tabs/
        └── web/
            ├── AttendanceAdjustment.vue
            ├── ChangeShift.vue
            ├── Leaves.vue
            ├── OfficialBusinessTrip.vue
            └── Overtime.vue
```

### TypeScript DTO Definitions (`types.timekeeping_applications.ts`)

```ts
export type EmployeeApplicationType = 'cs' | 'aa' | 'ot' | 'obt' | 'leave';

export interface TimekeepingDateRange {
  startDate: string | null;
  endDate: string | null;
}

export interface ApplicationStatusSummary {
  text: string;
  total: number;
  pending: number;
  approved: number;
  declined: number;
}

export interface LeaveCreditItem {
  idleave: number;
  leavetype: string;
  entitle: number;
  used: number;
  pending: number;
  balance: number;
  color?: string;
}

export interface TimekeepingEventDetails {
  id?: number | string;
  docnumber?: string;
  date?: string;
  remarks?: string;
  status?: number;
  approver?: string;
  cancel_at?: string;
  date_approve?: string;
  [key: string]: any;
}

// NEW — Date-Click Filing Flow (§5 Date-Click Filing Flow)
export interface ApplicationTypeOption {
  type: EmployeeApplicationType;
  label: string;
  description: string;
  icon: string;
  color: 'yellow' | 'blue' | 'purple' | 'pink' | 'green';
  alreadyFiled?: boolean;
}

export interface ApplicationDraft {
  date: string;
  type: EmployeeApplicationType | null;
  reason: string;
  attachment?: File | null;
}
```

### Key UI Features & Design Aesthetics

> **Design-system alignment (NEW)**: this page must draw its visual language from what the **Employee Dashboard module already established** (`module/employee/dashboard/pages/*.vue`) and the shared tokens in `resources/css/theme.css` — not ad-hoc styling invented per-page. Concretely:
> - **`.card`** (`resources/css/theme.css` `@layer components`) is the one card primitive — `bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md`. Every sidebar/stat card on this page uses it; no custom `ring-1`/`backdrop-blur` glass treatments (they read poorly in dark mode and don't match anywhere else in the app).
> - **Header** uses the shared `WelcomeBanner` component (`@/src/components/WelcomeBanner.vue`, `portal="employee"`) exactly like `Dashboard.vue`, `Payslip.vue`, etc. — not a bespoke title/chip row. Amber→orange gradient is the *correct, established* Employee identity color (confirmed in `theme.css` `--color-module-employee` and reused by `WelcomeBanner`/`QuickActions.vue`'s primary CTA) — keep it, but only for this kind of identity moment.
> - **Teal is the shared interactive accent** (hover states, active filter pills, expanded-accordion rings, "View All" links) across `QuickActions.vue`, `RecentApplications.vue`, `UpcomingHolidays.vue`, `KpiCards.vue` — this page's accordions (Application Status, Available Leaves) follow the same convention instead of amber for their expanded/active ring.
> - **Reuse over reimplementation**: `UpcomingHolidays.vue` from the dashboard module is imported directly (`props: holidays, loading`) rather than re-built inline — same visual result, zero duplicated markup.
> - **KPI stat tiles** follow `KpiCards.vue`'s exact anatomy: `.card p-5`, label → value (`text-2xl md:text-3xl font-bold`) → subtitle/delta chip, icon square top-right.
- **Dashboard Layout**: 2-column layout — left: large `CalendarComponent` (FullCalendar-based); right: stacked Details & Activity widgets. Global search bar unchanged.
- **Header**: `WelcomeBanner` (title override `"Timekeeping Applications"`, `badges` = employee ID + pending-count/all-caught-up chip) with a `right-card` slot showing the active cutoff period.
- **Stats Overview**: 4 separate KPI-style `.card` tiles (Total Filed w/ Filing Trends sparkline, Pending, Approved w/ approval-rate chip, Declined) in a `grid grid-cols-2 xl:grid-cols-4` — not one dense shared bar.
- **Sidebar Widgets**: **Quick Filing**, **Recent Activity**, **Upcoming Holidays** (reused component), **Application Status** accordion, **Available Leaves** accordion — all `.card`-based, sentence-case headers with a one-line subtitle (matching `QuickActions.vue`/`RecentApplications.vue`), teal for interactive/expanded states.
- **FullCalendar View**: Interactive calendar with status colors:
  - Morning / Scheduled Shifts: `#6366f1` (Indigo)
  - Filed Applications: `#10b981` (Emerald) / `#f59e0b` (Amber)
  - **Selected-day highlight (NEW)**: clicking a day (e.g. Tue, Oct 26) applies a subtle ring + tinted background distinct from the "today" marker, and persists while `ApplicationTypeSelectorModal` is open.
- **Application Type Selector Modal (NEW, 2-step wizard)** — triggered immediately on date-click, before the detailed form:
  - **Position/style**: centered modal, `rounded-2xl`, soft shadow, dimmed backdrop overlay; **gradient hero header** (`from-amber-600 via-amber-500 to-orange-500`) carrying the dynamic title/date and a **2-step progress indicator** (`Type` → `Details`, filled circle + connecting bar as the user advances).
  - **Step 1 — Type**: 5 large interactive cards (icon + label + short description), one per application type, using the color-coded legend below as accent border/background; picking a card auto-advances to Step 2. A card already filed for the selected date shows a small "Filed" badge but stays clickable (routes to the existing entry instead of a duplicate — see Duplicate Log Guard).
  - **Step 2 — Details**: a "chosen type" recap chip (click to jump back to Step 1 and change it), `Date` (locked/read-only, pre-populated from the click), `Reason/Description` (textarea), optional `Attachment` upload (surfaced prominently for Leaves, e.g. medical certificate).
  - **Actions**: `Back` (Step 2 → Step 1, hidden on Step 1), `Cancel` (discards the in-progress `ApplicationDraft`, closes modal), `Proceed to Detailed Form` (Step 2 only; disabled until reason is non-empty; hands `ApplicationDraft` to `ApplicationModal.vue`, pre-filling date/reason on the matching tab so the employee doesn't retype them).
  - **Preset type entry**: can also open directly on Step 2 with a type pre-selected — see **Quick Filing Shortcuts** below.
  - **Color-coded legend** (matches calendar/legend accents, exported as `APPLICATION_TYPE_COLOR_STYLES` for reuse by other widgets):

    | Application Type | Legend Color | Icon |
    |---|---|---|
    | Leaves | Yellow | `mdi-calendar-minus` |
    | Change Shift | Blue | `mdi-swap-horizontal` |
    | Overtime | Purple | `mdi-account-clock-outline` |
    | Attendance Adjustment | Pink | `mdi-clock-alert-outline` |
    | Official Business Trip | Green | `mdi-briefcase-outline` |
- **`ApplicationModal.vue` (Detailed Form)**:
  - Horizontal tab pills for application types.
  - Dedicated search and filter input.
  - Paginated list view, detail view, and dynamic submission forms per tab type.
  - When opened via `ApplicationTypeSelectorModal`, lands directly on the chosen tab's form view (skips the list view) with `reason`/`date` pre-filled from the draft.
- **Quick Filing Shortcuts (NEW widget)** — a `.card` sidebar widget above Recent Activity with one tile per application type (same color legend/icons as the modal's Step 1 cards). Clicking a tile sets the draft date to **today** and opens `ApplicationTypeSelectorModal` directly on **Step 2** with that type pre-selected, skipping the type grid entirely for a one-tap filing path that doesn't require a calendar click first.
- **Recent Activity (NEW widget)** — a `.card` sidebar widget listing the employee's most recently filed applications (derived from the already-loaded schedule/application data, sorted by date, capped to 6 — no new endpoint), each row showing a type icon, label, formatted date, and a status badge (Pending/Approved/Declined), styled after `RecentApplications.vue`'s row anatomy (icon square, teal hover). Footer includes a "View All Applications" link to `/employee/application-status`, matching that component's footer pattern.
- **Filing Trends Sparkline (NEW)** — a small inline-SVG sparkline embedded in the "Total Filed" KPI tile, showing daily filing volume across the active cutoff period (derived client-side from the loaded applications list, bucketed per day — no new endpoint). Single series, portal-accent hue (amber), 2px line + ~10% opacity area wash + an end-point marker on the most recent day; full-width within the tile (no breakpoint hiding needed once each stat is its own `.card`).

---

## 6. Business Rules & Edge Cases

### HRMS Domain Rules
1. **Cutoff Boundary Guard**: Applications cannot be filed for dates prior to the active pay period start date when `cutoffPeriod.status === 0`.
2. **Overtime Multi-day Limit**: Filing overtime spanning more than 2 consecutive days triggers a warning (`Not allowed to file more than 2 days`).
3. **Leave Balance Check**: Paid leaves require an available balance (`balance > 0`). Unpaid leaves (`LWOP` / `idleave = 3 or 34`) bypass balance enforcement.
4. **Duplicate Log Guard**: Filing checks `checkExistingLogs` to prevent double-filing for the same employee on the same date/type.
5. **Pending Cancellation Only**: Only applications with `status === 0` (Pending) can be cancelled by the employee.
6. **Type-Selection Gate (NEW)**: The per-type detailed form is only reachable after a card is chosen in `ApplicationTypeSelectorModal`; "Proceed to Detailed Form" stays disabled until `ApplicationDraft.type` is set.
7. **Reason Required Before Proceed (NEW)**: `ApplicationDraft.reason` must be non-empty to enable "Proceed to Detailed Form"; attachment stays optional except where the destination tab's own validation (e.g. Leaves) requires it.

### Edge Cases Handling

| Edge Case | Handling Behavior |
|---|---|
| API Failure on Schedule Load | Gracefully handles empty states, notifies user via toast, avoids silent hardcoded mocks in production. |
| Non-contiguous Date Selection | Normalizes end date range calculation for FullCalendar multi-day drags. |
| Zero Leave Credit Filing | Displays warning toast for paid leave types; allows submission for unpaid leave types. |
| Already Approved Application Cancel | Action disabled in UI detail view; API rejects non-pending status cancellation requests. |
| Date Already Has a Filed Application (NEW) | `ApplicationTypeSelectorModal` still opens; the matching type card shows a "Filed" badge (via `checkExistingLogs`) but remains clickable, routing to the existing entry instead of a duplicate filing. |
| Type Selector Dismissed (NEW) | Cancel button or backdrop click clears the in-progress `ApplicationDraft` and removes the calendar's selected-day highlight without persisting anything. |

---

## 7. Build Order

1. **Clean Legacy Code**: Delete `TimekeepingApplications_copy.vue`.
2. **Backend Route Scrub**: Remove duplicate `Route::get` declarations from `routes/api/employee.php`.
3. **TypeScript DTOs**: Extend `types.timekeeping_applications.ts` with strict interfaces for all 5 filing types.
4. **API Service Refactoring**: Type return promises and parameters in `timekeeping_applications.api.ts`.
5. **Composable & Store Polishing**: Decouple direct UI alerts (Swal) from `timekeeping_applications.store.ts` and streamline `useTimekeepingApplication.ts`.
6. **Date-Click Filing Flow (NEW)**: Build `ApplicationTypeSelectorModal.vue` as a 2-step wizard (gradient hero header + step indicator; Step 1 color-coded type grid, Step 2 draft fields per §5); wire the `CalendarComponent` date-click handler to set the selected-day highlight and open it before `ApplicationModal.vue`; add `ApplicationTypeOption` / `ApplicationDraft` to `types.timekeeping_applications.ts`; export `APPLICATION_TYPE_COLOR_STYLES` from the utils file so the legend is shared, not duplicated.
7. **Dashboard Widgets (NEW)**: Add the **Quick Filing Shortcuts** sidebar card (opens the wizard on Step 2 with a preset type + today's date), the **Recent Activity Timeline** sidebar card (derived from already-loaded application data, no new endpoint), and the **Filing Trends** sparkline in the Total Filed stat card (client-side bucketed counts across the cutoff period, no new endpoint).
8. **Page & Component Verification**: Verify reactive binding and modal workflows across all 5 tabs, including the new type-selector → detailed-form hand-off and the two new sidebar widgets.

---

## 8. Out of Scope (Future Specs)

- Manager Approval Portal filing review & bulk approval batching.
- HR Leave Accrual & Policy Configuration management.
