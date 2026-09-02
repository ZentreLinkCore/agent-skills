# Spec — Mobile Employee Timekeeping & Timesheet Details Module

> **Kind:** Extension (Complete overhaul of `TimekeepingScreen.tsx` from static preview into a full-featured, touch-first mobile Timesheet & DTR component suite).
> **Portal:** **Employee / Mobapp** (`/api/timekeeping/timesheet_details` backend route; `resources/views/mobapp/src/module/employee/timekeeping` mobile module).
> **Version:** v1 — 2026-09-02 — initial specification for modern non-table mobile timesheet details with parity to web timesheet calculations, cutoff period navigation, segmented metrics, daily card timeline, and daily detail inspection modal.
> **Route:** `(app)/timekeeping` (Bottom tab: Timekeeping & Timesheet).
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules](../../rules/hrms-rules.md), [ui-design](../../rules/ui-design.md).
> **System Awareness:**
> - Models Reused: `App\Models\AccountDetailVW`, `App\Models\PayPeriod`, `App\Models\Timesheet`, `App\Models\Timelog`, `App\Models\Leave`, `App\Models\ChangeShift`, `App\Models\AttendanceAdjustment`, `App\Models\Overtime`, `App\Models\OfficialBusinessTrip`.
> - Tables Reused: `vw_accounts_details`, `pay_period`, `timesheets`, `timelogs`, `leaves`, `change_shifts`, `attendance_adjustments`, `overtimes`, `official_business_trips`.
> - Routes Reused: `GET /api/timekeeping/timesheet_details`.
> - New Migration Needed: **No** (leverages existing timesheet engine, queries, and handlers).

---

## 1. Purpose

In the SubHRMS ecosystem, the **Daily Time Record (DTR) / Timesheet Details** is the critical single source of truth for employees to review their logged punches, daily shift schedules, rendered work hours, overtime, late/undertime penalties, night differentials (NP/NPOT), absences, and filed timekeeping applications (Leaves, Change Shifts, Attendance Adjustments, Overtime, OBT).

While the desktop web view (`resources/views/web/src/module/employee/timesheet_details`) relies on an expansive 14-column desktop data table, a direct table port to mobile devices creates poor usability, severe horizontal scrolling, and text truncation. 

This specification defines a **dedicated, state-of-the-art, non-table mobile timesheet experience** for `resources/views/mobapp/src/module/employee/timekeeping` that:
1. **Delivers 100% Data & Business Logic Parity with Web**: Reuses the exact same `/api/timekeeping/timesheet_details` backend calculation engine (`HandleTimesheet::timesheet_details`), ensuring daily records, penalty math, and grand totals are identical across platforms.
2. **Replaces Tables with Modern Mobile Card & Timeline Feeds**: Translates rows into touch-friendly daily cards featuring calendar date badges, color-coded status chips (`W`, `N`, `A`, `H`), punch time capsules, and metric pills.
3. **Implements an Interactive Cutoff Period Navigator**: Allows employees to cycle seamlessly between current, previous, and past pay periods with animated chevron transitions and cutoff status indicators.
4. **Houses a High-Impact KPI Metrics Carousel**: Provides at-a-glance visibility into Regular Scheduled Hours, Actual Worked Hours, Overtime, Late/Undertime, and Absent Days.
5. **Provides Segmented Work Hours vs Applications View Toggle**: Equips the employee with an ergonomic segmented control to switch between raw punch/timekeeping metrics and filed application statuses (Leave type, Change Shift strikethrough, Missed Punch adjustments, OT approvals).
6. **Features an Expandable Daily Inspection Bottom Sheet**: Tapping any daily card reveals a comprehensive modal bottom sheet displaying exact biometric punch timestamps, shift parameters, full hours calculation breakdown, and attached application details.
7. **Adheres to the Employee Module Golden Chestnut Design Language**: Incorporates Employee Golden Chestnut branding (`#CB793A` light / `#E2A35A` dark), Slate-800 surfaces (`#1E293B`), glassmorphic containers, pull-to-refresh, skeleton loaders, and tactile haptic feedback.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Mobile UI Presentation Architecture (Timeline Card Feed vs Mini Table)

**Option A — Touch-First Vertical Timeline & Daily Card Feed with Inspection Modal (Recommended)**
- Render timesheet entries as vertical daily cards grouped along a clean timeline. Key data (Date badge, Status chip, Shift, In/Out punches, and prominent Late/OT badges) are immediately scannable on the card face. Tapping opens a rich bottom sheet modal with the complete breakdown.

| Pros | Cons |
|---|---|
| Zero horizontal scrolling; 100% responsive across all phone screen widths (from iPhone SE to Pro Max / Foldables). | Full granular breakdown requires a tap on the card to open the bottom sheet modal. |
| Clean typography, large touch targets (48px+), and modern iOS/Android native aesthetic. | |
| Easy to integrate visual indicators for Change Shift, Leaves, and pending adjustments. | |

**Option B — Responsive Scrollable Table (Web Port)**
- Replicate the desktop table structure with horizontal scroll within a container.

| Pros | Cons |
|---|---|
| Displays all columns in a single screen layout. | Severe horizontal overscroll and high cognitive load on small mobile viewports. |
| Identical structure to desktop web code. | Unreadable font sizes, cramped touch targets, and poor mobile user experience. |

**Recommendation:** **Option A**. Mobile design must prioritize readability, ergonomics, and native gesture patterns over desktop table ports.

---

### Decision 2: View Segmentation Strategy (Work Hours vs Applications)

**Option A — 2-Segment Pill Switcher ("Work Hours" & "Applications") with Shared Card Timeline (Recommended)**
- Mount an iOS-style segmented pill bar at the top of the feed (`Work Hours` | `Applications`).
  - In **Work Hours Mode**, cards highlight Shift Hours, Time In/Out, Actual Hours, Overtime, Late, Undertime, NP, and Absent tags.
  - In **Applications Mode**, cards highlight Leave chips (Full/Half Day), Change Shift (Original vs New Shift), Attendance Adjustment (Requested In/Out), Overtime (Plan Hrs), and OBT indicators.

| Pros | Cons |
|---|---|
| Mirrors the mental model and feature set of the desktop web timesheet tabs. | User toggles tabs to switch focus between time calculations and application status. |
| Prevents visual clutter by keeping each card focused on the selected domain context. | |

**Option B — Monolithic Consolidated Card (Everything on one card)**
- Display all work hours metrics and all application badges simultaneously on every card.

| Pros | Cons |
|---|---|
| No tab switching required. | Cards become excessively tall (220px+ each), leading to excessive vertical scrolling and visual noise. |

**Recommendation:** **Option A**. Matches web tab parity while preserving optimal card height and scanning speed.

---

### Decision 3: Pay Period Navigation (Floating Period Navigator with Quick Shift vs Date Picker)

**Option A — Interactive Header Pill Bar with Chevron Steppers (`< Previous`, `Current Cutoff`, `Next >`) + Period Picker Modal (Recommended)**
- Position a compact cutoff selector at the top with left/right arrow buttons to quickly step between pay periods. Tapping the period text opens a searchable bottom sheet modal listing recent cutoffs with status tags (`Current`, `Closed`, `Locked`).

| Pros | Cons |
|---|---|
| Instant one-tap navigation to previous/next cutoffs without opening full-screen date pickers. | Requires fetching list of available periods or handling dynamic period bounds. |
| Clear indication of current cutoff status and pay date. | |
| Integrated tactile haptic feedback on period change. | |

**Option B — Static Native Date Range Picker Only**
- Provide only standard start/end date calendar pickers.

| Pros | Cons |
|---|---|
| Simple native calendar UI. | Requires multiple date clicks to navigate payroll cycles; high friction for standard bi-monthly cutoffs. |

**Recommendation:** **Option A**. HRMS timesheets operate primarily on defined company pay periods (1st-15th, 16th-EOM); steppers provide the fastest navigation.

---

### Decision 4: Daily Inspection & Deep-Dive Experience

**Option A — Slide-Up Bottom Sheet Modal (`TimesheetDayDetailModal`) (Recommended)**
- Tapping a daily card triggers a sleek backdrop-blurred bottom sheet with tabs for "Punch & Telemetry", "Hours Breakdown Matrix", and "Linked Applications".

| Pros | Cons |
|---|---|
| Keeps the main list scroll position intact. | Requires managing modal open/close state and sheet animation. |
| Provides ample space for detailed time stamps, grace period logs, and supervisor approval remarks. | |

**Option B — Expandable Accordion Card**
- Expand the card inline within the scroll view.

| Pros | Cons |
|---|---|
| No modal overlay. | Expanding cards causes sudden scroll jumps and layout shifts in long lists. |

**Recommendation:** **Option A**. Native bottom sheets are standard in modern mobile design and prevent layout reflow during list scrolling.

---

## 2.5 Acceptance Criteria

| # | Given | When | Then |
|---|---|---|---|
| AC-1 | Authenticated employee opens Timekeeping tab (`/(app)/timekeeping`) | Screen mounts | It fetches timesheet details for the active cutoff period (`GET /api/timekeeping/timesheet_details?portal=emp`) and renders the period banner, KPI summary row, and daily card feed. |
| AC-2 | Timesheet API is loading | Initial mount or period change | Render shimmering skeleton card placeholders with a subtle pulse animation. |
| AC-3 | Timesheet data returns `timesheet_records` | Data arrives | Render vertical daily cards ordered chronologically. Each card shows Day Name (`MON`), Month (`AUG`), Day Number (`01`), Status badge (`W`, `N`, `A`, `H`), Shift window, and Punches. |
| AC-4 | A day has Working status (`W`) with punches | Card renders | Show `Time In` and `Time Out` capsules formatted in `hh:mm A` (e.g. `07:54 AM` / `05:03 PM`), plus `Actual Hours` meter. |
| AC-5 | A day has Tardiness (`late.hrs > 0`) | Card renders | Show a Rose warning pill with Late minutes/hours (e.g. `15m Late`). |
| AC-6 | A day has Approved Overtime (`ot.hrs > 0`) | Card renders | Show a Purple badge with Overtime hours (e.g. `+2.0h OT`). |
| AC-7 | A day has Undertime (`ut.hrs > 0`) | Card renders | Show an Amber pill with Undertime hours (e.g. `30m UT`). |
| AC-8 | A day has Night Premium (`np.hrs > 0` or `npot.hrs > 0`) | Card renders | Show an Indigo moon badge with Night Differential hours. |
| AC-9 | A day is Absent (`absent > 0` or status `A`) | Card renders | Show a Rose status badge with `ABSENT` indicator and dash placeholders for punches. |
| AC-10 | A day has an approved Change Shift (`application.cs.status === 1`) | Card renders | Show original shift with strikethrough (`08:00 AM - 05:00 PM`) and an arrow pointing to the new shift (`10:00 PM - 07:00 AM`). |
| AC-11 | User switches segmented control to "Applications" | Tab toggled to `Applications` | Cards switch to display active application chips (Leaves, Change Shift, Missed Punch / Attendance Adjustment with requested times, OT, OBT) with status badges (Approved, Pending, Declined). |
| AC-12 | User taps previous period arrow button (`<`) | Button pressed | Trigger haptic feedback, update period parameters (`from`, `to`), show loading overlay, and render previous cutoff's timesheet data. |
| AC-13 | User performs pull-to-refresh gesture on the feed | Scroll view pulled down | Trigger `onRefresh` handler, re-fetch timesheet details for the currently selected period, and dismiss refresh spinner on completion. |
| AC-14 | User taps on any daily card | Card pressed | Open `TimesheetDayDetailModal` bottom sheet displaying the day's biometric telemetry, complete hours breakdown, and full application history. |
| AC-15 | API returns empty records or error | Network fails or no records | Render an `EmptyState` component with an icon, explanatory text, and a "Retry" button. |
| AC-16 | Grand totals are returned from backend | Data loaded | KPI metrics cards display formatted totals for Regular Hours, Actual Worked, Overtime, Late/UT, and Absent Days matching `grandtotal` object. |

---

## 3. Database Schema (Reused)

No database migration is required. The mobile client consumes the existing backend schema:

| Table Name | Model | Purpose in Timesheet Module |
|---|---|---|
| `vw_accounts_details` | `AccountDetailVW` | Employee profile, department/unit, employee ID, and position. |
| `pay_period` | `PayPeriod` | Cutoff period definitions (`period_start`, `period_end`, `check_period_flag`). |
| `timesheets` | `Timesheet` | Calculated timesheet records, locks, and status flags. |
| `timelogs` | `Timelog` | Raw biometric clock-in / clock-out punch timestamps. |
| `leaves` | `Leave` | Filed employee leave records and hours for the cutoff. |
| `change_shifts` | `ChangeShift` | Shift change applications and requested new shift times. |
| `attendance_adjustments` | `AttendanceAdjustment` | Missed punch / attendance adjustment requests. |
| `overtimes` | `Overtime` | Overtime authorization requests and planned hours. |
| `official_business_trips` | `OfficialBusinessTrip` | Official Business Trip (OBT) itineraries and approvals. |

---

## 4. Backend Specifications

### Controller & Handler Integration
- **Controller:** `App\Http\Controllers\tk\TimesheetController@index`
- **Handler:** `App\Handlers\Timesheet\HandleTimesheet::timesheet_details($cutoff_period, $empid)`
- **Route:** `GET /api/timekeeping/timesheet_details`
- **Request Parameters**:
  ```ts
  {
    portal?: 'emp';             // When 'emp', controller binds to Auth::user()->empid
    empid?: string | number;   // Employee ID (optional if authenticated via Sanctum)
    from?: string;             // Cutoff start date (YYYY-MM-DD)
    to?: string;               // Cutoff end date (YYYY-MM-DD)
  }
  ```
- **Response Shape (200 OK)**:
  ```json
  {
    "period": {
      "id": 42,
      "period_start": "2026-08-01",
      "period_end": "2026-08-15",
      "check_period_flag": "Y",
      "paydate": "2026-08-20",
      "formatted": "Aug 01 - Aug 15, 2026"
    },
    "timesheets": {
      "timesheet_records": [
        {
          "date": "2026-08-01",
          "daystr": "Saturday",
          "monthstr": "Aug",
          "daynum": "01",
          "status": "W",
          "shift": "08:00 AM - 05:00 PM",
          "shiftin": "08:00:00",
          "shiftout": "17:00:00",
          "timein": "07:54 AM",
          "timeout": "05:03 PM",
          "reghrs": "8.00",
          "acthrs": { "hrs": "8.00" },
          "whrs": { "hrs": "8.00" },
          "excess": { "hrs": "0.00" },
          "late": { "hrs": null },
          "ut": { "hrs": null },
          "ot": { "hrs": "1.50" },
          "np": { "hrs": null },
          "npot": { "hrs": null },
          "absent": null,
          "application": {
            "leave": null,
            "cs": null,
            "aa": null,
            "ot": {
              "id": 101,
              "status": 1,
              "statusStr": "Approved",
              "planhrs": "1.5",
              "reason": "Month-end closing tasks"
            },
            "obt": null
          }
        }
      ],
      "employee": {
        "id": 12,
        "empid": "EMP-2026-0042",
        "fullname": "Alex Mercer",
        "position": "Senior Software Engineer",
        "profile": "avatar-42.webp"
      },
      "grandtotal": {
        "reghrs": "80.00",
        "acthrs": "82.50",
        "excess": "2.50",
        "late": "0.25",
        "ut": "0.00",
        "np": "0.00",
        "npot": "0.00",
        "ot": "4.50",
        "absent": "0.00"
      }
    }
  }
  ```

---

## 5. Mobile Frontend Specifications

### File Architecture
`resources/views/mobapp/src/module/employee/timekeeping/`
```text
timekeeping/
├── api/
│   ├── timekeeping.api.ts               # Timesheet API client service
│   └── attendance.api.ts                # Punch & telemetry endpoints re-export
│
├── types/
│   └── timekeeping.types.ts             # Strict TypeScript interfaces
│
├── hooks/
│   └── useTimesheetDetails.ts           # State, period navigation, and refresh logic
│
├── components/
│   ├── TimesheetPeriodHeader.tsx        # Cutoff selector with stepper arrows & status pill
│   ├── TimesheetSummaryHero.tsx         # KPI Metric Cards Carousel (Reg, Actual, OT, Late, Absent)
│   ├── TimesheetSegmentTabs.tsx         # Segmented switcher (Work Hours vs Applications)
│   ├── TimesheetDayCard.tsx             # Touch-friendly daily record timeline card
│   ├── TimesheetDayDetailModal.tsx      # Slide-up modal sheet for deep-dive day inspection
│   ├── TimesheetSkeleton.tsx            # Animated pulse loading skeleton
│   └── TimesheetEmptyState.tsx          # Empty state with retry action
│
├── pages/
│   └── TimekeepingScreen.tsx            # Primary Mobile Timekeeping & Timesheet Screen
│
└── index.ts                             # Module Barrel (@/module/employee/timekeeping)
```

---

### TypeScript Contracts (`types/timekeeping.types.ts`)

```ts
export interface TimesheetQueryParams {
  portal?: 'emp';
  empid?: string | number;
  from?: string | null;
  to?: string | null;
}

export interface CutoffPeriodData {
  id?: number;
  period_start: string;
  period_end: string;
  check_period_flag?: string;
  paydate?: string;
  formatted?: string;
}

export interface HoursMetric {
  hrs?: string | number | null;
}

export interface ApplicationItem {
  id?: number;
  status: number; // 0: Pending, 1: Approved, 2: Rejected/Declined, 3: Cancelled
  statusStr?: string;
  type?: string;
  hrs?: string | number;
  newshift_str?: string;
  new_stime?: string;
  new_ftime?: string;
  stime?: string;
  etime?: string;
  planhrs?: string | number;
  obt_type?: string;
  date?: string;
  reason?: string;
}

export interface ApplicationMap {
  leave?: ApplicationItem | null;
  cs?: ApplicationItem | null;
  aa?: ApplicationItem | null;
  ot?: ApplicationItem | null;
  obt?: ApplicationItem | null;
}

export interface DayTimesheetRecord {
  date: string;
  daystr: string;
  monthstr: string;
  daynum: string;
  status: 'W' | 'N' | 'A' | 'H' | string;
  shift: string;
  shiftin?: string | null;
  shiftout?: string | null;
  timein?: string | null;
  timeout?: string | null;
  datein?: string | null;
  dateout?: string | null;
  reghrs?: string | number;
  acthrs?: HoursMetric;
  whrs?: HoursMetric;
  excess?: HoursMetric;
  late?: HoursMetric;
  ut?: HoursMetric;
  ot?: HoursMetric;
  np?: HoursMetric;
  npot?: HoursMetric;
  absent?: string | number | null;
  application: ApplicationMap;
}

export interface GrandTotalData {
  reghrs: string | number;
  acthrs: string | number;
  excess: string | number;
  late: string | number;
  ut: string | number;
  np: string | number;
  npot: string | number;
  ot: string | number;
  absent: string | number;
}

export interface EmployeeProfileSummary {
  id: number;
  empid: string;
  fullname: string;
  position: string;
  profile?: string | null;
}

export interface TimesheetDetailsResponse {
  period: CutoffPeriodData;
  timesheets: {
    timesheet_records: DayTimesheetRecord[];
    employee?: EmployeeProfileSummary;
    grandtotal: GrandTotalData;
  };
}
```

---

### Component Specifications

#### 1. `TimesheetPeriodHeader.tsx`
- **Purpose**: Displays the active cutoff range with quick stepper navigation.
- **Visual Design**:
  - Encased in a `GlassCard` or `slate-800` card with `rounded-2xl` borders.
  - Left Stepper Button (`<` ChevronLeft) with tactile haptic trigger.
  - Center Title: Formatted cutoff dates (e.g. `Aug 01 - Aug 15, 2026`) with a status badge chip:
    - Active / Open: Emerald Badge (`CURRENT`).
    - Closed / Locked: Slate Badge (`CLOSED`).
  - Subtext: Target Disbursal pay date (e.g. `Pay Date: Aug 20, 2026`).
  - Right Stepper Button (`>` ChevronRight).

#### 2. `TimesheetSummaryHero.tsx`
- **Purpose**: High-impact horizontal KPI scroll / grid displaying cutoff aggregate metrics.
- **Metric Tiles**:
  1. **Actual Worked**: Golden Chestnut icon (`Briefcase`), big bold numerical value (e.g. `82.5h`), sub-label `Worked`.
  2. **Regular Scheduled**: Slate/Cyan icon (`Clock`), numerical value (e.g. `80.0h`), sub-label `Scheduled`.
  3. **Overtime**: Purple icon (`Flame` / `ClockFast`), numerical value (e.g. `4.5h`), sub-label `Overtime`.
  4. **Late / Undertime**: Rose/Amber icon (`AlertCircle`), numerical value (e.g. `15m / 0m`), sub-label `Late / UT`.
  5. **Absent Days**: Red icon (`UserX`), numerical value (e.g. `0 d`), sub-label `Absences`.

#### 3. `TimesheetSegmentTabs.tsx`
- **Purpose**: Segmented pill switch controlling daily card display mode.
- **Options**:
  - `Work Hours & Punches` (Default) — Focuses on biometric times and hours math.
  - `Applications & Requests` — Focuses on Leave, Change Shift, Adjustments, and OT approvals.
- **Styling**: Sleek pill container with active sliding indicator or active background in Golden Chestnut (`bg-amber-600 dark:bg-amber-500`).

#### 4. `TimesheetDayCard.tsx`
- **Purpose**: The primary touch card representing one daily DTR record.
- **Card Structure**:
  - **Left Stamp**: Calendar mini-card (Top: Golden Chestnut `AUG`, Bottom: Bold `01`, Subtext: `SAT`).
  - **Center Header**: Shift label (e.g. `08:00 AM - 05:00 PM` or `Rest Day`).
    - If Change Shift is active, original shift displays with strikethrough `<s>` pointing to the new shift.
  - **Status Badge**: Top-right pill chip:
    - `W`: Emerald Work Day (`bg-emerald-500/10 text-emerald-600`).
    - `N`: Blue Rest Day (`bg-blue-500/10 text-blue-600`).
    - `A`: Rose Absent (`bg-rose-500/10 text-rose-600`).
    - `H`: Purple Holiday (`bg-purple-500/10 text-purple-600`).
  - **Body Content (Work Hours Mode)**:
    - Dual Punch Capsules: `IN: 07:54 AM` (Emerald dot) and `OUT: 05:03 PM` (Amber dot).
    - Metric Badges Row: Actual Hours (`8.0h`), OT Badge (`+1.5h`), Late Pill (`15m Late`), Undertime Pill (`30m UT`).
  - **Body Content (Applications Mode)**:
    - Renders filed application chips (Leave, Change Shift, Missed Punch / AA, OT, OBT) with approval status badges (`Approved` in Emerald, `Pending` in Amber, `Declined` in Rose).
  - **Touch Interaction**: Card press triggers `onPress(record)` with haptic feedback to open `TimesheetDayDetailModal`.

#### 5. `TimesheetDayDetailModal.tsx`
- **Purpose**: Slide-up bottom sheet modal providing an in-depth breakdown for the selected day.
- **Content Sections**:
  1. **Header Banner**: Full date title (`Saturday, August 01, 2026`), status badge, and shift info.
  2. **Biometric Telemetry Matrix**: Time In, Time Out, Log Dates, Shift Window, and Device punch info.
  3. **Hours & Premium Breakdown Grid**:
     - Regular Scheduled Hours (`8.00`)
     - Actual Rendered Hours (`8.00`)
     - Excess Hours (`0.00`)
     - Tardiness / Late Minutes (`15 mins`)
     - Undertime Minutes (`0 mins`)
     - Approved Overtime (`1.50 hrs`)
     - Night Differential (NP: `0.00`, NPOT: `0.00`)
  4. **Linked Applications Section**:
     - Full card for any attached Leaves, Change Shifts, Attendance Adjustments, OT, or OBT filings with submission timestamps and approver status.

---

## 6. Business Rules & Edge Cases

### HRMS Business Rules
1. **Portal Separation**:
   - The mobile client requests timesheet details with `portal=emp`, ensuring the backend binds strictly to `Auth::user()->empid`. Cross-employee data access is prohibited.
2. **Change Shift Display**:
   - When an approved Change Shift (`application.cs.status === 1`) exists for a date, the card displays the original shift with a strikethrough (`<s>`), followed by an arrow pointing to the new shift schedule.
3. **Carryover Applications**:
   - Applications filed and approved late from an immediately prior cutoff are factored into current grand totals under carryover rules, tagged with `is_carryover: 1`.
4. **Shift Turnover Cross-Midnight Handling**:
   - For night shifts (e.g. `10:00 PM - 06:00 AM`), `dateout` represents the following calendar day. The UI displays the full timestamp without displaying negative or invalid durations.

### Non-Functional & Failure-Mode Checklist

| Category | Must State |
|---|---|
| **Authorization** | Restricted to authenticated mobile users via Sanctum session cookies or bearer tokens. The endpoint resolves `empid` from `Auth::user()->empid`. Unauthorized calls return `401 Unauthorized`. |
| **Concurrency / double-submit** | Pull-to-refresh and period stepping are debounced/locked while a request is in flight (`isLoading: true`), preventing multiple concurrent requests. |
| **Idempotency on retries** | The timesheet query is a pure idempotent `GET` request. Retrying network calls produces identical calculations and causes no side effects. |
| **Error response shape & status codes** | Non-200 responses return standard JSON: `{ "message": "Failed to load timesheet details" }`. HTTP 400/404/500 errors trigger the `TimesheetEmptyState` error view with a "Retry" button. |
| **Input validation boundaries** | Query parameters `from` and `to` are validated as ISO-8601 date strings (`YYYY-MM-DD`). Invalid dates or missing parameters default safely to the current active pay period. |

---

## 7. Build Order

1. **Phase 1 — TypeScript Contracts & API Layer**:
   - Create `resources/views/mobapp/src/module/employee/timekeeping/types/timekeeping.types.ts` defining strict data interfaces.
   - Create `resources/views/mobapp/src/module/employee/timekeeping/api/timekeeping.api.ts` implementing the `fetchTimesheetDetails()` service.
2. **Phase 2 — State Management Composable Hook**:
   - Create `resources/views/mobapp/src/module/employee/timekeeping/hooks/useTimesheetDetails.ts` managing active period, timesheet records, grand totals, loading state, pull-to-refresh, and period steppers.
3. **Phase 3 — UI Components Construction (Gate 1 Static / Themed)**:
   - Build `TimesheetPeriodHeader.tsx` with period steppers and status chip.
   - Build `TimesheetSummaryHero.tsx` with KPI metric cards.
   - Build `TimesheetSegmentTabs.tsx` with segmented mode switcher.
   - Build `TimesheetDayCard.tsx` with calendar stamp, shift pills, punch badges, and status chips.
   - Build `TimesheetDayDetailModal.tsx` for slide-up bottom sheet inspection.
   - Build `TimesheetSkeleton.tsx` and `TimesheetEmptyState.tsx`.
4. **Phase 4 — Screen Assembly & Integration (Gate 2 Dynamic)**:
   - Refactor `TimekeepingScreen.tsx` to assemble the full component suite, wiring `useTimesheetDetails` live data and theme hooks.
   - Update `resources/views/mobapp/src/module/employee/timekeeping/index.ts` barrel exports.
5. **Phase 5 — Verification & Testing**:
   - Verify period navigation, pull-to-refresh, segmented tab switching, card inspection modal, Dark/Light mode theme transitions, and empty/error handling.

---

## 8. Out of Scope (Future Specs)

- Offline local SQLite timesheet caching for zero-connectivity environments.
- Direct inline application filing modal launched from within the daily timesheet card.
- PDF timesheet export directly on mobile device via `expo-print` or server-side DOMPDF stream.

---

## 9. Definition of Done

- [ ] Every row in the **Acceptance Criteria** table passes (`AC-1` through `AC-16`).
- [ ] Every category in the **Non-Functional & Failure-Mode Checklist** is addressed.
- [ ] No table-based layout used on mobile; 100% touch-first responsive card and timeline design.
- [ ] Strict TypeScript typing with zero `any` declarations in the timekeeping module.
- [ ] Seamless Light and Dark mode adherence with Golden Chestnut branding (`#CB793A` / `#E2A35A`).
- [ ] Verified live against backend `/api/timekeeping/timesheet_details` endpoint.

---

<!-- Changelog -->
<!-- v1 — 2026-09-02 — initial specification for modern non-table mobile timesheet details with parity to web timesheet calculations, cutoff period navigation, segmented metrics, daily card timeline, and daily detail inspection modal. -->
