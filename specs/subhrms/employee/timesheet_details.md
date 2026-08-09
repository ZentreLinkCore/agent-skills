# Spec — Employee Timesheet Details Module Improvement

> **Kind:** Extension (Refactoring & UI/UX Enhancement of existing `timesheet_details` module)
> **Portal:** **Employee / Timekeeping** (`/api/timekeeping/timesheet_details`, `resources/views/web/src/module/employee/timesheet_details`).
> **Route:** `employee/timesheet-details` (`employee_timesheet_details`).
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules](../../rules/hrms-rules.md), [ui-design](../../rules/ui-design.md).
> **System Awareness:** Models reused (`AccountDetailVW`, `PayPeriod`, `Timesheet`); Tables reused (`vw_accounts_details`, `pay_period`, `timesheets`, `timelogs`); Routes reused (`GET /api/timekeeping/timesheet_details`); New migration: `no`.

---

## 1. Purpose
The **Employee Timesheet Details** module is the primary Daily Time Record (DTR) view for employees to review their daily attendance logs, shift assignments, scheduled vs actual worked hours, overtime, late/undertime penalties, night differentials, absences, and associated applications (Leaves, Change Shift, Attendance Adjustments, Overtime, OBT).

This specification outlines the technical design, architectural cleanup, UI/UX polish, strict TypeScript typing, print optimizations, and export improvements required to turn `timesheet_details` into a state-of-the-art, high-performance, and resilient component.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Print Strategy (CSS `@media print` vs Hidden `#printTable` DOM Tree)

**Option A — Dynamic `@media print` CSS Stylesheet with Unified Table (Recommended)**
- Remove the duplicated ~200 lines of `#printTable` markup from [TimesheetDetails.vue](file:///d:/project/hrms/resources/views/web/src/module/employee/timesheet_details/pages/TimesheetDetails.vue#L220-L425). Apply clean `@media print` styles directly to the primary visible table container, hiding navigation headers, toolbars, tabs, and buttons during `window.print()`.

| Pros | Cons |
|---|---|
| Reduces template bloat by >200 lines of redundant HTML. | Requires careful print CSS rules to hide dynamic layout headers during print mode. |
| Single source of truth for table markup; zero synchronization bugs between print and screen views. | |
| Faster DOM rendering and reduced memory footprint. | |

**Option B — Maintain Hidden `#printTable` DOM Tree**
- Keep the dedicated `<div id="printTable">` rendered with inline static HTML/CSS styles.

| Pros | Cons |
|---|---|
| Isolated HTML table for raw browser printing. | 200+ lines of duplicated HTML markup in Vue template. |
| | Visual/content drift risk between live table and print table. |
| | Slower initial page compile and DOM mount times. |

**Recommendation:** **Option A**. Single source of truth is mandatory per project coding standards. Modern `@media print` CSS delivers clean, lightweight printable layouts without DOM duplication.

---

### Decision 2: Excel Export Strategy (Data-Driven Array Exporter vs DOM Scrape)

**Option A — Data-Driven `XLSX.utils.json_to_sheet` Array Exporter (Recommended)**
- Generate Excel workbooks directly from the reactive `timesheetRecords` array state in `useEmployeeTimesheet.ts`. Explicitly format dates, shift names, numerical hours (actual, late, overtime, undertime), status strings, and grand totals into structured JavaScript objects before building the worksheet with SheetJS.

| Pros | Cons |
|---|---|
| Independent of rendered DOM or hidden table elements. | Requires explicit column mapping function in composable/utils. |
| Clean cell formatting (numbers remain numbers, formatted date strings stay consistent). | |
| Works seamlessly on both mobile and desktop views. | |

**Option B — DOM HTML Scraping `XLSX.utils.table_to_book(table)`**
- Parse raw HTML elements from `#printTable` using SheetJS DOM reader.

| Pros | Cons |
|---|---|
| Requires minimal data transformation code. | Fragile: breaks if DOM structure changes or if table is hidden/unmounted. |
| | Loses numeric precision (strips custom styling or includes HTML text artifacts). |

**Recommendation:** **Option A**. Pure JS data transformation guarantees clean Excel files regardless of layout state or hidden DOM trees.

---

### Decision 3: Application Data & Daily Record Display Layout

**Option A — Segmented Tab Toggle (Work Hours vs Applications) with Shared Daily Rows (Recommended)**
- Keep the clean top-level tab switcher (`Timesheet / Work Hours` vs `Applications`) to control table column groups while sharing the master daily row index. Enhance the "Applications" view with badge chips for pending/approved statuses and inline drawer expandable tooltips for detailed application notes.

| Pros | Cons |
|---|---|
| Keeps the table clean and readable on standard screens without horizontal over-scroll. | Users must switch tabs to inspect applications vs hours side-by-side. |
| Focuses user attention on specific timekeeping dimensions. | |

**Option B — All-In-One Ultra-Wide Table (18+ Columns)**
- Combine Work Hours and Applications into a single giant 18-column scrollable table.

| Pros | Cons |
|---|---|
| Displays all data without tab clicks. | Severe horizontal overflow; hard to scan on laptops and mobile devices. |

**Recommendation:** **Option A**. Preserves high readability and clean aesthetics while preventing table bloat.

---

### Decision 4: TypeScript Safety & Interface Definitions

**Option A — Strict Typed Interfaces (`types.timesheet_details.ts`) (Recommended)**
- Replace all `any` types in `types.timesheet_details.ts` with explicit TypeScript interfaces (`ITimesheetRecord`, `IEmployeeApplication`, `IGrandTotal`, `IPayPeriod`, `ITimesheetResponse`).

| Pros | Cons |
|---|---|
| Type safety across composables, API calls, and Vue components. | Requires updating existing type declarations. |
| Auto-completion and immediate lint feedback in IDE. | |

**Option B — Loose / Permissive Typing (`any`)**
- Keep existing `any` fields in types.

| Pros | Cons |
|---|---|
| Zero upfront typing effort. | Silent runtime errors, no IDE code hints, fragile refactoring. |

**Recommendation:** **Option A**. Aligns strictly with project TypeScript standards.

---

## 3. Database Schema (Reused)

No database migration is required. The feature consumes existing tables through Eloquent models:

| Table Name | Model | Purpose |
|---|---|---|
| `vw_accounts_details` | `AccountDetailVW` | Employee profile, department/unit, position information. |
| `pay_period` | `PayPeriod` | Cutoff period dates (`period_start`, `period_end`, `check_period_flag`). |
| `timesheets` | `Timesheet` | Calculated timesheet records and status. |
| `timelogs` | `Timelog` | Raw biometric clock-in / clock-out punches. |
| `leaves` | `Leave` | Applied leave applications for the cutoff. |
| `change_shifts` | `ChangeShift` | Applied shift change requests. |
| `attendance_adjustments` | `AttendanceAdjustment` | Missed punch / attendance adjustment requests. |
| `overtimes` | `Overtime` | Overtime authorization requests. |
| `official_business_trips` | `OfficialBusinessTrip` | Official Business Trip (OBT) filings. |

---

## 4. Backend Specifications

### Controller
- **File:** `app/Http/Controllers/tk/TimesheetController.php`
- **Method:** `index(Request $request)`
- **Behavior**:
  1. Resolves `empid`: if portal is `emp`, extracts `Auth::user()->empid`.
  2. Invokes `HandlePayPeriodQuery::handlePeriod($req)` to resolve current or requested cutoff range.
  3. Calls `HandleTimesheet::timesheet_details($cutoff_period, $empid)` to construct daily records and `grandtotal`.
  4. Returns raw JSON response:
     ```json
     {
       "period": {
         "id": 42,
         "period_start": "2026-08-01",
         "period_end": "2026-08-15",
         "check_period_flag": "Y"
       },
       "timesheets": {
         "timesheet_records": [ ... ],
         "employee": { ... },
         "grandtotal": { ... }
       }
     }
     ```

### Routes
- **Route file:** `routes/api/timekeeping.php`
- **Definition:** `Route::get('/timesheet_details', [TimesheetController::class, 'index']);`
- **URL Prefix:** `/api/timekeeping/timesheet_details`

---

## 5. Frontend Specifications

### File Architecture
`resources/views/web/src/module/employee/timesheet_details/`
```
timesheet_details/
├── index.ts                         # Barrel re-export
├── route/timesheet_details.routes.ts# Vue Router configuration
├── api/timesheet_details.api.ts     # Service layer HTTP requests
├── composables/useEmployeeTimesheet.ts # State, fetch logic, Excel export
├── pages/TimesheetDetails.vue       # Main page layout & view assembly
├── components/
│   ├── TimesheetDetailsHeader.vue   # Breadcrumb + Hero Banner
│   └── TimesheetDetailsTable.vue    # Data grid, status badges, totals summary
└── types/types.timesheet_details.ts # Strict TS interfaces
```

### TypeScript Contracts (`types/types.timesheet_details.ts`)
```ts
export interface TimesheetParams {
  empid?: string | number;
  from?: string | null;
  to?: string | null;
  portal?: string;
}

export interface EmployeeApplicationItem {
  status?: number;
  statusStr?: string;
  type?: string;
  hrs?: string;
  newshift_str?: string;
  stime?: string;
  etime?: string;
  planhrs?: string;
  obt_type?: string;
  date?: string;
}

export interface EmployeeApplicationMap {
  leave?: EmployeeApplicationItem;
  cs?: EmployeeApplicationItem;
  aa?: EmployeeApplicationItem;
  ot?: EmployeeApplicationItem;
  obt?: EmployeeApplicationItem;
}

export interface HoursBreakdown {
  hrs?: string | number;
}

export interface TimesheetRecord {
  date: string;
  dayName: string;
  dayNum: string;
  monthStr: string;
  status: 'W' | 'N' | 'A' | 'H' | string;
  shift: string;
  shiftHours: string;
  timeIn: string | null;
  timeOut: string | null;
  actualHours: string;
  excess: string;
  late: string;
  undertime: string;
  nightPremium: string;
  nightPremiumOT: string;
  overtime: string;
  absent: string | number;
  application: EmployeeApplicationMap;
}

export interface GrandTotalSummary {
  reghrs: string;
  acthrs: string;
  excess: string;
  late: string;
  ut: string;
  np: string;
  npot: string;
  ot: string;
  absent: string;
}

export interface CutoffPeriod {
  id?: number;
  period_start: string;
  period_end: string;
  check_period_flag?: string;
}
```

---

## 6. Business Rules & Edge Cases

### HRMS Business Rules
1. **Status Code Badges**:
   - `W`: Working Day (Emerald badge).
   - `N`: Rest Day / No Shift (Blue badge).
   - `A`: Absent (Rose/Red badge).
   - `H`: Holiday (Purple badge).
2. **Shift Change Display**:
   - When a Change Shift application is approved (`status === 1`), display the original shift with a strikethrough (`<s>`), followed by an arrow pointing to the new shift.
3. **Carryover Applications**:
   - Late-approved applications from prior pay periods are processed into grand totals under `carryover_adjustments`, `carryover_overtime`, and `carryover_leaves`.

### Edge Cases
| Scenario | Expected Behavior |
|---|---|
| No records found for selected period | Render clean `EmptyState` component with message "No Timesheet Data available for this period". |
| Missing biometric punch (Time In or Time Out is null) | Render `-` placeholder without throwing Javascript runtime errors. |
| User changes pay period via `PeriodComponent` | Fetch new period data, update URL query parameters (`?from=YYYY-MM-DD&to=YYYY-MM-DD`), and trigger smooth loading spinner overlay. |
| Printing timesheet | Trigger browser `window.print()` using `@media print` styles; print layout formats employee header, daily records table, and grand totals cleanly. |

---

## 7. Build Order

1. **Phase 1 — TypeScript Refactoring**:
   - Update `types/types.timesheet_details.ts` with strict interfaces.
2. **Phase 2 — Composable & Data Layer Polish**:
   - Refactor `useEmployeeTimesheet.ts` to utilize strict types and implement data-driven `exportToExcel()` function using SheetJS JSON array mapping.
3. **Phase 3 — UI Component Refactoring**:
   - Refactor `TimesheetDetailsHeader.vue` for clean breadcrumb links.
   - Refactor `TimesheetDetailsTable.vue` for status badges and tooltips.
   - Refactor `TimesheetDetails.vue` to eliminate duplicate `#printTable` DOM markup and implement `@media print` CSS rules.
4. **Phase 4 — Verification & Testing**:
   - Verify page rendering, pay period changing, Excel exporting, and browser print functionality.

---

## 8. Out of Scope (Future Specs)

- Server-side PDF generation using DomPDF / Snappy.
- Interactive inline application filing directly from timesheet row clicks.
