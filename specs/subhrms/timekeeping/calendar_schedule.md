# Spec — Calendar Schedule (Remediation)

> **Kind:** Remediation of an existing standalone module — `module/timekeeping/calendar_schedule/` stays a separate module from `timekeeping/applications/pages/duty_roster/`, but is rebuilt to stop duplicating Duty Roster's logic and to follow this codebase's established conventions.
> **Portal:** **Timekeeping** (`/api/timekeeping/calendar-schedule` backend routes, `timekeeping/calendar_schedule` frontend module).
> **Route:** `/timekeeping/calendar-schedule` (`calendar_schedule`) — already linked from the Timekeeping Sidebar under *Timekeeping Setup > Calendar Schedule* (`useSidebarLinks.ts:277`). No route change.
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [ui-design.md](../../rules/ui-design.md), [vue-standards.md](../../rules/vue-standards.md), [duplicate-prevention.md](../../rules/duplicate-prevention.md), [naming-convention.md](../../rules/naming-convention.md).
> **System Awareness:** Models reused (`AccountDetailVW`, `Shift`, `AccountJob`, `AppChangeShift`, `Timesheet`, `AppLeave`); Tables reused only (`vw_accounts_details`, `shift`, `accountjob`, `app_shift`, `timesheet`, `app_leave`); Routes: existing `GET /api/timekeeping/calendar-schedule` (+ `/stats`) reused/fixed, existing `POST /api/timekeeping/duty-roster/publish` reused (no new publish route — see Decision 1); New migration: **no**.

---

## 1. Purpose

An audit of `module/timekeeping/calendar_schedule/` found that it calls real endpoints (it is not mock data) but is a materially weaker, incompletely-wired duplicate of `timekeeping/applications/pages/duty_roster/`, and violates several established conventions from [duplicate-prevention.md](../../rules/duplicate-prevention.md) and sibling modules like `timesheet_adjustment`.

Concrete findings (file:line references verified against current code):

1. **Duplicated business logic.** The "resolve an employee's shift for a date" priority algorithm (leave → approved shift-change → timesheet → default weekly template) is copy-pasted across `GetCalendarScheduleQuery.php:103-165`, `GetCalendarScheduleStatsQuery.php:68-107`, `GetDutyRosterQuery.php`, and `DutyRosterController::metrics()` — four independent copies of one rule.
2. **Fabricated department options.** `CalendarSchedule.vue:64-70` hardcodes `All / Operations / Front / Night` as department filter options. These are not real org units (see `Units.php` seeder / `vw_accounts_details.unit`). The correct pattern already exists: `GetTimesheetAdjustmentsQuery::departmentOptions()` (`app/Queries/Timesheet/GetTimesheetAdjustmentsQuery.php:71-83`) queries `DISTINCT unit FROM vw_accounts_details` and is consumed by `timesheet_adjustment`.
3. **Non-standard status vocabulary.** `GetCalendarScheduleQuery.php:227-233` invents `'pending' / 'confirmed' / 'review'` strings for `AppChangeShift.status`, when the rest of the app (see `types.timesheet_adjustment.ts:8,23`) uses `0=Pending, 1=Approved, 2=Disapproved` as a plain int. `'review'` for status `2` is actively wrong — `2` means *disapproved*, not "in review." The frontend then round-trips this back into a number (`CalendarSchedule.vue:125`).
4. **Non-functional UI.** "Refresh" and "Publish Week" buttons (`CalendarSchedule.vue:12-21`) have no `@click` handler. `<CalendarComponent>` (`CalendarSchedule.vue:88-93`) is never wired to the `dates-set` event that `CalendarComponent.vue:683` emits on every month/week navigation — so navigating the calendar never refetches data for the new range, even though `fetchSchedule()` (`useCalendarSchedule.ts:39-49`) never sends `startDate`/`endDate` to begin with.
5. **Dead code / inconsistent state.** `selectDay()` (`useCalendarSchedule.ts:69-71`) is exported but never called; the page defines its own disconnected `handleDateSelect` (`CalendarSchedule.vue:144-146`) instead. `filters.department` (`useCalendarSchedule.ts:24`) is initialized and never updated — vestigial. `fetchStats()` never re-runs when filters change, so the 4 KPI cards stay company-wide even when the calendar is filtered by department.
6. **Untyped/dead types.** `types.calendar_schedule.ts` exports `{ [key: string]: any }` bags instead of real shapes; `CalendarScheduleStatistics` is exported but never referenced anywhere; `calendar_schedule.api.ts` imports 3 types it never uses.
7. **Structural inconsistency.** Every other timekeeping module with real UI (`timesheet_adjustment`, `duty_roster`, `holidays`, etc.) decomposes into a `components/` folder. `calendar_schedule` inlines everything into one 147-line `pages/CalendarSchedule.vue`.

**Decision (confirmed with user):** Fix in place. `calendar_schedule` stays its own module — it serves a different job than Duty Roster (passive, company-wide coverage monitoring vs. Duty Roster's active per-employee assignment editing) — but it must stop re-implementing logic Duty Roster already owns, and must be brought up to the conventions `timesheet_adjustment` already demonstrates.

---

## 2. Design Decisions

### Decision 1: Delegate writes to Duty Roster instead of building parallel write endpoints
- **"Publish Week" calls the existing `POST /api/timekeeping/duty-roster/publish`** (`DutyRosterController::publish`, already implements "flip draft `AppChangeShift` rows to Approved for a date range"). No new publish controller/route is created — per [duplicate-prevention.md](../../rules/duplicate-prevention.md) §5, a parallel publish endpoint for the same table/status transition is a hard violation.
- Calendar Schedule remains **read-mostly**: it triggers the existing write action but does not gain its own drag/drop/swap/delete UI — that stays exclusive to Duty Roster.

### Decision 2: Extract the shared shift-resolution algorithm
- Add one static helper, e.g. `App\Queries\Shift\ResolveDailyShiftAssignments::forEmployees(array $employeeIds, string $date, $shifts, $accountJobs, $leaves, $shiftChanges, $timesheets, string $weekdayField): array`, encoding the existing leave → approved-shift-change → timesheet → default-template priority order once.
- `GetCalendarScheduleQuery` and `GetCalendarScheduleStatsQuery` both call it instead of keeping their own private copies.
- Out of scope for this spec (flagged as follow-up, not required to ship this fix): migrating `GetDutyRosterQuery` / `DutyRosterController::metrics()` onto the same helper. Do not touch Duty Roster's files as part of this build — only note the helper is written so it *can* be adopted later without another rewrite.

### Decision 3: Numeric status end-to-end
- `GetCalendarScheduleQuery`'s assignment mapper returns the raw `status` int (`0/1/2`) instead of `'pending'/'confirmed'/'review'` strings.
- `CalendarSchedule.vue`/its calendar-event mapper consumes the int directly — delete the `assignment.status === 'confirmed' ? 1 : ...` round-trip.

### Decision 4: Dynamic department options, shared, not hardcoded
- Extract `departmentOptions()` out of `GetTimesheetAdjustmentsQuery` (`app/Queries/Timesheet/GetTimesheetAdjustmentsQuery.php:71-83`) into a shared location (e.g. `App\Queries\Shift\ResolveDailyShiftAssignments` is the wrong home for this — put it in a small shared org-lookup helper, e.g. `App\Queries\Shared\OrgOptionsQuery::departments()`), so `GetTimesheetAdjustmentsQuery` and the calendar-schedule queries both call the same source instead of one owning a private copy the other can't reach.
- `GetCalendarScheduleQuery::execute()` returns `'departments' => [...]` in its payload the same shape `timesheet_adjustment` already returns and consumes.
- Frontend department `<select>` renders from `store.departments` (fetched, not hardcoded) — delete the static `Operations/Front/Night` options.

### Decision 5: Split the page into `components/`, matching every sibling module
- Move the header actions, 4 stat cards, search/department filter bar, and calendar wrapper out of the 147-line inlined template into dedicated components, following the exact shape `timesheet_adjustment` uses (see §5).

### Decision 6: Composable becomes the single source of truth for date range + selection
- `useCalendarSchedule.ts` gains a real `dateRange` ref (`{ start, end }`), updated by a new `setDateRange(start, end)` mutator that both `fetchSchedule` and `fetchStats` read from and re-trigger on.
- `fetchSchedule` and `fetchStats` both send `startDate`/`endDate` and both re-run on every filter/date-range change (fixes the stale-KPI bug in Finding 5).
- Remove dead code: `selectDay()` is either wired to the page's date-select handler (single code path) or deleted; the vestigial `filters.department` key is removed since `selectedDepartment` is already the real source of truth; unused type imports in `useCalendarSchedule.ts` and `calendar_schedule.api.ts` are removed.

---

## 3. Database

No new tables/columns — 100% reused, same tables Duty Roster already reads:

| Table | Model | Role |
|---|---|---|
| `vw_accounts_details` | `AccountDetailVW` | Employee roster, department (`unit`), search fields |
| `shift` | `Shift` | Shift type/time/color definitions |
| `accountjob` | `AccountJob` | Per-employee default weekly shift template (`shiftmon`...`shiftsun`) |
| `app_shift` | `AppChangeShift` | Shift-change requests/overrides (status `0/1/2`) |
| `timesheet` | `Timesheet` | Actual logged/assigned shift per date |
| `app_leave` | `AppLeave` | Approved leave, takes priority over any shift |

---

## 4. Backend Strategy (Gate 2)

- **New shared helper** `App\Queries\Shift\ResolveDailyShiftAssignments` — extracts the priority-resolution loop currently duplicated in `GetCalendarScheduleQuery.php:103-165` and `GetCalendarScheduleStatsQuery.php:68-107`. Both queries call it; behavior is unchanged, just de-duplicated.
- **New shared helper** for department options (extracted from `GetTimesheetAdjustmentsQuery::departmentOptions()`) — both that query and `GetCalendarScheduleQuery` call it. `GetCalendarScheduleQuery`'s response gains a top-level `'departments'` array in the same `{value, label}` shape `timesheet_adjustment` uses.
- **`GET /api/timekeeping/calendar-schedule`**: keep existing `search`, `department` params; ensure `startDate`/`endDate` are actually threaded through from the frontend's `dates-set` payload (backend default-to-current-month logic in `GetCalendarScheduleQuery.php:20-21` stays as the fallback when no range is supplied — this is already correct and should not be changed to `duty_roster`'s hardcoded `2026-06-01`..`2026-06-30` mock range). Assignment status is returned as raw int, not string (Decision 3).
- **`GET /api/timekeeping/calendar-schedule/stats`**: same param handling as above (currently ignores `department`/date entirely — add support so KPI cards can be filtered/scoped consistently with the main query).
- **No new routes.** "Publish Week" in the frontend calls the existing `POST /api/timekeeping/duty-roster/publish`.

---

## 5. Frontend Architecture (Gate 1)

Target structure, matching `timesheet_adjustment`'s decomposition:

```
module/timekeeping/calendar_schedule/
├── index.ts                                  # Barrel re-export (unchanged)
├── route/calendar_schedule.routes.ts          # Route: /timekeeping/calendar-schedule (unchanged)
├── api/calendar_schedule.api.ts               # Typed params & typed responses (getSchedule, getStats, publish)
├── types/types.calendar_schedule.ts           # Real interfaces: ScheduleDay, Assignment, CalendarStats, DepartmentOption
├── composables/useCalendarSchedule.ts         # Single source of truth: dateRange, filters, selection, fetch orchestration
├── pages/CalendarSchedule.vue                 # Composition only — no inline markup for header/stats/filters
└── components/
    ├── CalendarScheduleHeader.vue             # Refresh (@click re-fetches) + Publish Week (@click calls duty-roster publish)
    ├── CalendarScheduleMetrics.vue             # 4 stat cards, reactive to store.stats
    ├── CalendarScheduleFilters.vue             # Search input + dynamic department <select> from store.departments
    └── CalendarScheduleCalendar.vue            # Wraps <CalendarComponent>, listens to @dates-set AND @date-select
```

- `types.calendar_schedule.ts` replaces every `{ [key: string]: any }` bag with the real backend shape:
  - `ScheduleDay { date, label, day, shift, coverage, count, highlight, color }` (matches `GetCalendarScheduleQuery.php:185-194`)
  - `Assignment { id, employee, role, shift, date, status: number }` (matches Decision 3)
  - `CalendarStats { activeSchedules, coverageRate, pendingSwaps, nextPublish }` (matches `GetCalendarScheduleStatsQuery.php:115-123`)
  - `DepartmentOption { value: string, label: string }`
  - Delete the unused `CalendarScheduleStatistics` export.
- `api/calendar_schedule.api.ts` types `getSchedule`/`getStats` params and return values (no more `Promise<any>`), and adds `publishWeek(startDate, endDate)` calling `POST /api/timekeeping/duty-roster/publish` — matching `timesheet_adjustment/api/timesheet_adjustment.api.ts`'s fully-typed pattern.

---

## 6. Business Rules & Edge Cases

| Case | Handling |
|---|---|
| Calendar navigated to a different month/week | `CalendarScheduleCalendar.vue` listens to `@dates-set`, calls `store.setDateRange(startStr, endStr)`, which re-runs both `fetchSchedule` and `fetchStats` for the new range. |
| Department filter changed | Re-runs `fetchSchedule` **and** `fetchStats` (currently only `fetchSchedule` reruns — Finding 5) so KPI cards match the filtered view. |
| Department dropdown options | Sourced from `GET /api/timekeeping/calendar-schedule`'s `departments` array (Decision 4), not hardcoded. |
| Assignment status | Raw int `0` Pending / `1` Approved / `2` Disapproved, consistent with `AppChangeShift` everywhere else — no string vocabulary layer. |
| "Publish Week" click | Calls existing `POST /api/timekeeping/duty-roster/publish` with the current visible date range; shows a toast on success/failure; triggers `fetchSchedule`/`fetchStats` refresh after publish. |
| "Refresh" click | Re-runs `fetchSchedule` + `fetchStats` for the current date range/filters. |
| Date cell selected | Single code path through `store.selectDay()` (page no longer defines its own parallel `handleDateSelect`). |

---

## 7. Build Order

1. **Gate 2 (Backend)**:
   - Extract `ResolveDailyShiftAssignments` shared helper; refactor `GetCalendarScheduleQuery` and `GetCalendarScheduleStatsQuery` to use it.
   - Extract shared `departmentOptions()` helper; wire it into `GetCalendarScheduleQuery`'s response; leave `GetTimesheetAdjustmentsQuery` calling the same shared helper instead of its own private copy.
   - Fix assignment status to raw int; add `startDate`/`endDate`/`department` support to the `/stats` endpoint.
2. **Gate 1 (Frontend)**:
   - Add `components/` folder; split `CalendarSchedule.vue` into `CalendarScheduleHeader/Metrics/Filters/Calendar.vue`.
   - Rewrite `types.calendar_schedule.ts` with real interfaces; remove dead `CalendarScheduleStatistics` and unused imports.
   - Rewrite `useCalendarSchedule.ts`: add `dateRange` + `setDateRange`, make `fetchStats` reactive to filters/date-range, remove vestigial `filters.department`, resolve the `selectDay`/`handleDateSelect` duplication to one path.
   - Wire `@dates-set` on `<CalendarComponent>`; wire "Refresh" and "Publish Week" buttons; add `publishWeek()` to the API service pointed at `duty-roster/publish`.
3. **Follow-up (not required to close this spec):** consider migrating `GetDutyRosterQuery` / `DutyRosterController::metrics()` onto the same `ResolveDailyShiftAssignments` helper so all four call sites converge to one implementation.
